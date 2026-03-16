/**
 * Supabase Incidents Service — Gestao de Incidentes e Denuncias
 *
 * CRUD completo + rastreamento anonimo + real-time subscriptions.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseDocumentService.js.
 */
import { supabase } from '@/config/supabase'
import { notifyNewIncidentEmail, notifyNewDenunciaEmail } from './emailNotificationService'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  trackingCode: 'tracking_code',
  userId: 'user_id',
  incidenteData: 'incidente_data',
  contextoAnest: 'contexto_anest',
  denunciaData: 'denuncia_data',
  adminData: 'admin_data',
  gestaoInterna: 'gestao_interna',
  lgpdConsentAt: 'lgpd_consent_at',
  anonymizedAt: 'anonymized_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  updatedBy: 'updated_by',
  updatedByName: 'updated_by_name',
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
  // Aliases for backward compatibility with mock data field names.
  // Mock data uses `incidente`, `admin`, `denuncia`; Supabase uses `incidenteData`, `adminData`, `denunciaData`.
  if (result.incidenteData !== undefined) result.incidente = result.incidenteData
  if (result.adminData !== undefined) result.admin = result.adminData
  if (result.denunciaData !== undefined) result.denuncia = result.denunciaData
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[SupabaseIncidentsService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

function getUserInfo(userInfo = {}) {
  return {
    userId: userInfo.userId || userInfo.uid || null,
    userName: userInfo.userName || userInfo.displayName || 'Anonimo',
    userEmail: userInfo.userEmail || userInfo.email || null,
  }
}

// ============================================================================
// LEITURA
// ============================================================================

async function fetchIncidentes(options = {}) {
  const { status, limit = 100 } = options

  let query = supabase
    .from('incidentes')
    .select('*')
    .eq('tipo', 'incidente')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchIncidentes')
  return (data || []).map(toCamelCase)
}

async function fetchDenuncias(options = {}) {
  const { status, limit = 100 } = options

  let query = supabase
    .from('incidentes')
    .select('*')
    .eq('tipo', 'denuncia')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchDenuncias')
  return (data || []).map(toCamelCase)
}

async function fetchById(id) {
  const { data, error } = await supabase
    .from('incidentes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

async function fetchByUser(userId) {
  const { data, error } = await supabase
    .from('incidentes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) handleError(error, 'fetchByUser')
  return (data || []).map(toCamelCase)
}

async function fetchByTrackingCode(trackingCode) {
  const { data, error } = await supabase.rpc('rpc_fetch_by_tracking_code', {
    p_tracking_code: trackingCode,
  })

  if (error) handleError(error, 'fetchByTrackingCode')
  if (!data) return null

  // Map flat RPC fields to the shape expected by the frontend
  return {
    id: data.id,
    protocolo: data.protocolo,
    trackingCode: data.tracking_code,
    status: data.status,
    tipo: data.tipo,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    incidenteTipo: data.incidente_tipo,
    incidenteResumo: data.incidente_resumo,
    denunciaTitulo: data.denuncia_titulo,
    denunciaTipo: data.denuncia_tipo,
    feedbackAoRelator: data.feedback_ao_relator,
    historicoStatus: data.historico_status,
    ultimaAtualizacao: data.ultima_atualizacao,
    parecer: data.parecer,
  }
}

// ============================================================================
// ESCRITA
// ============================================================================

async function createIncidente(incidenteData, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const row = {
    tipo: 'incidente',
    source: incidenteData.source || 'app',
    user_id: user.userId,
    notificante: incidenteData.notificante || {},
    incidente_data: incidenteData.incidente || incidenteData.incidenteData || {},
    impacto: incidenteData.impacto || {},
    contexto_anest: incidenteData.contextoAnest || {},
    status: incidenteData.status || 'pending',
    lgpd_consent_at: incidenteData.notificante?.tipoIdentificacao === 'anonimo'
      ? null
      : (incidenteData.lgpdConsentAt || new Date().toISOString()),
  }

  // Se protocolo foi fornecido externamente, usa-lo (senao o trigger gera)
  if (incidenteData.protocolo) {
    row.protocolo = incidenteData.protocolo
  }
  if (incidenteData.trackingCode) {
    row.tracking_code = incidenteData.trackingCode
  }

  const { data, error } = await supabase
    .from('incidentes')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'createIncidente')

  // Fire-and-forget email notification
  notifyNewIncidentEmail({
    protocolo: data.protocolo,
    tipoIdentificacao: incidenteData.notificante?.tipoIdentificacao || 'anonimo',
    notificanteName: incidenteData.notificante?.nome || '',
    notificanteEmail: incidenteData.notificante?.email || '',
    notificanteFuncao: incidenteData.notificante?.funcao || '',
    notificanteSetor: incidenteData.notificante?.setor || '',
    severidade: (incidenteData.incidente || incidenteData.incidenteData || {}).severidade || '',
    categoriaIncidente: (incidenteData.incidente || incidenteData.incidenteData || {}).tipo || '',
    descricaoResumo: ((incidenteData.incidente || incidenteData.incidenteData || {}).descricao || '').substring(0, 200),
  })

  return toCamelCase(data)
}

async function createDenuncia(denunciaData, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const row = {
    tipo: 'denuncia',
    source: denunciaData.source || 'app',
    user_id: user.userId,
    denunciante: denunciaData.denunciante || {},
    denuncia_data: denunciaData.denunciaData || denunciaData.denuncia || {},
    impacto: denunciaData.impacto || {},
    status: denunciaData.status || 'pending',
    lgpd_consent_at: denunciaData.denunciante?.tipoIdentificacao === 'anonimo'
      ? null
      : (denunciaData.lgpdConsentAt || new Date().toISOString()),
  }

  if (denunciaData.protocolo) {
    row.protocolo = denunciaData.protocolo
  }
  if (denunciaData.trackingCode) {
    row.tracking_code = denunciaData.trackingCode
  }

  const { data, error } = await supabase
    .from('incidentes')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'createDenuncia')

  // Fire-and-forget email notification
  notifyNewDenunciaEmail({
    protocolo: data.protocolo,
    tipoIdentificacao: denunciaData.denunciante?.tipoIdentificacao || 'anonimo',
    notificanteName: denunciaData.denunciante?.nome || '',
    notificanteEmail: denunciaData.denunciante?.email || '',
    categoriaDenuncia: (denunciaData.denunciaData || denunciaData.denuncia || {}).tipo || '',
    descricaoResumo: ((denunciaData.denunciaData || denunciaData.denuncia || {}).descricao || '').substring(0, 200),
  })

  return toCamelCase(data)
}

async function updateStatus(id, newStatus, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const { data, error } = await supabase
    .from('incidentes')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'updateStatus')
  return toCamelCase(data)
}

async function updateAdminData(id, adminData, userInfo = {}) {
  const user = getUserInfo(userInfo)
  const { data, error } = await supabase
    .from('incidentes')
    .update({
      admin_data: adminData,
      updated_at: new Date().toISOString(),
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'updateAdminData')
  return toCamelCase(data)
}

async function updateGestaoInterna(id, gestaoData, userInfo = {}) {
  const user = getUserInfo(userInfo)
  const { data, error } = await supabase
    .from('incidentes')
    .update({
      gestao_interna: gestaoData,
      updated_at: new Date().toISOString(),
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'updateGestaoInterna')
  return toCamelCase(data)
}

async function updateIncidente(id, updates, userInfo = {}) {
  const snakeUpdates = toSnakeCase(updates)

  // Remove campos que nao devem ser atualizados diretamente
  delete snakeUpdates.id
  delete snakeUpdates.protocolo
  delete snakeUpdates.tracking_code
  delete snakeUpdates.created_at

  const { data, error } = await supabase
    .from('incidentes')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'updateIncidente')
  return toCamelCase(data)
}

async function anonymizeIncidente(id) {
  const { error } = await supabase.rpc('rpc_anonimizar_incidente', {
    p_id: id,
  })

  if (error) handleError(error, 'anonymizeIncidente')
  return true
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToAll(callback) {
  const channel = supabase
    .channel('incidentes-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'incidentes' },
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

export { toCamelCase as incidentsToCamelCase }

const supabaseIncidentsService = {
  fetchIncidentes,
  fetchDenuncias,
  fetchById,
  fetchByUser,
  fetchByTrackingCode,
  createIncidente,
  createDenuncia,
  updateStatus,
  updateAdminData,
  updateGestaoInterna,
  updateIncidente,
  anonymizeIncidente,
  subscribeToAll,
  unsubscribe,
}

export default supabaseIncidentsService
