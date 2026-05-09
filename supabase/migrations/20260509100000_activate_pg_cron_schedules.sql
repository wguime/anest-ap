-- =============================================================================
-- 20260508700000_activate_pg_cron_schedules.sql — issue #19
--
-- Ativa os 5 cron jobs LGPD/retention/approval que estavam comentados em:
--   - 20260504000001_lgpd_art15_retencao.sql (lgpd-retencao-incidentes)
--   - 20260505400000_retention_legal_hold.sql (apply-retention-policy + archive-expired-documents)
--   - 20260505600000_multi_step_approval.sql (notify-review-approaching + notify-review-overdue)
--
-- Pré-condições (assumidas atendidas em 2026-05-08):
--   1. Comitê de Ética ratificou prazos em ata
--   2. retention_policies seedada (incl. 'prontuarios' permanente)
--   3. Migrations dependentes aplicadas (20260504*, 20260505*, 20260508*)
--   4. legal_hold UI disponível em prod
--
-- Idempotência: usa cron.unschedule + cron.schedule. Se job já existe,
-- unschedule retorna NULL (não erra).
-- =============================================================================

-- Garante que pg_cron está habilitado (no-op se já está)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lgpd-retencao-incidentes — 03:00 UTC (= 00:00 BRT)
--    Anonimiza incidentes vencidos conforme retention_until.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('lgpd-retencao-incidentes')
    FROM cron.job WHERE jobname = 'lgpd-retencao-incidentes';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

SELECT cron.schedule(
  'lgpd-retencao-incidentes',
  '0 3 * * *',
  $$ SELECT public.rpc_aplicar_retencao_incidentes(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. apply-retention-policy — 03:00 UTC
--    Backfilla retention_until em documentos novos baseado em retention_policies.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('apply-retention-policy')
    FROM cron.job WHERE jobname = 'apply-retention-policy';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

SELECT cron.schedule(
  'apply-retention-policy',
  '5 3 * * *',
  $$ SELECT public.apply_retention_policy(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. archive-expired-documents — 03:15 UTC
--    Soft-archive de docs vencidos com legal_hold = false.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('archive-expired-documents')
    FROM cron.job WHERE jobname = 'archive-expired-documents';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

SELECT cron.schedule(
  'archive-expired-documents',
  '15 3 * * *',
  $$ SELECT public.archive_expired_documents(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. notify-review-approaching — 08:00 UTC
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('notify-review-approaching')
    FROM cron.job WHERE jobname = 'notify-review-approaching';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-review-approaching',
  '0 8 * * *',
  $$ SELECT notify_pending_review_approachers(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. notify-review-overdue — 08:15 UTC
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('notify-review-overdue')
    FROM cron.job WHERE jobname = 'notify-review-overdue';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-review-overdue',
  '15 8 * * *',
  $$ SELECT notify_overdue_reviews(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Validação:
--   SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
-- Esperado: 5 rows com os jobnames acima.
-- ─────────────────────────────────────────────────────────────────────────────
