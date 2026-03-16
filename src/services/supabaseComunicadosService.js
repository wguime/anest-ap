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
// LEITURA
// ============================================================================

async function fetchAll(options = {}) {
  const { status, tipo, limit = 100 } = options

  let query = supabase
    .from('comunicados')
    .select('*')
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
  // Fetch comunicados
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

async function confirmLeitura(comunicadoId, userId, userName) {
  const { data, error } = await supabase
    .from('comunicado_confirmacoes')
    .upsert(
      {
        comunicado_id: comunicadoId,
        user_id: userId,
        user_name: userName,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'comunicado_id,user_id' }
    )
    .select()
    .single()

  if (error) handleError(error, 'confirmLeitura')
  return {
    userId: data.user_id,
    userName: data.user_name,
    confirmedAt: data.confirmed_at,
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

async function completarAcao(comunicadoId, acaoId, userId, userName) {
  const { data, error } = await supabase
    .from('comunicado_acoes_completadas')
    .upsert(
      {
        comunicado_id: comunicadoId,
        acao_id: acaoId,
        user_id: userId,
        user_name: userName,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'comunicado_id,acao_id,user_id' }
    )
    .select()
    .single()

  if (error) handleError(error, 'completarAcao')
  return {
    acaoId: data.acao_id,
    userId: data.user_id,
    userName: data.user_name,
    completedAt: data.completed_at,
  }
}

async function desfazerAcao(comunicadoId, acaoId, userId) {
  const { error } = await supabase
    .from('comunicado_acoes_completadas')
    .delete()
    .eq('comunicado_id', comunicadoId)
    .eq('acao_id', acaoId)
    .eq('user_id', userId)
  if (error) handleError(error, 'desfazerAcao')
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
}

export default supabaseComunicadosService
