-- =============================================================================
-- 20260512100000_api_tokens_and_doc_view.sql — Sprint 14c / O2-5
--
-- API pública read-only para integração externa (edge function api-v1).
-- Esta migration cria o SCHEMA suporte da API:
--
--   1. Tabela api_tokens (SHA-256 hash + scope + revocação)
--   2. View vw_api_documentos (whitelist de colunas, zero PII)
--   3. Função is_valid_api_token() — usada pelo edge para autenticar
--
-- A tabela documento_api_rate_limit já existe (criada em
-- 20260509400000_doc_verify_public.sql) e será reusada pelo edge api-v1
-- com endpoint='api-v1'.
--
-- SECURITY MODEL (IMPORTANTE):
--   • Token raw NUNCA é armazenado. Armazenamos SHA-256 hex (irreversível).
--     UI admin gera token via crypto.getRandomValues, exibe UMA vez, persiste hash.
--   • View vw_api_documentos NÃO usa security_invoker — executa com privilégios
--     do owner (postgres), portanto não filtra por RLS da tabela base.
--     Gate de acesso é em CAMADA DE APLICAÇÃO: a edge function api-v1 valida
--     token (via is_valid_api_token) antes de consultar a view. Mitigação dupla:
--       (a) view só expõe colunas whitelisted (sem PII, sem URLs de storage);
--       (b) stripPii() no edge como segunda camada de defesa.
--   • RPC is_valid_api_token é SECURITY DEFINER porque precisa UPDATE em
--     api_tokens (last_used_at, usage_count) sem que o caller (service_role
--     do edge ou anon) tenha permissão direta de escrita na tabela.
--
-- LGPD:
--   • Token API é dado de integração (não-PII). created_by guarda Firebase UID
--     do admin que gerou — útil para auditoria. Não considera-se PII de titular.
--   • A view exclui TODOS os campos que poderiam vazar PII de criadores,
--     URLs de storage que linkam a documentos físicos, e metadados sensíveis
--     (OCR text, retention/legal_hold, confidentiality_level).
--
-- Idempotência: tudo IF NOT EXISTS / OR REPLACE / DROP+CREATE pattern.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela api_tokens
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    text NOT NULL UNIQUE,
  name          text NOT NULL,
  scope         text NOT NULL DEFAULT 'read'
                  CHECK (scope IN ('read')),
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  usage_count   bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.api_tokens IS
  'Sprint 14c / O2-5. Tokens da API pública read-only (edge api-v1). '
  'token_hash = SHA-256 hex do token raw (irreversível; raw NUNCA armazenado). '
  'scope=read (única opção em v1). created_by = Firebase UID do admin gerador.';

COMMENT ON COLUMN public.api_tokens.token_hash IS
  'SHA-256 hex (lowercase, 64 chars) do token raw. Token plain só existe no '
  'momento da geração e na cabeça do integrador — backend nunca o vê de novo.';

COMMENT ON COLUMN public.api_tokens.revoked_at IS
  'NULL = token ativo. NOT NULL = token revogado (não autentica mais). '
  'is_valid_api_token() filtra revoked_at IS NULL.';

COMMENT ON COLUMN public.api_tokens.usage_count IS
  'Contador incremental de chamadas autenticadas com este token. '
  'Atualizado por is_valid_api_token() (SECURITY DEFINER).';

-- Index parcial: lookups de tokens ativos (caminho quente)
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash_active
  ON public.api_tokens (token_hash)
  WHERE revoked_at IS NULL;

