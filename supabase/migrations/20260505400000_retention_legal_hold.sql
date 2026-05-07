-- ============================================================================
-- Onda 1 — Sprint 3 — Retention Policies + Legal Hold para `documentos`
-- ----------------------------------------------------------------------------
-- Roadmap: Onda1-3
-- Objetivo:
--   1. Criar catálogo de retention_policies (CFM, LGPD, Anvisa, Receita)
--   2. Adicionar colunas legal_hold + retention_until em `documentos`
--   3. Trigger que bloqueia DELETE/soft-archive sob legal hold
--   4. Funções aplicar_retention_policy() e archive_expired_documents()
--      chamadas via pg_cron (schedule mantido COMENTADO até validação manual)
--
-- Dependências satisfeitas:
--   ✓ pg_cron habilitado em prod (20260422223000_schedule_shift_reminders_cron.sql)
--   ✓ documento_changelog action CHECK aceita 'legal_hold_set' / 'legal_hold_released'
--     (20260504100100_extend_changelog_actions.sql)
--   ✓ deleted_at/deleted_by já existem em `documentos` (Wave 0)
--
-- Compliance:
--   - CFM 2.217/2018 — atas comitê ética 10a
--   - Receita Federal — docs contábeis 10a
--   - Anvisa RDC 36 — protocolos CCIH 5a
--   - Qmentum — relatórios 5a, atas 5a, auditorias 7a
--   - LGPD Art. 15 — base legal explicitada por categoria
--
-- IMPORTANTE: schedule do pg_cron está COMENTADO. Habilitar manualmente após:
--   (a) Comitê de Ética ratificar prazos da tabela retention_policies
--   (b) UI permitir flagging de documentos como legal_hold
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. retention_policies — catálogo
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       text UNIQUE NOT NULL,
  retention_years integer NOT NULL CHECK (retention_years > 0 OR retention_years = -1),
  descricao       text,
  base_legal      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.retention_policies IS
  'Catálogo de políticas de retenção por categoria de documento. retention_years = -1 indica retenção permanente.';

COMMENT ON COLUMN public.retention_policies.retention_years IS
  'Anos de retenção a partir de created_at do documento. -1 = permanente (não expira).';

-- Seed inicial — categorias canônicas de `documentos` (ver `documents.js`)
INSERT INTO public.retention_policies (categoria, retention_years, descricao, base_legal) VALUES
  ('etica',        10, 'Atas comitê de ética',                           'CFM 2.217/2018'),
  ('comites',       5, 'Atas reuniões clínicas e comitês institucionais','Qmentum 5.2'),
  ('auditorias',    7, 'Relatórios de auditoria interna/externa',        'Qmentum 5.2'),
  ('relatorios',    5, 'Relatórios trimestrais e anuais',                'Qmentum 5.2'),
  ('biblioteca',   -1, 'Bibliografia técnica — retenção permanente',      NULL),
  ('financeiro',   10, 'Documentos contábeis e fiscais',                  'Receita Federal — Decreto 3.000/1999'),
  ('medicamentos',  5, 'Protocolos farmacológicos',                      'Anvisa'),
  ('infeccoes',     5, 'Protocolos CCIH',                                 'Anvisa RDC 36/2013'),
  ('desastres',     5, 'Planos de contingência e gestão de crise',        'CFM')
ON CONFLICT (categoria) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Colunas em `documentos`
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS legal_hold          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_hold_reason   text,
  ADD COLUMN IF NOT EXISTS legal_hold_set_at   timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold_set_by   text,
  ADD COLUMN IF NOT EXISTS retention_until     timestamptz,
  ADD COLUMN IF NOT EXISTS retention_policy_id uuid REFERENCES public.retention_policies(id);

COMMENT ON COLUMN public.documentos.legal_hold IS
  'Quando true, bloqueia DELETE físico e soft-archive (deleted_at) via trigger trg_prevent_delete_if_legal_hold. Usado em casos de litígio, investigação ou requisição judicial.';

