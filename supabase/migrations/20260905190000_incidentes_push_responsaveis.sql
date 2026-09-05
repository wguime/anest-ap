-- ==========================================================================
-- 20260905190000_incidentes_push_responsaveis.sql
-- O aviso de relato novo volta a chegar no CELULAR do responsável.
--
-- Regressão introduzida em 04/09 (migration 20260904210000): a notificação
-- in-app saiu do cliente e virou trigger no banco — mas o push era disparado
-- pelo MESMO caminho do cliente (`createNotificationBatch` →
-- `sendPushBestEffort` → edge `send-fcm-push`). Com a notificação nascendo no
-- banco, o push deixou de sair: quem não abrisse o app não ficava sabendo.
-- O cliente também não pode mais montar a lista (só admin/responsável lê
-- `incident_notification_settings`), então o disparo passa a ser do servidor,
-- no mesmo padrão dos crons: vault (`edge_fn_service_role`) + pg_net.
--
-- Push é BEST-EFFORT por desenho (metade do grupo não opta; iPhone só tem token
-- com o app instalado na tela de início). A fonte da verdade continua sendo a
-- tela; net.http_post é assíncrono e não segura o INSERT do relato.
-- LGPD: o texto é o mesmo da notificação in-app — protocolo e nada mais. Nunca
-- descrição, nome ou dado de paciente: isso aparece na tela BLOQUEADA.
-- Idempotente: CREATE OR REPLACE da função do trigger já existente.
-- ==========================================================================

BEGIN;

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
  v_recipients text[];
  v_key text;
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
  SELECT array_agg(s.user_id ORDER BY s.user_id)
    INTO v_recipients
    FROM public.incident_notification_settings s
    JOIN public.profiles p ON p.id = s.user_id
   WHERE p.active IS NOT FALSE
     AND COALESCE(s.notificar_app, false)
     AND CASE WHEN v_is_denuncia
              THEN COALESCE(s.receber_denuncias, false)
              ELSE COALESCE(s.receber_incidentes, false)
         END;

  IF v_recipients IS NULL OR cardinality(v_recipients) = 0 THEN
    RAISE WARNING '[notify_responsaveis_on_incidente] %: nenhum responsável marcado — ninguém avisado', NEW.protocolo;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    uid,
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
  FROM unnest(v_recipients) AS uid
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;

  -- Push (tela bloqueada) — mesmo texto da notificação in-app. Assíncrono:
  -- net.http_post enfileira e devolve na hora, sem segurar o INSERT do relato.
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name = 'edge_fn_service_role'
   LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING '[notify_responsaveis_on_incidente] %: vault edge_fn_service_role ausente — sem push', NEW.protocolo;
  ELSE
    PERFORM net.http_post(
      url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'userIds', to_jsonb(v_recipients),
        'title', v_subject,
        'body', v_content,
        'data', jsonb_build_object(
          'url', v_action_url,
          'category', 'incidente',
          'entityId', NEW.id::text
        ),
        'priority', CASE WHEN v_priority IN ('urgente', 'alta') THEN 'high' ELSE 'normal' END
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_responsaveis_on_incidente] falhou para %: %', NEW.protocolo, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_responsaveis_on_incidente() IS
  'AFTER INSERT em incidentes: avisa SÓ os responsáveis opt-in do tipo '
  '(incident_notification_settings.receber_* + notificar_app) — in-app e push '
  '(pg_net → send-fcm-push, service_role do vault). Sem fallback para admin. 05/09/2026.';

COMMIT;
