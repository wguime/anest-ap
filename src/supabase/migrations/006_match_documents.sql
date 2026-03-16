create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
    select
      s.id,
      s.content,
      1 - (s.embedding <=> query_embedding)::float as similarity
    from saesp_pdf s
    where 1 - (s.embedding <=> query_embedding) > match_threshold
    order by s.embedding <=> query_embedding
    limit match_count;
end;
$$;
