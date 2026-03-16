/**
 * Supabase KPI Service - Gestão de Dados Mensais dos KPIs
 *
 * CRUD completo + validação + real-time subscriptions.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrão de supabaseIncidentsService.js
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  indicadorId: 'indicador_id',
  numerador: 'numerador',
  denominador: 'denominador',
  observacao: 'observacao',
  fonte: 'fonte',
  coletadoPor: 'coletado_por',
  coletadoPorNome: 'coletado_por_nome',
  validado: 'validado',
  validadoPor: 'validado_por',
  validadoPorNome: 'validado_por_nome',
  validadoEm: 'validado_em',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
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
  console.error(`[SupabaseKpiService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Busca dados mensais dos KPIs
 * @param {Object} options - { indicadorId?, ano?, limit? }
 * @returns {Promise<Object[]>} Array de dados mensais
 */
async function fetchKpiData(options = {}) {
  const { indicadorId, ano, limit = 500 } = options

  let query = supabase
    .from('kpi_dados_mensais')
    .select('*')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
    .limit(limit)

  if (indicadorId) {
    query = query.eq('indicador_id', indicadorId)
  }

  if (ano) {
    query = query.eq('ano', ano)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchKpiData')
  return (data || []).map(toCamelCase)
}

/**
 * Busca histórico multi-ano de um indicador
 * @param {string} indicadorId - ID do indicador
 * @param {number[]} anos - Array de anos (ex: [2024, 2025])
 * @returns {Promise<Object[]>} Array de dados históricos
 */
async function fetchKpiHistory(indicadorId, anos = [2025]) {
  if (!indicadorId) {
    throw new Error('indicadorId é obrigatório')
  }

  let query = supabase
    .from('kpi_dados_mensais')
    .select('*')
    .eq('indicador_id', indicadorId)
    .in('ano', anos)
    .order('ano', { ascending: true })
    .order('mes', { ascending: true })

  const { data, error } = await query
  if (error) handleError(error, 'fetchKpiHistory')
  return (data || []).map(toCamelCase)
}

/**
 * Busca dado específico por ID
 * @param {string} id - ID do registro
 * @returns {Promise<Object>} Dado mensal
 */
async function fetchById(id) {
  const { data, error } = await supabase
    .from('kpi_dados_mensais')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Insere ou atualiza dado mensal (upsert)
 * Usa unique constraint (indicador_id, ano, mes) para detectar duplicatas
 *
 * @param {Object} data - { indicadorId, ano, mes, valor, numerador, denominador, ... }
 * @returns {Promise<Object>} Dado inserido/atualizado
 */
async function upsertKpiDado(data) {
  if (!data.indicadorId || !data.ano || !data.mes || data.valor == null) {
    throw new Error('Campos obrigatórios: indicadorId, ano, mes, valor')
  }

  const row = toSnakeCase({
    indicadorId: data.indicadorId,
    ano: data.ano,
    mes: data.mes,
    valor: data.valor,
    numerador: data.numerador ?? null,
    denominador: data.denominador ?? null,
    observacao: data.observacao ?? null,
    fonte: data.fonte ?? null,
    coletadoPor: data.coletadoPor ?? null,
    coletadoPorNome: data.coletadoPorNome ?? null,
    validado: data.validado ?? false,
    validadoPor: data.validadoPor ?? null,
    validadoPorNome: data.validadoPorNome ?? null,
    validadoEm: data.validadoEm ?? null,
  })

  // Upsert usando unique constraint (indicador_id, ano, mes)
  const { data: result, error } = await supabase
    .from('kpi_dados_mensais')
    .upsert(row, {
      onConflict: 'indicador_id,ano,mes',
      returning: 'representation',
    })
    .select()
    .single()

  if (error) handleError(error, 'upsertKpiDado')
  return toCamelCase(result)
}

/**
 * Valida dado mensal (marca como validado)
 * @param {string} id - ID do registro
 * @param {Object} validadorInfo - { uid, nome }
 * @returns {Promise<Object>} Dado atualizado
 */
async function validateKpiDado(id, validadorInfo) {
  if (!id) {
    throw new Error('ID é obrigatório')
  }

  const { data, error } = await supabase
    .from('kpi_dados_mensais')
    .update({
      validado: true,
      validado_por: validadorInfo.uid || null,
      validado_por_nome: validadorInfo.nome || null,
      validado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'validateKpiDado')
  return toCamelCase(data)
}

/**
 * Deleta dado mensal
 * @param {string} id - ID do registro
 * @returns {Promise<boolean>} true se deletado com sucesso
 */
async function deleteKpiDado(id) {
  if (!id) {
    throw new Error('ID é obrigatório')
  }

  const { error } = await supabase
    .from('kpi_dados_mensais')
    .delete()
    .eq('id', id)

  if (error) handleError(error, 'deleteKpiDado')
  return true
}

// ============================================================================
// REAL-TIME
// ============================================================================

/**
 * Subscribe to KPI data changes
 * @param {Function} callback - (payload) => void
 * @returns {Object} Supabase channel (use with unsubscribe)
 */
function subscribeToKpiChanges(callback) {
  const channel = supabase
    .channel('kpi-dados-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kpi_dados_mensais' },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: payload.new ? toCamelCase(payload.new) : null,
          old: payload.old ? toCamelCase(payload.old) : null,
        })
      }
    )
    .subscribe()

  return channel
}

/**
 * Unsubscribe from real-time channel
 * @param {Object} channel - Supabase channel object
 */
function unsubscribe(channel) {
  if (channel) {
    supabase.removeChannel(channel)
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseKpiService = {
  // Leitura
  fetchKpiData,
  fetchKpiHistory,
  fetchById,

  // Escrita
  upsertKpiDado,
  validateKpiDado,
  deleteKpiDado,

  // Real-time
  subscribeToKpiChanges,
  unsubscribe,
}

export default supabaseKpiService
