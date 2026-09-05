-- ==========================================================================
-- 20260905000000_incidentes_so_responsaveis.sql
-- Decisão do dono 05/09/2026: incidentes e denúncias são EXCLUSIVOS de quem está
-- marcado como responsável no Centro de Gestão. Admin não marcado NÃO vê, não
-- gere, não baixa anexo. (Auditoria em .tmp/auditoria-denuncias-04-09/RELATORIO.md.)
--
-- Fecha todos os caminhos de leitura encontrados na auditoria:
--   1. incidentes: caem inc_select_admin / inc_update_admin / inc_delete_admin.
--      Ficam inc_select_own (autor vê o próprio relato identificado — Meus Relatos),
--      inc_select_responsavel e inc_update_responsavel. O app não apaga relatos;
--      scripts usam service_role.
--   2. incidentes-anexos: SELECT só dono do upload ou responsável do tipo.
--   3. incident_notification_settings: SELECT deixa de ser `true` — admin (gere a
--      lista), a própria linha, ou responsável (precisa da lista para avisar colegas).
--   4. rpc_anonimizar_incidente: ganha guarda is_admin() — era executável por qualquer
--      autenticado. rpc_aplicar_retencao_incidentes só roda por job/service_role.
--      rpc_anonimizar_incidente_user perde EXECUTE de anon.
--   5. profiles: não-admin não altera as próprias colunas de privilégio (role, active,
--      is_admin, is_coordenador, permissions, custom_permissions, clearance_level,
--      conta_duplicada_de, email, id) — `active` agora entra na autorização de
--      responsável e profiles_update permitia self-update sem restrição de coluna.
-- Idempotente. Sem mudança de dado.
-- ==========================================================================

BEGIN;

-- 1. incidentes: admin sai da RLS -------------------------------------------------
DROP POLICY IF EXISTS "inc_select_admin" ON public.incidentes;
DROP POLICY IF EXISTS "inc_update_admin" ON public.incidentes;
DROP POLICY IF EXISTS "inc_delete_admin" ON public.incidentes;

-- 2. anexos: só dono do upload ou responsável do tipo -------------------------------
DROP POLICY IF EXISTS "incidentes_anexos_select" ON storage.objects;
CREATE POLICY "incidentes_anexos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidentes-anexos'
    AND (
      owner_id = (SELECT public.firebase_uid())
      OR public.is_incident_responsible(
           CASE WHEN (storage.foldername(name))[1] IN ('denuncias', 'denuncias-anon')
                THEN 'denuncia' ELSE 'incidente' END
         )
    )
  );

-- 3. quem é responsável deixa de ser público -----------------------------------------
DROP POLICY IF EXISTS inc_notif_select ON public.incident_notification_settings;
CREATE POLICY inc_notif_select ON public.incident_notification_settings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = public.firebase_uid()
    OR public.is_incident_responsible('denuncia')
    OR public.is_incident_responsible('incidente')
  );

-- 4. RPCs LGPD: guarda e grants ------------------------------------------------------
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
  -- Guarda (05/09/2026): só admin anonimiza — a função era executável por qualquer
  -- autenticado (SECURITY DEFINER sem checagem). Mesma regra de rpc_anonimizar_incidente_user.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'rpc_anonimizar_incidente: apenas admins podem invocar' USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.rpc_anonimizar_incidente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_anonimizar_incidente(uuid) TO authenticated;

-- Retenção roda pelo pg_cron (job lgpd-retencao-incidentes, owner postgres) — nenhum
-- cliente precisa executá-la.
REVOKE ALL ON FUNCTION public.rpc_aplicar_retencao_incidentes() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.rpc_anonimizar_incidente_user(text) FROM PUBLIC, anon;

-- 5. profiles: privilégio só muda pela mão de admin ----------------------------------
-- Sem sub (service_role, jobs, sync Firestore→Supabase) e admin passam. O cliente só
-- LÊ o próprio perfil na reconciliação; escritas legítimas do próprio usuário
-- (avatar, nome, last_access, access_count, documents_accessed, ranking_opt_in) seguem.
CREATE OR REPLACE FUNCTION public.profiles_protect_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NULLIF(public.firebase_uid(), '') IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id                 IS DISTINCT FROM OLD.id
     OR NEW.email              IS DISTINCT FROM OLD.email
     OR NEW.role               IS DISTINCT FROM OLD.role
     OR NEW.active             IS DISTINCT FROM OLD.active
     OR NEW.is_admin           IS DISTINCT FROM OLD.is_admin
     OR NEW.is_coordenador     IS DISTINCT FROM OLD.is_coordenador
     OR NEW.custom_permissions IS DISTINCT FROM OLD.custom_permissions
     OR NEW.permissions        IS DISTINCT FROM OLD.permissions
     OR NEW.clearance_level    IS DISTINCT FROM OLD.clearance_level
     OR NEW.conta_duplicada_de IS DISTINCT FROM OLD.conta_duplicada_de THEN
    RAISE EXCEPTION 'profiles: colunas de privilégio só mudam por admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_protect_privileges ON public.profiles;
CREATE TRIGGER tr_profiles_protect_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_protect_privileges();

COMMENT ON FUNCTION public.profiles_protect_privileges() IS
  'BEFORE UPDATE: com JWT de não-admin, bloqueia mudança em id, email, role, active, is_admin, '
  'is_coordenador, custom_permissions, permissions, clearance_level e conta_duplicada_de. 05/09/2026.';

COMMIT;
