/**
 * Supabase Relatorios Service - Gestao de Relatorios de Qualidade
 *
 * Insert + query para tabela relatorios_qualidade.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseKpiService.js
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  scoreGeral: 'score_geral',
  nivelMaturidade: 'nivel_maturidade',
  subScores: 'sub_scores',
  geradoPor: 'gerado_por',
  geradoPorUid: 'gerado_por_uid',
  geradoEm: 'gerado_em',
  createdAt: 'created_at',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key
    result[snakeKey] = value
  }
  return result
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

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[SupabaseRelatoriosService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * Registra um novo relatorio de qualidade
 * @param {Object} data - { tipo?, ciclo, scoreGeral, nivelMaturidade, subScores, geradoPor, geradoPorUid }
 * @returns {Promise<Object>} Relatorio inserido (camelCase)
 */
async function registrarRelatorio(data) {
  const row = toSnakeCase(data)

  const { data: result, error } = await supabase
    .from('relatorios_qualidade')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'registrarRelatorio')
  return toCamelCase(result)
}

/**
 * Busca relatorios de qualidade por ciclo
 * @param {string} ciclo - Ciclo do relatorio (ex: '2025-Q1')
 * @returns {Promise<Object[]>} Array de relatorios (camelCase)
 */
async function fetchRelatorios(ciclo) {
  let query = supabase
    .from('relatorios_qualidade')
    .select('*')
    .order('gerado_em', { ascending: false })

  if (ciclo) {
    query = query.eq('ciclo', ciclo)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchRelatorios')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// EXPORT
// ============================================================================

export default { registrarRelatorio, fetchRelatorios }
