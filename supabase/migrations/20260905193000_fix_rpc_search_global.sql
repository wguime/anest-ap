-- ==========================================================================
-- 20260905193000_fix_rpc_search_global.sql
-- A busca global do app volta a funcionar.
--
-- Sintoma (auditoria 05/09/2026): QUALQUER chamada a rpc_search_global falhava
-- com `42809: WITHIN GROUP is required for ordered-set aggregate rank` — a
-- busca global (SearchResultsPage → supabaseSearchService.searchGlobal) estava
-- morta para todo mundo, inclusive postgres.
--
-- Causa: as colunas do CTE `results` não tinham apelido, então a 7ª coluna
-- herdava o nome `ts_rank` do primeiro ramo do UNION. Como `r.rank` não existia
-- na relação, o parser caía na notação alternativa `r.rank` ≡ `rank(r)` e
-- esbarrava no agregado de conjunto ordenado `rank()`, que exige WITHIN GROUP.
--
-- Correção: apelidos explícitos no CTE e projeção coluna a coluna. O nome
-- `rank_score` evita de vez a colisão com a coluna OUT `rank` do RETURNS TABLE
-- (o contrato de saída não muda: RETURN QUERY casa por posição e tipo).
--
-- Mantém SECURITY INVOKER: a busca respeita a RLS de cada tabela — em
-- `incidentes` isso significa que só responsáveis marcados enxergam relatos.
-- Idempotente: CREATE OR REPLACE, mesma assinatura.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.rpc_search_global(
  search_query text,
  filter_type text DEFAULT NULL::text,
  filter_status text DEFAULT NULL::text,
  result_limit integer DEFAULT 30
)
RETURNS TABLE(
  result_id text, result_type text, titulo text, descricao text, status text,
  categoria text, rank double precision, created_at timestamp with time zone,
  updated_at timestamp with time zone, extra jsonb
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  tsq tsquery := plainto_tsquery('portuguese', search_query);
BEGIN
  RETURN QUERY
  WITH results (
    result_id, result_type, titulo, descricao, status,
    categoria, rank_score, created_at, updated_at, extra
  ) AS (
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
  SELECT r.result_id, r.result_type, r.titulo, r.descricao, r.status,
         r.categoria, r.rank_score, r.created_at, r.updated_at, r.extra
  FROM results r
  ORDER BY r.rank_score DESC, r.updated_at DESC
  LIMIT result_limit;
END;
$function$;

COMMENT ON FUNCTION public.rpc_search_global(text, text, text, integer) IS
  'Busca global (documentos, incidentes, planos de ação). SECURITY INVOKER: '
  'respeita a RLS de cada tabela. Colunas do CTE apelidadas — sem apelido, '
  'r.rank virava a chamada do agregado rank() e a busca inteira falhava (05/09/2026).';
