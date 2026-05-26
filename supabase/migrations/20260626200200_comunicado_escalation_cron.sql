-- S3.5: Automated follow-up for unconfirmed mandatory comunicados
-- pg_cron runs every 6h, creates escalation notifications with dedup
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.escalate_unconfirmed_comunicados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escalation_count integer := 0;
BEGIN
  INSERT INTO notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    p.id,
    'comunicado',
    'Leitura obrigatória pendente: ' || left(c.titulo, 60),
    format('O comunicado "%s" requer sua confirmação de leitura.',
           left(c.titulo, 60)),
    'Sistema ANEST',
    CASE
      WHEN c.prazo_confirmacao < now() THEN 'urgente'
      WHEN c.prazo_confirmacao < now() + interval '24 hours' THEN 'alta'
      ELSE 'normal'
    END,
    'comunicados', 'Ver Comunicado',
    jsonb_build_object('comunicadoId', c.id),
    false,
    'comunicado_escalation', c.id
  FROM comunicados c
  CROSS JOIN profiles p
  WHERE c.status = 'publicado'
    AND c.leitura_obrigatoria = true
    AND NOT COALESCE(c.arquivado, false)
    AND p.active IS NOT FALSE
    AND (c.destinatarios = '{}' OR c.destinatarios IS NULL OR p.role = ANY(c.destinatarios))
    -- Not yet confirmed
    AND NOT EXISTS (
      SELECT 1 FROM comunicado_confirmacoes cc
      WHERE cc.comunicado_id = c.id AND cc.user_id = p.id
    )
    -- Dedup: no escalation in last 6h for this comunicado+user
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.related_entity_type = 'comunicado_escalation'
        AND n.related_entity_id = c.id
        AND n.recipient_id = p.id
        AND n.created_at > now() - interval '6 hours'
    )
    -- Only escalate comunicados published >24h ago
    AND c.updated_at < now() - interval '24 hours'
    -- Stop escalating 7 days after publication
    AND c.updated_at > now() - interval '7 days';

  GET DIAGNOSTICS escalation_count = ROW_COUNT;
  IF escalation_count > 0 THEN
    RAISE LOG 'escalate_unconfirmed_comunicados: sent % escalation notifications', escalation_count;
  END IF;
END;
$$;

SELECT cron.schedule(
  'escalate-unconfirmed-comunicados',
  '0 */6 * * *',
  $$SELECT public.escalate_unconfirmed_comunicados()$$
);

SELECT cron.schedule(
  'cleanup-cron-history',
  '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);

COMMIT;
