/**
 * AuditoriasInterativasPage - Hub principal de auditorias interativas
 */
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  BottomNav,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  Card,
  EmptyState,
  DonutChart,
  KPICard,
  SectionCard,
  Badge,
  Progress,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import {
  ChevronLeft,
  Plus,
  Clock,
  CheckCircle2,
  BarChart3,
  Layers,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
  Calendar,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { useAuditoriasInterativas } from '@/contexts/AuditoriasInterativasContext'
import { useUser } from '@/contexts/UserContext'
import { getAuditoriaTipoConfig, AUDITORIA_TIPO_CONFIG } from '@/data/auditoriasConfig'
import { EXECUCAO_STATUS } from '@/data/auditoriaTemplatesConfig'
import DeadlineBadge from '@/components/DeadlineBadge'
import AuditCard from './components/AuditCard'

export default function AuditoriasInterativasPage({ onNavigate, goBack }) {
  const { execucoes, loading, getOverdueExecucoes } = useAuditoriasInterativas()
  const { user } = useUser()
  const roleKey = (user?.role || '').toLowerCase()
  const isAdmin = !!(user?.isAdmin || user?.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador')
  const [activeTab, setActiveTab] = useState('recentes')
  const [searchTerm, setSearchTerm] = useState('')

  // Filter
  const filtered = useMemo(() => {
    if (!searchTerm) return execucoes
    const term = searchTerm.toLowerCase()
    return execucoes.filter(
      (e) =>
        e.titulo.toLowerCase().includes(term) ||
        (e.setorNome && e.setorNome.toLowerCase().includes(term)) ||
        (e.auditorNome && e.auditorNome.toLowerCase().includes(term))
    )
  }, [execucoes, searchTerm])

  const overdueCount = useMemo(() => getOverdueExecucoes().length, [getOverdueExecucoes])

  // Sorted by date, overdue-first for those with prazo
  const sortedByDate = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Non-concluded with prazo come first, sorted by prazo ascending
      const aActive = a.status !== 'concluida' && a.prazo
      const bActive = b.status !== 'concluida' && b.prazo
      if (aActive && bActive) return new Date(a.prazo) - new Date(b.prazo)
      if (aActive) return -1
      if (bActive) return 1
      return new Date(b.dataAuditoria) - new Date(a.dataAuditoria)
    })
  }, [filtered])

  // Grouped by tipo
  const groupedByTipo = useMemo(() => {
    const groups = {}
    filtered.forEach((e) => {
      if (!groups[e.templateTipo]) groups[e.templateTipo] = []
      groups[e.templateTipo].push(e)
    })
    return Object.entries(groups).sort(([a], [b]) => {
      const orderA = getAuditoriaTipoConfig(a).order || 99
      const orderB = getAuditoriaTipoConfig(b).order || 99
      return orderA - orderB
    })
  }, [filtered])

  // Stats
  const stats = useMemo(() => {
    const total = execucoes.length
    const concluidas = execucoes.filter((e) => e.status === 'concluida')
    const emAndamento = execucoes.filter((e) => e.status === 'em_andamento').length
    const scores = concluidas.map((e) => e.scoreConformidade).filter((s) => s != null)
    const mediaScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    return { total, concluidas: concluidas.length, emAndamento, mediaScore }
  }, [execucoes])

  // Active executions sorted by deadline urgency (overdue first)
  const activeExecucoes = useMemo(() => {
    return execucoes
      .filter((e) => e.status !== 'concluida')
      .sort((a, b) => {
        if (a.prazo && b.prazo) return new Date(a.prazo) - new Date(b.prazo)
        if (a.prazo) return -1
        if (b.prazo) return 1
        return new Date(b.dataAuditoria) - new Date(a.dataAuditoria)
      })
  }, [execucoes])

  // Regularity data for all 12 audit types
  const regularityData = useMemo(() => {
    const now = new Date()
    return Object.entries(AUDITORIA_TIPO_CONFIG)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([tipo, config]) => {
        const concluidas = execucoes
          .filter((e) => e.templateTipo === tipo && e.status === 'concluida' && e.concluidoEm)
          .sort((a, b) => new Date(b.concluidoEm) - new Date(a.concluidoEm))

        const ultima = concluidas[0] || null
        const ultimaDate = ultima ? new Date(ultima.concluidoEm) : null
        const diasDesdeUltima = ultimaDate
          ? Math.floor((now - ultimaDate) / (1000 * 60 * 60 * 24))
          : null
        const freq = config.frequenciaDias || 90
        const ratio = diasDesdeUltima != null ? diasDesdeUltima / freq : 999

        let regularityStatus = 'overdue'
        if (diasDesdeUltima != null && ratio < 0.8) regularityStatus = 'ok'
        else if (diasDesdeUltima != null && ratio <= 1) regularityStatus = 'warning'

        const diasRestantes = diasDesdeUltima != null ? freq - diasDesdeUltima : null

        return {
          tipo,
          config,
          ultima,
          ultimaDate,
          diasDesdeUltima,
          frequenciaDias: freq,
          ratio: Math.min(ratio, 1),
          regularityStatus,
          diasRestantes,
        }
      })
  }, [execucoes])

  const handleCardClick = (execucao) => {
    if (execucao.status === 'concluida') {
      onNavigate('auditoriaResultado', { execucaoId: execucao.id })
    } else {
      onNavigate('execucaoAuditoria', { execucaoId: execucao.id })
    }
  }

  // Dashboard data (DS: success, warning, muted)
  const dashboardChartData = useMemo(() => {
    return [
      { label: 'Concluidas', value: stats.concluidas, color: '#34C759' },
      { label: 'Em Andamento', value: stats.emAndamento, color: '#F59E0B' },
      { label: 'Rascunho', value: execucoes.filter((e) => e.status === 'rascunho').length, color: '#6B7280' },
    ].filter((d) => d.value > 0)
  }, [execucoes, stats])

  // Header
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
            Auditorias Interativas
          </h1>
          <div className="min-w-[70px] flex justify-end">
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('novaAuditoria')}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Stats - 2x2 grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-4">
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-lg font-bold text-success">{stats.concluidas}</p>
                <p className="text-[10px] text-muted-foreground -mt-0.5">Concluidas</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-lg font-bold text-warning">{stats.emAndamento}</p>
                <p className="text-[10px] text-muted-foreground -mt-0.5">Em Andamento</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary-hover dark:text-primary" />
              </div>
              <div>
                <p className={cn('text-lg font-bold', stats.mediaScore >= 80 ? 'text-success' : stats.mediaScore >= 60 ? 'text-warning' : 'text-destructive')}>
                  {stats.mediaScore}%
                </p>
                <p className="text-[10px] text-muted-foreground -mt-0.5">Media Score</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                overdueCount > 0 ? 'bg-destructive/10' : 'bg-muted'
              )}>
                <AlertTriangle className={cn('w-4 h-4', overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className={cn('text-lg font-bold', overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {overdueCount}
                </p>
                <p className="text-[10px] text-muted-foreground -mt-0.5">Vencidas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="recentes" icon={<Clock className="w-4 h-4" />}>
              Recentes
            </TabsTrigger>
            <TabsTrigger value="porTipo" icon={<Layers className="w-4 h-4" />}>
              Por Tipo
            </TabsTrigger>
            <TabsTrigger value="dashboard" icon={<BarChart3 className="w-4 h-4" />}>
              Dashboard
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="mb-4">
            <Input
              variant="search"
              placeholder="Buscar auditorias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <TabsContent value="recentes">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : sortedByDate.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck className="h-full w-full" />}
                title="Nenhuma auditoria encontrada"
                description={searchTerm ? 'Tente ajustar a busca.' : 'Crie sua primeira auditoria interativa.'}
                action={!searchTerm && isAdmin ? { label: 'Nova Auditoria', onClick: () => onNavigate('novaAuditoria') } : undefined}
              />
            ) : (
              <div className="space-y-3">
                {sortedByDate.map((exec) => (
                  <AuditCard key={exec.id} execucao={exec} onClick={() => handleCardClick(exec)} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="porTipo">
            {groupedByTipo.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck className="h-full w-full" />}
                title="Nenhuma auditoria encontrada"
                description="Nenhum resultado para os filtros atuais."
              />
            ) : (
              <div className="space-y-5">
                {groupedByTipo.map(([tipo, execs]) => {
                  const config = getAuditoriaTipoConfig(tipo)
                  const TipoIcon = config.icon
                  return (
                    <div key={tipo}>
                      <div className="flex items-center gap-2 mb-2">
                        <TipoIcon className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-primary dark:text-foreground">
                          {config.label}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          ({execs.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {execs.map((exec) => (
                          <AuditCard key={exec.id} execucao={exec} onClick={() => handleCardClick(exec)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dashboard">
            <div className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-5">
                <h3 className="text-sm font-semibold text-primary dark:text-foreground mb-4 text-center">
                  Auditorias por Status
                </h3>
                <div className="flex justify-center">
                  <DonutChart
                    data={dashboardChartData}
                    totalLabel="Total"
                    size="md"
                  />
                </div>
              </div>

              <div className="bg-card rounded-[20px] border border-border-strong shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none p-5">
                <h3 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
                  Media de Conformidade
                </h3>
                <div className="text-center">
                  <p className={cn(
                    'text-3xl font-bold',
                    stats.mediaScore >= 80 ? 'text-success' : stats.mediaScore >= 60 ? 'text-warning' : 'text-destructive'
                  )}>
                    {stats.mediaScore}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Baseado em {stats.concluidas} auditoria{stats.concluidas !== 1 ? 's' : ''} concluida{stats.concluidas !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Proximas Auditorias */}
              <SectionCard
                subtitle="AGENDA"
                title="Proximas Auditorias"
                badge={activeExecucoes.length > 0 ? { text: `${activeExecucoes.length}`, variant: 'warning' } : undefined}
              >
                {activeExecucoes.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Calendar className="w-10 h-10 text-muted-foreground mb-2" />
                    <p className="text-[13px] font-medium text-muted-foreground">
                      Nenhuma auditoria pendente
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Todas as auditorias estao em dia
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeExecucoes.map((exec) => {
                      const tipoConfig = getAuditoriaTipoConfig(exec.templateTipo)
                      const TipoIcon = tipoConfig.icon
                      const statusCfg = EXECUCAO_STATUS[exec.status] || EXECUCAO_STATUS.rascunho

                      return (
                        <button
                          key={exec.id}
                          type="button"
                          onClick={() => onNavigate('execucaoAuditoria', { execucaoId: exec.id })}
                          className={cn(
                            'w-full text-left py-2.5 px-3 rounded-[16px] bg-card transition-all active:scale-[0.98] touch-manipulation',
                            'border border-border-strong min-h-[44px]',
                            'hover:border-primary/20 hover:shadow-sm'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                              <TipoIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] sm:text-sm font-semibold text-foreground leading-snug truncate">
                                {exec.titulo}
                              </p>
                              <div className="flex flex-col gap-0.5 mt-1">
                                <Badge
                                  variant={exec.status === 'em_andamento' ? 'warning' : 'secondary'}
                                  badgeStyle="subtle"
                                  className="text-[10px] sm:text-[9px] w-fit"
                                >
                                  {statusCfg.label}
                                </Badge>
                                <div className="flex items-center justify-between gap-2">
                                  {exec.setorNome ? (
                                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground truncate min-w-0">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      {exec.setorNome}
                                    </span>
                                  ) : (
                                    <span />
                                  )}
                                  <span className="shrink-0">
                                    <DeadlineBadge prazo={exec.prazo} compact showDays />
                                  </span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </SectionCard>

              {/* Regularidade por Tipo */}
              <SectionCard
                subtitle="CONFORMIDADE"
                title="Regularidade por Tipo"
              >
                <div className="space-y-1.5">
                  {regularityData.map(({ tipo, config, ultimaDate, regularityStatus, diasRestantes, ratio, frequenciaDias }) => {
                    const TipoIcon = config.icon
                    const freqLabel = frequenciaDias <= 30 ? 'Mensal' : frequenciaDias <= 90 ? 'Trimestral' : 'Semestral'

                    const Wrapper = isAdmin ? 'button' : 'div'
                    const wrapperProps = isAdmin
                      ? { type: 'button', onClick: () => onNavigate('novaAuditoria', { tipoPreSelecionado: tipo }) }
                      : {}

                    return (
                      <Wrapper
                        key={tipo}
                        {...wrapperProps}
                        className={cn(
                          'w-full text-left py-2.5 px-3 rounded-[16px] bg-card transition-all min-h-[44px]',
                          'border border-border-strong',
                          isAdmin && 'active:scale-[0.98] touch-manipulation hover:border-primary/20 hover:shadow-sm'
                        )}
                      >
                        {/* Zona 1: Icon + Label + Nova + Chevron */}
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                            <TipoIcon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] sm:text-sm font-semibold text-foreground truncate">
                              {config.label}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAdmin && regularityStatus !== 'ok' && (
                              <span className="flex items-center gap-0.5 text-[10px] sm:text-[9px] font-semibold text-primary-hover dark:text-primary">
                                <Plus className="w-3 h-3" />
                                Nova
                              </span>
                            )}
                            {isAdmin && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Zona 2: Badges (frequencia + status) */}
                        <div className="flex items-center justify-between gap-2 mt-1.5 ml-[40px]">
                          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] sm:text-[9px] shrink-0">
                            {freqLabel}
                          </Badge>
                          <Badge
                            variant={regularityStatus === 'ok' ? 'success' : regularityStatus === 'warning' ? 'warning' : 'destructive'}
                            badgeStyle="subtle"
                            className="text-[10px] sm:text-[9px] shrink-0"
                          >
                            {regularityStatus === 'ok' ? 'Em dia' : regularityStatus === 'warning' ? 'Atencao' : 'Vencida'}
                          </Badge>
                        </div>

                        {/* Zona 3: Local à esquerda | dias restantes à direita */}
                        <div className="flex justify-between items-center mt-1.5 pt-1.5 ml-[40px] border-t border-border/60">
                          <span className="text-xs text-muted-foreground min-w-0 truncate">
                            {ultimaDate
                              ? `Última: ${ultimaDate.toLocaleDateString('pt-BR')}`
                              : 'Nunca realizada'}
                          </span>
                          <span className={cn(
                            'text-xs font-semibold tabular-nums shrink-0',
                            regularityStatus === 'ok' ? 'text-success'
                              : regularityStatus === 'warning' ? 'text-warning'
                              : 'text-destructive'
                          )}>
                            {diasRestantes != null
                              ? diasRestantes > 0
                                ? `${diasRestantes}d restantes`
                                : `${Math.abs(diasRestantes)}d vencida`
                              : `A cada ${frequenciaDias}d`}
                          </span>
                        </div>
                      </Wrapper>
                    )
                  })}
                </div>
              </SectionCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground"
                fill="none"
              />
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
