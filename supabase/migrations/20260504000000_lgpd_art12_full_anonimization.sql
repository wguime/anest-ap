-- ============================================================================
-- 20260504_lgpd_art12_full_anonimization.sql
-- LGPD Art. 12 — Anonimização completa de incidentes/denúncias
-- ----------------------------------------------------------------------------
-- LGPD Art. 12: dados anonimizados não são considerados dados pessoais "para os
-- fins desta Lei", desde que o processo de anonimização não possa ser revertido
-- com esforço razoável. A função anterior (005_incidents.sql:185) limpava
-- apenas notificante/denunciante, deixando PII em incidente_data.descricao,
-- denuncia_data (titulo, descricao, pessoasEnvolvidas, testemunhas,
-- denunciadoCargo/Setor/Local, impacto), impacto.*, contexto_anest.observacoes,
-- gestao_interna.parecer/feedbackAoRelator/notasInternas/rca, admin_data e
-- attachments — todos campos livres com risco alto de identificação direta
-- ou indireta.
--
-- Esta migration substitui rpc_anonimizar_incidente por uma versão que:
--   1. Mantém estrutura JSONB (campos taxonômicos preservados para agregados)
--   2. Sobrescreve TODOS os campos livres com string vazia
--   3. Zera attachments (URLs de Storage que podem conter PII no nome)
--   4. Registra audit trail (updated_by_name = 'Anonimização LGPD Art. 12')
--   5. Bloqueia acesso por user_id (= NULL) e marca anonymized_at
--
-- Também ajusta rpc_fetch_by_tracking_code para retornar marcador
-- "[ANONIMIZADO]" em campos textuais quando anonymized_at IS NOT NULL,
-- reforçando que o relato foi efetivamente anonimizado para o relator que
-- consulta via tracking_code.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. rpc_anonimizar_incidente — versão LGPD Art. 12 completa
-- ────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.rpc_anonimizar_incidente(uuid);

CREATE OR REPLACE FUNCTION public.rpc_anonimizar_incidente(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_uid text;
BEGIN
  -- Captura UID do admin que está anonimizando (audit)
  v_actor_uid := nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  );

  UPDATE public.incidentes SET
    -- Identidade do relator/notificante: zerada
    user_id = NULL,
    notificante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
    denunciante = '{"tipoIdentificacao":"anonimo"}'::jsonb,

    -- incidente_data: preserva taxonomia (data, local genérico, tipo, severidade)
    --                 mas zera descrição livre que pode conter PII
    incidente_data = COALESCE(incidente_data, '{}'::jsonb) || jsonb_build_object(
      'descricao', '',
      'observacoes', ''
    ),

    -- impacto: zera todos os textos livres
    impacto = COALESCE(impacto, '{}'::jsonb) || jsonb_build_object(
      'danoAoPaciente', '',
      'acoesTomadas', '',
      'sugestoesMelhoria', ''
    ),

    -- contexto_anest: preserva fase/tipo (taxonomia), zera observações livres
    contexto_anest = COALESCE(contexto_anest, '{}'::jsonb) || jsonb_build_object(
      'observacoes', ''
    ),

    -- denuncia_data: zera TODOS os campos textuais (todos são PII em denúncia)
    denuncia_data = COALESCE(denuncia_data, '{}'::jsonb) || jsonb_build_object(
      'titulo', '',
      'descricao', '',
      'pessoasEnvolvidas', '',
      'testemunhas', '',
      'denunciadoCargo', '',
      'denunciadoSetor', '',
      'denunciadoLocal', '',
      'impacto', ''
    ),

    -- gestao_interna: preserva responsável/datas/status (audit interno),
    --                 zera campos livres com possível PII
    gestao_interna = COALESCE(gestao_interna, '{}'::jsonb) || jsonb_build_object(
      'parecer', '',
      'acaoCorretiva', '',
      'recomendacoes', '',
      'feedbackAoRelator', '',
      'notasInternas', '',
      'rca', ''
    ),

    -- admin_data: zera tudo (campo é majoritariamente comentários livres)
    admin_data = jsonb_build_object('parecer', ''),

    -- attachments: removidos (URLs de Storage com possível PII no path/metadados)
    -- Cleanup do bucket Storage deve ser feito em job separado.
    attachments = '[]'::jsonb,

    -- LGPD: marca timestamp de anonimização
    anonymized_at = now(),

    -- Audit trail (colunas existem desde migration 022)
    updated_by = v_actor_uid,
    updated_by_name = 'Anonimização LGPD Art. 12',
    updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incidente % não encontrado', p_id
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rpc_anonimizar_incidente(uuid) IS
  'LGPD Art. 12: anonimiza completamente um incidente/denúncia. '
  'Limpa todos os campos livres com possível PII em incidente_data, '
  'denuncia_data, impacto, contexto_anest, gestao_interna, admin_data e '
  'attachments. Operação IRREVERSÍVEL. SECURITY DEFINER — chamadores '
  'devem garantir is_admin() no service layer.';

