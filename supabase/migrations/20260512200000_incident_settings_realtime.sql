-- ============================================================================
-- 20260512200000_incident_settings_realtime.sql
-- ----------------------------------------------------------------------------
-- Habilita realtime para `incident_notification_settings` para que, quando um
-- admin desliga `receber_incidentes`/`receber_denuncias` de um usuário, o
-- cliente desse usuário detecte a mudança IMEDIATAMENTE e perca acesso à área
-- Centro de Gestão > Incidentes (ao invés de só sentir a mudança no próximo
-- login).
--
-- REPLICA IDENTITY FULL é necessária para que eventos DELETE incluam `old`
-- (precisamos do user_id para o cliente saber se o DELETE é dele).
--
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral.
-- ============================================================================

DO $$
BEGIN
  -- Adiciona a tabela à publicação se ainda não estiver
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'incident_notification_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_notification_settings;
  END IF;
END $$;

-- Garante que eventos DELETE incluam todas as colunas antigas (não só PK)
ALTER TABLE public.incident_notification_settings REPLICA IDENTITY FULL;
