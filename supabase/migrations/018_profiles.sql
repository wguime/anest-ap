-- Migration 018: User profiles, authorized emails, incident notification settings
-- Provides backend for Centro de Gestao UsersTab, EmailsTab, and IncidentsLayout

-- ──────────────────────────────────────────────
-- 1. User profiles
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id               TEXT PRIMARY KEY,  -- Firebase UID
  nome             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  role             TEXT NOT NULL DEFAULT 'colaborador'
    CHECK (role IN (
      'anestesiologista','medico-residente','enfermeiro',
      'tec-enfermagem','farmaceutico','colaborador','secretaria'
    )),
  active           BOOLEAN NOT NULL DEFAULT true,
  is_admin         BOOLEAN NOT NULL DEFAULT false,
  is_coordenador   BOOLEAN NOT NULL DEFAULT false,
  custom_permissions BOOLEAN NOT NULL DEFAULT false,
  permissions      JSONB DEFAULT '{}',
  avatar           TEXT,
  last_access      TIMESTAMPTZ,
  access_count     INTEGER NOT NULL DEFAULT 0,
  documents_accessed TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_active ON profiles(active);
CREATE INDEX idx_profiles_email ON profiles(email);

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────
-- 2. Authorized emails (pre-approve email addresses)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS authorized_emails (
  email      TEXT PRIMARY KEY,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by   TEXT NOT NULL
);

-- ──────────────────────────────────────────────
-- 3. Incident notification settings
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_notification_settings (
  user_id            TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  receber_incidentes BOOLEAN NOT NULL DEFAULT false,
  receber_denuncias  BOOLEAN NOT NULL DEFAULT false,
  categorias         TEXT[] DEFAULT '{}',
  notificar_email    BOOLEAN NOT NULL DEFAULT true,
  notificar_app      BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_incident_notif_updated_at BEFORE UPDATE ON incident_notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────
-- 4. RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_notification_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone authenticated can read, admin can write
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = id
    OR EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid()::text = id
    OR EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY profiles_delete ON profiles
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

-- Authorized emails: admin only
CREATE POLICY auth_emails_select ON authorized_emails
  FOR SELECT TO authenticated USING (true);

CREATE POLICY auth_emails_insert ON authorized_emails
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY auth_emails_delete ON authorized_emails
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

-- Incident notification settings: authenticated read, admin or self write
CREATE POLICY inc_notif_select ON incident_notification_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY inc_notif_insert ON incident_notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id
    OR EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY inc_notif_update ON incident_notification_settings
  FOR UPDATE TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY inc_notif_delete ON incident_notification_settings
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );
