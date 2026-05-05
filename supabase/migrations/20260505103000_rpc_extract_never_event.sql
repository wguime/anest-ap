-- ==========================================================================
-- 20260505103000_rpc_extract_never_event.sql
-- Atualiza rpc_submit_public_incident para extrair isNeverEvent + neverEventCode
-- do JSONB p_incidente_data e popular as colunas dedicadas adicionadas em
-- 20260504_never_events.sql.
--
-- Antes: HTML público enviava isNeverEvent dentro de p_incidente_data JSONB,
-- mas as colunas top-level is_never_event / never_event_code permaneciam null,
-- fazendo a constraint chk_never_event_code_when_flagged não validar e a UI
-- do Centro de Gestão não exibir o badge "Never Event".
--
-- Depois: RPC extrai e popula colunas. Mantém JSONB também para preservar
-- contexto adicional (acaoImediata, responsavelRca, prazoRca).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_public_incident(
  p_tipo text,
  p_source text,
  p_status text,
  p_notificante jsonb DEFAULT '{}',
  p_denunciante jsonb DEFAULT '{}',
  p_incidente_data jsonb DEFAULT '{}',
  p_denuncia_data jsonb DEFAULT '{}',
  p_impacto jsonb DEFAULT '{}',
  p_contexto_anest jsonb DEFAULT '{}',
  p_lgpd_consent_at timestamptz DEFAULT NULL
) RETURNS json AS $$
DECLARE
  result record;
  v_is_never_event boolean;
  v_never_event_code text;
BEGIN
  IF p_source NOT IN ('formulario_publico', 'externo') THEN
    RAISE EXCEPTION 'Invalid source for public submission';
  END IF;

  -- Extrai NE do JSONB (incidente apenas — denúncia não tem NE).
  IF p_tipo = 'incidente' THEN
    v_is_never_event := COALESCE((p_incidente_data->>'isNeverEvent')::boolean, false);
    v_never_event_code := NULLIF(p_incidente_data->>'neverEventCode', '');
  ELSE
    v_is_never_event := false;
    v_never_event_code := NULL;
  END IF;

  -- Defesa: se flag true mas código vazio, derruba a flag (constraint
  -- chk_never_event_code_when_flagged exige código quando true).
  IF v_is_never_event AND v_never_event_code IS NULL THEN
    v_is_never_event := false;
  END IF;

  INSERT INTO public.incidentes (
    user_id, tipo, source, status,
    notificante, denunciante,
    incidente_data, denuncia_data,
    impacto, contexto_anest,
    lgpd_consent_at,
    is_never_event, never_event_code
  ) VALUES (
    NULL, p_tipo, p_source, p_status,
    p_notificante, p_denunciante,
    p_incidente_data, p_denuncia_data,
    p_impacto, p_contexto_anest,
    p_lgpd_consent_at,
    v_is_never_event, v_never_event_code
  )
  RETURNING protocolo, tracking_code INTO result;

  RETURN json_build_object(
    'protocolo', result.protocolo,
    'tracking_code', result.tracking_code,
    'is_never_event', v_is_never_event
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

GRANT EXECUTE ON FUNCTION public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz
) TO anon;

COMMENT ON FUNCTION public.rpc_submit_public_incident IS
  'Submit público (anon role). Extrai isNeverEvent/neverEventCode de incidente_data '
  'JSONB e popula colunas dedicadas para constraint + filtros do Centro de Gestão.';
