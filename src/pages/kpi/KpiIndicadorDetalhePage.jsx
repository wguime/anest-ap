import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Target, BarChart3, CheckCircle2, XCircle } from 'lucide-react'
import {
  Card,
  CardContent,
  Badge,
  Spinner,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useKpiData } from '@/hooks/useKpiData'
import { formatValor } from '@/data/indicadores-2025'
import KpiTrendChart from './components/KpiTrendChart'
import { usePdfExport } from '@/hooks/usePdfExport'
import ExportButton from '@/components/ExportButton'

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * KpiIndicadorDetalhePage - Detail page for a single indicator
 * Route: kpiIndicadorDetalhe
 * Expects params.indicadorId
 */
export default function KpiIndicadorDetalhePage({ onNavigate, goBack, params }) {
  const indicadorId = params?.indicadorId
  const { indicadores, summary, loading, error } = useKpiData({ indicadorId })
  const { exportPdf, exporting } = usePdfExport()

  // Find the specific indicator
  const indicador = useMemo(() => {
    return indicadores.find((ind) => ind.id === indicadorId) || null
  }, [indicadores, indicadorId])

  const handleExportPdf = () => {
    if (!indicador) return
    exportPdf('kpiReport', {
      indicadores: [indicador],
      summary: { ...summary, total: 1 },
      ano: 2025,
    }, {
      title: `Ficha Individual - ${indicador.titulo}`,
      filename: `ANEST_KPI_${indicadorId}_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  // Header via portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('kpiHistorico'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {indicador?.titulo || 'Indicador'}
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <ExportButton
              onExport={handleExportPdf}
              loading={exporting}
              label="PDF"
              size="sm"
              disabled={loading || !indicador}
            />
          </div>
        </div>
      </div>
    </nav>
  )

  // Loading
  if (loading) {
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

  // Not found
  if (!indicador) {
    return (
      <div className="min-h-screen bg-background">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <EmptyState
          icon={<BarChart3 className="h-full w-full" aria-hidden="true" />}
          title="Indicador nao encontrado"
          description="O indicador solicitado nao existe ou nao possui dados."
          action={{ label: 'Voltar', onClick: () => (goBack ? goBack() : onNavigate('kpiHistorico')) }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Trend Chart */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Evolucao Mensal
          </h2>
          <KpiTrendChart
            meses={indicador.meses}
            meta={indicador.meta}
          />
        </div>

        {/* Meta info card */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Informacoes do Indicador
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Meta */}
            <div className="bg-background dark:bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Meta</p>
              <p className="text-lg font-bold text-primary">
                {indicador.metaLabel}
              </p>
            </div>

            {/* Unidade */}
            <div className="bg-background dark:bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Unidade</p>
              <p className="text-lg font-bold text-primary">
                {indicador.unidade || 'Absoluto'}
              </p>
            </div>

            {/* Media */}
            <div className="bg-background dark:bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Media Anual</p>
              <p className="text-lg font-bold text-primary">
                {indicador.media != null ? formatValor(indicador.media, indicador.unidade) : '--'}
              </p>
            </div>

            {/* Status */}
            <div className="bg-background dark:bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Status Atual</p>
              {indicador.statusAtual ? (
                <Badge variant={indicador.statusAtual.variant} badgeStyle="solid" className="mt-1">
                  {indicador.statusAtual.label}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </div>

            {/* Coletados */}
            <div className="bg-background dark:bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Meses Coletados</p>
              <p className="text-lg font-bold text-primary">
                {indicador.totalColetados} / 12
              </p>
            </div>

            {/* Validados */}
            <div className="bg-background dark:bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Meses Validados</p>
              <p className="text-lg font-bold text-primary">
                {indicador.totalValidados} / 12
              </p>
            </div>
          </div>
        </div>

        {/* Monthly values table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 pb-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Valores Mensais
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-border">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Mes</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Valor</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Num/Den</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-muted-foreground">Validacao</th>
                </tr>
              </thead>
              <tbody>
                {indicador.mesesDetalhados.map((det, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      'border-b border-[#F3F4F6] dark:border-[#1F2D28] last:border-b-0',
                      det.hasData && 'bg-background/50 dark:bg-card/30'
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {MESES_LABELS[idx]}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground">
                      {det.valor != null ? formatValor(det.valor, indicador.unidade) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {det.numerador != null && det.denominador != null
                        ? `${det.numerador} / ${det.denominador}`
                        : '--'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {!det.hasData ? (
                        <span className="text-muted-foreground text-xs">--</span>
                      ) : det.validado ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="text-xs text-success">Sim</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <XCircle className="w-4 h-4 text-warning" />
                          <span className="text-xs text-warning">Pendente</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
