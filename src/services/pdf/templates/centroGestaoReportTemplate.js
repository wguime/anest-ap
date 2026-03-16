/**
 * centroGestaoReportTemplate.js - Centro de Gestao PDF Report Template
 *
 * Generates a consolidated administrative audit report with:
 * - Sumario (table of contents)
 * - Usuarios, Documentos, Comunicados, Incidentes, Autoavaliacao,
 *   Auditorias, Planos PDCA, KPIs, Residencia, Educacao, Staff,
 *   Infraestrutura, LGPD, Alertas Criticos, Assinatura
 *
 * Each section contains summary stat boxes + detailed audit tables.
 * Data source: useCentroGestaoDashboard hook
 */

import {
  ANEST_COLORS,
  PAGE,
  addSectionTitle,
  drawStatBox,
  drawProgressBar,
  drawTable,
  checkPageBreak,
  sanitizeForPdf,
} from '../pdfBranding'

// ============================================================================
// CONSTANTS & COLORS
// ============================================================================

const TEXT_DARK = [31, 41, 55]
const TEXT_MUTED = [107, 114, 128]
const GREEN = [34, 197, 94]
const AMBER = [245, 158, 11]
const RED = [220, 38, 38]
const WHITE = [255, 255, 255]
const BLUE = [59, 130, 246]

// ============================================================================
// LOCAL HELPERS
// ============================================================================

/** Inline label: value */
function drawTextLine(doc, x, y, label, value, logoBase64, title) {
  y = checkPageBreak(doc, y, 7, logoBase64, title)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`${label}: ${value}`, x, y + 3)
  return y + 6
}

/** Section separator — thin gray line + spacing */
function drawSectionDivider(doc, y, logoBase64, title) {
  y = checkPageBreak(doc, y, 8, logoBase64, title)
  doc.setDrawColor(210, 220, 212)
  doc.setLineWidth(0.2)
  doc.line(PAGE.marginLeft + 20, y + 2, PAGE.width - PAGE.marginRight - 20, y + 2)
  return y + 6
}

/** Detail sub-title with left accent bar and item count */
function drawDetailHeader(doc, y, text, count, logoBase64, title) {
  y = checkPageBreak(doc, y, 14, logoBase64, title)

  // Light background band
  doc.setFillColor(240, 248, 241)
  doc.rect(PAGE.marginLeft, y, PAGE.contentWidth, 8, 'F')

  // Left accent bar
  doc.setFillColor(...ANEST_COLORS.accent)
  doc.rect(PAGE.marginLeft, y, 2, 8, 'F')

  // Title text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...ANEST_COLORS.primaryDark)
  const label = count != null ? `${text} (${count})` : text
  doc.text(label, PAGE.marginLeft + 5, y + 5.5)

  return y + 10
}

/** Warning/attention card with icon background */
function drawWarningBox(doc, y, text, logoBase64, title) {
  y = checkPageBreak(doc, y, 10, logoBase64, title)

  doc.setFillColor(255, 245, 245)
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.3)
  doc.roundedRect(PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, 7, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text(`!   ${text}`, PAGE.marginLeft + 5, y + 4.8)

  return y + 9
}

/** Numbered section title — wraps addSectionTitle with number prefix */
function drawNumberedSection(doc, y, num, text, logoBase64, title) {
  y = checkPageBreak(doc, y, 40, logoBase64, title)
  return addSectionTitle(doc, y, `${num}. ${text}`)
}

/** Parse pt-BR date string "dd/mm/yyyy" to Date */
function parsePtBrDate(str) {
  if (!str || str === '-') return null
  const parts = str.split('/')
  if (parts.length !== 3) return null
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
}

/** Filter a list by date range using a pt-BR formatted date field */
function filterByDateRange(list, dateFieldName, dateRange) {
  if (!dateRange?.start && !dateRange?.end) return list
  const startD = dateRange.start ? new Date(dateRange.start) : null
  const endD = dateRange.end ? new Date(dateRange.end) : null
  if (endD) endD.setHours(23, 59, 59, 999)
  return list.filter((item) => {
    const parsed = parsePtBrDate(item[dateFieldName])
    if (!parsed) return true
    if (startD && parsed < startD) return false
    if (endD && parsed > endD) return false
    return true
  })
}

// ============================================================================
// TEMPLATE API
// ============================================================================

export function getMeta(data) {
  return {
    title: 'Relatorio Centro de Gestao',
    subtitle: 'ANEST — Relatorio Administrativo Consolidado para Auditoria',
  }
}

