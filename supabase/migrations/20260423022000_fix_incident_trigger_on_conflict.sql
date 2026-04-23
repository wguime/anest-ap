-- Corrige a função do trigger: ON CONFLICT precisa incluir o mesmo
-- predicate do partial unique index (WHERE related_entity_id IS NOT NULL).
-- Também reintroduz EXCEPTION WHEN OTHERS para robustez em produção.

CREATE OR REPLACE FUNCTION public.notify_responsaveis_on_incidente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_is_denuncia boolean := NEW.tipo = 'denuncia';
  v_subject text;
  v_content text;
  v_action_url text;
  v_entity_type text;
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
  END IF;

  INSERT INTO public.notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    p.id, 'incidente', v_subject, v_content,
    CASE WHEN v_is_denuncia THEN 'Canal de Denúncias' ELSE 'Sistema de Qualidade' END,
    'alta', v_action_url,
    CASE WHEN v_is_denuncia THEN 'Ver Denúncia' ELSE 'Ver Incidente' END,
    jsonb_build_object('protocolo', NEW.protocolo, 'incidenteId', NEW.id::text),
    true, v_entity_type, NEW.id::text
  FROM public.profiles p
  WHERE p.active IS NOT FALSE
    AND (COALESCE(p.is_admin, false) = true OR COALESCE(p.is_coordenador, false) = true OR p.role = 'coordenador')
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_responsaveis_on_incidente] falhou para %: %', NEW.protocolo, SQLERRM;
  RETURN NEW;
END;
$func$;