COMMENT ON COLUMN public.documentos.retention_until IS
  'Data limite de retenção. Calculada via apply_retention_policy() = created_at + retention_policies.retention_years. NULL = sem política aplicada ainda.';

CREATE INDEX IF NOT EXISTS idx_documentos_retention_until
  ON public.documentos(retention_until)
  WHERE deleted_at IS NULL AND legal_hold = false;

CREATE INDEX IF NOT EXISTS idx_documentos_legal_hold
  ON public.documentos(legal_hold)
  WHERE legal_hold = true;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Trigger — bloqueia DELETE/soft-archive sob legal hold
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_delete_if_legal_hold()
RETURNS trigger AS $$
BEGIN
  IF OLD.legal_hold = true THEN
    IF (TG_OP = 'DELETE') THEN
      RAISE EXCEPTION 'Documento sob legal hold não pode ser excluído (id=%, motivo=%)',
        OLD.id, OLD.legal_hold_reason;
    END IF;
    IF (TG_OP = 'UPDATE')
       AND NEW.deleted_at IS NOT NULL
       AND OLD.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Documento sob legal hold não pode ser arquivado (id=%, motivo=%)',
        OLD.id, OLD.legal_hold_reason;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_if_legal_hold ON public.documentos;
CREATE TRIGGER trg_prevent_delete_if_legal_hold
  BEFORE DELETE OR UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_if_legal_hold();

-- ──────────────────────────────────────────────────────────────────────────
-- 4. apply_retention_policy() — preenche retention_until em docs sem política
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_retention_policy()
RETURNS integer AS $$
DECLARE
  updated_count int := 0;
BEGIN
  UPDATE public.documentos d
    SET retention_until    = (d.created_at + (rp.retention_years || ' years')::interval),
        retention_policy_id = rp.id
    FROM public.retention_policies rp
   WHERE d.categoria = rp.categoria
     AND d.retention_until IS NULL
     AND rp.retention_years > 0;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.apply_retention_policy IS
  'Backfill: preenche documentos.retention_until usando retention_policies.retention_years. Ignora categorias com retention_years=-1 (permanente). Idempotente — só toca rows com retention_until IS NULL.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. archive_expired_documents() — soft-archive de docs vencidos
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_expired_documents()
RETURNS integer AS $$
DECLARE
  archived_count int := 0;
BEGIN
  UPDATE public.documentos
     SET deleted_at = now(),
         deleted_by = 'system:retention'
   WHERE retention_until IS NOT NULL
     AND retention_until < now()
     AND deleted_at IS NULL
     AND legal_hold = false;
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.archive_expired_documents IS
  'Soft-archive (deleted_at = now()) de documentos com retention_until < now() e legal_hold = false. Marcados com deleted_by = ''system:retention''. Triggers ON UPDATE com legal_hold tratados.';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. pg_cron schedule — DESABILITADO até validação manual
-- ──────────────────────────────────────────────────────────────────────────
-- IMPORTANTE: NÃO descomentar antes de:
--   1) Comitê de Ética ratificar prazos da seed em retention_policies
--   2) Toggle de legal_hold disponível em produção
--   3) Backfill manual de retention_until executado e revisado:
--        SELECT public.apply_retention_policy();
--
-- Quando habilitar, rodar manualmente no SQL editor:
--
-- SELECT cron.schedule(
--   'apply-retention-policy',
--   '0 3 * * *',                 -- 03:00 UTC = 00:00 BRT
--   $$ SELECT public.apply_retention_policy(); $$
-- );
--
-- SELECT cron.schedule(
--   'archive-expired-documents',
--   '15 3 * * *',                -- 03:15 UTC, após backfill
--   $$ SELECT public.archive_expired_documents(); $$
-- );
--
-- Para inspecionar:  SELECT * FROM cron.job WHERE jobname LIKE '%retention%' OR jobname LIKE '%archive%';
-- Para remover:      SELECT cron.unschedule('apply-retention-policy');
-- ============================================================================
