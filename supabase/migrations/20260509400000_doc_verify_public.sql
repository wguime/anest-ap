-- =============================================================================
-- 20260509400000_doc_verify_public.sql — Sprint 10 / F7
--
-- Portal público /verificar/doc/:hash. Permite que qualquer pessoa
-- (sem autenticação) verifique a integridade de um documento institucional
-- pelo SHA-256 do PDF assinado.
--
-- LGPD: a RPC retorna APENAS campos de prova de integridade (codigo, titulo,
-- versao, decided_at, signature_hash, signature_algo). NÃO expõe approver_id,
-- approver_name, autor, created_by, ou qualquer metadado interno. Documentos
-- com confidentiality_level diferente de 'publico' retornam vazio (mesmo
-- shape de hash inválido — não vaza existência).
--
-- Rate limit: 60 req/min/IP via tabela documento_api_rate_limit. Sliding
-- window de 60 segundos. Excedido → exception 'rate_limited' (caller deve
-- traduzir para HTTP 429).
--
-- Idempotência: tudo em IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela documento_api_rate_limit
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documento_api_rate_limit (
  id            bigserial PRIMARY KEY,
  ip            text NOT NULL,
  endpoint      text NOT NULL DEFAULT 'verify-doc-public',
  requested_at  timestamptz NOT NULL DEFAULT now()
);

-- Index otimiza a contagem na sliding window (filtro por ip + ordenação por tempo)
CREATE INDEX IF NOT EXISTS idx_doc_api_rl_ip_time
  ON public.documento_api_rate_limit (ip, requested_at DESC);

-- RLS: nenhuma policy → bloqueia anon e authenticated. Apenas service_role
-- (via SECURITY DEFINER da RPC abaixo) pode escrever/ler.
ALTER TABLE public.documento_api_rate_limit ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.documento_api_rate_limit IS
  'Rate limit log do endpoint público verify-doc-public. Sliding window 60s, 60 req/min/IP. Apenas SECURITY DEFINER RPC escreve/lê.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Job de cleanup (mantém só os últimos 60min de registros)
--    Roda a cada hora via pg_cron — evita crescimento ilimitado.
-- ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-doc-api-rate-limit')
    FROM cron.job WHERE jobname = 'cleanup-doc-api-rate-limit';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-doc-api-rate-limit',
    '7 * * * *', -- minute 7 de toda hora
    $job$DELETE FROM public.documento_api_rate_limit
         WHERE requested_at < now() - interval '1 hour'$job$
  );
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'pg_cron não disponível — cleanup deve ser agendado manualmente';
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RPC rpc_verify_document_public
--
--    Parâmetros:
--      p_hash text — SHA-256 hex (64 chars lowercase) do PDF assinado
--      p_ip   text — IP do cliente (passado pelo edge function via x-forwarded-for)
--
--    Retorna SETOF da view de proof. Vazio = (não existe) OU (existe mas
--    confidentiality_level != 'publico'). Caller NÃO consegue distinguir
--    os dois casos — proteção contra enumeration.
--
--    Errors:
--      - 'rate_limited': IP excedeu 60 req/60s
--      - 'invalid_hash': hash não é 64-char hex
--
--    Side-effect: insere registro em documento_api_rate_limit (toda
--    chamada conta para o limit, mesmo as que retornam vazio).
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_verify_document_public(
  p_hash text,
  p_ip   text
)
RETURNS TABLE (
  codigo          text,
  titulo          text,
  versao          integer,
  decided_at      timestamptz,
  signature_hash  text,
  signature_algo  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count   integer;
  v_window  interval := interval '60 seconds';
  v_limit   integer := 60;
BEGIN
  -- Validação básica: SHA-256 hex tem 64 chars lowercase a-f0-9
  IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_hash' USING ERRCODE = 'P0001';
  END IF;

  IF p_ip IS NULL OR p_ip = '' THEN
    p_ip := 'unknown';
  END IF;

  -- Rate limit check (sliding window 60s)
  SELECT COUNT(*) INTO v_count
  FROM public.documento_api_rate_limit
  WHERE ip = p_ip
    AND requested_at >= now() - v_window;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  -- Registra esta requisição (conta para o próximo cliente do mesmo IP)
  INSERT INTO public.documento_api_rate_limit (ip, endpoint, requested_at)
  VALUES (p_ip, 'verify-doc-public', now());

  -- Lookup: signature_hash bate, action='approved' OR 'signed', e o
  -- documento referenciado é PÚBLICO (confidentiality_level='publico').
  -- Não vaza existência de docs internos.
  --
  -- Status NOT IN ('rascunho','rejeitado'): docs em rascunho ou rejeitados
  -- nunca tiveram aprovação válida. Docs 'arquivado' continuam verificáveis
  -- intencionalmente — assinatura histórica permanece válida como prova
  -- de autenticidade da versão arquivada.
  --
  -- NOTA: o INSERT no rate_limit acima ocorre antes deste SELECT mas após
  -- o COUNT. Em altíssima concorrência (>1 req/ms do mesmo IP) duas
  -- requests podem ambas passar pelo check — best-effort sliding window,
  -- aceitável para 60/min/IP.
  RETURN QUERY
  SELECT
    d.codigo,
    d.titulo,
    a.versao,
    a.decided_at,
    a.signature_hash,
    COALESCE(a.signature_algo, 'SHA-256') AS signature_algo
  FROM public.documento_aprovacoes a
  JOIN public.documentos d ON d.id = a.documento_id
  WHERE a.signature_hash = lower(p_hash)
    AND a.action IN ('approved', 'signed')
    AND d.confidentiality_level = 'publico'
    AND d.status NOT IN ('rascunho', 'rejeitado')
  ORDER BY a.decided_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.rpc_verify_document_public IS
  'Sprint 10 / F7. Verifica integridade de documento público pelo SHA-256 do PDF assinado. Rate limit 60/min/IP. NÃO retorna PII. Vazio quando hash inválido ou doc não público.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Permissões
-- ──────────────────────────────────────────────────────────────────────────
-- Edge function chama com service_role; anon NÃO tem acesso direto à RPC.
-- (Edge function é o único caller esperado — adiciona CORS, headers, etc.)
REVOKE ALL ON FUNCTION public.rpc_verify_document_public(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_verify_document_public(text, text) TO service_role;
