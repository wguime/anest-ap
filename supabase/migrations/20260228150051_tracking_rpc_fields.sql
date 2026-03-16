-- ==========================================================================
-- Expand rpc_fetch_by_tracking_code with missing fields
-- Adds: incidente_tipo, incidente_resumo, denuncia_titulo, denuncia_tipo,
--        feedback_ao_relator, historico_status, ultima_atualizacao
-- ==========================================================================

CREATE OR REPLACE FUNCTION rpc_fetch_by_tracking_code(p_tracking_code text)
RETURNS json AS $$
  select row_to_json(t) from (
    select
      id, protocolo, tracking_code, status, tipo,
      incidente_data, impacto, created_at, updated_at,
      incidente_data->>'tipo' as incidente_tipo,
      incidente_data->>'descricao' as incidente_resumo,
      denuncia_data->>'titulo' as denuncia_titulo,
      denuncia_data->>'tipo' as denuncia_tipo,
      gestao_interna->>'feedbackAoRelator' as feedback_ao_relator,
      gestao_interna->'historicoStatus' as historico_status,
      admin_data->>'parecer' as parecer,
      gestao_interna->>'acaoCorretiva' as acao_corretiva,
      updated_at as ultima_atualizacao
    from public.incidentes
    where tracking_code = p_tracking_code
  ) t;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';
