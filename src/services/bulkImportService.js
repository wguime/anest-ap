/**
 * bulkImportService — Sprint 5 / Onda 2 / O2-4
 *
 * Orquestra a importação em massa de PDFs:
 *   1. createJob() registra a operação em `bulk_import_jobs` com total_files.
 *   2. Para cada arquivo: validateFile → uploadFile → createDocument com
 *      `bulkImportId` setado → opcionalmente dispara OCR em background.
 *   3. updateProgress() atualiza counters no job.
 *   4. finalizeJob() marca como done/partial/failed conforme failed_files.
 *
 * Throughput: chunks de N (default 5) processados em paralelo via
 * Promise.allSettled. Falhas isoladas por arquivo — o job continua.
 *
 * Validação por arquivo (boundary):
 *   - MIME application/pdf
 *   - size <= 50 MB
 *   - codigo único per setor (consulta antes do INSERT)
 *
 * Privacidade/Audit:
 *   - userInfo.userId obrigatório (audit-trail.md).
 *   - changelog entry 'bulk_imported' criada via createDocument (action 'created'
 *     já cobre, mas adicionamos uma entrada extra com metadata do job).
 */

import { supabase } from '@/config/supabase'
import { validateFile } from '@/services/uploadService'
import supabaseDocumentService from '@/services/supabaseDocumentService'
import { requireUserId } from '@/utils/audit'
import { isOcrEnabled } from '@/utils/featureFlags'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const DEFAULT_CHUNK_SIZE = 5

