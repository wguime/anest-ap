-- =============================================================================
-- 20260520120000_verify_cert_uuid_rate_limit.sql — Wave 1.7 (LGPD)
--
-- Wave 1.7 LGPD: nova edge function `verify-cert-uuid-public` substitui o leak
-- de PII em `/verificar/:uuid` que hoje lê Firestore client-side e renderiza
-- `userNome` (NOME COMPLETO) na tela pública. A nova edge faz lookup via
-- Firestore Admin REST (service account) e devolve apenas o que LGPD permite
-- numa página pública de verificação:
--   - curso, carga horária, datas, status
--   - INICIAIS do titular (ex: "G.G.G.") — nunca nome completo nem userId
--
-- Esta migration adiciona apenas a RPC de rate limit. Reusa a tabela
-- `documento_api_rate_limit` (criada em 20260509400000_doc_verify_public.sql)
-- com endpoint dedicado `verify-cert-uuid-public` — não compartilha quota
-- com `verify-doc-public` nem `verify-cert-public`.
--
-- Sliding window 60s, 60 req/min/IP. Apenas service_role executa (a edge
-- function chama com SUPABASE_SERVICE_ROLE_KEY). Idempotente (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_check_cert_uuid_rate_limit(p_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count   integer;
  v_window  interval := interval '60 seconds';
  v_limit   integer := 60;
BEGIN
  IF p_ip IS NULL OR p_ip = '' THEN
    p_ip := 'unknown';
  END IF;

  -- Sliding window 60s, escopo por endpoint próprio.
  SELECT COUNT(*) INTO v_count
  FROM public.documento_api_rate_limit
  WHERE ip = p_ip
    AND endpoint = 'verify-cert-uuid-public'
    AND requested_at >= now() - v_window;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.documento_api_rate_limit (ip, endpoint, requested_at)
  VALUES (p_ip, 'verify-cert-uuid-public', now());
END;
$$;

COMMENT ON FUNCTION public.rpc_check_cert_uuid_rate_limit IS
  'Wave 1.7. Rate limit 60/min/IP para edge function verify-cert-uuid-public (lookup por UUID do certificado em Firestore). Reusa documento_api_rate_limit com endpoint dedicado.';

REVOKE ALL ON FUNCTION public.rpc_check_cert_uuid_rate_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_check_cert_uuid_rate_limit(text) TO service_role;
