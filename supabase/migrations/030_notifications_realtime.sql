-- ============================================================================
-- 030: Enable real-time for notifications table
--
-- subscribeToNotifications relies on Supabase Realtime but the notifications
-- table was never added to the publication.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
