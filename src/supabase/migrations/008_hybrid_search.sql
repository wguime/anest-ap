-- Hybrid search: combines pgvector cosine similarity with PostgreSQL FTS
-- Weighted combination allows finding both semantically similar and keyword-matching chunks

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 8,
  fts_weight float DEFAULT 0.3,
  vector_weight float DEFAULT 0.7
)
RETURNS TABLE (id bigint, content text, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT s.id, s.content,
           (1 - (s.embedding <=> query_embedding))::float AS score
    FROM saesp_pdf s
    WHERE 1 - (s.embedding <=> query_embedding) > match_threshold
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  fts_results AS (
    SELECT s.id, s.content,
           ts_rank(s.fts, plainto_tsquery('portuguese', query_text))::float AS score
    FROM saesp_pdf s
    WHERE s.fts @@ plainto_tsquery('portuguese', query_text)
    ORDER BY score DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT COALESCE(v.id, f.id) AS id,
           COALESCE(v.content, f.content) AS content,
           (COALESCE(v.score, 0) * vector_weight +
            COALESCE(f.score, 0) * fts_weight)::float AS similarity
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
  )
  SELECT c.id, c.content, c.similarity
  FROM combined c
  ORDER BY c.similarity DESC
  LIMIT match_count;
END;
$$;