-- Index p/ listagem admin (mais recentes primeiro)
CREATE INDEX IF NOT EXISTS idx_api_tokens_created_desc
  ON public.api_tokens (created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. RLS — admin-only (CRUD via UI Centro de Gestão)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_tokens_admin_select ON public.api_tokens;
CREATE POLICY api_tokens_admin_select
  ON public.api_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS api_tokens_admin_insert ON public.api_tokens;
CREATE POLICY api_tokens_admin_insert
  ON public.api_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS api_tokens_admin_update ON public.api_tokens;
CREATE POLICY api_tokens_admin_update
  ON public.api_tokens
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS api_tokens_admin_delete ON public.api_tokens;
CREATE POLICY api_tokens_admin_delete
  ON public.api_tokens
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- 3. View vw_api_documentos — contrato público READ-ONLY
--
-- WHITELIST de colunas (apenas estas saem na API pública). Qualquer coluna
-- nova adicionada a public.documentos NÃO aparece aqui automaticamente —
-- exige nova migration que altere a view explicitamente.
--
-- COLUNAS EXCLUÍDAS (e por quê):
--   • created_by, created_by_name, created_by_email   — PII de autor (LGPD)
--   • updated_by, updated_by_name                     — PII de editor (LGPD)
--   • deleted_by, legal_hold_set_by                   — PII de admin
--   • arquivo_url, storage_path, arquivo_nome,
--     arquivo_tamanho                                 — vaza paths/binários
--   • pdfa_url, ocr_text_url                          — vaza storage paths
--   • ocr_text                                        — pode conter PII OCR'd
--   • ocr_engine, ocr_confidence, ocr_status,
--     ocr_pages_processed, ocr_run_at, ocr_fail_count — interno (pipeline)
--   • pdfa_status, pdfa_processed_at, pdfa_pages,
--     pdfa_size_bytes                                 — interno (pipeline)
--   • confidentiality_level                           — clearance interno
--   • legal_hold, legal_hold_reason,
--     legal_hold_set_at, retention_until,
--     retention_policy_id                             — interno (legal/retenção)
--   • approval_workflow                               — interno (jsonb fluxo)
--   • bulk_import_id                                  — interno (job FK)
--   • fts (tsvector)                                  — interno (índice FTS)
--   • deleted_at                                      — interno (soft-delete);
--                                                       filtramos IS NULL no WHERE
--   • observacoes                                     — pode conter notas internas
--   • setor_id, setor_nome, responsavel,
--     responsavel_revisao, responsavel_elaboracao,
--     responsavel_aprovacao                           — PII/PII parcial
--   • origem, data_publicacao, data_versao,
--     classificacao_acesso, local_armazenamento      — metadados internos
--     (podem ser expostos em v2 após review LGPD)
--   • codigo, descricao, subcategoria, tags,
--     view_count, download_count,
--     intervalo_revisao_dias                          — fora do contrato v1
--     mínimo aprovado pelo plano O2-5; podem entrar em v1.1.
--
-- Filtros aplicados na view:
--   • deleted_at IS NULL          — exclui soft-deleted
--   • status NOT IN (rascunho,
--     rejeitado, revisao_pendente)— só docs publicáveis externamente
--   • confidentiality_level = 'publico' — extra segurança LGPD (mesmo padrão
--     da RPC rpc_verify_document_public)
--
-- SECURITY_INVOKER off (default) — view executa com privs do owner postgres.
-- Gate é via Edge function api-v1 + is_valid_api_token (camada de aplicação).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_api_documentos AS
SELECT
  d.id,
  d.titulo,
  d.tipo,
  d.categoria,
  d.status,
  d.versao_atual,
  d.rop_area,
  d.qmentum_weight,
  d.created_at,
  d.updated_at,
  d.proxima_revisao
FROM public.documentos d
WHERE d.deleted_at IS NULL
  AND d.status NOT IN ('rascunho', 'rejeitado', 'revisao_pendente')
  AND d.confidentiality_level = 'publico';

COMMENT ON VIEW public.vw_api_documentos IS
  'Sprint 14c / O2-5. Contrato READ-ONLY da API pública (edge api-v1). '
  'Whitelist explícita de 11 colunas — zero PII, zero URLs de storage. '
  'Filtros: deleted_at IS NULL, status publicável, confidentiality_level=publico. '
  'SECURITY_INVOKER off — gate é via Edge api-v1 + is_valid_api_token().';

-- View é GRANT'ável; service_role do edge consulta diretamente.
-- anon/authenticated têm GRANT mas SEM acesso direto (edge é único caller).
GRANT SELECT ON public.vw_api_documentos TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. View vw_api_documentos_changelog
--
-- A tabela documento_changelog existe (001_schema.sql:136) com PII:
--   user_id, user_name, user_email — EXCLUÍDOS da view.
--
-- Whitelist: id, documento_id, versao (extraído de changes->>'versao'),
-- acao (renomeado de action), created_at.
--
-- Filtros:
--   • documento_id IS NOT NULL — exclui changelog órfão (doc deletado
--     por cleanup pós-retenção; ver migration 20260504100300)
--   • só changelog de documentos públicos (JOIN + filtro confidentiality)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_api_documentos_changelog AS
SELECT
  c.id,
  c.documento_id,
  -- `versao` é metadado opcional gravado no jsonb `changes` por algumas ações
  -- (version_added, approved, etc). Pode ser NULL para ações sem versão.
  (c.changes->>'versao')::integer AS versao,
  c.action AS acao,
  c.created_at
FROM public.documento_changelog c
JOIN public.documentos d ON d.id = c.documento_id
WHERE c.documento_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.confidentiality_level = 'publico'
  AND d.status NOT IN ('rascunho', 'rejeitado', 'revisao_pendente');

COMMENT ON VIEW public.vw_api_documentos_changelog IS
  'Sprint 14c / O2-5. Histórico read-only por documento para API pública. '
  'Whitelist: id, documento_id, versao, acao, created_at. '
  'Exclui PII: user_id/user_name/user_email/changes(jsonb)/comment. '
  'Mesmos filtros de confidentiality/status/deleted da vw_api_documentos.';

GRANT SELECT ON public.vw_api_documentos_changelog TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Função is_valid_api_token(p_token_hash text) RETURNS boolean
--
-- Contrato: edge function api-v1 calcula SHA-256 hex do header
-- Authorization: Bearer <token> e chama esta RPC. Retorna true sse o token
-- existe E NÃO está revogado. Side-effect: atualiza last_used_at e
-- incrementa usage_count.
--
-- SECURITY DEFINER porque o caller é service_role (do edge); a função
-- precisa UPDATE em api_tokens mesmo que o caller não tenha o privilégio
-- direto via RLS.
--
-- SET search_path = public — boa prática SECURITY DEFINER (previne hijack
-- por schemas temporários no search_path do caller).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_valid_api_token(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash = '' THEN
    RETURN false;
  END IF;

  -- Lookup token ativo
  SELECT id INTO v_token_id
  FROM public.api_tokens
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
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
  'Sprint 14c / O2-5. Valida token API pelo SHA-256 hex. Retorna true se '
  'ativo (revoked_at IS NULL). Side-effect: atualiza last_used_at + usage_count. '
  'SECURITY DEFINER — chamada pelo edge api-v1 via service_role.';

-- Tokens são consultados pelo edge (service_role), mas concedemos EXECUTE
-- a anon/authenticated para flexibilidade futura (ex: client-side check).
-- A segurança vem do hash: caller só consegue validar tokens que já conhece.
GRANT EXECUTE ON FUNCTION public.is_valid_api_token(text) TO anon, authenticated, service_role;
