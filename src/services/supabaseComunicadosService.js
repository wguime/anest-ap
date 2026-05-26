/**
 * Supabase Comunicados Service — Gestao de Comunicados e Monitoramento
 *
 * CRUD completo + confirmacoes de leitura + acoes requeridas.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseIncidentsService.js.
 */
import { supabase } from '@/config/supabase'
import { enqueue as enqueueOffline } from '@/utils/offlineQueue'
import { registerHandler } from '@/services/offlineQueueProcessor'
import { registerReplayHandler } from '@/services/conflictReplayRegistry'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  leituraObrigatoria: 'leitura_obrigatoria',
  ropArea: 'rop_area',
  ropRelacionada: 'rop_relacionada',
  acoesRequeridas: 'acoes_requeridas',
  dataEvento: 'data_evento',
  prazoConfirmacao: 'prazo_confirmacao',
  dataValidade: 'data_validade',
  aprovadoPor: 'aprovado_por',
  autorId: 'autor_id',
  autorNome: 'autor_nome',
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
  console.error(`[SupabaseComunicadosService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

/**
 * Enrich comunicado with confirmacoes and acoes_completadas from related tables
 */
function enrichComunicado(comunicado, confirmacoes, acoesCompletadas) {
  return {
    ...comunicado,
    confirmacoes: (confirmacoes || [])
      .filter((c) => c.comunicadoId === comunicado.id)
      .map((c) => ({
        userId: c.userId,
        userName: c.userName,
        confirmedAt: c.confirmedAt,
      })),
    acoesCompletadas: (acoesCompletadas || [])
      .filter((a) => a.comunicadoId === comunicado.id)
      .map((a) => ({
        acaoId: a.acaoId,
        userId: a.userId,
        userName: a.userName,
        completedAt: a.completedAt,
      })),
  }
}

// ============================================================================
// LISTING COLUMNS — excludes heavy JSONB (conteudo, anexos) to reduce payload
// for list views. Detail functions and WithDetails keep select('*').
// ============================================================================

const COMUNICADO_LIST_COLS = [
  'id', 'tipo', 'titulo', 'status', 'prioridade',
  'leitura_obrigatoria', 'destinatarios',
  'rop_area', 'rop_relacionada',
  'data_evento', 'prazo_confirmacao', 'data_validade',
  'aprovado_por', 'arquivado',
  'autor_id', 'autor_nome',
  'created_at', 'updated_at',
].join(',')

// ============================================================================
// LEITURA
// ============================================================================

async function fetchAll(options = {}) {
  const { status, tipo, limit = 100 } = options

  let query = supabase
    .from('comunicados')
    .select(COMUNICADO_LIST_COLS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }
  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchAll')
  return (data || []).map(toCamelCase)
}

async function fetchPublicados() {
  return fetchAll({ status: 'publicado' })
}

async function fetchById(id) {
  const { data, error } = await supabase
    .from('comunicados')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

/**
 * Fetch all published comunicados with confirmacoes and acoes_completadas
 * (the full shape expected by ComunicadosMonitorTab)
 */
async function fetchPublicadosWithDetails() {
  // Fetch comunicados — full select('*') needed for detail enrichment
  const { data: comunicados, error: comErr } = await supabase
    .from('comunicados')
    .select('*')
    .eq('status', 'publicado')
    .order('created_at', { ascending: false })

  if (comErr) handleError(comErr, 'fetchPublicadosWithDetails:comunicados')

  if (!comunicados || comunicados.length === 0) return []

  const ids = comunicados.map((c) => c.id)

  // Fetch confirmacoes and acoes in parallel
  const [confResult, acoesResult] = await Promise.all([
    supabase
      .from('comunicado_confirmacoes')
      .select('*')
      .in('comunicado_id', ids),
    supabase
      .from('comunicado_acoes_completadas')
      .select('*')
      .in('comunicado_id', ids),
  ])

  if (confResult.error) handleError(confResult.error, 'fetchPublicadosWithDetails:confirmacoes')
  if (acoesResult.error) handleError(acoesResult.error, 'fetchPublicadosWithDetails:acoes')

  const confirmacoes = (confResult.data || []).map((c) => ({
    comunicadoId: c.comunicado_id,
    userId: c.user_id,
    userName: c.user_name,
    confirmedAt: c.confirmed_at,
  }))

  const acoesCompletadas = (acoesResult.data || []).map((a) => ({
    comunicadoId: a.comunicado_id,
    acaoId: a.acao_id,
    userId: a.user_id,
    userName: a.user_name,
    completedAt: a.completed_at,
  }))

  return comunicados.map((c) => {
    const camelCom = toCamelCase(c)
    return enrichComunicado(camelCom, confirmacoes, acoesCompletadas)
  })
}

/**
 * Fetch ALL comunicados (any status) with confirmacoes and acoes_completadas
 * (for admin mode — includes rascunho, aprovado, publicado, etc.)
 */
async function fetchAllWithDetails() {
  const { data: comunicados, error: comErr } = await supabase
    .from('comunicados')
    .select('*')
    .order('created_at', { ascending: false })

  if (comErr) handleError(comErr, 'fetchAllWithDetails:comunicados')

  if (!comunicados || comunicados.length === 0) return []

  const ids = comunicados.map((c) => c.id)

  const [confResult, acoesResult] = await Promise.all([
    supabase
      .from('comunicado_confirmacoes')
      .select('*')
      .in('comunicado_id', ids),
    supabase
      .from('comunicado_acoes_completadas')
      .select('*')
      .in('comunicado_id', ids),
  ])

  if (confResult.error) handleError(confResult.error, 'fetchAllWithDetails:confirmacoes')
  if (acoesResult.error) handleError(acoesResult.error, 'fetchAllWithDetails:acoes')

  const confirmacoes = (confResult.data || []).map((c) => ({
    comunicadoId: c.comunicado_id,
    userId: c.user_id,
    userName: c.user_name,
    confirmedAt: c.confirmed_at,
  }))

  const acoesCompletadas = (acoesResult.data || []).map((a) => ({
    comunicadoId: a.comunicado_id,
    acaoId: a.acao_id,
    userId: a.user_id,
    userName: a.user_name,
    completedAt: a.completed_at,
  }))

  return comunicados.map((c) => {
    const camelCom = toCamelCase(c)
    return enrichComunicado(camelCom, confirmacoes, acoesCompletadas)
  })
}

// ============================================================================
// ESCRITA
// ============================================================================

async function create(comunicadoData, userInfo = {}) {
  const row = {
    tipo: comunicadoData.tipo || 'Geral',
    titulo: comunicadoData.titulo,
    conteudo: comunicadoData.conteudo || '',
    status: comunicadoData.status || 'rascunho',
    leitura_obrigatoria: comunicadoData.leituraObrigatoria || false,
    destinatarios: comunicadoData.destinatarios || [],
    rop_area: comunicadoData.ropArea || 'geral',
    rop_relacionada: comunicadoData.ropRelacionada || [],
    acoes_requeridas: comunicadoData.acoesRequeridas || [],
    link: comunicadoData.link || null,
    data_evento: comunicadoData.dataEvento || null,
    anexos: comunicadoData.anexos || [],
    prazo_confirmacao: comunicadoData.prazoConfirmacao || null,
    data_validade: comunicadoData.dataValidade || null,
    autor_id: userInfo.userId || userInfo.uid || '',
    autor_nome: userInfo.userName || userInfo.displayName || 'Usuario',
  }

  const { data, error } = await supabase
    .from('comunicados')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'create')
  return toCamelCase(data)
}

async function update(id, updates) {
  const snakeUpdates = toSnakeCase(updates)
  delete snakeUpdates.id
  delete snakeUpdates.created_at
  delete snakeUpdates.autor_id
  delete snakeUpdates.autor_nome
  snakeUpdates.updated_at = new Date().toISOString()

  // Sanitize empty strings to null for timestamp columns
  const timestampFields = ['prazo_confirmacao', 'data_validade', 'data_evento']
  for (const field of timestampFields) {
    if (field in snakeUpdates && !snakeUpdates[field]) {
      snakeUpdates[field] = null
    }
  }

  const { data, error } = await supabase
    .from('comunicados')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'update')
  return toCamelCase(data)
}

async function approve(id, userInfo = {}) {
  const aprovadoPor = {
    userId: userInfo.userId || userInfo.uid || '',
    userName: userInfo.userName || userInfo.displayName || 'Usuario',
    approvedAt: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('comunicados')
    .update({
      status: 'aprovado',
      aprovado_por: aprovadoPor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'approve')
  return toCamelCase(data)
}

async function publish(id) {
  const { data, error } = await supabase
    .from('comunicados')
    .update({
      status: 'publicado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'publish')
  return toCamelCase(data)
}

async function archive(id) {
  const { data, error } = await supabase
    .from('comunicados')
    .update({
      arquivado: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'archive')
  return toCamelCase(data)
}

async function remove(id) {
  const { error } = await supabase.from('comunicados').delete().eq('id', id)
  if (error) handleError(error, 'remove')
  return true
}

// ============================================================================
// CONFIRMACOES
// ============================================================================

async function _doConfirmLeituraUpsert({ comunicadoId, userId, userName, confirmedAt }) {
  const { data, error } = await supabase
    .from('comunicado_confirmacoes')
    .upsert(
      {
        comunicado_id: comunicadoId,
        user_id: userId,
        user_name: userName,
        confirmed_at: confirmedAt || new Date().toISOString(),
      },
      { onConflict: 'comunicado_id,user_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// Sprint 10 / F6.2: registra handler para flush offline.
registerHandler('comunicado.confirmLeitura', _doConfirmLeituraUpsert)

// Sprint 15a / F6.3 closeout: registra handler para replay de conflito.
// userInfo do admin resolvedor é ignorado — a mutation aplica o write
// do user original (last-write-wins). Audit do admin é feito via
// `resolved_by` na própria row de `documento_conflict_queue`.
registerReplayHandler('comunicado.confirmLeitura', (payload /* , userInfo */) =>
  _doConfirmLeituraUpsert(payload)
)

async function confirmLeitura(comunicadoId, userId, userName) {
  const confirmedAt = new Date().toISOString()
  const payload = { comunicadoId, userId, userName, confirmedAt }

  // Modo offline: persiste na queue, devolve resposta otimista.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'comunicado.confirmLeitura', payload })
    } catch (err) {
      handleError(err, 'confirmLeitura.enqueue')
    }
    return { userId, userName, confirmedAt }
  }

  try {
    const data = await _doConfirmLeituraUpsert(payload)
    return {
      userId: data.user_id,
      userName: data.user_name,
      confirmedAt: data.confirmed_at,
    }
  } catch (error) {
    // Network falhou (sem ser erro de RLS/business): tenta enqueue como fallback.
    const isNetworkError = !error?.code && /fetch|network|failed/i.test(error?.message || '')
    if (isNetworkError) {
      try {
        await enqueueOffline({ op: 'comunicado.confirmLeitura', payload })
        return { userId, userName, confirmedAt }
      } catch (enqErr) {
        handleError(enqErr, 'confirmLeitura.enqueue')
      }
    }
    handleError(error, 'confirmLeitura')
  }
}

async function fetchConfirmacoes(comunicadoId) {
  const { data, error } = await supabase
    .from('comunicado_confirmacoes')
    .select('*')
    .eq('comunicado_id', comunicadoId)
    .order('confirmed_at', { ascending: false })

  if (error) handleError(error, 'fetchConfirmacoes')
  return (data || []).map((c) => ({
    userId: c.user_id,
    userName: c.user_name,
    confirmedAt: c.confirmed_at,
  }))
}

// ============================================================================
// ACOES COMPLETADAS
// ============================================================================

async function _doCompletarAcaoUpsert({ comunicadoId, acaoId, userId, userName, completedAt }) {
  const { data, error } = await supabase
    .from('comunicado_acoes_completadas')
    .upsert(
      {
        comunicado_id: comunicadoId,
        acao_id: acaoId,
        user_id: userId,
        user_name: userName,
        completed_at: completedAt || new Date().toISOString(),
      },
      { onConflict: 'comunicado_id,acao_id,user_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// Sprint 14a / F6.2: registra handler para flush offline.
registerHandler('comunicado.completarAcao', _doCompletarAcaoUpsert)

// Sprint 15a / F6.3 closeout: replay handler para conflict queue.
registerReplayHandler('comunicado.completarAcao', (payload /* , userInfo */) =>
  _doCompletarAcaoUpsert(payload)
)

async function completarAcao(comunicadoId, acaoId, userId, userName) {
  const completedAt = new Date().toISOString()
  const payload = { comunicadoId, acaoId, userId, userName, completedAt }

  // Modo offline: persiste na queue, devolve resposta otimista.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'comunicado.completarAcao', payload })
    } catch (err) {
      handleError(err, 'completarAcao.enqueue')
    }
    return { acaoId, userId, userName, completedAt }
  }

  try {
    const data = await _doCompletarAcaoUpsert(payload)
    return {
      acaoId: data.acao_id,
      userId: data.user_id,
      userName: data.user_name,
      completedAt: data.completed_at,
    }
  } catch (error) {
    // Network falhou (sem ser erro de RLS/business): tenta enqueue como fallback.
    const isNetworkError = !error?.code && /fetch|network|failed/i.test(error?.message || '')
    if (isNetworkError) {
      try {
        await enqueueOffline({ op: 'comunicado.completarAcao', payload })
        return { acaoId, userId, userName, completedAt }
      } catch (enqErr) {
        handleError(enqErr, 'completarAcao.enqueue')
      }
    }
    handleError(error, 'completarAcao')
  }
}

async function _doDesfazerAcaoDelete({ comunicadoId, acaoId, userId }) {
  const { error } = await supabase
    .from('comunicado_acoes_completadas')
    .delete()
    .eq('comunicado_id', comunicadoId)
    .eq('acao_id', acaoId)
    .eq('user_id', userId)
  if (error) throw error
}

// Sprint 14a / F6.2: registra handler para flush offline.
// DELETE WHERE não-existe é no-op no Postgres → seguro para replay.
registerHandler('comunicado.desfazerAcao', _doDesfazerAcaoDelete)

// Sprint 15a / F6.3 closeout: replay handler para conflict queue.
// DELETE WHERE é idempotente — seguro para retry.
registerReplayHandler('comunicado.desfazerAcao', (payload /* , userInfo */) =>
  _doDesfazerAcaoDelete(payload)
)

async function desfazerAcao(comunicadoId, acaoId, userId) {
  const payload = { comunicadoId, acaoId, userId }

  // Modo offline: persiste na queue e retorna void.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'comunicado.desfazerAcao', payload })
    } catch (err) {
      handleError(err, 'desfazerAcao.enqueue')
    }
    return
  }

  try {
    await _doDesfazerAcaoDelete(payload)
  } catch (error) {
    // Network falhou (sem ser erro de RLS/business): tenta enqueue como fallback.
    const isNetworkError = !error?.code && /fetch|network|failed/i.test(error?.message || '')
    if (isNetworkError) {
      try {
        await enqueueOffline({ op: 'comunicado.desfazerAcao', payload })
        return
      } catch (enqErr) {
        handleError(enqErr, 'desfazerAcao.enqueue')
      }
    }
    handleError(error, 'desfazerAcao')
  }
}

async function fetchAcoesCompletadas(comunicadoId) {
  const { data, error } = await supabase
    .from('comunicado_acoes_completadas')
    .select('*')
    .eq('comunicado_id', comunicadoId)
    .order('completed_at', { ascending: false })

  if (error) handleError(error, 'fetchAcoesCompletadas')
  return (data || []).map((a) => ({
    acaoId: a.acao_id,
    userId: a.user_id,
    userName: a.user_name,
    completedAt: a.completed_at,
  }))
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToAll(callback) {
  const channel = supabase
    .channel('comunicados-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comunicados' },
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

function unsubscribe(channel) {
  if (channel) {
    supabase.removeChannel(channel)
  }
}

// ============================================================================
// PINNING
// ============================================================================

async function pinComunicado(comunicadoId, userId) {
  const { error } = await supabase
    .from('comunicados')
    .update({
      is_pinned: true,
      pinned_at: new Date().toISOString(),
      pinned_by: userId,
    })
    .eq('id', comunicadoId)
  if (error) handleError(error, 'pinComunicado')
}

async function unpinComunicado(comunicadoId) {
  const { error } = await supabase
    .from('comunicados')
    .update({
      is_pinned: false,
      pinned_at: null,
      pinned_by: null,
    })
    .eq('id', comunicadoId)
  if (error) handleError(error, 'unpinComunicado')
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseComunicadosService = {
  // CRUD
  fetchAll,
  fetchPublicados,
  fetchById,
  fetchPublicadosWithDetails,
  fetchAllWithDetails,
  create,
  update,
  approve,
  publish,
  archive,
  remove,
  // Confirmacoes
  confirmLeitura,
  fetchConfirmacoes,
  // Acoes
  completarAcao,
  desfazerAcao,
  fetchAcoesCompletadas,
  // Real-time
  subscribeToAll,
  unsubscribe,
  // Pinning
  pinComunicado,
  unpinComunicado,
}

export default supabaseComunicadosService
