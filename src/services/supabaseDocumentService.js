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
import { requireUserId, tryRequireUserId } from '@/utils/audit'
import { validateFile, ACCEPTED_DOCUMENT_TYPES } from '@/services/uploadService'
import { sha256OfBlob } from '@/utils/hashUtils'
import { isOcrEnabled, isBulkImportEnabled, isPdfaEnabled } from '@/utils/featureFlags'
import { enqueue as enqueueOffline } from '@/utils/offlineQueue'
import { registerHandler } from '@/services/offlineQueueProcessor'
import { registerReplayHandler } from '@/services/conflictReplayRegistry'

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
  signedPdfUrl: 'signed_pdf_url',
  signedPdfStoragePath: 'signed_pdf_storage_path',
  signatureAlgo: 'signature_algo',
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
  confidentialityLevel: 'confidentiality_level',
  localArmazenamento: 'local_armazenamento',
  responsavelElaboracao: 'responsavel_elaboracao',
  responsavelAprovacao: 'responsavel_aprovacao',
  // Onda1-3 — Retention + Legal hold
  legalHold: 'legal_hold',
  legalHoldReason: 'legal_hold_reason',
  legalHoldSetAt: 'legal_hold_set_at',
  legalHoldSetBy: 'legal_hold_set_by',
  retentionUntil: 'retention_until',
  retentionPolicyId: 'retention_policy_id',
  // Sprint 4 / Onda 2 — OCR
  ocrStatus: 'ocr_status',
  ocrText: 'ocr_text',
  ocrTextUrl: 'ocr_text_url',
  ocrEngine: 'ocr_engine',
  ocrConfidence: 'ocr_confidence',
  ocrPagesProcessed: 'ocr_pages_processed',
  ocrRunAt: 'ocr_run_at',
  ocrFailCount: 'ocr_fail_count',
  // Sprint 5 / Onda 2 — Bulk import
  bulkImportId: 'bulk_import_id',
  // Sprint 6 / Onda 2 — PDF/A
  pdfaStatus: 'pdfa_status',
  pdfaUrl: 'pdfa_url',
  pdfaProcessedAt: 'pdfa_processed_at',
  pdfaPages: 'pdfa_pages',
  pdfaSizeBytes: 'pdfa_size_bytes',
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

/**
 * @deprecated Use {@link requireUserId} from `@/utils/audit` directly.
 * Kept as a thin wrapper for migration purposes — every internal mutation
 * now must pass a real userInfo. Throws if userInfo is missing/invalid.
 */
