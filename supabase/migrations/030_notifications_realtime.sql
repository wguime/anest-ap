-- ============================================================================
-- 030: Enable real-time for notifications table
--
-- subscribeToNotifications relies on Supabase Realtime.
-- NOTE: Already applied in production. Guarded with DO block to be idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
