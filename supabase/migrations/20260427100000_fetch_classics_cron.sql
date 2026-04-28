-- ============================================================================
-- Cron job: chama Edge Function fetch-classics para backfill de artigos
-- clássicos via PubMed E-utilities em categorias com volume baixo (<15 artigos).
--
-- Schedule: 1º domingo de cada mês 06:00 UTC (= sábado 03:00 BRT).
-- A Edge Function é idempotente — só insere quando a categoria está abaixo
-- do mínimo, e dedup pipeline (DOI/hash/trigram) impede duplicatas.
-- ============================================================================

SELECT cron.schedule(
  'fetch-classics-monthly',
  '0 6 1-7 * 0',  -- 1º domingo do mês (DOM=0 e dia 1-7) 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/fetch-classics',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_fn_service_role' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Inspecionar:
--   SELECT jobid, jobname, schedule, active FROM cron.job
--     WHERE jobname IN ('fetch-noticias-daily', 'recompute-noticias-weekly', 'fetch-classics-monthly');
--
-- Trigger manual (sem esperar o cron) — útil logo após o deploy:
--   SELECT net.http_post(
--     url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/fetch-classics',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_fn_service_role' LIMIT 1),
--       'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   );
--
-- Verificar contagem por categoria após backfill:
--   SELECT category, count(*) FROM public.noticias
--     GROUP BY category ORDER BY 2 DESC;
--
-- Desabilitar:
--   SELECT cron.unschedule('fetch-classics-monthly');
