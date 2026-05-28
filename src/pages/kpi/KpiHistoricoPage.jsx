import { useState } from 'react'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { Select, Badge, Spinner, EmptyState } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useKpiData } from '@/hooks/useKpiData'
import { formatValor } from '@/data/indicadores-2025'
import { PageHeader } from '../../components'
import KpiTrendChart from './components/KpiTrendChart'

const ANO_OPTIONS = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
]

/**
 * KpiHistoricoPage - Historical view of all KPIs with trend charts
 * Route: kpiHistorico
 */
export default function KpiHistoricoPage({ onNavigate, goBack, _params }) {
  const [ano, setAno] = useState('2025')
  const { indicadores, loading, error } = useKpiData({ ano: parseInt(ano, 10) })

  const handleCardClick = (indicadorId) => {
    onNavigate('kpiIndicadorDetalhe', { indicadorId })
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Historico KPIs" onBack={() => (goBack ? goBack() : onNavigate('qualidade'))} />

      <div className="px-4 sm:px-5 py-4">
        {/* Year selector */}
        <div className="mb-4 max-w-[200px]">
          <Select
            label="Ano"
            options={ANO_OPTIONS}
            value={ano}
            onChange={(val) => setAno(val)}
            size="sm"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="w-8 h-8 text-primary" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4">
            <p className="text-sm text-destructive">Erro: {error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && indicadores.length === 0 && (
          <EmptyState
            icon={<TrendingUp className="h-full w-full" aria-hidden="true" />}
            title="Nenhum indicador encontrado"
            description={`Nao ha indicadores cadastrados para ${ano}.`}
          />
        )}

        {/* Indicator cards list */}
        {!loading && !error && indicadores.length > 0 && (
          <div className="space-y-4">
            {indicadores.map((ind) => (
              <button
                key={ind.id}
                type="button"
                onClick={() => handleCardClick(ind.id)}
                className={cn(
                  'w-full text-left bg-card rounded-2xl border border-border',
                  'p-4 transition-all hover:shadow-md hover:border-primary dark:hover:border-primary',
                  'active:scale-[0.99]'
                )}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground truncate flex-1">
                    {ind.titulo}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {ind.statusAtual && (
                      <Badge variant={ind.statusAtual.variant} badgeStyle="subtle">
                        {ind.statusAtual.label}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                {/* Meta + stats row */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-muted-foreground">
                    Meta: {ind.metaLabel}
                  </span>
                  {ind.media != null && (
                    <span className="text-xs text-muted-foreground">
                      Media: {formatValor(ind.media, ind.unidade)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {ind.totalColetados}/12 meses
                  </span>
                </div>

                {/* Trend chart */}
                <KpiTrendChart
                  meses={ind.meses}
                  meta={ind.meta}
                  className="pointer-events-none"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
