-- ════════════════════════════════════════════════════════════════════════
-- 20260628160000_cateter_notif_include_admins.sql
-- Inclui ADMINS nos destinatários das notificações de cateter (evento +
-- lembretes). Antes só papéis clínicos (anestesiologista/residente) recebiam,
-- então o dono/admin não via os alertas para supervisionar. Agora admin também
-- recebe. CREATE OR REPLACE das duas funções helper (130000 e 150000) só muda
-- o WHERE dos recipients. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.insert_cateter_notification(
  p_cateter_id uuid,
  p_subject text,
  p_content text,
  p_priority text,
  p_related_entity_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    p.id, 'cateter', p_subject, p_content, 'Gestão de Cateteres', p_priority,
    'cateterDetalhe', 'Ver Cateter',
    jsonb_build_object('cateterId', p_cateter_id::text), true,
    'cateter-peridural', p_related_entity_id
  FROM public.profiles p
  WHERE p.active IS NOT FALSE
    AND (
      lower(coalesce(p.role, '')) IN (
        'anestesiologista', 'medico-residente', 'anestesista', 'medico', 'residente'
      )
      OR coalesce(p.is_admin, false) = true
    )
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._cateter_reminder_insert(
  p_cateter_id uuid,
  p_entity_type text,
  p_related_id text,
  p_subject text,
  p_content text,
  p_priority text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    p.id, 'cateter', p_subject, p_content, 'Gestão de Cateteres', p_priority,
    'cateterDetalhe', 'Ver Cateter',
    jsonb_build_object('cateterId', p_cateter_id::text), true,
    p_entity_type, p_related_id
  FROM public.profiles p
  WHERE p.active IS NOT FALSE
    AND (
      lower(coalesce(p.role, '')) IN (
        'anestesiologista', 'medico-residente', 'anestesista', 'medico', 'residente'
      )
      OR coalesce(p.is_admin, false) = true
    )
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;
END;
$$;

COMMIT;
