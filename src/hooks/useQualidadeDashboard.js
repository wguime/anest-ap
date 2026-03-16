/**
 * useQualidadeDashboard - Hook de agregacao para o Painel Qmentum
 *
 * Consome dados dos 4 sistemas de qualidade (Autoavaliacao, Auditorias,
 * Planos de Acao, KPIs) e retorna metricas consolidadas para o dashboard.
 *
 * Novas funcoes puras (v2):
 *   generateNarrative, generateInsights, generateNextSteps,
 *   computeAchievements, computeNextMilestone
 */
import { useMemo } from 'react'
import { usePlanosAcao } from '@/contexts/PlanosAcaoContext'
import { useAuditoriasInterativas } from '@/contexts/AuditoriasInterativasContext'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { useKpiData } from '@/hooks/useKpiData'
import { AREA_CONFIG, AVALIACAO_STATUS, diasAteFimCiclo } from '@/data/autoavaliacaoConfig'
import { PLANO_STATUS, TIPO_ORIGEM } from '@/data/planosAcaoConfig'
import {
  CheckSquare,
  ClipboardList,
  ListChecks,
  BarChart3,
  Medal,
  Gem,
  Crown,
  ClipboardCheck,
  CheckCheck,
  Search,
  Award,
  Target,
  DatabaseZap,
  Sparkles,
} from 'lucide-react'

const STATUS_COLORS = {
  planejamento: '#007AFF',
  execucao: '#F59E0B',
  verificacao: '#8B5CF6',
  padronizacao: '#6B7280',
  concluido: '#2ECC71',
  cancelado: '#DC2626',
}

// ============================================================================
// PURE FUNCTIONS — Nivel / Milestone
// ============================================================================

function getNivelMaturidade(score) {
  if (score >= 90) return 'diamond'
  if (score >= 75) return 'platinum'
  if (score >= 60) return 'gold'
  return 'em_progresso'
}

/**
 * computeNextMilestone — Proximo nivel IQG com distancia
 */
function computeNextMilestone(scoreGeral) {
  if (scoreGeral >= 90) {
    return { label: 'Diamond', target: 100, remaining: 100 - scoreGeral, progress: 100 }
  }
  if (scoreGeral >= 75) {
    return {
      label: 'Diamond',
      target: 90,
      remaining: 90 - scoreGeral,
      progress: Math.round(((scoreGeral - 75) / 15) * 100),
    }
  }
  if (scoreGeral >= 60) {
    return {
      label: 'Platinum',
      target: 75,
      remaining: 75 - scoreGeral,
      progress: Math.round(((scoreGeral - 60) / 15) * 100),
    }
  }
  return {
    label: 'Gold',
    target: 60,
    remaining: 60 - scoreGeral,
    progress: scoreGeral > 0 ? Math.round((scoreGeral / 60) * 100) : 0,
  }
}

// ============================================================================
// PURE FUNCTIONS — Narrative (Healthcare Data Storytelling)
// ============================================================================

/**
 * generateNarrative — "O que -> Por que -> O que fazer"
 * Segue padrao HealthCatalyst de storytelling para dashboards clinicos.
 */
