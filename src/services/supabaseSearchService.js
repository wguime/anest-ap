/**
 * Supabase Search Service — Global Full-Text Search
 *
 * Calls rpc_search_global() which performs FTS across
 * documentos, incidentes, and planos_acao with SECURITY INVOKER (RLS respected).
 * Converts snake_case results to camelCase for frontend compatibility.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — snake_case → camelCase
// ============================================================================

const SNAKE_TO_CAMEL = {
  result_id: 'resultId',
  result_type: 'resultType',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
}

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
  console.error(`[SupabaseSearchService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Global full-text search across documentos, incidentes, and planos_acao.
 * @param {string} query - Search query
 * @param {object} options - { type, status, limit }
 * @returns {Promise<Array>} Search results in camelCase
 */
async function searchGlobal(query, options = {}) {
  const { type, status, limit = 30 } = options

  if (!query || !query.trim()) return []

  const { data, error } = await supabase.rpc('rpc_search_global', {
    search_query: query.trim(),
    filter_type: type || null,
    filter_status: status || null,
    result_limit: limit,
  })

  if (error) handleError(error, 'searchGlobal')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseSearchService = {
  searchGlobal,
}

export default supabaseSearchService
export { searchGlobal }
