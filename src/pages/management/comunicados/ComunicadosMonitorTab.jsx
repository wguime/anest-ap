import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  Badge,
  Progress,
  DonutChart,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import {
  Megaphone,
  BookCheck,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  Clock,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react'
import {
  ROP_AREAS,
  calcularTotalDestinatarios,
  isPrazoVencido,
  formatCardDate,
} from '@/utils/comunicadosHelpers'
import { useComunicados } from '@/contexts/ComunicadosContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'

/**
 * ComunicadosMonitorTab - Painel de monitoramento de comunicados
 * para o Centro de Gestao (admin).
 *
 * 3 tabs: Visao Geral, Conformidade, Acoes Requeridas
 */
export default function ComunicadosMonitorTab() {
  const { publicados: contextPublicados, loading: comunicadosLoading } = useComunicados()
  const { users: contextUsers, loading: usersLoading } = useUsersManagement()

  const loading = comunicadosLoading || usersLoading

  const [activeTab, setActiveTab] = useState('visao-geral')
  const [expandedId, setExpandedId] = useState(null)
  const [expandedAcaoId, setExpandedAcaoId] = useState(null)
  const [filtroRop, setFiltroRop] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  // Derived data — use context data (SSOT)
  const publicados = contextPublicados

  const comLeitura = useMemo(
    () => publicados.filter((c) => c.leituraObrigatoria),
    [publicados]
  )

  const comAcoes = useMemo(
    () => publicados.filter((c) => c.acoesRequeridas?.length > 0),
    [publicados]
  )

  // KPIs
  const totalConfirmacoes = useMemo(
    () => comLeitura.reduce((acc, c) => acc + (c.confirmacoes?.length || 0), 0),
    [comLeitura]
  )

  const totalEsperado = useMemo(
    () => comLeitura.reduce((acc, c) => acc + calcularTotalDestinatarios(c, contextUsers), 0),
    [comLeitura, contextUsers]
  )

  const taxaGeral = totalEsperado > 0
    ? Math.round((totalConfirmacoes / totalEsperado) * 100)
    : 0

  const atrasados = useMemo(
    () => comLeitura.filter((c) => isPrazoVencido(c)).length,
    [comLeitura]
  )

  // ROP distribution for DonutChart
  const ropDistribution = useMemo(() => {
    const map = {}
    publicados.forEach((c) => {
      const key = c.ropArea || 'geral'
      if (!map[key]) {
        const rop = ROP_AREAS.find((r) => r.key === key) || ROP_AREAS[0]
        map[key] = { label: rop.label, value: 0, color: rop.color }
      }
      map[key].value++
    })
    return Object.values(map)
  }, [publicados])

  // Pendentes (leitura obrigatória sem 100% de confirmação)
  const pendentes = useMemo(() => {
    const source = filtroRop === 'todos'
      ? comLeitura
      : comLeitura.filter((c) => c.ropArea === filtroRop || (c.ropRelacionada && c.ropRelacionada.includes(filtroRop)))

    return source
      .map((c) => {
        const esperado = calcularTotalDestinatarios(c, contextUsers)
        const confirmados = c.confirmacoes?.length || 0
        const pct = esperado > 0 ? Math.round((confirmados / esperado) * 100) : 0
        return { ...c, esperado, confirmados, pct }
      })
      .filter((c) => c.pct < 100)
      .sort((a, b) => {
        // Atrasados primeiro, depois por % menor
        const aAtrasado = isPrazoVencido(a) ? 0 : 1
        const bAtrasado = isPrazoVencido(b) ? 0 : 1
        if (aAtrasado !== bAtrasado) return aAtrasado - bAtrasado
        return a.pct - b.pct
      })
  }, [comLeitura, contextUsers, filtroRop])

  // Filtered publicados for Visao Geral
  const filteredPublicados = useMemo(() => {
    if (filtroRop === 'todos') return publicados
    return publicados.filter((c) => c.ropArea === filtroRop || (c.ropRelacionada && c.ropRelacionada.includes(filtroRop)))
  }, [publicados, filtroRop])

  // Filtered conformidade list
  const conformidadeList = useMemo(() => {
    let list = comLeitura.map((c) => {
      const esperado = calcularTotalDestinatarios(c, contextUsers)
      const confirmados = c.confirmacoes?.length || 0
      const pct = esperado > 0 ? Math.round((confirmados / esperado) * 100) : 0
      return { ...c, esperado, confirmados, pct }
    })

    if (filtroRop !== 'todos') {
      list = list.filter((c) => c.ropArea === filtroRop || (c.ropRelacionada && c.ropRelacionada.includes(filtroRop)))
    }
    if (filtroTipo !== 'todos') {
      list = list.filter((c) => c.tipo === filtroTipo)
    }

    return list.sort((a, b) => a.pct - b.pct)
  }, [comLeitura, filtroRop, filtroTipo, contextUsers])

  // ROP compliance summary for Conformidade tab
  const ropComplianceSummary = useMemo(() => {
    // Build enriched list of all comLeitura with pct
    const enriched = comLeitura.map((c) => {
      const esperado = calcularTotalDestinatarios(c, contextUsers)
      const confirmados = c.confirmacoes?.length || 0
      const pct = esperado > 0 ? Math.round((confirmados / esperado) * 100) : 0
      return { ...c, esperado, confirmados, pct }
    })

    return ROP_AREAS.filter((rop) => rop.key !== 'geral').map((rop) => {
      // comunicados associated with this ROP (via ropArea OR ropRelacionada)
      const associated = enriched.filter(
        (c) => c.ropArea === rop.key || (c.ropRelacionada && c.ropRelacionada.includes(rop.key))
      )
      const total = associated.length
      const avgPct = total > 0
        ? Math.round(associated.reduce((sum, c) => sum + c.pct, 0) / total)
        : 0
      const pendingActions = associated.reduce((sum, c) => {
        if (!c.acoesRequeridas?.length) return sum
        const totalDestinatarios = c.esperado
        const completadas = c.acoesCompletadas || []
        const pendingCount = c.acoesRequeridas.reduce((acSum, acao) => {
          const completedForAcao = completadas.filter((ac) => ac.acaoId === acao.id).length
          return acSum + Math.max(0, totalDestinatarios - completedForAcao)
        }, 0)
        return sum + pendingCount
      }, 0)

      return {
        ...rop,
        total,
        avgPct,
        pendingActions,
      }
    }).filter((r) => r.total > 0)
  }, [comLeitura, contextUsers])

  // "Quem nao confirmou" helper — uses context users (SSOT)
  const quemNaoConfirmou = (comunicado) => {
    const activeUsers = contextUsers.filter((u) => u.active)
    const destinatarios = comunicado.destinatarios?.length
      ? activeUsers.filter((u) => comunicado.destinatarios.includes(u.role))
      : activeUsers
    const idsConfirmados = new Set(
      (comunicado.confirmacoes || []).map((c) => c.userId)
    )
    return destinatarios.filter((u) => !idsConfirmados.has(u.id))
  }

  // KPI Card helper
  const KPICard = ({ icon: Icon, label, value, color, subtitle }) => (
    <Card variant="default" className="bg-card border border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              color
            )}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-foreground leading-none">
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {label}
            </p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground/60">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const getRopLabel = (key) => {
    const rop = ROP_AREAS.find((r) => r.key === key)
    return rop?.label?.split(' – ')[0] || 'Geral'
  }

  // =============================================
  // TAB 1: Visao Geral
  // =============================================
  // Helper to get ROP color
  const getRopColor = (key) => {
    const rop = ROP_AREAS.find((r) => r.key === key)
    return rop?.color || '#6b7280'
  }

  const renderVisaoGeral = () => (
    <div className="space-y-6">
      {/* Filtro ROP */}
      <div className="flex flex-wrap gap-2">
        <div className="w-48">
          <Select
            value={filtroRop}
            onChange={(value) => setFiltroRop(value)}
            size="sm"
            options={[
              { value: 'todos', label: 'Todos os ROPs' },
              ...ROP_AREAS.map((rop) => ({
                value: rop.key,
                label: rop.label,
              })),
            ]}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          icon={Megaphone}
          label="Total Publicados"
          value={publicados.length}
          color="bg-blue-600"
        />
        <KPICard
          icon={BookCheck}
          label="Leitura Obrigatoria"
          value={comLeitura.length}
          color="bg-purple-600"
        />
        <KPICard
          icon={CheckCircle}
          label="Taxa de Confirmacao"
          value={`${taxaGeral}%`}
          color={
            taxaGeral >= 80
              ? 'bg-green-600'
              : taxaGeral >= 50
                ? 'bg-amber-500'
                : 'bg-red-500'
          }
          subtitle={`${totalConfirmacoes}/${totalEsperado} confirmacoes`}
        />
        <KPICard
          icon={AlertTriangle}
          label="Prazos Atrasados"
          value={atrasados}
          color={atrasados > 0 ? 'bg-red-500' : 'bg-green-600'}
        />
      </div>

      {/* Distribuicao por ROP */}
      <Card variant="default" className="bg-card border border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Distribuicao por ROP
          </h3>
          <div className="flex justify-center">
            <DonutChart
              data={ropDistribution}
              totalLabel="Comunicados"
              size="md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Comunicados Pendentes */}
      {pendentes.length > 0 && (
        <Card variant="default" className="bg-card border border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Comunicados Pendentes ({pendentes.length})
            </h3>
            <div className="space-y-3">
              {pendentes.map((c) => {
                const prazoVencido = isPrazoVencido(c)
                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-border bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">
                          {c.titulo}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {c.ropArea && c.ropArea !== 'geral' && (
                            <span className="text-[10px] text-primary font-medium">
                              {getRopLabel(c.ropArea)}
                            </span>
                          )}
                          {c.ropRelacionada?.length > 0 && c.ropRelacionada.map((ropKey) => (
                            <span
                              key={ropKey}
                              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: getRopColor(ropKey) }}
                            >
                              {getRopLabel(ropKey)}
                            </span>
                          ))}
                          <Badge
                            variant={c.tipo === 'Urgente' ? 'destructive' : c.tipo === 'Importante' ? 'warning' : 'default'}
                            badgeStyle="subtle"
                            className="text-[10px]"
                          >
                            {c.tipo}
                          </Badge>
                          {prazoVencido && (
                            <span className="text-[10px] text-destructive font-semibold flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Atrasado
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground shrink-0">
                        {c.pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={c.pct}
                        variant={
                          c.pct >= 80
                            ? 'success'
                            : c.pct >= 50
                              ? 'warning'
                              : 'error'
                        }
                        size="sm"
                        className="flex-1"
                      />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {c.confirmados}/{c.esperado}
                      </span>
                    </div>
                    {c.prazoConfirmacao && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Prazo: {formatCardDate(c.prazoConfirmacao)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  // =============================================
  // TAB 2: Conformidade por Comunicado
  // =============================================
  const renderConformidade = () => (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="w-48">
          <Select
            value={filtroRop}
            onChange={(value) => setFiltroRop(value)}
            size="sm"
            options={[
              { value: 'todos', label: 'Todos os ROPs' },
              ...ROP_AREAS.map((rop) => ({
                value: rop.key,
                label: rop.label,
              })),
            ]}
          />
        </div>
        <div className="w-48">
          <Select
            value={filtroTipo}
            onChange={(value) => setFiltroTipo(value)}
            size="sm"
            options={[
              { value: 'todos', label: 'Todos os tipos' },
              { value: 'Urgente', label: 'Urgente' },
              { value: 'Importante', label: 'Importante' },
              { value: 'Informativo', label: 'Informativo' },
              { value: 'Evento', label: 'Evento' },
              { value: 'Geral', label: 'Geral' },
            ]}
          />
        </div>
      </div>

      {/* Resumo de Conformidade por ROP */}
      {ropComplianceSummary.length > 0 && (
        <Card variant="default" className="bg-card border border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Conformidade por ROP
            </h3>
            <div className="space-y-3">
              {ropComplianceSummary.map((rop) => (
                <div
                  key={rop.key}
                  className="p-3 rounded-xl border border-border bg-muted/30"
                  style={{ borderLeftWidth: '4px', borderLeftColor: rop.color }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {rop.label}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {rop.total} comunicado{rop.total !== 1 ? 's' : ''}
                        </span>
                        {rop.pendingActions > 0 && (
                          <span className="text-[11px] text-warning font-medium flex items-center gap-0.5">
                            <ClipboardList className="w-3 h-3" />
                            {rop.pendingActions} {rop.pendingActions === 1 ? 'acao pendente' : 'acoes pendentes'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-lg font-bold shrink-0',
                        rop.avgPct >= 80
                          ? 'text-green-600 dark:text-green-400'
                          : rop.avgPct >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {rop.avgPct}%
                    </span>
                  </div>
                  <Progress
                    value={rop.avgPct}
                    variant={
                      rop.avgPct >= 80
                        ? 'success'
                        : rop.avgPct >= 50
                          ? 'warning'
                          : 'error'
                    }
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {conformidadeList.length === 0 ? (
        <Card variant="default" className="bg-card border border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum comunicado com leitura obrigatoria encontrado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conformidadeList.map((c) => {
            const prazoVencido = isPrazoVencido(c)
            const isExpanded = expandedId === c.id
            const naoConfirmaram = quemNaoConfirmou(c)

            return (
              <Card
                key={c.id}
                variant="default"
                className="bg-card border border-border overflow-hidden"
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">
                        {c.titulo}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {c.ropArea && c.ropArea !== 'geral' && (
                          <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            {getRopLabel(c.ropArea)}
                          </span>
                        )}
                        {c.ropRelacionada?.length > 0 && c.ropRelacionada.map((ropKey) => (
                          <span
                            key={ropKey}
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: getRopColor(ropKey) }}
                          >
                            {getRopLabel(ropKey)}
                          </span>
                        ))}
                        <Badge
                          variant={c.tipo === 'Urgente' ? 'destructive' : c.tipo === 'Importante' ? 'warning' : 'default'}
                          badgeStyle="subtle"
                          className="text-[10px]"
                        >
                          {c.tipo}
                        </Badge>
                        {c.prazoConfirmacao && (
                          <span
                            className={cn(
                              'text-[10px] flex items-center gap-0.5',
                              prazoVencido
                                ? 'text-destructive font-semibold'
                                : 'text-muted-foreground'
                            )}
                          >
                            <Clock className="w-3 h-3" />
                            Prazo: {formatCardDate(c.prazoConfirmacao)}
                            {prazoVencido && ' (vencido)'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-lg font-bold shrink-0',
                        c.pct >= 80
                          ? 'text-green-600 dark:text-green-400'
                          : c.pct >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {c.pct}%
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2 mb-2">
                    <Progress
                      value={c.pct}
                      variant={
                        c.pct >= 80
                          ? 'success'
                          : c.pct >= 50
                            ? 'warning'
                            : 'error'
                      }
                      size="md"
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {c.confirmados}/{c.esperado}
                    </span>
                  </div>

                  {/* Expandir/Colapsar */}
                  {naoConfirmaram.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : c.id)
                      }
                      className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity font-medium mt-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {isExpanded ? 'Ocultar' : `Quem nao confirmou (${naoConfirmaram.length})`}
                    </button>
                  )}

                  {/* Lista expandida */}
                  {isExpanded && naoConfirmaram.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {naoConfirmaram.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-foreground">
                            {u.nome}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full',
                              u.active
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            )}
                          >
                            {u.active ? 'Pendente' : 'Inativo'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  // =============================================
  // TAB 3: Acoes Requeridas
  // =============================================
  const renderAcoes = () => (
    <div className="space-y-3">
      {comAcoes.length === 0 ? (
        <Card variant="default" className="bg-card border border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum comunicado com acoes requeridas.
            </p>
          </CardContent>
        </Card>
      ) : (
        comAcoes.map((c) => {
          const totalDestinatarios = calcularTotalDestinatarios(c, contextUsers)
          const acoesCompletadas = c.acoesCompletadas || []
          const isExpanded = expandedAcaoId === c.id

          return (
            <Card
              key={c.id}
              variant="default"
              className="bg-card border border-border"
            >
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-3 line-clamp-1">
                  {c.titulo}
                </p>

                <div className="space-y-2.5">
                  {c.acoesRequeridas.map((acao) => {
                    const completaram = acoesCompletadas.filter(
                      (ac) => ac.acaoId === acao.id
                    )
                    const pct =
                      totalDestinatarios > 0
                        ? Math.round(
                            (completaram.length / totalDestinatarios) * 100
                          )
                        : 0

                    return (
                      <div key={acao.id}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs text-foreground flex-1 line-clamp-1">
                            {acao.texto}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {completaram.length}/{totalDestinatarios} ({pct}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          variant={
                            pct >= 80
                              ? 'success'
                              : pct >= 50
                                ? 'warning'
                                : 'error'
                          }
                          size="sm"
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Expand to see who completed */}
                <button
                  onClick={() =>
                    setExpandedAcaoId(isExpanded ? null : c.id)
                  }
                  className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity font-medium mt-3"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {isExpanded ? 'Ocultar detalhes' : 'Ver quem completou'}
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    {c.acoesRequeridas.map((acao) => {
                      const completaram = acoesCompletadas.filter(
                        (ac) => ac.acaoId === acao.id
                      )
                      if (completaram.length === 0) return null
                      return (
                        <div key={acao.id}>
                          <p className="text-xs font-semibold text-foreground mb-1.5">
                            {acao.texto}
                          </p>
                          <div className="space-y-1 pl-2">
                            {completaram.map((ac, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-foreground flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  {ac.userName}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatCardDate(ac.completedAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Monitoramento de Comunicados
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Carregando dados...</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} variant="default" className="bg-card border border-border">
              <CardContent className="p-4">
                <div className="animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          Monitoramento de Comunicados
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe conformidade, leituras e acoes de todos os comunicados publicados.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
        <TabsList className="w-full">
          <TabsTrigger value="visao-geral" className="flex-1 justify-center">
            Visao Geral
          </TabsTrigger>
          <TabsTrigger value="conformidade" className="flex-1 justify-center">
            Conformidade
          </TabsTrigger>
          <TabsTrigger value="acoes" className="flex-1 justify-center">
            Acoes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral">{renderVisaoGeral()}</TabsContent>
        <TabsContent value="conformidade">{renderConformidade()}</TabsContent>
        <TabsContent value="acoes">{renderAcoes()}</TabsContent>
      </Tabs>
    </div>
  )
}