function generateNarrative(data) {
  const { scoreGeral, nivelMaturidade, diasRestantesCiclo, subScores, autoavaliacao, auditorias, kpis } = data

  // --- headline ---
  const nivelLabels = { diamond: 'Diamond', platinum: 'Platinum', gold: 'Gold', em_progresso: 'Em Progresso' }
  let headline
  if (scoreGeral >= 90) {
    headline = `Excelencia! Sua equipe esta no nivel ${nivelLabels[nivelMaturidade]}.`
  } else if (scoreGeral >= 75) {
    headline = `Otimo progresso! Nivel ${nivelLabels[nivelMaturidade]} alcancado.`
  } else if (scoreGeral >= 60) {
    headline = `Bom trabalho! Nivel ${nivelLabels[nivelMaturidade]}.`
  } else {
    const urgentCount =
      (autoavaliacao?.progressoGeral?.total || 0) -
      (autoavaliacao?.progressoGeral?.avaliados || 0) +
      (auditorias?.overdue?.length || 0)
    headline = urgentCount > 0
      ? `Atencao necessaria. ${urgentCount} ${urgentCount === 1 ? 'item urgente precisa' : 'itens urgentes precisam'} de acao.`
      : 'Atencao necessaria. Avance nas avaliacoes para subir de nivel.'
  }

  // --- subtext (strongest vs weakest area) ---
  const areas = [
    { label: 'ROPs', score: subScores.autoScore },
    { label: 'Auditorias', score: subScores.auditScore },
    { label: 'Planos PDCA', score: subScores.planoScore },
    { label: 'KPIs', score: subScores.kpiScore },
  ].filter((a) => a.score > 0)

  const subtextItems = []
  if (areas.length >= 2) {
    const sorted = [...areas].sort((a, b) => b.score - a.score)
    const strongest = sorted[0]
    const weakest = sorted[sorted.length - 1]
    subtextItems.push(`Destaque: ${strongest.label} (${strongest.score}%)`)
    subtextItems.push(`Foco recomendado: ${weakest.label} (${weakest.score}%)`)
  } else if (areas.length === 1) {
    subtextItems.push(`${areas[0].label}: ${areas[0].score}%`)
  }

  // --- cycleText ---
  let cycleRitmo
  if (diasRestantesCiclo < 10) {
    cycleRitmo = `urgente — ciclo encerra em ${diasRestantesCiclo} dias`
  } else if (diasRestantesCiclo < 30) {
    cycleRitmo = 'reta final — priorize itens pendentes'
  } else if (diasRestantesCiclo <= 60) {
    cycleRitmo = 'mantenha o ritmo'
  } else {
    cycleRitmo = 'ritmo adequado'
  }
  const cycleText = `Ciclo encerra em ${diasRestantesCiclo} dias — ${cycleRitmo}`

  return { headline, subtextItems, cycleText }
}

// ============================================================================
// PURE FUNCTIONS — Insight Cards (AHRQ contextual metrics)
// ============================================================================

/**
 * generateInsights — 4 cards com contexto clinico
 */
