-- ════════════════════════════════════════════════════════════════════════
-- 20260721200000_escala_seed_rollover.sql
-- Piloto da Escala Cirúrgica: a escala de teste móvel
-- (created_by='seed-teste-claude') passa a acompanhar a virada do dia via
-- pg_cron (00:05 BRT), eliminando a renovação manual diária do dono.
--
-- A cópia fixa 'seed-teste-claude-20' (2026-07-20) NUNCA é tocada (WHERE
-- exato por created_by). Guard NOT EXISTS: UNIQUE(data, hospital) — se já
-- houver escala real (ou a seed-20) no dia-alvo, a seed fica onde está
-- (skip silencioso, comportamento seguro).
--
-- ⚠️ CHECKLIST DE LIBERAÇÃO AO GRUPO (aprovado 2026-07-21): antes de abrir
--    o gate para os ~40 anestesistas, rodar cron.unschedule
--    ('escala-seed-rollover-daily') e APAGAR as escalas seed — a RLS por
--    papel clínico deixaria o grupo inteiro ver a escala de teste.
--
-- Idempotente (CREATE OR REPLACE / unschedule condicional).
-- Rollback: SELECT cron.unschedule('escala-seed-rollover-daily');
--           DROP FUNCTION public.escala_seed_rollover();
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.escala_seed_rollover()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE escala_cirurgica e
     SET data = current_date
   WHERE e.created_by = 'seed-teste-claude'
     AND e.data <> current_date
     AND NOT EXISTS (
       SELECT 1
         FROM escala_cirurgica r
        WHERE r.data = current_date
          AND r.hospital = e.hospital
          AND r.id <> e.id
     );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'escala_seed_rollover: %', SQLERRM;
END;
$$;

-- Não expor via PostgREST (/rest/v1/rpc): só o pg_cron (postgres) executa.
REVOKE ALL ON FUNCTION public.escala_seed_rollover() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escala-seed-rollover-daily') THEN
    PERFORM cron.unschedule('escala-seed-rollover-daily');
  END IF;
END $$;

-- 03:05 UTC = 00:05 BRT
SELECT cron.schedule(
  'escala-seed-rollover-daily',
  '5 3 * * *',
  $$SELECT public.escala_seed_rollover()$$
);

-- Inspeção (manual):
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'escala-seed-rollover-daily';
