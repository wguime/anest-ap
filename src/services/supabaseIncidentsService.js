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
import { pastaAnexo, anexoExtensao, anexoNomePersistido, buildAnexoPath, sanitizeAttachments } from '@/lib/incidenteAnexos'
import { notifyNewIncidentEmail, notifyNewDenunciaEmail } from './emailNotificationService'
import { enqueue as enqueueOffline } from '@/utils/offlineQueue'
import { registerHandler } from '@/services/offlineQueueProcessor'
import { registerReplayHandler } from '@/services/conflictReplayRegistry'

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
  // B9 (2026-05-04): Never Events
  isNeverEvent: 'is_never_event',
  neverEventCode: 'never_event_code',
  // B4 (2026-05-04): Retenção LGPD Art. 15
  retainUntil: 'retain_until',
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
// LISTING COLUMNS — exclui apenas os JSONB realmente pesados/irrelevantes para
// a listagem (gestao_interna, notificante, denunciante, impacto,
// contexto_anest, fts). Mantém incidente_data / denuncia_data / admin_data
// porque a listagem do Centro de Gestão renderiza título, tipo, RCA e o prazo
// (getNextDeadline) a partir deles. `attachments` entra porque é só metadado
// ({name,path,size,type}, arquivo fica no Storage) e as páginas de detalhe
// leem o registro DA LISTA do context (getDenunciaById/getIncidenteById) —
// sem a coluna aqui o anexo some em silêncio. Detail functions keep select('*').
// ============================================================================

const INCIDENTE_LIST_COLS = [
  'id', 'tipo', 'status', 'source', 'protocolo', 'tracking_code',
  'user_id', 'is_never_event', 'never_event_code',
  'retain_until',
  'updated_by', 'updated_by_name',
  'created_at', 'updated_at',
  'incidente_data', 'denuncia_data', 'admin_data', 'attachments',
].join(',')

// ============================================================================
// LEITURA
// ============================================================================

async function fetchIncidentes(options = {}) {
  const { status, limit = 100 } = options

  let query = supabase
    .from('incidentes')
    .select(INCIDENTE_LIST_COLS)
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
    .select(INCIDENTE_LIST_COLS)
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
    .select(INCIDENTE_LIST_COLS)
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
// ANEXOS — bucket privado `incidentes-anexos` (migration 20260730220000)
// ============================================================================

const ANEXOS_BUCKET = 'incidentes-anexos'
// TTL curto como nos certificados: o link é gerado a cada clique em "Baixar".
const ANEXO_SIGNED_URL_TTL = 300

/**
 * Sobe os arquivos de evidência ANTES do insert do relato e devolve os
 * metadados que vão no JSONB `attachments`. Falha em qualquer arquivo
 * aborta tudo (o caller NÃO envia o relato sem a evidência — era
 * exatamente o bug silencioso que motivou isto). Órfãos de um submit
 * abortado ficam no bucket privado e são inertes (sem registro apontando).
 *
 * @param {File[]} files
 * @param {{ tipo: 'denuncia'|'incidente', anonimo: boolean, protocolo: string }} opts
 * @returns {Promise<Array<{name: string, path: string, size: number, type: string}>>}
 */
async function uploadAnexos(files, { tipo, anonimo, protocolo }) {
  const pasta = pastaAnexo(tipo, anonimo)
  return Promise.all(
    files.map(async (file, index) => {
      const path = buildAnexoPath(pasta, protocolo, crypto.randomUUID(), anexoExtensao(file.name))
      const { error } = await supabase.storage
        .from(ANEXOS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false, // path tem uuid — imutável, colisão impossível
          contentType: file.type || 'application/octet-stream',
        })
      if (error) handleError(error, 'uploadAnexos')
      // LGPD B1: anônimo nunca persiste o nome original (identidade em filename)
      return {
        name: anexoNomePersistido(file.name, anonimo, index),
        path,
        size: file.size,
        type: file.type || '',
      }
    })
  )
}

