-- Cria o UNIQUE INDEX sem o wrapper IF NOT EXISTS + DO $$, assim se houver
-- duplicatas o erro fica explícito.
CREATE UNIQUE INDEX uniq_notifications_entity_recipient
  ON public.notifications (related_entity_type, related_entity_id, recipient_id)
  WHERE related_entity_id IS NOT NULL;
