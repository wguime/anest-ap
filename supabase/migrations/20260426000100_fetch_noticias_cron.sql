-- ============================================================================
-- Cron job: chama Edge Function fetch-noticias diariamente
--
-- Pré-requisitos:
--   - pg_cron e pg_net habilitados (já estão no projeto, ver migration
--     20260422223000_schedule_shift_reminders_cron.sql).
--   - Vault secret `edge_fn_service_role` já criado (mesma migration acima).
--
-- Agendamento: 06:00 UTC (= 03:00 BRT) diariamente. Horário de baixa carga;
-- as fontes (NEJM, BJA, etc.) atualizam ao longo do dia.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'fetch-noticias-daily',
  '0 6 * * *',  -- 06:00 UTC = 03:00 BRT, todos os dias
  $$
  SELECT net.http_post(
    url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/fetch-noticias',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_fn_service_role' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Inspecionar:
--   SELECT jobid, schedule, command, active FROM cron.job WHERE jobname = 'fetch-noticias-daily';
--
-- Desabilitar:
--   SELECT cron.unschedule('fetch-noticias-daily');
--
-- Trigger manual (sem esperar o cron):
--   SELECT net.http_post(
--     url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/fetch-noticias',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_fn_service_role' LIMIT 1),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
