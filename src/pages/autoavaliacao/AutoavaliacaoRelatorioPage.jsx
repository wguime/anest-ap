import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BottomNav, DonutChart, Progress, Spinner, Button } from '@/design-system'
import { ChevronLeft, GraduationCap, Download, FileText } from 'lucide-react'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { AREA_CONFIG, AVALIACAO_STATUS, getAllRopsForArea } from '@/data/autoavaliacaoConfig'
import RopStatusBadge from './components/RopStatusBadge'

export default function AutoavaliacaoRelatorioPage({ onNavigate, goBack }) {
  const { loading, cicloAtual, avaliacoes, getProgressoGeral, getProgressoByArea } =
    useAutoavaliacao()

  const progressoGeral = getProgressoGeral()

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

  const areaDetails = useMemo(() => {
    return Object.entries(AREA_CONFIG).map(([areaKey, config]) => {
      const progresso = getProgressoByArea(areaKey)
      const rops = getAllRopsForArea(areaKey)
      const areaAvaliacoes = avaliacoes.filter(
        (a) => a.ropArea === areaKey && a.ciclo === cicloAtual
      )

      const ropRows = rops.map(({ ropId, title }) => {
        const av = areaAvaliacoes.find((a) => a.ropId === ropId)
        return {
          ropId,
          title,
          status: av?.status || 'nao_avaliado',
          observacoes: av?.observacoes || null,
          evidenciaCount: av?.evidencias?.length || 0,
          responsavel: av?.responsavelNome || null,
        }
      })

      return { areaKey, config, progresso, ropRows }
    })
  }, [avaliacoes, cicloAtual, getProgressoByArea])

  const handleExport = () => {
    // Placeholder
    alert('Em breve')
  }

  const statusRowBg = {
    conforme: 'bg-success/10',
    parcialmente_conforme: 'bg-warning/10',
    nao_conforme: 'bg-destructive/10',
    nao_avaliado: '',
  }

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
            Relatorio Consolidado
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={handleExport}
              className="p-2 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
              aria-label="Exportar"
            >
              <Download className="w-5 h-5" />
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
        {/* Cycle info */}
        <div className="bg-card rounded-[20px] border border-border-strong p-4">
          <p className="text-xs text-muted-foreground mb-1">Ciclo</p>
          <p className="text-sm font-semibold text-primary dark:text-foreground">{cicloAtual}</p>
        </div>

        {/* Overall donut + stats */}
        <div className="bg-card rounded-[20px] border border-border-strong p-4">
          <h2 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
            Resumo Geral
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
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-primary dark:text-foreground">
                {progressoGeral.total}
              </p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-success">{progressoGeral.avaliados}</p>
              <p className="text-[10px] text-muted-foreground">Avaliados</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary dark:text-foreground">
                {progressoGeral.percentual}%
              </p>
              <p className="text-[10px] text-muted-foreground">Progresso</p>
            </div>
          </div>
        </div>

        {/* Per-area breakdown */}
        {areaDetails.map(({ areaKey, config, progresso, ropRows }) => {
          const Icon = config.icon
          return (
            <div
              key={areaKey}
              className="bg-card rounded-[20px] border border-border-strong overflow-hidden"
            >
              {/* Area header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-primary dark:text-foreground flex-1">
                    {config.title}
                  </h3>
                  <span className="text-sm font-bold text-primary">
                    {progresso.percentual}%
                  </span>
                </div>
                <Progress value={progresso.percentual} size="sm" />
              </div>

              {/* ROP rows */}
              <div className="divide-y divide-border">
                {ropRows.map((row) => (
                  <div
                    key={row.ropId}
                    className={`px-4 py-3 ${statusRowBg[row.status] || ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground dark:text-white flex-1">
                        {row.title}
                      </p>
                      <RopStatusBadge status={row.status} />
                    </div>
                    {row.observacoes && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                        {row.observacoes}
                      </p>
                    )}
                    {(row.evidenciaCount > 0 || row.responsavel) && (
                      <div className="flex items-center gap-4 mt-1.5 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                        {row.evidenciaCount > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 shrink-0" />
                            {row.evidenciaCount} evidencia{row.evidenciaCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {row.responsavel && (
                          <span>Responsável: {row.responsavel}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Export placeholder */}
        <Button onClick={handleExport} variant="outline" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatorio (Em breve)
        </Button>
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
