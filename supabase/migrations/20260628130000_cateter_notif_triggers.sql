-- ════════════════════════════════════════════════════════════════════════
-- 20260628130000_cateter_notif_triggers.sql
-- Notificações de evento do Cateter Peridural via TRIGGER (server-side).
--
-- Motivo: o INSERT em notifications feito pelo CLIENTE toma RLS 42501 e é
-- silenciado (ver 20260426233000_relax_notifications_insert_admin.sql), então
-- notificações de cateter não chegam desde 2026-04-25. Padrão comprovado no
-- repo: o que é server-side (incidente, trigger SECURITY DEFINER que bypassa
-- RLS) funciona. Espelha 20260422213000_notify_public_incidents.sql.
--
-- Eventos: novo (INSERT cateter), evolucao (INSERT followup), retirada
-- (UPDATE status ativo→retirado). relatedEntityId idêntico ao do client
-- (buildCateterNotificationPayload) → ON CONFLICT deduplica entre client e
-- trigger; o client pode continuar tentando sem duplicar.
--
-- LGPD: conteúdo nunca tem nome completo — só 2 iniciais via cateter_iniciais.
-- Idempotente (CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Helper: iniciais do paciente (espelha pacienteIniciais do JS) ──────────
CREATE OR REPLACE FUNCTION public.cateter_iniciais(nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH parts AS (
    SELECT w, ord
    FROM unnest(regexp_split_to_array(btrim(coalesce(nome, '')), '\s+'))
         WITH ORDINALITY AS t(w, ord)
    WHERE length(w) > 2
      AND lower(w) NOT IN ('de', 'da', 'do', 'das', 'dos')
  )
  SELECT upper(
    coalesce((SELECT left(w, 1) FROM parts ORDER BY ord ASC LIMIT 1), '') ||
    coalesce((SELECT left(w, 1) FROM parts ORDER BY ord DESC LIMIT 1), '')
  );
$$;

-- ── Helper: insere a notificação para os recipients clínicos ───────────────
-- Recipients = profiles ativos com papel clínico do módulo (canônicos +
-- aliases legados, espelhando getCateterRecipients/normalizeRole).
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
    AND lower(coalesce(p.role, '')) IN (
      'anestesiologista', 'medico-residente', 'anestesista', 'medico', 'residente'
    )
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;
END;
$$;

-- ── Trigger: NOVO cateter ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_cateter_notif_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini text := public.cateter_iniciais(NEW.paciente);
  v_suffix text := CASE WHEN NEW.hospital IS NOT NULL THEN ' — ' || upper(NEW.hospital) ELSE '' END;
  v_pac text := CASE WHEN v_ini <> '' THEN ' (paciente ' || v_ini || ')' ELSE '' END;
BEGIN
  PERFORM public.insert_cateter_notification(
    NEW.id,
    'Novo cateter peridural registrado',
    'Cateter peridural inserido' || v_pac || v_suffix || '.',
    'alta',
    'cateter_' || NEW.id::text || '_novo'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[tg_cateter_notif_novo] % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── Trigger: EVOLUÇÃO (followup) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_cateter_notif_evolucao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.cateteres_peridural%ROWTYPE;
  v_ini text;
  v_suffix text;
  v_pac text;
  v_po text;
BEGIN
  SELECT * INTO v_cat FROM public.cateteres_peridural WHERE id = NEW.cateter_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  v_ini := public.cateter_iniciais(v_cat.paciente);
  v_suffix := CASE WHEN v_cat.hospital IS NOT NULL THEN ' — ' || upper(v_cat.hospital) ELSE '' END;
  v_pac := CASE WHEN v_ini <> '' THEN ' (paciente ' || v_ini || ')' ELSE '' END;
  v_po := CASE WHEN NEW.dia_po IS NOT NULL THEN ' — ' || NEW.dia_po::text || 'º PO' ELSE '' END;

  PERFORM public.insert_cateter_notification(
    NEW.cateter_id,
    'Evolução de cateter peridural',
    'Nova evolução registrada para cateter' || v_pac || v_po || v_suffix || '.',
    'normal',
    'cateter_evolucao_' || NEW.id::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[tg_cateter_notif_evolucao] followup % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── Trigger: RETIRADA (status ativo→retirado) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_cateter_notif_retirada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini text := public.cateter_iniciais(NEW.paciente);
  v_suffix text := CASE WHEN NEW.hospital IS NOT NULL THEN ' — ' || upper(NEW.hospital) ELSE '' END;
  v_pac text := CASE WHEN v_ini <> '' THEN ' (paciente ' || v_ini || ')' ELSE '' END;
BEGIN
  PERFORM public.insert_cateter_notification(
    NEW.id,
    'Cateter peridural retirado',
    'Cateter peridural retirado' || v_pac || v_suffix || '.',
    'normal',
    'cateter_' || NEW.id::text || '_retirada'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[tg_cateter_notif_retirada] % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── Triggers ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_cateter_notif_novo ON public.cateteres_peridural;
CREATE TRIGGER tr_cateter_notif_novo
  AFTER INSERT ON public.cateteres_peridural
  FOR EACH ROW EXECUTE FUNCTION public.tg_cateter_notif_novo();

DROP TRIGGER IF EXISTS tr_cateter_notif_evolucao ON public.cateteres_peridural_followup;
CREATE TRIGGER tr_cateter_notif_evolucao
  AFTER INSERT ON public.cateteres_peridural_followup
  FOR EACH ROW EXECUTE FUNCTION public.tg_cateter_notif_evolucao();

DROP TRIGGER IF EXISTS tr_cateter_notif_retirada ON public.cateteres_peridural;
CREATE TRIGGER tr_cateter_notif_retirada
  AFTER UPDATE ON public.cateteres_peridural
  FOR EACH ROW
  WHEN (OLD.status = 'ativo' AND NEW.status = 'retirado')
  EXECUTE FUNCTION public.tg_cateter_notif_retirada();

GRANT EXECUTE ON FUNCTION public.cateter_iniciais(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.insert_cateter_notification(uuid, text, text, text, text) TO authenticated, anon, service_role;

COMMIT;
