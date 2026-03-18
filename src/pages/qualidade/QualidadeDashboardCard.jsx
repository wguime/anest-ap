/**
 * QualidadeDashboardCard - Painel Qmentum validado por Standards Internacionais
 *
 * 7 secoes: Hero, Alertas, InsightCards, Accordion, NextSteps, Conquistas, Admin
 * Substituicao de Tabs por Accordion (NN/g validated para mobile 5+ secoes).
 */
import { useState, useCallback } from 'react'
import {
  Card,
  Badge,
  Progress,
  DonutChart,
  Spinner,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Tooltip,
  Button,
  Modal,
  Select,
} from '@/design-system'
import { AdminOnly } from '@/design-system/components/anest'
import { useUser } from '@/contexts/UserContext'
import { useQualidadeDashboard } from '@/hooks/useQualidadeDashboard'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { useToast } from '@/design-system/components/ui/toast'
import { CYCLE_OPTIONS } from '@/data/autoavaliacaoConfig'
import {
  Shield,
  Clock,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Target,
  FileText,
  Award,
  Settings,
  Download,
  Calendar,
  BarChart3,
  Activity,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
} from 'lucide-react'

// ============================================================================
// HELPERS
// ============================================================================

const NIVEL_CONFIG = {
  diamond: { label: 'Diamond', variant: 'success', badgeStyle: 'solid' },
  platinum: { label: 'Platinum', variant: 'info', badgeStyle: 'solid' },
  gold: { label: 'Gold', variant: 'warning', badgeStyle: 'solid' },
  em_progresso: { label: 'Em Progresso', variant: 'secondary', badgeStyle: 'solid' },
}

const CATEGORY_BADGE = {
  URGENTE: { variant: 'destructive', badgeStyle: 'subtle' },
  MELHORIA: { variant: 'warning', badgeStyle: 'subtle' },
  DADOS: { variant: 'secondary', badgeStyle: 'subtle' },
}

function getProgressVariant(score) {
  if (score >= 80) return 'success'
  if (score >= 50) return 'warning'
  return 'error'
}