function generateInsights(data) {
  const { subScores, autoavaliacao, auditorias, planos, kpis } = data

  // ROPs insight
  const ropsRestantes = (autoavaliacao.progressoGeral.total || 0) - (autoavaliacao.progressoGeral.avaliados || 0)
  const weakestArea = autoavaliacao.areaBreakdown?.length > 0
    ? [...autoavaliacao.areaBreakdown].sort((a, b) => a.percentual - b.percentual)[0]
    : null
  const ropsInsight = ropsRestantes > 0
    ? `${ropsRestantes} ${ropsRestantes === 1 ? 'ROP restante' : 'ROPs restantes'}.${weakestArea ? ` ${weakestArea.title} precisa de atencao (${weakestArea.percentual}%).` : ''}`
    : 'Todos os ROPs avaliados!'

  // Auditorias insight
  const auditInsight = auditorias.total === 0
    ? 'Nenhuma auditoria registrada.'
    : auditorias.concluidas === auditorias.total
      ? `Todas concluidas! Score medio: ${auditorias.averageScore ?? 0}%.`
      : `${auditorias.concluidas}/${auditorias.total} concluidas.${auditorias.overdue.length > 0 ? ` ${auditorias.overdue.length} ${auditorias.overdue.length === 1 ? 'atrasada' : 'atrasadas'}.` : ' Nenhuma atrasada.'}`

  // Planos PDCA insight
  const planosAtrasados = planos.overdue?.length || 0
  const planosInsight = planos.total === 0
    ? 'Nenhum plano de acao registrado.'
    : planosAtrasados > 0
      ? `${planosAtrasados} ${planosAtrasados === 1 ? 'atrasado' : 'atrasados'}. Taxa de conclusao: ${planos.taxaConclusao}%.`
      : `Taxa de conclusao: ${planos.taxaConclusao}%. Eficacia: ${planos.taxaEficacia}%.`

  // KPIs insight
  const kpiAbaixo = (kpis.naoConformes || 0) + (kpis.parciais || 0)
  const kpiSemDados = kpis.semDados || 0
  const kpiInsight = kpis.total === 0
    ? 'Nenhum indicador registrado.'
    : kpiAbaixo > 0
      ? `${kpiAbaixo} abaixo da meta.${kpiSemDados > 0 ? ` ${kpiSemDados} sem dados.` : ''}`
      : kpiSemDados > 0
        ? `${kpiSemDados} ${kpiSemDados === 1 ? 'indicador' : 'indicadores'} sem dados registrados.`
        : 'Todos os indicadores conformes!'

  // Trend helpers — compare with previous score stored in localStorage
  function scoreTrend(score, pilar) {
    const key = `qmentum_score_history_${pilar}`
    let previous = null
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        previous = parsed.score
      }
    } catch (_) { /* ignore parse errors */ }

    // Store current score
    try {
      localStorage.setItem(key, JSON.stringify({ score, timestamp: Date.now() }))
    } catch (_) { /* ignore storage errors */ }

    if (previous === null) {
      return { direction: 'stable', delta: 0, label: 'Estavel' }
    }
    const delta = Math.round((score - previous) * 10) / 10
    if (delta > 0) return { direction: 'up', delta, label: 'Subindo' }
    if (delta < 0) return { direction: 'down', delta: Math.abs(delta), label: 'Caindo' }
    return { direction: 'stable', delta: 0, label: 'Estavel' }
  }

  return [
    {
      id: 'rops',
      icon: CheckSquare,
      label: 'ROPs',
      value: subScores.autoScore,
      unit: '%',
      trend: scoreTrend(subScores.autoScore, 'rops'),
      insight: ropsInsight,
      tooltipContent: 'Praticas Organizacionais Requeridas: 32 ROPs avaliados em 6 categorias de seguranca (Qmentum). Meta: 100%.',
      navigateTo: 'autoavaliacao',
    },
    {
      id: 'auditorias',
      icon: ClipboardList,
      label: 'Auditorias',
      value: auditorias.averageScore ?? 0,
      unit: '%',
      trend: scoreTrend(auditorias.averageScore ?? 0, 'auditorias'),
      insight: auditInsight,
      tooltipContent: 'Score medio de conformidade das auditorias interativas concluidas. Avalia aderencia a protocolos clinicos. Meta: acima de 80%.',
      navigateTo: 'auditoriasInterativas',
    },
    {
      id: 'planos',
      icon: ListChecks,
      label: 'Planos PDCA',
      value: planos.taxaConclusao,
      unit: '%',
      trend: scoreTrend(planos.taxaConclusao, 'planos'),
      insight: planosInsight,
      tooltipContent: '% de planos de acao PDCA (Plan-Do-Check-Act) concluidos. Cada plano trata uma nao-conformidade identificada. Ciclo de melhoria continua Qmentum.',
      navigateTo: 'planosAcao',
    },
    {
      id: 'kpis',
      icon: BarChart3,
      label: 'KPIs',
      value: kpis.scoreGeral || 0,
      unit: '%',
      trend: scoreTrend(kpis.scoreGeral || 0, 'kpis'),
      insight: kpiInsight,
      tooltipContent: 'Performance em 21 indicadores de seguranca e qualidade, alinhados com as dimensoes Qmentum (seguranca, efetividade, eficiencia).',
      navigateTo: 'painelGestao',
    },
  ]
}

// ============================================================================
// PURE FUNCTIONS — Next Steps (WHO Patient Safety priority)
// ============================================================================

/**
 * generateNextSteps — Auto-generated action list priorizada
 * Ordem: URGENTE (seguranca) > MELHORIA (conformidade) > DADOS (completude)
 */
