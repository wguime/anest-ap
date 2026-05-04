/**
 * Supabase UpToDate Service — Atualizações UpToDate (Anestesiologia).
 *
 * Apenas leitura: a escrita acontece exclusivamente na Edge Function
 * `ingest-uptodate`, chamada pelo scraper externo (GitHub Actions).
 * RLS impede mutações via cliente autenticado (service_role bypassa RLS).
 *
 * Converte bidirecionalmente camelCase ↔ snake_case.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING
// ============================================================================

const CAMEL_TO_SNAKE = {
  resumoHtml: 'resumo_html',
  resumoTexto: 'resumo_texto',
  topicId: 'topic_id',
  fonteUrl: 'fonte_url',
  tituloNorm: 'titulo_norm',
  dedupHash: 'dedup_hash',
  publicadoEm: 'publicado_em',
  fetchedAt: 'fetched_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  isFeatured: 'is_featured',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k]),
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
    console.warn(`[SupabaseUptodateService] ${context}: tabela não encontrada. Skipping.`)
    return 'TABLE_NOT_FOUND'
  }
  console.error(`[SupabaseUptodateService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// SLIM SELECT — economiza tráfego para listagens (sem resumo_html, sem texto)
// ============================================================================

const LIST_COLUMNS = [
  'id', 'titulo', 'resumo_texto', 'topic_id', 'fonte_url',
  'categoria', 'secao', 'publicado_em', 'is_featured',
].join(', ')

// ============================================================================
// LEITURA
// ============================================================================

async function fetchLatest(options = {}) {
  const { limit = 50 } = options
  const { data, error } = await supabase
    .from('uptodate_topics')
    .select(LIST_COLUMNS)
    .order('publicado_em', { ascending: false })
    .limit(limit)
  if (error) {
    if (handleError(error, 'fetchLatest') === 'TABLE_NOT_FOUND') return []
  }
  return (data || []).map(toCamelCase)
}

async function fetchFeatured(options = {}) {
  const { limit = 10 } = options
  const { data, error } = await supabase
    .from('uptodate_topics')
    .select(LIST_COLUMNS)
    .eq('is_featured', true)
    .order('publicado_em', { ascending: false })
    .limit(limit)
  if (error) {
    if (handleError(error, 'fetchFeatured') === 'TABLE_NOT_FOUND') return []
  }
  return (data || []).map(toCamelCase)
}

async function fetchById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('uptodate_topics')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (handleError(error, 'fetchById') === 'TABLE_NOT_FOUND') return null
  }
  return data ? toCamelCase(data) : null
}

const supabaseUptodateService = {
  fetchLatest,
  fetchFeatured,
  fetchById,
}

export default supabaseUptodateService
export { fetchLatest, fetchFeatured, fetchById }