/** Signed URL de curta duração para baixar um anexo (RLS: admin ou dono). */
async function getAnexoSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from(ANEXOS_BUCKET)
    .createSignedUrl(path, ANEXO_SIGNED_URL_TTL)
  if (error) handleError(error, 'getAnexoSignedUrl')
  return data.signedUrl
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
    gestao_interna: incidenteData.gestaoInterna || incidenteData.gestao_interna || {},
    attachments: sanitizeAttachments(incidenteData.attachments),
    status: incidenteData.status || 'pending',
    lgpd_consent_at: incidenteData.notificante?.tipoIdentificacao === 'anonimo'
      ? null
      : (incidenteData.lgpdConsentAt || new Date().toISOString()),
    // B9 (2026-05-04): Never Events flags
    is_never_event: incidenteData.isNeverEvent || false,
    never_event_code: incidenteData.isNeverEvent && incidenteData.neverEventCode
      ? incidenteData.neverEventCode
      : null,
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
  const incContext = incidenteData.incidente || incidenteData.incidenteData || {}
  notifyNewIncidentEmail({
    protocolo: data.protocolo,
    tipoIdentificacao: incidenteData.notificante?.tipoIdentificacao || 'anonimo',
    notificanteName: incidenteData.notificante?.nome || '',
    notificanteEmail: incidenteData.notificante?.email || '',
    notificanteFuncao: incidenteData.notificante?.funcao || '',
    notificanteSetor: incidenteData.notificante?.setor || '',
    severidade: incContext.severidade || '',
    categoriaIncidente: incContext.tipo || '',
    subtipo: incContext.subtipo || '',
    descricaoResumo: incContext.descricao || '',
    isNeverEvent: !!incContext.isNeverEvent,
    neverEventCode: incContext.neverEventCode || '',
    source: row.source,
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
    attachments: sanitizeAttachments(denunciaData.attachments),
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
  const denContext = denunciaData.denunciaData || denunciaData.denuncia || {}
  notifyNewDenunciaEmail({
    protocolo: data.protocolo,
    tipoIdentificacao: denunciaData.denunciante?.tipoIdentificacao || 'anonimo',
    notificanteName: denunciaData.denunciante?.nome || '',
    notificanteEmail: denunciaData.denunciante?.email || '',
    categoriaDenuncia: denContext.tipo || '',
    descricaoResumo: denContext.descricao || '',
    source: row.source,
  })

  return toCamelCase(data)
}

// ----------------------------------------------------------------------------
// Sprint 16 / F6.2 — updateStatus + offline queue + conflict replay
// ----------------------------------------------------------------------------

/**
 * Internal: executa o UPDATE de status com audit (`updated_by` /
 * `updated_by_name`). Naturalmente idempotente — definir o mesmo status
 * duas vezes é equivalente a uma. Inclui apenas o write (sem captura
 * de payload anterior), então retry é seguro.
 *
 * O `opId` é parte do payload da fila mas NÃO é escrito no DB: serve
 * apenas para deduplicação client-side / debug.
 */
async function _doUpdateStatus(payload) {
  const { id, newStatus, userId, userName } = payload
  const { data, error } = await supabase
    .from('incidentes')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      updated_by: userId,
      updated_by_name: userName,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return toCamelCase(data)
}

function _isNetworkError(error) {
  return !error?.code && /fetch|network|failed/i.test(error?.message || '')
}

// Sprint 16 / F6.2: registra handler para flush offline.
registerHandler('incidente.updateStatus', _doUpdateStatus)

// Sprint 16 / F6.2: replay handler para conflict queue.
// `_doUpdateStatus` é idempotente (UPDATE WHERE id=x SET status=y).
registerReplayHandler('incidente.updateStatus', (payload /* , userInfo */) =>
  _doUpdateStatus(payload)
)

async function updateStatus(id, newStatus, userInfo = {}) {
  const user = getUserInfo(userInfo)
  // op_id determinístico: mesma incidente + mesmo status alvo = mesma op.
  const opId = `incidente.updateStatus:${id}:${newStatus}`
  const payload = {
    id,
    newStatus,
    userId: user.userId,
    userName: user.userName,
    opId,
  }

  // Modo offline: enfileira e devolve resposta otimista (null).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'incidente.updateStatus', payload })
    } catch (err) {
      handleError(err, 'updateStatus.enqueue')
    }
    return null
  }

  try {
    return await _doUpdateStatus(payload)
  } catch (error) {
    if (_isNetworkError(error)) {
      try {
        await enqueueOffline({ op: 'incidente.updateStatus', payload })
        return null
      } catch (enqErr) {
        handleError(enqErr, 'updateStatus.enqueue')
      }
    }
    handleError(error, 'updateStatus')
  }
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

  // Audit trail: colunas updated_by/updated_by_name existem desde migration 022
  if (userInfo?.userId) {
    snakeUpdates.updated_by = userInfo.userId
  }
  if (userInfo?.userName) {
    snakeUpdates.updated_by_name = userInfo.userName
  }

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
  uploadAnexos,
  getAnexoSignedUrl,
  updateStatus,
  updateAdminData,
  updateGestaoInterna,
  updateIncidente,
  anonymizeIncidente,
  subscribeToAll,
  unsubscribe,
}

export default supabaseIncidentsService
