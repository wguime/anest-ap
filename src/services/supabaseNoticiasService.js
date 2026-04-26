/**
 * Supabase Noticias Service — Central de Notícias de Anestesiologia
 *
 * Apenas leitura: a escrita acontece exclusivamente na Edge Function
 * `fetch-noticias` (executada por pg_cron). RLS impede mutações via cliente
 * autenticado (service_role bypassa RLS).
 *
 * Converte bidirecionalmente camelCase ↔ snake_case.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING
// ============================================================================

const CAMEL_TO_SNAKE = {
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
  console.error(`[SupabaseNoticiasService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// LEITURA
// ============================================================================

async function fetchLatest(options = {}) {
  const { limit = 30, fontes = null, categoria = null } = options

  let query = supabase
    .from('noticias')
    .select('*')
    .order('publicado_em', { ascending: false })
    .limit(limit)

  if (Array.isArray(fontes) && fontes.length > 0) {
    query = query.in('fonte', fontes)
  }
  if (categoria) {
    query = query.eq('categoria', categoria)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchLatest')
  return (data || []).map(toCamelCase)
}

async function fetchHighlights(options = {}) {
  const { limit = 5 } = options
  const { data, error } = await supabase
    .from('noticias')
    .select('*')
    .order('publicado_em', { ascending: false })
    .limit(limit)
  if (error) handleError(error, 'fetchHighlights')
  return (data || []).map(toCamelCase)
}

async function fetchById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('noticias')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) handleError(error, 'fetchById')
  return data ? toCamelCase(data) : null
}

async function fetchByCategoria(categoria, options = {}) {
  const { limit = 30 } = options
  const { data, error } = await supabase
    .from('noticias')
    .select('*')
    .eq('categoria', categoria)
    .order('publicado_em', { ascending: false })
    .limit(limit)
  if (error) handleError(error, 'fetchByCategoria')
  return (data || []).map(toCamelCase)
}

async function fetchSources() {
  const { data, error } = await supabase
    .from('noticias')
    .select('fonte')
    .order('fonte', { ascending: true })
  if (error) handleError(error, 'fetchSources')
  const set = new Set((data || []).map((r) => r.fonte).filter(Boolean))
  return Array.from(set).sort()
}

const supabaseNoticiasService = {
  fetchLatest,
  fetchHighlights,
  fetchById,
  fetchByCategoria,
  fetchSources,
}

export default supabaseNoticiasService
export { fetchLatest, fetchHighlights, fetchById, fetchByCategoria, fetchSources }
