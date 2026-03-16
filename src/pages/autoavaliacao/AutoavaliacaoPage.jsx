import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BottomNav, Select, DonutChart, Spinner } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { ChevronLeft, GraduationCap, ClipboardCheck, FileBarChart } from 'lucide-react'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { AREA_CONFIG, CYCLE_OPTIONS, AVALIACAO_STATUS } from '@/data/autoavaliacaoConfig'
import AreaProgressCard from './components/AreaProgressCard'

export default function AutoavaliacaoPage({ onNavigate, goBack }) {
  const {
    loading,
    cicloAtual,
    setCiclo,
    getProgressoGeral,
    getProgressoByArea,
    avaliacoes,
  } = useAutoavaliacao()

  const progressoGeral = getProgressoGeral()

  const cicloOptions = CYCLE_OPTIONS.map((c) => ({ value: c.id, label: c.label }))

  // Build donut chart data from overall status breakdown
  const donutData = useMemo(() => {
    const cicloAvaliacoes = avaliacoes.filter((a) => a.ciclo === cicloAtual)
    const conformes = cicloAvaliacoes.filter((a) => a.status === 'conforme').length
    const parciais = cicloAvaliacoes.filter((a) => a.status === 'parcialmente_conforme').length
    const naoConformes = cicloAvaliacoes.filter((a) => a.status === 'nao_conforme').length
    const naoAvaliados = progressoGeral.total - conformes - parciais - naoConformes

    return [
      { label: 'Conforme', value: conformes, color: AVALIACAO_STATUS.conforme.color },
      { label: 'Parcial', value: parciais, color: AVALIACAO_STATUS.parcialmente_conforme.color },
      { label: 'Nao Conforme', value: naoConformes, color: AVALIACAO_STATUS.nao_conforme.color },
      { label: 'Nao Avaliado', value: naoAvaliados, color: AVALIACAO_STATUS.nao_avaliado.color },
    ].filter((d) => d.value > 0)
  }, [avaliacoes, cicloAtual, progressoGeral.total])

  const scoreGeral = useMemo(() => {
    if (progressoGeral.avaliados === 0) return 0
    return Math.round((progressoGeral.conformes / progressoGeral.avaliados) * 100)
  }, [progressoGeral])

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-primary dark:text-foreground truncate text-center flex-1 mx-2">
            Autoavaliacao Qmentum
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('autoavaliacaoRelatorio')}
              className="p-2 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
              aria-label="Relatorio"
            >
              <FileBarChart className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {/* Ciclo selector */}
        <Select
          label="Ciclo de Avaliacao"
          options={cicloOptions}
          value={cicloAtual}
          onChange={setCiclo}
          size="sm"
        />

        {/* Overall progress donut */}
        <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-4">
          <h2 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
            Progresso Geral
          </h2>
          <DonutChart
            data={donutData}
            labelKey="label"
            valueKey="value"
            size="sm"
            showTotal
            totalLabel="ROPs"
            showLegend
          />
        </div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3 text-center">
            <p className="text-2xl font-bold text-primary dark:text-foreground">{progressoGeral.total}</p>
            <p className="text-xs text-muted-foreground">Total ROPs</p>
          </div>
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3 text-center">
            <p className="text-2xl font-bold text-primary dark:text-foreground">{progressoGeral.avaliados}</p>
            <p className="text-xs text-muted-foreground">Avaliados</p>
          </div>
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3 text-center">
            <p className="text-2xl font-bold text-success">{progressoGeral.percentual}%</p>
            <p className="text-xs text-muted-foreground">Progresso</p>
          </div>
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3 text-center">
            <p className={cn('text-2xl font-bold', scoreGeral >= 80 ? 'text-success' : scoreGeral >= 50 ? 'text-warning' : 'text-destructive')}>
              {scoreGeral}%
            </p>
            <p className="text-xs text-muted-foreground">Score Conformidade</p>
          </div>
        </div>

        {/* Area cards grid */}
        <div>
          <h2 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
            Areas de Avaliacao
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(AREA_CONFIG).map(([areaKey, config]) => {
              const progresso = getProgressoByArea(areaKey)
              return (
                <AreaProgressCard
                  key={areaKey}
                  areaKey={areaKey}
                  progresso={progresso}
                  areaConfig={config}
                  onClick={() => onNavigate('autoavaliacaoArea', { areaKey })}
                />
              )
            })}
          </div>
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground" fill="none" />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home')
          else if (item.id === 'shield') onNavigate('gestao')
          else if (item.id === 'education') onNavigate('educacao')
          else if (item.id === 'menu') onNavigate('menuPage')
        }}
      />
    </div>
  )
}
