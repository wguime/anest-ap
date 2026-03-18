import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  Activity,
  PenLine,
  History,
} from 'lucide-react'
import { Badge, Progress, Spinner, EmptyState, DonutChart } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useKpiData } from '@/hooks/useKpiData'
import { formatValor } from '@/data/indicadores-2025'
import { usePdfExport } from '@/hooks/usePdfExport'
import ExportButton from '@/components/ExportButton'

/**
 * KpiDashboardOverview - Overview dashboard for KPI compliance
 * Route: kpiDashboard
 */
export default function KpiDashboardOverview({ onNavigate, goBack, params, embedded = false }) {
  const { indicadores, summary, loading, error } = useKpiData({ ano: 2025 })
  const { exportPdf, exporting } = usePdfExport()

  const handleExportPdf = () => {
    exportPdf('kpiReport', { indicadores, summary, ano: 2025 }, {
      filename: `ANEST_KPIs_2025_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  // Donut chart data
  const donutData = useMemo(() => {
    if (!summary) return []
    return [
      { label: 'Conformes', value: summary.conformes, color: '#059669' },
      { label: 'Parciais', value: summary.parciais, color: '#F59E0B' },
      { label: 'Nao Conformes', value: summary.naoConformes, color: '#DC2626' },
      { label: 'Sem Dados', value: summary.semDados, color: '#9CA3AF' },
    ].filter((d) => d.value > 0)
  }, [summary])

  // Header via portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('qualidade'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Dashboard KPIs
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <ExportButton
              onExport={handleExportPdf}
              loading={exporting}
              label="PDF"
              size="sm"
              disabled={loading || !!error}
            />
          </div>
        </div>
      </div>
    </nav>
  )

  // Loading
  if (loading) {
    if (embedded) return <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-primary" /></div>
    return (
      <div className="min-h-screen bg-background">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8 text-primary" />
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    if (embedded) return <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"><p className="text-sm text-red-700 dark:text-red-300">Erro: {error}</p></div>
    return (
      <div className="min-h-screen bg-background">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 py-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300">Erro: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (embedded) {
    return (
      <div className="space-y-4">
        {/* Summary metric cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {/* Total */}
          <MetricCard
            icon={<BarChart3 className="w-5 h-5" />}
            iconBg="bg-primary/10 dark:bg-primary/10"
            iconColor="text-primary"
            label="Total Indicadores"
            value={summary.total}
          />
          {/* Conformes */}
          <MetricCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-success/10"
            iconColor="text-success"
            label="Conformes"
            value={summary.conformes}
          />
          {/* Parciais */}
          <MetricCard
            icon={<AlertTriangle className="w-5 h-5" />}
            iconBg="bg-warning/10"
            iconColor="text-warning"
            label="Parciais"
            value={summary.parciais}
          />
          {/* Nao Conformes */}
          <MetricCard
            icon={<XCircle className="w-5 h-5" />}
            iconBg="bg-destructive/10"
            iconColor="text-destructive"
            label="Nao Conformes"
            value={summary.naoConformes}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigate('kpiDataEntry')}
            className={cn(
              'flex items-center gap-3 bg-card rounded-xl border border-border p-3',
              'transition-colors hover:bg-background dark:hover:bg-muted active:bg-[#E0F5E8] dark:active:bg-card'
            )}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Entrada de Dados</p>
              <p className="text-xs text-muted-foreground">Inserir valores mensais</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('kpiHistorico')}
            className={cn(
              'flex items-center gap-3 bg-card rounded-xl border border-border p-3',
              'transition-colors hover:bg-background dark:hover:bg-muted active:bg-[#E0F5E8] dark:active:bg-card'
            )}
          >
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <History className="w-5 h-5 text-warning" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Historico</p>
              <p className="text-xs text-muted-foreground">Graficos e tendencias</p>
            </div>
          </button>
        </div>

        {/* Score Geral + Progress */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Score Geral</h2>
            </div>
            <span className="text-2xl font-bold text-primary">
              {summary.scoreGeral}%
            </span>
          </div>
          <Progress
            value={summary.scoreGeral}
            variant={summary.scoreGeral >= 80 ? 'success' : summary.scoreGeral >= 50 ? 'warning' : 'error'}
            size="lg"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Percentual de indicadores conformes sobre o total com dados
          </p>
        </div>

        {/* Donut Chart */}
        {donutData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 flex flex-col items-center">
            <h2 className="text-sm font-semibold text-foreground mb-4 self-start">
              Distribuicao de Conformidade
            </h2>
            <DonutChart
              data={donutData}
              labelKey="label"
              valueKey="value"
              totalLabel="Indicadores"
              size="md"
              maxCategories={5}
            />
          </div>
        )}

        {/* Indicators list */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 pb-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Indicadores ({indicadores.length})
            </h2>
          </div>

          <div className="divide-y divide-[#F3F4F6] dark:divide-[#1F2D28]">
            {indicadores.map((ind) => (
              <button
                key={ind.id}
                type="button"
                onClick={() => onNavigate('kpiIndicadorDetalhe', { indicadorId: ind.id })}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left',
                  'transition-colors hover:bg-background dark:hover:bg-muted',
                  'active:bg-[#E0F5E8] dark:active:bg-card'
                )}
              >
                {/* Status dot */}
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0',
                    ind.statusAtual?.variant === 'success' && 'bg-success',
                    ind.statusAtual?.variant === 'warning' && 'bg-warning',
                    ind.statusAtual?.variant === 'destructive' && 'bg-destructive',
                    !ind.statusAtual && 'bg-[#9CA3AF]'
                  )}
                />

                {/* Indicator info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ind.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ind.ultimoValor != null ? formatValor(ind.ultimoValor, ind.unidade) : 'Sem dados'}
                    {' | Meta: '}{ind.metaLabel}
                  </p>
                </div>

                {/* Status badge */}
                {ind.statusAtual && (
                  <Badge variant={ind.statusAtual.variant} badgeStyle="subtle" className="shrink-0">
                    {ind.statusAtual.label}
                  </Badge>
                )}

                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4 space-y-4">
        {/* Summary metric cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard
            icon={<BarChart3 className="w-5 h-5" />}
            iconBg="bg-primary/10 dark:bg-primary/10"
            iconColor="text-primary"
            label="Total Indicadores"
            value={summary.total}
          />
          <MetricCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-success/10"
            iconColor="text-success"
            label="Conformes"
            value={summary.conformes}
          />
          <MetricCard
            icon={<AlertTriangle className="w-5 h-5" />}
            iconBg="bg-warning/10"
            iconColor="text-warning"
            label="Parciais"
            value={summary.parciais}
          />
          <MetricCard
            icon={<XCircle className="w-5 h-5" />}
            iconBg="bg-destructive/10"
            iconColor="text-destructive"
            label="Nao Conformes"
            value={summary.naoConformes}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigate('kpiDataEntry')}
            className={cn(
              'flex items-center gap-3 bg-card rounded-xl border border-border p-3',
              'transition-colors hover:bg-background dark:hover:bg-muted active:bg-[#E0F5E8] dark:active:bg-card'
            )}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Entrada de Dados</p>
              <p className="text-xs text-muted-foreground">Inserir valores mensais</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('kpiHistorico')}
            className={cn(
              'flex items-center gap-3 bg-card rounded-xl border border-border p-3',
              'transition-colors hover:bg-background dark:hover:bg-muted active:bg-[#E0F5E8] dark:active:bg-card'
            )}
          >
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <History className="w-5 h-5 text-warning" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Historico</p>
              <p className="text-xs text-muted-foreground">Graficos e tendencias</p>
            </div>
          </button>
        </div>

        {/* Score Geral + Progress */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Score Geral</h2>
            </div>
            <span className="text-2xl font-bold text-primary">
              {summary.scoreGeral}%
            </span>
          </div>
          <Progress
            value={summary.scoreGeral}
            variant={summary.scoreGeral >= 80 ? 'success' : summary.scoreGeral >= 50 ? 'warning' : 'error'}
            size="lg"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Percentual de indicadores conformes sobre o total com dados
          </p>
        </div>

        {/* Donut Chart */}
        {donutData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 flex flex-col items-center">
            <h2 className="text-sm font-semibold text-foreground mb-4 self-start">
              Distribuicao de Conformidade
            </h2>
            <DonutChart
              data={donutData}
              labelKey="label"
              valueKey="value"
              totalLabel="Indicadores"
              size="md"
              maxCategories={5}
            />
          </div>
        )}

        {/* Indicators list */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 pb-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Indicadores ({indicadores.length})
            </h2>
          </div>

          <div className="divide-y divide-[#F3F4F6] dark:divide-[#1F2D28]">
            {indicadores.map((ind) => (
              <button
                key={ind.id}
                type="button"
                onClick={() => onNavigate('kpiIndicadorDetalhe', { indicadorId: ind.id })}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left',
                  'transition-colors hover:bg-background dark:hover:bg-muted',
                  'active:bg-[#E0F5E8] dark:active:bg-card'
                )}
              >
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0',
                    ind.statusAtual?.variant === 'success' && 'bg-success',
                    ind.statusAtual?.variant === 'warning' && 'bg-warning',
                    ind.statusAtual?.variant === 'destructive' && 'bg-destructive',
                    !ind.statusAtual && 'bg-[#9CA3AF]'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ind.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ind.ultimoValor != null ? formatValor(ind.ultimoValor, ind.unidade) : 'Sem dados'}
                    {' | Meta: '}{ind.metaLabel}
                  </p>
                </div>
                {ind.statusAtual && (
                  <Badge variant={ind.statusAtual.variant} badgeStyle="subtle" className="shrink-0">
                    {ind.statusAtual.label}
                  </Badge>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * MetricCard - Small summary card for the dashboard
 */
function MetricCard({ icon, iconBg, iconColor, label, value }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg, iconColor)}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
