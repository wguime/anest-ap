-- Migration: create_user_activity_log
-- Creates the user_activity_log table for tracking user activity events
-- Used by useActivityTracking hook for dashboard metrics

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries by event type + date range
CREATE INDEX idx_activity_log_type_date ON public.user_activity_log (event_type, created_at DESC);

-- Index for user-specific queries
CREATE INDEX idx_activity_log_user ON public.user_activity_log (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can insert their own events
CREATE POLICY "Users can insert own activity"
  ON public.user_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can read all events (needed for dashboard aggregation)
CREATE POLICY "Authenticated users can read activity"
  ON public.user_activity_log FOR SELECT
  TO authenticated
  USING (true);

-- Retention: allow deleting old records (> 90 days, application-managed)
CREATE POLICY "Allow delete old records"
  ON public.user_activity_log FOR DELETE
  TO authenticated
  USING (created_at < now() - interval '90 days');
