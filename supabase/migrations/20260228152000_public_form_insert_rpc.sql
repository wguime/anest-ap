-- ==========================================================================
-- RPC for public form submission (anon role)
-- Returns protocolo and tracking_code after insert
-- Needed because anon SELECT policy was removed in 022 for security
-- ==========================================================================

CREATE OR REPLACE FUNCTION rpc_submit_public_incident(
  p_tipo text,
  p_source text,
  p_status text,
  p_notificante jsonb DEFAULT '{}',
  p_denunciante jsonb DEFAULT '{}',
  p_incidente_data jsonb DEFAULT '{}',
  p_denuncia_data jsonb DEFAULT '{}',
  p_impacto jsonb DEFAULT '{}',
  p_contexto_anest jsonb DEFAULT '{}',
  p_lgpd_consent_at timestamptz DEFAULT null
) RETURNS json AS $$
DECLARE
  result record;
BEGIN
  -- Validate source
  IF p_source NOT IN ('formulario_publico', 'externo') THEN
    RAISE EXCEPTION 'Invalid source for public submission';
  END IF;

  INSERT INTO public.incidentes (
    user_id, tipo, source, status,
    notificante, denunciante,
    incidente_data, denuncia_data,
    impacto, contexto_anest,
    lgpd_consent_at
  ) VALUES (
    null, p_tipo, p_source, p_status,
    p_notificante, p_denunciante,
    p_incidente_data, p_denuncia_data,
    p_impacto, p_contexto_anest,
    p_lgpd_consent_at
  )
  RETURNING protocolo, tracking_code INTO result;

  RETURN json_build_object(
    'protocolo', result.protocolo,
    'tracking_code', result.tracking_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION rpc_submit_public_incident(text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz) TO anon;
