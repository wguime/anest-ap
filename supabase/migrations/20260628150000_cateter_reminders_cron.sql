-- ════════════════════════════════════════════════════════════════════════
-- 20260628150000_cateter_reminders_cron.sql
-- Lembretes de cateter peridural SERVER-SIDE (pg_cron) — substitui o hook
-- cliente useCateterReminders, que tomava RLS 42501 e nunca entregava.
--
-- Dois eixos:
--  • DURAÇÃO 24/48/72/96h desde a inserção — 1x por threshold, para sempre
--    (dedup related_entity_id = cateter-reminder_<id>_<threshold>).
--  • NÃO EVOLUÍDO: horas desde a última evolução (ou inserção se nunca) ≥ 24
--    (aviso) / ≥ 36 (crítico) — janela DIÁRIA (dedup ..._<YYYY-MM-DD>): re-dispara
--    a cada dia enquanto não houver evolução; some quando o cateter é evoluído.
--
-- Recipients clínicos no SQL (SECURITY DEFINER → bypassa RLS). LGPD: só iniciais.
-- Idempotente. Depende de 20260628130000 (cateter_iniciais) e 20260628140000
-- (ultima_avaliacao_at).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper genérico de insert de lembrete (entity_type variável).
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
    AND lower(coalesce(p.role, '')) IN (
      'anestesiologista', 'medico-residente', 'anestesista', 'medico', 'residente'
    )
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
    WHERE related_entity_id IS NOT NULL
    DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cateter_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_ini text;
  v_suffix text;
  v_pac text;
  v_horas_ins numeric;
  v_horas_av numeric;
  v_today text := to_char(now(), 'YYYY-MM-DD');
BEGIN
  FOR c IN
    SELECT * FROM public.cateteres_peridural
    WHERE status = 'ativo' AND data_insercao IS NOT NULL
  LOOP
    v_ini := public.cateter_iniciais(c.paciente);
    v_suffix := CASE WHEN c.hospital IS NOT NULL THEN ' — ' || upper(c.hospital) ELSE '' END;
    v_pac := CASE WHEN v_ini <> '' THEN ' (paciente ' || v_ini || ')' ELSE '' END;
    v_horas_ins := EXTRACT(EPOCH FROM (now() - c.data_insercao)) / 3600;
    v_horas_av  := EXTRACT(EPOCH FROM (now() - coalesce(c.ultima_avaliacao_at, c.data_insercao))) / 3600;

    -- ── DURAÇÃO (1x por threshold) ──
    IF v_horas_ins >= 24 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_24h',
        'Cateter peridural ativo há 24h — registrar PO1',
        'Cateter peridural completou 24h' || v_pac || v_suffix || '. Registre a avaliação de 1º PO.',
        'normal');
    END IF;
    IF v_horas_ins >= 48 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_48h',
        'Cateter peridural ativo há 48h — registrar PO2',
        'Cateter peridural completou 48h' || v_pac || v_suffix || '. Registre a avaliação de 2º PO.',
        'normal');
    END IF;
    IF v_horas_ins >= 72 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_72h',
        'Atenção: cateter peridural com 72h ativo',
        'Cateter peridural atingiu 72h' || v_pac || v_suffix || '. Próximo do limite de 96h — planejar retirada.',
        'alta');
    END IF;
    IF v_horas_ins >= 96 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_96h',
        'CRÍTICO: cateter peridural excedeu 96h',
        'Cateter peridural excedeu 96h' || v_pac || v_suffix || '. Retirar imediatamente.',
        'urgente');
    END IF;

    -- ── NÃO EVOLUÍDO (janela diária) ──
    IF v_horas_av >= 36 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-naoevoluido',
        'cateter-naoevoluido_' || c.id::text || '_' || v_today,
        'CRÍTICO: cateter peridural sem evolução',
        'Cateter peridural sem evolução PO há ' || floor(v_horas_av)::text || 'h' || v_pac || v_suffix || '. Registrar evolução.',
        'urgente');
    ELSIF v_horas_av >= 24 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-naoevoluido',
        'cateter-naoevoluido_' || c.id::text || '_' || v_today,
        'Cateter peridural sem evolução há 24h',
        'Cateter peridural sem evolução PO há ' || floor(v_horas_av)::text || 'h' || v_pac || v_suffix || '. Registrar evolução.',
        'alta');
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public._cateter_reminder_insert(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_cateter_reminders() TO service_role;

-- Agenda diária ~07:00 BRT (10:00 UTC).
SELECT cron.schedule(
  'cateter-reminders-daily',
  '0 10 * * *',
  $$SELECT public.notify_cateter_reminders()$$
);

COMMIT;
