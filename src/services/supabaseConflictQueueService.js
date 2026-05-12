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
 * Resolução:
 *   - `resolveLastWriteWins`     — só marca status (legacy F6.3).
 *   - `resolveLastWriteWinsWithReplay` — Sprint 15a: replay real da mutation
 *     via `conflictReplayRegistry` antes de marcar resolvido. Com fallback
 *     para o caminho legacy quando `op_string` não tem handler registrado.
 *   - `resolveManual` / `dismiss` — admin escreve nota / descarta.
 *
 * Padrão: camelCase API ↔ snake_case DB. Audit trail via `userInfo.uid` real.
 */

import { supabase } from '@/config/supabase'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import {
  getReplayHandler,
  hasReplayHandler,
} from '@/services/conflictReplayRegistry'
import { notifyUser } from '@/services/notificationService'

// ============================================================================
// REPLAY ERROR
// ============================================================================

/**
 * Erro emitido quando o replay handler falha durante
 * `resolveLastWriteWinsWithReplay`. Preserva o erro original para a UI
 * distinguir falha de replay (mutation rejeitada) vs falha de update do
 * status da própria row de conflito (problema no Supabase).
 */
export class ReplayFailedError extends Error {
  constructor(originalError, opString) {
    const baseMsg =
      originalError instanceof Error
        ? originalError.message
        : String(originalError)
    super(`Replay falhou para op "${opString}": ${baseMsg}`)
    this.name = 'ReplayFailedError'
    this.originalError = originalError
    this.opString = opString
  }
}

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
// NOTIFY USER ORIGEM — best-effort, non-blocking
// ============================================================================

/**
 * Notifica o user que originou a op offline sobre o desfecho do conflito.
 *
 * LGPD: o `content` contém APENAS metadata (status humano + admin + notes).
 * NUNCA inclui `payload` (dados originais da mutation) ou `server_state`
 * (snapshot do servidor) — esses ficam restritos ao painel admin.
 *
 * Non-blocking: falha de notificação é logada como warning e a resolução
 * do conflito continua normalmente. Notify nunca trava o admin.
 *
 * `category` usado: `'conflict_resolution'` (catálogo em
 * `NOTIFICATION_CATEGORIES` — MessagesContext.jsx). A coluna
 * `notifications.category` é `text` livre (CHECK foi removida em
 * `20260424120000_notifications_relax_category_check.sql`); a validação
 * é app-side, então basta o catálogo conter a chave.
 *
 * @param {Object} conflictRow - Row já em camelCase (após _updateStatus retorno).
 * @param {string} humanResolution - Texto curto para o user (ex.: "resolvido com replay").
 * @param {{ uid: string, displayName?: string }} userInfo - Admin que resolveu.
 */
async function _notifyConflictResolution(conflictRow, humanResolution, userInfo) {
  try {
    const targetUserId = conflictRow?.userId
    if (!targetUserId) {
      // Sem destinatário (caso defensivo) — não tenta enviar.
      return
    }
    const adminName = userInfo?.displayName || 'sistema'
    const opStr = conflictRow?.opString || 'mutation offline'
    const notesSuffix = conflictRow?.resolutionNotes
      ? ` Notas: ${conflictRow.resolutionNotes}`
      : ''
    await notifyUser(targetUserId, {
      category: 'conflict_resolution',
      subject: 'Conflito de sincronização resolvido',
      content: `Seu envio offline (${opStr}) foi ${humanResolution} pelo administrador ${adminName}.${notesSuffix}`,
      senderName: 'Sincronização Offline',
      priority: 'normal',
      dismissable: true,
      relatedEntityType: 'conflict_queue',
      relatedEntityId: conflictRow?.id || null,
      // LGPD: NÃO incluir payload nem server_state. Só metadata.
      // Audit trail no notif (changedBy = admin real). `notifyUser` não
      // aceita changedBy diretamente — o trigger de audit da tabela
      // `documento_conflict_queue` (resolved_by) é a fonte de verdade.
    })
  } catch (err) {
    console.warn(
      '[conflict-queue] notify failed (non-blocking):',
      err?.message ?? err
    )
  }
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
  const row = await _updateStatus(
    conflictId,
    {
      status: 'resolved_last_write_wins',
      resolution_notes: 'Aplicado last-write-wins via botão rápido',
    },
    userInfo,
    'resolveLastWriteWins'
  )
  await _notifyConflictResolution(
    row,
    'resolvido (mantida sua versão)',
    userInfo
  )
  return row
}

