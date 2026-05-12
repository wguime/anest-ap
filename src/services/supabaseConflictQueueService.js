/**
 * Supabase Conflict Queue Service — Sprint 14b / F6.3
 *
 * CRUD + real-time subscription para `documento_conflict_queue`.
 *
 * Origem das entries: cliente IndexedDB (`offlineQueue`) ao detectar
 * 23505 / 409 no replay de uma mutation offline (state mismatch no servidor).
 * O service expõe a API para a UI de resolução (Centro de Gestão) marcar a
 * row como `resolved_last_write_wins`, `resolved_manual` ou `dismissed`.
 *
 * IMPORTANTE: as funções de resolução (`resolveLastWriteWins`, `resolveManual`,
 * `dismiss`) apenas marcam o status no Supabase — NÃO re-disparam a mutation
 * original. A re-execução do payload (quando o admin escolhe last-write-wins)
 * é responsabilidade da camada UI/hook chamadora, em iteração separada (B3).
 *
 * Padrão: camelCase API ↔ snake_case DB. Audit trail via `userInfo.uid` real.
 */

import { supabase } from '@/config/supabase'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'

// ============================================================================
// FIELD MAPPING — camelCase ↔ snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  opId: 'op_id',
  opString: 'op_string',
  userId: 'user_id',
  userName: 'user_name',
  serverState: 'server_state',
  resolvedBy: 'resolved_by',
  resolvedAt: 'resolved_at',
  resolutionNotes: 'resolution_notes',
  createdAt: 'created_at',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toCamel(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamel)
  const result = {}
  for (const [k, v] of Object.entries(row)) {
    const key = SNAKE_TO_CAMEL[k] || k
    result[key] = v
  }
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function logError(ctx, error) {
  console.error('[conflict-queue]', ctx, error)
}

function requireUserInfo(userInfo, ctx) {
  if (!userInfo || typeof userInfo !== 'object' || !userInfo.uid) {
    throw new Error(
      `[conflict-queue] ${ctx}: userInfo.uid é obrigatório (audit trail)`
    )
  }
}

// ============================================================================
// CREATE — enqueue
// ============================================================================

/**
 * Insere uma entry na fila de conflitos.
 *
 * @param {Object} params
 * @param {string} params.opId         - ID local da entry IndexedDB (correlação).
 * @param {string} params.opString     - Identificador da op (ex.: 'documento.recordAcknowledgement').
 * @param {string} params.userId       - Firebase UID do dono da op.
 * @param {string} params.userName     - displayName do usuário.
 * @param {Object} params.payload      - Payload original que o cliente tentou aplicar.
 * @param {Object|null} [params.serverState] - Snapshot do estado do servidor (debug). Default null.
 * @returns {Promise<Object>} Row inserida em camelCase.
 */
async function enqueueConflict({
  opId,
  opString,
  userId,
  userName,
  payload,
  serverState = null,
}) {
  if (!opId) throw new Error('[conflict-queue] enqueueConflict: opId obrigatório')
  if (!opString) throw new Error('[conflict-queue] enqueueConflict: opString obrigatório')
  if (!userId) throw new Error('[conflict-queue] enqueueConflict: userId obrigatório')
  if (!userName) throw new Error('[conflict-queue] enqueueConflict: userName obrigatório')
  if (!payload) throw new Error('[conflict-queue] enqueueConflict: payload obrigatório')

  const row = {
    op_id: String(opId),
    op_string: opString,
    user_id: userId,
    user_name: userName,
    payload,
    server_state: serverState,
    status: 'pending',
  }

  const { data, error } = await supabase
    .from('documento_conflict_queue')
    .insert(row)
    .select()
    .single()

  if (error) {
    logError('enqueueConflict', error)
    throw error
  }
  return toCamel(data)
}

// ============================================================================
// READ — fetchPending / fetchAll
// ============================================================================

/**
 * Retorna entries com status='pending', paginadas e (opcionalmente) filtradas.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=20]
 * @param {number} [opts.offset=0]
 * @param {string|null} [opts.opString] - Filtrar por op específico.
 * @param {string|null} [opts.userId]   - Filtrar por dono da op.
 * @returns {Promise<{ rows: Object[], total: number }>}
 */
async function fetchPending({
  limit = 20,
  offset = 0,
  opString = null,
  userId = null,
} = {}) {
  let query = supabase
    .from('documento_conflict_queue')
    .select('*', { count: 'exact' })
    .eq('status', 'pending')

  if (opString) query = query.eq('op_string', opString)
  if (userId) query = query.eq('user_id', userId)

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    logError('fetchPending', error)
    throw error
  }
  return { rows: toCamel(data || []), total: count ?? 0 }
}

