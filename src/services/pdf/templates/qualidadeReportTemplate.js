/**
 * qualidadeReportTemplate.js - Qualidade Qmentum PDF Report Template
 *
 * Generates a comprehensive quality report with:
 * - Score geral card with nivel and ciclo
 * - AI narrative summary
 * - 4 pilares de qualidade (2x2 grid)
 * - Alertas e pendencias
 * - Autoavaliacao ROPs por area (table)
 * - Auditorias interativas (stats + recent)
 * - Planos PDCA (progress bars + lists)
 * - KPIs (stat boxes + alert indicators)
 * - Proximos passos (priority circles)
 * - Conquistas (unlocked/locked with progress)
 * - Progresso do ciclo (card with dates)
 *
 * Data source: useQualidadeData hook
 */

import {
  ANEST_COLORS,
  PAGE,
  addSectionTitle,
  drawStatBox,
  drawProgressBar,
  drawTable,
  checkPageBreak,
  getStatusColor,
} from '../pdfBranding'

import { CYCLE_OPTIONS } from '@/data/autoavaliacaoConfig'
import { DIMENSAO_CONFIG } from '@/data/indicadores-2025'
import ropsData from '@/data/rops-data'

// ============================================================================
// LOCAL HELPERS
// ============================================================================

const TEXT_DARK = [31, 41, 55]
const TEXT_MUTED = [107, 114, 128]
const GREEN = [34, 197, 94]
const AMBER = [245, 158, 11]
const RED = [220, 38, 38]
const BLUE = [59, 130, 246]
const GRAY_BG = [249, 250, 251]
const GRAY_BORDER = [229, 231, 235]
const WHITE = [255, 255, 255]

function scoreColor(v) {
  if (v >= 80) return GREEN
  if (v >= 50) return AMBER
  return RED
}

function getCycleInfo(cicloId) {
  const ciclo = CYCLE_OPTIONS.find((c) => c.id === cicloId)
  if (!ciclo) return null
  const start = new Date(ciclo.startDate + 'T00:00:00')
  const end = new Date(ciclo.endDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  const elapsed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)))
  const remaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
  const progress = totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 0
  return {
    label: ciclo.label,
    startDate: start.toLocaleDateString('pt-BR'),
    endDate: end.toLocaleDateString('pt-BR'),
    totalDays,
    elapsed,
    remaining,
    progress,
  }
}

function drawLocalProgressBar(doc, x, barY, w, value) {
  const h = 4
  doc.setFillColor(...GRAY_BORDER)
  doc.roundedRect(x, barY, w, h, 1.5, 1.5, 'F')
  if (value > 0) {
    doc.setFillColor(...scoreColor(value))
    doc.roundedRect(x, barY, Math.max((value / 100) * w, 2), h, 1.5, 1.5, 'F')
  }
}

// ============================================================================
// TEMPLATE API
// ============================================================================

/**
 * Template metadata
 */
export function getMeta(data) {
  const cicloInfo = getCycleInfo(data?.cicloAtual)
  return {
    title: 'Relatório de Qualidade Qmentum',
    subtitle: cicloInfo
      ? `Ciclo: ${cicloInfo.label} | Acreditação IQG Brasil`
      : 'Sistema ANEST — Acreditação IQG Brasil',
  }
}

