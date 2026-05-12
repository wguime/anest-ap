-- =============================================================================
-- 20260513120000_api_token_scopes_granular.sql — Sprint 16 (API v2 scopes A1)
--
-- Granular scopes para tokens da API pública (api-v1 edge / API v2 contract).
-- A tabela public.api_tokens (criada em 20260512100000) tinha um único `scope`
-- text com CHECK (scope IN ('read')). Esta migration adiciona uma coluna
-- text[] `scopes` permitindo subset de 3 scopes conhecidos:
--
--   read:docs          → /v1/docs, /v1/docs/:id, /v1/docs/:id/changelog
--   read:planos-acao   → /v1/planos-acao
--   read:comunicados   → /v1/comunicados
--
-- BACK-COMPAT (CRÍTICO):
--   • Coluna legacy `scope` é PRESERVADA (NUNCA dropar). Tokens criados antes
--     desta migration têm scope='read' e devem continuar autorizados em todos
--     os 3 endpoints. O backfill abaixo materializa essa equivalência:
--     scope='read'  ≡  scopes=ARRAY['read:docs','read:planos-acao','read:comunicados'].
--   • O edge api-v1 (próximo commit) lê `scopes` text[]; fallback para os 3
--     scopes legacy se NULL/vazio (defesa para qualquer linha pré-backfill).
--
-- IDEMPOTÊNCIA:
--   • ADD COLUMN IF NOT EXISTS para a coluna.
--   • UPDATE filtra WHERE scope='read' AND (scopes IS NULL OR cardinality=0)
--     — re-rodar não altera linhas já backfilladas.
--   • CHECK constraint adicionada via DO $$ ... $$ com NOT EXISTS lookup em
--     pg_constraint — re-rodar é no-op.
--   • COMMENT ON COLUMN é overwrite (sempre seguro).
--
-- SEGURANÇA:
--   • CHECK constraint `scopes <@ ARRAY[...whitelist...]` impede que admins
--     persistam strings arbitrárias. Whitelist é a única fonte de verdade
--     no banco; o service JS também valida (validateScopes).
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ADD COLUMN scopes text[]
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.api_tokens
  ADD COLUMN IF NOT EXISTS scopes text[]
    DEFAULT ARRAY['read:docs','read:planos-acao','read:comunicados'];

COMMENT ON COLUMN public.api_tokens.scopes IS
  'Sprint 16. Lista granular de scopes autorizados. Subset de '
  '[''read:docs'',''read:planos-acao'',''read:comunicados'']. '
  'BACK-COMPAT: coluna legacy `scope` é mantida; scope=''read'' ≡ os 3 scopes. '
  'Edge api-v1 lê esta coluna; fallback para os 3 legacy se NULL/vazio.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Backfill — scope='read' (legacy) ≡ 3 scopes
-- ──────────────────────────────────────────────────────────────────────────
-- Filtro garante idempotência: linhas já backfilladas (scopes não-vazio) não
-- são tocadas. cardinality(NULL) em PG retorna NULL, então o IS NULL extra
-- cobre o caso de coluna ainda NULL apesar do DEFAULT (linhas pré-default).
UPDATE public.api_tokens
   SET scopes = ARRAY['read:docs','read:planos-acao','read:comunicados']
 WHERE scope = 'read'
   AND (scopes IS NULL OR cardinality(scopes) = 0);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. CHECK constraint — scopes só pode conter valores da whitelist
-- ──────────────────────────────────────────────────────────────────────────
-- PG não suporta ADD CONSTRAINT IF NOT EXISTS em versões antigas; usamos
-- DO block com lookup em pg_constraint (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname  = 'api_tokens_scopes_subset_check'
       AND conrelid = 'public.api_tokens'::regclass
  ) THEN
    ALTER TABLE public.api_tokens
      ADD CONSTRAINT api_tokens_scopes_subset_check
      CHECK (
        scopes IS NULL
        OR scopes <@ ARRAY['read:docs','read:planos-acao','read:comunicados']::text[]
      );
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. NÃO dropar coluna legacy `scope` — back-compat preservada.
-- O CHECK existente (scope IN ('read')) continua vigente; é seguro porque
-- nenhum código novo escreve em `scope` (service usa `scopes` text[]).
-- ──────────────────────────────────────────────────────────────────────────
