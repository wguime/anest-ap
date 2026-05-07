/**
 * useBulkImport — Sprint 5 / Onda 2 / O2-4
 *
 * State machine sobre `bulkImportService.processBulkImport`:
 *   idle → preparing → processing → done | partial | failed
 *
 * Expõe:
 *   - startImport(entries, opts): dispara o batch.
 *   - status, progress {processed, failed, total, phase}, errors, jobId, summary
 *   - reset()
 *
 * Integra com `useOcrPipeline` para passar `ocrPipelineStarter` quando a
 * flag VITE_FEATURE_OCR estiver ativa — assim cada PDF importado em massa
 * passa pelo pipeline de OCR automaticamente.
 */

import { useCallback, useRef, useState } from 'react'
import bulkImportService from '@/services/bulkImportService'
import { useOcrPipeline } from '@/hooks/useOcrPipeline'
import { isBulkImportEnabled } from '@/utils/featureFlags'

export const BULK_IMPORT_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  PROCESSING: 'processing',
  DONE: 'done',
  PARTIAL: 'partial',
  FAILED: 'failed',
  DISABLED: 'disabled',
}

export function useBulkImport() {
  const [status, setStatus] = useState(BULK_IMPORT_STATUS.IDLE)
  const [progress, setProgress] = useState({ processed: 0, failed: 0, total: 0, phase: 'idle' })
  const [errors, setErrors] = useState([])
  const [jobId, setJobId] = useState(null)
  const [summary, setSummary] = useState(null)
  const runIdRef = useRef(0)

  const reset = useCallback(() => {
    setStatus(BULK_IMPORT_STATUS.IDLE)
    setProgress({ processed: 0, failed: 0, total: 0, phase: 'idle' })
    setErrors([])
    setJobId(null)
    setSummary(null)
  }, [])

  // OCR é fire-and-forget — pegamos a função startOcr e adaptamos a interface
  // que o bulkImportService espera: (docId, file, userInfo) => Promise.
  const { startOcr } = useOcrPipeline()
  const ocrPipelineStarter = useCallback(
    (docId, file, userInfo) => startOcr({ docId, file, userInfo }),
    [startOcr]
  )

  /**
   * @param {Array<{file: File, meta: object}>} entries
   * @param {Object} [opts]
   * @param {object} opts.userInfo - {userId, userName, userEmail}
   * @param {string} [opts.source]
   * @param {number} [opts.chunkSize]
   */
  const startImport = useCallback(
    async (entries, opts = {}) => {
      if (!isBulkImportEnabled()) {
        setStatus(BULK_IMPORT_STATUS.DISABLED)
        return { skipped: true, reason: 'feature_disabled' }
      }
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error('useBulkImport: entries vazio')
      }
      const { userInfo, source = 'manual_upload', chunkSize } = opts
      if (!userInfo?.userId) {
        throw new Error('useBulkImport: userInfo.userId obrigatório (audit-trail)')
      }

      const myRunId = ++runIdRef.current
      const isStale = () => myRunId !== runIdRef.current

      setStatus(BULK_IMPORT_STATUS.PREPARING)
      setErrors([])
      setProgress({ processed: 0, failed: 0, total: entries.length, phase: 'preparing' })

      try {
        const result = await bulkImportService.processBulkImport({
          entries,
          userInfo,
          source,
          chunkSize,
          ocrPipelineStarter,
          onProgress: (p) => {
            if (!isStale()) {
              setProgress(p)
              if (p.phase === 'processing' && status !== BULK_IMPORT_STATUS.PROCESSING) {
                setStatus(BULK_IMPORT_STATUS.PROCESSING)
              }
            }
          },
        })

        if (isStale()) return { stale: true }

        setJobId(result.jobId)
        setErrors(result.errors)
        setSummary(result)
        if (result.status === 'done') setStatus(BULK_IMPORT_STATUS.DONE)
        else if (result.status === 'partial') setStatus(BULK_IMPORT_STATUS.PARTIAL)
        else setStatus(BULK_IMPORT_STATUS.FAILED)

        return result
      } catch (err) {
        if (!isStale()) {
          setStatus(BULK_IMPORT_STATUS.FAILED)
          setErrors((prev) => [...prev, { ok: false, error: err?.message || String(err) }])
        }
        throw err
      }
    },
    // status intentionally omitted — referencing it would re-create the
    // callback identity each render and break referential equality.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ocrPipelineStarter]
  )

  return {
    startImport,
    status,
    progress,
    errors,
    jobId,
    summary,
    reset,
    enabled: isBulkImportEnabled(),
  }
}
