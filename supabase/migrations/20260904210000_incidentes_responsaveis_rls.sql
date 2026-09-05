-- ==========================================================================
-- 20260904210000_incidentes_responsaveis_rls.sql
-- Quem vê e quem é avisado de incidentes/denúncias — decisões do dono 04/09/2026
-- (auditoria em .tmp/auditoria-denuncias-04-09/RELATORIO.md).
--
-- Antes: a RLS de `incidentes` liberava só `admin_users` (lista fixa de fev/26),
-- enquanto o Centro de Gestão deixava marcar qualquer pessoa como responsável
-- opt-in em `incident_notification_settings`. Responsável não-admin (caso da
-- coordenadora FERNANDA) recebia a notificação, abria e via a lista vazia. O
-- trigger de aviso mandava "Nova denúncia" para TODOS os admins, ignorando o
-- opt-in.
--
-- Depois:
--   1. is_incident_responsible(tipo): opt-in vivo em incident_notification_settings
--      (receber_denuncias / receber_incidentes) e perfil ativo.
--   2. Responsável opt-in passa a VER e GERIR (SELECT/UPDATE) o tipo que optou,
--      em `incidentes` e nos anexos do bucket `incidentes-anexos`. Admin segue.
--   3. Aviso in-app SÓ para responsáveis opt-in com notificar_app — nunca para
--      admin por ser admin, sem fallback (o e-mail institucional é a rede).
--   4. Fecha o INSERT direto (`inc_insert_auth` era WITH CHECK (true): qualquer
--      logado gravava user_id de terceiro). O único caminho é rpc_submit_incidente.
--   5. Remove `inc_update_own`: exigia status 'pendente', que virou 'pending' em
--      022, e nenhuma tela edita o próprio relato — nunca casava.
--   0. incident_notification_settings vira FONTE DE AUTORIZAÇÃO: só admin escreve
--      nela (antes o próprio usuário podia se marcar → auto-promoção a leitor de
--      todas as denúncias; achado do migration-validator).
--   6. Responsável não-admin gere (status, gestão interna, parecer) mas não
--      reescreve identidade/imutáveis: trigger BEFORE UPDATE.
-- Idempotente: CREATE OR REPLACE + DROP POLICY IF EXISTS antes de cada CREATE.
-- ==========================================================================

BEGIN;

-- 0. Só admin marca/desmarca responsáveis --------------------------------------
-- Quem escreve nesta tabela no app é só o Centro de Gestão (UsersManagementContext);
-- inc_notif_delete já era is_admin(). O UserContext apenas lê a própria linha.
DROP POLICY IF EXISTS inc_notif_insert ON public.incident_notification_settings;
CREATE POLICY inc_notif_insert ON public.incident_notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS inc_notif_update ON public.incident_notification_settings;
CREATE POLICY inc_notif_update ON public.incident_notification_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 1. Helper ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_incident_responsible(p_tipo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.incident_notification_settings s
      JOIN public.profiles p ON p.id = s.user_id
     WHERE s.user_id = public.firebase_uid()
       AND s.user_id <> ''
       AND p.active IS NOT FALSE
       AND CASE WHEN p_tipo = 'denuncia'
                THEN COALESCE(s.receber_denuncias, false)
                ELSE COALESCE(s.receber_incidentes, false)
           END
  );
$$;

REVOKE ALL ON FUNCTION public.is_incident_responsible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_incident_responsible(text) TO authenticated;

COMMENT ON FUNCTION public.is_incident_responsible(text) IS
  'Usuário atual é responsável opt-in pelo tipo (incident_notification_settings.receber_*), '
  'com perfil ativo. Base das policies de responsável em incidentes e incidentes-anexos.';

-- 2. incidentes: responsável vê e gere o tipo que optou ----------------------
DROP POLICY IF EXISTS "inc_select_responsavel" ON public.incidentes;
CREATE POLICY "inc_select_responsavel" ON public.incidentes
  FOR SELECT TO authenticated
  USING (public.is_incident_responsible(tipo));

DROP POLICY IF EXISTS "inc_update_responsavel" ON public.incidentes;
CREATE POLICY "inc_update_responsavel" ON public.incidentes
  FOR UPDATE TO authenticated
  USING (public.is_incident_responsible(tipo))
  WITH CHECK (public.is_incident_responsible(tipo));

-- 4. Fecha o INSERT direto — só rpc_submit_incidente (SECURITY DEFINER) insere.
DROP POLICY IF EXISTS "inc_insert_auth" ON public.incidentes;
-- 4b. Idem para anon: public/formulario-*.html usam rpc_submit_public_incident desde
--     20260228; nos logs de 7 dias não há INSERT direto anônimo. A policy só deixava
--     a anon key inserir (e disparar o trigger de aviso) por fora da RPC.
DROP POLICY IF EXISTS "inc_insert_anon" ON public.incidentes;

-- 5. Policy morta (status 'pendente' não existe mais; ninguém edita o próprio relato).
DROP POLICY IF EXISTS "inc_update_own" ON public.incidentes;

-- 2b. Anexos: responsável baixa os anexos do tipo que optou ------------------
-- A pasta do path diz o tipo: denuncias/ e denuncias-anon/ → denúncia; o resto → incidente.
DROP POLICY IF EXISTS "incidentes_anexos_select" ON storage.objects;
CREATE POLICY "incidentes_anexos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidentes-anexos'
    AND (
      public.is_admin()
      OR owner_id = (SELECT public.firebase_uid())
      OR public.is_incident_responsible(
           CASE WHEN (storage.foldername(name))[1] IN ('denuncias', 'denuncias-anon')
                THEN 'denuncia' ELSE 'incidente' END
         )
    )
  );

