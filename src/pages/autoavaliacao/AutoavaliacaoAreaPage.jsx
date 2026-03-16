import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BottomNav, Progress, Spinner } from '@/design-system'
import { ChevronLeft, ChevronRight, GraduationCap, Calendar, AlertTriangle } from 'lucide-react'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { AREA_CONFIG, getAllRopsForArea, getEffectiveDeadline } from '@/data/autoavaliacaoConfig'
import { getDeadlineUrgency } from '@/data/auditoriaTemplatesConfig'
import DeadlineBadge from '@/components/DeadlineBadge'
import RopStatusBadge from './components/RopStatusBadge'

export default function AutoavaliacaoAreaPage({ onNavigate, goBack, params }) {
  const areaKey = params?.areaKey
  const areaConfig = AREA_CONFIG[areaKey]
  const { loading, getAvaliacoesByArea, getProgressoByArea, cicloAtual } = useAutoavaliacao()

  const rops = useMemo(() => getAllRopsForArea(areaKey), [areaKey])
  const avaliacoesArea = getAvaliacoesByArea(areaKey)
  const progresso = getProgressoByArea(areaKey)

  const overdueRopsCount = useMemo(() => {
    return avaliacoesArea.filter((a) => {
      if (a.status === 'conforme') return false
      const deadline = getEffectiveDeadline(a, cicloAtual)
      return deadline && getDeadlineUrgency(deadline).dias < 0
    }).length
  }, [avaliacoesArea, cicloAtual])

  const Icon = areaConfig?.icon

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
            {areaConfig?.title || 'Area'}
          </h1>
          <div className="min-w-[70px]" />
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

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Area header with progress */}
        <div className="rounded-[20px] p-4 border border-border-strong bg-primary/10">
          <div className="flex items-center gap-3 mb-3">
            {Icon && (
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-primary dark:text-foreground">
                {areaConfig?.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {progresso.avaliados} de {progresso.total} ROPs avaliados
              </p>
            </div>
            <span className="text-lg font-bold text-primary">
              {progresso.percentual}%
            </span>
          </div>
          <Progress value={progresso.percentual} size="sm" />

          {/* Mini breakdown */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" />
              {progresso.conformes} conformes
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              {progresso.parciais} parciais
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              {progresso.naoConformes} NC
            </span>
          </div>
        </div>

        {/* Overdue banner */}
        {overdueRopsCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[20px] bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs font-medium text-destructive">
              {overdueRopsCount} ROP{overdueRopsCount !== 1 ? 's' : ''} com prazo vencido
            </p>
          </div>
        )}

        {/* ROPs list */}
        <div className="space-y-2">
          {rops.map(({ ropId, title }) => {
            const avaliacao = avaliacoesArea.find((a) => a.ropId === ropId)
            const status = avaliacao?.status || 'nao_avaliado'
            const avaliadoEm = avaliacao?.avaliadoEm
            const effectiveDeadline = avaliacao ? getEffectiveDeadline(avaliacao, cicloAtual) : null

            return (
              <button
                key={ropId}
                type="button"
                onClick={() =>
                  onNavigate('autoavaliacaoRop', { areaKey, ropId })
                }
                className="w-full text-left bg-card rounded-[20px] border border-border-strong p-4 hover:border-primary/20 transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* Zona 1: Titulo + Status badge + Chevron */}
                <div className="flex items-center gap-2">
                  <p className="flex-1 min-w-0 text-sm font-semibold text-foreground dark:text-white truncate">
                    {title}
                  </p>
                  <RopStatusBadge status={status} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>

                {/* Zona 2: Meta (data/pendente | prazo) */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                  <span>
                    {avaliadoEm ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        Avaliado em {new Date(avaliadoEm).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">Pendente</span>
                    )}
                  </span>
                  {status !== 'conforme' && effectiveDeadline && (
                    <DeadlineBadge prazo={effectiveDeadline} compact />
                  )}
                </div>
              </button>
            )
          })}

          {rops.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">Nenhum ROP encontrado para esta area.</p>
            </div>
          )}
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
