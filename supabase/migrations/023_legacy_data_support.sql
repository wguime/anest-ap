-- ==========================================================================
-- 023_legacy_data_support.sql — Schema adjustments for Firestore data migration
-- Adds subcategoria index and handles legacy protocolo insertion
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Index on documentos.subcategoria for filtered queries
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_doc_subcategoria ON documentos(subcategoria);
CREATE INDEX IF NOT EXISTS idx_doc_cat_subcat ON documentos(categoria, subcategoria);

-- ──────────────────────────────────────────────
-- 2. Index on documentos.id prefix for legacy doc lookups
-- ──────────────────────────────────────────────

-- Partial index for legacy documents (id starts with 'doc-legacy-')
CREATE INDEX IF NOT EXISTS idx_doc_legacy ON documentos(id) WHERE id LIKE 'doc-legacy-%';

-- ──────────────────────────────────────────────
-- 3. Allow legacy protocolo format in incidentes
-- The v1.0 protocolo format is INC-YYYYMMDD-NNNN or similar.
-- The generate_protocolo() trigger only fires when protocolo IS NULL or '',
-- so explicit protocolo values from migration will be preserved.
-- No schema change needed — just documenting the behavior.
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- 4. Add rpc for email authorization check for anon (if not exists)
-- Already handled in 022_security_fixes.sql — no-op here.
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- 5. Ensure authorized_emails allows upsert
-- Add ON CONFLICT support by confirming PK on email
-- (already exists from 018 — no-op)
-- ──────────────────────────────────────────────