function getUserInfo(userInfo = {}, context = 'supabaseDocumentService') {
  return requireUserId(userInfo, context)
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
 * Whitelist of columns selected for documentos listings.
 *
 * W3-4: explicitly excludes the `fts` tsvector column. `select('*')` was
 * pulling tsvector payloads (often >1KB per row) over the wire even though
 * the frontend never reads them — `toCamelCase` drops the field client-side
 * but the bandwidth cost was already paid. With 5k rows × ~1.5KB tsvector,
 * cold start was wasting ~7-8 MB per page load.
 *
 * Keep this list in sync with `documentos` schema (001_schema.sql + Wave 0+
 * additions: deleted_at, deleted_by, legal_hold_*, retention_*,
 * confidentiality_level).
 */
const DOC_LIST_COLUMNS_BASE = [
  'id', 'codigo', 'titulo', 'descricao', 'tipo',
  'categoria', 'subcategoria', 'status', 'versao_atual',
  'setor_id', 'setor_nome', 'responsavel', 'responsavel_revisao',
  'arquivo_url', 'arquivo_nome', 'arquivo_tamanho', 'storage_path',
  'proxima_revisao', 'intervalo_revisao_dias', 'rop_area',
  'qmentum_weight', 'approval_workflow',
  'tags', 'observacoes', 'view_count', 'download_count',
  'created_by', 'created_by_name', 'created_by_email',
  'updated_by', 'updated_by_name',
  'created_at', 'updated_at',
  'deleted_at', 'deleted_by',
  'legal_hold', 'legal_hold_reason', 'legal_hold_set_at', 'legal_hold_set_by',
  'retention_until', 'retention_policy_id',
  'confidentiality_level',
]

const DOC_LIST_COLUMNS_OCR = [
  'ocr_status', 'ocr_text', 'ocr_confidence', 'ocr_pages_processed', 'ocr_run_at',
  'ocr_fail_count',
]

const DOC_LIST_COLUMNS_BULK = ['bulk_import_id']

const DOC_LIST_COLUMNS_PDFA = [
  'pdfa_status', 'pdfa_url', 'pdfa_processed_at', 'pdfa_pages', 'pdfa_size_bytes',
]

// Gated por feature flag — colunas opcionais só entram no SELECT quando a
// flag correspondente está ligada e a migration foi aplicada em prod.
function buildDocListColumns() {
  const cols = [...DOC_LIST_COLUMNS_BASE]
  if (isOcrEnabled()) cols.push(...DOC_LIST_COLUMNS_OCR)
  if (isBulkImportEnabled()) cols.push(...DOC_LIST_COLUMNS_BULK)
  if (isPdfaEnabled()) cols.push(...DOC_LIST_COLUMNS_PDFA)
  return cols.join(',')
}

/**
 * Fetch documents grouped by category. Pagina até esgotar a base.
 *
 * Histórico: W3-4 introduziu `range(0, 49)` para evitar payload de 10MB
 * em uma base de 5k linhas. Em 2026-05, com base real de ~110 docs e
 * `updated_at` idêntico para a maioria (seed em lote), a ordenação ficava
 * instável e o cutoff em 50 fazia docs sumirem na Biblioteca. Solução:
 * paginar até batch parcial (`< pageSize`).
 *
 * `fts` é excluído via {@link buildDocListColumns} para economizar
 * bandwidth (tsvector pesado, nunca lido no frontend).
 *
 * @param {object} [opts]
 * @param {number} [opts.pageSize=200] - Rows per page (loop até esgotar).
 * @returns {Promise<Record<string, Array>>} Same grouped shape as before.
 */
async function fetchAllDocuments({ pageSize = 200 } = {}) {
  const cols = buildDocListColumns()
  const all = []
  let offset = 0
  // Safety cap evita loop infinito caso o servidor devolva sempre pageSize
  // (não deve acontecer, mas vale o cinto e suspensórios em código de boot).
  const maxBatches = 50

  for (let batch = 0; batch < maxBatches; batch++) {
    const { data, error } = await supabase
      .from('documentos')
      .select(cols)
      .is('deleted_at', null) // soft-deleted não aparece (consistência Biblioteca↔Centro)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) handleError(error, 'fetchAllDocuments')

    const rows = data || []
    all.push(...rows)
    if (rows.length < pageSize) break
    offset += pageSize
  }

  // Group by category — keys batem com o CHECK constraint atual da tabela
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

  for (const row of all) {
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
    .select(buildDocListColumns())
    .eq('categoria', categoria)
    .is('deleted_at', null) // soft-deleted não aparece (consistência Biblioteca↔Centro)
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
    .select(buildDocListColumns())
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
 * Fetch metadata of two specific versions for diff comparison (O2-8).
 * Returns { vA, vB } com signed URLs e ocr_text quando disponível.
 *
 * vA = versão anterior (numericamente menor); vB = versão posterior.
 */
async function fetchVersionsForDiff(docId, versionA, versionB) {
  if (versionA === versionB) throw new Error('fetchVersionsForDiff: versões iguais')
  const [vOld, vNew] = versionA < versionB ? [versionA, versionB] : [versionB, versionA]
  const { data, error } = await supabase
    .from('documento_versoes')
    .select('*')
    .eq('documento_id', docId)
    .in('versao', [vOld, vNew])
  if (error) handleError(error, 'fetchVersionsForDiff')
  if (!data || data.length < 2) {
    throw new Error(`fetchVersionsForDiff: encontradas ${data?.length ?? 0} versões (esperado 2)`)
  }
  const camel = data.map(toCamelCase)
  const vA = camel.find((r) => r.versao === vOld)
  const vB = camel.find((r) => r.versao === vNew)
  // Signed URLs paralelas
  const [urlA, urlB] = await Promise.all([
    vA?.storagePath ? getSignedUrl(vA.storagePath, 1800) : null,
    vB?.storagePath ? getSignedUrl(vB.storagePath, 1800) : null,
  ])
  return {
    vA: { ...vA, signedUrl: urlA },
    vB: { ...vB, signedUrl: urlB },
  }
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
  const { error: verErr } = await supabase.from('documento_versoes').insert({
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
  if (verErr) console.error('[SupabaseDocService] createDocument:insertVersion:', verErr)

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
 * Add a new version to a document.
 *
 * W3-4: previously this fanned out 4 round-trips (fetch → archive → insert
 * → update) with no transactional boundary. If any step after the first
 * failed, the document was left with an inconsistent `versao_atual` /
 * versions list. Now everything happens in a single SQL transaction
 * via `rpc_add_document_version` — version row insert, archive of old
 * actives, update of `documentos.versao_atual`, and audit changelog all
 * commit or roll back together.
 *
 * Signature is preserved: `addVersion(docId, versionData, userInfo)`
 * returns the inserted version row in camelCase, same as before.
 */
async function addVersion(docId, versionData, userInfo = {}) {
  const user = getUserInfo(userInfo)

  const snakeVersion = toSnakeCase(versionData)

  const { data, error } = await supabase.rpc('rpc_add_document_version', {
    p_doc_id: docId,
    p_version_data: {
      arquivo_url: snakeVersion.arquivo_url || null,
      arquivo_nome: snakeVersion.arquivo_nome || null,
      arquivo_tamanho: snakeVersion.arquivo_tamanho || null,
      storage_path: snakeVersion.storage_path || null,
      descricao_alteracao: snakeVersion.descricao_alteracao || 'Atualização do documento',
      motivo_alteracao: snakeVersion.motivo_alteracao || 'Revisão',
    },
    p_user_info: {
      user_id: user.userId,
      user_name: user.userName,
      user_email: user.userEmail || null,
    },
  })

  if (error) handleError(error, 'addVersion')

  // RPC returns either the inserted row directly or wraps it under `version`.
  // Be defensive — same camelCase contract as the legacy implementation.
  const versionRow = data?.version || data
  return toCamelCase(versionRow)
}

/**
 * Archive a document — moves to status 'arquivado' and section 'obsoletos'
 * @param {string} id - Document ID
 * @param {Object} userInfo - User performing the action
 * @param {string} [archiveSubsection] - Subsection within "10 Obsoletos" (e.g. 'governanca', 'financeiro')
 */
async function archiveDocument(id, userInfo = {}, archiveSubsection = '') {
  const result = await changeStatus(id, 'arquivado', userInfo)
  if (!result.success) {
    handleError(new Error(result.message), 'archiveDocument')
  }

  // Move document to "10 Obsoletos" section with chosen subsection
  if (archiveSubsection) {
    const user = getUserInfo(userInfo)
    const updateFields = {
      subcategoria: 'obsoletos',
      tipo: archiveSubsection,
      updated_by: user.userId,
      updated_by_name: user.userName,
    }

    const { error } = await supabase
      .from('documentos')
      .update(updateFields)
      .eq('id', id)

    if (error) handleError(error, 'archiveDocument:moveToObsoletos')

    // Log the section move
    await logAction(id, 'updated', user, {
      subcategoriaAnterior: result.document?.subcategoria || '',
      subcategoriaNova: 'obsoletos',
      tipoObsoletos: archiveSubsection,
    }, 'Documento arquivado para seção 10 Obsoletos')
  }

  // PDF/A pipeline (Sprint 6 / O2-3): fire-and-forget marca pending na DB.
  // Caller (UI hook usePdfaPipeline) dispara a edge function quando flag ON.
  try {
    if (typeof window !== 'undefined' && result.document?.storagePath) {
      const { isPdfaEnabled } = await import('@/utils/featureFlags')
      if (isPdfaEnabled()) {
        const user = getUserInfo(userInfo)
        await supabase.rpc('rpc_request_pdfa_conversion', {
          p_documento_id: id,
          p_user_id: user.userId,
        })
      }
    }
  } catch (err) {
    console.warn('[archiveDocument] rpc_request_pdfa_conversion falhou:', err?.message)
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
 * Soft-delete a document.
 *
 * Sets `deleted_at` and `deleted_by` instead of executing a physical DELETE.
 * Required to preserve the audit trail: the previous hard-delete (DELETE FROM
 * documentos WHERE id=X) cascaded to documento_changelog ON DELETE CASCADE,
 * destroying ALL audit entries before logAction('deleted') could run. This
 * was a CRITICAL forensic gap (auditoria 2026-05-04, Agente 8).
 *
 * The migration `20260504100300_soft_delete_documentos.sql` adds the columns,
 * the trigger that rejects physical DELETE, and changes the changelog FK to
 * ON DELETE SET NULL.
 */
async function deleteDocument(id, userInfo = {}) {
  const user = requireUserId(userInfo, 'deleteDocument')

  const { error } = await supabase
    .from('documentos')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.userId,
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', id)

  if (error) handleError(error, 'deleteDocument')

  // Log AFTER the soft-delete succeeded. Changelog row references the
  // (now soft-deleted) document via its FK, which now uses ON DELETE SET NULL,
  // so even if a subsequent hard-purge removes the document, the changelog
  // entry survives orphan with documento_id=NULL.
  await logAction(id, 'deleted', user, {
    deleted_at: new Date().toISOString(),
  })

  return true
}

/**
 * Restore a soft-deleted document (admin or original author).
 */
async function restoreFromTrash(id, userInfo = {}) {
  const user = requireUserId(userInfo, 'restoreFromTrash')

  const { error } = await supabase
    .from('documentos')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: user.userId,
      updated_by_name: user.userName,
    })
    .eq('id', id)

  if (error) handleError(error, 'restoreFromTrash')

  await logAction(id, 'restored', user, { restored_at: new Date().toISOString() })
  return true
}

// ============================================================================
// LEGAL HOLD (Onda1-3)
// ============================================================================

/**
 * Aplica ou remove o legal hold sobre um documento.
 *
 * Quando `options.hold = true`:
 *   - Marca legal_hold = true e registra reason / setAt / setBy.
 *   - Trigger `trg_prevent_delete_if_legal_hold` passa a bloquear DELETE
 *     físico e qualquer UPDATE que faça transição deleted_at NULL → NOT NULL.
 *
 * Quando `options.hold = false`:
 *   - Reseta legal_hold = false e limpa reason / setAt / setBy.
 *
 * Sempre cria entrada no changelog ('legal_hold_set' / 'legal_hold_released').
 *
 * @param {string} docId
 * @param {string} reason - Motivo (obrigatório quando hold=true)
 * @param {object} userInfo - {userId, userName, userEmail}
 * @param {object} [options]
 * @param {boolean} [options.hold=true]
 * @returns {Promise<object>} documento atualizado em camelCase
 */
async function setLegalHold(docId, reason, userInfo = {}, options = {}) {
  const user = requireUserId(userInfo, 'setLegalHold')
  const hold = options.hold !== false // default true

  if (hold && (!reason || String(reason).trim().length === 0)) {
    throw new Error('setLegalHold: motivo é obrigatório ao aplicar legal hold')
  }

  const updates = hold
    ? {
        legal_hold: true,
        legal_hold_reason: String(reason).trim(),
        legal_hold_set_at: new Date().toISOString(),
        legal_hold_set_by: user.userId,
        updated_by: user.userId,
        updated_by_name: user.userName,
      }
    : {
        legal_hold: false,
        legal_hold_reason: null,
        legal_hold_set_at: null,
        legal_hold_set_by: null,
        updated_by: user.userId,
        updated_by_name: user.userName,
      }

  const { data, error } = await supabase
    .from('documentos')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()

  if (error) handleError(error, 'setLegalHold')

  await logAction(
    docId,
    hold ? 'legal_hold_set' : 'legal_hold_released',
    user,
    { reason: hold ? String(reason).trim() : null },
  )

  return toCamelCase(data)
}

// ============================================================================
// OCR (Sprint 4 / Onda 2 / O2-2)
// ----------------------------------------------------------------------------
// State machine para `documentos.ocr_status`. O OCR em si roda client-side
// via {@link import('./ocrService.js').runOcr}; aqui ficam apenas as
// transições de estado + persistência do texto extraído.
//
// Fluxo típico:
//   1. uploadFile → markOcrPending(docId)
//   2. detectIfScanned() → markOcrNotNeeded(docId) (PDF text-based)
//                         OU markOcrProcessing(docId) + runOcr() + persistOcrResult()
//   3. Falha → markOcrFailed(docId, error)
//
// O trigger SQL `tr_doc_fts` reindexa automaticamente quando ocr_text muda.
// ============================================================================

const OCR_STATUSES = ['pending', 'processing', 'done', 'failed', 'skipped', 'not_needed']

async function _setOcrStatus(docId, status, userInfo, extras = {}, action = null) {
  if (!OCR_STATUSES.includes(status)) {
    throw new Error(`OCR status inválido: ${status}`)
  }
  const user = requireUserId(userInfo, '_setOcrStatus')
  const updates = {
    ocr_status: status,
    ocr_run_at: new Date().toISOString(),
    ...extras,
  }
  const { data, error } = await supabase
    .from('documentos')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()

  if (error) handleError(error, '_setOcrStatus')
  if (action) await logAction(docId, action, user, { ocr_status: status })
  return toCamelCase(data)
}

/**
 * Marca documento como aguardando OCR. Disparado logo após upload bem-sucedido
 * (antes mesmo da heurística rodar) para tornar o estado visível na UI.
 */
async function markOcrPending(docId, userInfo = {}) {
  return _setOcrStatus(docId, 'pending', userInfo)
}

/**
 * Marca documento como em processamento (OCR rodando no client).
 */
async function markOcrProcessing(docId, userInfo = {}) {
  return _setOcrStatus(docId, 'processing', userInfo, {}, 'ocr_started')
}

/**
 * Marca documento como text-based (OCR não necessário).
 *
 * @param {string} docId
 * @param {object} userInfo
 * @param {object} detectionMeta - resultado do detectIfScanned (charsPerPage etc.)
 */
async function markOcrNotNeeded(docId, userInfo = {}, detectionMeta = {}) {
  const user = requireUserId(userInfo, 'markOcrNotNeeded')
  const updates = {
    ocr_status: 'not_needed',
    ocr_run_at: new Date().toISOString(),
    ocr_pages_processed: detectionMeta.totalPages ?? null,
  }
  const { data, error } = await supabase
    .from('documentos')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()
  if (error) handleError(error, 'markOcrNotNeeded')
  await logAction(docId, 'ocr_skipped', user, {
    reason: 'text_based',
    chars_per_page: detectionMeta.charsPerPage ?? null,
    total_chars: detectionMeta.totalChars ?? null,
  })
  return toCamelCase(data)
}

/**
 * Marca OCR como falho. Não armazena exception completa por privacidade,
 * apenas a primeira linha da mensagem (truncada) no changelog.
 */
async function markOcrFailed(docId, userInfo = {}, errorMessage = '') {
  const user = requireUserId(userInfo, 'markOcrFailed')
  const updates = {
    ocr_status: 'failed',
    ocr_run_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('documentos')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()
  if (error) handleError(error, 'markOcrFailed')
  const truncated = String(errorMessage || '').split('\n')[0].slice(0, 200)
  await logAction(docId, 'ocr_failed', user, { error: truncated })
  // Issue #12: incrementa contador atomicamente para retry-cap.
  try { await supabase.rpc('rpc_increment_ocr_fail_count', { p_documento_id: docId }) } catch (_) { /* ignore */ }
  return toCamelCase(data)
}

/**
 * Lê o contador de falhas consecutivas do OCR. useOcrPipeline usa para
 * decidir se permite retry (cap em 3 — issue #12).
 */
async function getOcrFailCount(docId) {
  const { data, error } = await supabase
    .from('documentos')
    .select('ocr_fail_count')
    .eq('id', docId)
    .single()
  if (error) {
    console.warn('[getOcrFailCount]', error.message)
    return 0
  }
  return data?.ocr_fail_count ?? 0
}

/**
 * Persiste o resultado do OCR: texto, confidence, métricas. Por design o
 * texto vai direto no campo `ocr_text` (não em storage). Trigger SQL
 * reindexa fts automaticamente.
 *
 * @param {string} docId
 * @param {{text:string, confidence:number, pagesProcessed:number, engine:string, durationMs?:number}} ocr
 * @param {object} userInfo
 */
async function persistOcrResult(docId, ocr, userInfo = {}) {
  const user = requireUserId(userInfo, 'persistOcrResult')
  if (typeof ocr?.text !== 'string') {
    throw new Error('persistOcrResult: ocr.text obrigatório')
  }
  const updates = {
    ocr_status: 'done',
    ocr_text: ocr.text,
    ocr_engine: ocr.engine,
    ocr_confidence: typeof ocr.confidence === 'number' ? ocr.confidence : null,
    ocr_pages_processed: ocr.pagesProcessed ?? null,
    ocr_run_at: new Date().toISOString(),
    ocr_fail_count: 0, // Issue #12: reset retry-cap em sucesso
  }
  const { data, error } = await supabase
    .from('documentos')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()
  if (error) handleError(error, 'persistOcrResult')
  await logAction(docId, 'ocr_completed', user, {
    chars: ocr.text.length,
    pages: ocr.pagesProcessed ?? null,
    confidence: ocr.confidence ?? null,
    duration_ms: ocr.durationMs ?? null,
    engine: ocr.engine ?? null,
  })
  return toCamelCase(data)
}

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Upload a file to Supabase Storage.
 * Path: documentos/{categoria}/{docId}/v{version}/{filename}
 *
 * Returns ONLY `{ path, size, type }`. Does NOT generate a signed URL \u2014
 * that responsibility belongs to the consumer at render time, because
 * Supabase signed URLs expire (default 1h). Storing the URL in the DB
 * caused the bug where attached PDFs became 403 after one hour
 * (auditoria 2026-05-04, Agente 2 \u2014 root cause #2 of "anexar documentos").
 *
 * Use {@link getSignedUrl} on demand to render the file.
 *
 * @param {File|Blob} file
 * @param {string} categoria - Must match documentos.categoria CHECK constraint
 * @param {string} docId
 * @param {number} version
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=60000] - Abort upload after N ms
 * @returns {Promise<{path: string, size: number, type: string}>}
 */
async function uploadFile(file, categoria, docId, version = 1, opts = {}) {
  // 1. Validate file (MIME, size). uploadService.validateFile throws.
  validateFile(file, 'document')

  // 2. Sanitize filename (preserve Unicode safety + lowercase + dashes)
  const sanitizedName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
  const path = `${categoria}/${docId}/v${version}/${sanitizedName}`

  // 3. Timeout via AbortController. Default 60s \u2014 slow 3G uploads of ~5MB
  // PDFs take ~28s; 60s gives headroom without hanging indefinitely.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)

  try {
    const { error } = await supabase.storage
      .from('documentos')
      .upload(path, file, {
        cacheControl: '3600',
        // upsert: true \u2014 path already includes UUID, collisions impossible.
        // Allows safe retry after transient network failures (audit 2026-05-04).
        upsert: true,
        // The Supabase JS SDK forwards `signal` to fetch under the hood.
        // If unsupported in the runtime, the timeout still triggers via
        // controller.abort() and the fetch rejects.
        // @ts-expect-error \u2014 signal is accepted at the http layer
        signal: controller.signal,
      })

    if (error) handleError(error, 'uploadFile')

    return {
      path,
      size: file.size,
      type: file.type || ACCEPTED_DOCUMENT_TYPES[0],
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      handleError(
        new Error(`Upload exceeded timeout (${opts.timeoutMs ?? 60_000}ms). Verifique sua conex\u00e3o.`),
        'uploadFile:timeout'
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
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
 * Record that a user viewed a document.
 *
 * W3-4: replaces the previous read-then-write counter (race-prone under
 * concurrent reads) with the atomic RPC `rpc_increment_view_count`, which
 * does the UPDATE and the audit-log INSERT in a single transaction
 * server-side.
 *
 * Uses {@link tryRequireUserId} (non-throwing) because viewing should not
 * block the UI when auth is mid-refresh. If userId is missing, view is
 * still rendered but no audit row is written. This is intentional and
 * documented per `audit-trail.md` guidance for non-mutating reads.
 */
async function recordView(docId, userInfo = {}) {
  const user = tryRequireUserId(userInfo, 'recordView')
  if (!user) {
    // Anonymous read — skip audit silently. Document still renders.
    return
  }

  // Upsert distribution record with view timestamp (separate concern: per-user
  // distribution status; not part of the global view counter).
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

  // Atomic increment + audit row in a single transaction (server-side).
  const { error: rpcError } = await supabase.rpc('rpc_increment_view_count', {
    p_doc_id: docId,
    p_user_id: user.userId,
    p_user_name: user.userName,
    p_user_email: user.userEmail || null,
  })

  if (rpcError) {
    // Counters are best-effort; never block the read path. Log and move on.
    console.warn('[SupabaseDocService] rpc_increment_view_count failed:', rpcError)
  }
}

/**
 * Internal: executa o upsert + audit log do acknowledgement.
 *
 * Replay safety: upsert é idempotente; logAction pode duplicar audit row em retry.
 * Aceito porque audit ausente é pior que audit duplicado.
 */
async function _doRecordAcknowledgement({ docId, userId, userName, userEmail, timestamp }) {
  const { error } = await supabase
    .from('documento_distribuicao')
    .upsert(
      {
        documento_id: docId,
        user_id: userId,
        user_name: userName,
        reconhecido_em: timestamp,
        visualizado_em: timestamp,
      },
      { onConflict: 'documento_id,user_id' }
    )

  if (error) throw error

  // Log acknowledgement — preserva o user object original pro logAction.
  await logAction(docId, 'acknowledged', { userId, userName, userEmail })
}

// Sprint 14a / F6.2: registra handler para flush offline.
registerHandler('documento.recordAcknowledgement', _doRecordAcknowledgement)

// Sprint 15a / F6.3 closeout: replay handler para conflict queue.
// `_doRecordAcknowledgement` é idempotente no upsert; `logAction` pode
// duplicar audit row em retry (aceito — ver comentário da função).
registerReplayHandler(
  'documento.recordAcknowledgement',
  (payload /* , userInfo */) => _doRecordAcknowledgement(payload)
)

/**
 * Record that a user acknowledged reading a document.
 *
 * Sprint 14a / F6.2: replica o pattern offline queue de
 * `confirmLeitura` (Sprint 10). Quando offline, enfileira a operação
 * em IndexedDB e devolve void (resposta otimista). Quando online,
 * executa direto; em network error idiomatic, faz fallback enqueue.
 */
async function recordAcknowledgement(docId, userInfo = {}) {
  const user = getUserInfo(userInfo)
  const timestamp = new Date().toISOString()
  const payload = {
    docId,
    userId: user.userId,
    userName: user.userName,
    userEmail: user.userEmail || null,
    timestamp,
  }

  // Modo offline: persiste na queue, devolve resposta otimista.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'documento.recordAcknowledgement', payload })
    } catch (err) {
      handleError(err, 'recordAcknowledgement.enqueue')
    }
    return
  }

  try {
    await _doRecordAcknowledgement(payload)
  } catch (error) {
    // Network falhou (sem ser erro de RLS/business): tenta enqueue como fallback.
    const isNetworkError = !error?.code && /fetch|network|failed/i.test(error?.message || '')
    if (isNetworkError) {
      try {
        await enqueueOffline({ op: 'documento.recordAcknowledgement', payload })
        return
      } catch (enqErr) {
        handleError(enqErr, 'recordAcknowledgement.enqueue')
      }
    }
    handleError(error, 'recordAcknowledgement')
  }
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
  // Audit trail é obrigatório (regra audit-trail.md). Se a sessão expirou,
  // o caller precisa re-autenticar antes de tentar novamente.
  const sender = requireUserId(userInfo, 'sendReminder')

  const { data, error } = await supabase
    .from('documento_distribuicao')
    .update({ lembrete_em: new Date().toISOString() })
    .eq('documento_id', docId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) handleError(error, 'sendReminder')

  await logAction(docId, 'reminder_sent', sender, { target_user_id: userId })

  return toCamelCase(data)
}

// ============================================================================
// APROVAÇÃO
// ============================================================================

/**
 * Submit an approval action (approve/reject/sign).
 *
 * When the feature flag `VITE_FEATURE_HASH_SIGNATURE` is enabled, the action
 * is `'approved'`, AND `options.pdfBlob` is provided, this function:
 *   1. Inserts the aprovação row (without hash/url) to obtain its UUID.
 *   2. Computes SHA-256 of the PDF blob.
 *   3. Uploads an immutable copy of the PDF to
 *      `documentos-assinados/{docId}/{aprovacaoId}.pdf`.
 *   4. Updates the row with `signature_hash`, `signed_pdf_storage_path`,
 *      `signed_pdf_url` (a 1-week signed URL), and `signature_algo='SHA-256'`.
 *
 * If the feature flag is off OR `pdfBlob` is missing, the historical
 * behaviour is preserved (single insert without signature columns).
 *
 * @param {string} docId
 * @param {'approved'|'rejected'|'signed'|string} action
 * @param {object} [userInfo]
 * @param {object} [options]
 * @param {Blob|null} [options.pdfBlob] PDF a ser hash + arquivado quando action='approved'.
 */
async function submitApproval(docId, action, userInfo = {}, options = {}) {
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

  let row = data

  // ---------------------------------------------------------------------
  // Onda1-1: SHA-256 + signed PDF (feature-flagged)
  // ---------------------------------------------------------------------
  // Lê a flag dentro da função para que mocks de import.meta.env em testes
  // funcionem e para evitar leitura no carregamento do módulo.
  const flagEnabled =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_FEATURE_HASH_SIGNATURE === 'true'

  if (flagEnabled && action === 'approved' && options.pdfBlob instanceof Blob) {
    try {
      const hash = await sha256OfBlob(options.pdfBlob)
      const storagePath = `${docId}/${row.id}.pdf`

      // Upload imutável da cópia assinada — bucket `documentos-assinados`
      const { error: upErr } = await supabase.storage
        .from('documentos-assinados')
        .upload(storagePath, options.pdfBlob, {
          cacheControl: '3600',
          upsert: false, // imutável: path inclui aprovacaoId único
          contentType: options.pdfBlob.type || 'application/pdf',
        })

      if (upErr) {
        // Não bloqueia a aprovação, mas registra para audit. Hash/url ficam
        // null e podem ser recuperados em job de reconciliação se necessário.
        console.error('[submitApproval] signed-pdf upload failed:', upErr)
      } else {
        // Signed URL com validade longa (7 dias) — UI re-gera quando expira.
        const { data: signed, error: signErr } = await supabase.storage
          .from('documentos-assinados')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7)

        if (signErr) {
          console.error('[submitApproval] createSignedUrl failed:', signErr)
        }

        const { data: updated, error: updErr } = await supabase
          .from('documento_aprovacoes')
          .update({
            signature_hash: hash,
            signature_algo: 'SHA-256',
            signed_pdf_storage_path: storagePath,
            signed_pdf_url: signed?.signedUrl || null,
          })
          .eq('id', row.id)
          .select()
          .single()

        if (updErr) {
          console.error('[submitApproval] hash update failed:', updErr)
        } else {
          row = updated
        }
      }
    } catch (hashErr) {
      // Falha no hash não deve invalidar a aprovação; apenas log.
      console.error('[submitApproval] SHA-256 / signed PDF pipeline failed:', hashErr)
    }
  }

  // Log the approval action
  const logAction_ = action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'signature_added'
  await logAction(docId, logAction_, user, { action }, userInfo.comment || '')

  return toCamelCase(row)
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
// MULTI-STEP APPROVAL (Onda 1.5) — gated by VITE_FEATURE_MULTI_STEP_APPROVAL
// ============================================================================

/**
 * Configura workflow multi-step para um documento. Apaga steps existentes e
 * cria os novos. Cada step tem `mode` (sequential|parallel|any_one), uma
 * lista de aprovadores e um deadline opcional em dias.
 *
 * @param {string} docId
 * @param {Array<{mode: string, approverIds: string[], deadlineDays?: number}>} steps
 * @param {object} userInfo
 */
async function setMultiStepApprovalWorkflow(docId, steps, userInfo = {}) {
  const user = requireUserId(userInfo, 'setMultiStepApprovalWorkflow')

  // Apaga steps existentes (cascateia via referência? Não — limpa tudo manualmente).
  const { error: delErr } = await supabase
    .from('documento_approval_steps')
    .delete()
    .eq('documento_id', docId)
  if (delErr) handleError(delErr, 'setMultiStepApprovalWorkflow:delete')

  if (Array.isArray(steps) && steps.length > 0) {
    const rows = steps.map((s, i) => ({
      documento_id: docId,
      step_order: i,
      mode: s.mode,
      approver_ids: s.approverIds || [],
      deadline_days: typeof s.deadlineDays === 'number' ? s.deadlineDays : null,
      status: 'pending',
    }))
    const { error } = await supabase.from('documento_approval_steps').insert(rows)
    if (error) handleError(error, 'setMultiStepApprovalWorkflow:insert')
  }

  await logAction(docId, 'approval_workflow_set', user, {
    stepCount: Array.isArray(steps) ? steps.length : 0,
    multiStep: true,
  })
}

/**
 * Lê os steps de approval workflow definidos para um documento.
 */
async function getApprovalSteps(docId) {
  const { data, error } = await supabase
    .from('documento_approval_steps')
    .select('*')
    .eq('documento_id', docId)
    .order('step_order', { ascending: true })

  if (error) handleError(error, 'getApprovalSteps')
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
  fetchVersionsForDiff,
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
  restoreFromTrash,

  // Legal hold (Onda1-3)
  setLegalHold,

  // OCR (Sprint 4 / Onda 2)
  markOcrPending,
  markOcrProcessing,
  markOcrNotNeeded,
  markOcrFailed,
  persistOcrResult,
  getOcrFailCount,

  // Distribuição
  recordView,
  recordAcknowledgement,
  getDistributionStatus,
  distributeDocument,
  getDistributionList,
  sendReminder,

  // Audit
  logAction,

  // Aprovação
  submitApproval,
  getMyPendingApprovals,
  setApprovalWorkflow,
  getApprovalProgress,

  // Aprovação multi-step (Onda 1.5)
  setMultiStepApprovalWorkflow,
  getApprovalSteps,

  // Real-time
  subscribeToAll,
  unsubscribe,
}

export { toCamelCase as documentToCamelCase }
export { buildDocListColumns, DOC_LIST_COLUMNS_BASE, DOC_LIST_COLUMNS_OCR, DOC_LIST_COLUMNS_BULK, DOC_LIST_COLUMNS_PDFA }

export default supabaseDocumentService