/**
 * Sprint 15a / F6.3 closeout — replay real da mutation original.
 *
 * Diferente de `resolveLastWriteWins` (que apenas marca status), esta função:
 *
 *  1. Busca a row de conflito por `conflictId` (precisa de payload + op_string).
 *  2. Procura handler no `conflictReplayRegistry`.
 *     - Sem handler → fallback: chama `resolveLastWriteWins` (legacy) e
 *       retorna `{ success: true, replayed: false, fallback: true }`.
 *       Justificativa: melhor fechar o conflito com nota "sem handler" do
 *       que travar a fila. Op não-replicável é deficiência do registry,
 *       não do conflito em si.
 *  3. Executa o handler com `(payload, userInfo)`. Em erro:
 *     - Throw `ReplayFailedError` (NÃO marca resolvido). A UI pode oferecer
 *       resolveManual ou dismiss baseado em `error.originalError`.
 *  4. Sucesso → marca `status='resolved_last_write_wins'`,
 *     `resolved_by=userInfo.uid`, notes "Replay executado com sucesso".
 *
 * @param {string} conflictId
 * @param {{ uid: string, displayName?: string, email?: string }} userInfo - Admin resolvedor (audit).
 * @returns {Promise<{ success: true, replayed: boolean, fallback?: boolean, row: Object }>}
 * @throws {ReplayFailedError} Se o replay handler falhar.
 * @throws {Error} Em falhas de fetch/update do Supabase ou userInfo inválido.
 */
async function resolveLastWriteWinsWithReplay(conflictId, userInfo) {
  if (!conflictId) {
    throw new Error(
      '[conflict-queue] resolveLastWriteWinsWithReplay: conflictId obrigatório'
    )
  }
  requireUserInfo(userInfo, 'resolveLastWriteWinsWithReplay')

  // 1. Fetch row p/ pegar payload + op_string.
  const { data: rawRow, error: fetchError } = await supabase
    .from('documento_conflict_queue')
    .select('*')
    .eq('id', conflictId)
    .single()

  if (fetchError) {
    logError('resolveLastWriteWinsWithReplay.fetch', fetchError)
    throw fetchError
  }
  if (!rawRow) {
    throw new Error(
      `[conflict-queue] resolveLastWriteWinsWithReplay: conflito ${conflictId} não encontrado`
    )
  }

  const conflict = toCamel(rawRow)

  // 2. Sem handler → fallback para legacy resolveLastWriteWins.
  if (!hasReplayHandler(conflict.opString)) {
    console.warn(
      `[conflict-queue] sem replay handler para "${conflict.opString}" — ` +
        `fallback para marcação de status (sem replay).`
    )
    const row = await _updateStatus(
      conflictId,
      {
        status: 'resolved_last_write_wins',
        resolution_notes: `Sem replay handler para "${conflict.opString}" — apenas marcação de status`,
      },
      userInfo,
      'resolveLastWriteWinsWithReplay.fallback'
    )
    await _notifyConflictResolution(
      row,
      'resolvido (apenas marcação, sem replay)',
      userInfo
    )
    return { success: true, replayed: false, fallback: true, row }
  }

  // 3. Executa o handler. Erro → ReplayFailedError, row NÃO atualizada.
  //    Notify NÃO é disparado: conflito não foi efetivamente resolvido.
  const handler = getReplayHandler(conflict.opString)
  try {
    await handler(conflict.payload, userInfo)
  } catch (replayError) {
    logError('resolveLastWriteWinsWithReplay.handler', replayError)
    throw new ReplayFailedError(replayError, conflict.opString)
  }

  // 4. Sucesso → marca resolvido.
  const row = await _updateStatus(
    conflictId,
    {
      status: 'resolved_last_write_wins',
      resolution_notes: 'Replay executado com sucesso',
    },
    userInfo,
    'resolveLastWriteWinsWithReplay'
  )
  await _notifyConflictResolution(row, 'resolvido com replay', userInfo)
  return { success: true, replayed: true, row }
}

/**
 * Sprint 16 / F6.3 Wave 2 — resolve por 3-way merge manual.
 *
 * O admin escolheu valores campo-a-campo no DiffViewer interativo
 * (ResolveModal), montando um `mergedPayload` que combina a versão do
 * usuário e o snapshot do servidor. Esta função:
 *
 *  1. Fetcha a row do conflito por `conflictId` (precisa de `op_string` e
 *     `payload` original para audit + replay).
 *  2. Procura handler no `conflictReplayRegistry` para o `op_string`.
 *       - Sem handler → atualiza status e nota explicativa SEM aplicar
 *         mergedPayload. Retorna `{ replayed: false, fallback: true }`.
 *         Motivo: melhor fechar o conflito do que travar a fila;
 *         registro de admin fica como audit-only.
 *       - Com handler → executa `handler(mergedPayload, userInfo)` igual
 *         ao replay LWW, mas com o payload manualmente construído.
 *  3. Atualiza a row do conflito: `status='resolved_merge_manual'`,
 *     `resolution_notes` = nota detalhada do admin (de `userInfo.resolutionNotes`
 *     se presente) ou string padrão.
 *  4. Notifica o user de origem via `notifyUser` — LGPD: SEM payload e
 *     SEM serverState no `content`, apenas metadata + nome do admin.
 *
 * IMPORTANTE — audit trail:
 *  - `changedBy` no Supabase update: `userInfo.uid` (admin real).
 *  - NUNCA usar `'admin'` ou `'system'` como changedBy.
 *
 * @param {string} conflictId
 * @param {Object} mergedPayload - Payload com valores escolhidos campo-a-campo.
 * @param {{ uid: string, displayName?: string, email?: string, resolutionNotes?: string }} userInfo
 *        Admin resolvedor; `resolutionNotes` opcional sobrescreve a nota padrão.
 * @returns {Promise<{ resolved: true, strategy: 'merge_manual', replayed: boolean, fallback?: boolean, row: Object }>}
 * @throws {ReplayFailedError} Se o replay handler falhar.
 * @throws {Error} Em falhas de fetch/update do Supabase ou userInfo inválido.
 */
