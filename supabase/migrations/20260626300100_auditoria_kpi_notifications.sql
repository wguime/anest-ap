-- S4.2 + S4.3: Notificações para Auditorias (não-conformidades) e KPIs (threshold breach)
BEGIN;

-- S4.2: Trigger para auditorias finalizadas com não-conformidades
CREATE OR REPLACE FUNCTION public.notify_auditoria_nao_conformidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_nao_conformidades integer := 0;
BEGIN
  IF NEW.status != 'finalizada' OR OLD.status = 'finalizada' THEN
    RETURN NEW;
  END IF;

  -- Count non-conformities in resultados JSONB
  SELECT count(*)::integer INTO v_nao_conformidades
  FROM jsonb_array_elements(COALESCE(NEW.resultados, '[]'::jsonb)) elem
  WHERE elem->>'conforme' = 'false' OR elem->>'resultado' = 'nao_conforme';

  IF v_nao_conformidades > 0 THEN
    INSERT INTO notifications (
      recipient_id, category, subject, content, sender_name, priority,
      action_url, action_label, dismissable,
      related_entity_type, related_entity_id
    )
    SELECT
      p.id,
      'qualidade',
      format('Auditoria finalizada: %s não-conformidade(s)', v_nao_conformidades),
      format('A auditoria "%s" foi concluída com %s item(ns) não conforme(s).',
             left(COALESCE(NEW.titulo, NEW.tipo, 'Auditoria'), 50), v_nao_conformidades),
      'Sistema de Qualidade',
      CASE WHEN v_nao_conformidades >= 3 THEN 'urgente' ELSE 'alta' END,
      'auditorias',
      'Ver Auditorias',
      true,
      'auditoria',
      NEW.id::text
    FROM profiles p
    WHERE p.active IS NOT FALSE
      AND (COALESCE(p.is_admin, false) = true OR COALESCE(p.is_coordenador, false) = true)
    ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
      WHERE related_entity_id IS NOT NULL
      DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_auditoria_nao_conformidade] falhou: %', SQLERRM;
  RETURN NEW;
END;
$func$;

-- Only create trigger if auditorias_interativas table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auditorias_interativas' AND table_schema = 'public') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tr_auditoria_notify_nc ON auditorias_interativas';
    EXECUTE 'CREATE TRIGGER tr_auditoria_notify_nc AFTER UPDATE ON auditorias_interativas FOR EACH ROW EXECUTE FUNCTION notify_auditoria_nao_conformidade()';
  END IF;
END $$;

-- S4.3: KPI threshold breach alerts (daily check via pg_cron)
CREATE OR REPLACE FUNCTION public.alert_kpi_threshold_breach()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  -- Check if kpi_dados table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpi_dados' AND table_schema = 'public') THEN
    RETURN;
  END IF;

  -- Alert admins when KPIs have concerning values
  -- This is a placeholder that can be customized per KPI type
  FOR r IN
    SELECT DISTINCT k.tipo_kpi, k.valor, k.meta, k.periodo
    FROM kpi_dados k
    WHERE k.created_at > now() - interval '30 days'
      AND k.valor IS NOT NULL
      AND k.meta IS NOT NULL
      AND k.valor < k.meta * 0.7  -- Below 70% of target
    ORDER BY k.periodo DESC
    LIMIT 10
  LOOP
    INSERT INTO notifications (
      recipient_id, category, subject, content, sender_name, priority,
      action_url, action_label, dismissable,
      related_entity_type, related_entity_id
    )
    SELECT
      p.id,
      'qualidade',
      format('KPI abaixo da meta: %s', r.tipo_kpi),
      format('O indicador %s está em %.1f%% (meta: %.1f%%) no período %s.',
             r.tipo_kpi, r.valor * 100, r.meta * 100, r.periodo),
      'Sistema de Qualidade',
      'alta',
      'kpis',
      'Ver KPIs',
      true,
      'kpi_breach',
      r.tipo_kpi || '_' || r.periodo
    FROM profiles p
    WHERE p.active IS NOT FALSE
      AND COALESCE(p.is_admin, false) = true
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.related_entity_type = 'kpi_breach'
          AND n.related_entity_id = r.tipo_kpi || '_' || r.periodo
          AND n.recipient_id = p.id
      );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'alert-kpi-threshold',
  '0 9 1 * *',
  $$SELECT public.alert_kpi_threshold_breach()$$
);

COMMIT;