export function render(doc, startY, data, context = {}) {
  const {
    selectedSections,
    dateRange,
    geradoPor,
    // Usuarios
    totalUsers = 0, activeUsers = 0, adminUsers = 0,
    usersByRole = [], authorizedEmailsCount = 0,
    // Documentos
    totalDocuments = 0, archivedDocuments = 0, pendingDocuments = 0,
    overdueDocuments = 0, documentComplianceScore = 0, documentsByCategory = [],
    // Comunicados
    totalComunicados = 0, comunicadosByPriority = {}, avgReadRate = 0, unreadComunicados = 0,
    // Incidentes
    totalIncidentes = 0, totalDenuncias = 0, incidentsByStatus = {},
    incidentsBySeverity = {}, meanResolutionDays = null, staleIncidents = 0,
    // Autoavaliacao
    ropProgressoGeral = {}, ropAreaBreakdown = [], overdueAvaliacoes = [],
    // Auditorias
    totalExecucoes = 0, execucoesByStatus = {}, avgAuditScore = null, overdueAuditorias = [],
    // Planos
    totalPlanos = 0, planosByStatus = {}, taxaConclusao = 0,
    overduePlanos = [], planosDonutData = [],
    // KPIs
    kpiScoreGeral = 0, kpiConformes = 0, kpiNaoConformes = 0,
    topCriticos = [], topDestaques = [],
    // Residencia
    totalResidentes = 0, residentesByAno = {},
    // Educacao (admin)
    totalCursos = 0, totalUsuariosEducacao = 0, taxaConclusaoEducacao = 0,
    taxaConformidadeEducacao = 0, totalAtrasadosEducacao = 0,
    totalConcluidos = 0, totalAssignments = 0, progressoPorTipoEducacao = [],
    // Staff
    totalStaff = 0, staffHospitais = 0, staffConsultorio = 0,
    // Alertas
    criticalAlerts = [],
    // Listas detalhadas (auditoria)
    usersList = [], documentsList = [], comunicadosList = [],
    incidentesList = [], denunciasList = [], execucoesList = [],
    planosList = [], kpiIndicadores = [], residentesList = [],
    staffDetalhado = {}, cursosCompliancePdf = [], colaboradoresAgrupadosPdf = {},
  } = data

  const { logoBase64, title } = context
  let y = startY

  const sel = selectedSections || []
  const has = (id) => sel.includes(id)

  // ========================================================================
  // CONFIDENTIALITY NOTICE
  // ========================================================================

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_MUTED)
  doc.text(
    'Documento confidencial para fins de auditoria interna. Distribuicao restrita a gestores autorizados.',
    PAGE.width / 2, y + 2, { align: 'center' }
  )
  y += 7

  // Date range display
  if (dateRange?.start || dateRange?.end) {
    const fmtDate = (iso) => {
      if (!iso) return '-'
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR')
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...ANEST_COLORS.primaryDark)
    doc.text(
      `Periodo de analise: ${fmtDate(dateRange.start)} a ${fmtDate(dateRange.end)}`,
      PAGE.width / 2, y + 2, { align: 'center' }
    )
    y += 7
  }

  // ========================================================================
  // TABLE OF CONTENTS (SUMARIO)
  // ========================================================================

  const tocSections = []
  let sectionNum = 0
  if (has('usuarios'))      { sectionNum++; tocSections.push({ num: sectionNum, label: 'Usuarios' }) }
  if (has('documentos'))    { sectionNum++; tocSections.push({ num: sectionNum, label: 'Documentos' }) }
  if (has('comunicados'))   { sectionNum++; tocSections.push({ num: sectionNum, label: 'Comunicados' }) }
  if (has('incidentes'))    { sectionNum++; tocSections.push({ num: sectionNum, label: 'Incidentes e Denuncias' }) }
  if (has('autoavaliacao')) { sectionNum++; tocSections.push({ num: sectionNum, label: 'Autoavaliacao ROPs' }) }
  if (has('auditorias'))    { sectionNum++; tocSections.push({ num: sectionNum, label: 'Auditorias Interativas' }) }
  if (has('planos'))        { sectionNum++; tocSections.push({ num: sectionNum, label: 'Planos de Acao PDCA' }) }
  if (has('kpis'))          { sectionNum++; tocSections.push({ num: sectionNum, label: 'Indicadores de Seguranca (KPIs)' }) }
  if (has('residencia'))    { sectionNum++; tocSections.push({ num: sectionNum, label: 'Residencia Medica' }) }
  if (has('educacao'))      { sectionNum++; tocSections.push({ num: sectionNum, label: 'Educacao Continuada' }) }
  if (has('staff'))         { sectionNum++; tocSections.push({ num: sectionNum, label: 'Staff' }) }
  if (has('infraestrutura')) { sectionNum++; tocSections.push({ num: sectionNum, label: 'Infraestrutura' }) }
  if (has('lgpd'))          { sectionNum++; tocSections.push({ num: sectionNum, label: 'LGPD' }) }

  if (tocSections.length > 1) {
    y = addSectionTitle(doc, y, 'Sumario')

    tocSections.forEach((sec) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text(`${sec.num}.`, PAGE.marginLeft + 4, y + 3)
      doc.text(sec.label, PAGE.marginLeft + 12, y + 3)

      // Dotted leader
      doc.setDrawColor(200, 210, 200)
      doc.setLineWidth(0.1)
      const textEndX = PAGE.marginLeft + 12 + doc.getTextWidth(sec.label) + 2
      const leaderEndX = PAGE.width - PAGE.marginRight - 4
      if (leaderEndX > textEndX + 5) {
        for (let dx = textEndX; dx < leaderEndX; dx += 2) {
          doc.line(dx, y + 3.5, dx + 0.5, y + 3.5)
        }
      }

      y += 6
    })

    y += 4
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // Track section numbering for each rendered section
  // ========================================================================

  let secIdx = 0

  // ========================================================================
  // 1. USUARIOS
  // ========================================================================

  if (has('usuarios')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Usuarios', logoBase64, title)

    const boxW = (PAGE.contentWidth - 9) / 4
    const userStats = [
      { label: 'Total', value: String(totalUsers), color: ANEST_COLORS.primaryDark },
      { label: 'Ativos', value: String(activeUsers), color: ANEST_COLORS.success },
      { label: 'Admins', value: String(adminUsers), color: ANEST_COLORS.warning },
      { label: 'Emails Aut.', value: String(authorizedEmailsCount), color: TEXT_MUTED },
    ]
    userStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    if (usersByRole.length > 0) {
      y += 2
      y = drawTable(doc, y, [
        { label: 'Cargo', width: 80 },
        { label: 'Qtd', width: 30, align: 'center' },
      ], usersByRole.map((r) => [r.label, String(r.count)]), { rowHeight: 7, fontSize: 8 })
    }

    if (usersList.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Usuarios', usersList.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Nome', width: 34 },
        { label: 'Email', width: 42 },
        { label: 'Cargo', width: 26 },
        { label: 'Admin', width: 14, align: 'center' },
        { label: 'Coord.', width: 14, align: 'center' },
        { label: 'Ult. Acesso', width: 24, align: 'center' },
        { label: 'Ativo', width: 14, align: 'center' },
      ], usersList.map((u) => [u.nome, u.email, u.cargo, u.admin, u.coordenador, u.ultimoAcesso, u.ativo]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 2. DOCUMENTOS
  // ========================================================================

  if (has('documentos')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Documentos', logoBase64, title)

    const boxW = (PAGE.contentWidth - 9) / 4
    const docStats = [
      { label: 'Total', value: String(totalDocuments), color: ANEST_COLORS.primaryDark },
      { label: 'Arquivados', value: String(archivedDocuments), color: TEXT_MUTED },
      { label: 'Pendentes', value: String(pendingDocuments), color: pendingDocuments > 0 ? AMBER : TEXT_MUTED },
      { label: 'Vencidos', value: String(overdueDocuments), color: overdueDocuments > 0 ? RED : TEXT_MUTED },
    ]
    docStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    const metaLabel = documentComplianceScore >= 80 ? 'Score de Conformidade (Meta: 80%)' : 'Score de Conformidade (Meta: 80% - ABAIXO)'
    y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, documentComplianceScore, metaLabel, documentComplianceScore >= 80 ? ANEST_COLORS.primaryDark : RED)

    if (documentsByCategory.length > 0) {
      y += 2
      y = drawTable(doc, y, [
        { label: 'Categoria', width: 100 },
        { label: 'Documentos', width: 40, align: 'center' },
      ], documentsByCategory.map((c) => [c.label, String(c.count)]), { rowHeight: 7, fontSize: 8 })
    }

    if (overdueDocuments > 0) {
      y += 3
      y = drawWarningBox(doc, y, `${overdueDocuments} documento(s) com revisao vencida requerem acao imediata.`, logoBase64, title)
    }

    if (documentsList.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Documentos', documentsList.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Titulo', width: 68 },
        { label: 'Categoria', width: 34 },
        { label: 'Status', width: 28 },
        { label: 'Prox. Revisao', width: 30, align: 'center' },
        { label: 'Versao', width: 18, align: 'center' },
      ], documentsList.map((d) => [d.titulo, d.categoria, d.status, d.proximaRevisao, d.versao]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 3. COMUNICADOS
  // ========================================================================

  if (has('comunicados')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Comunicados', logoBase64, title)

    const boxW = (PAGE.contentWidth - 6) / 3
    const comStats = [
      { label: 'Total', value: String(totalComunicados), color: ANEST_COLORS.primaryDark },
      { label: 'Nao Lidos', value: String(unreadComunicados), color: unreadComunicados > 0 ? AMBER : TEXT_MUTED },
      { label: 'Taxa Leitura', value: `${avgReadRate}%`, color: ANEST_COLORS.success },
    ]
    comStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    y = drawTable(doc, y, [
      { label: 'Prioridade', width: 60 },
      { label: 'Enviados', width: 40, align: 'center' },
    ], [
      ['Alta', String(comunicadosByPriority.alta || 0)],
      ['Media', String(comunicadosByPriority.media || 0)],
      ['Baixa', String(comunicadosByPriority.baixa || 0)],
    ], {
      rowHeight: 7, fontSize: 8,
      rowStyle: (ri) => ri === 0 ? { textColor: RED } : ri === 1 ? { textColor: AMBER } : null,
    })

    y += 2
    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Taxa media de leitura geral', `${avgReadRate}%`, logoBase64, title)

    const filteredComunicados = filterByDateRange(comunicadosList, 'data', dateRange)
    if (filteredComunicados.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Comunicados', filteredComunicados.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Titulo', width: 52 },
        { label: 'Prioridade', width: 24 },
        { label: 'Autor', width: 28 },
        { label: 'Data', width: 24, align: 'center' },
        { label: 'Leituras', width: 24, align: 'center' },
        { label: 'Taxa', width: 18, align: 'center' },
      ], filteredComunicados.map((c) => [c.titulo, c.prioridade, c.autor, c.data, c.leituras, c.taxa]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 4. INCIDENTES
  // ========================================================================

  if (has('incidentes')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Incidentes e Denuncias', logoBase64, title)

    const boxW = (PAGE.contentWidth - 6) / 3
    const incStats = [
      { label: 'Incidentes', value: String(totalIncidentes), color: ANEST_COLORS.primaryDark },
      { label: 'Denuncias', value: String(totalDenuncias), color: totalDenuncias > 0 ? AMBER : TEXT_MUTED },
      { label: 'Estagnados >7d', value: String(staleIncidents), color: staleIncidents > 0 ? RED : TEXT_MUTED },
    ]
    incStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    // Severity table
    const totalInc = totalIncidentes || 1
    const sevLabels = { near_miss: 'Near Miss', leve: 'Leve', moderado: 'Moderado', grave: 'Grave', critico: 'Critico' }
    y = drawTable(doc, y, [
      { label: 'Severidade', width: 60 },
      { label: 'Qtd', width: 25, align: 'center' },
      { label: '% Total', width: 30, align: 'center' },
    ], Object.entries(sevLabels).map(([key, label]) => {
      const count = incidentsBySeverity[key] || 0
      return [label, String(count), `${totalIncidentes > 0 ? Math.round((count / totalInc) * 100) : 0}%`]
    }), {
      rowHeight: 7, fontSize: 8,
      rowStyle: (_, row) => {
        if (row[0] === 'Critico') return { textColor: RED }
        if (row[0] === 'Grave') return { textColor: [234, 88, 12] }
        if (row[0] === 'Moderado') return { textColor: AMBER }
        return null
      },
    })

    // Status table
    y += 2
    const statusLabels = { pendente: 'Pendente', em_analise: 'Em Analise', concluido: 'Concluido' }
    y = drawTable(doc, y, [
      { label: 'Status', width: 60 },
      { label: 'Qtd', width: 25, align: 'center' },
    ], Object.entries(statusLabels).map(([key, label]) => [label, String(incidentsByStatus[key] || 0)]),
    { rowHeight: 7, fontSize: 8 })

    if (meanResolutionDays !== null) {
      y += 2
      y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Tempo medio de resolucao', `${meanResolutionDays} dias`, logoBase64, title)
    }

    if (staleIncidents > 0) {
      y += 2
      y = drawWarningBox(doc, y, `${staleIncidents} incidente(s) pendente(s) ha mais de 7 dias sem resolucao.`, logoBase64, title)
    }

    const filteredIncidentes = filterByDateRange(incidentesList, 'data', dateRange)
    if (filteredIncidentes.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Incidentes', filteredIncidentes.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Protocolo', width: 28 },
        { label: 'Tipo', width: 28 },
        { label: 'Severidade', width: 28 },
        { label: 'Status', width: 26 },
        { label: 'Local', width: 40 },
        { label: 'Data', width: 24, align: 'center' },
      ], filteredIncidentes.map((i) => [i.protocolo, i.tipo, i.severidade, i.status, i.local, i.data]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    const filteredDenuncias = filterByDateRange(denunciasList, 'data', dateRange)
    if (filteredDenuncias.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Denuncias', filteredDenuncias.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Protocolo', width: 60 },
        { label: 'Status', width: 50 },
        { label: 'Data', width: 40, align: 'center' },
      ], filteredDenuncias.map((d) => [d.protocolo, d.status, d.data]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 5. AUTOAVALIACAO
  // ========================================================================

  if (has('autoavaliacao')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Autoavaliacao ROPs', logoBase64, title)

    const percentual = ropProgressoGeral.percentual || 0
    y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, percentual, 'Progresso Geral', ANEST_COLORS.primaryDark)

    const boxW = (PAGE.contentWidth - 9) / 4
    const ropStats = [
      { label: 'Total ROPs', value: String(ropProgressoGeral.total || 0), color: ANEST_COLORS.primaryDark },
      { label: 'Conformes', value: String(ropProgressoGeral.conformes || 0), color: GREEN },
      { label: 'Parciais', value: String(ropProgressoGeral.parciais || 0), color: AMBER },
      { label: 'N/C', value: String(ropProgressoGeral.naoConformes || 0), color: (ropProgressoGeral.naoConformes || 0) > 0 ? RED : TEXT_MUTED },
    ]
    y += 2
    ropStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    if (ropAreaBreakdown.length > 0) {
      y = drawTable(doc, y, [
        { label: 'Area', width: 55, align: 'left' },
        { label: 'Avaliados', width: 25, align: 'center' },
        { label: 'Conformes', width: 25, align: 'center' },
        { label: 'Parciais', width: 22, align: 'center' },
        { label: 'N/C', width: 20, align: 'center' },
        { label: 'Score', width: 25, align: 'center' },
      ], ropAreaBreakdown.map((item) => {
        const p = item.progresso || {}
        return [item.label || '', `${p.avaliados || 0}/${p.total || 0}`, String(p.conformes || 0), String(p.parciais || 0), String(p.naoConformes || 0), p.scoreConformidade != null ? `${p.scoreConformidade}%` : '-']
      }), { rowHeight: 7, fontSize: 7 })
    }

    if (overdueAvaliacoes.length > 0) {
      y += 3
      y = drawWarningBox(doc, y, `${overdueAvaliacoes.length} avaliacao(oes) ROP vencida(s)`, logoBase64, title)
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 6. AUDITORIAS
  // ========================================================================

  if (has('auditorias')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Auditorias Interativas', logoBase64, title)

    const boxW = (PAGE.contentWidth - 9) / 4
    const auditStats = [
      { label: 'Total', value: String(totalExecucoes), color: ANEST_COLORS.primaryDark },
      { label: 'Pendentes', value: String(execucoesByStatus.pendente || 0), color: (execucoesByStatus.pendente || 0) > 0 ? AMBER : TEXT_MUTED },
      { label: 'Em Andamento', value: String(execucoesByStatus.em_andamento || 0), color: ANEST_COLORS.warning },
      { label: 'Concluidas', value: String(execucoesByStatus.concluida || 0), color: ANEST_COLORS.success },
    ]
    auditStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    if (avgAuditScore != null) {
      const scoreLabel = avgAuditScore >= 80 ? 'Score Medio de Conformidade (Meta: 80%)' : 'Score Medio de Conformidade (Meta: 80% - ABAIXO)'
      y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, avgAuditScore, scoreLabel, avgAuditScore >= 80 ? ANEST_COLORS.primaryDark : RED)
    }

    const totalExec = totalExecucoes || 1
    y += 2
    y = drawTable(doc, y, [
      { label: 'Status', width: 60 },
      { label: 'Qtd', width: 25, align: 'center' },
      { label: '% Total', width: 30, align: 'center' },
    ], [
      ['Pendentes', String(execucoesByStatus.pendente || 0), `${totalExecucoes > 0 ? Math.round(((execucoesByStatus.pendente || 0) / totalExec) * 100) : 0}%`],
      ['Em Andamento', String(execucoesByStatus.em_andamento || 0), `${totalExecucoes > 0 ? Math.round(((execucoesByStatus.em_andamento || 0) / totalExec) * 100) : 0}%`],
      ['Concluidas', String(execucoesByStatus.concluida || 0), `${totalExecucoes > 0 ? Math.round(((execucoesByStatus.concluida || 0) / totalExec) * 100) : 0}%`],
    ], { rowHeight: 7, fontSize: 8 })

    if (overdueAuditorias.length > 0) {
      y += 3
      y = drawWarningBox(doc, y, `${overdueAuditorias.length} auditoria(s) com prazo vencido.`, logoBase64, title)
    }

    const filteredExecucoes = filterByDateRange(execucoesList, 'data', dateRange)
    if (filteredExecucoes.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Execucoes de Auditoria', filteredExecucoes.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Titulo', width: 44 },
        { label: 'Auditor', width: 34 },
        { label: 'Setor', width: 34 },
        { label: 'Score', width: 20, align: 'center' },
        { label: 'Status', width: 26 },
        { label: 'Data', width: 24, align: 'center' },
      ], filteredExecucoes.map((e) => [e.titulo, e.auditor, e.setor, e.score, e.status, e.data]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 7. PLANOS DE ACAO
  // ========================================================================

  if (has('planos')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Planos de Acao PDCA', logoBase64, title)

    const boxW = (PAGE.contentWidth - 6) / 3
    const planoStats = [
      { label: 'Total', value: String(totalPlanos), color: ANEST_COLORS.primaryDark },
      { label: 'Taxa Conclusao', value: `${taxaConclusao}%`, color: ANEST_COLORS.success },
      { label: 'Vencidos', value: String(overduePlanos?.length || 0), color: (overduePlanos?.length || 0) > 0 ? RED : TEXT_MUTED },
    ]
    planoStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, taxaConclusao, 'Taxa de Conclusao', ANEST_COLORS.primaryDark)

    if (planosByStatus && Object.keys(planosByStatus).length > 0) {
      const statusLabels = {
        planejamento: 'Planejamento (P)', execucao: 'Execucao (D)',
        verificacao: 'Verificacao (C)', concluido: 'Concluido (A)', cancelado: 'Cancelado',
      }
      const totalP = totalPlanos || 1
      y += 2
      y = drawTable(doc, y, [
        { label: 'Status', width: 60 },
        { label: 'Qtd', width: 25, align: 'center' },
        { label: '% Total', width: 30, align: 'center' },
      ], Object.entries(statusLabels).map(([key, label]) => {
        const count = planosByStatus[key] || 0
        return [label, String(count), `${totalPlanos > 0 ? Math.round((count / totalP) * 100) : 0}%`]
      }), { rowHeight: 7, fontSize: 8 })
    }

    if (overduePlanos?.length > 0) {
      y += 3
      y = drawWarningBox(doc, y, `${overduePlanos.length} plano(s) de acao com prazo vencido.`, logoBase64, title)
    }

    const filteredPlanos = filterByDateRange(planosList, 'prazo', dateRange)
    if (filteredPlanos.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Planos de Acao', filteredPlanos.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Titulo', width: 40 },
        { label: 'Responsavel', width: 28 },
        { label: 'Prazo', width: 24, align: 'center' },
        { label: 'Status', width: 28 },
        { label: 'Prioridade', width: 22 },
        { label: 'Origem', width: 38 },
      ], filteredPlanos.map((p) => [p.titulo, p.responsavel, p.prazo, p.status, p.prioridade, p.origem]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 8. KPIs
  // ========================================================================

  if (has('kpis')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Indicadores de Seguranca (KPIs)', logoBase64, title)

    const boxW = (PAGE.contentWidth - 6) / 3
    const kpiStats = [
      { label: 'Score', value: `${kpiScoreGeral}%`, color: ANEST_COLORS.primaryDark },
      { label: 'Conformes', value: String(kpiConformes), color: GREEN },
      { label: 'Nao Conformes', value: String(kpiNaoConformes), color: kpiNaoConformes > 0 ? RED : TEXT_MUTED },
    ]
    kpiStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, kpiScoreGeral, 'Score Geral de Conformidade', ANEST_COLORS.primaryDark)

    // Top criticos
    if (topCriticos.length > 0) {
      y += 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...RED)
      doc.text('Top Criticos:', PAGE.marginLeft + 2, y + 3)
      y += 6

      topCriticos.slice(0, 5).forEach((ind) => {
        y = checkPageBreak(doc, y, 6, logoBase64, title)
        const nome = ind.titulo || ind.nome || ind.id
        const valor = ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D'
        const status = ind.statusAtual?.variant === 'destructive' ? 'CRITICO' : 'ALERTA'

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...TEXT_DARK)
        doc.text(`  \u2022  ${nome} [${status}]`, PAGE.marginLeft + 3, y + 3)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...RED)
        doc.text(valor, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
        y += 5
      })
      y += 2
    }

    // Top destaques
    if (topDestaques.length > 0) {
      y = checkPageBreak(doc, y, 15, logoBase64, title)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GREEN)
      doc.text('Top Destaques:', PAGE.marginLeft + 2, y + 3)
      y += 6

      topDestaques.forEach((ind) => {
        y = checkPageBreak(doc, y, 6, logoBase64, title)
        const nome = ind.titulo || ind.nome || ind.id
        const valor = ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D'

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...TEXT_DARK)
        doc.text(`  \u2022  ${nome}`, PAGE.marginLeft + 3, y + 3)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...GREEN)
        doc.text(valor, PAGE.marginLeft + PAGE.contentWidth - 5, y + 3, { align: 'right' })
        y += 5
      })
      y += 2
    }

    // Complete KPI table
    if (kpiIndicadores.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Tabela Completa de Indicadores', kpiIndicadores.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Indicador', width: 58 },
        { label: 'Ultimo Valor', width: 28, align: 'center' },
        { label: 'Meta', width: 28, align: 'center' },
        { label: 'Status', width: 28, align: 'center' },
        { label: 'Tendencia', width: 28, align: 'center' },
      ], kpiIndicadores.map((k) => [k.titulo, k.ultimoValor, k.meta, k.status, k.tendencia]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 9. RESIDENCIA
  // ========================================================================

  if (has('residencia')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Residencia Medica', logoBase64, title)

    const boxW = (PAGE.contentWidth - 3) / 2
    drawStatBox(doc, PAGE.marginLeft, y, boxW, String(totalResidentes), 'Total Residentes', ANEST_COLORS.primaryDark)
    y += 22

    if (residentesByAno && Object.keys(residentesByAno).length > 0) {
      y = drawTable(doc, y, [
        { label: 'Ano', width: 80 },
        { label: 'Residentes', width: 40, align: 'center' },
      ], Object.entries(residentesByAno).map(([ano, count]) => [String(ano), String(count)]),
      { rowHeight: 7, fontSize: 8 })
    }

    if (residentesList.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Lista Completa de Residentes', residentesList.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Nome', width: 68 },
        { label: 'Ano', width: 38, align: 'center' },
        { label: 'Estagio', width: 58 },
      ], residentesList.map((r) => [r.nome, r.ano, r.estagio]),
      { rowHeight: 6, fontSize: 6.5 })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 10. EDUCACAO CONTINUADA
  // ========================================================================

  if (has('educacao')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Educacao Continuada', logoBase64, title)

    const boxW = (PAGE.contentWidth - 9) / 4
    const eduStats = [
      { label: 'Treinamentos', value: String(totalCursos), color: ANEST_COLORS.primaryDark },
      { label: 'Usuarios', value: String(totalUsuariosEducacao), color: ANEST_COLORS.primaryDark },
      { label: 'Conclusao', value: `${taxaConclusaoEducacao}%`, color: GREEN },
      { label: 'Atrasados', value: String(totalAtrasadosEducacao), color: RED },
    ]
    eduStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, taxaConclusaoEducacao, 'Taxa de Conclusao', ANEST_COLORS.primaryDark)
    y = drawProgressBar(doc, PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, taxaConformidadeEducacao, 'Conformidade Geral', GREEN)

    y += 2
    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Atribuicoes concluidas', `${totalConcluidos}/${totalAssignments}`, logoBase64, title)

    if (progressoPorTipoEducacao.length > 0) {
      y += 4
      y = checkPageBreak(doc, y, 30, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Tipo', width: 60 },
        { label: 'Usuarios', width: 30 },
        { label: 'Progresso Medio', width: 45 },
        { label: 'Concluidos', width: 35 },
      ], progressoPorTipoEducacao.map((t) => [t.label, String(t.totalUsuarios), `${t.progressoMedio}%`, String(t.concluidos)]),
      { rowHeight: 7, fontSize: 8 })
    }

    // Compliance por treinamento
    if (cursosCompliancePdf.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Compliance por Treinamento', cursosCompliancePdf.length, logoBase64, title)
      y = drawTable(doc, y, [
        { label: 'Treinamento', width: 48 },
        { label: 'Concl.', width: 18, align: 'center' },
        { label: 'Em And.', width: 18, align: 'center' },
        { label: 'N/Inic.', width: 18, align: 'center' },
        { label: 'Atras.', width: 18, align: 'center' },
        { label: 'Conforme', width: 22, align: 'center' },
      ], cursosCompliancePdf.map((c) => [
        c.titulo || '-', String(c.concluidos || 0), String(c.emAndamento || 0),
        String(c.naoIniciados || 0), String(c.atrasados || 0), c.conforme ? 'Sim' : 'Nao',
      ]), { rowHeight: 6, fontSize: 6.5 })
    }

    // Progresso por colaborador (agrupado por cargo)
    const grupoKeys = Object.keys(colaboradoresAgrupadosPdf)
    if (grupoKeys.length > 0) {
      y += 4
      y = drawDetailHeader(doc, y, 'Progresso por Colaborador', null, logoBase64, title)

      grupoKeys.forEach((tipo) => {
        const grupo = colaboradoresAgrupadosPdf[tipo]
        if (!grupo?.usuarios?.length) return

        y = checkPageBreak(doc, y, 14, logoBase64, title)

        // Cargo group label
        doc.setFillColor(235, 245, 250)
        doc.rect(PAGE.marginLeft + 2, y, PAGE.contentWidth - 4, 6, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...BLUE)
        doc.text(`${grupo.label || tipo} (${grupo.usuarios.length})`, PAGE.marginLeft + 5, y + 4)
        y += 7

        y = drawTable(doc, y, [
          { label: 'Nome', width: 48 },
          { label: 'Progresso', width: 26, align: 'center' },
          { label: 'Concl.', width: 22, align: 'center' },
          { label: 'Total', width: 22, align: 'center' },
          { label: 'Status', width: 30 },
        ], grupo.usuarios.map((u) => [
          u.nome || '-', `${u.progressoMedio || 0}%`,
          String(u.cursosConc || 0), String(u.totalCursos || 0), u.status || '-',
        ]), { rowHeight: 6, fontSize: 6.5 })
        y += 3
      })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 11. STAFF
  // ========================================================================

  if (has('staff')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Staff', logoBase64, title)

    const boxW = (PAGE.contentWidth - 6) / 3
    const staffStats = [
      { label: 'Total', value: String(totalStaff), color: ANEST_COLORS.primaryDark },
      { label: 'Hospitais', value: String(staffHospitais), color: ANEST_COLORS.success },
      { label: 'Consultorio', value: String(staffConsultorio), color: ANEST_COLORS.warning },
    ]
    staffStats.forEach((st, i) => {
      drawStatBox(doc, PAGE.marginLeft + i * (boxW + 3), y, boxW, st.value, st.label, st.color)
    })
    y += 22

    // Staff by hospital
    if (staffDetalhado.hospitais && Object.keys(staffDetalhado.hospitais).length > 0) {
      Object.entries(staffDetalhado.hospitais).forEach(([local, lista]) => {
        if (!lista?.length) return
        y += 2
        y = drawDetailHeader(doc, y, `Hospital — ${local}`, lista.length, logoBase64, title)
        y = drawTable(doc, y, [{ label: 'Nome', width: 120 }], lista.map((s) => [s.nome]),
        { rowHeight: 6, fontSize: 6.5 })
      })
    }

    // Staff by consultorio
    if (staffDetalhado.consultorio && Object.keys(staffDetalhado.consultorio).length > 0) {
      Object.entries(staffDetalhado.consultorio).forEach(([role, lista]) => {
        if (!lista?.length) return
        y += 2
        y = drawDetailHeader(doc, y, `Consultorio — ${role}`, lista.length, logoBase64, title)
        y = drawTable(doc, y, [{ label: 'Nome', width: 120 }], lista.map((s) => [s.nome]),
        { rowHeight: 6, fontSize: 6.5 })
      })
    }

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 12. INFRAESTRUTURA
  // ========================================================================

  if (has('infraestrutura')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'Infraestrutura do Sistema', logoBase64, title)

    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Firebase', 'Conectado', logoBase64, title)
    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Supabase', 'Conectado', logoBase64, title)
    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Modulos Ativos', 'Todos operacionais', logoBase64, title)

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 13. LGPD
  // ========================================================================

  if (has('lgpd')) {
    secIdx++
    y = drawNumberedSection(doc, y, secIdx, 'LGPD — Protecao de Dados', logoBase64, title)

    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Conformidade Art. 18', 'Solicitacoes via modulo LGPD', logoBase64, title)
    y = drawTextLine(doc, PAGE.marginLeft + 2, y, 'Modulo de Solicitacoes', 'Ativo', logoBase64, title)

    y += 3
    y = drawSectionDivider(doc, y, logoBase64, title)
  }

  // ========================================================================
  // 14. ALERTAS CRITICOS
  // ========================================================================

  if (criticalAlerts.length > 0) {
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, `Alertas Criticos (${criticalAlerts.length})`)

    criticalAlerts.forEach((alert) => {
      y = checkPageBreak(doc, y, 9, logoBase64, title)
      const badgeColor = alert.severity === 'critical' ? RED : AMBER
      const badgeLabel = alert.severity === 'critical' ? 'CRITICO' : 'ATENCAO'

      doc.setFillColor(...badgeColor)
      doc.roundedRect(PAGE.marginLeft + 2, y, 18, 5, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...WHITE)
      doc.text(badgeLabel, PAGE.marginLeft + 11, y + 3.5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...badgeColor)
      doc.text(alert.message, PAGE.marginLeft + 23, y + 3.8)
      y += 8
    })
    y += 4
  }

  // ========================================================================
  // 15. ASSINATURA
  // ========================================================================

  y = checkPageBreak(doc, y, 50, logoBase64, title)
  y = addSectionTitle(doc, y, 'Responsavel Tecnico e Assinatura')

  const geradoEm = new Date().toLocaleString('pt-BR')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`Data/hora de geracao: ${geradoEm}`, PAGE.marginLeft + 2, y + 3)
  y += 6

  const nomeGerador = geradoPor || 'Administrador'
  doc.text(`Gerado por: ${nomeGerador}`, PAGE.marginLeft + 2, y + 3)
  y += 12

  const sigLineW = 65
  const sigStartX1 = PAGE.marginLeft + 10
  const sigStartX2 = PAGE.marginLeft + PAGE.contentWidth - sigLineW - 10

  doc.setDrawColor(...TEXT_DARK)
  doc.setLineWidth(0.4)
  doc.line(sigStartX1, y, sigStartX1 + sigLineW, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_MUTED)
  doc.text('Responsavel Tecnico', sigStartX1 + sigLineW / 2, y + 4, { align: 'center' })

  doc.line(sigStartX2, y, sigStartX2 + sigLineW, y)
  doc.text('Coordenador da Qualidade', sigStartX2 + sigLineW / 2, y + 4, { align: 'center' })

  y += 10
}

export default { getMeta, render }
