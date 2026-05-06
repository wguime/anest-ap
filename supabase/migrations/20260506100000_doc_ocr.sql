-- ============================================================================
-- Sprint 4 / Onda 2 / O2-2 — OCR para PDFs escaneados
-- ----------------------------------------------------------------------------
-- Adiciona colunas para rastrear status e resultado do OCR client-side
-- (Tesseract WASM v5). Atualiza o trigger de FTS para indexar `ocr_text`
-- com weight 'D' (mais baixo que titulo/codigo/descricao/tags, mas
-- suficiente para que conteúdo de PDFs escaneados seja encontrado em busca
-- full-text).
--
-- Estados possíveis (`documentos.ocr_status`):
--   - NULL          : nunca avaliado (legacy / pré-Sprint 4)
--   - 'pending'     : aguardando processamento
--   - 'processing'  : OCR em execução
--   - 'done'        : OCR concluído com sucesso (ocr_text populado)
--   - 'failed'      : OCR tentou e falhou (verificar logs / reprocess manual)
--   - 'skipped'     : marcado manualmente como dispensado por admin
--   - 'not_needed'  : detectado como text-based (não escaneado) na heurística
--
-- Adiciona ainda 4 ações novas ao CHECK de `documento_changelog.action`:
--   - 'ocr_started', 'ocr_completed', 'ocr_failed', 'ocr_skipped'
-- ============================================================================

-- 1. Colunas OCR em `documentos`
alter table public.documentos
  add column if not exists ocr_status text
    check (ocr_status is null or ocr_status in (
      'pending','processing','done','failed','skipped','not_needed'
    )),
  add column if not exists ocr_text text,
  add column if not exists ocr_text_url text,
  add column if not exists ocr_engine text,
  add column if not exists ocr_confidence numeric,
  add column if not exists ocr_pages_processed int,
  add column if not exists ocr_run_at timestamptz;

-- 2. Index parcial: fila de pendentes (pequena, mesmo em escala)
create index if not exists idx_doc_ocr_pending
  on public.documentos (created_at)
  where ocr_status = 'pending';

-- 3. Atualiza trigger FTS para incluir ocr_text com weight 'D'
create or replace function public.update_documentos_fts()
returns trigger as $$
begin
  new.fts :=
    setweight(to_tsvector('portuguese', coalesce(new.titulo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.codigo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.descricao, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(new.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(new.ocr_text, '')), 'D');
  return new;
end;
$$ language plpgsql;

-- 4. Estende CHECK de documento_changelog.action com as 4 ações OCR
alter table public.documento_changelog
  drop constraint if exists documento_changelog_action_check;

alter table public.documento_changelog
  add constraint documento_changelog_action_check
  check (action in (
    'created','status_changed','updated','version_added',
    'approved','rejected','archived','restored','deleted',
    'viewed','downloaded','acknowledged','review_scheduled',
    'signature_added','comment_added',
    'distributed','reminder_sent','approval_workflow_set',
    'legal_hold_set','legal_hold_released',
    -- Sprint 4 / Onda 2 / O2-2:
    'ocr_started','ocr_completed','ocr_failed','ocr_skipped'
  ));

-- 5. Comentários documentando as colunas
comment on column public.documentos.ocr_status is
  'Status do OCR client-side (Tesseract WASM). NULL = nunca avaliado; pending/processing/done/failed/skipped/not_needed.';
comment on column public.documentos.ocr_text is
  'Texto extraído via OCR. Indexado em fts (weight D). NULL para PDFs text-based (ocr_status=not_needed).';
comment on column public.documentos.ocr_text_url is
  'Storage path opcional do .txt para auditoria/download. Não é fonte de verdade — ocr_text é.';
comment on column public.documentos.ocr_engine is
  'Identificador da engine usada (ex: tesseract-wasm-v5-por). Permite re-OCR com engine diferente no futuro.';
comment on column public.documentos.ocr_confidence is
  'Confiança média reportada pela engine (0-1). Útil para sinalizar OCR fraco que merece reprocessamento.';
comment on column public.documentos.ocr_pages_processed is
  'Quantidade de páginas que passaram pelo OCR (pode ser < total para PDFs híbridos).';
comment on column public.documentos.ocr_run_at is
  'Timestamp da última execução do OCR (sucesso ou falha).';