async function resolveMerge(conflictId, mergedPayload, userInfo) {
  if (!conflictId) {
    throw new Error('[conflict-queue] resolveMerge: conflictId obrigatório')
  }
  if (!mergedPayload || typeof mergedPayload !== 'object') {
    throw new Error(
      '[conflict-queue] resolveMerge: mergedPayload obrigatório (objeto)'
    )
  }
  requireUserInfo(userInfo, 'resolveMerge')

  // 1. Fetch row para pegar op_string (handler lookup) e user_id (notify).
  const { data: rawRow, error: fetchError } = await supabase
    .from('documento_conflict_queue')
    .select('*')
    .eq('id', conflictId)
    .single()

  if (fetchError) {
    logError('resolveMerge.fetch', fetchError)
    throw fetchError
  }
  if (!rawRow) {
    throw new Error(
      `[conflict-queue] resolveMerge: conflito ${conflictId} não encontrado`
    )
  }

  const conflict = toCamel(rawRow)

  // Nota detalhada do admin OU padrão. Min 10 chars não é validado aqui
  // (a UI já valida e este service também é chamável via tests/admin-script).
  const adminName = userInfo.displayName || 'sistema'
  const adminNote =
    typeof userInfo.resolutionNotes === 'string' &&
    userInfo.resolutionNotes.trim().length > 0
      ? userInfo.resolutionNotes.trim()
      : `Merge manual por ${adminName}`

  // 2. Look up handler. Sem handler → fallback audit-only (não aplica payload).
  if (!hasReplayHandler(conflict.opString)) {
    console.warn(
      `[conflict-queue] resolveMerge: sem replay handler para ` +
        `"${conflict.opString}" — fallback audit-only (mergedPayload NÃO aplicado).`
    )
    const row = await _updateStatus(
      conflictId,
      {
        status: 'resolved_merge_manual',
        resolution_strategy: 'merge_manual',
        resolution_notes: `${adminNote} (sem replay handler — apenas registro)`,
      },
      userInfo,
      'resolveMerge.fallback'
    )
    await _notifyConflictResolution(
      row,
      'resolvido com merge manual (apenas registro)',
      userInfo
    )
    return {
      resolved: true,
      strategy: 'merge_manual',
      replayed: false,
      fallback: true,
      row,
    }
  }

  // 3. Executa handler com mergedPayload (idempotente — upsert). Falha → ReplayFailedError.
  const handler = getReplayHandler(conflict.opString)
  try {
    await handler(mergedPayload, userInfo)
  } catch (replayError) {
    logError('resolveMerge.handler', replayError)
    throw new ReplayFailedError(replayError, conflict.opString)
  }

  // 4. Sucesso → atualiza status + notes + strategy.
  const row = await _updateStatus(
    conflictId,
    {
      status: 'resolved_merge_manual',
      resolution_strategy: 'merge_manual',
      resolution_notes: adminNote,
    },
    userInfo,
    'resolveMerge'
  )

  // 5. Notify origin user — LGPD: só metadata (sem payload, sem serverState).
  await _notifyConflictResolution(
    row,
    'resolvido com merge manual',
    userInfo
  )

  return {
    resolved: true,
    strategy: 'merge_manual',
    replayed: true,
    row,
  }
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
  const row = await _updateStatus(
    conflictId,
    {
      status: 'resolved_manual',
      resolution_notes: resolutionNotes.trim(),
    },
    userInfo,
    'resolveManual'
  )
  await _notifyConflictResolution(row, 'resolvido manualmente', userInfo)
  return row
}

/**
 * Descarta o conflito (status='dismissed').
 *
 * @param {string} conflictId
 * @param {{ uid: string, displayName?: string }} userInfo
 * @returns {Promise<Object>}
 */
async function dismiss(conflictId, userInfo) {
  const row = await _updateStatus(
    conflictId,
    {
      status: 'dismissed',
      resolution_notes: 'Descartado',
    },
    userInfo,
    'dismiss'
  )
  await _notifyConflictResolution(row, 'descartado', userInfo)
  return row
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
  resolveLastWriteWinsWithReplay,
  resolveManual,
  resolveMerge,
  dismiss,
  subscribeToConflicts,
}

export {
  enqueueConflict,
  fetchPending,
  fetchAll,
  resolveLastWriteWins,
  resolveLastWriteWinsWithReplay,
  resolveManual,
  resolveMerge,
  dismiss,
  subscribeToConflicts,
}

export default supabaseConflictQueueService
