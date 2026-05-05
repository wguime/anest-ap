-- ==========================================================================
-- 20260505100000_extend_anonymize_rpc.sql
-- LGPD Art. 12 — anonimização completa
-- Endereça gap A6.1 da auditoria 2026-05-04.
-- ==========================================================================
--
-- Antes: rpc_anonimizar_incidente (005_incidents.sql:185-195) só limpava
-- notificante e marcava anonymized_at, deixando PII em incidente_data.descricao,
-- denuncia_data.descricao/titulo, gestao_interna, admin_data e attachments.
--
-- Depois: limpa todos os campos com possibilidade de PII, preserva campos
-- não-pessoais (severidade, tipo, status) para indicadores agregados.
-- Retorna json com {anonymized_at, fields_cleared} para audit trail.
--
-- Mantém SECURITY DEFINER + grant para authenticated apenas (anon NÃO pode
-- chamar — anonimização é decisão administrativa).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.rpc_anonimizar_incidente(p_id uuid)
RETURNS json AS $$
DECLARE
  v_anonimized_at timestamptz := now();
  v_fields_cleared text[] := ARRAY[
    'notificante', 'denunciante',
    'incidente_data.descricao', 'incidente_data.profissionaisEnvolvidos',
    'incidente_data.observacoes', 'incidente_data.neverEventResponsavelRca',
    'denuncia_data.descricao', 'denuncia_data.titulo',
    'denuncia_data.testemunhas', 'denuncia_data.condutaImediata',
    'denuncia_data.denunciadoCargo', 'denuncia_data.denunciadoSetor',
    'denuncia_data.denunciadoLocal', 'denuncia_data.pessoasEnvolvidas',
    'denuncia_data.numeroAtendimento', 'denuncia_data.nomeCompletoPaciente',
    'denuncia_data.dataNascimentoPaciente',
    'impacto.descricaoDano', 'impacto.profissionaisEnvolvidos',
    'gestao_interna', 'admin_data', 'attachments', 'user_id'
  ];
  v_rows int;
BEGIN
  UPDATE public.incidentes SET
    user_id = NULL,
    notificante = jsonb_build_object('tipoIdentificacao', 'anonimo'),
    denunciante = jsonb_build_object('tipoIdentificacao', 'anonimo'),
    incidente_data = (COALESCE(incidente_data, '{}'::jsonb)
      - 'descricao' - 'profissionaisEnvolvidos' - 'observacoes'
      - 'neverEventResponsavelRca')
      || jsonb_build_object('descricao', '[ANONIMIZADO LGPD Art. 12]'),
    denuncia_data = (COALESCE(denuncia_data, '{}'::jsonb)
      - 'descricao' - 'titulo' - 'testemunhas' - 'condutaImediata'
      - 'denunciadoCargo' - 'denunciadoSetor' - 'denunciadoLocal'
      - 'pessoasEnvolvidas' - 'numeroAtendimento'
      - 'nomeCompletoPaciente' - 'dataNascimentoPaciente')
      || jsonb_build_object('descricao', '[ANONIMIZADO LGPD Art. 12]', 'titulo', '[ANONIMIZADO]'),
    impacto = (COALESCE(impacto, '{}'::jsonb)
      - 'descricaoDano' - 'profissionaisEnvolvidos'),
    gestao_interna = '{}'::jsonb,
    admin_data = '{}'::jsonb,
    attachments = '[]'::jsonb,
    anonymized_at = v_anonimized_at,
    updated_at = v_anonimized_at
  WHERE id = p_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Incidente % não encontrado', p_id USING ERRCODE = 'no_data_found';
  END IF;

  RETURN json_build_object(
    'anonymized_at', v_anonimized_at,
    'fields_cleared', v_fields_cleared,
    'rows_affected', v_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

REVOKE ALL ON FUNCTION public.rpc_anonimizar_incidente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_anonimizar_incidente(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_anonimizar_incidente(uuid) IS
  'LGPD Art. 12 — anonimização completa. Limpa todas as JSONB com possibilidade de PII. '
  'Mantém severidade/tipo/status/protocolo para indicadores. '
  'Restrito a authenticated (admin via RLS check no caller). Anon NÃO pode chamar.';