/**
 * Render the Qualidade report content.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const {
    scoreGeral, nivelMaturidade, cicloAtual, diasRestantesCiclo,
    subScores = {}, autoavaliacao = {}, auditorias = {}, planos = {}, kpis = {},
    alerts = {}, nextSteps = [], achievements = {}, narrative = {}, insights = {},
    // Gestao data
    protocolosStatus = [], protocolosCount = {},
    complianceScore = 0, totalDocuments = 0, activeCount = 0, overdueCount = 0, pendingCount = 0,
    coverageChartData = [], recentChanges = [],
    incidentsByStatus = {}, incidentesByTipo = [], incidentsBySeverity = {}, meanResolutionDays = null,
    totalIncidentes = 0, totalDenuncias = 0,
    kpiIndicadores = [], topCriticos = [], topDestaques = [],
    criticalAlerts = [],
    geradoPor, avaliacoesCiclo = [], dimensaoConfig,
    rawExecucoes = [], rawPlanos = [], overdueDocuments = [], upcomingReviews = [],
  } = data

  const { logoBase64, title } = context
  let y = startY

  const nivelLabel = { diamond: 'Diamond', platinum: 'Platinum', gold: 'Gold', em_progresso: 'Em Progresso' }[nivelMaturidade] || 'Em Progresso'
  const cicloInfo = getCycleInfo(cicloAtual)

  // ========================================================================
  // 1. SCORE GERAL CARD
  // ========================================================================

  doc.setFillColor(...ANEST_COLORS.lightBg)
  doc.setDrawColor(...ANEST_COLORS.primaryDark)
  doc.setLineWidth(0.5)
  doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 28, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(...ANEST_COLORS.primaryDark)
  doc.text(`${scoreGeral}%`, PAGE.marginLeft + 12, y + 18)

  const scoreBoxX = PAGE.marginLeft + 50
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`Nível ${nivelLabel}`, scoreBoxX, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUTED)
  doc.text('Score geral de qualidade — média ponderada dos 4 pilares Qmentum', scoreBoxX, y + 17)

  if (cicloInfo) {
    doc.text(`${cicloInfo.remaining} dias restantes  |  ${cicloInfo.startDate} a ${cicloInfo.endDate}`, scoreBoxX, y + 23)
  }

  y += 34

  // ========================================================================
  // 2. NARRATIVE
  // ========================================================================

  if (narrative?.headline) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MUTED)
    const nLines = doc.splitTextToSize(narrative.headline, PAGE.contentWidth)
    doc.text(nLines, PAGE.marginLeft, y + 4)
    y += nLines.length * 4 + 4
  }
  if (narrative?.subtextItems?.length > 0) {
    narrative.subtextItems.forEach((item) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MUTED)
      const lines = doc.splitTextToSize(`  •  ${item}`, PAGE.contentWidth - 4)
      doc.text(lines, PAGE.marginLeft + 2, y + 3)
      y += lines.length * 3.5 + 1
    })
    y += 2
  }

  // ========================================================================
  // 3. PILARES DE QUALIDADE (2x2 grid)
  // ========================================================================

  y = checkPageBreak(doc, y, 60, logoBase64, title)
  y = addSectionTitle(doc, y, 'Pilares de Qualidade')

  const cardW = (PAGE.contentWidth - 4) / 2
  const cardH = 22
  const pillarCards = [
    { label: 'Autoavaliação ROPs', value: subScores.autoScore || 0, detail: `${autoavaliacao.progressoGeral?.avaliados || 0}/${autoavaliacao.progressoGeral?.total || 32} avaliados` },
    { label: 'Auditorias', value: subScores.auditScore || 0, detail: `${auditorias.concluidas || 0}/${auditorias.total || 0} concluídas` },
    { label: 'Planos PDCA', value: subScores.planoScore || 0, detail: `Eficácia: ${planos.taxaEficacia || 0}%` },
    { label: 'Indicadores (KPIs)', value: subScores.kpiScore || 0, detail: `${kpis.conformes || 0}/${kpis.total || 0} conformes` },
  ]

  pillarCards.forEach((card, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx = PAGE.marginLeft + col * (cardW + 4)
    const cy = y + row * (cardH + 3)

    doc.setFillColor(...GRAY_BG)
    doc.setDrawColor(...GRAY_BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD')

    // Color accent left
    doc.setFillColor(...scoreColor(card.value))
    doc.rect(cx, cy + 2, 2.5, cardH - 4, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(card.label, cx + 6, cy + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...scoreColor(card.value))
    doc.text(`${card.value}%`, cx + 6, cy + 15)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(card.detail, cx + 6, cy + 20)

    // Mini progress bar
    drawLocalProgressBar(doc, cx + cardW - 38, cy + 12, 32, card.value)
  })

  y += 2 * (cardH + 3) + 4

  // ========================================================================
  // 4. ALERTAS E PENDENCIAS
  // ========================================================================

  if (alerts.total > 0) {
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, `Alertas e Pendências (${alerts.total})`)

    const alertItems = []
    if (alerts.overdueAvaliacoes?.length > 0)
      alertItems.push({ text: `${alerts.overdueAvaliacoes.length} avaliação(ões) vencida(s)`, color: RED, severity: 'URGENTE' })
    if (alerts.overdueAuditorias?.length > 0)
      alertItems.push({ text: `${alerts.overdueAuditorias.length} auditoria(s) atrasada(s)`, color: RED, severity: 'URGENTE' })
    if (alerts.overduePlanos?.length > 0)
      alertItems.push({ text: `${alerts.overduePlanos.length} plano(s) de ação atrasado(s)`, color: AMBER, severity: 'ATENÇÃO' })

    alertItems.forEach((a) => {
      y = checkPageBreak(doc, y, 9, logoBase64, title)
      const badgeColor = a.severity === 'URGENTE' ? RED : AMBER
      doc.setFillColor(...badgeColor)
      doc.roundedRect(PAGE.marginLeft + 2, y, 18, 5, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...WHITE)
      doc.text(a.severity, PAGE.marginLeft + 11, y + 3.5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...a.color)
      doc.text(a.text, PAGE.marginLeft + 23, y + 3.8)
      y += 8
    })
    y += 2
  }

  // ========================================================================
  // 5. AUTOAVALIACAO ROPs POR AREA
  // ========================================================================

  if (autoavaliacao.areaBreakdown?.length > 0) {
    y = checkPageBreak(doc, y, 40, logoBase64, title)
    y = addSectionTitle(doc, y, 'Autoavaliação ROPs — Detalhamento por Área')

    // Summary line
    const pg = autoavaliacao.progressoGeral || {}
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(`Progresso geral: ${pg.avaliados || 0}/${pg.total || 32} ROPs avaliados (${pg.percentual || 0}%)`, PAGE.marginLeft + 2, y)
    y += 3
    drawLocalProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, pg.percentual || 0)
    y += 8

    // Table using drawTable
    const columns = [
      { label: 'Área', width: 65, align: 'left' },
      { label: 'Avaliados', width: 30, align: 'center' },
      { label: 'Conformes', width: 25, align: 'center' },
      { label: 'Parciais', width: 25, align: 'center' },
      { label: 'N/C', width: 25, align: 'center' },
    ]

    const rows = autoavaliacao.areaBreakdown.map((area) => [
      area.title || '',
      `${area.avaliados || 0}/${area.ropCount || 0}`,
      String(area.conformes || 0),
      String(area.parciais || 0),
      String(area.naoConformes || 0),
    ])

    y = drawTable(doc, y, columns, rows, { rowHeight: 7, fontSize: 8 })

    // Evidencias count
    if (autoavaliacao.totalEvidencias != null) {
      y += 2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MUTED)
      doc.text(`${autoavaliacao.totalEvidencias} evidência(s) vinculada(s) neste ciclo`, PAGE.marginLeft + 2, y + 3)
      y += 6
    }

    // Individual ROP listing — ALL 32 ROPs sorted numerically
    {
      y += 2
      y = checkPageBreak(doc, y, 20, logoBase64, title)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text('Detalhamento Individual dos ROPs:', PAGE.marginLeft + 2, y + 3)
      y += 7

      const STATUS_BADGE = {
        conforme: { label: 'Conforme', color: GREEN },
        parcialmente_conforme: { label: 'Parcial', color: AMBER },
        nao_conforme: { label: 'Não Conforme', color: RED },
        nao_avaliado: { label: 'Não Avaliado', color: TEXT_MUTED },
      }

      // Build complete list of ALL 32 ROPs from ropsData
      const allRops = []
      Object.entries(ropsData || {}).forEach(([areaKey, area]) => {
        Object.entries(area.subdivisoes || {}).forEach(([ropId, ropInfo]) => {
          allRops.push({ ropId, title: ropInfo.title, areaKey, areaTitle: area.title })
        })
      })

      // Sort numerically by ropId (extract numbers: "rop-1-1" → [1,1])
      allRops.sort((a, b) => {
        const [, ma, sa] = a.ropId.match(/rop-(\d+)-(\d+)/) || [, 0, 0]
        const [, mb, sb] = b.ropId.match(/rop-(\d+)-(\d+)/) || [, 0, 0]
        return (+ma - +mb) || (+sa - +sb)
      })

      // Merge with avaliacoesCiclo to get status (ROPs without evaluation = "Nao Avaliado")
      const evalMap = {}
      avaliacoesCiclo.forEach(av => { evalMap[av.ropId] = av })

      // Group by macro area (using areaTitle)
      const ropsByMacroArea = {}
      allRops.forEach(rop => {
        if (!ropsByMacroArea[rop.areaTitle]) ropsByMacroArea[rop.areaTitle] = []
        ropsByMacroArea[rop.areaTitle].push(rop)
      })

      Object.entries(ropsByMacroArea).forEach(([areaTitle, rops]) => {
        y = checkPageBreak(doc, y, 12, logoBase64, title)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...ANEST_COLORS.primaryDark)
        doc.text(areaTitle, PAGE.marginLeft + 3, y + 3)
        y += 5

        const ropCols = [
          { label: 'ROP', width: 100, align: 'left' },
          { label: 'Status', width: 40, align: 'center' },
        ]
        const ropRows = rops.map((r) => {
          const av = evalMap[r.ropId]
          const badge = av ? (STATUS_BADGE[av.status] || STATUS_BADGE.nao_avaliado) : STATUS_BADGE.nao_avaliado
          return [r.title, badge.label]
        })

        y = drawTable(doc, y, ropCols, ropRows, {
          rowHeight: 5.5,
          fontSize: 6.5,
          rowStyle: (rowIndex, row) => {
            if (row[1] === 'Não Conforme') return { textColor: RED }
            if (row[1] === 'Parcial') return { textColor: AMBER }
            if (row[1] === 'Conforme') return { textColor: GREEN }
            return { textColor: TEXT_MUTED }
          },
        })
        y += 2
      })
    }

    y += 2
  }

  // ========================================================================
  // 6. AUDITORIAS INTERATIVAS
  // ========================================================================

  y = checkPageBreak(doc, y, 40, logoBase64, title)
  y = addSectionTitle(doc, y, 'Auditorias Interativas')

  // Stat boxes
  const auditBoxW = (PAGE.contentWidth - 9) / 4
  const auditStats = [
    { label: 'Total', value: String(auditorias.total || 0), color: ANEST_COLORS.primaryDark },
    { label: 'Concluídas', value: String(auditorias.concluidas || 0), color: ANEST_COLORS.success },
    { label: 'Em Andamento', value: String(auditorias.emAndamento || 0), color: ANEST_COLORS.warning },
    { label: 'Atrasadas', value: String(auditorias.overdue?.length || 0), color: (auditorias.overdue?.length || 0) > 0 ? ANEST_COLORS.danger : ANEST_COLORS.gray },
  ]

  auditStats.forEach((st, i) => {
    drawStatBox(doc, PAGE.marginLeft + i * (auditBoxW + 3), y, auditBoxW, st.value, st.label, st.color)
  })
  y += 22

  if (auditorias.averageScore != null) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(`Score médio de conformidade: ${auditorias.averageScore}%`, PAGE.marginLeft + 2, y + 3)
    drawLocalProgressBar(doc, PAGE.marginLeft + PAGE.contentWidth - 62, y + 0.5, 60, auditorias.averageScore)
    y += 8
  }

  // Recent completed
  if (auditorias.recentCompleted?.length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Últimas concluídas:', PAGE.marginLeft + 2, y + 3)
    y += 6

    auditorias.recentCompleted.forEach((exec) => {
      y = checkPageBreak(doc, y, 7, logoBase64, title)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      const label = exec.templateTipo || exec.id
      doc.text(`  •  ${label}`, PAGE.marginLeft + 3, y + 3)
      if (exec.scoreConformidade != null) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...scoreColor(exec.scoreConformidade))
        doc.text(`${exec.scoreConformidade}%`, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
      }
      y += 6
    })
  }

  // Full auditorias table
  if (rawExecucoes && rawExecucoes.length > 0) {
    y = checkPageBreak(doc, y, 15, logoBase64, title)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Progresso de Todas as Auditorias:', PAGE.marginLeft + 2, y + 3)
    y += 6

    const auditCols = [
      { label: 'Auditoria', width: 55, align: 'left' },
      { label: 'Status', width: 25, align: 'center' },
      { label: 'Score', width: 18, align: 'center' },
      { label: 'Última', width: 23, align: 'center' },
      { label: 'Próxima', width: 23, align: 'center' },
    ]

    const auditRows = rawExecucoes.map(exec => {
      const nome = exec.templateTipo || exec.titulo || exec.id || '-'
      const status = exec.status === 'concluida' ? 'Concluída'
        : exec.status === 'rascunho' ? 'Rascunho'
        : exec.status === 'em_andamento' ? 'Em Andamento'
        : exec.status || '-'
      const score = exec.scoreConformidade != null ? `${exec.scoreConformidade}%` : '-'
      const ultimaData = exec.concluidoEm ? new Date(exec.concluidoEm).toLocaleDateString('pt-BR')
        : exec.updatedAt ? new Date(exec.updatedAt).toLocaleDateString('pt-BR') : '-'
      const proximaData = exec.proximaExecucao ? new Date(exec.proximaExecucao).toLocaleDateString('pt-BR')
        : exec.prazo ? new Date(exec.prazo).toLocaleDateString('pt-BR') : '-'
      return [nome, status, score, ultimaData, proximaData]
    })

    y = drawTable(doc, y, auditCols, auditRows, {
      rowHeight: 5.5,
      fontSize: 6.5,
      rowStyle: (rowIndex, row) => {
        if (row[1] === 'Concluída') return { textColor: GREEN }
        if (row[1] === 'Em Andamento') return { textColor: BLUE }
        return { textColor: TEXT_MUTED }
      },
    })
    y += 3
  }

  // Proximas Auditorias Pendentes
  const pendingAudits = (rawExecucoes || []).filter(e => e.status !== 'concluida')
  if (pendingAudits.length > 0) {
    y = checkPageBreak(doc, y, 15, logoBase64, title)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Próximas Auditorias Pendentes:', PAGE.marginLeft + 2, y + 3)
    y += 6

    const pendCols = [
      { label: 'Auditoria', width: 90, align: 'left' },
      { label: 'Status', width: 30, align: 'center' },
      { label: 'Última Atualização', width: 25, align: 'center' },
    ]
    const pendRows = pendingAudits.map(exec => [
      exec.templateTipo || exec.titulo || exec.id || '-',
      exec.status === 'rascunho' ? 'Rascunho' : exec.status === 'em_andamento' ? 'Em Andamento' : exec.status || '-',
      exec.updatedAt ? new Date(exec.updatedAt).toLocaleDateString('pt-BR') : '-',
    ])
    y = drawTable(doc, y, pendCols, pendRows, { rowHeight: 5.5, fontSize: 6.5 })
    y += 3
  }

  y += 4

  // ========================================================================
  // 7. PLANOS DE ACAO PDCA
  // ========================================================================

  y = checkPageBreak(doc, y, 30, logoBase64, title)
  y = addSectionTitle(doc, y, 'Planos de Ação PDCA')

  // Taxa conclusao + eficacia
  const taxas = [
    { label: 'Taxa de Conclusão', value: planos.taxaConclusao || 0 },
    { label: 'Taxa de Eficácia', value: planos.taxaEficacia || 0 },
  ]
  taxas.forEach((t) => {
    y = checkPageBreak(doc, y, 10, logoBase64, title)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(t.label, PAGE.marginLeft + 2, y + 3)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...scoreColor(t.value))
    doc.text(`${t.value}%`, PAGE.marginLeft + 75, y + 3)

    drawLocalProgressBar(doc, PAGE.marginLeft + 85, y + 0.5, PAGE.contentWidth - 87, t.value)
    y += 8
  })

  // By status
  if (planos.byStatus && Object.keys(planos.byStatus).length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Por status:', PAGE.marginLeft + 2, y + 3)
    y += 6

    const statusLabels = {
      planejamento: 'Planejamento', em_andamento: 'Em Andamento',
      concluido: 'Concluído', verificacao: 'Verificação',
      cancelado: 'Cancelado', eficaz: 'Eficaz', nao_eficaz: 'Não Eficaz',
    }
    Object.entries(planos.byStatus).forEach(([key, count]) => {
      if (count === 0) return
      y = checkPageBreak(doc, y, 7, logoBase64, title)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text(`  •  ${statusLabels[key] || key}: ${count}`, PAGE.marginLeft + 3, y + 3)
      y += 5
    })
  }

  // By origem
  if (planos.byOrigem && Object.keys(planos.byOrigem).length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Por origem:', PAGE.marginLeft + 2, y + 3)
    y += 6

    const origemLabels = {
      nao_conformidade: 'Não Conformidade', auditoria: 'Auditoria',
      incidente: 'Incidente', melhoria: 'Melhoria', indicador: 'Indicador',
    }
    Object.entries(planos.byOrigem).forEach(([key, count]) => {
      if (count === 0) return
      y = checkPageBreak(doc, y, 7, logoBase64, title)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text(`  •  ${origemLabels[key] || key}: ${count}`, PAGE.marginLeft + 3, y + 3)
      y += 5
    })
  }

  if (planos.overdue?.length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...RED)
    doc.text(`${planos.overdue.length} plano(s) atrasado(s)`, PAGE.marginLeft + 2, y + 3)
    y += 6
  }

  // Full planos table
  if (rawPlanos && rawPlanos.length > 0) {
    y = checkPageBreak(doc, y, 15, logoBase64, title)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Progresso de Todos os Planos:', PAGE.marginLeft + 2, y + 3)
    y += 6

    const PLANO_STATUS_LABELS = {
      planejamento: 'Planejamento', execucao: 'Execução', verificacao: 'Verificação',
      padronizacao: 'Padronização', concluido: 'Concluído', cancelado: 'Cancelado',
    }

    const planoCols = [
      { label: 'Plano', width: 45, align: 'left' },
      { label: 'Fase PDCA', width: 22, align: 'center' },
      { label: 'Origem', width: 22, align: 'center' },
      { label: 'Última Data', width: 22, align: 'center' },
      { label: 'Próxima Data', width: 22, align: 'center' },
      { label: 'Eficácia', width: 15, align: 'center' },
    ]

    const planoRows = rawPlanos.map(p => {
      const titulo = p.titulo || p.descricao || p.id || '-'
      const fase = PLANO_STATUS_LABELS[p.status] || p.status || '-'
      const origem = p.tipoOrigem || '-'
      const ultimaData = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('pt-BR')
        : p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '-'
      const proximaData = p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : '-'
      const eficacia = p.eficacia === 'eficaz' ? 'Eficaz' : p.eficacia === 'nao_eficaz' ? 'Não Eficaz' : '-'
      return [titulo, fase, origem, ultimaData, proximaData, eficacia]
    })

    y = drawTable(doc, y, planoCols, planoRows, {
      rowHeight: 5.5,
      fontSize: 6.5,
      rowStyle: (rowIndex, row) => {
        if (row[1] === 'Concluído') return { textColor: GREEN }
        if (row[1] === 'Cancelado') return { textColor: TEXT_MUTED }
        if (row[5] === 'Não Eficaz') return { textColor: RED }
        return {}
      },
    })
    y += 3
  }

  // Next steps: non-completed planos
  const pendingPlanos = (rawPlanos || []).filter(p => p.status !== 'concluido' && p.status !== 'cancelado')
  if (pendingPlanos.length > 0) {
    y = checkPageBreak(doc, y, 15, logoBase64, title)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Próximas Etapas a Concluir:', PAGE.marginLeft + 2, y + 3)
    y += 6

    const PLANO_STATUS_LABELS_NEXT = {
      planejamento: 'Planejamento', execucao: 'Execução', verificacao: 'Verificação',
      padronizacao: 'Padronização', concluido: 'Concluído', cancelado: 'Cancelado',
    }

    const nextCols = [
      { label: 'Plano', width: 55, align: 'left' },
      { label: 'Fase Atual', width: 25, align: 'center' },
      { label: 'Última Data', width: 22, align: 'center' },
      { label: 'Próxima Data', width: 22, align: 'center' },
      { label: 'Próxima Fase', width: 25, align: 'center' },
    ]

    const NEXT_PHASE = {
      planejamento: 'Execução', execucao: 'Verificação', verificacao: 'Padronização', padronizacao: 'Conclusão',
    }

    const nextRows = pendingPlanos.map(p => [
      p.titulo || p.descricao || p.id || '-',
      PLANO_STATUS_LABELS_NEXT[p.status] || p.status || '-',
      p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('pt-BR') : '-',
      p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : '-',
      NEXT_PHASE[p.status] || '-',
    ])

    y = drawTable(doc, y, nextCols, nextRows, { rowHeight: 5.5, fontSize: 6.5 })
    y += 3
  }

  y += 4

  // ========================================================================
  // 8. INDICADORES DE SEGURANCA (KPIs)
  // ========================================================================

  y = checkPageBreak(doc, y, 40, logoBase64, title)
  y = addSectionTitle(doc, y, 'Indicadores de Segurança (KPIs)')

  // Score geral KPIs
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`Score geral: ${kpis.scoreGeral || 0}%`, PAGE.marginLeft + 2, y + 3)
  drawLocalProgressBar(doc, PAGE.marginLeft + 50, y + 0.5, PAGE.contentWidth - 52, kpis.scoreGeral || 0)
  y += 8

  // KPI stat boxes
  const kpiCardW = (PAGE.contentWidth - 12) / 5
  const kpiStats = [
    { label: 'Total', value: String(kpis.total || 0), color: TEXT_DARK },
    { label: 'Conformes', value: String(kpis.conformes || 0), color: GREEN },
    { label: 'Parciais', value: String(kpis.parciais || 0), color: AMBER },
    { label: 'N/Conformes', value: String(kpis.naoConformes || 0), color: RED },
    { label: 'Sem Dados', value: String(kpis.semDados || 0), color: TEXT_MUTED },
  ]

  kpiStats.forEach((st, i) => {
    y = checkPageBreak(doc, y, 16, logoBase64, title)
    const sx = PAGE.marginLeft + i * (kpiCardW + 3)
    doc.setFillColor(...GRAY_BG)
    doc.setDrawColor(...GRAY_BORDER)
    doc.setLineWidth(0.2)
    doc.roundedRect(sx, y, kpiCardW, 14, 2, 2, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(st.label, sx + kpiCardW / 2, y + 5, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...st.color)
    doc.text(st.value, sx + kpiCardW / 2, y + 12, { align: 'center' })
  })
  y += 18

  // Alert indicadores
  if (kpis.alertIndicadores?.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Indicadores abaixo da meta:', PAGE.marginLeft + 2, y + 3)
    y += 6

    kpis.alertIndicadores.forEach((ind) => {
      y = checkPageBreak(doc, y, 7, logoBase64, title)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      const name = ind.titulo || ind.nome || ind.id
      doc.text(`  •  ${name}`, PAGE.marginLeft + 3, y + 3)

      if (ind.ultimoValor != null) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...RED)
        doc.text(`${ind.ultimoValor}${ind.unidade || ''}`, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
      }
      y += 5
    })
  }
  y += 4

  // ========================================================================
  // 9. PROXIMOS PASSOS
  // ========================================================================

  if (nextSteps?.length > 0) {
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, 'Próximos Passos')

    nextSteps.forEach((step, i) => {
      y = checkPageBreak(doc, y, 10, logoBase64, title)
      const num = String(i + 1)

      // Priority circle
      const circleColor = step.category === 'URGENTE' ? RED : step.category === 'MELHORIA' ? AMBER : TEXT_MUTED
      doc.setFillColor(...circleColor)
      doc.circle(PAGE.marginLeft + 4, y + 2.5, 2.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...WHITE)
      doc.text(num, PAGE.marginLeft + 4, y + 3.5, { align: 'center' })

      // Category badge
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...circleColor)
      doc.text(step.category, PAGE.marginLeft + 9, y + 1)

      // Step text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...TEXT_DARK)
      const lines = doc.splitTextToSize(step.label, PAGE.contentWidth - 12)
      doc.text(lines, PAGE.marginLeft + 9, y + 5)
      y += lines.length * 4 + 4
    })
    y += 2
  }

  // ========================================================================
  // 10. CONQUISTAS
  // ========================================================================

  if (achievements?.list?.length > 0) {
    y = checkPageBreak(doc, y, 25, logoBase64, title)
    y = addSectionTitle(doc, y, `Conquistas (${achievements.unlockedCount || 0}/${achievements.total || 0})`)

    const unlocked = achievements.list.filter((a) => a.unlocked)
    const locked = achievements.list.filter((a) => !a.unlocked)

    if (unlocked.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...ANEST_COLORS.success)
      doc.text('Desbloqueadas:', PAGE.marginLeft + 2, y + 3)
      y += 6

      unlocked.forEach((ach) => {
        y = checkPageBreak(doc, y, 10, logoBase64, title)
        // Draw filled star-like marker
        doc.setFillColor(...ANEST_COLORS.success)
        doc.circle(PAGE.marginLeft + 5.5, y + 2.5, 1.5, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_DARK)
        doc.text(ach.title, PAGE.marginLeft + 10, y + 3)
        if (ach.description) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...TEXT_MUTED)
          doc.text(`      ${ach.description}`, PAGE.marginLeft + 3, y + 7)
          y += 4
        }
        y += 5
      })
    }

    if (locked.length > 0) {
      y += 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MUTED)
      doc.text('Em progresso:', PAGE.marginLeft + 2, y + 3)
      y += 6

      locked.slice(0, 5).forEach((ach) => {
        y = checkPageBreak(doc, y, 10, logoBase64, title)
        // Draw hollow circle marker
        doc.setDrawColor(...ANEST_COLORS.lightGray)
        doc.setLineWidth(0.4)
        doc.circle(PAGE.marginLeft + 5.5, y + 2.5, 1.5, 'S')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_MUTED)
        const progressText = ach.progress ? ` (${ach.progress.current}/${ach.progress.total})` : ''
        doc.text(`${ach.title}${progressText}`, PAGE.marginLeft + 10, y + 3)

        if (ach.progress) {
          const pPercent = Math.round((ach.progress.current / ach.progress.total) * 100)
          drawLocalProgressBar(doc, PAGE.marginLeft + PAGE.contentWidth - 42, y + 0.5, 40, pPercent)
        }
        y += 6
      })
    }
    y += 4
  }

  // ========================================================================
  // 11. PROGRESSO DO CICLO
  // ========================================================================

  if (cicloInfo) {
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, 'Progresso do Ciclo')

    doc.setFillColor(...GRAY_BG)
    doc.setDrawColor(...GRAY_BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 18, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEXT_DARK)
    doc.text(cicloInfo.label, PAGE.marginLeft + 5, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`${cicloInfo.startDate} a ${cicloInfo.endDate}`, PAGE.marginLeft + 5, y + 11)

    drawLocalProgressBar(doc, PAGE.marginLeft + 5, y + 13, PAGE.contentWidth - 50, cicloInfo.progress)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ANEST_COLORS.primaryDark)
    doc.text(`${cicloInfo.progress}%`, PAGE.marginLeft + PAGE.contentWidth - 40, y + 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`${cicloInfo.elapsed}d decorridos | ${cicloInfo.remaining}d restantes`, PAGE.marginLeft + PAGE.contentWidth - 5, y + 11, { align: 'right' })

    y += 24
  }

  // ========================================================================
  // 12. ALERTAS CRITICOS (CONSOLIDADOS)
  // ========================================================================

  if (criticalAlerts.length > 0) {
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, `Alertas Críticos Consolidados (${criticalAlerts.length})`)

    criticalAlerts.forEach((alert) => {
      y = checkPageBreak(doc, y, 9, logoBase64, title)
      const badgeColor = alert.severity === 'critical' ? RED : AMBER
      const badgeLabel = alert.severity === 'critical' ? 'CRÍTICO' : 'ATENÇÃO'

      doc.setFillColor(...badgeColor)
      doc.roundedRect(PAGE.marginLeft + 2, y, 18, 5, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...WHITE)
      doc.text(badgeLabel, PAGE.marginLeft + 11, y + 3.5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...badgeColor)
      doc.text(alert.message, PAGE.marginLeft + 23, y + 3.8)
      y += 8
    })
    y += 4
  }

  // ========================================================================
  // 13. PROTOCOLOS OBRIGATORIOS
  // ========================================================================

  if (protocolosStatus.length > 0) {
    y = checkPageBreak(doc, y, 50, logoBase64, title)
    const docCount = protocolosCount.documentados || 0
    const totalProto = protocolosCount.total || protocolosStatus.length
    const coveragePct = totalProto > 0 ? Math.round((docCount / totalProto) * 100) : 0
    y = addSectionTitle(doc, y, `Protocolos Obrigatórios Qmentum (${docCount}/${totalProto})`)

    // Summary
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(`Cobertura: ${coveragePct}% dos protocolos obrigatórios documentados`, PAGE.marginLeft + 2, y)
    y += 3
    drawLocalProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, coveragePct)
    y += 8

    // Table
    const protoCols = [
      { label: 'Protocolo', width: 65, align: 'left' },
      { label: 'Status', width: 25, align: 'center' },
      { label: 'Criado em', width: 25, align: 'center' },
      { label: 'Próxima Revisão', width: 30, align: 'center' },
    ]

    const protoRows = protocolosStatus.map((p) => {
      const status = p.existe ? 'Documentado' : 'Faltante'
      const createdAt = p.doc?.createdAt ? new Date(p.doc.createdAt).toLocaleDateString('pt-BR') : '-'
      const nextReview = p.doc?.proximaRevisao ? new Date(p.doc.proximaRevisao).toLocaleDateString('pt-BR') : '-'
      return [p.nome, status, createdAt, nextReview]
    })

    y = drawTable(doc, y, protoCols, protoRows, {
      rowHeight: 6,
      fontSize: 7.5,
      rowStyle: (rowIndex, row) => {
        if (row[1] === 'Faltante') return { textColor: RED }
        return { textColor: GREEN }
      },
    })
    y += 4
  }

  // ========================================================================
  // 14. COBERTURA DOCUMENTAL
  // ========================================================================

  if (totalDocuments > 0 || coverageChartData.length > 0) {
    y = checkPageBreak(doc, y, 40, logoBase64, title)
    y = addSectionTitle(doc, y, 'Cobertura Documental')

    // Stat boxes row
    const docBoxW = (PAGE.contentWidth - 12) / 5
    const docStats = [
      { label: 'Total', value: String(totalDocuments), color: ANEST_COLORS.primaryDark },
      { label: 'Ativos', value: String(activeCount), color: GREEN },
      { label: 'Vencidos', value: String(overdueCount), color: overdueCount > 0 ? RED : TEXT_MUTED },
      { label: 'Pendentes', value: String(pendingCount), color: pendingCount > 0 ? AMBER : TEXT_MUTED },
      { label: 'Score', value: `${complianceScore}%`, color: scoreColor(complianceScore) },
    ]

    docStats.forEach((st, i) => {
      const sx = PAGE.marginLeft + i * (docBoxW + 3)
      doc.setFillColor(...GRAY_BG)
      doc.setDrawColor(...GRAY_BORDER)
      doc.setLineWidth(0.2)
      doc.roundedRect(sx, y, docBoxW, 14, 2, 2, 'FD')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...TEXT_MUTED)
      doc.text(st.label, sx + docBoxW / 2, y + 5, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...st.color)
      doc.text(st.value, sx + docBoxW / 2, y + 12, { align: 'center' })
    })
    y += 18

    // Coverage by category
    if (coverageChartData.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text('Cobertura por categoria:', PAGE.marginLeft + 2, y + 3)
      y += 7

      const covCols = [
        { label: 'Categoria', width: 70, align: 'left' },
        { label: 'Existentes', width: 30, align: 'center' },
        { label: 'Recomendados', width: 35, align: 'center' },
        { label: 'Cobertura', width: 30, align: 'center' },
      ]

      const covRows = coverageChartData.map((d) => [
        d.label,
        String(d.value || 0),
        String(d.recommended || 0),
        `${d.coverage || 0}%`,
      ])

      y = drawTable(doc, y, covCols, covRows, {
        rowHeight: 6,
        fontSize: 7.5,
        rowStyle: (rowIndex, row) => {
          const cov = parseInt(row[3]) || 0
          if (cov >= 80) return { textColor: GREEN }
          if (cov >= 50) return { textColor: AMBER }
          if (cov > 0) return { textColor: RED }
          return null
        },
      })
    }
    y += 4
  }

  // ========================================================================
  // 15. INCIDENTES E DENUNCIAS
  // ========================================================================

  if (totalIncidentes > 0 || totalDenuncias > 0) {
    y = checkPageBreak(doc, y, 40, logoBase64, title)
    y = addSectionTitle(doc, y, 'Gestão de Incidentes')

    // Stat boxes
    const incBoxW = (PAGE.contentWidth - 12) / 5
    const incStats = [
      { label: 'Incidentes', value: String(totalIncidentes), color: ANEST_COLORS.primaryDark },
      { label: 'Denúncias', value: String(totalDenuncias), color: totalDenuncias > 0 ? AMBER : TEXT_MUTED },
      { label: 'Pendentes', value: String(incidentsByStatus.pendente || 0), color: (incidentsByStatus.pendente || 0) > 0 ? RED : TEXT_MUTED },
      { label: 'Em Análise', value: String(incidentsByStatus.em_analise || 0), color: AMBER },
      { label: 'Concluídos', value: String(incidentsByStatus.concluido || 0), color: GREEN },
    ]

    incStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (incBoxW + 3), y, incBoxW, st.value, st.label, st.color)
    })
    y += 22

    // Status progress bars
    const totalInc = totalIncidentes || 1
    const statusBars = [
      { label: `Pendentes (${incidentsByStatus.pendente || 0})`, pct: ((incidentsByStatus.pendente || 0) / totalInc) * 100, color: RED },
      { label: `Em Análise (${incidentsByStatus.em_analise || 0})`, pct: ((incidentsByStatus.em_analise || 0) / totalInc) * 100, color: AMBER },
      { label: `Concluídos (${incidentsByStatus.concluido || 0})`, pct: ((incidentsByStatus.concluido || 0) / totalInc) * 100, color: GREEN },
    ]

    statusBars.forEach((bar) => {
      y = checkPageBreak(doc, y, 10, logoBase64, title)
      y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, bar.pct, bar.label, bar.color)
    })

    // Severity breakdown
    const SEVERITY_COLORS = {
      critico: { label: 'Crítico', color: [220, 38, 38] },
      grave: { label: 'Grave', color: [234, 88, 12] },
      moderado: { label: 'Moderado', color: [217, 119, 6] },
      leve: { label: 'Leve', color: [59, 130, 246] },
      near_miss: { label: 'Near Miss', color: [107, 114, 128] },
    }
    const hasSeverity = incidentsBySeverity && Object.values(incidentsBySeverity).some((v) => v > 0)
    if (hasSeverity) {
      y += 2
      y = checkPageBreak(doc, y, 20, logoBase64, title)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text('Por severidade:', PAGE.marginLeft + 2, y + 3)
      y += 7

      const sevBoxW = (PAGE.contentWidth - 12) / 5
      let sevIdx = 0
      Object.entries(SEVERITY_COLORS).forEach(([key, cfg]) => {
        const count = incidentsBySeverity[key] || 0
        const sx = PAGE.marginLeft + sevIdx * (sevBoxW + 3)
        doc.setFillColor(...(count > 0 ? cfg.color : GRAY_BORDER))
        doc.roundedRect(sx, y, sevBoxW, 12, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...WHITE)
        doc.text(String(count), sx + sevBoxW / 2, y + 7, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.text(cfg.label, sx + sevBoxW / 2, y + 11, { align: 'center' })
        sevIdx++
      })
      y += 16
    }

    // Mean resolution
    if (meanResolutionDays != null) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text(`Tempo médio de resolução: ${meanResolutionDays} dias`, PAGE.marginLeft + 2, y + 3)
      y += 6
    }

    // Top incident types
    if (incidentesByTipo.length > 0) {
      y += 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text('Tipos mais frequentes:', PAGE.marginLeft + 2, y + 3)
      y += 6

      incidentesByTipo.forEach((item) => {
        y = checkPageBreak(doc, y, 7, logoBase64, title)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_DARK)
        doc.text(`  •  ${item.tipo}`, PAGE.marginLeft + 3, y + 3)

        doc.setFont('helvetica', 'bold')
        doc.text(String(item.count), PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
        y += 5
      })
    }
    y += 4
  }

  // ========================================================================
  // 16. INDICADORES DETALHADOS (KPIs)
  // ========================================================================

  if (kpiIndicadores.length > 0) {
    y = checkPageBreak(doc, y, 50, logoBase64, title)
    y = addSectionTitle(doc, y, 'Indicadores de Segurança — Detalhamento')

    // Top criticos
    if (topCriticos.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...RED)
      doc.text('Top Críticos (abaixo da meta):', PAGE.marginLeft + 2, y + 3)
      y += 7

      topCriticos.forEach((ind) => {
        y = checkPageBreak(doc, y, 12, logoBase64, title)
        const nome = ind.titulo || ind.nome || ind.id
        const valor = ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D'
        const metaStr = ind.metaLabel || (ind.meta?.raw) || ''

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_DARK)
        doc.text(`  •  ${nome}`, PAGE.marginLeft + 3, y + 3)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...RED)
        doc.text(valor, PAGE.marginLeft + PAGE.contentWidth - 40, y + 3, { align: 'right' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...TEXT_MUTED)
        doc.text(metaStr, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
        y += 6
      })
      y += 2
    }

    // Top destaques
    if (topDestaques.length > 0) {
      y = checkPageBreak(doc, y, 15, logoBase64, title)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...GREEN)
      doc.text('Top Destaques (acima da meta):', PAGE.marginLeft + 2, y + 3)
      y += 7

      topDestaques.forEach((ind) => {
        y = checkPageBreak(doc, y, 12, logoBase64, title)
        const nome = ind.titulo || ind.nome || ind.id
        const valor = ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D'
        const metaStr = ind.metaLabel || (ind.meta?.raw) || ''

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_DARK)
        doc.text(`  •  ${nome}`, PAGE.marginLeft + 3, y + 3)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...GREEN)
        doc.text(valor, PAGE.marginLeft + PAGE.contentWidth - 40, y + 3, { align: 'right' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...TEXT_MUTED)
        doc.text(metaStr, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
        y += 6
      })
      y += 2
    }

    // Full KPI table — grouped by dimensao
    const dimConfig = dimensaoConfig || DIMENSAO_CONFIG || {}
    const kpisByDimensao = {}
    kpiIndicadores.forEach((ind) => {
      const dim = ind.dimensao || 'outros'
      if (!kpisByDimensao[dim]) kpisByDimensao[dim] = []
      kpisByDimensao[dim].push(ind)
    })

    const kpiCols = [
      { label: 'Indicador', width: 80, align: 'left' },
      { label: 'Valor Atual', width: 25, align: 'center' },
      { label: 'Meta', width: 25, align: 'center' },
      { label: 'Status', width: 25, align: 'center' },
      { label: 'Tendência', width: 25, align: 'center' },
    ]

    function buildKpiRow(ind) {
      const valor = ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D'
      const meta = ind.metaLabel || (ind.meta?.raw) || '-'
      const statusLabel = ind.statusAtual?.variant === 'success' ? 'Conforme'
        : ind.statusAtual?.variant === 'warning' ? 'Parcial'
        : ind.statusAtual?.variant === 'destructive' ? 'N/Conforme'
        : 'S/Dados'
      const trend = ind.tendencia === 'up' ? 'Subindo'
        : ind.tendencia === 'up_good' ? 'Subindo'
        : ind.tendencia === 'down' ? 'Caindo'
        : ind.tendencia === 'down_bad' ? 'Caindo'
        : ind.tendencia === 'stable' ? 'Estável'
        : 'S/Dados'
      return [ind.titulo || ind.nome || ind.id, valor, meta, statusLabel, trend]
    }

    const kpiRowStyle = (rowIndex, row) => {
      if (row[3] === 'N/Conforme') return { textColor: RED }
      if (row[3] === 'Parcial') return { textColor: AMBER }
      if (row[3] === 'Conforme') return { textColor: GREEN }
      return { textColor: TEXT_MUTED }
    }

    Object.entries(kpisByDimensao).forEach(([dimKey, indicators]) => {
      y = checkPageBreak(doc, y, 30, logoBase64, title)

      // Dimension sub-title with color
      const dc = dimConfig[dimKey]
      const dimLabel = dc?.label || dimKey.charAt(0).toUpperCase() + dimKey.slice(1)
      const dimColorHex = dc?.color || '#374151'
      // Parse hex to RGB
      const r = parseInt(dimColorHex.slice(1, 3), 16)
      const g = parseInt(dimColorHex.slice(3, 5), 16)
      const b = parseInt(dimColorHex.slice(5, 7), 16)

      doc.setFillColor(r, g, b)
      doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 6, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...WHITE)
      doc.text(dimLabel, PAGE.marginLeft + 4, y + 4.2)
      y += 8

      const rows = indicators.map(buildKpiRow)
      y = drawTable(doc, y, kpiCols, rows, {
        rowHeight: 6,
        fontSize: 7,
        rowStyle: kpiRowStyle,
      })
      y += 4
    })
    y += 2
  }

  // ========================================================================
  // 17. ATIVIDADE RECENTE (DOCUMENTOS)
  // ========================================================================

  if (recentChanges?.length > 0) {
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, 'Atividade Recente — Documentos')

    const actLabels = {
      created: 'Criado',
      updated: 'Atualizado',
      status_changed: 'Status alterado',
      approved: 'Aprovado',
      reviewed: 'Revisado',
    }

    recentChanges.slice(0, 10).forEach((change) => {
      y = checkPageBreak(doc, y, 10, logoBase64, title)
      const actionLabel = actLabels[change.action] || change.action || 'Alteracao'
      const dateStr = change.date ? new Date(change.date).toLocaleDateString('pt-BR') : ''

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...BLUE)
      doc.text(actionLabel, PAGE.marginLeft + 3, y + 3)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      const docTitle = change.title || change.titulo || 'Documento'
      const truncTitle = docTitle.length > 60 ? docTitle.slice(0, 57) + '...' : docTitle
      doc.text(truncTitle, PAGE.marginLeft + 30, y + 3)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_MUTED)
      doc.text(dateStr, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
      y += 6
    })
    y += 4
  }

  // ========================================================================
  // 18. RESPONSAVEL TECNICO E ASSINATURA
  // ========================================================================

  y = checkPageBreak(doc, y, 50, logoBase64, title)
  y = addSectionTitle(doc, y, 'Responsavel Tecnico e Assinatura')

  // Generation date/time
  const geradoEm = new Date().toLocaleString('pt-BR')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`Data/hora de geracao: ${geradoEm}`, PAGE.marginLeft + 2, y + 3)
  y += 6

  // Generator name
  const nomeGerador = geradoPor || 'Administrador'
  doc.text(`Gerado por: ${nomeGerador}`, PAGE.marginLeft + 2, y + 3)
  y += 12

  // Signature lines
  const sigLineW = 65
  const sigStartX1 = PAGE.marginLeft + 10
  const sigStartX2 = PAGE.marginLeft + PAGE.contentWidth - sigLineW - 10

  // Line 1: Responsavel Tecnico
  doc.setDrawColor(...TEXT_DARK)
  doc.setLineWidth(0.4)
  doc.line(sigStartX1, y, sigStartX1 + sigLineW, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_MUTED)
  doc.text('Responsavel Tecnico', sigStartX1 + sigLineW / 2, y + 4, { align: 'center' })

  // Line 2: Coordenador da Qualidade
  doc.line(sigStartX2, y, sigStartX2 + sigLineW, y)
  doc.text('Coordenador da Qualidade', sigStartX2 + sigLineW / 2, y + 4, { align: 'center' })

  y += 10
}

export default { getMeta, render }
