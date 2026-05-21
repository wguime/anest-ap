-- =============================================================================
-- 20260601120100_api_tokens_ttl.sql — Wave 2.1 / Sprint 2 (Security P0)
--
-- Adiciona TTL aos API tokens. Hoje (pré-Wave 2.1) tokens são válidos
-- eternamente até admin revogar manualmente. Token vazado = exposição
-- permanente.
--
-- FIX:
--   • ADD COLUMN expires_at timestamptz nullable
--   • Backfill: tokens ativos (revoked_at IS NULL) recebem
--     expires_at = created_at + INTERVAL '1 year'
--   • Tokens revogados (revoked_at NOT NULL) ficam expires_at = NULL
--     (preservam history, não validam mais via revoked_at filter)
--   • CHECK constraint condicional: rows ativas (revoked_at IS NULL) DEVEM ter
--     expires_at NOT NULL.
--   • Edge api-v1 + is_valid_api_token() filtram expires_at > now()
--
-- Decisão D2 (Wave 2.1): default 1 ano para tokens existentes (preserva
-- compatibilidade — admin pode renovar antes da expiração via UI).
-- Tokens novos (gerados após esta migration) terão expires_at definido
-- pelo Edge generate-api-token (default mesmo 1 ano, ajustável).
--
-- Idempotente. Rollback safe (ALTER COLUMN DROP, DROP CONSTRAINT são reversíveis).
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ADD COLUMN expires_at (nullable inicial)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.api_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.api_tokens.expires_at IS
  'Wave 2.1. TTL do token. NULL aceito apenas para rows com revoked_at NOT NULL '
  '(history). Tokens ativos DEVEM ter expires_at NOT NULL. Edge api-v1 filtra '
  'expires_at > now() para autenticar.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Backfill — tokens ativos recebem 1 ano a partir de created_at
-- ──────────────────────────────────────────────────────────────────────────

-- IDEMPOTENTE: só atualiza rows que ainda não têm expires_at definido.
-- Tokens revogados (revoked_at NOT NULL) preservam expires_at = NULL — não
-- validam mais via filtro revoked_at na Edge.
UPDATE public.api_tokens
   SET expires_at = created_at + INTERVAL '1 year'
 WHERE expires_at IS NULL
   AND revoked_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. CHECK constraint condicional
--
-- Não dá pra ALTER COLUMN SET NOT NULL porque rows revogadas legítimamente
-- ficam expires_at = NULL. CHECK constraint expressa: se revoked_at IS NULL
-- (token ativo), expires_at DEVE NOT NULL.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.api_tokens
  DROP CONSTRAINT IF EXISTS api_tokens_active_must_expire;

ALTER TABLE public.api_tokens
  ADD CONSTRAINT api_tokens_active_must_expire
  CHECK (
    -- Token revogado: pode ter expires_at = NULL (history)
    revoked_at IS NOT NULL
    -- Token ativo: precisa ter expires_at definido
    OR expires_at IS NOT NULL
  );

COMMENT ON CONSTRAINT api_tokens_active_must_expire ON public.api_tokens IS
  'Wave 2.1. Tokens ativos (revoked_at IS NULL) DEVEM ter expires_at NOT NULL. '
  'Tokens revogados podem ter expires_at NULL (preserva history). '
  'Bloqueia INSERT de tokens sem TTL — Edge generate-api-token deve setar.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Índice parcial para hot path (Edge api-v1)
-- ──────────────────────────────────────────────────────────────────────────

-- Substitui idx_api_tokens_hash_active (criado em 20260512100000) por uma
-- versão que filtra apenas revoked_at (predicate IMMUTABLE-safe).
-- now() NÃO pode entrar em predicate de índice (Postgres rejeita). O filtro
-- expires_at > now() fica na RPC get_valid_api_token() server-side.
DROP INDEX IF EXISTS public.idx_api_tokens_hash_active;

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash_active
  ON public.api_tokens (token_hash)
  WHERE revoked_at IS NULL;

COMMENT ON INDEX public.idx_api_tokens_hash_active IS
  'Wave 2.1 (recreated). Hot path: lookup de token hash filtrando revoked_at IS NULL. '
  'Filtro de expires_at > now() fica na RPC get_valid_api_token() (predicate IMMUTABLE).';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC is_valid_api_token — incluir filtro de TTL
--
-- Replace da função original (20260512100000) com filtro de expires_at.
-- Mesma assinatura → callers Edge não precisam mudar.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_valid_api_token(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_token_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash = '' THEN
    RETURN false;
  END IF;

  -- Lookup token ativo E não-expirado
  SELECT id INTO v_token_id
  FROM public.api_tokens
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
    AND expires_at > now()  -- Wave 2.1: TTL check
  LIMIT 1;

  IF v_token_id IS NULL THEN
    RETURN false;
  END IF;

  -- Side-effect: atualiza métricas de uso
  UPDATE public.api_tokens
    SET last_used_at = now(),
        usage_count  = usage_count + 1
    WHERE id = v_token_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.is_valid_api_token(text) IS
  'Wave 2.1 update. Valida token API pelo SHA-256 hex. Retorna true se ativo '
  '(revoked_at IS NULL) E não-expirado (expires_at > now()). Side-effect: '
  'atualiza last_used_at + usage_count. SECURITY DEFINER.';

-- Baseline limpo de grants (idempotente)
REVOKE EXECUTE ON FUNCTION public.is_valid_api_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_valid_api_token(text) TO anon, authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RPC get_valid_api_token — server-side TTL check + scopes lookup atômico
--
-- M3 (security audit Wave 2.1): elimina divergência entre lookup direto da
-- Edge api-v1 (`.gt('expires_at', nowIso)`) e a RPC boolean (`expires_at > now()`).
-- Esta RPC retorna scopes + token_id em UMA query server-side com `now()` —
-- elimina race condition de relógio cliente vs servidor.
--
-- Atômico: side-effect de last_used_at + usage_count na mesma chamada.
-- Edge api-v1 deve migrar de `.from('api_tokens').select(...).gt(...)` para
-- `.rpc('get_valid_api_token', { p_token_hash: hash })`.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_valid_api_token(p_token_hash text)
RETURNS TABLE (token_id uuid, scopes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_token_id uuid;
  v_scopes text[];
BEGIN
  IF p_token_hash IS NULL OR p_token_hash = '' THEN
    RETURN;
  END IF;

  -- Lookup atômico: ativo + não-expirado
  SELECT id, t.scopes INTO v_token_id, v_scopes
  FROM public.api_tokens t
  WHERE t.token_hash = p_token_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()  -- server-side TTL check (sem race)
  LIMIT 1;

  IF v_token_id IS NULL THEN
    RETURN;
  END IF;

  -- Side-effect atômico (mesma transaction)
  UPDATE public.api_tokens
    SET last_used_at = now(),
        usage_count  = usage_count + 1
    WHERE id = v_token_id;

  -- Retorna scopes (NULL se row legacy pré-Sprint 16 — fallback feito no caller)
  RETURN QUERY SELECT v_token_id, v_scopes;
END;
$$;

COMMENT ON FUNCTION public.get_valid_api_token(text) IS
  'Wave 2.1. Lookup atômico de token API: valida hash + revoked + expires_at '
  'server-side, retorna (token_id, scopes), atualiza last_used_at + usage_count '
  'na mesma transaction. Substitui lookup direto + RPC boolean da Edge api-v1.';

REVOKE EXECUTE ON FUNCTION public.get_valid_api_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_valid_api_token(text) TO service_role;
