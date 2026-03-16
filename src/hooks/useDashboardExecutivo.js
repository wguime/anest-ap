/**
 * useDashboardExecutivo - Unified executive dashboard hook
 *
 * Aggregates ALL quality data from:
 * - useQualidadeDashboard (4-pilar score, narrative, insights, achievements)
 * - useComplianceMetrics (documents, compliance scores)
 * - useIncidents (incidents and complaints)
 * - useDocumentsContext (protocolos obrigatorios cross-reference)
 * - useKpiData (full indicator list for rankings)
 *
 * Returns a flat object with every metric the dashboard needs.
 */
import { useMemo } from 'react'
import { useQualidadeDashboard } from '@/hooks/useQualidadeDashboard'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import { useIncidents } from '@/contexts/IncidentsContext'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { useKpiData } from '@/hooks/useKpiData'

// ============================================================================
// PROTOCOLOS OBRIGATÓRIOS QMENTUM (18 protocolos de anestesiologia)
// ============================================================================

const PROTOCOLOS_OBRIGATORIOS = [
  'Manejo da dor aguda pós-operatório',
  'Prevenção de hipotermia',
  'Abreviação de jejum',
  'Controle glicêmico perioperatório',
  'Via aérea difícil',
  'Antibioticoprofilaxia cirúrgica',
  'Cirurgia segura',
  'Intoxicação por anestésicos locais',
  'Prevenção de náuseas e vômitos pós-operatório',
  'Cefaleia pós raquianestesia',
  'Sedação',
  'Transferência intra hospitalar',
  'Prevenção de eventos hemorrágicos',
  'Acionamento do anestesiologista na RPA',
  'Hipertermia maligna',
  'Alergia ao látex',
  'Posicionamento, contenção e transposição cirúrgica',
  'Prevenção de tromboembolismo venoso',
]

/**
 * Fuzzy match: checks if a document title covers a given protocol name.
 * Normalizes both strings (lowercase, remove accents) and checks for substring.
 */
function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .trim()
}

function protocoloMatchesDoc(protocoloName, docTitle) {
  const pNorm = normalizeStr(protocoloName)
  const dNorm = normalizeStr(docTitle)
  // Check if the key words from the protocol name appear in the doc title
  const keywords = pNorm.split(/\s+/).filter(w => w.length > 3)
  const matchCount = keywords.filter(kw => dNorm.includes(kw)).length
  // Match if >75% of significant keywords found
  return keywords.length > 0 && matchCount / keywords.length >= 0.75
}

