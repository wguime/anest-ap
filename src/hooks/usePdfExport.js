/**
 * usePdfExport - Hook for PDF export functionality
 *
 * Wraps pdfService.generate with React state management
 * for loading and error tracking.
 *
 * Usage:
 *   const { exportPdf, exporting, error } = usePdfExport()
 *   <ExportButton onExport={() => exportPdf('kpiReport', data)} loading={exporting} />
 */

import { useState, useCallback } from 'react'
import { generateAndDownload } from '@/services/pdf/pdfService'
import supabaseRelatoriosService from '@/services/supabaseRelatoriosService'

/**
 * @returns {{ exportPdf: Function, exporting: boolean, error: string|null }}
 */
export function usePdfExport() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const exportPdf = useCallback(async (templateName, data, options = {}) => {
    try {
      setExporting(true)
      setError(null)
      await generateAndDownload(templateName, data, options)

      // Fire-and-forget: register report in Supabase
      {
        supabaseRelatoriosService.registrarRelatorio({
          tipo: templateName,
          ciclo: data.cicloId || data.ciclo || data.cicloAtual || '',
          scoreGeral: data.scoreGeral,
          nivelMaturidade: data.nivelMaturidade,
          subScores: data.subScores,
          geradoPor: data.geradoPor,
          geradoPorUid: data.geradoPorUid,
        }).catch(err => console.warn('Failed to register report:', err))
      }
    } catch (err) {
      console.error('[usePdfExport] Export failed:', err)
      setError(err.message || 'Erro ao gerar PDF')
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportPdf, exporting, error }
}

export default usePdfExport
