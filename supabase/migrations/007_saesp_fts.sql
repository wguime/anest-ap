-- Full-Text Search (FTS) support for saesp_pdf table
-- Enables keyword-based search in Portuguese alongside vector search

-- Add FTS column
ALTER TABLE saesp_pdf ADD COLUMN IF NOT EXISTS fts tsvector;

-- Trigger to keep FTS column updated on insert/update
CREATE OR REPLACE FUNCTION saesp_pdf_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saesp_pdf_fts ON saesp_pdf;
CREATE TRIGGER trg_saesp_pdf_fts
  BEFORE INSERT OR UPDATE ON saesp_pdf
  FOR EACH ROW EXECUTE FUNCTION saesp_pdf_fts_trigger();

-- Backfill existing rows
UPDATE saesp_pdf SET fts = to_tsvector('portuguese', COALESCE(content, ''));

-- GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_saesp_pdf_fts ON saesp_pdf USING gin(fts);