-- Acesso: apenas authenticated (service garante is_admin no JS)
REVOKE ALL ON FUNCTION public.rpc_anonimizar_incidente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_anonimizar_incidente(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_anonimizar_incidente(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. rpc_fetch_by_tracking_code — guard de exibição para registros anonimizados
-- ────────────────────────────────────────────────────────────────────────────
-- Para registros anonimizados, retorna marcador explícito "[ANONIMIZADO]" nos
-- campos textuais. Isso reforça ao relator (que consulta via tracking) que o
-- conteúdo foi removido por solicitação LGPD, mantendo o status/feedback.

CREATE OR REPLACE FUNCTION public.rpc_fetch_by_tracking_code(p_tracking_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT row_to_json(t) FROM (
    SELECT
      id, protocolo, tracking_code, status, tipo,
      created_at, updated_at,
      anonymized_at,
      CASE WHEN anonymized_at IS NOT NULL
        THEN '[ANONIMIZADO]'
        ELSE incidente_data->>'tipo'
      END AS incidente_tipo,
      CASE WHEN anonymized_at IS NOT NULL
        THEN '[ANONIMIZADO]'
        ELSE incidente_data->>'descricao'
      END AS incidente_resumo,
      CASE WHEN anonymized_at IS NOT NULL
        THEN '[ANONIMIZADO]'
        ELSE denuncia_data->>'titulo'
      END AS denuncia_titulo,
      CASE WHEN anonymized_at IS NOT NULL
        THEN '[ANONIMIZADO]'
        ELSE denuncia_data->>'tipo'
      END AS denuncia_tipo,
      CASE WHEN anonymized_at IS NOT NULL
        THEN NULL
        ELSE gestao_interna->>'feedbackAoRelator'
      END AS feedback_ao_relator,
      gestao_interna->'historicoStatus' AS historico_status,
      gestao_interna->>'ultimaAtualizacao' AS ultima_atualizacao,
      CASE WHEN anonymized_at IS NOT NULL
        THEN NULL
        ELSE admin_data->>'parecer'
      END AS parecer
    FROM public.incidentes
    WHERE tracking_code = p_tracking_code
  ) t;
$$;

COMMENT ON FUNCTION public.rpc_fetch_by_tracking_code(text) IS
  'Lookup público (anon) por tracking_code. Mascara campos textuais como '
  '"[ANONIMIZADO]" quando o registro foi anonimizado (LGPD Art. 12).';


-- ============================================================================
-- ROLLBACK INSTRUCTIONS (revert para versão original de 005_incidents.sql)
-- ============================================================================
-- Caso seja necessário reverter esta migration, execute:
--
-- DROP FUNCTION IF EXISTS public.rpc_anonimizar_incidente(uuid);
-- CREATE OR REPLACE FUNCTION public.rpc_anonimizar_incidente(p_id uuid)
-- RETURNS void AS $$
-- BEGIN
--   UPDATE public.incidentes SET
--     user_id = NULL,
--     notificante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
--     denunciante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
--     anonymized_at = now()
--   WHERE id = p_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- E reverter rpc_fetch_by_tracking_code para a versão de 022_fix_incidents_security.sql:44.
--
-- ATENÇÃO: o rollback NÃO restaura dados de incidentes que já foram anonimizados
-- pela versão completa — uma vez aplicada, a anonimização é IRREVERSÍVEL.
-- ============================================================================
