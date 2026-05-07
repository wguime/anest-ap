/**
 * useOcrPipeline — orquestra detecção + OCR + persistência (Sprint 4 / O2-2).
 *
 * Uso típico após upload bem-sucedido:
 *
 *   const { startOcr, status, progress, error } = useOcrPipeline()
 *   await startOcr({ docId, file, userInfo })
 *
 * Ou manual reprocess:
 *
 *   await startOcr({ docId, file, userInfo, force: true })
 *
 * Estados:
 *   idle → detecting → (skipped|running) → (done|failed)
 *
 * O hook NÃO bloqueia a UI: caller pode dispensar `await`. Toast/feedback
 * é responsabilidade do componente que consome.
 */

import { useCallback, useRef, useState } from 'react'
import { detectIfScanned } from '@/utils/pdfTextDetection.js'
import { runOcr } from '@/services/ocrService.js'
import supabaseDocumentService from '@/services/supabaseDocumentService.js'
import { isOcrEnabled } from '@/utils/featureFlags.js'

const STATUS = {
  IDLE: 'idle',
  DETECTING: 'detecting',
  SKIPPED: 'skipped',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
  DISABLED: 'disabled',
}

export function useOcrPipeline() {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [progress, setProgress] = useState({ page: 0, total: 0, phase: 'idle' })
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const runIdRef = useRef(0)

  const reset = useCallback(() => {
    setStatus(STATUS.IDLE)
    setProgress({ page: 0, total: 0, phase: 'idle' })
    setError(null)
    setLastResult(null)
  }, [])

  /**
   * @param {Object} params
   * @param {string} params.docId
   * @param {File|Blob|ArrayBuffer} params.file
   * @param {object} params.userInfo - {userId, userName, userEmail}
   * @param {boolean} [params.force]   - pula detecção e roda OCR mesmo em PDFs com texto
   * @param {number} [params.maxPages]
   */
  const startOcr = useCallback(
    async ({ docId, file, userInfo, force = false, maxPages }) => {
      if (!isOcrEnabled()) {
        setStatus(STATUS.DISABLED)
        return { skipped: true, reason: 'feature_disabled' }
      }
      if (!docId) throw new Error('useOcrPipeline: docId obrigatório')
      if (!file) throw new Error('useOcrPipeline: file obrigatório')
      if (!userInfo?.userId) {
        throw new Error('useOcrPipeline: userInfo.userId obrigatório (audit-trail)')
      }

      const myRunId = ++runIdRef.current
      const isStale = () => myRunId !== runIdRef.current

      setError(null)
      setLastResult(null)

      try {
        // 1. Marca pending logo de cara para sinalizar à UI.
        await supabaseDocumentService.markOcrPending(docId, userInfo)

        // 2. Detect scanned (a menos que force=true)
        let detection = null
        if (!force) {
          if (isStale()) return { stale: true }
          setStatus(STATUS.DETECTING)
          detection = await detectIfScanned(file)
          if (isStale()) return { stale: true }

          if (!detection.isScanned) {
            await supabaseDocumentService.markOcrNotNeeded(docId, userInfo, detection)
            setStatus(STATUS.SKIPPED)
            return { skipped: true, reason: 'text_based', detection }
          }
        }

        // 3. Marca processing + dispara OCR
        setStatus(STATUS.RUNNING)
        await supabaseDocumentService.markOcrProcessing(docId, userInfo)

        const ocr = await runOcr(file, {
          maxPages,
          onProgress: (p) => {
            if (!isStale()) setProgress(p)
          },
        })
        if (isStale()) return { stale: true }

        // 4. Persiste resultado
        await supabaseDocumentService.persistOcrResult(docId, ocr, userInfo)
        setStatus(STATUS.DONE)
        setLastResult(ocr)
        return { ok: true, ocr, detection }
      } catch (err) {
        if (isStale()) return { stale: true }
        setError(err)
        setStatus(STATUS.FAILED)
        try {
          await supabaseDocumentService.markOcrFailed(
            docId,
            userInfo,
            err?.message || String(err)
          )
        } catch {
          // Falha ao marcar falha — engole para não mascarar o erro original.
        }
        return { ok: false, error: err }
      }
    },
    []
  )

  return {
    startOcr,
    status,
    progress,
    error,
    lastResult,
    reset,
    enabled: isOcrEnabled(),
  }
}

export const OCR_PIPELINE_STATUS = STATUS
