-- =============================================================================
-- 20260513140000_api_token_write_scopes.sql — Sprint 19 (API v2 write scopes)
--
-- Estende `api_tokens.scopes` text[] com 3 scopes de escrita, mantendo os 3
-- read existentes. Total: 6 scopes na whitelist.
--
-- Read (já presentes via 20260513120000):
--   read:docs, read:planos-acao, read:comunicados
--
-- Write (novos, Sprint 19):
--   write:docs          → POST/PUT/DELETE /v1/docs[/:id]
--   write:planos-acao   → POST/PUT/DELETE /v1/planos-acao[/:id]
--   write:comunicados   → POST/PUT/DELETE /v1/comunicados[/:id]
--
-- BACK-COMPAT:
--   • Tokens existentes mantêm scopes legacy (3 read). Sem default escrita.
--   • Coluna `scope` text legacy preservada (não alterada).
--   • Tokens default novos via `generate-api-token` continuam recebendo só
--     os 3 read; write é opt-in explícito por admin (UI Wave 3.2 expõe).
--
-- IDEMPOTÊNCIA:
--   • DROP CONSTRAINT IF EXISTS + ADD constraint com whitelist ampliada.
--   • DO block lookup em pg_constraint para safe re-run.
--
-- SEGURANÇA:
--   • CHECK constraint <@ whitelist impede inserção de strings arbitrárias.
--   • Edge handlers POST/PUT/DELETE validam scope ANTES de rate-limit.
--   • LGPD: audit log com changedBy = token.created_by (admin), nunca 'system'.
-- =============================================================================

DO $$
BEGIN
  -- Drop legacy CHECK (read-only whitelist)
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname  = 'api_tokens_scopes_subset_check'
       AND conrelid = 'public.api_tokens'::regclass
  ) THEN
    ALTER TABLE public.api_tokens
      DROP CONSTRAINT api_tokens_scopes_subset_check;
  END IF;

  -- Re-add CHECK with extended whitelist (6 scopes: 3 read + 3 write)
  ALTER TABLE public.api_tokens
    ADD CONSTRAINT api_tokens_scopes_subset_check
    CHECK (
      scopes IS NULL
      OR scopes <@ ARRAY[
          'read:docs',
          'read:planos-acao',
          'read:comunicados',
          'write:docs',
          'write:planos-acao',
          'write:comunicados'
        ]::text[]
    );
END
$$;

COMMENT ON COLUMN public.api_tokens.scopes IS
  'Sprint 16 + Sprint 19. Lista granular de scopes autorizados. Subset de '
  '[''read:docs'',''read:planos-acao'',''read:comunicados'','
  '''write:docs'',''write:planos-acao'',''write:comunicados'']. '
  'BACK-COMPAT: coluna legacy `scope` é mantida; scope=''read'' ≡ os 3 read scopes. '
  'Default tokens novos: só read; write é opt-in explícito via UI admin.';
