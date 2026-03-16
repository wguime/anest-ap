/**
 * PlanoAcaoDashboard - Metricas e graficos dos planos de acao
 */
import { useMemo } from 'react'
import { Card, Badge, Progress, DonutChart } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { ClipboardList, CheckCircle2, AlertTriangle, Clock, XCircle, Target } from 'lucide-react'
import { PLANO_STATUS, PRIORIDADES, EFICACIA_OPTIONS } from '@/data/planosAcaoConfig'

// Cores alinhadas ao DS (anest-theme) e padroes internacionais: info=azul, warning=ambar, success=verde, destructive=vermelho, secondary=neutro
const STATUS_COLORS = {
  planejamento: '#007AFF', // info
  execucao: '#F59E0B', // warning
  verificacao: '#007AFF', // info (em verificacao/revisao)
  padronizacao: '#6B7280', // secondary
  concluido: '#2ECC71', // success (DS badge-success)
  cancelado: '#DC2626', // destructive (DS)
}

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

export default function PlanoAcaoDashboard({ planos = [], onStatusClick }) {
  const stats = useMemo(() => {
    const total = planos.length
    const byStatus = {}
    const byPrioridade = {}
    let overdue = 0
    let concluidos = 0
    let eficazes = 0
    let avaliados = 0

    planos.forEach((p) => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1
      byPrioridade[p.prioridade] = (byPrioridade[p.prioridade] || 0) + 1

      if (p.status === 'concluido') concluidos++
      if (p.eficacia) {
        avaliados++
        if (p.eficacia === 'eficaz') eficazes++
      }
      if (
        p.prazo &&
        p.status !== 'concluido' &&
        p.status !== 'cancelado' &&
        new Date(p.prazo) < new Date()
      ) {
        overdue++
      }
    })

    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0
    const taxaEficacia = avaliados > 0 ? Math.round((eficazes / avaliados) * 100) : 0

    return { total, byStatus, byPrioridade, overdue, concluidos, taxaConclusao, taxaEficacia, avaliados }
  }, [planos])

  const donutData = useMemo(() => {
    return Object.entries(PLANO_STATUS)
      .map(([key, config]) => ({
        statusKey: key,
        label: config.label,
        value: stats.byStatus[key] || 0,
        color: STATUS_COLORS[key],
      }))
      .filter((d) => d.value > 0)
  }, [stats])

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={ClipboardList}
          label="Total"
          value={stats.total}
          color="#006837"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Concluidos"
          value={stats.concluidos}
          color="#2ECC71"
          description={`${stats.taxaConclusao}% taxa de conclusao`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Atrasados"
          value={stats.overdue}
          color="#DC2626"
        />
        <MetricCard
          icon={Target}
          label="Eficacia"
          value={`${stats.taxaEficacia}%`}
          color="#007AFF"
          description={`${stats.avaliados} avaliados`}
        />
      </div>

      {/* Donut chart */}
      {donutData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Distribuicao por Status
          </h3>
          <DonutChart
            data={donutData}
            labelKey="label"
            valueKey="value"
            totalLabel="Planos"
            size="md"
            maxCategories={6}
            onItemClick={(item) => {
              if (onStatusClick && item.statusKey) {
                onStatusClick(item.statusKey)
              }
            }}
          />
        </Card>
      )}

      {/* Taxa de conclusao */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Taxa de Conclusao
        </h3>
        <div className="flex items-center gap-3">
          <Progress value={stats.taxaConclusao} className="flex-1 h-2" />
          <span className="text-sm font-medium text-foreground min-w-[40px] text-right">
            {stats.taxaConclusao}%
          </span>
        </div>
      </Card>
    </div>
  )
}
