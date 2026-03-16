-- ==========================================================================
-- 015_global_fts.sql — Global Full-Text Search across tables
-- ==========================================================================

-- 1. FTS em incidentes
ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_incidentes_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('portuguese', coalesce(NEW.protocolo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.incidente_data->>'descricao', '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.incidente_data->>'local', '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.denuncia_data->>'descricao', '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_incidentes_fts BEFORE INSERT OR UPDATE ON incidentes
  FOR EACH ROW EXECUTE FUNCTION update_incidentes_fts();

-- Backfill
UPDATE incidentes SET fts =
  setweight(to_tsvector('portuguese', coalesce(protocolo, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(incidente_data->>'descricao', '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(incidente_data->>'local', '')), 'C') ||
  setweight(to_tsvector('portuguese', coalesce(denuncia_data->>'descricao', '')), 'B');

CREATE INDEX IF NOT EXISTS idx_incidentes_fts ON incidentes USING gin(fts);

-- 2. FTS em planos_acao
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_planos_acao_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('portuguese', coalesce(NEW.titulo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.descricao, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_planos_acao_fts BEFORE INSERT OR UPDATE ON planos_acao
  FOR EACH ROW EXECUTE FUNCTION update_planos_acao_fts();

UPDATE planos_acao SET fts =
  setweight(to_tsvector('portuguese', coalesce(titulo, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(descricao, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(array_to_string(tags, ' '), '')), 'C');

CREATE INDEX IF NOT EXISTS idx_planos_acao_fts ON planos_acao USING gin(fts);

-- 3. RPC de busca global (SECURITY INVOKER = RLS respeitado)
CREATE OR REPLACE FUNCTION rpc_search_global(
  search_query text,
  filter_type text DEFAULT NULL,
  filter_status text DEFAULT NULL,
  result_limit integer DEFAULT 30
)
RETURNS TABLE (
  result_id text, result_type text, titulo text, descricao text,
  status text, categoria text, rank float,
  created_at timestamptz, updated_at timestamptz, extra jsonb
) AS $$
DECLARE
  tsq tsquery := plainto_tsquery('portuguese', search_query);
BEGIN
  RETURN QUERY
  WITH results AS (
    SELECT d.id::text, 'documento'::text, d.titulo, d.descricao, d.status,
      d.categoria, ts_rank(d.fts, tsq)::float, d.created_at, d.updated_at,
      jsonb_build_object('codigo', d.codigo, 'tipo', d.tipo, 'versao', d.versao_atual)
    FROM documentos d
    WHERE (filter_type IS NULL OR filter_type = 'documento')
      AND (filter_status IS NULL OR d.status = filter_status)
      AND (d.fts @@ tsq OR d.titulo ILIKE '%' || search_query || '%'
           OR d.codigo ILIKE '%' || search_query || '%')
    UNION ALL
    SELECT i.id::text, 'incidente'::text, i.protocolo,
      coalesce(i.incidente_data->>'descricao', i.denuncia_data->>'descricao', ''),
      i.status, i.tipo, ts_rank(i.fts, tsq)::float, i.created_at, i.updated_at,
      jsonb_build_object('tipo', i.tipo, 'tracking_code', i.tracking_code)
    FROM incidentes i
    WHERE (filter_type IS NULL OR filter_type = 'incidente')
      AND (filter_status IS NULL OR i.status = filter_status)
      AND (i.fts @@ tsq OR i.protocolo ILIKE '%' || search_query || '%')
    UNION ALL
    SELECT pa.id::text, 'plano_acao'::text, pa.titulo, pa.descricao,
      pa.status, pa.tipo_origem, ts_rank(pa.fts, tsq)::float, pa.created_at, pa.updated_at,
      jsonb_build_object('fase_pdca', pa.fase_pdca, 'prioridade', pa.prioridade,
                         'responsavel', pa.responsavel_nome)
    FROM planos_acao pa
    WHERE (filter_type IS NULL OR filter_type = 'plano_acao')
      AND (filter_status IS NULL OR pa.status = filter_status)
      AND (pa.fts @@ tsq OR pa.titulo ILIKE '%' || search_query || '%')
  )
  SELECT * FROM results r ORDER BY r.rank DESC, r.updated_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
