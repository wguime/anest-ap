import { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, SearchBar, Spinner, EmptyState } from '@/design-system'
import {
  BookOpen, Users, TrendingUp, AlertTriangle, CheckCircle,
  Clock, XCircle, ChevronDown, GraduationCap, Search, ChevronRight,
} from 'lucide-react'

/**
 * EducacaoTab - Dashboard administrativo de Educacao Continuada
 *
 * 3 abas: Visao Geral | Treinamento | Usuario
 * Drill-down com desempenho individual por curso e por colaborador.
 */
function EducacaoTab({
  totalUsuarios = 0,
  totalCursos = 0,
  taxaConclusao = 0,
  taxaConformidade = 0,
  totalAtrasados = 0,
  totalConcluidos = 0,
  totalAssignments = 0,
  totalEmAndamento = 0,
  progressoPorTipo = [],
  topCursos = [],
  statusDistribution = {},
  cursosCompliance = [],
  colaboradoresAgrupados = {},
  loading = false,
  error = null,
}) {
  // Tab state
  const [activeTab, setActiveTab] = useState('visaoGeral')
  const [searchTreinamento, setSearchTreinamento] = useState('')
  const [searchUsuario, setSearchUsuario] = useState('')
  const [expandedCursos, setExpandedCursos] = useState(new Set())
  const [selectedCargo, setSelectedCargo] = useState(null)
  const [expandedUsers, setExpandedUsers] = useState(new Set())

  // Filtered data for "Treinamento" tab
  const cursosFiltrados = useMemo(() => {
    if (!searchTreinamento.trim()) return cursosCompliance
    const q = searchTreinamento.toLowerCase()
    return cursosCompliance.filter((curso) => {
      if ((curso.titulo || '').toLowerCase().includes(q)) return true
      return (curso.usersWithStatus || []).some(
        (u) => (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q),
      )
    })
  }, [cursosCompliance, searchTreinamento])

  // Users for selected cargo in "Usuario" tab
  const usuariosDoCargoFiltrados = useMemo(() => {
    if (!selectedCargo || !colaboradoresAgrupados[selectedCargo]) return []
    const users = colaboradoresAgrupados[selectedCargo].usuarios || []
    if (!searchUsuario.trim()) return users
    const q = searchUsuario.toLowerCase()
    return users.filter(
      (u) => (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q),
    )
  }, [colaboradoresAgrupados, selectedCargo, searchUsuario])

  // Toggle helpers
  const toggleCurso = (id) => {
    setExpandedCursos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleUser = (id) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  // Empty state
  if (totalCursos === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <EmptyState
          icon={<BookOpen className="w-16 h-16" />}
          title="Nenhum treinamento cadastrado no sistema"
          description="Acesse o modulo de Educacao Continuada para criar cursos e trilhas."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Header />

      {/* Tabs — above KPI cards */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedCargo(null) }}>
        <TabsList className="w-full grid grid-cols-3 bg-muted rounded-lg p-1">
          <TabsTrigger value="visaoGeral" className="text-xs">Visao Geral</TabsTrigger>
          <TabsTrigger value="treinamento" className="text-xs">Treinamento</TabsTrigger>
          <TabsTrigger value="usuario" className="text-xs">Usuario</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB: Visao Geral                                             */}
        {/* ============================================================ */}
        <TabsContent value="visaoGeral" className="space-y-4 mt-4">
          {/* KPI Row — only in Visao Geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={<BookOpen className="w-5 h-5 text-primary" />}
              value={totalCursos}
              label="Treinamentos"
              bgClass="bg-success/10"
            />
            <KpiCard
              icon={<Users className="w-5 h-5 text-primary" />}
              value={totalUsuarios}
              label="Usuarios"
              bgClass="bg-success/10"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-primary" />}
              value={`${taxaConclusao}%`}
              label="Taxa Conclusao"
              bgClass="bg-success/10"
            />
            <KpiCard
              icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
              value={totalAtrasados}
              label="Atrasados"
              bgClass="bg-destructive/10"
            />
          </div>

          {/* Conformidade Geral */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Conformidade Geral</p>
                <p className="text-sm font-bold text-primary">{taxaConformidade}%</p>
              </div>
              <div className="w-full h-3 rounded-full bg-success/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${taxaConformidade}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {totalConcluidos}/{totalAssignments} atribuicoes concluidas
              </p>
            </CardContent>
          </Card>

          {/* Progresso por Tipo de Usuario */}
          {progressoPorTipo.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  Progresso por Tipo de Usuario
                </p>
                <div className="space-y-3">
                  {progressoPorTipo.map((item) => (
                    <div key={item.tipo} className="flex items-center gap-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-medium text-white shrink-0 dark:opacity-90"
                        style={{ backgroundColor: item.cor, minWidth: 90, textAlign: 'center' }}
                      >
                        {item.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-success/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.progressoMedio}%`, backgroundColor: item.cor }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-10 text-right">
                        {item.progressoMedio}%
                      </span>
                      <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">
                        {item.concluidos} concl.
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Cursos */}
          {topCursos.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  Top Cursos por Completude
                </p>
                <div className="space-y-3">
                  {topCursos.map((curso, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs flex-1 truncate text-foreground">
                        {curso.titulo}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {curso.concluidos}/{curso.total}
                      </span>
                      <div className="w-20 h-2 rounded-full bg-success/10 overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${curso.taxaCompletude}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-10 text-right shrink-0">
                        {curso.taxaCompletude}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribuicao de Status */}
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                Distribuicao de Status
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatusCard
                  icon={<XCircle className="w-4 h-4 text-muted-foreground" />}
                  value={statusDistribution.nao_iniciado || 0}
                  label="Nao Iniciado"
                  colorClass="text-muted-foreground"
                />
                <StatusCard
                  icon={<Clock className="w-4 h-4 text-warning" />}
                  value={statusDistribution.em_andamento || 0}
                  label="Em Andamento"
                  colorClass="text-warning"
                />
                <StatusCard
                  icon={<CheckCircle className="w-4 h-4 text-success" />}
                  value={statusDistribution.concluido || 0}
                  label="Concluido"
                  colorClass="text-success"
                />
                <StatusCard
                  icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
                  value={statusDistribution.atrasado || 0}
                  label="Atrasado"
                  colorClass="text-destructive"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: Treinamento                                             */}
        {/* ============================================================ */}
        <TabsContent value="treinamento" className="space-y-3 mt-4">
          <SearchBar
            placeholder="Buscar curso ou colaborador..."
            value={searchTreinamento}
            onChange={setSearchTreinamento}
          />

          {cursosFiltrados.length === 0 ? (
            <EmptySearchState />
          ) : (
            cursosFiltrados.map((curso) => {
              const isExpanded = expandedCursos.has(curso.id)
              const taxaCompletude = curso.total > 0 ? Math.round((curso.concluidos / curso.total) * 100) : 0
              const users = [...(curso.usersWithStatus || [])].sort((a, b) =>
                (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
              )

              return (
                <Card key={curso.id} className="border-border overflow-hidden">
                  {/* Curso header (clickable) */}
                  <button
                    type="button"
                    onClick={() => toggleCurso(curso.id)}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                  >
                    <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {curso.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-success/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${taxaCompletude}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {curso.concluidos}/{curso.total}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={curso.conforme ? 'concluido' : 'pendente'} />
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded: user list */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30">
                      {users.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-4 text-center">
                          Nenhum usuario atribuido
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {users.map((user) => (
                            <UserProgressRow key={user.id} user={user} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: Usuario                                                 */}
        {/* ============================================================ */}
        <TabsContent value="usuario" className="space-y-3 mt-4">
          {!selectedCargo ? (
            /* Cargo selector grid */
            <>
              <p className="text-sm font-medium text-muted-foreground">
                Selecione um cargo para ver os colaboradores
              </p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(colaboradoresAgrupados).map(([tipo, grupo]) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setSelectedCargo(tipo)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 dark:opacity-90"
                      style={{ backgroundColor: grupo.cor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {grupo.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grupo.usuarios.length} {grupo.usuarios.length === 1 ? 'colaborador' : 'colaboradores'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* User list for selected cargo */
            <>
              {/* Back button + cargo header */}
              <button
                type="button"
                onClick={() => { setSelectedCargo(null); setSearchUsuario(''); setExpandedUsers(new Set()) }}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
                Voltar aos cargos
              </button>

              <div className="flex items-center gap-3">
                <span
                  className="inline-block px-3 py-1 rounded-md text-sm font-medium text-white dark:opacity-90"
                  style={{ backgroundColor: colaboradoresAgrupados[selectedCargo]?.cor || '#666' }}
                >
                  {colaboradoresAgrupados[selectedCargo]?.label || selectedCargo}
                </span>
                <span className="text-sm text-muted-foreground">
                  {usuariosDoCargoFiltrados.length} {usuariosDoCargoFiltrados.length === 1 ? 'colaborador' : 'colaboradores'}
                </span>
              </div>

              <SearchBar
                placeholder="Buscar por nome ou email..."
                value={searchUsuario}
                onChange={setSearchUsuario}
              />

              {usuariosDoCargoFiltrados.length === 0 ? (
                <EmptySearchState />
              ) : (
                <Card className="border-border overflow-hidden">
                  <div className="divide-y divide-border">
                    {usuariosDoCargoFiltrados.map((user) => {
                      const isUserExpanded = expandedUsers.has(user.id)
                      return (
                        <div key={user.id}>
                          {/* User row */}
                          <button
                            type="button"
                            onClick={() => toggleUser(user.id)}
                            className="w-full text-left px-4 py-3 space-y-1.5 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <UserAvatar name={user.nome} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground break-words">
                                  {user.nome}
                                </p>
                                <p className="text-xs text-muted-foreground break-all">
                                  {user.email}
                                </p>
                              </div>
                              <ChevronDown
                                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                                  isUserExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                            <div className="flex items-center gap-2 ml-11">
                              <div className="flex-1 h-1.5 rounded-full bg-success/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-500"
                                  style={{ width: `${user.progressoMedio}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-foreground shrink-0">
                                {user.progressoMedio}%
                              </span>
                              <StatusBadge status={user.status} small />
                            </div>
                          </button>

                          {/* User's courses (nested drill-down) */}
                          {isUserExpanded && (user.cursosInfo || []).length > 0 && (
                            <div className="px-4 pb-3 space-y-1.5">
                              {/* Progress bar summary */}
                              <div className="flex items-center gap-2 ml-11 mb-2">
                                <div className="flex-1 h-1.5 rounded-full bg-success/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${user.progressoMedio}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {user.cursosConc}/{user.totalCursos} cursos
                                </span>
                              </div>
                              {user.cursosInfo.map((curso) => (
                                <div
                                  key={curso.id}
                                  className="flex items-center gap-2 py-2 px-3 ml-11 rounded-lg bg-muted/50"
                                >
                                  <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="text-xs text-foreground flex-1 min-w-0">
                                    {curso.titulo}
                                  </span>
                                  <div className="w-12 h-1 rounded-full bg-success/10 overflow-hidden shrink-0">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all duration-500"
                                      style={{ width: `${curso.progresso}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-medium text-foreground w-8 text-right shrink-0">
                                    {curso.progresso}%
                                  </span>
                                  <StatusBadge status={curso.status} small />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
        <BookOpen className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Educacao Continuada
        </h2>
        <p className="text-xs text-muted-foreground">
          Visao geral de educacao continuada da equipe
        </p>
      </div>
    </div>
  )
}

function KpiCard({ icon, value, label, bgClass }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 text-center">
        <div className={`w-9 h-9 mx-auto mb-1.5 rounded-lg ${bgClass} flex items-center justify-center`}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function StatusCard({ icon, value, label, colorClass }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
      {icon}
      <div>
        <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

const STATUS_CONFIG = {
  concluido: { label: 'Concluido', variant: 'success', icon: CheckCircle },
  em_andamento: { label: 'Em andamento', variant: 'warning', icon: Clock },
  atrasado: { label: 'Atrasado', variant: 'destructive', icon: AlertTriangle },
  nao_iniciado: { label: 'Nao iniciado', variant: 'secondary', icon: XCircle },
  pendente: { label: 'Pendente', variant: 'warning', icon: Clock },
}

function StatusBadge({ status, small = false }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.nao_iniciado
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className={small ? 'text-[8px] px-1.5 py-0 gap-0.5 shrink-0' : 'text-[10px] px-2 py-0.5 gap-1 shrink-0'}>
      <Icon className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cfg.label}
    </Badge>
  )
}

function UserAvatar({ name }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-primary">{initials}</span>
    </div>
  )
}

function UserProgressRow({ user }) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
        <UserAvatar name={user.nome} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground break-words">
            {user.nome}
          </p>
          <p className="text-xs text-muted-foreground break-all">
            {user.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-11">
        <div className="flex-1 h-1.5 rounded-full bg-success/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${user.progresso}%` }}
          />
        </div>
        <span className="text-xs font-medium text-foreground shrink-0">
          {user.progresso}%
        </span>
        <StatusBadge status={user.status} small />
      </div>
    </div>
  )
}

function EmptySearchState() {
  return (
    <EmptyState
      icon={<Search className="w-16 h-16" />}
      title="Nenhum resultado encontrado"
      description="Tente buscar com outros termos"
      size="sm"
    />
  )
}

export default EducacaoTab
