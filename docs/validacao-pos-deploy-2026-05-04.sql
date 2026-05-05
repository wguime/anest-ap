-- ============================================================================
-- Validação pós-deploy das 3 migrations (B2 + B4 + B9) — 2026-05-04
-- Cole no SQL Editor: https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/new
-- Execute como UM bloco (Run All). Cada query retorna 1+ linhas.
-- TODAS read-only — não modificam dados.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- B2 — Anonimização LGPD Art. 12
-- ────────────────────────────────────────────────────────────────────────────

-- B2.1 — Função rpc_anonimizar_incidente existe + comentário correto
SELECT 'B2.1 funcao existe' AS check_name,
       proname,
       LEFT(obj_description(oid, 'pg_proc'), 60) AS comentario_inicio,
       prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'rpc_anonimizar_incidente';
-- Esperado: 1 linha, comentário começa com "LGPD Art. 12", security_definer = true

-- B2.2 — Permissões corretas (apenas authenticated, sem anon)
SELECT 'B2.2 permissoes' AS check_name,
       grantee,
       privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'rpc_anonimizar_incidente'
ORDER BY grantee;
-- Esperado: 'authenticated' com EXECUTE; NÃO deve ter 'anon' nem 'PUBLIC'

-- B2.3 — Função rpc_fetch_by_tracking_code atualizada (retorna anonymized_at)
SELECT 'B2.3 fetch_tracking atualizada' AS check_name,
       pg_get_functiondef(oid) ILIKE '%anonymized_at%' AS tem_anonymized_at,
       pg_get_functiondef(oid) ILIKE '%[ANONIMIZADO]%' AS tem_marcador
FROM pg_proc
WHERE proname = 'rpc_fetch_by_tracking_code';
-- Esperado: ambos true

-- ────────────────────────────────────────────────────────────────────────────
-- B4 — Retenção LGPD Art. 15
-- ────────────────────────────────────────────────────────────────────────────

-- B4.1 — Coluna retain_until existe + NOT NULL
SELECT 'B4.1 coluna retain_until' AS check_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'incidentes'
  AND column_name = 'retain_until';
-- Esperado: 1 linha, data_type='date', is_nullable='NO'

-- B4.2 — Trigger BEFORE INSERT ativo
SELECT 'B4.2 trigger ativo' AS check_name,
       tgname,
       tgenabled,
       tgtype
FROM pg_trigger
WHERE tgname = 'tr_incidentes_retain_until';
-- Esperado: 1 linha, tgenabled='O' (origin/enabled)

-- B4.3 — Função rpc_aplicar_retencao_incidentes existe
SELECT 'B4.3 rpc_retencao existe' AS check_name,
       proname,
       prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'rpc_aplicar_retencao_incidentes';
-- Esperado: 1 linha, security_definer = true

-- B4.4 — Backfill executado (todos têm retain_until)
SELECT 'B4.4 backfill' AS check_name,
       COUNT(*) AS total,
       COUNT(retain_until) AS preenchidos,
       (COUNT(*) - COUNT(retain_until)) AS nulls
FROM public.incidentes;
-- Esperado: total = preenchidos, nulls = 0

-- B4.5 — Distribuição de prazos (incidente ~20a, denuncia ~100a)
SELECT 'B4.5 distribuicao prazos' AS check_name,
       tipo,
       COUNT(*) AS qtd,
       MIN(retain_until) AS min_data,
       MAX(retain_until) AS max_data,
       ROUND(AVG(EXTRACT(EPOCH FROM retain_until::timestamp - now()))::numeric / (60*60*24*365.25), 1) AS anos_medios_aprox
FROM public.incidentes
GROUP BY tipo;
-- Esperado: incidente ~20 anos, denuncia ~100 anos

-- B4.6 — pg_cron schedule NÃO habilitado (correto — aguarda Comitê ratificar prazos)
SELECT 'B4.6 cron NAO habilitado' AS check_name,
       COUNT(*) AS schedules_ativos
