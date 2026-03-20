/**
 * Supabase Document Service — Gestão Documental Qmentum
 *
 * CRUD completo + FTS português + audit trail + real-time + distribuição.
 * Converte bidirecionalmente camelCase ↔ snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Toda operação de escrita segue o padrão:
 *   1. Converte camelCase → snake_case
 *   2. Executa mutation no Supabase
 *   3. Cria entrada no changelog via rpc_log_document_action
 *   4. Converte resultado snake_case → camelCase
 *   5. Retorna o documento atualizado
 */
import { supabase } from '@/config/supabase'
import { DOCUMENT_CATEGORIES, QMENTUM_CATEGORIES, validateStatusTransition } from '@/types/documents'

// ============================================================================
// FIELD MAPPING — camelCase ↔ snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  versaoAtual: 'versao_atual',
  setorId: 'setor_id',
  setorNome: 'setor_nome',
  responsavelRevisao: 'responsavel_revisao',
  arquivoURL: 'arquivo_url',
  arquivoNome: 'arquivo_nome',
  arquivoTamanho: 'arquivo_tamanho',
  storagePath: 'storage_path',
  proximaRevisao: 'proxima_revisao',
  intervaloRevisaoDias: 'intervalo_revisao_dias',
  ropArea: 'rop_area',
  qmentumWeight: 'qmentum_weight',
  approvalWorkflow: 'approval_workflow',
  viewCount: 'view_count',
  downloadCount: 'download_count',
  createdBy: 'created_by',
  createdByName: 'created_by_name',
  createdByEmail: 'created_by_email',
  updatedBy: 'updated_by',
  updatedByName: 'updated_by_name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  descricaoAlteracao: 'descricao_alteracao',
  motivoAlteracao: 'motivo_alteracao',
  aprovadoPor: 'aprovado_por',
  dataAprovacao: 'data_aprovacao',
  documentoId: 'documento_id',
  stepOrder: 'step_order',
  approverId: 'approver_id',
  approverName: 'approver_name',
  approverRole: 'approver_role',
  decidedAt: 'decided_at',
  signatureHash: 'signature_hash',
  userId: 'user_id',
  userName: 'user_name',
  userEmail: 'user_email',
  userRole: 'user_role',
  distribuidoEm: 'distribuido_em',
  visualizadoEm: 'visualizado_em',
  reconhecidoEm: 'reconhecido_em',
  notificadoEm: 'notificado_em',
  lembreteEm: 'lembrete_em',
  origem: 'origem',
  dataPublicacao: 'data_publicacao',
  dataVersao: 'data_versao',
  classificacaoAcesso: 'classificacao_acesso',
  localArmazenamento: 'local_armazenamento',
  responsavelElaboracao: 'responsavel_elaboracao',
  responsavelAprovacao: 'responsavel_aprovacao',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

/** Convert a JS object's keys from camelCase to snake_case for Supabase */
function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key
    result[snakeKey] = value
  }
  return result
}

/** Convert a Supabase row (snake_case) to camelCase for the frontend */
function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    // Skip the fts column — not needed on the frontend
    if (key === 'fts') continue
    const camelKey = SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[SupabaseDocService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

function getUserInfo(userInfo = {}) {
  return {
    userId: userInfo.userId || userInfo.uid || 'sistema',
    userName: userInfo.userName || userInfo.displayName || 'Sistema',
    userEmail: userInfo.userEmail || userInfo.email || null,
  }
}

/** Derive ROP area and weight from category */
function deriveQmentumFields(categoria) {
  const qm = QMENTUM_CATEGORIES[categoria]
  if (!qm) return {}
  return {
    rop_area: qm.ropArea,
    qmentum_weight: qm.weight,
  }
}

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Fetch all documents grouped by category.
 * Returns the same shape as mock data: { etica: [], comites: [], ... }
 */
async function fetchAllDocuments() {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) handleError(error, 'fetchAllDocuments')

  // Group by category — use literal strings matching the DB CHECK constraint
  const grouped = {
    etica:        [],
    comites:      [],
    auditorias:   [],
    relatorios:   [],
    biblioteca:   [],
    financeiro:   [],
    medicamentos: [],
    infeccoes:    [],
    desastres:    [],
  }

  for (const row of data || []) {
    const doc = toCamelCase(row)
    if (grouped[doc.categoria]) {
      grouped[doc.categoria].push(doc)
    }
  }

  return grouped
}