function generateNextSteps(data) {
  const { autoavaliacao, auditorias, planos, kpis, alerts } = data
  const steps = []

  // 1. URGENTE: Avaliacoes atrasadas
  const overdueAval = alerts.overdueAvaliacoes?.length || 0
  if (overdueAval > 0) {
    steps.push({
      id: 'overdue-aval',
      label: `Avaliar ${overdueAval} ${overdueAval === 1 ? 'ROP pendente' : 'ROPs pendentes'} (prazo vencido)`,
      category: 'URGENTE',
      navigateTo: 'autoavaliacao',
    })
  }

  // 2. URGENTE: Auditorias atrasadas
  const overdueAudit = alerts.overdueAuditorias?.length || 0
  if (overdueAudit > 0) {
    steps.push({
      id: 'overdue-audit',
      label: `Concluir ${overdueAudit} ${overdueAudit === 1 ? 'auditoria atrasada' : 'auditorias atrasadas'}`,
      category: 'URGENTE',
      navigateTo: 'auditoriasInterativas',
    })
  }

  // 3. URGENTE: Planos atrasados
  const overduePlanos = alerts.overduePlanos?.length || 0
  if (overduePlanos > 0) {
    steps.push({
      id: 'overdue-planos',
      label: `Atualizar ${overduePlanos} ${overduePlanos === 1 ? 'plano atrasado' : 'planos atrasados'}`,
      category: 'URGENTE',
      navigateTo: 'planosAcao',
    })
  }

  // 4. MELHORIA: Areas com score < 50%
  const weakAreas = autoavaliacao.areaBreakdown?.filter((a) => a.percentual < 50 && a.percentual > 0) || []
  if (weakAreas.length > 0) {
    steps.push({
      id: 'weak-areas',
      label: `Melhorar ${weakAreas.length} ${weakAreas.length === 1 ? 'area' : 'areas'} abaixo de 50% (${weakAreas.map((a) => a.title).join(', ')})`,
      category: 'MELHORIA',
      navigateTo: 'autoavaliacao',
    })
  }

  // 5. MELHORIA: Planos concluidos sem avaliacao de eficacia
  const concluidos = planos.byStatus?.concluido || 0
  const avaliados = planos.taxaEficacia != null ? Math.round(concluidos * (planos.taxaEficacia / 100)) : 0
  const semEficacia = concluidos - avaliados
  if (semEficacia > 0) {
    steps.push({
      id: 'eficacia-pendente',
      label: `Revisar eficacia de ${semEficacia} ${semEficacia === 1 ? 'plano concluido' : 'planos concluidos'}`,
      category: 'MELHORIA',
      navigateTo: 'planosAcao',
    })
  }

  // 6. DADOS: KPIs sem dados
  const kpiSemDados = kpis.semDados || 0
  if (kpiSemDados > 0) {
    steps.push({
      id: 'kpi-sem-dados',
      label: `Registrar dados em ${kpiSemDados} ${kpiSemDados === 1 ? 'indicador' : 'indicadores'}`,
      category: 'DADOS',
      navigateTo: 'painelGestao',
    })
  }

  // 7. DADOS: ROPs nao avaliados (sem prazo vencido)
  const ropsRestantes = (autoavaliacao.progressoGeral?.total || 0) - (autoavaliacao.progressoGeral?.avaliados || 0) - overdueAval
  if (ropsRestantes > 0 && steps.length < 6) {
    steps.push({
      id: 'rops-restantes',
      label: `Avaliar ${ropsRestantes} ${ropsRestantes === 1 ? 'ROP restante' : 'ROPs restantes'}`,
      category: 'DADOS',
      navigateTo: 'autoavaliacao',
    })
  }

  return steps.slice(0, 6)
}

// ============================================================================
// PURE FUNCTIONS — Achievements (Healthcare Gamification)
// ============================================================================

/**
 * computeAchievements — 10 conquistas alinhadas com marcos Qmentum
 */
