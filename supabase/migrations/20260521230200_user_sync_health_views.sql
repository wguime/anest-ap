-- Migration: views de saúde da relação profiles ↔ authorized_emails
-- Incidente 2026-05-21 (P1b + P3b do plano pós-Erlei).
--
-- Surfaceia 3 categorias de desincronização:
--   1. view_profiles_duplicates    — profiles com lower(email) repetido (caso Erlei)
--   2. view_profiles_orphan         — profiles sem authorized_emails correspondente
--   3. view_authorized_emails_unused — authorized_emails sem profile há >30 dias
--
-- Acessível só por admin (is_admin() check em RLS).
-- Views são reativas (sem materialized) — atualizam em tempo real.

-- ──────────────────────────────────────────────
-- 1. view_profiles_duplicates
-- ──────────────────────────────────────────────
-- Profiles com mesmo lower(email) mas id diferente.
-- Sintoma: 2 cards "Erlei" e "ERLEI PERINI" no Centro de Gestão.

CREATE OR REPLACE VIEW public.view_profiles_duplicates AS
SELECT
  lower(email)                                AS email_normalizado,
  count(*)                                    AS qtd_profiles,
  array_agg(id ORDER BY created_at)           AS profile_ids,
  array_agg(nome ORDER BY created_at)         AS nomes,
  array_agg(role ORDER BY created_at)         AS roles,
  array_agg(access_count ORDER BY created_at) AS access_counts,
  array_agg(last_access ORDER BY created_at)  AS last_accesses
FROM public.profiles
GROUP BY lower(email)
HAVING count(*) > 1;

COMMENT ON VIEW public.view_profiles_duplicates IS
  'Profiles com mesmo lower(email) e id diferente. Em prod deveria ser sempre 0 rows. '
  'Se aparecer row, INSERT direto burlou a invariante — verificar via UsersTab.';

-- ──────────────────────────────────────────────
-- 2. view_profiles_orphan
-- ──────────────────────────────────────────────
-- Profiles cujo email não está em authorized_emails.
-- Sintoma: user existe mas admin não consegue gerenciar via aba Emails.

CREATE OR REPLACE VIEW public.view_profiles_orphan AS
SELECT
  p.id,
  p.nome,
  p.email,
  p.role,
  p.access_count,
  p.last_access,
  p.created_at,
  CASE
    WHEN p.id LIKE 'pending_%' THEN 'placeholder_nunca_usado'
    WHEN p.access_count = 0 AND p.last_access IS NULL THEN 'nunca_acessou'
    WHEN p.last_access < (now() - INTERVAL '90 days') THEN 'inativo_90d'
    ELSE 'ativo_sem_allowlist'
  END AS categoria_orfao
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.authorized_emails ae
  WHERE lower(ae.email) = lower(p.email)
);

COMMENT ON VIEW public.view_profiles_orphan IS
  'Profiles sem entry correspondente em authorized_emails. '
  'Categoria ajuda decidir: placeholder_nunca_usado = DELETE seguro; '
  'ativo_sem_allowlist = adicionar email ao allowlist com role correto.';

-- ──────────────────────────────────────────────
-- 3. view_authorized_emails_unused
-- ──────────────────────────────────────────────
-- Emails autorizados há mais de 30 dias mas sem profile criado.
-- Sintoma: admin pré-cadastrou alguém que nunca apareceu (provável typo).

CREATE OR REPLACE VIEW public.view_authorized_emails_unused AS
SELECT
  ae.email,
  ae.added_at,
  ae.added_by,
  ae.role,
  (now() - ae.added_at)::interval AS idade,
  CASE
    WHEN (now() - ae.added_at) > INTERVAL '180 days' THEN 'muito_antigo_180d'
    WHEN (now() - ae.added_at) > INTERVAL '90 days'  THEN 'antigo_90d'
    WHEN (now() - ae.added_at) > INTERVAL '30 days'  THEN 'pendente_30d'
    ELSE 'recente'
  END AS categoria
FROM public.authorized_emails ae
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE lower(p.email) = lower(ae.email)
)
AND ae.added_at < (now() - INTERVAL '30 days');

COMMENT ON VIEW public.view_authorized_emails_unused IS
  'Emails autorizados sem profile há mais de 30 dias. '
  'Provável typo no email; admin deve revisar e remover ou corrigir.';

-- ──────────────────────────────────────────────
-- 4. RLS: só admin lê essas views (security barrier)
-- ──────────────────────────────────────────────
-- Views não têm RLS direto; herdam das tabelas base. profiles e authorized_emails
-- já têm SELECT TO authenticated USING (true). Para restringir a admin, usamos
-- RPC wrapper SECURITY DEFINER (padrão Supabase recomendado para "admin-only views").

CREATE OR REPLACE FUNCTION public.rpc_user_sync_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'duplicates',       COALESCE((SELECT jsonb_agg(row_to_json(d)) FROM public.view_profiles_duplicates d), '[]'::jsonb),
    'orphans',          COALESCE((SELECT jsonb_agg(row_to_json(o)) FROM public.view_profiles_orphan o), '[]'::jsonb),
    'unused_emails',    COALESCE((SELECT jsonb_agg(row_to_json(u)) FROM public.view_authorized_emails_unused u), '[]'::jsonb),
    'duplicates_count', (SELECT count(*) FROM public.view_profiles_duplicates),
    'orphans_count',    (SELECT count(*) FROM public.view_profiles_orphan),
    'unused_count',     (SELECT count(*) FROM public.view_authorized_emails_unused)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_user_sync_health() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_user_sync_health() FROM anon;

COMMENT ON FUNCTION public.rpc_user_sync_health() IS
  'Health check da sincronização profiles ↔ authorized_emails. Admin-only.';

-- ──────────────────────────────────────────────
-- 5. Defense in depth: REVOKE direct SELECT nas views
-- ──────────────────────────────────────────────
-- Views herdam RLS das tabelas base, e profiles/authorized_emails têm
-- SELECT TO authenticated USING (true) — qualquer authenticated user
-- conseguiria SELECT * direto nessas views (bypassando o is_admin() da RPC).
-- REVOKE garante que só o RPC SECURITY DEFINER consegue ler.
REVOKE ALL ON public.view_profiles_duplicates       FROM authenticated, anon, public;
REVOKE ALL ON public.view_profiles_orphan           FROM authenticated, anon, public;
REVOKE ALL ON public.view_authorized_emails_unused  FROM authenticated, anon, public;
-- postgres (superuser) e service_role continuam tendo acesso direto.
