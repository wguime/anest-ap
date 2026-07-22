/**
 * Supabase Cirurgias Particulares Service
 *
 * CRUD de lançamentos de cobrança de cirurgias particulares.
 * Converte bidirecionalmente camelCase <-> snake_case.
 *
 * LGPD: a tabela guarda nome COMPLETO do paciente — dado de saúde SENSÍVEL
 * (art. 5º II); base legal primária art. 11, II, "d" (exercício regular de
 * direitos em contrato — ver header da migration 20260722100000). NUNCA
 * logar dados do paciente no console — apenas error.message / id.
 */
import { supabase } from '@/config/supabase'
import { toLocalISODate } from '@/utils/dateUtils'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  anestesistaNome: 'anestesista_nome',
  anestesistaUserId: 'anestesista_user_id',
  dataCirurgia: 'data_cirurgia',
  statusPagamento: 'status_pagamento',
  dataPagamento: 'data_pagamento',
  escalaCasoId: 'escala_caso_id',
  canceladaEm: 'cancelada_em',
  canceladaPor: 'cancelada_por',
  canceladaPorNome: 'cancelada_por_nome',
  motivoCancelamento: 'motivo_cancelamento',
  createdBy: 'created_by',
  createdByName: 'created_by_name',
  updatedBy: 'updated_by',
  updatedByName: 'updated_by_name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj, mapping = CAMEL_TO_SNAKE) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = mapping[key] || key
    result[snakeKey] = value
  }
  return result
}

function toCamelCase(row, mapping = SNAKE_TO_CAMEL) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map((r) => toCamelCase(r, mapping))
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = mapping[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  // LGPD: só a mensagem do erro — nunca o payload (contém nome de paciente).
  console.error(`[CirurgiasParticularesService] ${context}:`, error.message)
  throw new Error(`${context}: ${error.message}`)
}

// Coluna DATE: serializa pelo calendário local (toISOString corta em UTC e
// a leste de UTC uma meia-noite local viraria o dia anterior).
function asLocalDate(value) {
  if (!value) return null
  return value instanceof Date ? toLocalISODate(value) : value
}

// ============================================================================
// LEITURA
// ============================================================================

async function fetchAll(options = {}) {
  const { limit = 500 } = options

  const { data, error } = await supabase
    .from('cirurgias_particulares')
    .select('*')
    .order('data_cirurgia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) handleError(error, 'fetchAll')
  return (data || []).map((r) => toCamelCase(r))
}

async function fetchById(id) {
  const { data, error } = await supabase
    .from('cirurgias_particulares')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

// ============================================================================
// ESCRITA
// ============================================================================

async function create(cirurgiaData, userInfo = {}) {
  const row = {
    paciente: cirurgiaData.paciente,
    cirurgiao: cirurgiaData.cirurgiao,
    anestesista_nome: cirurgiaData.anestesistaNome,
    anestesista_user_id: cirurgiaData.anestesistaUserId || null,
    data_cirurgia: asLocalDate(cirurgiaData.dataCirurgia),
    procedimento: cirurgiaData.procedimento,
    local: cirurgiaData.local,
    valor: cirurgiaData.valor,
    status_pagamento: cirurgiaData.statusPagamento || 'pendente',
    data_pagamento: asLocalDate(cirurgiaData.dataPagamento),
    observacoes: cirurgiaData.observacoes || null,
    escala_caso_id: cirurgiaData.escalaCasoId || null,
    // Audit: user real validado em CirurgiasParticularesContext (requireUserId).
    created_by: userInfo.userId || userInfo.uid || null,
    created_by_name: userInfo.userName || userInfo.displayName || null,
  }

  const { data, error } = await supabase
    .from('cirurgias_particulares')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'create')
  return toCamelCase(data)
}

async function update(id, updates, userInfo = {}) {
  const snakeUpdates = toSnakeCase(updates)

  delete snakeUpdates.id
  delete snakeUpdates.created_at
  delete snakeUpdates.created_by
  delete snakeUpdates.created_by_name

  if ('data_cirurgia' in snakeUpdates) {
    snakeUpdates.data_cirurgia = asLocalDate(snakeUpdates.data_cirurgia)
  }
  if ('data_pagamento' in snakeUpdates) {
    snakeUpdates.data_pagamento = asLocalDate(snakeUpdates.data_pagamento)
  }

  snakeUpdates.updated_at = new Date().toISOString()
  if (userInfo.userId || userInfo.uid) {
    snakeUpdates.updated_by = userInfo.userId || userInfo.uid
  }
  if (userInfo.userName || userInfo.displayName) {
    snakeUpdates.updated_by_name = userInfo.userName || userInfo.displayName
  }

  const { data, error } = await supabase
    .from('cirurgias_particulares')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'update')
  return toCamelCase(data)
}

async function cancelar(id, motivo, userInfo = {}) {
  const now = new Date().toISOString()
  const updates = {
    cancelada_em: now,
    cancelada_por: userInfo.userId || userInfo.uid || null,
    cancelada_por_nome: userInfo.userName || userInfo.displayName || null,
    motivo_cancelamento: motivo || null,
    updated_at: now,
    updated_by: userInfo.userId || userInfo.uid || null,
    updated_by_name: userInfo.userName || userInfo.displayName || null,
  }

  const { data, error } = await supabase
    .from('cirurgias_particulares')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'cancelar')
  return toCamelCase(data)
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseCirurgiasParticularesService = {
  fetchAll,
  fetchById,
  create,
  update,
  cancelar,
}

export { toCamelCase as cirurgiaToCamelCase }

export default supabaseCirurgiasParticularesService
