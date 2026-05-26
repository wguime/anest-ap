-- S3.4: Full-text search for messages and notifications (Portuguese)
-- Pattern: trigger-based (not GENERATED ALWAYS AS), same as 007_saesp_fts.sql and 015_global_fts.sql
BEGIN;

-- Messages FTS
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_messages_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.sender_name, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_messages_fts ON messages;
CREATE TRIGGER tr_messages_fts
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_messages_fts();

UPDATE messages SET fts =
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(subject, '')), 'A') ||
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(content, '')), 'B') ||
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(sender_name, '')), 'C');

CREATE INDEX IF NOT EXISTS idx_messages_fts ON messages USING gin(fts);

-- Notifications FTS
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_notifications_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notifications_fts ON notifications;
CREATE TRIGGER tr_notifications_fts
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_notifications_fts();

UPDATE notifications SET fts =
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(subject, '')), 'A') ||
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(content, '')), 'B');

CREATE INDEX IF NOT EXISTS idx_notifications_fts ON notifications USING gin(fts);

-- Comunicados FTS
ALTER TABLE public.comunicados ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_comunicados_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.titulo, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.conteudo, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_comunicados_fts ON comunicados;
CREATE TRIGGER tr_comunicados_fts
  BEFORE INSERT OR UPDATE ON comunicados
  FOR EACH ROW EXECUTE FUNCTION update_comunicados_fts();

UPDATE comunicados SET fts =
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(titulo, '')), 'A') ||
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(conteudo, '')), 'B');

CREATE INDEX IF NOT EXISTS idx_comunicados_fts ON comunicados USING gin(fts);

COMMIT;
