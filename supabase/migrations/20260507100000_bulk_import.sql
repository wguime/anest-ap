-- ============================================================================
-- Sprint 5 / Onda 2 / O2-4 — Bulk import de documentos
-- ----------------------------------------------------------------------------
-- Cria infra para importação em massa de PDFs:
--   1. Tabela `bulk_import_jobs` rastreando cada operação (status, progress,
--      error log, audit).
--   2. Coluna `documentos.bulk_import_id` para vincular cada documento ao
--      job que o criou (audit + rollback).
--   3. Action 'bulk_imported' adicionada ao CHECK do changelog.
--
-- Restringido a admin via RLS — bulk import escreve em escala e merece um
-- gate forte. Não há endpoint público.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela bulk_import_jobs
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bulk_import_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by      text NOT NULL,
  started_by_name text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','done','failed','cancelled','partial')),
  total_files     integer NOT NULL DEFAULT 0,
  processed_files integer NOT NULL DEFAULT 0,
  failed_files    integer NOT NULL DEFAULT 0,
  source          text NOT NULL DEFAULT 'manual_upload',
  error_log       jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes           text
);

COMMENT ON TABLE public.bulk_import_jobs IS
  'Cada job de importação em massa de documentos. Status pending → processing → done/partial/failed/cancelled. error_log armazena array de {file, codigo, error} para falhas.';

COMMENT ON COLUMN public.bulk_import_jobs.source IS
  'Origem do job: manual_upload (drag-drop), firebase_etl (script de migração), api (futuro O2-5).';

CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_started_by
  ON public.bulk_import_jobs (started_by, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_status
  ON public.bulk_import_jobs (status)
  WHERE status IN ('pending','processing');

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Coluna em documentos
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS bulk_import_id uuid
  REFERENCES public.bulk_import_jobs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documentos.bulk_import_id IS
  'Job de bulk import que criou este documento. NULL para criações single-file.';

CREATE INDEX IF NOT EXISTS idx_doc_bulk_import_id
  ON public.documentos (bulk_import_id)
  WHERE bulk_import_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Estende CHECK do changelog
-- ──────────────────────────────────────────────────────────────────────────

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
    -- Sprint 5 / Onda 2 / O2-4:
    'bulk_imported'
  ));

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RLS — admin only (escrita + leitura)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bulk_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_import_jobs_admin_select ON public.bulk_import_jobs;
CREATE POLICY bulk_import_jobs_admin_select
  ON public.bulk_import_jobs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS bulk_import_jobs_admin_insert ON public.bulk_import_jobs;
CREATE POLICY bulk_import_jobs_admin_insert
  ON public.bulk_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND started_by = public.firebase_uid());

DROP POLICY IF EXISTS bulk_import_jobs_admin_update ON public.bulk_import_jobs;
CREATE POLICY bulk_import_jobs_admin_update
  ON public.bulk_import_jobs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