-- 3. Aviso in-app: só responsáveis opt-in com notificar_app ------------------
CREATE OR REPLACE FUNCTION public.notify_responsaveis_on_incidente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_denuncia boolean := (NEW.tipo = 'denuncia');
  v_subject text;
  v_content text;
  v_action_url text;
  v_entity_type text;
  v_priority text := 'alta';
  v_dismissable boolean := true;
BEGIN
  IF v_is_denuncia THEN
    v_subject := 'Nova denúncia registrada';
    v_content := format('Denúncia protocolo %s registrada — requer análise.', NEW.protocolo);
    v_action_url := 'denuncias';
    v_entity_type := 'denuncia';
  ELSE
    v_subject := 'Novo incidente registrado';
    v_content := format('Incidente protocolo %s registrado — requer análise.', NEW.protocolo);
    v_action_url := 'incidentes';
    v_entity_type := 'incidente';
    -- Regras que viviam no cliente (NovoIncidentePage) e vêm para o único escritor:
    -- grave/crítico ou Never Event = urgente e não descartável; NE leva o código no assunto.
    IF COALESCE(NEW.incidente_data ->> 'severidade', '') IN ('grave', 'critico')
       OR COALESCE(NEW.is_never_event, false) THEN
      v_priority := 'urgente';
      v_dismissable := false;
    END IF;
    IF COALESCE(NEW.is_never_event, false) AND NULLIF(NEW.never_event_code, '') IS NOT NULL THEN
      v_subject := format('[NEVER EVENT %s] %s', NEW.never_event_code, v_subject);
    END IF;
  END IF;

  -- Decisão do dono 04/09/2026: APENAS quem está marcado como responsável no
  -- Centro de Gestão (opt-in do tipo + avisar no app), seja admin ou não.
  -- Sem fallback para admins/coordenadores — o e-mail institucional é a rede.
  INSERT INTO public.notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    s.user_id,
    'incidente',
    v_subject,
    v_content,
    CASE WHEN v_is_denuncia THEN 'Canal de Denúncias' ELSE 'Sistema de Qualidade' END,
    v_priority,
    v_action_url,
    CASE WHEN v_is_denuncia THEN 'Ver Denúncia' ELSE 'Ver Incidente' END,
    jsonb_build_object('protocolo', NEW.protocolo, 'incidenteId', NEW.id::text),
    v_dismissable,
    v_entity_type,
    NEW.id::text
  FROM public.incident_notification_settings s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE p.active IS NOT FALSE
    AND COALESCE(s.notificar_app, false)
    AND CASE WHEN v_is_denuncia
             THEN COALESCE(s.receber_denuncias, false)
             ELSE COALESCE(s.receber_incidentes, false)
        END
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_responsaveis_on_incidente] falhou para %: %', NEW.protocolo, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_responsaveis_on_incidente() IS
  'AFTER INSERT em incidentes: avisa no app SÓ os responsáveis opt-in do tipo '
  '(incident_notification_settings.receber_* + notificar_app), sem fallback para admin. '
  'Único escritor dessa notificação desde 04/09/2026 (o cliente deixou de duplicar).';

-- 6. Responsável não-admin gere, não reescreve identidade ----------------------
-- Só vale quando há JWT com sub e o chamador NÃO é admin. Sem sub (service_role,
-- pg_cron, RPCs de retenção/anonimização rodando como job) a guarda não se aplica:
-- esses caminhos precisam mexer em user_id/anonymized_at/notificante.
CREATE OR REPLACE FUNCTION public.incidentes_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NULLIF(public.firebase_uid(), '') IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id         IS DISTINCT FROM OLD.user_id
     OR NEW.notificante     IS DISTINCT FROM OLD.notificante
     OR NEW.denunciante     IS DISTINCT FROM OLD.denunciante
     OR NEW.tipo            IS DISTINCT FROM OLD.tipo
     OR NEW.source          IS DISTINCT FROM OLD.source
     OR NEW.protocolo       IS DISTINCT FROM OLD.protocolo
     OR NEW.tracking_code   IS DISTINCT FROM OLD.tracking_code
     OR NEW.attachments     IS DISTINCT FROM OLD.attachments
     OR NEW.lgpd_consent_at IS DISTINCT FROM OLD.lgpd_consent_at
     OR NEW.anonymized_at   IS DISTINCT FROM OLD.anonymized_at
     OR NEW.retain_until    IS DISTINCT FROM OLD.retain_until
     OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'incidentes: responsável não altera identidade/imutáveis do relato (só admin)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_incidentes_protect_identity ON public.incidentes;
CREATE TRIGGER tr_incidentes_protect_identity
  BEFORE UPDATE ON public.incidentes
  FOR EACH ROW
  EXECUTE FUNCTION public.incidentes_protect_identity();

COMMENT ON FUNCTION public.incidentes_protect_identity() IS
  'BEFORE UPDATE: com JWT de não-admin, bloqueia mudança em user_id, notificante, denunciante, '
  'tipo, source, protocolo, tracking_code, attachments, lgpd_consent_at, anonymized_at, '
  'retain_until e created_at. Sem sub (jobs/service_role) e admin passam. 04/09/2026.';

COMMIT;
