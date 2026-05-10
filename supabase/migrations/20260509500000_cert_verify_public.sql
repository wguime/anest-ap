-- =============================================================================
-- 20260509500000_cert_verify_public.sql — Sprint 11
--
-- Refactor HMAC certificados: a verificação HMAC era client-side em
-- educacaoService.js:verificarAssinatura, com secret hardcoded
-- em texto puro no bundle JS (qualquer usuário podia forjar).
--
-- Pós-refactor: edge function verify-cert-public calcula HMAC com secret
-- de Deno.env.get('CERT_HMAC_SECRET'). Esta migration adiciona apenas a
-- RPC de rate limit que a edge function consome — o cálculo HMAC fica em
-- Deno (não precisa pgcrypto).
--
-- Reusa tabela documento_api_rate_limit (criada em 20260509400000) com
-- endpoint='verify-cert-public'. Sliding window 60s, 60 req/min/IP. Apenas
-- service_role pode executar (REVOKE PUBLIC + GRANT EXECUTE service_role).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_check_cert_rate_limit(p_ip text)
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

  -- Sliding window 60s, escopo por endpoint para não compartilhar quota com verify-doc-public
  SELECT COUNT(*) INTO v_count
  FROM public.documento_api_rate_limit
  WHERE ip = p_ip
    AND endpoint = 'verify-cert-public'
    AND requested_at >= now() - v_window;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.documento_api_rate_limit (ip, endpoint, requested_at)
  VALUES (p_ip, 'verify-cert-public', now());
END;
$$;

COMMENT ON FUNCTION public.rpc_check_cert_rate_limit IS
  'Sprint 11. Rate limit 60/min/IP para edge function verify-cert-public. Reusa tabela documento_api_rate_limit com endpoint dedicado.';

REVOKE ALL ON FUNCTION public.rpc_check_cert_rate_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_check_cert_rate_limit(text) TO service_role;
