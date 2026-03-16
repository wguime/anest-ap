/**
 * AuditScoreCard - Card de score/resultado de auditoria com DonutChart
 */
import { DonutChart } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

function getScoreColorClass(score) {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-destructive'
}

export default function AuditScoreCard({ score, totalItems, conformes, naoConformes, naoAplicaveis }) {
  const scoreColorClass = getScoreColorClass(score)

  const chartData = [
    { label: 'Conforme', value: conformes, color: '#34C759' },
    { label: 'Nao Conforme', value: naoConformes, color: '#DC2626' },
    { label: 'Nao Aplicavel', value: naoAplicaveis, color: '#6B7280' },
  ].filter((d) => d.value > 0)

  return (
    <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-5">
      <div className="flex flex-col items-center">
        {/* Score */}
        <div className="text-center mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
            Score de Conformidade
          </p>
          <p className={cn('text-4xl font-bold', scoreColorClass)}>
            {score}%
          </p>
        </div>

        {/* DonutChart */}
        <DonutChart
          data={chartData}
          showTotal={false}
          showLegend={false}
          size="sm"
        />

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3 mt-5 w-full">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-success/20 mb-1">
              <span className="text-sm font-bold text-success">{conformes}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Conforme</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 mb-1">
              <span className="text-sm font-bold text-destructive">{naoConformes}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">N. Conforme</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted mb-1">
              <span className="text-sm font-bold text-muted-foreground">{naoAplicaveis}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">N. Aplicavel</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {totalItems} itens avaliados
        </p>
      </div>
    </div>
  )
}
