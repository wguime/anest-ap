-- ============================================================================
-- Cron jobs: chama Edge Function schedule-shift-reminders
--
-- Requisitos:
--   - Extensão pg_cron habilitada no projeto (Supabase Dashboard → Database
--     → Extensions → pg_cron ON).
--   - Extensão pg_net para net.http_post (já vem habilitada no Supabase).
--
-- Agendamento (timezone do cron: UTC):
--   - 09:00 BRT (12:00 UTC) diariamente → gera D-1 para plantão de amanhã.
--   - Por hora 09:00–22:00 BRT (12:00–01:00 UTC) → gera D-0 dentro de janela
--     de 2h antes do início. 2 disparos diários cobrem:
--       * Dias úteis (plantão 19:00 BRT = 22:00 UTC): job das 21:00 BRT (00:00 UTC)
--         pega o plantão começando às 19:00 com diffMs ≈ 2h — na verdade passou.
--         Melhor: disparar às 18:00 BRT (21:00 UTC).
--       * FDS/feriado (plantão 07:00 BRT = 10:00 UTC): job das 06:00 BRT (09:00 UTC).
--   - Configuração escolhida: 3 jobs cobrindo todos os cenários.
--
-- Antes de rodar este SQL:
--   1. Substitua <PROJECT_REF> por vjzrahruvjffyyqyhjny (já feito abaixo).
--   2. Substitua <SERVICE_ROLE_JWT> pela service_role key real (Dashboard
--      → Project Settings → API → service_role).
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Habilitar pg_cron (se não estiver ativo)
-- ──────────────────────────────────────────────
-- Normalmente já habilitado pelo Dashboard; este CREATE é no-op se for o caso.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ──────────────────────────────────────────────
-- 2. Guardar service_role como setting (evita expor em plaintext nos jobs)
--    IMPORTANTE: substitua o valor abaixo pela chave real antes de rodar.
-- ──────────────────────────────────────────────
-- Alternativa segura: criar Secret no Supabase Vault e referenciar.
-- Para simplicidade inicial:
--   SELECT vault.create_secret('REPLACE_SERVICE_ROLE_JWT', 'edge_fn_service_role');
-- Descomente e ajuste conforme política de segredos.

-- ──────────────────────────────────────────────
-- 3. Job A — D-1 diário (18:00 BRT = 21:00 UTC)
--    Gera lembrete de véspera para plantão de amanhã.
-- ──────────────────────────────────────────────
SELECT cron.schedule(
  'shift-reminders-d1-daily',
  '0 21 * * *',  -- 21:00 UTC todos os dias (= 18:00 BRT; 18h local, plantão amanhã)
  $$
  SELECT net.http_post(
    url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/schedule-shift-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.edge_fn_service_role', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('dryRun', false)
  );
  $$
);

-- ──────────────────────────────────────────────
-- 4. Job B — D-0 dias úteis (18:00 BRT = 21:00 UTC)
--    Captura plantão 19:00 BRT dentro da janela de 2h.
-- ──────────────────────────────────────────────
SELECT cron.schedule(
  'shift-reminders-d0-weekday',
  '0 21 * * *',  -- 21:00 UTC (= 18:00 BRT, exatamente 1h antes do plantão 19:00)
  $$
  SELECT net.http_post(
    url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/schedule-shift-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.edge_fn_service_role', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('dryRun', false)
  );
  $$
);
-- Nota: mesma cron expression do Job A — isso é proposital. A Edge Function
-- gera D-1 E D-0 numa mesma execução; rodar 2 jobs com mesma hora é redundante.
-- Mantive separado para documentar intenção; você pode deletar Job B se
-- preferir só o A.

-- ──────────────────────────────────────────────
-- 5. Job C — D-0 FDS/feriado (06:00 BRT = 09:00 UTC)
--    Captura plantão 07:00 BRT em FDS/feriado dentro da janela de 2h.
-- ──────────────────────────────────────────────
SELECT cron.schedule(
  'shift-reminders-d0-weekend',
  '0 9 * * *',  -- 09:00 UTC (= 06:00 BRT, 1h antes do plantão FDS 07:00)
  $$
  SELECT net.http_post(
    url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/schedule-shift-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.edge_fn_service_role', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('dryRun', false)
  );
  $$
);

-- ──────────────────────────────────────────────
-- 6. Inspecionar jobs
-- ──────────────────────────────────────────────
-- SELECT jobid, schedule, command, active FROM cron.job
-- WHERE jobname LIKE 'shift-reminders-%';

-- Para desabilitar temporariamente:
-- SELECT cron.unschedule('shift-reminders-d1-daily');
-- SELECT cron.unschedule('shift-reminders-d0-weekday');
-- SELECT cron.unschedule('shift-reminders-d0-weekend');

-- ──────────────────────────────────────────────
-- 7. Configurar secret service_role (ROTINA MANUAL, executar UMA VEZ)
-- ──────────────────────────────────────────────
-- ATENÇÃO: substitua <SERVICE_ROLE_JWT> pelo valor real antes de rodar.
-- Depois remova a chave do log/histórico SQL.
--
-- ALTER DATABASE postgres SET app.edge_fn_service_role = '<SERVICE_ROLE_JWT>';
--
-- Após rodar o ALTER, as conexões futuras lerão a chave via current_setting.
-- Jobs existentes do pg_cron usam sessions novas a cada execução → OK.
