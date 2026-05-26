-- S4.1: Notificações automáticas para Planos de Ação (PDCA lifecycle)
BEGIN;

-- Trigger: notificar responsável quando status do plano muda
CREATE OR REPLACE FUNCTION public.notify_plano_acao_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_fase_label text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_fase_label := CASE NEW.status
    WHEN 'execucao'      THEN 'Execução (Do)'
    WHEN 'verificacao'   THEN 'Verificação (Check)'
    WHEN 'padronizacao'  THEN 'Padronização (Act)'
    WHEN 'concluido'     THEN 'Concluído'
    WHEN 'cancelado'     THEN 'Cancelado'
    ELSE NEW.status
  END;

  IF NEW.responsavel_id IS NOT NULL THEN
    INSERT INTO notifications (
      recipient_id, category, subject, content, sender_name, priority,
      action_url, action_label, action_params, dismissable,
      related_entity_type, related_entity_id
    ) VALUES (
      NEW.responsavel_id,
      'qualidade',
      format('Plano de Ação: %s', v_fase_label),
      format('O plano "%s" avançou para a fase %s.', left(NEW.titulo, 60), v_fase_label),
      'Sistema PDCA',
      CASE WHEN NEW.status IN ('cancelado') THEN 'alta' ELSE 'normal' END,
      'planoAcaoDetalhe',
      'Ver Plano',
      jsonb_build_object('planoId', NEW.id::text),
      true,
      'plano_acao',
      NEW.id::text
    )
    ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
      WHERE related_entity_id IS NOT NULL
      DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_plano_acao_status] falhou para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS tr_planos_acao_notify_status ON planos_acao;
CREATE TRIGGER tr_planos_acao_notify_status
  AFTER UPDATE ON planos_acao
  FOR EACH ROW
  EXECUTE FUNCTION notify_plano_acao_status_change();

-- pg_cron: alertar responsáveis quando prazo está chegando (3 dias antes)
CREATE OR REPLACE FUNCTION public.alert_plano_acao_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (
    recipient_id, category, subject, content, sender_name, priority,
    action_url, action_label, action_params, dismissable,
    related_entity_type, related_entity_id
  )
  SELECT
    p.responsavel_id,
    'qualidade',
    'Prazo próximo: ' || left(p.titulo, 50),
    format('O plano de ação "%s" vence em %s.',
           left(p.titulo, 50),
           to_char(p.prazo, 'DD/MM/YYYY')),
    'Sistema PDCA',
    CASE WHEN p.prazo < now() THEN 'urgente' ELSE 'alta' END,
    'planoAcaoDetalhe',
    'Ver Plano',
    jsonb_build_object('planoId', p.id::text),
    true,
    'plano_acao_deadline',
    p.id::text
  FROM planos_acao p
  WHERE p.responsavel_id IS NOT NULL
    AND p.status NOT IN ('concluido', 'cancelado')
    AND p.prazo IS NOT NULL
    AND p.prazo BETWEEN now() - interval '1 day' AND now() + interval '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.related_entity_type = 'plano_acao_deadline'
        AND n.related_entity_id = p.id::text
        AND n.recipient_id = p.responsavel_id
        AND n.created_at > now() - interval '24 hours'
    );
END;
$$;

SELECT cron.schedule(
  'alert-plano-acao-deadline',
  '0 8 * * *',
  $$SELECT public.alert_plano_acao_deadline()$$
);

COMMIT;