function getStatusColor(score) {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function getStrokeColor(score) {
  if (score >= 80) return '#34C759'
  if (score >= 50) return '#F59E0B'
  return '#DC2626'
}

const TOOLTIP_CONTENT = {
  scoreGeral: 'Média ponderada dos 4 pilares de qualidade Qmentum (ROPs, Auditorias, Planos PDCA, KPIs). Quanto maior, mais próximo da acreditação IQG Brasil.',
  nivel: 'Classificação IQG Brasil/Qmentum: Em Progresso (<60%), Gold (60-74%), Platinum (75-89%), Diamond (90%+). Baseado no modelo Accreditation Canada.',
  rops: 'Práticas Organizacionais Requeridas: 32 ROPs em 6 categorias de segurança do paciente (Cultura, Comunicação, Medicamentos, Vida Profissional, Infecções, Riscos). Meta: 100%.',
  auditorias: 'Score médio de conformidade das auditorias interativas concluídas. Avalia aderência a protocolos clínicos. Meta: acima de 80%.',
  planos: '% de planos de ação PDCA (Plan-Do-Check-Act) concluídos. Cada plano trata uma não-conformidade identificada. Ciclo de melhoria contínua Qmentum.',
  kpis: 'Performance em 21 indicadores de segurança e qualidade, alinhados com as dimensões Qmentum (segurança, efetividade, eficiência).',
  evidencias: 'Documentos, fotos, auditorias ou indicadores vinculados como prova de conformidade. Exigidos pela Accreditation Canada para cada ROP.',
  diasCiclo: 'Dias até o encerramento do ciclo trimestral. Todas as avaliações e planos de ação devem ser concluídos antes desta data.',
}

// ============================================================================
// CYCLE SELECT OPTIONS (transform CYCLE_OPTIONS for Select component)
// ============================================================================

const CYCLE_SELECT_OPTIONS = CYCLE_OPTIONS.map((c) => ({
  value: c.id,
  label: c.label,
}))

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

// ============================================================================
// PDF REPORT GENERATOR — Relatório Completo de Qualidade Qmentum
// ============================================================================

async function generateQualidadeReport(data) {
  const {
    scoreGeral, nivelMaturidade, cicloAtual, diasRestantesCiclo,
    subScores, autoavaliacao, auditorias, planos, kpis,
    alerts, nextSteps, achievements, narrative, insights,
  } = data

  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin
  let pageNum = 1

  // ── Colors ──
  const PRIMARY = [0, 104, 55]
  const PRIMARY_LIGHT = [232, 245, 233]
  const TEXT_DARK = [31, 41, 55]
  const TEXT_MUTED = [107, 114, 128]
  const WHITE = [255, 255, 255]
  const GREEN = [34, 197, 94]
  const AMBER = [245, 158, 11]
  const RED = [220, 38, 38]
  const BLUE = [59, 130, 246]
  const GRAY_BG = [249, 250, 251]
  const GRAY_BORDER = [229, 231, 235]

  const nivelLabel = { diamond: 'Diamond', platinum: 'Platinum', gold: 'Gold', em_progresso: 'Em Progresso' }[nivelMaturidade] || 'Em Progresso'
  const cicloInfo = getCycleInfo(cicloAtual)

  // ── Helpers ──
  function scoreColor(v) {
    if (v >= 80) return GREEN
    if (v >= 50) return AMBER
    return RED
  }

  function addFooter() {
    doc.setDrawColor(...GRAY_BORDER)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text('ANEST - Sistema de Gestão de Qualidade', margin, pageHeight - 10)
    doc.text(`Página ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  }

  function newPage() {
    addFooter()
    doc.addPage()
    pageNum++
    y = margin
  }

  function checkPage(needed = 20) {
    if (y + needed > pageHeight - 22) {
      newPage()
    }
  }

  function sectionTitle(title) {
    checkPage(18)
    y += 3
    doc.setFillColor(...PRIMARY)
    doc.rect(margin, y, 3, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...PRIMARY)
    doc.text(title, margin + 6, y + 5.5)
    y += 12
  }

  function drawProgressBar(x, barY, w, value) {
    const h = 4
    doc.setFillColor(...GRAY_BORDER)
    doc.roundedRect(x, barY, w, h, 1.5, 1.5, 'F')
    if (value > 0) {
      doc.setFillColor(...scoreColor(value))
      doc.roundedRect(x, barY, Math.max((value / 100) * w, 2), h, 1.5, 1.5, 'F')
    }
  }

  function tableRow(cols, widths, isHeader, rowY) {
    const rowH = 7
    if (isHeader) {
      doc.setFillColor(...PRIMARY)
      doc.rect(margin, rowY, contentWidth, rowH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...WHITE)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
    }
    let x = margin + 3
    cols.forEach((col, i) => {
      const align = i === 0 ? 'left' : 'center'
      const textX = i === 0 ? x : x + widths[i] / 2
      doc.text(String(col), textX, rowY + 5, { align })
      x += widths[i]
    })
    return rowH + 1
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1 — HEADER / RESUMO EXECUTIVO
  // ══════════════════════════════════════════════════════════════════

  // Header bar
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pageWidth, 36, 'F')
  // Decorative accent line
  doc.setFillColor(34, 197, 94)
  doc.rect(0, 36, pageWidth, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...WHITE)
  doc.text('Relatório de Qualidade Qmentum', pageWidth / 2, 15, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 230, 210)
  doc.text('Sistema ANEST — Acreditação IQG Brasil', pageWidth / 2, 23, { align: 'center' })

  doc.setFontSize(9)
  doc.text(
    `Ciclo: ${cicloInfo?.label || cicloAtual}  |  Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    pageWidth / 2, 31, { align: 'center' }
  )

  y = 44

  // ── Score Geral Card ──
  doc.setFillColor(...PRIMARY_LIGHT)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(...PRIMARY)
  doc.text(`${scoreGeral}%`, margin + 12, y + 18)

  const scoreBoxX = margin + 50
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

  // ── Narrative ──
  if (narrative?.headline) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MUTED)
    const nLines = doc.splitTextToSize(narrative.headline, contentWidth)
    doc.text(nLines, margin, y + 4)
    y += nLines.length * 4 + 4
  }
  if (narrative?.subtextItems?.length > 0) {
    narrative.subtextItems.forEach((item) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MUTED)
      const lines = doc.splitTextToSize(`  •  ${item}`, contentWidth - 4)
      doc.text(lines, margin + 2, y + 3)
      y += lines.length * 3.5 + 1
    })
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════
  // PILARES DE QUALIDADE (4 Cards em grid 2x2)
  // ══════════════════════════════════════════════════════════════════
  sectionTitle('Pilares de Qualidade')

  const cardW = (contentWidth - 4) / 2
  const cardH = 22
  const pillarCards = [
    { label: 'Autoavaliação ROPs', value: subScores.autoScore, detail: `${autoavaliacao.progressoGeral?.avaliados || 0}/${autoavaliacao.progressoGeral?.total || 32} avaliados` },
    { label: 'Auditorias', value: subScores.auditScore, detail: `${auditorias.concluidas || 0}/${auditorias.total || 0} concluídas` },
    { label: 'Planos PDCA', value: subScores.planoScore, detail: `Eficácia: ${planos.taxaEficacia || 0}%` },
    { label: 'Indicadores (KPIs)', value: subScores.kpiScore, detail: `${kpis.conformes || 0}/${kpis.total || 0} conformes` },
  ]

  pillarCards.forEach((card, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx = margin + col * (cardW + 4)
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
    drawProgressBar(cx + cardW - 38, cy + 12, 32, card.value)
  })

  y += 2 * (cardH + 3) + 4

  // ══════════════════════════════════════════════════════════════════
  // ALERTAS E PENDÊNCIAS
  // ══════════════════════════════════════════════════════════════════
  if (alerts.total > 0) {
    sectionTitle(`Alertas e Pendências (${alerts.total})`)

    const alertItems = []
    if (alerts.overdueAvaliacoes?.length > 0)
      alertItems.push({ text: `${alerts.overdueAvaliacoes.length} avaliação(ões) vencida(s)`, color: RED, severity: 'URGENTE' })
    if (alerts.overdueAuditorias?.length > 0)
      alertItems.push({ text: `${alerts.overdueAuditorias.length} auditoria(s) atrasada(s)`, color: RED, severity: 'URGENTE' })
    if (alerts.overduePlanos?.length > 0)
      alertItems.push({ text: `${alerts.overduePlanos.length} plano(s) de ação atrasado(s)`, color: AMBER, severity: 'ATENÇÃO' })

    alertItems.forEach((a) => {
      checkPage(9)
      // Alert badge
      const badgeColor = a.severity === 'URGENTE' ? RED : AMBER
      doc.setFillColor(...badgeColor)
      doc.roundedRect(margin + 2, y, 18, 5, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...WHITE)
      doc.text(a.severity, margin + 11, y + 3.5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...a.color)
      doc.text(a.text, margin + 23, y + 3.8)
      y += 8
    })
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════
  // AUTOAVALIAÇÃO ROPs — Detalhamento por Área
  // ══════════════════════════════════════════════════════════════════
  if (autoavaliacao.areaBreakdown?.length > 0) {
    sectionTitle('Autoavaliação ROPs — Detalhamento por Área')

    // Summary line
    const pg = autoavaliacao.progressoGeral
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(`Progresso geral: ${pg.avaliados}/${pg.total} ROPs avaliados (${pg.percentual}%)`, margin + 2, y)
    y += 3
    drawProgressBar(margin + 2, y, contentWidth - 4, pg.percentual)
    y += 8

    // Table
    const areaWidths = [65, 30, 25, 25, 25]
    y += tableRow(['Área', 'Avaliados', 'Conformes', 'Parciais', 'N/C'], areaWidths, true, y)

    autoavaliacao.areaBreakdown.forEach((area, i) => {
      checkPage(9)
      const bgColor = i % 2 === 0 ? GRAY_BG : WHITE
      doc.setFillColor(...bgColor)
      doc.rect(margin, y, contentWidth, 7, 'F')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)

      let x = margin + 3
      doc.text(area.title, x, y + 5)
      x += areaWidths[0]
      doc.text(`${area.avaliados}/${area.ropCount}`, x + areaWidths[1] / 2, y + 5, { align: 'center' })
      x += areaWidths[1]
      doc.setTextColor(...GREEN)
      doc.text(String(area.conformes || 0), x + areaWidths[2] / 2, y + 5, { align: 'center' })
      x += areaWidths[2]
      doc.setTextColor(...AMBER)
      doc.text(String(area.parciais || 0), x + areaWidths[3] / 2, y + 5, { align: 'center' })
      x += areaWidths[3]
      doc.setTextColor(...RED)
      doc.text(String(area.naoConformes || 0), x + areaWidths[4] / 2, y + 5, { align: 'center' })

      y += 8
    })

    // Evidencias count
    if (autoavaliacao.totalEvidencias != null) {
      y += 2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MUTED)
      doc.text(`${autoavaliacao.totalEvidencias} evidência(s) vinculada(s) neste ciclo`, margin + 2, y + 3)
      y += 6
    }
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════
  // AUDITORIAS INTERATIVAS
  // ══════════════════════════════════════════════════════════════════
  sectionTitle('Auditorias Interativas')

  // Stats grid
  const auditStats = [
    { label: 'Total', value: auditorias.total || 0 },
    { label: 'Concluídas', value: auditorias.concluidas || 0 },
    { label: 'Em Andamento', value: auditorias.emAndamento || 0 },
    { label: 'Atrasadas', value: auditorias.overdue?.length || 0 },
  ]
  const statCardW = (contentWidth - 9) / 4
  auditStats.forEach((st, i) => {
    const sx = margin + i * (statCardW + 3)
    doc.setFillColor(...GRAY_BG)
    doc.setDrawColor(...GRAY_BORDER)
    doc.setLineWidth(0.2)
    doc.roundedRect(sx, y, statCardW, 14, 2, 2, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(st.label, sx + statCardW / 2, y + 5, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    const stColor = st.label === 'Atrasadas' && st.value > 0 ? RED : TEXT_DARK
    doc.setTextColor(...stColor)
    doc.text(String(st.value), sx + statCardW / 2, y + 12, { align: 'center' })
  })
  y += 18

  if (auditorias.averageScore != null) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(`Score médio de conformidade: ${auditorias.averageScore}%`, margin + 2, y + 3)
    drawProgressBar(margin + contentWidth - 62, y + 0.5, 60, auditorias.averageScore)
    y += 8
  }

  // Recent completed
  if (auditorias.recentCompleted?.length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Últimas concluídas:', margin + 2, y + 3)
    y += 6

    auditorias.recentCompleted.forEach((exec) => {
      checkPage(7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      const label = exec.templateTipo || exec.id
      doc.text(`  •  ${label}`, margin + 3, y + 3)
      if (exec.scoreConformidade != null) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...scoreColor(exec.scoreConformidade))
        doc.text(`${exec.scoreConformidade}%`, margin + contentWidth - 5, y + 3, { align: 'right' })
      }
      y += 6
    })
  }
  y += 4

  // ══════════════════════════════════════════════════════════════════
  // PLANOS DE AÇÃO PDCA
  // ══════════════════════════════════════════════════════════════════
  sectionTitle('Planos de Ação PDCA')

  // Taxa conclusao + eficacia bars
  const taxas = [
    { label: 'Taxa de Conclusão', value: planos.taxaConclusao || 0 },
    { label: 'Taxa de Eficácia', value: planos.taxaEficacia || 0 },
  ]
  taxas.forEach((t) => {
    checkPage(10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_DARK)
    doc.text(t.label, margin + 2, y + 3)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...scoreColor(t.value))
    doc.text(`${t.value}%`, margin + 75, y + 3)

    drawProgressBar(margin + 85, y + 0.5, contentWidth - 87, t.value)
    y += 8
  })

  // By status
  if (planos.byStatus && Object.keys(planos.byStatus).length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Por status:', margin + 2, y + 3)
    y += 6

    const statusLabels = {
      planejamento: 'Planejamento', em_andamento: 'Em Andamento',
      concluido: 'Concluído', verificacao: 'Verificação',
      cancelado: 'Cancelado', eficaz: 'Eficaz', nao_eficaz: 'Não Eficaz',
    }
    Object.entries(planos.byStatus).forEach(([key, count]) => {
      if (count === 0) return
      checkPage(7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text(`  •  ${statusLabels[key] || key}: ${count}`, margin + 3, y + 3)
      y += 5
    })
  }

  // By origem
  if (planos.byOrigem && Object.keys(planos.byOrigem).length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Por origem:', margin + 2, y + 3)
    y += 6

    const origemLabels = {
      nao_conformidade: 'Não Conformidade', auditoria: 'Auditoria',
      incidente: 'Incidente', melhoria: 'Melhoria', indicador: 'Indicador',
    }
    Object.entries(planos.byOrigem).forEach(([key, count]) => {
      if (count === 0) return
      checkPage(7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      doc.text(`  •  ${origemLabels[key] || key}: ${count}`, margin + 3, y + 3)
      y += 5
    })
  }

  if (planos.overdue?.length > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...RED)
    doc.text(`${planos.overdue.length} plano(s) atrasado(s)`, margin + 2, y + 3)
    y += 6
  }
  y += 4

  // ══════════════════════════════════════════════════════════════════
  // INDICADORES DE SEGURANÇA (KPIs)
  // ══════════════════════════════════════════════════════════════════
  sectionTitle('Indicadores de Seguranca (KPIs)')

  // Score geral KPIs
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`Score geral: ${kpis.scoreGeral || 0}%`, margin + 2, y + 3)
  drawProgressBar(margin + 50, y + 0.5, contentWidth - 52, kpis.scoreGeral || 0)
  y += 8

  // KPI stats grid
  const kpiStats = [
    { label: 'Total', value: kpis.total || 0, color: TEXT_DARK },
    { label: 'Conformes', value: kpis.conformes || 0, color: GREEN },
    { label: 'Parciais', value: kpis.parciais || 0, color: AMBER },
    { label: 'N/Conformes', value: kpis.naoConformes || 0, color: RED },
    { label: 'Sem Dados', value: kpis.semDados || 0, color: TEXT_MUTED },
  ]
  const kpiCardW = (contentWidth - 12) / 5
  kpiStats.forEach((st, i) => {
    checkPage(16)
    const sx = margin + i * (kpiCardW + 3)
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
    doc.text(String(st.value), sx + kpiCardW / 2, y + 12, { align: 'center' })
  })
  y += 18

  // Alert indicadores
  if (kpis.alertIndicadores?.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DARK)
    doc.text('Indicadores abaixo da meta:', margin + 2, y + 3)
    y += 6

    kpis.alertIndicadores.forEach((ind) => {
      checkPage(7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_DARK)
      const name = ind.titulo || ind.nome || ind.id
      doc.text(`  •  ${name}`, margin + 3, y + 3)

      if (ind.ultimoValor != null) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...RED)
        doc.text(`${ind.ultimoValor}${ind.unidade || ''}`, margin + contentWidth - 5, y + 3, { align: 'right' })
      }
      y += 5
    })
  }
  y += 4

  // ══════════════════════════════════════════════════════════════════
  // PROXIMOS PASSOS
  // ══════════════════════════════════════════════════════════════════
  if (nextSteps?.length > 0) {
    sectionTitle('Proximos Passos')

    nextSteps.forEach((step, i) => {
      checkPage(10)
      const num = String(i + 1)

      // Priority circle
      const circleColor = step.category === 'URGENTE' ? RED : step.category === 'MELHORIA' ? AMBER : TEXT_MUTED
      doc.setFillColor(...circleColor)
      doc.circle(margin + 4, y + 2.5, 2.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...WHITE)
      doc.text(num, margin + 4, y + 3.5, { align: 'center' })

      // Category badge
      const catLabel = step.category
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...circleColor)
      doc.text(catLabel, margin + 9, y + 1)

      // Step text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...TEXT_DARK)
      const lines = doc.splitTextToSize(step.label, contentWidth - 12)
      doc.text(lines, margin + 9, y + 5)
      y += lines.length * 4 + 4
    })
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════
  // CONQUISTAS
  // ══════════════════════════════════════════════════════════════════
  if (achievements?.list?.length > 0) {
    sectionTitle(`Conquistas (${achievements.unlockedCount || 0}/${achievements.total || 0})`)

    const unlocked = achievements.list.filter((a) => a.unlocked)
    const locked = achievements.list.filter((a) => !a.unlocked)

    if (unlocked.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GREEN)
      doc.text('Desbloqueadas:', margin + 2, y + 3)
      y += 6

      unlocked.forEach((ach) => {
        checkPage(7)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_DARK)
        doc.text(`  ★  ${ach.title}`, margin + 3, y + 3)
        if (ach.description) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...TEXT_MUTED)
          doc.text(`      ${ach.description}`, margin + 3, y + 7)
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
      doc.text('Em progresso:', margin + 2, y + 3)
      y += 6

      locked.slice(0, 5).forEach((ach) => {
        checkPage(10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_MUTED)
        const progressText = ach.progress ? ` (${ach.progress.current}/${ach.progress.total})` : ''
        doc.text(`  ○  ${ach.title}${progressText}`, margin + 3, y + 3)

        if (ach.progress) {
          const pPercent = Math.round((ach.progress.current / ach.progress.total) * 100)
          drawProgressBar(margin + contentWidth - 42, y + 0.5, 40, pPercent)
        }
        y += 6
      })
    }
    y += 4
  }

  // ══════════════════════════════════════════════════════════════════
  // PROGRESSO DO CICLO
  // ══════════════════════════════════════════════════════════════════
  if (cicloInfo) {
    sectionTitle('Progresso do Ciclo')

    doc.setFillColor(...GRAY_BG)
    doc.setDrawColor(...GRAY_BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEXT_DARK)
    doc.text(cicloInfo.label, margin + 5, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`${cicloInfo.startDate} a ${cicloInfo.endDate}`, margin + 5, y + 11)

    drawProgressBar(margin + 5, y + 13, contentWidth - 50, cicloInfo.progress)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...PRIMARY)
    doc.text(`${cicloInfo.progress}%`, margin + contentWidth - 40, y + 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`${cicloInfo.elapsed}d decorridos | ${cicloInfo.remaining}d restantes`, margin + contentWidth - 5, y + 11, { align: 'right' })

    y += 24
  }

  // ── Footer on last page ──
  addFooter()

  doc.save(`Relatorio-Qmentum-${cicloAtual}.pdf`)
}

