/**
 * kpiReportTemplate.js - KPI Indicators PDF Report Template
 *
 * Generates a comprehensive KPI report with:
 * - Summary stats (conformes, parciais, nao conformes, score)
 * - Table with 21 indicators: titulo, 12 months, meta, media, status
 * - Status color coding
 *
 * Data source: useKpiData hook
 */

import {
  ANEST_COLORS,
  PAGE,
  addSectionTitle,
  drawTable,
  drawStatBox,
  getStatusColor,
  getMonthLabels,
  checkPageBreak,
} from '../pdfBranding'

const MONTHS = getMonthLabels()

/**
 * Template metadata
 */
export function getMeta(data) {
  const ano = data?.ano || new Date().getFullYear()
  return {
    title: `Indicadores de Qualidade ${ano}`,
    subtitle: 'Relatório de Conformidade dos KPIs - Acreditação Qmentum',
  }
}

/**
 * Render the KPI report content.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - { indicadores: Array, summary: Object, ano: number }
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { indicadores = [], summary = {}, ano = 2025 } = data
  const { logoBase64, title } = context
  let y = startY

  // ========================================================================
  // SUMMARY SECTION
  // ========================================================================

  y = addSectionTitle(doc, y, 'Resumo Geral')

  // Stat boxes in a row
  const boxWidth = 42
  const boxGap = 3
  const boxStartX = PAGE.marginLeft

  drawStatBox(doc, boxStartX, y, boxWidth, `${summary.scoreGeral || 0}%`, 'Score Geral', ANEST_COLORS.primaryDark)
  drawStatBox(doc, boxStartX + boxWidth + boxGap, y, boxWidth, String(summary.conformes || 0), 'Conformes', ANEST_COLORS.success)
  drawStatBox(doc, boxStartX + (boxWidth + boxGap) * 2, y, boxWidth, String(summary.parciais || 0), 'Parciais', ANEST_COLORS.warning)
  drawStatBox(doc, boxStartX + (boxWidth + boxGap) * 3, y, boxWidth, String(summary.naoConformes || 0), 'Não Conformes', ANEST_COLORS.danger)

  y += 24

  // ========================================================================
  // KPI TABLE
  // ========================================================================

  y = checkPageBreak(doc, y, 30, logoBase64, title)
  y = addSectionTitle(doc, y, `Indicadores de Qualidade - ${ano}`)

  // Column definitions for the compact table
  const indicadorColWidth = 52
  const monthColWidth = 8
  const metaColWidth = 18
  const mediaColWidth = 12
  const statusColWidth = 16
  // Total: 52 + 12*8 + 18 + 12 + 16 = 194... let's adjust to fit 180mm
  // Adjusted: 44 + 12*8 + 16 + 10 + 14 = 180
  const columns = [
    { label: 'Indicador', width: 44, align: 'left' },
    ...MONTHS.map((m) => ({ label: m, width: 8, align: 'center' })),
    { label: 'Meta', width: 16, align: 'center' },
    { label: 'Média', width: 10, align: 'center' },
    { label: 'Status', width: 14, align: 'center' },
  ]

  // Build rows
  const rows = indicadores.map((ind) => {
    const mesesValues = (ind.meses || []).map((v) => {
      if (v === null || v === undefined) return '-'
      if (typeof v === 'number') {
        if (ind.unidade === '%') return v.toFixed(1)
        return String(v)
      }
      return String(v)
    })

    // Pad to 12 months
    while (mesesValues.length < 12) mesesValues.push('-')

    const media = ind.media != null ? ind.media.toFixed(1) : '-'
    const status = ind.statusAtual?.label || 'S/D'

    return [
      ind.titulo || '',
      ...mesesValues,
      ind.metaLabel || '',
      media,
      status,
    ]
  })

  // Custom row styling based on status
  const rowStyle = (rowIndex, row) => {
    const ind = indicadores[rowIndex]
    if (!ind?.statusAtual) return null

    const variant = ind.statusAtual.variant
    if (variant === 'destructive') {
      return { fillColor: [255, 240, 240], textColor: ANEST_COLORS.black }
    }
    if (variant === 'warning') {
      return { fillColor: [255, 251, 235], textColor: ANEST_COLORS.black }
    }
    return null
  }

  y = drawTable(doc, y, columns, rows, {
    rowHeight: 5.5,
    fontSize: 5.5,
    rowStyle,
  })

  // ========================================================================
  // LEGEND
  // ========================================================================

  y += 6
  y = checkPageBreak(doc, y, 15, logoBase64, title)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ANEST_COLORS.primaryDark)
  doc.text('Legenda:', PAGE.marginLeft, y)

  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)

  // Conforme
  doc.setFillColor(...ANEST_COLORS.success)
  doc.circle(PAGE.marginLeft + 2, y - 0.5, 1.2, 'F')
  doc.setTextColor(...ANEST_COLORS.black)
  doc.text('Conforme - atingiu a meta', PAGE.marginLeft + 5, y)

  // Parcial
  doc.setFillColor(...ANEST_COLORS.warning)
  doc.circle(PAGE.marginLeft + 52, y - 0.5, 1.2, 'F')
  doc.text('Parcial - próximo da meta (10% tolerância)', PAGE.marginLeft + 55, y)

  // Nao conforme
  doc.setFillColor(...ANEST_COLORS.danger)
  doc.circle(PAGE.marginLeft + 122, y - 0.5, 1.2, 'F')
  doc.text('Não conforme', PAGE.marginLeft + 125, y)

  y += 5

  // ========================================================================
  // INDIVIDUAL INDICATOR DETAILS (optional if space permits)
  // ========================================================================

  // Add observations for indicators with status != success
  const nonConforming = indicadores.filter(
    (ind) => ind.statusAtual && ind.statusAtual.variant !== 'success'
  )

  if (nonConforming.length > 0) {
    y += 3
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, 'Indicadores com Atenção Necessária')

    nonConforming.forEach((ind) => {
      y = checkPageBreak(doc, y, 14, logoBase64, title)

      // Status color dot
      const statusColor = getStatusColor(ind.statusAtual?.variant)
      doc.setFillColor(...statusColor)
      doc.circle(PAGE.marginLeft + 2, y + 1, 1.5, 'F')

      // Indicator title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...ANEST_COLORS.primaryDark)
      doc.text(ind.titulo, PAGE.marginLeft + 6, y + 2)

      // Details
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...ANEST_COLORS.gray)

      const lastVal = ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D'
      const mediaVal = ind.media != null ? `${ind.media.toFixed(1)}${ind.unidade || ''}` : 'S/D'
      doc.text(
        `Último valor: ${lastVal}  |  Média anual: ${mediaVal}  |  Meta: ${ind.metaLabel}  |  Status: ${ind.statusAtual?.label || '-'}`,
        PAGE.marginLeft + 6,
        y + 2
      )

      y += 8
    })
  }
}

export default { getMeta, render }