function computeAchievements(data) {
  const { scoreGeral, autoavaliacao, auditorias, planos, kpis, alerts } = data

  const ropsPercentual = autoavaliacao.progressoGeral?.percentual || 0
  const concluidas = auditorias.concluidas || 0
  const averageScore = auditorias.averageScore ?? 0
  const taxaEficacia = planos.taxaEficacia || 0
  const semDados = kpis.semDados ?? 0

  const DEFS = [
    {
      id: 'nivel-gold', title: 'Nivel Gold', Icon: Medal, tier: 'gold',
      unlocked: scoreGeral >= 60, description: 'Alcance score geral >= 60%',
      steps: [
        { label: 'ROPs avaliados', done: (autoavaliacao.progressoGeral?.percentual || 0) >= 50, hint: '>= 50%' },
        { label: 'Auditorias concluidas', done: concluidas >= 1, hint: 'ao menos 1' },
        { label: 'Planos PDCA em andamento', done: (planos.taxaConclusao || 0) > 0, hint: 'iniciar planos' },
        { label: 'KPIs com dados', done: (kpis.total || 0) > 0 && semDados < (kpis.total || 1), hint: 'registrar dados' },
      ],
    },
    {
      id: 'nivel-platinum', title: 'Nivel Platinum', Icon: Gem, tier: 'platinum',
      unlocked: scoreGeral >= 75, description: 'Alcance score geral >= 75%',
      steps: [
        { label: 'ROPs >= 70%', done: ropsPercentual >= 70, hint: `atual: ${Math.round(ropsPercentual)}%` },
        { label: 'Auditorias >= 75%', done: averageScore >= 75, hint: `atual: ${averageScore}%` },
        { label: 'Planos PDCA >= 70%', done: (planos.taxaConclusao || 0) >= 70, hint: `atual: ${planos.taxaConclusao || 0}%` },
        { label: 'KPIs >= 70%', done: (kpis.scoreGeral || 0) >= 70, hint: `atual: ${kpis.scoreGeral || 0}%` },
      ],
    },
    {
      id: 'nivel-diamond', title: 'Nivel Diamond', Icon: Crown, tier: 'diamond',
      unlocked: scoreGeral >= 90, description: 'Alcance score geral >= 90%',
      steps: [
        { label: 'ROPs >= 90%', done: ropsPercentual >= 90, hint: `atual: ${Math.round(ropsPercentual)}%` },
        { label: 'Auditorias >= 90%', done: averageScore >= 90, hint: `atual: ${averageScore}%` },
        { label: 'Planos PDCA >= 85%', done: (planos.taxaConclusao || 0) >= 85, hint: `atual: ${planos.taxaConclusao || 0}%` },
        { label: 'KPIs >= 85%', done: (kpis.scoreGeral || 0) >= 85, hint: `atual: ${kpis.scoreGeral || 0}%` },
      ],
    },
    {
      id: 'rops-50', title: 'Meio Caminho', Icon: ClipboardCheck, tier: 'bronze',
      unlocked: ropsPercentual >= 50, description: 'Avalie 50% dos ROPs',
      steps: [
        { label: 'Avaliar 16 de 32 ROPs', done: (autoavaliacao.progressoGeral?.avaliados || 0) >= 16, hint: `${autoavaliacao.progressoGeral?.avaliados || 0}/16` },
        { label: 'Cobrir ao menos 3 areas', done: (autoavaliacao.areaBreakdown?.filter(a => a.avaliados > 0).length || 0) >= 3, hint: `${autoavaliacao.areaBreakdown?.filter(a => a.avaliados > 0).length || 0}/3 areas` },
      ],
    },
    {
      id: 'rops-100', title: 'ROPs Completos', Icon: CheckCheck, tier: 'gold',
      unlocked: ropsPercentual >= 100, description: 'Avalie 100% dos ROPs',
      steps: [
        { label: 'Avaliar todos os 32 ROPs', done: ropsPercentual >= 100, hint: `${autoavaliacao.progressoGeral?.avaliados || 0}/32` },
        { label: 'Cobrir as 6 areas', done: (autoavaliacao.areaBreakdown?.filter(a => a.avaliados >= a.ropCount).length || 0) >= 6, hint: `${autoavaliacao.areaBreakdown?.filter(a => a.avaliados >= a.ropCount).length || 0}/6 completas` },
      ],
    },
    {
      id: 'audit-first', title: '1a Auditoria', Icon: Search, tier: 'bronze',
      unlocked: concluidas >= 1, description: 'Conclua sua primeira auditoria',
      steps: [
        { label: 'Iniciar uma auditoria', done: (auditorias.total || 0) >= 1, hint: auditorias.total >= 1 ? 'feito' : 'pendente' },
        { label: 'Concluir a auditoria', done: concluidas >= 1, hint: concluidas >= 1 ? 'feito' : 'pendente' },
      ],
    },
    {
      id: 'audit-excellence', title: 'Excelencia Audit.', Icon: Award, tier: 'platinum',
      unlocked: averageScore >= 90, description: 'Score medio de auditorias >= 90%',
      steps: [
        { label: 'Concluir >= 3 auditorias', done: concluidas >= 3, hint: `${concluidas}/3` },
        { label: 'Score medio >= 90%', done: averageScore >= 90, hint: `atual: ${averageScore}%` },
      ],
    },
    {
      id: 'planos-eficacia', title: 'Acoes Eficazes', Icon: Target, tier: 'gold',
      unlocked: taxaEficacia >= 80, description: 'Taxa de eficacia dos planos >= 80%',
      steps: [
        { label: 'Concluir planos de acao', done: (planos.byStatus?.concluido || 0) >= 1, hint: `${planos.byStatus?.concluido || 0} concluidos` },
        { label: 'Avaliar eficacia', done: taxaEficacia > 0, hint: taxaEficacia > 0 ? 'feito' : 'pendente' },
        { label: 'Taxa eficacia >= 80%', done: taxaEficacia >= 80, hint: `atual: ${taxaEficacia}%` },
      ],
    },
    {
      id: 'kpi-completo', title: 'Dados Completos', Icon: DatabaseZap, tier: 'silver',
      unlocked: kpis.total > 0 && semDados === 0, description: 'Registre dados em todos os KPIs',
      steps: [
        { label: 'Registrar dados em KPIs', done: (kpis.total || 0) - semDados > 0, hint: `${(kpis.total || 0) - semDados}/${kpis.total || 0}` },
        { label: 'Zero indicadores sem dados', done: semDados === 0, hint: semDados > 0 ? `${semDados} restantes` : 'feito' },
      ],
    },
    {
      id: 'zero-overdue', title: 'Sem Pendencias', Icon: Sparkles, tier: 'gold',
      unlocked: alerts.total === 0, description: 'Zero itens atrasados ou pendentes',
      steps: [
        { label: 'Avaliacoes em dia', done: (alerts.overdueAvaliacoes?.length || 0) === 0, hint: (alerts.overdueAvaliacoes?.length || 0) > 0 ? `${alerts.overdueAvaliacoes.length} pendentes` : 'feito' },
        { label: 'Auditorias em dia', done: (alerts.overdueAuditorias?.length || 0) === 0, hint: (alerts.overdueAuditorias?.length || 0) > 0 ? `${alerts.overdueAuditorias.length} pendentes` : 'feito' },
        { label: 'Planos em dia', done: (alerts.overduePlanos?.length || 0) === 0, hint: (alerts.overduePlanos?.length || 0) > 0 ? `${alerts.overduePlanos.length} pendentes` : 'feito' },
      ],
    },
  ]

  const list = DEFS.map((def) => {
    const progress = def.unlocked ? undefined : getAchievementProgress(def.id, data)
    return { ...def, progress }
  })

  const unlockedCount = list.filter((a) => a.unlocked).length

  return { list, unlockedCount, total: list.length }
}