// ============================================================================
// A) HERO — SVG Circular Progress + Narrativa
// ============================================================================

function HeroSection({ scoreGeral, nivelMaturidade, cicloAtual, narrative, nextMilestone }) {
  const nivel = NIVEL_CONFIG[nivelMaturidade] || NIVEL_CONFIG.em_progresso

  // SVG circle math
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (scoreGeral / 100) * circumference
  const strokeColor = getStrokeColor(scoreGeral)

  return (
    <div>
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary dark:text-success" />
          <h2 className="text-base font-semibold text-primary dark:text-foreground">
            Painel Qmentum
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip content={TOOLTIP_CONTENT.nivel}>
            <Badge variant={nivel.variant} badgeStyle={nivel.badgeStyle}>
              {nivel.label}
            </Badge>
          </Tooltip>
          <Badge variant="default" badgeStyle="subtle">
            {cicloAtual}
          </Badge>
        </div>
      </div>

      {/* Circle + Narrative */}
      <div className="flex items-start gap-3">
        {/* SVG Circle */}
        <Tooltip content={TOOLTIP_CONTENT.scoreGeral}>
          <div className="flex-shrink-0">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="w-14 h-14 sm:w-20 sm:h-20"
              role="img"
              aria-label={`Score geral: ${scoreGeral}%`}
            >
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/20"
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700 ease-out"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              {/* Score text */}
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground text-lg font-bold"
                style={{ fontSize: '18px', fontWeight: 700 }}
              >
                {scoreGeral}%
              </text>
            </svg>
          </div>
        </Tooltip>

        {/* Narrative text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {narrative.headline}
          </p>
          {narrative.subtextItems?.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {narrative.subtextItems.map((item, i) => (
                <li key={i} className="flex items-baseline gap-1.5 text-xs text-muted-foreground leading-snug">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-[5px]" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Next milestone progress */}
      {nextMilestone && nextMilestone.remaining > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              Proximo nivel: {nextMilestone.label}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {nextMilestone.remaining > 0 ? `faltam ${nextMilestone.remaining} pts` : 'alcancado!'}
            </span>
          </div>
          <Progress
            value={nextMilestone.progress}
            size="sm"
            variant="success"
            striped
          />
        </div>
      )}

      {/* Cycle text */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
        <Tooltip content={TOOLTIP_CONTENT.diasCiclo}>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {narrative.cycleText}
          </span>
        </Tooltip>
      </div>
    </div>
  )
}