FROM cron.job
WHERE jobname = 'lgpd-retencao-incidentes';
-- Esperado: 0 (schedule comentado na migration)

-- ────────────────────────────────────────────────────────────────────────────
-- B9 — Never Events
-- ────────────────────────────────────────────────────────────────────────────

-- B9.1 — Colunas existem
SELECT 'B9.1 colunas' AS check_name,
       column_name,
       data_type,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'incidentes'
  AND column_name IN ('is_never_event', 'never_event_code')
ORDER BY column_name;
-- Esperado: 2 linhas (boolean default false; text)

-- B9.2 — Check constraints ativos
SELECT 'B9.2 constraints' AS check_name,
       conname,
       pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public.incidentes'::regclass
  AND conname LIKE 'chk_never_event%'
ORDER BY conname;
-- Esperado: 2 linhas (consistencia + formato NE-XXX-NN)

-- B9.3 — Indices parciais
SELECT 'B9.3 indices' AS check_name,
       indexname,
       indexdef
FROM pg_indexes
WHERE tablename = 'incidentes'
  AND indexname LIKE 'idx_incidentes_never_event%'
ORDER BY indexname;
-- Esperado: 2 indexes parciais

-- B9.4 — Trigger de audit ativo
SELECT 'B9.4 trigger audit' AS check_name,
       tgname,
       tgenabled
FROM pg_trigger
WHERE tgname = 'tr_incidentes_never_event_audit';
-- Esperado: 1 linha, tgenabled='O'

-- B9.5 — Backfill conservador (quantos foram marcados)
SELECT 'B9.5 backfill never events' AS check_name,
       never_event_code,
       COUNT(*) AS qtd
FROM public.incidentes
WHERE is_never_event = true
GROUP BY never_event_code
ORDER BY never_event_code;
-- Esperado: 0+ linhas dependendo dos dados existentes; cada code pode aparecer
-- (NE-SUR-01, NE-SUR-04, NE-MED-02 são os mais prováveis)

-- ────────────────────────────────────────────────────────────────────────────
-- Resumo final — todos os 14 checks num único SELECT
-- ────────────────────────────────────────────────────────────────────────────

SELECT 'RESUMO' AS check_name,
       (SELECT COUNT(*) FROM pg_proc WHERE proname = 'rpc_anonimizar_incidente') AS b2_1_funcao,
       (SELECT COUNT(*) FROM information_schema.role_routine_grants
          WHERE routine_name = 'rpc_anonimizar_incidente' AND grantee = 'authenticated') AS b2_2_perm_authenticated,
       (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='incidentes' AND column_name='retain_until') AS b4_1_retain_col,
       (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'tr_incidentes_retain_until') AS b4_2_trigger,
       (SELECT COUNT(*) FROM pg_proc WHERE proname = 'rpc_aplicar_retencao_incidentes') AS b4_3_rpc,
       (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='incidentes' AND column_name IN ('is_never_event','never_event_code')) AS b9_1_colunas,
       (SELECT COUNT(*) FROM pg_constraint
          WHERE conrelid='public.incidentes'::regclass AND conname LIKE 'chk_never_event%') AS b9_2_constraints,
       (SELECT COUNT(*) FROM pg_indexes
          WHERE tablename='incidentes' AND indexname LIKE 'idx_incidentes_never_event%') AS b9_3_indices,
       (SELECT COUNT(*) FROM pg_trigger WHERE tgname='tr_incidentes_never_event_audit') AS b9_4_trigger;
-- Esperado (TODOS os números abaixo):
--   b2_1_funcao=1, b2_2_perm_authenticated=1, b4_1_retain_col=1, b4_2_trigger=1,
--   b4_3_rpc=1, b9_1_colunas=2, b9_2_constraints=2, b9_3_indices=2, b9_4_trigger=1
