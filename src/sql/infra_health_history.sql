-- Migration: Create infra_health_history table for health check history
-- Retention: 90 days (cleanup handled by application)

CREATE TABLE IF NOT EXISTS infra_health_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at timestamptz DEFAULT now(),
  firebase_status text,
  supabase_status text,
  supabase_latency_ms int,
  modules_live int,
  modules_total int,
  checked_by text
);

-- RLS policy: only authenticated users can read/insert
ALTER TABLE infra_health_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read health history"
  ON infra_health_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert health history"
  ON infra_health_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete old health history"
  ON infra_health_history FOR DELETE
  TO authenticated
  USING (checked_at < now() - interval '90 days');

COMMENT ON TABLE infra_health_history IS 'Health check history with 90-day retention policy. Old records are cleaned up by the application on each check.';