export function useDashboardExecutivo() {
  // --- Data sources ---
  const qualidade = useQualidadeDashboard()
  const compliance = useComplianceMetrics()
  const incidents = useIncidents()
  const { documents } = useDocumentsContext()
  const kpi = useKpiData({ ano: 2025 })

  // --- Combined loading ---
  const isLoading =
    qualidade.loading ||
    compliance.isLoading ||
    incidents.loading ||
    kpi.loading

  // --- Incidents by status ---
  const incidentsByStatus = useMemo(() => {
    const result = { pendente: 0, em_analise: 0, concluido: 0, total: 0 }
    ;(incidents.incidentes || []).forEach((inc) => {
      result.total++
      if (inc.status === 'pendente') result.pendente++
      else if (inc.status === 'em_analise' || inc.status === 'em_investigacao') result.em_analise++
      else if (inc.status === 'concluido' || inc.status === 'encerrado') result.concluido++
    })
    return result
  }, [incidents.incidentes])

  // --- Incidents by type (top 5) ---
  const incidentesByTipo = useMemo(() => {
    const typeMap = {}
    ;(incidents.incidentes || []).forEach((inc) => {
      const tipo = inc.tipo || inc.tipoIncidente || 'Outros'
      typeMap[tipo] = (typeMap[tipo] || 0) + 1
    })
    return Object.entries(typeMap)
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [incidents.incidentes])

  // --- Critical alerts (merged from both sources) ---
  const criticalAlerts = useMemo(() => {
    const alerts = []

    // From qualidade: overdue avaliacoes
    if (qualidade.alerts?.overdueAvaliacoes?.length > 0) {
      alerts.push({
        id: 'aval-overdue',
        severity: 'critical',
        message: `${qualidade.alerts.overdueAvaliacoes.length} avaliação(ões) ROP vencida(s)`,
        route: 'autoavaliacao',
      })
    }

    // From qualidade: overdue auditorias
    if (qualidade.alerts?.overdueAuditorias?.length > 0) {
      alerts.push({
        id: 'audit-overdue',
        severity: 'critical',
        message: `${qualidade.alerts.overdueAuditorias.length} auditoria(s) atrasada(s)`,
        route: 'auditoriasInterativas',
      })
    }

    // From qualidade: overdue planos
    if (qualidade.alerts?.overduePlanos?.length > 0) {
      alerts.push({
        id: 'planos-overdue',
        severity: 'critical',
        message: `${qualidade.alerts.overduePlanos.length} plano(s) de ação atrasado(s)`,
        route: 'planosAcao',
      })
    }

    // From compliance: overdue documents
    if (compliance.overdueCount > 0) {
      alerts.push({
        id: 'docs-overdue',
        severity: 'critical',
        message: `${compliance.overdueCount} documento(s) com revisão vencida`,
        route: 'gestaoDocumental',
      })
    }

    // Pending incidents > 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const staleIncidents = (incidents.incidentes || []).filter(
      (inc) => inc.status === 'pendente' && new Date(inc.createdAt) < sevenDaysAgo
    )
    if (staleIncidents.length > 0) {
      alerts.push({
        id: 'incidents-stale',
        severity: 'warning',
        message: `${staleIncidents.length} incidente(s) pendente(s) há mais de 7 dias`,
        route: 'incidentes',
      })
    }

    // Pending approval documents
    if (compliance.pendingCount > 0) {
      alerts.push({
        id: 'docs-pending',
        severity: 'warning',
        message: `${compliance.pendingCount} documento(s) aguardando aprovação`,
        route: 'gestaoDocumental',
      })
    }

    return alerts
  }, [qualidade.alerts, compliance.overdueCount, compliance.pendingCount, incidents.incidentes])

  // --- Protocolos obrigatórios status ---
  const protocolosData = useMemo(() => {
    // Get all biblioteca docs
    const bibliotecaDocs = documents?.biblioteca || []

    const protocolosStatus = PROTOCOLOS_OBRIGATORIOS.map((nome) => {
      const matchedDoc = bibliotecaDocs.find((doc) =>
        doc.status !== 'arquivado' && protocoloMatchesDoc(nome, doc.titulo)
      )
      return { nome, existe: !!matchedDoc, doc: matchedDoc || null }
    })

    const documentados = protocolosStatus.filter((p) => p.existe).length

    return {
      protocolosStatus,
      protocolosCount: { total: PROTOCOLOS_OBRIGATORIOS.length, documentados },
    }
  }, [documents])

  // Add protocolo alert if missing protocols
  const protocoloAlert = useMemo(() => {
    const faltantes = protocolosData.protocolosCount.total - protocolosData.protocolosCount.documentados
    if (faltantes > 0) {
      return {
        id: 'protocolos-faltantes',
        severity: 'warning',
        message: `${faltantes} protocolo(s) obrigatório(s) sem documentação`,
        route: 'gestaoDocumental',
      }
    }
    return null
  }, [protocolosData])

  const allAlerts = useMemo(() => {
    return protocoloAlert ? [...criticalAlerts, protocoloAlert] : criticalAlerts
  }, [criticalAlerts, protocoloAlert])

  // --- Top/Bottom KPI rankings ---
  const kpiRankings = useMemo(() => {
    const indicadores = kpi.indicadores || []

    // Top criticos: worst performers (destructive or warning, sorted by distance from meta)
    const topCriticos = indicadores
      .filter(
        (ind) =>
          ind.statusAtual?.variant === 'destructive' ||
          ind.statusAtual?.variant === 'warning'
      )
      .sort((a, b) => {
        // Sort by "badness": destructive first, then by lower score
        const aPriority = a.statusAtual?.variant === 'destructive' ? 0 : 1
        const bPriority = b.statusAtual?.variant === 'destructive' ? 0 : 1
        if (aPriority !== bPriority) return aPriority - bPriority
        // Compare values (lower is worse for non-inverted)
        return (a.ultimoValor ?? 999) - (b.ultimoValor ?? 999)
      })
      .slice(0, 5)

    // Top destaques: best performers (success status)
    const topDestaques = indicadores
      .filter((ind) => ind.statusAtual?.variant === 'success')
      .sort((a, b) => {
        // Sort by how much they exceed meta (best first)
        return (b.ultimoValor ?? 0) - (a.ultimoValor ?? 0)
      })
      .slice(0, 5)

    return { topCriticos, topDestaques }
  }, [kpi.indicadores])

  // --- Incidents by severity ---
  const incidentsBySeverity = useMemo(() => {
    const result = { near_miss: 0, leve: 0, moderado: 0, grave: 0, critico: 0 }
    ;(incidents.incidentes || []).forEach((inc) => {
      const sev = inc.incidente?.severidade || inc.severidade || 'leve'
      if (result[sev] !== undefined) result[sev]++
    })
    return result
  }, [incidents.incidentes])

  // --- Mean resolution days for resolved incidents ---
  const meanResolutionDays = useMemo(() => {
    const resolved = (incidents.incidentes || []).filter(inc =>
      (inc.status === 'concluido' || inc.incidente?.status === 'concluido') &&
      inc.createdAt && inc.updatedAt
    )
    if (resolved.length === 0) return null
    const totalDays = resolved.reduce((sum, inc) => {
      const created = new Date(inc.createdAt)
      const updated = new Date(inc.updatedAt)
      return sum + (updated - created) / (1000 * 60 * 60 * 24)
    }, 0)
    return Math.round((totalDays / resolved.length) * 10) / 10
  }, [incidents.incidentes])

  // --- Coverage chart data (for DonutChart) ---
  const coverageChartData = useMemo(() => {
    return Object.entries(compliance.documentCoverage || {}).map(([cat, data]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: data.existing,
      recommended: data.recommended,
      coverage: data.coverage,
    }))
  }, [compliance.documentCoverage])

  return {
    // === From useQualidadeDashboard (4-pilar score) ===
    scoreGeral: qualidade.scoreGeral,
    nivelMaturidade: qualidade.nivelMaturidade,
    cicloAtual: qualidade.cicloAtual,
    diasRestantesCiclo: qualidade.diasRestantesCiclo,
    subScores: qualidade.subScores,
    alerts: qualidade.alerts,
    narrative: qualidade.narrative,
    insights: qualidade.insights,
    nextSteps: qualidade.nextSteps,
    achievements: qualidade.achievements,
    nextMilestone: qualidade.nextMilestone,

    // === Autoavaliacao (from useQualidadeDashboard) ===
    autoavaliacao: qualidade.autoavaliacao,
    avaliacoesCiclo: qualidade.avaliacoesCiclo,

    // === Auditorias (from useQualidadeDashboard) ===
    auditorias: qualidade.auditorias,

    // === Planos PDCA (from useQualidadeDashboard) ===
    planos: qualidade.planos,

    // === KPIs (from useQualidadeDashboard + rankings) ===
    kpis: qualidade.kpis,
    kpiIndicadores: kpi.indicadores,
    topCriticos: kpiRankings.topCriticos,
    topDestaques: kpiRankings.topDestaques,

    // === Documents (from useComplianceMetrics) ===
    totalDocuments: compliance.totalDocuments,
    activeCount: compliance.activeCount,
    overdueCount: compliance.overdueCount,
    pendingCount: compliance.pendingCount,
    complianceScore: compliance.complianceScore,
    coverageChartData,
    recentChanges: compliance.recentChanges,

    // === Compliance Qmentum metrics ===
    qmentumScore: compliance.qmentumScore,
    ropAdherence: compliance.ropAdherence,
    reviewComplianceRate: compliance.reviewComplianceRate,

    // === Incidents (from useIncidents) ===
    incidentsByStatus,
    incidentesByTipo,
    incidentsBySeverity,
    meanResolutionDays,
    totalIncidentes: (incidents.incidentes || []).length,
    totalDenuncias: (incidents.denuncias || []).length,

    // === Overdue planos count ===
    overduePlanosCount: qualidade.planos?.overdue?.length || 0,

    // === Protocolos obrigatorios (NEW) ===
    protocolosStatus: protocolosData.protocolosStatus,
    protocolosCount: protocolosData.protocolosCount,

    // === All critical alerts (merged) ===
    criticalAlerts: allAlerts,

    // === Raw arrays for PDF report ===
    rawExecucoes: qualidade.rawExecucoes,
    rawPlanos: qualidade.rawPlanos,
    overdueDocuments: compliance.overdueDocuments,
    upcomingReviews: compliance.upcomingReviews,

    // === State ===
    isLoading,
  }
}

export default useDashboardExecutivo