/**
 * Admin geral: lista entries, opcionalmente filtrando por status.
 *
 * @param {Object} [opts]
 * @param {string|null} [opts.status] - 'pending' | 'resolved_last_write_wins' | 'resolved_manual' | 'dismissed'
 * @param {number} [opts.limit=20]
 * @param {number} [opts.offset=0]
 * @returns {Promise<{ rows: Object[], total: number }>}
 */
async function fetchAll({ status = null, limit = 20, offset = 0 } = {}) {
  let query = supabase
    .from('documento_conflict_queue')
    .select('*', { count: 'exact' })

  if (status) query = query.eq('status', status)

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    logError('fetchAll', error)
    throw error
  }
  return { rows: toCamel(data || []), total: count ?? 0 }
}

// ============================================================================
// RESOLVE — Last-Write-Wins / Manual / Dismiss
// ============================================================================

async function _updateStatus(conflictId, patch, userInfo, ctx) {
  if (!conflictId) {
    throw new Error(`[conflict-queue] ${ctx}: conflictId obrigatório`)
  }
  requireUserInfo(userInfo, ctx)

  const update = {
    ...patch,
    resolved_by: userInfo.uid,
    resolved_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('documento_conflict_queue')
    .update(update)
    .eq('id', conflictId)
    .select()
    .single()

  if (error) {
    logError(ctx, error)
    throw error
  }
  return toCamel(data)
}

/**
 * Marca o conflito como `resolved_last_write_wins`.
 *
 * IMPORTANTE: esta função apenas atualiza o status no Supabase — NÃO
 * re-tenta a mutation original. A re-execução (replay do payload com
 * estado fresco do servidor) é responsabilidade da camada chamadora
 * (UI/hook em iteração separada — Sprint 14b/Wave 3 B3).
 *
 * @param {string} conflictId
 * @param {{ uid: string, displayName?: string }} userInfo - Quem resolveu (audit).
 * @returns {Promise<Object>} Row atualizada em camelCase.
 */
async function resolveLastWriteWins(conflictId, userInfo) {
  return _updateStatus(
    conflictId,
    {
      status: 'resolved_last_write_wins',
      resolution_notes: 'Aplicado last-write-wins via botão rápido',
    },
    userInfo,
    'resolveLastWriteWins'
  )
}

/**
 * Marca o conflito como `resolved_manual` com notas detalhadas do admin.
 *
 * @param {string} conflictId
 * @param {string} resolutionNotes - Mínimo 10 caracteres (validação client-side).
 * @param {{ uid: string, displayName?: string }} userInfo
 * @returns {Promise<Object>}
 */
async function resolveManual(conflictId, resolutionNotes, userInfo) {
  if (typeof resolutionNotes !== 'string' || resolutionNotes.trim().length < 10) {
    throw new Error(
      '[conflict-queue] resolveManual: resolutionNotes deve ter >= 10 caracteres'
    )
  }
  return _updateStatus(
    conflictId,
    {
      status: 'resolved_manual',
      resolution_notes: resolutionNotes.trim(),
    },
    userInfo,
    'resolveManual'
  )
}

/**
 * Descarta o conflito (status='dismissed').
 *
 * @param {string} conflictId
 * @param {{ uid: string, displayName?: string }} userInfo
 * @returns {Promise<Object>}
 */
async function dismiss(conflictId, userInfo) {
  return _updateStatus(
    conflictId,
    {
      status: 'dismissed',
      resolution_notes: 'Descartado',
    },
    userInfo,
    'dismiss'
  )
}

// ============================================================================
// REAL-TIME — subscribeToConflicts
// ============================================================================

/**
 * Subscribe a mudanças na tabela `documento_conflict_queue` (INSERT/UPDATE/DELETE).
 * Usa `createReliableSubscription` (retry exponencial + reconnect).
 *
 * @param {(payload: { eventType: string, new: Object|null, old: Object|null }) => void} callback
 * @returns {() => void} Função de unsubscribe.
 */
function subscribeToConflicts(callback) {
  if (typeof callback !== 'function') {
    throw new Error('[conflict-queue] subscribeToConflicts: callback obrigatório')
  }

  const { cleanup } = createReliableSubscription({
    channelName: 'documento-conflict-queue-changes',
    table: 'documento_conflict_queue',
    event: '*',
    callback: ({ eventType, new: newRow, old: oldRow }) => {
      callback({
        eventType,
        new: newRow ? toCamel(newRow) : null,
        old: oldRow ? toCamel(oldRow) : null,
      })
    },
  })

  return cleanup
}

// ============================================================================
// EXPORTS
// ============================================================================

const supabaseConflictQueueService = {
  enqueueConflict,
  fetchPending,
  fetchAll,
  resolveLastWriteWins,
  resolveManual,
  dismiss,
  subscribeToConflicts,
}

export {
  enqueueConflict,
  fetchPending,
  fetchAll,
  resolveLastWriteWins,
  resolveManual,
  dismiss,
  subscribeToConflicts,
}

export default supabaseConflictQueueService
