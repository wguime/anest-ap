-- ============================================================================
-- Anexos × Anonimização Art. 12 — scrub do Storage + limite do bucket
--
-- Achado da auditoria LGPD 2026-07-30 (B2): rpc_anonimizar_incidente zera o
-- JSONB attachments, mas com o bucket `incidentes-anexos` (migration
-- 20260730220000) os OBJETOS de relato identificado permanecem com
-- owner_id = UID do uploader e o protocolo sobrevive na linha anonimizada —
-- quem lista a pasta re-vincula identidade ao relato "anonimizado", quebrando
-- a irreversibilidade prometida ("uma vez anonimizado, identidade é IMUTÁVEL").
--
-- Fix: a RPC passa a anular owner/owner_id dos objetos da pasta do protocolo
-- NA MESMA transação (postgres tem UPDATE em storage.objects — verificado
-- 2026-07-30; a função é SECURITY DEFINER owned by postgres). Os arquivos em
-- si PERMANECEM (evidência imutável, decisão do módulo) — o que se corta é o
-- vínculo de identidade. Corpo da função copiado da versão viva em produção
-- (pg_get_functiondef, idêntica à 20260504000000) + as mudanças marcadas.
--
-- Também: file_size_limit 20MB no bucket (P4 — o teto era só client-side).
-- ============================================================================

BEGIN;

-- P4: teto server-side espelha ANEXO_MAX_MB da lib (20MB)
UPDATE storage.buckets
   SET file_size_limit = 20971520
 WHERE id = 'incidentes-anexos';

CREATE OR REPLACE FUNCTION public.rpc_anonimizar_incidente(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_uid text;
  v_protocolo text;  -- B2: pasta dos anexos no bucket
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

    -- attachments: metadados removidos da linha; os OBJETOS ficam no bucket
    -- (evidência imutável) mas o vínculo de identidade é cortado abaixo.
    attachments = '[]'::jsonb,

    -- LGPD: marca timestamp de anonimização
    anonymized_at = now(),

    -- Audit trail (colunas existem desde migration 022)
    updated_by = v_actor_uid,
    updated_by_name = 'Anonimização LGPD Art. 12',
    updated_at = now()
  WHERE id = p_id
  RETURNING protocolo INTO v_protocolo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incidente % não encontrado', p_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- B2 (2026-07-30): corta o vínculo uploader→anexo no Storage. A pasta é
  -- pasta/<protocolo-sanitizado>/uuid.ext (mesma sanitização de
  -- buildAnexoPath na lib incidenteAnexos.js). Cobre as 4 pastas do bucket.
  IF v_protocolo IS NOT NULL AND v_protocolo <> '' THEN
    UPDATE storage.objects
       SET owner = NULL,
           owner_id = NULL
     WHERE bucket_id = 'incidentes-anexos'
       AND (storage.foldername(name))[2] =
           regexp_replace(v_protocolo, '[^a-zA-Z0-9-]', '', 'g');
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.rpc_anonimizar_incidente(uuid) IS
  'LGPD Art. 12: anonimiza completamente um incidente/denúncia. '
  'Limpa todos os campos livres com possível PII em incidente_data, '
  'denuncia_data, impacto, contexto_anest, gestao_interna, admin_data e '
  'attachments, e anula owner/owner_id dos objetos do protocolo no bucket '
  'incidentes-anexos (os arquivos permanecem como evidência, sem vínculo '
  'de identidade). Operação IRREVERSÍVEL. SECURITY DEFINER — chamadores '
  'devem garantir is_admin() no service layer.';

COMMIT;
