/**
 * usePdfaPipeline — Sprint 6 / Onda 2 / O2-3
 *
 * Hook fire-and-forget que dispara a edge function `pdfa-convert` quando um
 * documento entra em status='arquivado'. Mantém estado local apenas para a
 * UI sinalizar erro imediato; o status canônico vive em `documentos.pdfa_status`.
 */

import { useCallback, useState, useEffect, useRef } from 'react'
import supabasePdfaService from '@/services/supabasePdfaService'
import { isPdfaEnabled } from '@/utils/featureFlags'

export function usePdfaPipeline() {
  const [error, setError] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const startConversion = useCallback(async (documentoId, sourceStoragePath) => {
    if (!isPdfaEnabled()) return { skipped: true }
    if (!documentoId || !sourceStoragePath) return { error: 'missing args' }

    setRequesting(true)
    setError(null)
    try {
      const result = await supabasePdfaService.requestPdfaConversion(documentoId, sourceStoragePath)
      if (mountedRef.current) {
        if (result?.error) setError(result.error)
        setRequesting(false)
      }
      return result
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || 'pdfa-convert falhou')
        setRequesting(false)
      }
      return { error: err?.message }
    }
  }, [])

  return { startConversion, error, requesting }
}

export default usePdfaPipeline