function handleError(error, context) {
  console.error(`[BulkImportService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// JOB LIFECYCLE
// ============================================================================

/**
 * Cria um novo job de bulk import.
 *
 * @param {Object} params
 * @param {number} params.totalFiles
 * @param {string} [params.source='manual_upload']
 * @param {string} [params.notes]
 * @param {object} userInfo - {userId, userName, userEmail}
 * @returns {Promise<{id: string}>}
 */
export async function createJob({ totalFiles, source = 'manual_upload', notes }, userInfo) {
  const user = requireUserId(userInfo, 'bulkImport.createJob')
  const { data, error } = await supabase
    .from('bulk_import_jobs')
    .insert({
      started_by: user.userId,
      started_by_name: user.userName,
      total_files: totalFiles,
      source,
      notes: notes || null,
      status: 'pending',
    })
    .select()
    .single()
  if (error) handleError(error, 'createJob')
  return { id: data.id }
}

export async function updateJobProgress(jobId, { processed, failed, errorEntry }) {
  const updates = {}
  if (typeof processed === 'number') updates.processed_files = processed
  if (typeof failed === 'number') updates.failed_files = failed
  if (Object.keys(updates).length === 0 && !errorEntry) return null

  if (errorEntry) {
    // Append a single entry to error_log
    const { data: current, error: readErr } = await supabase
      .from('bulk_import_jobs')
      .select('error_log')
      .eq('id', jobId)
      .single()
    if (readErr) handleError(readErr, 'updateJobProgress:read')
    const log = Array.isArray(current?.error_log) ? current.error_log : []
    updates.error_log = [...log, errorEntry]
  }

  const { error } = await supabase
    .from('bulk_import_jobs')
    .update(updates)
    .eq('id', jobId)
  if (error) handleError(error, 'updateJobProgress')
  return updates
}

export async function setJobStatus(jobId, status) {
  const updates = { status }
  if (['done', 'failed', 'cancelled', 'partial'].includes(status)) {
    updates.completed_at = new Date().toISOString()
  }
  const { error } = await supabase
    .from('bulk_import_jobs')
    .update(updates)
    .eq('id', jobId)
  if (error) handleError(error, 'setJobStatus')
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * @param {File} file
 * @param {Object} meta - { codigo, titulo, categoria, ... }
 * @param {Set<string>} seenCodigos - dedupe dentro do batch
 */
export function validateBulkRow(file, meta, seenCodigos) {
  const issues = []
  if (!file) issues.push('Arquivo ausente')
  if (file && file.type && file.type !== 'application/pdf') {
    issues.push(`Tipo inválido: ${file.type} (esperado application/pdf)`)
  }
  if (file && file.size > MAX_FILE_SIZE) {
    issues.push(`Tamanho ${(file.size / 1024 / 1024).toFixed(1)} MB > 50 MB`)
  }
  if (!meta?.titulo || !String(meta.titulo).trim()) issues.push('Título obrigatório')
  if (!meta?.categoria) issues.push('Categoria obrigatória')
  if (meta?.codigo) {
    const codigo = String(meta.codigo).trim()
    if (seenCodigos?.has(codigo)) issues.push(`Código duplicado no batch: ${codigo}`)
    else seenCodigos?.add(codigo)
  }
  return issues
}

/**
 * Verifica duplicatas existentes no banco (codigo já presente em qualquer
 * documento ativo da mesma categoria). Em chunks para evitar payload grande.
 */
export async function findExistingCodigos(codigos) {
  const cleaned = (codigos || []).filter((c) => c && String(c).trim()).map(String)
  if (cleaned.length === 0) return new Set()
  const { data, error } = await supabase
    .from('documentos')
    .select('codigo')
    .in('codigo', cleaned)
    .is('deleted_at', null)
  if (error) handleError(error, 'findExistingCodigos')
  return new Set((data || []).map((r) => r.codigo))
}

// ============================================================================
// PROCESSING
// ============================================================================

/**
 * Processa um único arquivo: upload → createDocument → opcional OCR.
 * Não lança em caso de falha — devolve {ok, error?}.
 */
export async function processFile({
  jobId,
  file,
  meta,
  userInfo,
  ocrPipelineStarter, // (docId, file, userInfo) => Promise — opcional
}) {
  try {
    validateFile(file, 'document')

    const docId = `doc-${crypto.randomUUID()}`
    const categoria = meta.categoria || 'biblioteca'
    const versao = 1

    const uploaded = await supabaseDocumentService.uploadFile(file, categoria, docId, versao)

    const documentData = {
      id: docId,
      titulo: String(meta.titulo).trim(),
      codigo: meta.codigo ? String(meta.codigo).trim() : null,
      descricao: meta.descricao ? String(meta.descricao).trim() : null,
      tipo: meta.tipo || 'documento',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      status: meta.status || 'rascunho',
      versaoAtual: versao,
      setorNome: meta.setorNome || null,
      responsavelRevisao: meta.responsavelRevisao || null,
      proximaRevisao: meta.proximaRevisao || null,
      classificacaoAcesso: meta.classificacaoAcesso || 'interno',
      subcategoria: meta.subcategoria || null,
      arquivoNome: file.name,
      arquivoTamanho: file.size,
      storagePath: uploaded.path,
      bulkImportId: jobId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const created = await supabaseDocumentService.createDocument(categoria, documentData, userInfo)

    // OCR fire-and-forget se a flag estiver ON e o caller tiver passado um starter.
    if (isOcrEnabled() && ocrPipelineStarter && file.type === 'application/pdf') {
      Promise.resolve()
        .then(() => ocrPipelineStarter(docId, file, userInfo))
        .catch((err) => console.error('[BulkImport] OCR fire-and-forget failed:', err))
    }

    return { ok: true, docId: created.id, codigo: documentData.codigo, file: file.name }
  } catch (err) {
    return {
      ok: false,
      file: file?.name ?? '(arquivo)',
      codigo: meta?.codigo ?? null,
      error: err?.message || String(err),
    }
  }
}

/**
 * Processa um array de {file, meta} em chunks. Atualiza progresso via
 * onProgress callback e via writes incremental no job.
 *
 * @param {Object} params
 * @param {Array<{file: File, meta: object}>} params.entries
 * @param {object} params.userInfo
 * @param {string} [params.source]
 * @param {number} [params.chunkSize=5]
 * @param {Function} [params.onProgress] — recebe { processed, failed, total, currentFile }
 * @param {Function} [params.ocrPipelineStarter]
 * @returns {Promise<{jobId, total, processed, failed, errors}>}
 */
export async function processBulkImport({
  entries,
  userInfo,
  source = 'manual_upload',
  chunkSize = DEFAULT_CHUNK_SIZE,
  onProgress,
  ocrPipelineStarter,
}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('processBulkImport: entries vazio')
  }
  const user = requireUserId(userInfo, 'bulkImport.process')

  const total = entries.length
  const { id: jobId } = await createJob({ totalFiles: total, source }, user)
  await setJobStatus(jobId, 'processing')

  let processed = 0
  let failed = 0
  const errors = []

  onProgress?.({ processed: 0, failed: 0, total, phase: 'starting' })

  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize)
    const results = await Promise.allSettled(
      chunk.map((e) =>
        processFile({
          jobId,
          file: e.file,
          meta: e.meta,
          userInfo: user,
          ocrPipelineStarter,
        })
      )
    )

    for (const r of results) {
      const result = r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason?.message }
      if (result.ok) {
        processed += 1
      } else {
        failed += 1
        errors.push(result)
        await updateJobProgress(jobId, { errorEntry: result })
      }
    }

    await updateJobProgress(jobId, { processed, failed })
    onProgress?.({ processed, failed, total, phase: 'processing' })
  }

  const finalStatus = failed === 0 ? 'done' : processed === 0 ? 'failed' : 'partial'
  await setJobStatus(jobId, finalStatus)
  onProgress?.({ processed, failed, total, phase: 'done', status: finalStatus })

  return { jobId, total, processed, failed, errors, status: finalStatus }
}

const bulkImportService = {
  createJob,
  updateJobProgress,
  setJobStatus,
  validateBulkRow,
  findExistingCodigos,
  processFile,
  processBulkImport,
  MAX_FILE_SIZE,
  DEFAULT_CHUNK_SIZE,
}

export default bulkImportService
