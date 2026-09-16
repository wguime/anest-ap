/**
 * Supabase Autoavaliacao ROP Service
 *
 * CRUD + upsert para autoavaliacoes trimestrais de ROPs Qmentum.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabasePlanosAcaoService.js.
 */
import { supabase } from '@/config/supabase'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  ropId: 'rop_id',
  ropArea: 'rop_area',
  responsavelId: 'responsavel_id',
  responsavelNome: 'responsavel_nome',
  avaliadoEm: 'avaliado_em',
  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  prazo: 'prazo',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function _toSnakeCase(obj) {
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
  console.error(`[SupabaseAutoavaliacaoService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// LEITURA
// ============================================================================

async function fetchByCiclo(ciclo) {
  const { data, error } = await supabase
    .from('autoavaliacao_rop')
    .select('*')
    .eq('ciclo', ciclo)
    .order('rop_area', { ascending: true })

  if (error) handleError(error, 'fetchByCiclo')
  return (data || []).map(toCamelCase)
}

async function fetchByArea(ciclo, area) {
  const { data, error } = await supabase
    .from('autoavaliacao_rop')
    .select('*')
    .eq('ciclo', ciclo)
    .eq('rop_area', area)
    .order('rop_id', { ascending: true })

  if (error) handleError(error, 'fetchByArea')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// ESCRITA
// ============================================================================

async function upsert(avaliacaoData, userInfo = {}) {
  const row = {
    rop_id: avaliacaoData.ropId,
    rop_area: avaliacaoData.ropArea,
    ciclo: avaliacaoData.ciclo,
    status: avaliacaoData.status || 'nao_avaliado',
    evidencias: avaliacaoData.evidencias || [],
    observacoes: avaliacaoData.observacoes || null,
    responsavel_id: avaliacaoData.responsavelId || userInfo.userId || userInfo.uid || null,
    responsavel_nome: avaliacaoData.responsavelNome || userInfo.userName || userInfo.displayName || null,
    avaliado_em: avaliacaoData.avaliadoEm || new Date().toISOString(),
    created_by: avaliacaoData.createdBy || userInfo.userId || userInfo.uid || null,
  }

  const { data, error } = await supabase
    .from('autoavaliacao_rop')
    .upsert(row, { onConflict: 'rop_id,ciclo' })
    .select()
    .single()

  if (error) handleError(error, 'upsert')
  return toCamelCase(data)
}

async function remove(id) {
  const { error } = await supabase.from('autoavaliacao_rop').delete().eq('id', id)

  if (error) handleError(error, 'remove')
  return true
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToAll(callback) {
  // Broadcast (sinal + busca por chave) pelo helper — ver supabaseSubscriptionHelper.js;
  // postgres_changes mantinha o Realtime consultando o WAL a cada 100 ms (16/09/2026).
  return createReliableSubscription({
    channelName: 'autoavaliacao-rop-changes',
    table: 'autoavaliacao_rop',
    callback: ({ eventType, new: novo, old: velho }) => {
      callback({
        eventType,
        new: novo ? toCamelCase(novo) : null,
        old: velho ? toCamelCase(velho) : null,
      })
    },
  })
}

function unsubscribe(sub) {
  if (!sub) return
  // assinatura do helper ({ cleanup }) ou canal legado do supabase-js
  if (typeof sub.cleanup === 'function') sub.cleanup()
  else supabase.removeChannel(sub)
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseAutoavaliacaoService = {
  fetchByCiclo,
  fetchByArea,
  upsert,
  remove,
  subscribeToAll,
  unsubscribe,
}

export { toCamelCase as autoavaliacaoToCamelCase }

export default supabaseAutoavaliacaoService
