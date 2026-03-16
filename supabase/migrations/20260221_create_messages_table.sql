-- ============================================================================
-- Migration: Create messages table for private messaging
-- Date: 2026-02-21
-- Reference: src/services/supabaseMessagesService.js
-- ============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.messages (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type              text NOT NULL DEFAULT 'private',
  subject           text NOT NULL,
  content           text NOT NULL,
  sender_id         text NOT NULL,
  sender_name       text NOT NULL DEFAULT '',
  sender_role       text DEFAULT '',
  sender_avatar     text,
  recipient_id      text NOT NULL,
  recipient_name    text NOT NULL DEFAULT '',
  priority          text NOT NULL DEFAULT 'normal',
  read_at           timestamptz,
  is_archived       boolean NOT NULL DEFAULT false,
  thread_id         text,
  parent_message_id uuid REFERENCES public.messages(id),
  attachments       jsonb DEFAULT '[]'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender    ON public.messages(sender_id);
CREATE INDEX idx_messages_thread    ON public.messages(thread_id);
CREATE INDEX idx_messages_created   ON public.messages(created_at DESC);

-- 3. Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own messages"
  ON public.messages FOR SELECT
  USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id);

CREATE POLICY "Recipients can update (mark read, archive)"
  ON public.messages FOR UPDATE
  USING (auth.uid()::text = recipient_id OR auth.uid()::text = sender_id);

CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