function getAchievementProgress(id, data) {
  const { scoreGeral, autoavaliacao, auditorias, planos, kpis, alerts } = data
  const ropsPercentual = autoavaliacao.progressoGeral?.percentual || 0

  switch (id) {
    case 'nivel-gold':
      return { current: scoreGeral, total: 60 }
    case 'nivel-platinum':
      return { current: scoreGeral, total: 75 }
    case 'nivel-diamond':
      return { current: scoreGeral, total: 90 }
    case 'rops-50':
      return { current: Math.round(ropsPercentual), total: 50 }
    case 'rops-100':
      return { current: Math.round(ropsPercentual), total: 100 }
    case 'audit-first':
      return { current: auditorias.concluidas || 0, total: 1 }
    case 'audit-excellence':
      return { current: auditorias.averageScore ?? 0, total: 90 }
    case 'planos-eficacia':
      return { current: planos.taxaEficacia || 0, total: 80 }
    case 'kpi-completo': {
      const comDados = (kpis.total || 0) - (kpis.semDados || 0)
      return { current: comDados, total: kpis.total || 1 }
    }
    case 'zero-overdue':
      return { current: Math.max(0, 1 - (alerts.total || 0)), total: 1 }
    default:
      return undefined
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useQualidadeDashboard() {
  const {
    avaliacoes,
    loading: loadingAuto,
    cicloAtual,
    getProgressoGeral,
    getProgressoByArea,
    getOverdueAvaliacoes,
  } = useAutoavaliacao()

  const {
    execucoes,
    loading: loadingAudit,
    getOverdueExecucoes,
  } = useAuditoriasInterativas()

  const {
    planos,
    loading: loadingPlanos,
    getOverduePlanos,
  } = usePlanosAcao()

  const {
    indicadores,
    summary: kpiSummary,
    loading: loadingKpi,
  } = useKpiData({ ano: 2025 })

  const loading = loadingAuto || loadingAudit || loadingPlanos || loadingKpi

  // ============================================================================
  // AUTOAVALIACAO
  // ============================================================================
  const autoavaliacao = useMemo(() => {
    const progressoGeral = getProgressoGeral()

    const areaBreakdown = Object.entries(AREA_CONFIG).map(([key, config]) => {
      const progresso = getProgressoByArea(key)
      return {
        key,
        title: config.title,
        icon: config.icon,
        ropCount: config.ropCount,
        avaliados: progresso.avaliados,
        conformes: progresso.conformes,
        parciais: progresso.parciais,
        naoConformes: progresso.naoConformes,
        percentual: progresso.percentual,
      }
    })

    // Count statuses for donut
    const cicloAvaliacoes = avaliacoes.filter((a) => a.ciclo === cicloAtual)
    const conformes = cicloAvaliacoes.filter((a) => a.status === 'conforme').length
    const parciais = cicloAvaliacoes.filter((a) => a.status === 'parcialmente_conforme').length
    const naoConformes = cicloAvaliacoes.filter((a) => a.status === 'nao_conforme').length
    const naoAvaliados = progressoGeral.total - conformes - parciais - naoConformes

    const donutData = [
      { label: 'Conformes', value: conformes, color: AVALIACAO_STATUS.conforme.color },
      { label: 'Parciais', value: parciais, color: AVALIACAO_STATUS.parcialmente_conforme.color },
      { label: 'Nao Conformes', value: naoConformes, color: AVALIACAO_STATUS.nao_conforme.color },
      { label: 'Nao Avaliados', value: naoAvaliados, color: AVALIACAO_STATUS.nao_avaliado.color },
    ].filter((d) => d.value > 0)

    // Count evidencias
    const totalEvidencias = cicloAvaliacoes.reduce(
      (sum, a) => sum + (a.evidencias?.length || 0),
      0
    )

    return {
      progressoGeral: { ...progressoGeral },
      areaBreakdown,
      donutData,
      totalEvidencias,
    }
  }, [avaliacoes, cicloAtual, getProgressoGeral, getProgressoByArea])

  // ============================================================================
  // AUDITORIAS
  // ============================================================================
  const auditorias = useMemo(() => {
    const total = execucoes.length
    const concluidas = execucoes.filter((e) => e.status === 'concluida').length
    const rascunho = execucoes.filter((e) => e.status === 'rascunho').length
    const emAndamento = total - concluidas - rascunho
    const overdue = getOverdueExecucoes()

    // Average score from completed
    const completed = execucoes.filter(
      (e) => e.status === 'concluida' && e.scoreConformidade != null
    )
    const averageScore =
      completed.length > 0
        ? Math.round(completed.reduce((s, e) => s + e.scoreConformidade, 0) / completed.length)
        : null

    // Recent completed (last 3)
    const recentCompleted = execucoes
      .filter((e) => e.status === 'concluida')
      .sort((a, b) => (b.concluidoEm || '').localeCompare(a.concluidoEm || ''))
      .slice(0, 3)

    return { total, concluidas, emAndamento, rascunho, averageScore, overdue, recentCompleted }
  }, [execucoes, getOverdueExecucoes])

  // ============================================================================
  // PLANOS DE ACAO
  // ============================================================================
  const planosData = useMemo(() => {
    const total = planos.length
    const byStatus = {}
    Object.keys(PLANO_STATUS).forEach((key) => {
      byStatus[key] = planos.filter((p) => p.status === key).length
    })

    const byOrigem = {}
    Object.keys(TIPO_ORIGEM).forEach((key) => {
      byOrigem[key] = planos.filter((p) => p.tipoOrigem === key).length
    })

    const overdue = getOverduePlanos()
    const concluidos = byStatus.concluido || 0
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0

    const avaliados = planos.filter((p) => p.eficacia).length
    const eficazes = planos.filter((p) => p.eficacia === 'eficaz').length
    const taxaEficacia = avaliados > 0 ? Math.round((eficazes / avaliados) * 100) : 0

    const donutData = Object.entries(PLANO_STATUS)
      .map(([key, config]) => ({
        label: config.label,
        value: byStatus[key] || 0,
        color: STATUS_COLORS[key],
      }))
      .filter((d) => d.value > 0)

    return { total, byStatus, byOrigem, overdue, taxaConclusao, taxaEficacia, donutData }
  }, [planos, getOverduePlanos])

  // ============================================================================
  // KPIs
  // ============================================================================
  const kpis = useMemo(() => {
    const alertIndicadores = indicadores.filter(
      (ind) => ind.statusAtual && ind.statusAtual.variant !== 'success'
    ).slice(0, 5)

    return {
      ...kpiSummary,
      alertIndicadores,
    }
  }, [kpiSummary, indicadores])

  // ============================================================================
  // SCORE COMPOSTO + NIVEL + CICLO + ALERTAS
  // ============================================================================
  const computed = useMemo(() => {
    // Sub-scores (0-100 each)
    const autoScore = autoavaliacao.progressoGeral.scoreConformidade || 0
    const auditScore = auditorias.averageScore ?? 0
    const planoScore = planosData.taxaConclusao || 0
    const kpiScore = kpis.scoreGeral || 0

    // Weight: only count systems that have data
    const weights = []
    if (autoavaliacao.progressoGeral.total > 0) weights.push({ score: autoScore, w: 30 })
    if (auditorias.total > 0) weights.push({ score: auditScore, w: 20 })
    if (planosData.total > 0) weights.push({ score: planoScore, w: 20 })
    if (kpis.total > 0) weights.push({ score: kpiScore, w: 30 })

    const totalWeight = weights.reduce((s, w) => s + w.w, 0)
    const scoreGeral =
      totalWeight > 0
        ? Math.round(weights.reduce((s, w) => s + (w.score * w.w) / totalWeight, 0))
        : 0

    const nivelMaturidade = getNivelMaturidade(scoreGeral)

    // Cycle
    const diasRestantesCiclo = diasAteFimCiclo(cicloAtual) ?? 0

    // Alerts
    const overdueAvaliacoes = getOverdueAvaliacoes()
    const overduePlanos = planosData.overdue
    const overdueAuditorias = auditorias.overdue

    const alerts = {
      total: overdueAvaliacoes.length + overduePlanos.length + overdueAuditorias.length,
      overdueAvaliacoes,
      overduePlanos,
      overdueAuditorias,
    }

    return {
      scoreGeral,
      nivelMaturidade,
      cicloAtual,
      diasRestantesCiclo,
      alerts,
      subScores: { autoScore, auditScore, planoScore, kpiScore },
    }
  }, [autoavaliacao, auditorias, planosData, kpis, cicloAtual, getOverdueAvaliacoes])

  // ============================================================================
  // NEW: Narrative, Insights, NextSteps, Achievements, NextMilestone
  // ============================================================================
  const enriched = useMemo(() => {
    const fullData = {
      ...computed,
      autoavaliacao,
      auditorias,
      planos: planosData,
      kpis,
    }

    return {
      narrative: generateNarrative(fullData),
      insights: generateInsights(fullData),
      nextSteps: generateNextSteps(fullData),
      achievements: computeAchievements(fullData),
      nextMilestone: computeNextMilestone(computed.scoreGeral),
    }
  }, [computed, autoavaliacao, auditorias, planosData, kpis])

  // Raw cycle evaluations for PDF template
  const avaliacoesCiclo = useMemo(() => {
    return avaliacoes.filter((a) => a.ciclo === cicloAtual)
  }, [avaliacoes, cicloAtual])

  return {
    loading,
    ...computed,
    autoavaliacao,
    auditorias,
    planos: planosData,
    kpis,
    avaliacoesCiclo,
    // NEW
    narrative: enriched.narrative,
    insights: enriched.insights,
    nextSteps: enriched.nextSteps,
    achievements: enriched.achievements,
    nextMilestone: enriched.nextMilestone,
    rawExecucoes: execucoes,
    rawPlanos: planos,
  }
}

export default useQualidadeDashboard
