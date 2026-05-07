-- ============================================================================
-- Sprint 6 / Onda 2 / O2-3 — PDF/A export para documentos arquivados
-- ----------------------------------------------------------------------------
-- Quando um documento passa para status='arquivado', o pipeline tenta gerar
-- uma versão PDF/A-2b candidata via edge function `pdfa-convert`. A versão
-- PDF/A é armazenada no bucket `documentos-pdfa` (separado do `documentos`
-- para retention independente) e referenciada via `pdfa_url`.
--
-- Estados possíveis (`documentos.pdfa_status`):
--   - NULL          : nunca avaliado (legacy / pré-Sprint 6)
--   - 'pending'     : aguardando conversão
--   - 'processing'  : conversão em execução
--   - 'done'        : PDF/A gerado e disponível em pdfa_url
--   - 'failed'      : conversão falhou (verificar logs / reprocessar manual)
--   - 'not_needed'  : documento não exige PDF/A (ex: já é PDF/A)
--
-- Adiciona ações novas ao CHECK de `documento_changelog.action`:
--   - 'pdfa_started', 'pdfa_generated', 'pdfa_failed'
-- ============================================================================

-- 1. Colunas PDF/A em `documentos`
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS pdfa_status text
    CHECK (pdfa_status IS NULL OR pdfa_status IN (
      'pending','processing','done','failed','not_needed'
    )),
  ADD COLUMN IF NOT EXISTS pdfa_url text,
  ADD COLUMN IF NOT EXISTS pdfa_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdfa_pages int,
  ADD COLUMN IF NOT EXISTS pdfa_size_bytes bigint;

-- 2. Index parcial: fila de pendentes em arquivamento
CREATE INDEX IF NOT EXISTS idx_doc_pdfa_pending
  ON public.documentos (created_at)
  WHERE status = 'arquivado' AND pdfa_status = 'pending';

-- 3. Estende CHECK de documento_changelog.action com as 3 ações PDF/A
ALTER TABLE public.documento_changelog
  DROP CONSTRAINT IF EXISTS documento_changelog_action_check;

ALTER TABLE public.documento_changelog
  ADD CONSTRAINT documento_changelog_action_check
  CHECK (action IN (
    'created','status_changed','updated','version_added',
    'approved','rejected','archived','restored','deleted',
    'viewed','downloaded','acknowledged','review_scheduled',
    'signature_added','comment_added',
    'distributed','reminder_sent','approval_workflow_set',
    'legal_hold_set','legal_hold_released',
    'ocr_started','ocr_completed','ocr_failed','ocr_skipped',
    'bulk_imported',
    -- Sprint 6 / Onda 2 / O2-3:
    'pdfa_started','pdfa_generated','pdfa_failed'
  ));

-- 4. Comentários documentando as colunas
COMMENT ON COLUMN public.documentos.pdfa_status IS
  'Status da conversão PDF/A. NULL = nunca avaliado; pending/processing/done/failed/not_needed.';
COMMENT ON COLUMN public.documentos.pdfa_url IS
  'Storage path do PDF/A no bucket documentos-pdfa (formato bucket/path). NULL quando não-aplicável.';
COMMENT ON COLUMN public.documentos.pdfa_processed_at IS
  'Timestamp da última execução da conversão PDF/A.';
COMMENT ON COLUMN public.documentos.pdfa_pages IS
  'Número de páginas no PDF/A gerado (eco do PDF de entrada).';
COMMENT ON COLUMN public.documentos.pdfa_size_bytes IS
  'Tamanho em bytes do PDF/A gerado (uso para retention/storage budget).';

-- 5. Bucket documentos-pdfa: criar via SQL (idempotente)
-- Nota: bucket creation via SQL exige role com permissão ao schema storage.
-- Em prod, esta seção é executada via psql como service_role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-pdfa',
  'documentos-pdfa',
  false,                     -- não-público; signed URLs apenas
  52428800,                  -- 50 MB max por arquivo
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies — read authenticated, write service-role apenas
DROP POLICY IF EXISTS storage_pdfa_select_authenticated ON storage.objects;
CREATE POLICY storage_pdfa_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pdfa');

DROP POLICY IF EXISTS storage_pdfa_no_client_writes ON storage.objects;
CREATE POLICY storage_pdfa_no_client_writes ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'documentos-pdfa');

-- 7. RPC helper: marca PDF/A como pending (chamado pelo arquivamento)
CREATE OR REPLACE FUNCTION public.rpc_request_pdfa_conversion(
  p_documento_id text,
  p_user_id text
) RETURNS void AS $$
BEGIN
  UPDATE public.documentos
    SET pdfa_status = 'pending'
    WHERE id = p_documento_id AND status = 'arquivado'
      AND (pdfa_status IS NULL OR pdfa_status IN ('failed','not_needed'));

  INSERT INTO public.documento_changelog (documento_id, action, changed_by, changes)
  VALUES (p_documento_id, 'pdfa_started', p_user_id, jsonb_build_object('queued_at', now()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_request_pdfa_conversion(text, text) TO authenticated;