// ============================================================================
// B) ALERTAS ACIONAVEIS (Traffic Light — WHO/Joint Commission)
// ============================================================================

const COMPACT_ALERT_STYLES = {
  warning: 'bg-[#FEF3C7] border-warning text-[#92400E] dark:bg-[#78350F] dark:border-warning dark:text-[#FEF3C7]',
  error: 'bg-[#FEE2E2] border-destructive text-[#991B1B] dark:bg-[#7F1D1D] dark:border-destructive dark:text-[#FEE2E2]',
}

function AlertsSection({ alerts, onNavigate }) {
  const alertItems = []

  if (alerts.overdueAvaliacoes?.length > 0) {
    const n = alerts.overdueAvaliacoes.length
    alertItems.push({
      variant: 'warning',
      text: `${n} ${n === 1 ? 'avaliacao vencida' : 'avaliacoes vencidas'}`,
      action: { label: 'Avaliar', onClick: () => onNavigate?.('autoavaliacao') },
    })
  }

  if (alerts.overdueAuditorias?.length > 0) {
    const n = alerts.overdueAuditorias.length
    alertItems.push({
      variant: 'error',
      text: `${n} ${n === 1 ? 'auditoria atrasada' : 'auditorias atrasadas'}`,
      action: { label: 'Ver', onClick: () => onNavigate?.('auditoriasInterativas') },
    })
  }

  if (alerts.overduePlanos?.length > 0) {
    const n = alerts.overduePlanos.length
    alertItems.push({
      variant: 'warning',
      text: `${n} ${n === 1 ? 'plano atrasado' : 'planos atrasados'}`,
      action: { label: 'Ver', onClick: () => onNavigate?.('planosAcao') },
    })
  }

  const sorted = alertItems
    .sort((a, b) => (a.variant === 'error' ? -1 : b.variant === 'error' ? 1 : 0))
    .slice(0, 3)

  if (sorted.length === 0) return null

  return (
    <div className="space-y-1">
      {sorted.map((item, i) => {
        const Icon = item.variant === 'error' ? AlertTriangle : AlertTriangle
        return (
          <button
            key={i}
            type="button"
            onClick={item.action.onClick}
            className={`w-full flex items-center gap-1.5 rounded-md border border-l-[3px] px-2 py-1 text-left ${COMPACT_ALERT_STYLES[item.variant]}`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="text-xs font-medium flex-1 min-w-0 truncate">{item.text}</span>
            <span className="text-[10px] font-semibold flex-shrink-0 opacity-70 ml-auto">{item.action.label} →</span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// C) INSIGHT CARDS 2x2 (AHRQ "At a Glance")
// ============================================================================

function TrendIcon({ direction }) {
  if (direction === 'up') return <ArrowUp className="w-3 h-3" />
  if (direction === 'down') return <ArrowDown className="w-3 h-3" />
  return <Minus className="w-3 h-3" />
}

function trendVariant(direction) {
  if (direction === 'up') return 'success'
  if (direction === 'down') return 'destructive'
  return 'secondary'
}

function InsightCard({ insight, onNavigate }) {
  const Icon = insight.icon
  const borderColor = insight.value >= 80
    ? 'border-l-emerald-500'
    : insight.value >= 50
      ? 'border-l-amber-500'
      : 'border-l-red-500'

  return (
    <Card
      className={`p-2.5 cursor-pointer border-l-4 ${borderColor} hover:shadow-md transition-shadow overflow-hidden`}
      onClick={() => onNavigate?.(insight.navigateTo)}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1 min-w-0">
          <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground truncate">{insight.label}</span>
        </div>
        <Tooltip content={insight.tooltipContent}>
          <HelpCircle className="w-3 h-3 text-muted-foreground/50 flex-shrink-0 ml-1" />
        </Tooltip>
      </div>
      <div className="flex items-baseline gap-1 mb-0.5">
        <span className="text-xl font-bold tabular-nums text-foreground leading-none">
          {insight.value}
        </span>
        <span className="text-[10px] text-muted-foreground">{insight.unit}</span>
      </div>
      <div className="mb-1">
        <Badge
          variant={trendVariant(insight.trend.direction)}
          badgeStyle="subtle"
          icon={<TrendIcon direction={insight.trend.direction} />}
        >
          {insight.trend.label}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
        {insight.insight}
      </p>
    </Card>
  )
}

function InsightsGrid({ insights, onNavigate }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

// ============================================================================
// D) ACCORDION — Detalhes Expansiveis (NN/g validated)
// ============================================================================

function AccordionRops({ data, onNavigate }) {
  const { progressoGeral, areaBreakdown, donutData, totalEvidencias } = data
  return (
    <div className="space-y-4 pt-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">
            {progressoGeral.avaliados}/{progressoGeral.total} ROPs avaliados
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {progressoGeral.percentual}%
          </span>
        </div>
        <Progress
          value={progressoGeral.percentual}
          size="md"
          variant={getProgressVariant(progressoGeral.percentual)}
        />
      </div>

      {donutData.length > 0 && (
        <DonutChart
          data={donutData}
          labelKey="label"
          valueKey="value"
          totalLabel="ROPs"
          size="sm"
          maxCategories={4}
        />
      )}

      <div className="space-y-2">
        {areaBreakdown.map((area) => (
          <button
            key={area.key}
            type="button"
            className="w-full text-left min-h-[44px] flex flex-col justify-center"
            onClick={() => onNavigate?.('autoavaliacaoArea', { area: area.key })}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-foreground truncate pr-2">
                {area.title}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {area.avaliados}/{area.ropCount}
              </span>
            </div>
            <Progress
              value={area.percentual}
              size="sm"
              variant={getProgressVariant(area.percentual)}
            />
          </button>
        ))}
      </div>

      <Tooltip content={TOOLTIP_CONTENT.evidencias}>
        <p className="text-xs text-muted-foreground">
          {totalEvidencias} {totalEvidencias === 1 ? 'evidencia vinculada' : 'evidencias vinculadas'}
        </p>
      </Tooltip>
    </div>
  )
}

function AccordionAuditorias({ data, onNavigate }) {
  const { total, concluidas, emAndamento, averageScore, overdue, recentCompleted } = data
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={ClipboardList} label="Total" value={total} color="#006837" />
        <MetricCard icon={CheckCircle2} label="Concluidas" value={concluidas} color="#34C759" />
        <MetricCard icon={Clock} label="Em Andamento" value={emAndamento} color="#F59E0B" />
        <MetricCard icon={AlertTriangle} label="Atrasadas" value={overdue.length} color="#DC2626" />
      </div>

      {averageScore != null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <Tooltip content={TOOLTIP_CONTENT.auditorias}>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Score medio de conformidade
                <HelpCircle className="w-3 h-3 text-muted-foreground/50" />
              </span>
            </Tooltip>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {averageScore}%
            </span>
          </div>
          <Progress value={averageScore} size="md" variant={getProgressVariant(averageScore)} />
        </div>
      )}

      {recentCompleted.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Ultimas concluidas</p>
          <div className="space-y-1.5">
            {recentCompleted.map((exec) => (
              <div key={exec.id} className="flex items-center justify-between">
                <span className="text-xs text-foreground truncate pr-2">
                  {exec.templateTipo || exec.id}
                </span>
                <Badge variant="success" badgeStyle="subtle">
                  {exec.scoreConformidade != null ? `${exec.scoreConformidade}%` : 'OK'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="text-xs font-medium text-primary dark:text-success min-h-[44px] flex items-center"
        onClick={() => onNavigate?.('auditoriasInterativas')}
      >
        Ver todas as auditorias →
      </button>
    </div>
  )
}

function AccordionPlanos({ data, onNavigate }) {
  const { total, byStatus, byOrigem, overdue, taxaConclusao, taxaEficacia, donutData } = data
  return (
    <div className="space-y-4 pt-2">
      {donutData.length > 0 && (
        <DonutChart
          data={donutData}
          labelKey="label"
          valueKey="value"
          totalLabel="Planos"
          size="sm"
          maxCategories={6}
        />
      )}

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Tooltip content={TOOLTIP_CONTENT.planos}>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Taxa de conclusao
                <HelpCircle className="w-3 h-3 text-muted-foreground/50" />
              </span>
            </Tooltip>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {taxaConclusao}%
            </span>
          </div>
          <Progress value={taxaConclusao} size="sm" variant="success" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Taxa de eficacia</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {taxaEficacia}%
            </span>
          </div>
          <Progress value={taxaEficacia} size="sm" variant={getProgressVariant(taxaEficacia)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Por origem</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byOrigem).map(([key, count]) => (
            <Badge key={key} variant="secondary" badgeStyle="subtle">
              {key === 'nao_conformidade' ? 'NC' : key.charAt(0).toUpperCase() + key.slice(1)} {count}
            </Badge>
          ))}
        </div>
      </div>

      {overdue.length > 0 && (
        <Badge variant="destructive" badgeStyle="solid">
          {overdue.length} {overdue.length === 1 ? 'atrasado' : 'atrasados'}
        </Badge>
      )}

      <button
        type="button"
        className="text-xs font-medium text-primary dark:text-success min-h-[44px] flex items-center"
        onClick={() => onNavigate?.('planosAcao')}
      >
        Ver todos os planos →
      </button>
    </div>
  )
}

function AccordionKpis({ data, onNavigate }) {
  const { total, conformes, parciais, naoConformes, semDados, scoreGeral, alertIndicadores } = data
  return (
    <div className="space-y-4 pt-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Tooltip content={TOOLTIP_CONTENT.kpis}>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Score geral KPIs
              <HelpCircle className="w-3 h-3 text-muted-foreground/50" />
            </span>
          </Tooltip>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {scoreGeral}%
          </span>
        </div>
        <Progress value={scoreGeral} size="md" variant={getProgressVariant(scoreGeral)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={CheckCircle2} label="Conformes" value={conformes} color="#34C759" />
        <MetricCard icon={AlertTriangle} label="Parciais" value={parciais} color="#F59E0B" />
        <MetricCard icon={Activity} label="Nao Conformes" value={naoConformes} color="#DC2626" />
        <MetricCard icon={BarChart3} label="Sem Dados" value={semDados} color="#6B7280" />
      </div>

      {alertIndicadores.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Abaixo da meta</p>
          <div className="space-y-1.5">
            {alertIndicadores.map((ind) => (
              <div key={ind.id} className="flex items-center justify-between">
                <span className="text-xs text-foreground truncate pr-2">{ind.titulo || ind.nome || ind.id}</span>
                {ind.statusAtual && (
                  <Badge variant={ind.statusAtual.variant} badgeStyle="subtle">
                    {ind.ultimoValor != null
                      ? `${ind.ultimoValor}${ind.unidade || ''}`
                      : 'N/A'}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="text-xs font-medium text-primary dark:text-success min-h-[44px] flex items-center"
        onClick={() => onNavigate?.('painelGestao')}
      >
        Ver painel de KPIs →
      </button>
    </div>
  )
}

function DetailsAccordion({ autoavaliacao, auditorias, planos, kpis, subScores, onNavigate }) {
  const sections = [
    {
      value: 'rops',
      icon: <CheckCircle2 className="w-4 h-4" />,
      title: 'Autoavaliacao ROPs',
      tooltip: TOOLTIP_CONTENT.rops,
      score: subScores.autoScore,
      content: <AccordionRops data={autoavaliacao} onNavigate={onNavigate} />,
    },
    {
      value: 'auditorias',
      icon: <ClipboardList className="w-4 h-4" />,
      title: 'Auditorias Interativas',
      tooltip: TOOLTIP_CONTENT.auditorias,
      score: auditorias.averageScore ?? 0,
      content: <AccordionAuditorias data={auditorias} onNavigate={onNavigate} />,
    },
    {
      value: 'planos',
      icon: <FileText className="w-4 h-4" />,
      title: 'Planos de Acao PDCA',
      tooltip: TOOLTIP_CONTENT.planos,
      score: planos.taxaConclusao,
      content: <AccordionPlanos data={planos} onNavigate={onNavigate} />,
    },
    {
      value: 'kpis',
      icon: <BarChart3 className="w-4 h-4" />,
      title: 'Indicadores de Seguranca',
      tooltip: TOOLTIP_CONTENT.kpis,
      score: kpis.scoreGeral || 0,
      content: <AccordionKpis data={kpis} onNavigate={onNavigate} />,
    },
  ]

  return (
    <Accordion type="multiple">
      {sections.map((section) => (
        <AccordionItem key={section.value} value={section.value}>
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-muted-foreground">{section.icon}</span>
              <span className="text-sm font-medium text-foreground truncate">
                {section.title}
              </span>
              <Tooltip content={section.tooltip}>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
              </Tooltip>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0 pr-2">
                <Badge variant={getProgressVariant(section.score) === 'error' ? 'destructive' : getProgressVariant(section.score) === 'warning' ? 'warning' : 'success'} badgeStyle="subtle">
                  {section.score}%
                </Badge>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(section.score)}`} />
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {section.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ============================================================================
// E) PROXIMOS PASSOS (Smart Checklist — Joint Commission)
// ============================================================================

function NextStepsSection({ nextSteps, cycleProgress, onNavigate }) {
  if (nextSteps.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-primary dark:text-success" />
        <span className="text-sm font-semibold text-foreground">Proximos Passos</span>
      </div>

      <div className="space-y-0.5">
        {nextSteps.map((step) => {
          const catConfig = CATEGORY_BADGE[step.category] || CATEGORY_BADGE.DADOS
          return (
            <button
              key={step.id}
              type="button"
              className="w-full text-left flex items-center gap-2 py-1.5"
              onClick={() => onNavigate?.(step.navigateTo)}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  step.category === 'URGENTE'
                    ? 'bg-red-500'
                    : step.category === 'MELHORIA'
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                }`}
              />
              <span className="text-xs text-foreground leading-snug flex-1 min-w-0">
                {step.label}
              </span>
              <Badge variant={catConfig.variant} badgeStyle={catConfig.badgeStyle} className="flex-shrink-0 text-[10px]">
                {step.category}
              </Badge>
            </button>
          )
        })}
      </div>

      {cycleProgress != null && (
        <div className="mt-2">
          <Progress value={cycleProgress} size="sm" variant="default" />
          <p className="text-[11px] text-muted-foreground mt-1">
            {cycleProgress}% do ciclo concluido
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// F) CONQUISTAS (Healthcare Gamification)
// ============================================================================

const TIER_COLORS = {
  bronze: { bg: 'bg-orange-100 dark:bg-orange-950/40', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-500', bar: 'bg-orange-600' },
  silver: { bg: 'bg-gray-100 dark:bg-gray-800/40', border: 'border-gray-300 dark:border-gray-600', text: 'text-gray-700 dark:text-gray-300', icon: 'text-gray-400', bar: 'bg-gray-600' },
  gold: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500', bar: 'bg-amber-600' },
  platinum: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300', icon: 'text-cyan-500', bar: 'bg-cyan-600' },
  diamond: { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300', icon: 'text-violet-500', bar: 'bg-violet-600' },
}

function AchievementCard({ ach, isSelected, onSelect }) {
  const AchIcon = ach.Icon
  const tier = TIER_COLORS[ach.tier] || TIER_COLORS.gold
  const progressPercent = ach.progress ? Math.round((ach.progress.current / ach.progress.total) * 100) : 0

  return (
    <button
      type="button"
      onClick={() => onSelect(ach.id)}
      className={`h-[72px] rounded-xl border p-2 text-left transition-all flex items-center gap-2.5 ${
        ach.unlocked
          ? `${tier.bg} ${tier.border} ${isSelected ? 'ring-2 ring-offset-1 ring-primary/40' : ''}`
          : `bg-muted/30 border-border ${isSelected ? 'ring-2 ring-offset-1 ring-primary/40' : ''}`
      }`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
        ach.unlocked ? `${tier.bg} ${tier.icon}` : 'bg-muted text-muted-foreground/50'
      }`}>
        {AchIcon && <AchIcon className="w-4.5 h-4.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${ach.unlocked ? tier.text : 'text-muted-foreground'}`}>
          {ach.title}
        </p>
        {ach.unlocked ? (
          <p className="text-[10px] text-muted-foreground mt-0.5">Concluida</p>
        ) : ach.progress ? (
          <div className="mt-1">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${tier.bar}`} style={{ width: `${Math.min(progressPercent, 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{ach.progress.current}/{ach.progress.total} ({progressPercent}%)</p>
          </div>
        ) : null}
      </div>
    </button>
  )
}

function AchievementDetail({ ach }) {
  if (!ach) return null
  const AchIcon = ach.Icon
  const tier = TIER_COLORS[ach.tier] || TIER_COLORS.gold
  const stepsCompleted = ach.steps?.filter(s => s.done).length || 0
  const stepsTotal = ach.steps?.length || 0

  return (
    <div className={`rounded-xl border p-3 ${tier.bg} ${tier.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${tier.icon}`}>
          {AchIcon && <AchIcon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${tier.text}`}>{ach.title}</p>
          <p className="text-[11px] text-muted-foreground">{ach.description}</p>
        </div>
        <Badge
          variant={ach.unlocked ? 'success' : 'secondary'}
          badgeStyle="subtle"
        >
          {ach.unlocked ? 'Concluida' : `${stepsCompleted}/${stepsTotal}`}
        </Badge>
      </div>

      {ach.steps && ach.steps.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {ach.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.done
                  ? 'bg-emerald-500 text-white'
                  : 'border border-border bg-background'
              }`}>
                {step.done && <CheckCircle2 className="w-3 h-3" />}
              </div>
              <span className={`text-[11px] flex-1 ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {step.label}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                {step.hint}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AchievementsSection({ achievements }) {
  if (!achievements || achievements.total === 0) return null

  const [showAll, setShowAll] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const unlocked = achievements.list.filter((a) => a.unlocked)
  const locked = achievements.list
    .filter((a) => !a.unlocked)
    .sort((a, b) => {
      const aPercent = a.progress ? (a.progress.current / a.progress.total) : 0
      const bPercent = b.progress ? (b.progress.current / b.progress.total) : 0
      return bPercent - aPercent
    })

  const sorted = [...unlocked, ...locked]
  const visible = showAll ? sorted : sorted.slice(0, 4)
  const selectedAch = selectedId ? sorted.find(a => a.id === selectedId) : null

  function handleSelect(id) {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary dark:text-success" />
          <span className="text-sm font-semibold text-foreground">Conquistas</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {achievements.unlockedCount}/{achievements.total}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {visible.map((ach) => (
          <AchievementCard
            key={ach.id}
            ach={ach}
            isSelected={selectedId === ach.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {selectedAch && (
        <div className="mt-2">
          <AchievementDetail ach={selectedAch} />
        </div>
      )}

      {sorted.length > 4 && (
        <button
          type="button"
          className="text-xs font-medium text-primary dark:text-success mt-2"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Ver menos' : `Ver todas (${sorted.length})`}
        </button>
      )}
    </div>
  )
}

// ============================================================================
// MetricCard (reused in accordion sections)
// ============================================================================

function MetricCard({ icon: Icon, label, value, color, description }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </Card>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QualidadeDashboardCard({ onNavigate }) {
  const { user } = useUser()
  const dashboard = useQualidadeDashboard()
  const { cicloAtual: contextCiclo, setCiclo } = useAutoavaliacao()
  const { toast } = useToast()
  const [showCicloModal, setShowCicloModal] = useState(false)

  const {
    loading,
    scoreGeral,
    nivelMaturidade,
    cicloAtual,
    diasRestantesCiclo,
    alerts,
    subScores,
    autoavaliacao,
    auditorias,
    planos,
    kpis,
    narrative,
    insights,
    nextSteps,
    achievements,
    nextMilestone,
  } = dashboard

  const handleExportPdf = useCallback(async () => {
    try {
      await generateQualidadeReport({
        scoreGeral, nivelMaturidade, cicloAtual, diasRestantesCiclo,
        subScores, autoavaliacao, auditorias, planos, kpis,
        alerts, nextSteps, achievements, narrative, insights,
      })
      toast({ variant: 'success', title: 'Relatorio exportado com sucesso!' })
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      toast({ variant: 'error', title: 'Erro ao gerar relatorio', description: 'Tente novamente.' })
    }
  }, [scoreGeral, nivelMaturidade, cicloAtual, diasRestantesCiclo, subScores, autoavaliacao, auditorias, planos, kpis, alerts, nextSteps, achievements, narrative, insights, toast])

  const handleCicloChange = useCallback((newCiclo) => {
    setCiclo(newCiclo)
    toast({ variant: 'success', title: 'Ciclo alterado com sucesso!' })
    setShowCicloModal(false)
  }, [setCiclo, toast])

  if (loading) {
    return (
      <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-4 flex items-center justify-center min-h-[120px]">
        <Spinner size="md" />
      </div>
    )
  }

  // Cycle progress heuristic (based on days elapsed vs total ~90 day cycles)
  const cycleProgress = diasRestantesCiclo != null
    ? Math.min(100, Math.max(0, Math.round(((90 - diasRestantesCiclo) / 90) * 100)))
    : null

  const cycleInfo = getCycleInfo(contextCiclo)

  return (
    <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-4 space-y-4">
      {/* A) HERO — Score Circular + Narrativa */}
      <HeroSection
        scoreGeral={scoreGeral}
        nivelMaturidade={nivelMaturidade}
        cicloAtual={cicloAtual}
        narrative={narrative}
        nextMilestone={nextMilestone}
      />

      {/* B) ALERTAS ACIONAVEIS */}
      <AlertsSection alerts={alerts} onNavigate={onNavigate} />

      {/* C) INSIGHT CARDS 2x2 */}
      <InsightsGrid insights={insights} onNavigate={onNavigate} />

      {/* D) ACCORDION — Detalhes Expansiveis */}
      <DetailsAccordion
        autoavaliacao={autoavaliacao}
        auditorias={auditorias}
        planos={planos}
        kpis={kpis}
        subScores={subScores}
        onNavigate={onNavigate}
      />

      {/* E) PROXIMOS PASSOS */}
      <NextStepsSection
        nextSteps={nextSteps}
        cycleProgress={cycleProgress}
        onNavigate={onNavigate}
      />

      {/* F) CONQUISTAS */}
      <AchievementsSection achievements={achievements} />

      {/* G) ACOES ADMIN */}
      <AdminOnly user={user}>
        <div className="pt-3 border-t border-border flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCicloModal(true)}>
            <Calendar className="w-4 h-4 mr-1" />
            Gerenciar Ciclo
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="w-4 h-4 mr-1" />
            Exportar Relatorio
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('centroGestao')}>
            <Settings className="w-4 h-4 mr-1" />
            Config
          </Button>
        </div>
      </AdminOnly>

      {/* MODAL — Gerenciar Ciclo */}
      <Modal
        open={showCicloModal}
        onClose={() => setShowCicloModal(false)}
        title="Gerenciar Ciclo"
        size="sm"
      >
        <div className="space-y-5">
          {/* Ciclo atual card */}
          {cycleInfo && (
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-success/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cycleInfo.label}</p>
                    <p className="text-[11px] text-muted-foreground">Ciclo ativo</p>
                  </div>
                </div>
                <Badge
                  variant={cycleInfo.remaining <= 15 ? 'destructive' : cycleInfo.remaining <= 30 ? 'warning' : 'success'}
                  badgeStyle="subtle"
                >
                  {cycleInfo.remaining}d restantes
                </Badge>
              </div>

              {/* Dates row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{cycleInfo.startDate}</span>
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <span>{cycleInfo.endDate}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">Progresso do ciclo</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">{cycleInfo.progress}%</span>
                </div>
                <Progress
                  value={cycleInfo.progress}
                  size="sm"
                  variant={cycleInfo.remaining <= 15 ? 'error' : cycleInfo.remaining <= 30 ? 'warning' : 'success'}
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{cycleInfo.elapsed} dias decorridos</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{cycleInfo.totalDays} dias totais</span>
                </div>
              </div>

              {/* Score resumo */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-primary tabular-nums">{scoreGeral}%</p>
                  <p className="text-[10px] text-muted-foreground">Score Geral</p>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-foreground">{NIVEL_CONFIG[nivelMaturidade]?.label || 'Em Progresso'}</p>
                  <p className="text-[10px] text-muted-foreground">Nivel</p>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold tabular-nums text-foreground">{alerts.total}</p>
                  <p className="text-[10px] text-muted-foreground">Pendencias</p>
                </div>
              </div>
            </div>
          )}

          {/* Select ciclo */}
          <div>
            <Select
              options={CYCLE_SELECT_OPTIONS}
              value={contextCiclo}
              onChange={handleCicloChange}
              label="Alterar ciclo"
              size="md"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
              Ao trocar o ciclo, o dashboard sera atualizado com os dados do periodo selecionado.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
