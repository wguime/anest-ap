-- S3.1: Pinning (admin global) + Starring (per-user)
BEGIN;

-- Global pin on comunicados (admin-managed, visible to all)
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS pinned_by text;

CREATE INDEX IF NOT EXISTS idx_comunicados_pinned
  ON comunicados(pinned_at DESC)
  WHERE is_pinned = true;

-- Per-user starred items (messages, notifications, comunicados)
CREATE TABLE IF NOT EXISTS public.user_starred_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  item_id text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('message', 'notification', 'comunicado')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_user_starred_user ON user_starred_items(user_id);

ALTER TABLE user_starred_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY starred_select ON user_starred_items
  FOR SELECT TO authenticated
  USING (user_id = (select public.firebase_uid()));

CREATE POLICY starred_insert ON user_starred_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select public.firebase_uid()));

CREATE POLICY starred_delete ON user_starred_items
  FOR DELETE TO authenticated
  USING (user_id = (select public.firebase_uid()));

COMMIT;
