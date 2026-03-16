/**
 * complianceReportTemplate.js - Document Compliance PDF Report Template
 *
 * Generates a compliance report with:
 * - Overall compliance score
 * - Category breakdown with compliance bars
 * - Overdue documents list
 * - Document coverage analysis
 *
 * Data source: useComplianceMetrics hook
 */

import {
  ANEST_COLORS,
  PAGE,
  addSectionTitle,
  drawTable,
  drawStatBox,
  drawProgressBar,
  checkPageBreak,
} from '../pdfBranding'

/**
 * Template metadata
 */
export function getMeta() {
  return {
    title: 'Conformidade Documental',
    subtitle: 'Relatório de Compliance - Acreditação Qmentum',
  }
}

/**
 * Render the compliance report content.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - from useComplianceMetrics
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { logoBase64, title } = context
  const {
    complianceScore = 0,
    qmentumScore = 0,
    totalDocuments = 0,
    activeCount = 0,
    overdueCount = 0,
    pendingCount = 0,
    upcomingCount = 0,
    categoryCompliance = [],
    overdueDocuments = [],
    documentCoverage = {},
    reviewComplianceRate = 0,
  } = data

  let y = startY

  // ========================================================================
  // SUMMARY SECTION
  // ========================================================================

  y = addSectionTitle(doc, y, 'Resumo de Conformidade')

  // Stat boxes row 1
  const boxW = 42
  const gap = 3
  const bx = PAGE.marginLeft

  drawStatBox(doc, bx, y, boxW, `${qmentumScore}%`, 'Score Qmentum', ANEST_COLORS.primaryDark)
  drawStatBox(doc, bx + boxW + gap, y, boxW, `${complianceScore}%`, 'Compliance Geral', ANEST_COLORS.success)
  drawStatBox(doc, bx + (boxW + gap) * 2, y, boxW, String(totalDocuments), 'Total Docs', ANEST_COLORS.teal)
  drawStatBox(doc, bx + (boxW + gap) * 3, y, boxW, String(activeCount), 'Ativos', ANEST_COLORS.success)

  y += 24

  // Stat boxes row 2
  drawStatBox(doc, bx, y, boxW, String(overdueCount), 'Vencidos', ANEST_COLORS.danger)
  drawStatBox(doc, bx + boxW + gap, y, boxW, String(pendingCount), 'Pendentes', ANEST_COLORS.warning)
  drawStatBox(doc, bx + (boxW + gap) * 2, y, boxW, String(upcomingCount), 'Próxima Revisão', ANEST_COLORS.teal)
  drawStatBox(doc, bx + (boxW + gap) * 3, y, boxW, `${reviewComplianceRate}%`, 'Taxa Revisão', ANEST_COLORS.primaryDark)

  y += 24

  // ========================================================================
  // CATEGORY COMPLIANCE
  // ========================================================================

  y = checkPageBreak(doc, y, 20, logoBase64, title)
  y = addSectionTitle(doc, y, 'Conformidade por Categoria')

  const barWidth = PAGE.contentWidth - 10

  categoryCompliance.forEach((cat) => {
    y = checkPageBreak(doc, y, 14, logoBase64, title)

    const color = cat.score >= 80 ? ANEST_COLORS.success :
                  cat.score >= 50 ? ANEST_COLORS.warning :
                  ANEST_COLORS.danger

    y = drawProgressBar(doc, PAGE.marginLeft + 5, y, barWidth, cat.score, `${cat.label} (${cat.total} docs)`, color)
  })

  y += 4

  // ========================================================================
  // CATEGORY TABLE
  // ========================================================================

  y = checkPageBreak(doc, y, 30, logoBase64, title)
  y = addSectionTitle(doc, y, 'Detalhamento por Categoria')

  const columns = [
    { label: 'Categoria', width: 60, align: 'left' },
    { label: 'Total', width: 20, align: 'center' },
    { label: 'Ativos', width: 20, align: 'center' },
    { label: 'Vencidos', width: 20, align: 'center' },
    { label: 'Pendentes', width: 20, align: 'center' },
    { label: 'Score', width: 20, align: 'center' },
    { label: 'Revisão', width: 20, align: 'center' },
  ]

  const rows = categoryCompliance.map((cat) => [
    cat.label || cat.category,
    String(cat.total),
    String(cat.active),
    String(cat.overdue),
    String(cat.pending),
    `${cat.score}%`,
    String(cat.upcoming),
  ])

  const rowStyle = (rowIndex) => {
    const cat = categoryCompliance[rowIndex]
    if (!cat) return null
    if (cat.score < 50) return { fillColor: [255, 240, 240] }
    if (cat.score < 80) return { fillColor: [255, 251, 235] }
    return null
  }

  y = drawTable(doc, y, columns, rows, { rowHeight: 6, fontSize: 7, rowStyle })

  // ========================================================================
  // OVERDUE DOCUMENTS
  // ========================================================================

  if (overdueDocuments.length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, `Documentos Vencidos (${overdueDocuments.length})`)

    const overdueCols = [
      { label: 'Título', width: 80, align: 'left' },
      { label: 'Código', width: 30, align: 'left' },
      { label: 'Categoria', width: 40, align: 'left' },
      { label: 'Status', width: 30, align: 'center' },
    ]

    const overdueRows = overdueDocuments.slice(0, 30).map((doc) => [
      doc.titulo || '-',
      doc.codigo || '-',
      doc.category || '-',
      doc.status || '-',
    ])

    y = drawTable(doc, y, overdueCols, overdueRows, { rowHeight: 5.5, fontSize: 6.5 })
  }

  // ========================================================================
  // DOCUMENT COVERAGE
  // ========================================================================

  const coverageEntries = Object.entries(documentCoverage)
  if (coverageEntries.length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, 'Cobertura Documental')

    const coverageCols = [
      { label: 'Categoria', width: 50, align: 'left' },
      { label: 'Existentes', width: 30, align: 'center' },
      { label: 'Recomendados', width: 30, align: 'center' },
      { label: 'Cobertura', width: 30, align: 'center' },
    ]

    const CATEGORY_NAMES = {
      etica: 'Ética e Bioética',
      comites: 'Comitês',
      auditorias: 'Auditorias',
      relatorios: 'Relatórios',
      biblioteca: 'Biblioteca',
      financeiro: 'Financeiro',
    }

    const coverageRows = coverageEntries.map(([cat, data]) => [
      CATEGORY_NAMES[cat] || cat,
      String(data.existing),
      String(data.recommended),
      `${data.coverage}%`,
    ])

    y = drawTable(doc, y, coverageCols, coverageRows, { rowHeight: 6, fontSize: 7 })
  }
}

export default { getMeta, render }
