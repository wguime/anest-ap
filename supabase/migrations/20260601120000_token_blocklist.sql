-- =============================================================================
-- 20260601120000_token_blocklist.sql — Wave 2.1 / Sprint 2 (Security P0)
--
-- Tabela `token_blocklist` para revogação de sessões antes do TTL natural (1h)
-- do JWT Supabase. Consultada pela Edge `get-supabase-token` antes de emitir
-- novo JWT — se firebase_uid está na blocklist, retorna 401 e força re-auth.
--
-- MODELO:
--   • Row na blocklist por (firebase_uid, revoked_at) — múltiplas rows OK (history).
--   • expires_at NULL = revoke permanente até admin DELETE.
--   • expires_at NOT NULL = auto-expira (ex: trial revoke, lock temporário).
--   • Lookup hot path: index parcial em uid filtrando revokes ativos.
--
-- RLS:
--   • service_role SELECT — Edge get-supabase-token usa para validar.
--   • admin INSERT/DELETE — gerencia via UI (futuro Wave 2.x).
--   • authenticated SELECT — user vê própria entrada (debug auth issues).
--
-- LGPD:
--   • firebase_uid não é PII direto (opaco), mas combinado com profiles vira PII.
--   • revoked_by é Firebase UID do admin (audit trail).
--   • reason é texto livre — admin deve evitar PII de saúde no campo.
--
-- Idempotente (IF NOT EXISTS + DROP POLICY IF EXISTS). Rollback safe.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela token_blocklist
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.token_blocklist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  text NOT NULL
                  -- L1: format guard (Firebase UID típico = 20-40 chars alfanum).
                  -- Bloqueia typos/strings arbitrárias via SQL/RLS.
                  CHECK (firebase_uid ~ '^[A-Za-z0-9]{20,40}$'),
  revoked_at    timestamptz NOT NULL DEFAULT now(),
  revoked_by    text NOT NULL,
  reason        text NOT NULL DEFAULT 'admin_revoke'
                  CHECK (reason IN (
                    'admin_revoke',       -- admin revogou manualmente
                    'compromise',         -- credential comprometida
                    'logout_forced',      -- logout forçado server-side
                    'inactivity',         -- política de inatividade
                    'role_change',        -- mudança de role/permissões
                    'other'               -- outro (auditar via audit log)
                  )),
  expires_at    timestamptz,              -- NULL = permanente, NOT NULL = auto-expire
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- M2 (security audit Wave 2.1): FORCE RLS — impede service_role de bypassar
-- policies. Combinado com ausência de UPDATE policy, history em token_blocklist
-- vira IMUTÁVEL mesmo para Edges/service_role. Para des-revogar = DELETE row.
ALTER TABLE public.token_blocklist FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.token_blocklist IS
  'Wave 2.1 / Sprint 2. Blocklist de firebase_uid para revogação de JWT '
  'Supabase antes do TTL natural (1h). Edge get-supabase-token consulta ANTES '
  'de emitir refresh — se uid presente E revoke ativo, retorna 401. '
  'expires_at NULL = revoke permanente até admin DELETE row.';

COMMENT ON COLUMN public.token_blocklist.firebase_uid IS
  'Firebase UID do usuário suspenso. Match contra o claim sub do Firebase ID Token.';

COMMENT ON COLUMN public.token_blocklist.revoked_by IS
  'Firebase UID do admin que revogou. Audit trail. Use uid real, nunca system/admin.';

COMMENT ON COLUMN public.token_blocklist.expires_at IS
  'NULL = revoke permanente (admin deve DELETE para des-revogar). '
  'NOT NULL = auto-expira (lookup filtra expires_at IS NULL OR expires_at > now()).';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Índices
-- ──────────────────────────────────────────────────────────────────────────

-- Hot path: lookup por uid (Edge get-supabase-token).
-- Postgres exige predicate IMMUTABLE em índice parcial, então NÃO filtramos
-- por expires_at no índice — o filtro `expires_at IS NULL OR expires_at > now()`
-- fica na função is_token_revoked() (LIMIT 1, custo desprezível). Tabela
-- esperada com poucas centenas de rows mesmo em prod, full scan ainda é cheap.
CREATE INDEX IF NOT EXISTS idx_token_blocklist_uid
  ON public.token_blocklist (firebase_uid);

-- Audit listing (admin UI, history por user)
CREATE INDEX IF NOT EXISTS idx_token_blocklist_uid_revoked_desc
  ON public.token_blocklist (firebase_uid, revoked_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.token_blocklist ENABLE ROW LEVEL SECURITY;

-- service_role SELECT (Edge get-supabase-token)
DROP POLICY IF EXISTS token_blocklist_service_select ON public.token_blocklist;
CREATE POLICY token_blocklist_service_select
  ON public.token_blocklist
  FOR SELECT
  TO service_role
  USING (true);

-- admin INSERT (revoga sessão)
DROP POLICY IF EXISTS token_blocklist_admin_insert ON public.token_blocklist;
CREATE POLICY token_blocklist_admin_insert
  ON public.token_blocklist
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- admin SELECT (listagem UI)
DROP POLICY IF EXISTS token_blocklist_admin_select ON public.token_blocklist;
CREATE POLICY token_blocklist_admin_select
  ON public.token_blocklist
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- admin DELETE (des-revogar)
DROP POLICY IF EXISTS token_blocklist_admin_delete ON public.token_blocklist;
CREATE POLICY token_blocklist_admin_delete
  ON public.token_blocklist
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- user vê própria entrada (debug auth issues — sabe se foi suspenso)
DROP POLICY IF EXISTS token_blocklist_owner_select ON public.token_blocklist;
CREATE POLICY token_blocklist_owner_select
  ON public.token_blocklist
  FOR SELECT
  TO authenticated
  USING (firebase_uid = public.firebase_uid());

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Função is_token_revoked(p_firebase_uid text) RETURNS boolean
--
-- Hot path da Edge get-supabase-token. SECURITY DEFINER para que service_role
-- consulte sem ser bloqueado por RLS quirks. Retorna true sse há row ativa
-- (expires_at IS NULL OR expires_at > now()) para o uid.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_token_revoked(p_firebase_uid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_found boolean;
BEGIN
  IF p_firebase_uid IS NULL OR p_firebase_uid = '' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.token_blocklist
    WHERE firebase_uid = p_firebase_uid
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_found;

  RETURN v_found;
END;
$$;

COMMENT ON FUNCTION public.is_token_revoked(text) IS
  'Wave 2.1. Retorna true sse firebase_uid tem revoke ativo em token_blocklist. '
  'Hot path da Edge get-supabase-token (consulta antes de emitir JWT). '
  'SECURITY DEFINER + search_path lock.';

-- Baseline limpo de grants
REVOKE EXECUTE ON FUNCTION public.is_token_revoked(text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_token_revoked(text) TO service_role, authenticated, anon;
