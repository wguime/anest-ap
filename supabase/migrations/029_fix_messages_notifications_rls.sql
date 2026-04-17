-- ============================================================================
-- 029: Fix messages & notifications RLS policies
--
-- Problem: RLS policies use auth.uid()::text which casts Firebase UID to UUID
--          and fails with "invalid input syntax for type uuid".
-- Fix:     Use public.firebase_uid() which reads sub claim as TEXT directly.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Create notifications table (if not exists)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id         text NOT NULL,
  category             text NOT NULL DEFAULT 'sistema',
  subject              text NOT NULL,
  content              text,
  sender_name          text DEFAULT 'Sistema ANEST',
  priority             text NOT NULL DEFAULT 'normal',
  action_url           text,
  action_label         text,
  action_params        jsonb,
  dismissable          boolean NOT NULL DEFAULT true,
  related_entity_type  text,
  related_entity_id    text,
  read_at              timestamptz,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_created   ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 2. Fix notifications RLS — use firebase_uid()
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can see own notifications" ON public.notifications;
CREATE POLICY "Users can see own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = public.firebase_uid());

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (recipient_id = public.firebase_uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (recipient_id = public.firebase_uid());

-- ──────────────────────────────────────────────
-- 3. Fix messages RLS — use firebase_uid()
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can see own messages" ON public.messages;
CREATE POLICY "Users can see own messages"
  ON public.messages FOR SELECT
  USING (sender_id = public.firebase_uid() OR recipient_id = public.firebase_uid());

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = public.firebase_uid());

DROP POLICY IF EXISTS "Recipients can update (mark read, archive)" ON public.messages;
CREATE POLICY "Recipients can update (mark read, archive)"
  ON public.messages FOR UPDATE
  USING (recipient_id = public.firebase_uid() OR sender_id = public.firebase_uid());

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (sender_id = public.firebase_uid() OR recipient_id = public.firebase_uid());

-- ──────────────────────────────────────────────
-- 4. Create increment_access_count RPC
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_access_count(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    last_access = now(),
    access_count = access_count + 1,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_access_count(text) TO authenticated;
