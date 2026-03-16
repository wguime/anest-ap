import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  Shield,
  AlertTriangle,
  Clock,
  FileText,
  Activity,
  BarChart3,
  Target,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ListChecks,
  Award,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Check,
  X,
  Calendar,
  Download,
  Loader2,
  Paperclip,
} from 'lucide-react'
import {
  Card,
  CardContent,
  Badge,
  DonutChart,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
  Progress,
  Alert,
  Timeline,
  Modal,
  Select,
} from '@/design-system'
import { WidgetCard } from '@/design-system/components/ui/widget-card'
import { KPICard } from '@/design-system/components/anest/kpi-card'
import { AdminOnly } from '@/design-system/components/anest'
import { cn } from '@/design-system/utils/tokens'
import { useUser } from '@/contexts/UserContext'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { useDashboardExecutivo } from '@/hooks/useDashboardExecutivo'
import { usePdfExport } from '@/hooks/usePdfExport'
import { MESES_LABELS, DIMENSAO_CONFIG } from '@/data/indicadores-2025'
import { CYCLE_OPTIONS } from '@/data/autoavaliacaoConfig'

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

const TIER_COLORS = {
  bronze: { bg: 'bg-orange-100 dark:bg-orange-950/40', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-500', bar: 'bg-orange-600' },
  silver: { bg: 'bg-gray-100 dark:bg-gray-800/40', border: 'border-gray-300 dark:border-gray-600', text: 'text-gray-700 dark:text-gray-300', icon: 'text-gray-400', bar: 'bg-gray-600' },
  gold: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500', bar: 'bg-amber-600' },
  platinum: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300', icon: 'text-cyan-500', bar: 'bg-cyan-600' },
  diamond: { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300', icon: 'text-violet-500', bar: 'bg-violet-600' },
}

const DIMENSION_COLORS = {
  seguranca: 'red',
  efetividade: 'blue',
  eficiencia: 'green',
  atencao_centrada: 'purple',
  acesso: 'orange',
  continuidade: 'cyan',
}

function getProgressVariant(score) {
  if (score >= 80) return 'success'
  if (score >= 50) return 'warning'
  return 'error'
}

function getStrokeColor(score) {
  if (score >= 80) return '#34C759'
  if (score >= 50) return '#F59E0B'
  return '#DC2626'
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now - date
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Agora'
  if (diffMinutes < 60) return `${diffMinutes}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays}d`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`
  return `${Math.floor(diffDays / 30)}m`
}

const ACTION_LABELS = {
  created: 'Documento criado',
  status_changed: 'Status alterado',
  updated: 'Documento atualizado',
  version_added: 'Nova versão',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
  restored: 'Restaurado',
}

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
// A) HERO SECTION — SVG Circular Progress + Narrative
// ============================================================================

function HeroSection({ scoreGeral, nivelMaturidade, narrative, nextMilestone, cicloAtual }) {
  const nivel = NIVEL_CONFIG[nivelMaturidade] || NIVEL_CONFIG.em_progresso
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (scoreGeral / 100) * circumference
  const strokeColor = getStrokeColor(scoreGeral)

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
            <h2 className="text-base font-semibold text-[#004225] dark:text-white">
              Painel Qmentum
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={nivel.variant} badgeStyle={nivel.badgeStyle}>
              {nivel.label}
            </Badge>
            <Badge variant="default" badgeStyle="subtle">
              {cicloAtual}
            </Badge>
          </div>
        </div>

        {/* Circle + Narrative */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="w-14 h-14 sm:w-20 sm:h-20"
              role="img"
              aria-label={`Score geral: ${scoreGeral}%`}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/20"
              />
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

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {narrative?.headline}
            </p>
            {narrative?.subtextItems?.length > 0 && (
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

        {/* Next milestone */}
        {nextMilestone && nextMilestone.remaining > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Próximo nível: {nextMilestone.label}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                faltam {nextMilestone.remaining} pts
              </span>
            </div>
            <Progress value={nextMilestone.progress} size="sm" variant="success" striped />
          </div>
        )}

        {/* Cycle text */}
        {narrative?.cycleText && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Clock className="w-3 h-3" />
            {narrative.cycleText}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// B) ALERTS SECTION — using Alert component from design system
// ============================================================================

function AlertsSection({ alerts, onNavigate }) {
  if (!alerts || alerts.length === 0) return null

  // Sort: critical first, then warning
  const sorted = [...alerts].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1
    if (a.severity !== 'critical' && b.severity === 'critical') return 1
    return 0
  })

  return (
    <div className="space-y-1.5">
      {sorted.map((alert) => (
        <Alert
          key={alert.id}
          variant={alert.severity === 'critical' ? 'error' : 'warning'}
          action={{
            label: 'Ver',
            onClick: () => onNavigate(alert.route),
          }}
        >
          {alert.message}
        </Alert>
      ))}
    </div>
  )
}

// ============================================================================
// C) INSIGHT CARDS 2x2 — using WidgetCard variant="interactive"
// ============================================================================

function InsightCardsGrid({ insights, onNavigate }) {
  if (!insights || insights.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {insights.map((insight) => {
        const pendingCount = insight.value < 50 ? 1 : 0
        return (
          <WidgetCard
            key={insight.id}
            icon={<insight.icon className="w-6 h-6" />}
            title={insight.label}
            subtitle={insight.insight}
            value={`${insight.value}%`}
            badge={pendingCount > 0 ? '!' : undefined}
            variant="interactive"
            onClick={() => onNavigate(insight.navigateTo)}
          />
        )
      })}
    </div>
  )
}

// ============================================================================
// D) AUTOAVALIACAO ROP SECTION
// ============================================================================

function AutoavaliacaoSection({ autoavaliacao, onNavigate }) {
  if (!autoavaliacao) return null
  const { progressoGeral, areaBreakdown, donutData, totalEvidencias } = autoavaliacao

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">Autoavaliação ROPs</h3>
          </div>
          {totalEvidencias > 0 && (
            <div className="flex items-center gap-1">
              <Paperclip className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs tabular-nums text-muted-foreground">{totalEvidencias}</span>
            </div>
          )}
        </div>

        {/* Progress geral */}
        <div className="mb-4">
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

        {/* DonutChart */}
        {donutData?.length > 0 && (
          <div className="mb-4">
            <DonutChart
              data={donutData}
              labelKey="label"
              valueKey="value"
              totalLabel="ROPs"
              size="sm"
              maxCategories={4}
            />
          </div>
        )}

        {/* Area bars */}
        <div className="space-y-2">
          {areaBreakdown?.map((area) => (
            <button
              key={area.key}
              type="button"
              className="w-full text-left min-h-[44px] flex flex-col justify-center"
              onClick={() => onNavigate('autoavaliacaoArea', { areaKey: area.key })}
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
      </CardContent>
    </Card>
  )
}

// ============================================================================
// E) PROTOCOLOS OBRIGATÓRIOS
// ============================================================================

function ProtocolosSection({ protocolosStatus, protocolosCount, onNavigate }) {
  if (!protocolosStatus) return null

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">Protocolos Qmentum</h3>
          </div>
          <Badge variant={protocolosCount.documentados === protocolosCount.total ? 'success' : 'warning'} badgeStyle="subtle">
            {protocolosCount.documentados}/{protocolosCount.total}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <Progress
            value={protocolosCount.total > 0 ? Math.round((protocolosCount.documentados / protocolosCount.total) * 100) : 0}
            size="sm"
            variant={getProgressVariant(
              protocolosCount.total > 0 ? Math.round((protocolosCount.documentados / protocolosCount.total) * 100) : 0
            )}
          />
        </div>

        {/* Protocol list */}
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {protocolosStatus.map((proto) => (
            <div
              key={proto.nome}
              className="flex items-center gap-2 py-1"
            >
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                proto.existe
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              )}>
                {proto.existe ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </div>
              <span className={cn(
                'text-xs leading-snug',
                proto.existe ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {proto.nome}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-3 text-xs font-medium text-[#006837] dark:text-[#2ECC71] min-h-[44px] flex items-center"
          onClick={() => onNavigate('gestaoDocumental')}
        >
          Gerenciar documentos →
        </button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// F) COBERTURA DOCUMENTAL
// ============================================================================

function CoberturaSection({ coverageChartData, complianceScore, onNavigate }) {
  const donutData = useMemo(() => {
    return (coverageChartData || []).map((item) => ({
      label: item.label,
      value: item.value,
      color: item.coverage >= 80 ? '#059669' : item.coverage >= 50 ? '#F59E0B' : '#DC2626',
    }))
  }, [coverageChartData])

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">Cobertura Documental</h3>
          </div>
          <Badge variant={getProgressVariant(complianceScore) === 'error' ? 'destructive' : getProgressVariant(complianceScore) === 'warning' ? 'warning' : 'success'} badgeStyle="subtle">
            {complianceScore}%
          </Badge>
        </div>
        {donutData.length > 0 ? (
          <DonutChart
            data={donutData}
            labelKey="label"
            valueKey="value"
            totalLabel="Documentos"
            size="sm"
            maxCategories={6}
          />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem dados de cobertura.
          </p>
        )}
        <button
          type="button"
          className="mt-3 text-xs font-medium text-[#006837] dark:text-[#2ECC71] min-h-[44px] flex items-center"
          onClick={() => onNavigate('gestaoDocumental')}
        >
          Gerenciar documentos →
        </button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// G-J) INDICADORES TAB — KPICards
// ============================================================================

function KpiScoreHeader({ kpis }) {
  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
          <h3 className="text-sm font-bold text-foreground">Score Geral KPIs</h3>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-[#006837] dark:text-[#2ECC71]">
            {kpis?.scoreGeral || 0}%
          </span>
        </div>
        <Progress
          value={kpis?.scoreGeral || 0}
          size="md"
          variant={getProgressVariant(kpis?.scoreGeral || 0)}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="success" badgeStyle="subtle" className="text-xs">
            {kpis?.conformes ?? 0} Conformes
          </Badge>
          <Badge variant="warning" badgeStyle="subtle" className="text-xs">
            {kpis?.parciais ?? 0} Parciais
          </Badge>
          <Badge variant="destructive" badgeStyle="subtle" className="text-xs">
            {kpis?.naoConformes ?? 0} NC
          </Badge>
          <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
            {kpis?.semDados ?? 0} Sem Dados
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiRankingSection({ title, indicadores, accentColor, onNavigate }) {
  if (!indicadores || indicadores.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <Badge variant={accentColor === 'red' ? 'destructive' : 'success'} badgeStyle="subtle">
          {indicadores.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {indicadores.map((ind) => (
          <KPICard
            key={ind.id}
            compact
            titulo={ind.titulo || ind.nome}
            valor={ind.ultimoValor ?? 0}
            meta={ind.meta?.valor}
            metaLabel={ind.metaLabel}
            unidade={ind.unidade || ''}
            accentColor={accentColor}
            tendencia={(() => {
              const vals = (ind.meses || []).filter(v => v !== null)
              if (vals.length < 2) return 'stable'
              return vals[vals.length - 1] > vals[vals.length - 2] ? 'up' :
                     vals[vals.length - 1] < vals[vals.length - 2] ? 'down' : 'stable'
            })()}
            isLowerBetter={ind.meta?.direction !== 'higher'}
            historico={ind.meses?.filter((v) => v !== null) || []}
            mesesLabels={MESES_LABELS}
            onClick={() => onNavigate('kpiIndicadorDetalhe', { indicadorId: ind.id })}
          />
        ))}
      </div>
    </div>
  )
}

function KpiFullList({ indicadores, onNavigate }) {
  if (!indicadores || indicadores.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">
        Todos os Indicadores ({indicadores.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {indicadores.map((ind) => {
          const dimColor = DIMENSION_COLORS[ind.dimensao] || 'green'
          return (
            <KPICard
              key={ind.id}
              compact
              titulo={ind.titulo || ind.nome}
              valor={ind.ultimoValor ?? 0}
              meta={ind.meta?.valor}
              metaLabel={ind.metaLabel}
              unidade={ind.unidade || ''}
              accentColor={dimColor}
              isLowerBetter={ind.meta?.direction !== 'higher'}
              tendencia={(() => {
                const vals = (ind.meses || []).filter(v => v !== null)
                if (vals.length < 2) return 'stable'
                return vals[vals.length - 1] > vals[vals.length - 2] ? 'up' :
                       vals[vals.length - 1] < vals[vals.length - 2] ? 'down' : 'stable'
              })()}
              historico={ind.meses?.filter((v) => v !== null) || []}
              mesesLabels={MESES_LABELS}
              onClick={() => onNavigate('kpiIndicadorDetalhe', { indicadorId: ind.id })}
            />
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// K) NEXT STEPS SECTION
// ============================================================================

function NextStepsSection({ nextSteps, onNavigate }) {
  if (!nextSteps || nextSteps.length === 0) return null

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
          <h3 className="text-sm font-bold text-foreground">Próximos Passos</h3>
        </div>
        <div className="space-y-0.5">
          {nextSteps.map((step) => {
            const catConfig = CATEGORY_BADGE[step.category] || CATEGORY_BADGE.DADOS
            return (
              <button
                key={step.id}
                type="button"
                className="w-full text-left flex items-center gap-2 py-1.5"
                onClick={() => onNavigate(step.navigateTo)}
              >
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    step.category === 'URGENTE'
                      ? 'bg-red-500'
                      : step.category === 'MELHORIA'
                        ? 'bg-amber-500'
                        : 'bg-gray-400'
                  )}
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
      </CardContent>
    </Card>
  )
}

// ============================================================================
// L) PLANOS PDCA SECTION
// ============================================================================

function PlanosPdcaSection({ planos, onNavigate }) {
  if (!planos) return null

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">Planos PDCA</h3>
          </div>
          {planos.overdue?.length > 0 && (
            <Badge variant="destructive" badgeStyle="subtle">
              {planos.overdue.length} atrasado(s)
            </Badge>
          )}
        </div>

        {planos.donutData?.length > 0 && (
          <div className="mb-4">
            <DonutChart
              data={planos.donutData}
              labelKey="label"
              valueKey="value"
              totalLabel="Planos"
              size="sm"
              maxCategories={6}
            />
          </div>
        )}

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Taxa de conclusão</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {planos.taxaConclusao}%
              </span>
            </div>
            <Progress value={planos.taxaConclusao} size="sm" variant="success" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Taxa de eficácia</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {planos.taxaEficacia}%
              </span>
            </div>
            <Progress value={planos.taxaEficacia} size="sm" variant={getProgressVariant(planos.taxaEficacia)} />
          </div>
        </div>

        <button
          type="button"
          className="mt-3 text-xs font-medium text-[#006837] dark:text-[#2ECC71] min-h-[44px] flex items-center"
          onClick={() => onNavigate('planosAcao')}
        >
          Ver todos os planos →
        </button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// M) INCIDENTES SECTION — using WidgetCards
// ============================================================================

const SEVERITY_CONFIG = {
  critico: { label: 'Crítico', color: '#DC2626' },
  grave: { label: 'Grave', color: '#EA580C' },
  moderado: { label: 'Moderado', color: '#D97706' },
  leve: { label: 'Leve', color: '#3B82F6' },
  near_miss: { label: 'Near Miss', color: '#6B7280' },
}

function IncidentesSection({ incidentsByStatus, incidentesByTipo, incidentsBySeverity, meanResolutionDays, totalIncidentes, totalDenuncias, onNavigate }) {
  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">Incidentes</h3>
          </div>
          {incidentsByStatus.pendente > 0 && (
            <Badge variant="warning" badgeStyle="subtle">
              {incidentsByStatus.pendente} pendentes
            </Badge>
          )}
        </div>

        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-lg font-bold text-foreground">{totalIncidentes} incidentes</span>
          <span className="text-sm text-muted-foreground">{totalDenuncias} denúncias</span>
        </div>

        {/* Severity badges */}
        {incidentsBySeverity && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => {
              const count = incidentsBySeverity[key] || 0
              if (count === 0) return null
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: cfg.color }}
                >
                  {cfg.label} {count}
                </span>
              )
            })}
          </div>
        )}

        {/* Mean resolution */}
        {meanResolutionDays != null && (
          <p className="text-xs text-muted-foreground mb-3">
            Tempo médio de resolução: <span className="font-semibold text-foreground">{meanResolutionDays}d</span>
          </p>
        )}

        {/* Status breakdown */}
        <div className="space-y-2 mb-3">
          {[
            { label: 'Pendentes', value: incidentsByStatus.pendente, total: incidentsByStatus.total, variant: 'warning' },
            { label: 'Em Análise', value: incidentsByStatus.em_analise, total: incidentsByStatus.total, variant: 'default' },
            { label: 'Concluídos', value: incidentsByStatus.concluido, total: incidentsByStatus.total, variant: 'success' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs tabular-nums text-foreground">{item.value}</span>
              </div>
              <Progress
                value={item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}
                size="sm"
                variant={item.variant}
              />
            </div>
          ))}
        </div>

        {/* Top 5 types */}
        {incidentesByTipo?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Top tipos</p>
            <div className="space-y-1">
              {incidentesByTipo.map((item) => (
                <div key={item.tipo} className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate pr-2">{item.tipo}</span>
                  <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="mt-3 text-xs font-medium text-[#006837] dark:text-[#2ECC71] min-h-[44px] flex items-center"
          onClick={() => onNavigate('incidentes')}
        >
          Ver incidentes →
        </button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// N) ACHIEVEMENTS SECTION
// ============================================================================

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
  const selectedAch = selectedId ? sorted.find((a) => a.id === selectedId) : null

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">Conquistas</h3>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {achievements.unlockedCount}/{achievements.total}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {visible.map((ach) => {
            const AchIcon = ach.Icon
            const tier = TIER_COLORS[ach.tier] || TIER_COLORS.gold
            const progressPercent = ach.progress ? Math.round((ach.progress.current / ach.progress.total) * 100) : 0
            const isSelected = selectedId === ach.id

            return (
              <button
                key={ach.id}
                type="button"
                onClick={() => setSelectedId((prev) => (prev === ach.id ? null : ach.id))}
                className={cn(
                  'h-[72px] rounded-xl border p-2 text-left transition-all flex items-center gap-2.5',
                  ach.unlocked
                    ? `${tier.bg} ${tier.border} ${isSelected ? 'ring-2 ring-offset-1 ring-primary/40' : ''}`
                    : `bg-muted/30 border-border ${isSelected ? 'ring-2 ring-offset-1 ring-primary/40' : ''}`
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  ach.unlocked ? `${tier.bg} ${tier.icon}` : 'bg-muted text-muted-foreground/50'
                )}>
                  {AchIcon && <AchIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold truncate', ach.unlocked ? tier.text : 'text-muted-foreground')}>
                    {ach.title}
                  </p>
                  {ach.unlocked ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Concluída</p>
                  ) : ach.progress ? (
                    <div className="mt-1">
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', tier.bar)} style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                        {ach.progress.current}/{ach.progress.total}
                      </p>
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected detail */}
        {selectedAch && (
          <div className={cn('mt-2 rounded-xl border p-3', TIER_COLORS[selectedAch.tier]?.bg, TIER_COLORS[selectedAch.tier]?.border)}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', TIER_COLORS[selectedAch.tier]?.icon)}>
                {selectedAch.Icon && <selectedAch.Icon className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-bold', TIER_COLORS[selectedAch.tier]?.text)}>{selectedAch.title}</p>
                <p className="text-[11px] text-muted-foreground">{selectedAch.description}</p>
              </div>
            </div>
            {selectedAch.steps?.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {selectedAch.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
                      step.done ? 'bg-emerald-500 text-white' : 'border border-border bg-background'
                    )}>
                      {step.done && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className={cn('text-[11px] flex-1', step.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
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
        )}

        {sorted.length > 4 && (
          <button
            type="button"
            className="text-xs font-medium text-[#006837] dark:text-[#2ECC71] mt-2"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Ver menos' : `Ver todas (${sorted.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// O) ATIVIDADE RECENTE — using Timeline component
// ============================================================================

function AtividadeRecenteSection({ recentChanges }) {
  const timelineItems = useMemo(() => {
    if (!recentChanges || recentChanges.length === 0) return []

    return recentChanges.slice(0, 10).map((entry, index) => {
      const actionLabel = ACTION_LABELS[entry.action] || entry.action || 'Ação'
      const relativeTime = formatRelativeTime(entry.timestamp)

      return {
        id: `${entry.documentId}-${entry.timestamp}-${index}`,
        title: actionLabel,
        description: entry.documentTitle
          ? `${entry.documentTitle}${entry.documentCode ? ` (${entry.documentCode})` : ''}${entry.userName ? ` — ${entry.userName}` : ''}`
          : entry.userName || '',
        timestamp: relativeTime,
        status: index === 0 ? 'active' : 'completed',
      }
    })
  }, [recentChanges])

  return (
    <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
          <h3 className="text-sm font-bold text-foreground">Atividade Recente</h3>
        </div>

        {timelineItems.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Activity className="w-8 h-8 text-[#9CA3AF] mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
          </div>
        ) : (
          <Timeline
            items={timelineItems}
            size="sm"
            orientation="vertical"
            animated
          />
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardExecutivoPage({ onNavigate, goBack }) {
  const data = useDashboardExecutivo()
  const { exportPdf, exporting } = usePdfExport()
  const { profile: user } = useUser()
  const { cicloAtual: contextCiclo, setCiclo } = useAutoavaliacao()
  const [showCicloModal, setShowCicloModal] = useState(false)

  const cycleInfo = useMemo(() => getCycleInfo(data.cicloAtual), [data.cicloAtual])

  const handleCicloChange = useCallback((newCiclo) => {
    setCiclo(newCiclo)
    setShowCicloModal(false)
  }, [setCiclo])

  const handleExportPdf = useCallback(() => {
    exportPdf('qualidadeReport', {
      scoreGeral: data.scoreGeral,
      nivelMaturidade: data.nivelMaturidade,
      cicloAtual: data.cicloAtual,
      diasRestantesCiclo: data.diasRestantesCiclo,
      subScores: data.subScores,
      autoavaliacao: data.autoavaliacao,
      auditorias: data.auditorias,
      planos: data.planos,
      kpis: data.kpis,
      alerts: data.alerts,
      nextSteps: data.nextSteps,
      achievements: data.achievements,
      narrative: data.narrative,
      insights: data.insights,
      // Gestao: Protocolos obrigatorios
      protocolosStatus: data.protocolosStatus,
      protocolosCount: data.protocolosCount,
      // Gestao: Cobertura documental
      complianceScore: data.complianceScore,
      totalDocuments: data.totalDocuments,
      activeCount: data.activeCount,
      overdueCount: data.overdueCount,
      pendingCount: data.pendingCount,
      coverageChartData: data.coverageChartData,
      recentChanges: data.recentChanges,
      // Gestao: Incidentes
      incidentsByStatus: data.incidentsByStatus,
      incidentesByTipo: data.incidentesByTipo,
      incidentsBySeverity: data.incidentsBySeverity,
      meanResolutionDays: data.meanResolutionDays,
      totalIncidentes: data.totalIncidentes,
      totalDenuncias: data.totalDenuncias,
      // Gestao: KPIs detalhados
      kpiIndicadores: data.kpiIndicadores,
      topCriticos: data.topCriticos,
      topDestaques: data.topDestaques,
      // Alertas criticos (merged)
      criticalAlerts: data.criticalAlerts,
      // Raw arrays for enhanced PDF
      rawExecucoes: data.rawExecucoes,
      rawPlanos: data.rawPlanos,
      overdueDocuments: data.overdueDocuments,
      upcomingReviews: data.upcomingReviews,
      // PDF extras
      geradoPor: user?.nome || user?.displayName || 'Administrador',
      geradoPorUid: user?.uid || '',
      avaliacoesCiclo: data.avaliacoesCiclo,
      dimensaoConfig: DIMENSAO_CONFIG,
    })
  }, [exportPdf, data, user])

  // --- Header via portal ---
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]" />
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Dashboard Executivo
          </h1>
          <div className="min-w-[70px] flex justify-end gap-1.5">
            <AdminOnly user={user}>
              <button
                type="button"
                onClick={() => setShowCicloModal(true)}
                className="p-2 rounded-lg text-[#006837] dark:text-[#2ECC71] hover:bg-[#006837]/10 transition-colors"
                aria-label="Gerenciar Ciclo"
              >
                <Calendar className="w-5 h-5" />
              </button>
            </AdminOnly>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exporting ? 'Gerando...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )

  // --- Loading ---
  if (data.isLoading) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916]">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8 text-[#006837]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-28">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        <Tabs defaultValue="visao-geral" variant="underline">
          <TabsList className="mb-4">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="acoes">Ações</TabsTrigger>
          </TabsList>

          {/* ================================================================= */}
          {/* TAB 1: VISAO GERAL                                                */}
          {/* ================================================================= */}
          <TabsContent value="visao-geral">
            <div className="space-y-3">
              {/* A. Hero Score */}
              <HeroSection
                scoreGeral={data.scoreGeral}
                nivelMaturidade={data.nivelMaturidade}
                narrative={data.narrative}
                nextMilestone={data.nextMilestone}
                cicloAtual={data.cicloAtual}
              />

              {/* B. Alertas Acionaveis */}
              <AlertsSection alerts={data.criticalAlerts} onNavigate={onNavigate} />

              {/* C. Insight Cards 2x2 */}
              <InsightCardsGrid insights={data.insights} onNavigate={onNavigate} />

              {/* D. Autoavaliacao ROP */}
              <AutoavaliacaoSection autoavaliacao={data.autoavaliacao} onNavigate={onNavigate} />

              {/* E. Protocolos Obrigatorios */}
              <ProtocolosSection
                protocolosStatus={data.protocolosStatus}
                protocolosCount={data.protocolosCount}
                onNavigate={onNavigate}
              />

              {/* F. Cobertura Documental */}
              <CoberturaSection
                coverageChartData={data.coverageChartData}
                complianceScore={data.complianceScore}
                onNavigate={onNavigate}
              />
            </div>
          </TabsContent>

          {/* ================================================================= */}
          {/* TAB 2: INDICADORES                                                */}
          {/* ================================================================= */}
          <TabsContent value="indicadores">
            <div className="space-y-3">
              {/* G. Score Geral KPI */}
              <KpiScoreHeader kpis={data.kpis} />

              {/* H. Top 5 Criticos */}
              <KpiRankingSection
                title="Atenção Necessária"
                indicadores={data.topCriticos}
                accentColor="red"
                onNavigate={onNavigate}
              />

              {/* I. Top 5 Destaques */}
              <KpiRankingSection
                title="Destaques"
                indicadores={data.topDestaques}
                accentColor="green"
                onNavigate={onNavigate}
              />

              {/* J. Lista Completa */}
              <KpiFullList indicadores={data.kpiIndicadores} onNavigate={onNavigate} />
            </div>
          </TabsContent>

          {/* ================================================================= */}
          {/* TAB 3: ACOES                                                      */}
          {/* ================================================================= */}
          <TabsContent value="acoes">
            <div className="space-y-3">
              {/* K. Proximos Passos */}
              <NextStepsSection nextSteps={data.nextSteps} onNavigate={onNavigate} />

              {/* L. Planos PDCA */}
              <PlanosPdcaSection planos={data.planos} onNavigate={onNavigate} />

              {/* M. Incidentes */}
              <IncidentesSection
                incidentsByStatus={data.incidentsByStatus}
                incidentesByTipo={data.incidentesByTipo}
                incidentsBySeverity={data.incidentsBySeverity}
                meanResolutionDays={data.meanResolutionDays}
                totalIncidentes={data.totalIncidentes}
                totalDenuncias={data.totalDenuncias}
                onNavigate={onNavigate}
              />

              {/* N. Conquistas */}
              <AchievementsSection achievements={data.achievements} />

              {/* O. Atividade Recente */}
              <AtividadeRecenteSection recentChanges={data.recentChanges} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal — Gerenciar Ciclo */}
      <Modal
        open={showCicloModal}
        onClose={() => setShowCicloModal(false)}
        title="Gerenciar Ciclo"
        size="sm"
      >
        <div className="space-y-5">
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

              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-primary tabular-nums">{data.scoreGeral}%</p>
                  <p className="text-[10px] text-muted-foreground">Score Geral</p>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-foreground">{NIVEL_CONFIG[data.nivelMaturidade]?.label || 'Em Progresso'}</p>
                  <p className="text-[10px] text-muted-foreground">Nível</p>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold tabular-nums text-foreground">{data.criticalAlerts?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Pendências</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Select
              options={CYCLE_SELECT_OPTIONS}
              value={contextCiclo}
              onChange={handleCicloChange}
              label="Alterar ciclo"
              size="md"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
              Ao trocar o ciclo, o dashboard será atualizado com os dados do período selecionado.
            </p>
          </div>
        </div>
      </Modal>

    </div>
  )
}