/**
 * Fetch documents for a specific category
 */
async function fetchByCategory(categoria) {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('categoria', categoria)
    .order('updated_at', { ascending: false })

  if (error) handleError(error, 'fetchByCategory')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch a single document by ID
 */
async function fetchById(id) {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

/**
 * Full-text search in Portuguese via RPC
 */
async function search(query, options = {}) {
  const { categoria, status, limit = 50 } = options

  const { data, error } = await supabase.rpc('rpc_search_documentos', {
    search_query: query,
    filter_categoria: categoria || null,
    filter_status: status || null,
    result_limit: limit,
  })

  if (error) handleError(error, 'search')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch version history for a document
 */
async function fetchVersions(docId) {
  const { data, error } = await supabase
    .from('documento_versoes')
    .select('*')
    .eq('documento_id', docId)
    .order('versao', { ascending: false })

  if (error) handleError(error, 'fetchVersions')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch changelog (audit trail) for a document
 * @param {string} docId - Document ID
 * @param {number} limit - Max entries to return
 * @param {boolean} isAdmin - If true, returns full data including user_email
 */
async function fetchChangelog(docId, limit = 50, isAdmin = false) {
  const table = isAdmin ? 'documento_changelog' : 'vw_changelog_publico'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('documento_id', docId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) handleError(error, 'fetchChangelog')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch compliance metrics via RPC (Qmentum weighted score)
 */
async function fetchComplianceMetrics() {
  const { data, error } = await supabase.rpc('rpc_compliance_score_qmentum')

  if (error) handleError(error, 'fetchComplianceMetrics')

  // When no documents exist, return sensible defaults
  if (!data || data.score === null) {
    return {
      score: 100,
      categories: Object.values(DOCUMENT_CATEGORIES).map((cat) => ({
        categoria: cat,
        score: 100,
        weight: QMENTUM_CATEGORIES[cat]?.weight || 1.0,
        total: 0,
        ativos: 0,
        vencidos: 0,
        pendentes: 0,
      })),
    }
  }

  return data
}

/**
 * Fetch documents with overdue reviews
 */
async function fetchOverdueDocuments() {
  const { data, error } = await supabase
    .from('vw_documentos_revisao_vencida')
    .select('*')

  if (error) handleError(error, 'fetchOverdueDocuments')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch documents with upcoming reviews (within N days)
 */
async function fetchUpcomingReviews(days = 30) {
  const now = new Date().toISOString()
  const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('status', 'ativo')
    .gte('proxima_revisao', now)
    .lte('proxima_revisao', future)
    .order('proxima_revisao', { ascending: true })

  if (error) handleError(error, 'fetchUpcomingReviews')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch documents pending approval
 */
async function fetchPendingApproval() {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('status', 'pendente')
    .order('updated_at', { ascending: false })

  if (error) handleError(error, 'fetchPendingApproval')
  return (data || []).map(toCamelCase)
}

/**
 * Fetch recent changelog entries across all documents
 */
async function fetchRecentActivity(limit = 20) {
  const { data, error } = await supabase
    .from('documento_changelog')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) handleError(error, 'fetchRecentActivity')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// ESCRITA — todas auto-criam changelog
// ============================================================================

/**
 * Create a new document
 */
async function createDocument(categoria, documentData, userInfo = {}) {
  const user = getUserInfo(userInfo)
  const qmentum = deriveQmentumFields(categoria)

  const id = documentData.id || `doc-${Date.now()}`

  const snakeData = toSnakeCase(documentData)

  const row = {
    ...snakeData,
    id,
    categoria,
    status: snakeData.status || 'rascunho',
    versao_atual: snakeData.versao_atual || 1,
    created_by: user.userId,
    created_by_name: user.userName,
    created_by_email: user.userEmail,
    ...qmentum,
  }

  // Remove fields that shouldn't be inserted
  delete row.changeLog
  delete row._changeLogEntry
  delete row.versoes
  delete row.category

  const { data, error } = await supabase
    .from('documentos')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'createDocument')

  // Create initial version record
  await supabase.from('documento_versoes').insert({
    documento_id: data.id,
    versao: data.versao_atual,
    arquivo_url: data.arquivo_url,
    arquivo_nome: data.arquivo_nome,
    arquivo_tamanho: data.arquivo_tamanho,
    storage_path: data.storage_path,
    descricao_alteracao: 'Versão inicial',
    motivo_alteracao: 'Criação do documento',
    status: 'ativo',
    created_by: user.userId,
    created_by_name: user.userName,
  })

  // Log creation in changelog
  await logAction(data.id, 'created', user, {
    status: data.status,
    categoria: data.categoria,
  })

  return toCamelCase(data)
}

/**
 * Update a document's metadata
 */
async function updateDocument(id, updates, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const snakeUpdates = toSnakeCase(updates)

  // Remove fields that shouldn't be updated directly
  delete snakeUpdates.id
  delete snakeUpdates.created_by
  delete snakeUpdates.created_by_name
  delete snakeUpdates.created_by_email
  delete snakeUpdates.created_at
  delete snakeUpdates.changeLog
  delete snakeUpdates._changeLogEntry
  delete snakeUpdates.versoes
  delete snakeUpdates.category
  delete snakeUpdates.fts

  // Set who updated
  snakeUpdates.updated_by = user.userId
  snakeUpdates.updated_by_name = user.userName

  const { data, error } = await supabase
    .from('documentos')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'updateDocument')

  // Log update
  await logAction(data.id, 'updated', user, updates)

  return toCamelCase(data)
}

/**
 * Change document status with Qmentum workflow validation
 */
async function changeStatus(id, newStatus, userInfo = {}) {
  const user = getUserInfo(userInfo)

  // Fetch current document to validate transition
  const { data: current, error: fetchErr } = await supabase
    .from('documentos')
    .select('status, categoria, intervalo_revisao_dias')
    .eq('id', id)
    .single()

  if (fetchErr) handleError(fetchErr, 'changeStatus:fetch')

  // Validate transition using existing logic from types/documents.js
  const validation = validateStatusTransition(current.status, newStatus)
  if (!validation.valid) {
    return { success: false, message: validation.message }
  }

  // Calculate proxima_revisao when activating
  const extraUpdates = {}
  if (newStatus === 'ativo' && current.status === 'pendente') {
    const intervalDays = current.intervalo_revisao_dias || 365
    extraUpdates.proxima_revisao = new Date(
      Date.now() + intervalDays * 24 * 60 * 60 * 1000
    ).toISOString()
  }

  const { data, error } = await supabase
    .from('documentos')
    .update({
      status: newStatus,
      updated_by: user.userId,
      updated_by_name: user.userName,
      ...extraUpdates,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'changeStatus:update')

  // Log status change
  await logAction(data.id, 'status_changed', user, {
    statusAnterior: current.status,
    statusNovo: newStatus,
  }, userInfo.comment || '')

  return {
    success: true,
    message: validation.message,
    document: toCamelCase(data),
  }
}

/**
 * Add a new version to a document
 */
async function addVersion(docId, versionData, userInfo = {}) {
  const user = getUserInfo(userInfo)

  // Get current document
  const { data: doc, error: docErr } = await supabase
    .from('documentos')
    .select('versao_atual, codigo')
    .eq('id', docId)
    .single()

  if (docErr) handleError(docErr, 'addVersion:fetchDoc')

  const newVersionNumber = (doc.versao_atual || 1) + 1

  // Archive previous active versions
  await supabase
    .from('documento_versoes')
    .update({ status: 'arquivado' })
    .eq('documento_id', docId)
    .eq('status', 'ativo')

  // Insert new version
  const snakeVersion = toSnakeCase(versionData)
  const { data: version, error: verErr } = await supabase
    .from('documento_versoes')
    .insert({
      documento_id: docId,
      versao: newVersionNumber,
      arquivo_url: snakeVersion.arquivo_url || null,
      arquivo_nome: snakeVersion.arquivo_nome || `${doc.codigo || 'DOC'}-v${newVersionNumber}.pdf`,
      arquivo_tamanho: snakeVersion.arquivo_tamanho || null,
      storage_path: snakeVersion.storage_path || null,
      descricao_alteracao: snakeVersion.descricao_alteracao || 'Atualização do documento',
      motivo_alteracao: snakeVersion.motivo_alteracao || 'Revisão',
      status: 'ativo',
      created_by: user.userId,
      created_by_name: user.userName,
    })
    .select()
    .single()

  if (verErr) handleError(verErr, 'addVersion:insert')

  // Update document's current version
  await supabase
    .from('documentos')
    .update({
      versao_atual: newVersionNumber,
      arquivo_url: version.arquivo_url || undefined,
      arquivo_nome: version.arquivo_nome || undefined,
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', docId)

  // Log version addition
  await logAction(docId, 'version_added', user, {
    versaoAnterior: doc.versao_atual,
    versaoNova: newVersionNumber,
  }, versionData.descricaoAlteracao || '')

  return toCamelCase(version)
}

/**
 * Archive a document
 */
async function archiveDocument(id, userInfo = {}) {
  const result = await changeStatus(id, 'arquivado', userInfo)
  if (!result.success) {
    handleError(new Error(result.message), 'archiveDocument')
  }
  return result.document
}

/**
 * Restore an archived document to draft
 */
async function restoreDocument(id, userInfo = {}) {
  const result = await changeStatus(id, 'rascunho', userInfo)
  if (!result.success) {
    handleError(new Error(result.message), 'restoreDocument')
  }
  return result.document
}

/**
 * Delete a document (soft-delete via archive, or hard-delete for admins)
 */
async function deleteDocument(id, userInfo = {}) {
  const user = getUserInfo(userInfo)

  // Perform the delete first, then log only on success
  const { error } = await supabase
    .from('documentos')
    .delete()
    .eq('id', id)

  if (error) handleError(error, 'deleteDocument')

  // Log after successful deletion
  await logAction(id, 'deleted', user)

  return true
}

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Upload a file to Supabase Storage
 * Path: documentos/{categoria}/{docId}/v{version}/{filename}
 */
async function uploadFile(file, categoria, docId, version = 1) {
  const path = `${categoria}/${docId}/v${version}/${file.name}`

  const { error } = await supabase.storage
    .from('documentos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) handleError(error, 'uploadFile')

  const { data: urlData, error: urlError } = await supabase.storage
    .from('documentos')
    .createSignedUrl(path, 3600) // 1-hour expiration (LGPD: documents must not be permanently public)

  if (urlError) handleError(urlError, 'uploadFile:createSignedUrl')

  return {
    url: urlData?.signedUrl || null,
    path,
  }
}

/**
 * Get a signed URL for a private file
 */
async function getSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(storagePath, expiresIn)

  if (error) handleError(error, 'getSignedUrl')
  return data?.signedUrl || null
}

/**
 * Delete a file from storage
 */
async function deleteFile(storagePath) {
  const { error } = await supabase.storage
    .from('documentos')
    .remove([storagePath])

  if (error) handleError(error, 'deleteFile')
  return true
}

// ============================================================================
// DISTRIBUIÇÃO (Qmentum)
// ============================================================================

/**
 * Record that a user viewed a document
 */
async function recordView(docId, userInfo = {}) {
  const user = getUserInfo(userInfo)

  // Upsert distribution record with view timestamp
  await supabase
    .from('documento_distribuicao')
    .upsert(
      {
        documento_id: docId,
        user_id: user.userId,
        user_name: user.userName,
        visualizado_em: new Date().toISOString(),
      },
      { onConflict: 'documento_id,user_id' }
    )

  // Increment view count atomically via RPC if available, else read-then-write
  // TODO: Create RPC increment_view_count for atomic operation
  try {
    const { error: rpcError } = await supabase.rpc('increment_view_count', {
      doc_id: docId,
      cat: 'documentos',
    })
    if (rpcError) throw rpcError
  } catch {
    // Fallback: non-atomic read-then-write (race condition possible under concurrency)
    try {
      const { data: doc } = await supabase
        .from('documentos')
        .select('view_count')
        .eq('id', docId)
        .single()

      if (doc) {
        await supabase
          .from('documentos')
          .update({ view_count: (doc.view_count || 0) + 1 })
          .eq('id', docId)
      }
    } catch (fallbackErr) {
      console.warn('[SupabaseDocService] Failed to increment view_count:', fallbackErr)
    }
  }

  // Log view in changelog
  await logAction(docId, 'viewed', user)
}

/**
 * Record that a user acknowledged reading a document
 */
async function recordAcknowledgement(docId, userInfo = {}) {
  const user = getUserInfo(userInfo)

  await supabase
    .from('documento_distribuicao')
    .upsert(
      {
        documento_id: docId,
        user_id: user.userId,
        user_name: user.userName,
        reconhecido_em: new Date().toISOString(),
        visualizado_em: new Date().toISOString(),
      },
      { onConflict: 'documento_id,user_id' }
    )

  // Log acknowledgement
  await logAction(docId, 'acknowledged', user)
}

/**
 * Get distribution status for a document
 */
async function getDistributionStatus(docId) {
  const { data, error } = await supabase
    .from('documento_distribuicao')
    .select('*')
    .eq('documento_id', docId)
    .order('distribuido_em', { ascending: false })

  if (error) handleError(error, 'getDistributionStatus')
  return (data || []).map(toCamelCase)
}

/**
 * Distribute a document to multiple users.
 * Uses upsert to avoid duplicates when re-distributing.
 * @param {string} docId - Document ID
 * @param {Array<{userId: string, userName: string, userRole: string}>} users - Recipients
 * @param {object} userInfo - Info about the user performing the distribution
 * @returns {Array} The upserted distribution rows (camelCase)
 */
async function distributeDocument(docId, users, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const rows = users.map((u) => ({
    documento_id: docId,
    user_id: u.userId,
    user_name: u.userName,
    user_role: u.userRole,
    distribuido_em: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('documento_distribuicao')
    .upsert(rows, { onConflict: 'documento_id,user_id' })
    .select()

  if (error) handleError(error, 'distributeDocument')

  // Log distribution action
  await logAction(docId, 'distributed', user, { recipients: users.length })

  return (data || []).map(toCamelCase)
}

/**
 * Get full distribution list with status for a document.
 * @param {string} docId - Document ID
 * @returns {Array} Distribution rows ordered by most recent first (camelCase)
 */
async function getDistributionList(docId) {
  const { data, error } = await supabase
    .from('documento_distribuicao')
    .select('*')
    .eq('documento_id', docId)
    .order('distribuido_em', { ascending: false })

  if (error) handleError(error, 'getDistributionList')
  return (data || []).map(toCamelCase)
}

/**
 * Send a reminder to a specific user for a document.
 * Updates the lembrete_em timestamp on the distribution record.
 * @param {string} docId - Document ID
 * @param {string} userId - Target user ID
 * @param {object} userInfo - Info about the user sending the reminder
 * @returns {object} The updated distribution row (camelCase)
 */
async function sendReminder(docId, userId, userInfo = {}) {
  const { data, error } = await supabase
    .from('documento_distribuicao')
    .update({ lembrete_em: new Date().toISOString() })
    .eq('documento_id', docId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) handleError(error, 'sendReminder')

  return toCamelCase(data)
}

// ============================================================================
// APROVAÇÃO
// ============================================================================

/**
 * Submit an approval action (approve/reject/sign)
 */
async function submitApproval(docId, action, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const { data, error } = await supabase
    .from('documento_aprovacoes')
    .insert({
      documento_id: docId,
      approver_id: user.userId,
      approver_name: user.userName,
      approver_role: userInfo.role || null,
      action,
      comment: userInfo.comment || '',
      decided_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) handleError(error, 'submitApproval')

  // Log the approval action
  const logAction_ = action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'signature_added'
  await logAction(docId, logAction_, user, { action }, userInfo.comment || '')

  return toCamelCase(data)
}

/**
 * Get pending approvals for a specific user
 */
async function getMyPendingApprovals(userId) {
  const { data, error } = await supabase
    .from('documento_aprovacoes')
    .select('*, documentos(*)')
    .eq('approver_id', userId)
    .eq('action', 'pending')
    .order('created_at', { ascending: false })

  if (error) handleError(error, 'getMyPendingApprovals')
  return (data || []).map(toCamelCase)
}

/**
 * Set up an approval workflow for a document.
 * Updates the document's approval_workflow JSON and creates pending
 * approval records for each approver in order.
 * @param {string} docId - Document ID
 * @param {Array<{userId: string, userName: string, role: string}>} approvers - Ordered list of approvers
 * @param {object} userInfo - Info about the user setting up the workflow
 * @returns {Array} The inserted approval rows (camelCase)
 */
async function setApprovalWorkflow(docId, approvers, userInfo = {}) {
  const user = getUserInfo(userInfo)

  // Update the document's approval_workflow JSON
  const { error: updateErr } = await supabase
    .from('documentos')
    .update({
      approval_workflow: {
        requiredApprovers: approvers,
        currentStep: 0,
        status: 'in_progress',
      },
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', docId)

  if (updateErr) handleError(updateErr, 'setApprovalWorkflow:updateDoc')

  // Create pending approval records for each approver
  const rows = approvers.map((approver, index) => ({
    documento_id: docId,
    approver_id: approver.userId,
    approver_name: approver.userName,
    approver_role: approver.role,
    action: 'pending',
    step_order: index,
  }))

  const { data, error } = await supabase
    .from('documento_aprovacoes')
    .insert(rows)
    .select()

  if (error) handleError(error, 'setApprovalWorkflow:insertApprovers')

  // Log the workflow setup
  await logAction(docId, 'approval_workflow_set', user, {
    approvers: approvers.length,
    approverNames: approvers.map((a) => a.userName),
  })

  return (data || []).map(toCamelCase)
}

/**
 * Get approval workflow progress for a document.
 * Returns all approval records ordered by step.
 * @param {string} docId - Document ID
 * @returns {Array} Approval rows ordered by step_order (camelCase)
 */
async function getApprovalProgress(docId) {
  const { data, error } = await supabase
    .from('documento_aprovacoes')
    .select('*')
    .eq('documento_id', docId)
    .order('step_order', { ascending: true })

  if (error) handleError(error, 'getApprovalProgress')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// REAL-TIME
// ============================================================================

/**
 * Subscribe to all document changes (INSERT, UPDATE, DELETE)
 * @param {Function} callback - Called with { eventType, new, old }
 * @returns {RealtimeChannel} — call unsubscribe(channel) to stop
 */
function subscribeToAll(callback) {
  const channel = supabase
    .channel('documentos-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'documentos' },
      (payload) => {
        callback({
          eventType: payload.eventType, // INSERT | UPDATE | DELETE
          new: payload.new ? toCamelCase(payload.new) : null,
          old: payload.old ? toCamelCase(payload.old) : null,
        })
      }
    )
    .subscribe()

  return channel
}

/**
 * Unsubscribe from a real-time channel
 */
function unsubscribe(channel) {
  if (channel) {
    supabase.removeChannel(channel)
  }
}

// ============================================================================
// INTERNAL — Audit Trail Logger
// ============================================================================

async function logAction(docId, action, user, changes = {}, comment = '') {
  try {
    await supabase.rpc('rpc_log_document_action', {
      p_documento_id: docId,
      p_action: action,
      p_user_id: user.userId,
      p_user_name: user.userName,
      p_user_email: user.userEmail || null,
      p_changes: changes,
      p_comment: comment,
    })
  } catch (err) {
    // Don't fail the main operation if logging fails
    console.warn('[SupabaseDocService] Failed to log action:', err)
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseDocumentService = {
  // Leitura
  fetchAllDocuments,
  fetchByCategory,
  fetchById,
  search,
  fetchVersions,
  fetchChangelog,
  fetchComplianceMetrics,
  fetchOverdueDocuments,
  fetchUpcomingReviews,
  fetchPendingApproval,
  fetchRecentActivity,

  // Escrita
  createDocument,
  updateDocument,
  changeStatus,
  addVersion,
  archiveDocument,
  restoreDocument,
  deleteDocument,

  // Storage
  uploadFile,
  getSignedUrl,
  deleteFile,

  // Distribuição
  recordView,
  recordAcknowledgement,
  getDistributionStatus,
  distributeDocument,
  getDistributionList,
  sendReminder,

  // Aprovação
  submitApproval,
  getMyPendingApprovals,
  setApprovalWorkflow,
  getApprovalProgress,

  // Real-time
  subscribeToAll,
  unsubscribe,
}

export { toCamelCase as documentToCamelCase }

export default supabaseDocumentService
