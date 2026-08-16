/**
 * Supabase Noticias Service — Central de Notícias de Anestesiologia
 *
 * Apenas leitura: a escrita acontece exclusivamente nas Edge Functions
 * `fetch-noticias` e `translate-noticias` (executadas por pg_cron).
 * RLS impede mutações via cliente autenticado (service_role bypassa RLS).
 *
 * Converte bidirecionalmente camelCase ↔ snake_case.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING
// ============================================================================

const CAMEL_TO_SNAKE = {
  tituloPt: 'titulo_pt',
  resumoPt: 'resumo_pt',
  fonteUrl: 'fonte_url',
  rawUrl: 'raw_url',
  externalId: 'external_id',
  dedupHash: 'dedup_hash',
  tituloNorm: 'titulo_norm',
  publicadoEm: 'publicado_em',
  fetchedAt: 'fetched_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  fontesExtras: 'fontes_extras',
  // Tradução
  translationProvider: 'translation_provider',
  // OA enrichment
  isOpenAccess: 'is_open_access',
  oaPdfUrl: 'oa_pdf_url',
  oaProvider: 'oa_provider',
  pmcId: 'pmc_id',
  fullTextUrl: 'full_text_url',
  pubmedUrl: 'pubmed_url',
  abstractEnrichedAt: 'abstract_enriched_at',
  // PubMed metadata
  journalIssn: 'journal_issn',
  articleType: 'article_type',
  meshTerms: 'mesh_terms',
  // Scoring
  citationCount: 'citation_count',
  citationVelocity: 'citation_velocity',
  altmetricScore: 'altmetric_score',
  altmetricPercentile: 'altmetric_percentile',
  articleTypeScore: 'article_type_score',
  editorialHighlightScore: 'editorial_highlight_score',
  recencyScore: 'recency_score',
  finalScore: 'final_score',
  isFeatured: 'is_featured',
  scoresUpdatedAt: 'scores_updated_at',
  // Curadoria (destaque fixo por período, ex.: Dr. Humberto Hepp)
  curadoriaPor: 'curadoria_por',
  curadoriaDestaqueAte: 'curadoria_destaque_ate',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

function handleError(error, context) {
  if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
    console.warn(`[SupabaseNoticiasService] ${context}: tabela não encontrada. Skipping.`)
    return 'TABLE_NOT_FOUND'
  }
  console.error(`[SupabaseNoticiasService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// SLIM SELECT — economiza tráfego para listagens
// ============================================================================

const LIST_COLUMNS = [
  'id', 'fonte', 'titulo', 'titulo_pt', 'resumo', 'resumo_pt', 'autores',
  'publicado_em', 'idioma', 'article_type', 'final_score', 'is_featured',
  'oa_pdf_url', 'pmc_id', 'category', 'journal_issn', 'fontes_extras',
  'raw_url', 'fonte_url', 'doi', 'pmid',
  'curadoria_por', 'curadoria_destaque_ate',
].join(', ')

// ============================================================================
// LEITURA
// ============================================================================

async function fetchLatest(options = {}) {
  const { limit = 200, fontes = null, category = null } = options

  let query = supabase
    .from('noticias')
    .select(LIST_COLUMNS)
    .order('publicado_em', { ascending: false })
    .limit(limit)

  if (Array.isArray(fontes) && fontes.length > 0) {
    query = query.in('fonte', fontes)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) {
    if (handleError(error, 'fetchLatest') === 'TABLE_NOT_FOUND') return []
  }
  return (data || []).map(toCamelCase)
}

async function fetchHighlights(options = {}) {
  const { limit = 10 } = options

  // Curadoria ativa entra SEMPRE, mesmo com score baixo — o top-N por score
  // sozinho deixaria o artigo curado de fora do carrossel.
  const [topRes, curadosRes] = await Promise.all([
    supabase
      .from('noticias')
      .select(LIST_COLUMNS)
      .order('final_score', { ascending: false, nullsFirst: false })
      .order('publicado_em', { ascending: false })
      .limit(limit),
    supabase
      .from('noticias')
      .select(LIST_COLUMNS)
      .gt('curadoria_destaque_ate', new Date().toISOString())
      .order('publicado_em', { ascending: false })
      .limit(limit),
  ])

  if (topRes.error) {
    if (handleError(topRes.error, 'fetchHighlights') === 'TABLE_NOT_FOUND') return []
  }
  // Coluna de curadoria ainda ausente (migration não aplicada) não pode
  // derrubar os destaques normais — degrada para o top por score.
  const curados = curadosRes.error ? [] : (curadosRes.data || [])

  const vistos = new Set(curados.map((n) => n.id))
  const merged = [
    ...curados,
    ...(topRes.data || []).filter((n) => !vistos.has(n.id)),
  ].slice(0, limit)
  return merged.map(toCamelCase)
}

async function fetchByCategory(category, options = {}) {
  const { limit = 30 } = options
  const { data, error } = await supabase
    .from('noticias')
    .select(LIST_COLUMNS)
    .eq('category', category)
    .order('final_score', { ascending: false, nullsFirst: false })
    .order('publicado_em', { ascending: false })
    .limit(limit)
  if (error) {
    if (handleError(error, 'fetchByCategory') === 'TABLE_NOT_FOUND') return []
  }
  return (data || []).map(toCamelCase)
}

async function fetchById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('noticias')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (handleError(error, 'fetchById') === 'TABLE_NOT_FOUND') return null
  }
  return data ? toCamelCase(data) : null
}

const supabaseNoticiasService = {
  fetchLatest,
  fetchHighlights,
  fetchByCategory,
  fetchById,
}

export default supabaseNoticiasService
export { fetchLatest, fetchHighlights, fetchByCategory, fetchById }
