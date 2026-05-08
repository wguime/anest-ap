-- =============================================================================
-- 20260508200000_lgpd_anonymize_rpcs.sql — LGPD Art.18 fixes (audit P1)
--
-- Resolve dois problemas detectados na auditoria v3.72.0:
--   3.P1-2 — processSolicitacao() em lgpdService.js faz UPDATE em
--            documento_changelog com role authenticated, bloqueado pelo WORM
--            trigger. Necessita SECURITY DEFINER para bypass autorizado.
--   3.P1-3 — incidentes.incidente_data (JSONB) com PII (nome paciente, etc)
--            nunca era apagado — o ternário JS era um no-op.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RPC: anonimiza documento_changelog do user via SECURITY DEFINER
--    Bypass intencional do WORM trigger (que bloqueia UPDATE em
--    documento_changelog para roles autenticados, exceto service_role).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_anonymize_changelog_for_user(p_user_id text)
RETURNS integer AS $$
DECLARE
  affected int := 0;
BEGIN
  -- Apenas admins podem invocar (defesa em profundidade — RLS já protegeria
  -- mas como SECURITY DEFINER bypassa o WORM, validamos explicitamente).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'rpc_anonymize_changelog_for_user: apenas admins podem invocar';
  END IF;

  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'rpc_anonymize_changelog_for_user: p_user_id obrigatório';
  END IF;

  UPDATE public.documento_changelog
    SET user_name = '[REMOVIDO]',
        user_email = NULL
    WHERE user_id = p_user_id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_anonymize_changelog_for_user(text) TO authenticated;

COMMENT ON FUNCTION public.rpc_anonymize_changelog_for_user(text) IS
  'LGPD Art.18 — bypass autorizado do trigger WORM para anonimização de
   user_name/user_email no documento_changelog. Apenas admins podem invocar.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: anonimiza incidentes (user_id + incidente_data JSONB PII fields)
--    incidente_data carrega { nome_paciente, prontuario, idade, ... }
--    quando isAnonimo=false. Limpa esses campos preservando estrutura.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_anonimizar_incidente_user(p_user_id text)
RETURNS integer AS $$
DECLARE
  affected int := 0;
  pii_keys text[] := ARRAY[
    'nomePaciente', 'nome_paciente', 'paciente_nome',
    'prontuario', 'prontuario_numero',
    'idade', 'cpf', 'rg',
    'telefone', 'email', 'endereco',
    'notificanteName', 'notificanteEmail', 'notificanteFuncao', 'notificanteSetor',
    'denuncianteName', 'denuncianteEmail',
    'envolvido_nome', 'envolvidoNome'
  ];
  k text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'rpc_anonimizar_incidente_user: apenas admins podem invocar';
  END IF;

  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'rpc_anonimizar_incidente_user: p_user_id obrigatório';
  END IF;

  -- Strip PII keys from incidente_data, denuncia_data, gestao_interna JSONB
  FOREACH k IN ARRAY pii_keys LOOP
    UPDATE public.incidentes
      SET incidente_data = incidente_data - k
      WHERE user_id = p_user_id AND incidente_data ? k;

    UPDATE public.incidentes
      SET denuncia_data = denuncia_data - k
      WHERE user_id = p_user_id
        AND denuncia_data IS NOT NULL
        AND denuncia_data ? k;

    UPDATE public.incidentes
      SET gestao_interna = gestao_interna - k
      WHERE user_id = p_user_id
        AND gestao_interna IS NOT NULL
        AND gestao_interna ? k;
  END LOOP;

  -- Detach user_id após scrub
  UPDATE public.incidentes
    SET user_id = NULL
    WHERE user_id = p_user_id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_anonimizar_incidente_user(text) TO authenticated;

COMMENT ON FUNCTION public.rpc_anonimizar_incidente_user(text) IS
  'LGPD Art.18 — anonimiza incidentes do usuário: remove chaves PII de
   incidente_data/denuncia_data/gestao_interna (JSONB) e desvincula user_id.
   Apenas admins podem invocar.';
