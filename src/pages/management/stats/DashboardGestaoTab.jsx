import { useMemo, useState, useEffect, Component } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
  Badge, Button, Progress, Alert,
  Spinner, Timeline,
} from '@/design-system'
import { SparklineChart } from '@/design-system/components/ui/sparkline-chart'
import { useActivityTracking } from '@/hooks/useActivityTracking'
import { useInfraStatus } from '@/hooks/useInfraStatus'
import {
  Zap, Clock, Globe, Eye,
  RefreshCw, AlertTriangle,
} from 'lucide-react'

// =============================================================================
// Error Boundary
// =============================================================================

class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="w-8 h-8 text-warning" />
          <p className="text-sm font-medium text-black dark:text-white">Erro ao carregar dashboard</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            {this.state.error?.message || 'Erro desconhecido'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-primary underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(seconds) {
  if (!seconds) return '0 min'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m`
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min atras`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atras`
  const days = Math.floor(hrs / 24)
  return `${days}d atras`
}

function formatOnlineDuration(onlineSince) {
  if (!onlineSince) return ''
  const diff = Date.now() - new Date(onlineSince).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatTime(date) {
  if (!date) return '--:--'
  const d = date instanceof Date ? date : new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const ROLE_BADGE_COLORS = {
  anestesiologista: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'medico-residente': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  enfermeiro: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'tec-enfermagem': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  farmaceutico: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  colaborador: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  secretaria: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

function getRoleBadgeClass(role) {
  return ROLE_BADGE_COLORS[role] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

function StatusDot({ connected }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        connected ? 'bg-green-500' : 'bg-red-500'
      }`}
    />
  )
}

function ModuleStatusBadge({ status }) {
  if (status === 'live') return <Badge variant="success" className="text-[10px] px-1.5 py-0">LIVE</Badge>
  if (status === 'mock') return <Badge variant="warning" className="text-[10px] px-1.5 py-0">MOCK</Badge>
  if (status === 'error') return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">ERRO</Badge>
  return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">...</Badge>
}

// =============================================================================
// Main Component
// =============================================================================

function DashboardGestaoTab() {
  const {
    onlineUsersCount, onlineUsersList,
    loginHistory, topPages, topDocuments, topFeatures,
    dailyActiveUsers, avgSessionDuration, peakHours,
    loginsToday, docsOpenedToday,
    isLoading: activityLoading,
  } = useActivityTracking()

  const {
    isLoading: infraLoading,
    lastChecked,
    refresh,
    firebaseAuth,
    firestoreCollections,
    supabaseStatus,
    supabaseTables,
    syncStatus,
    summary,
  } = useInfraStatus()

  // Peak hours derived data
  const peakHoursFiltered = useMemo(() => {
    if (!peakHours || peakHours.length === 0) return []
    return peakHours.filter((h) => h.count > 0)
  }, [peakHours])

  const topPeakHours = useMemo(() => {
    if (!peakHours || peakHours.length === 0) return new Set()
    const sorted = [...peakHours].sort((a, b) => b.count - a.count)
    return new Set(sorted.slice(0, 4).map((h) => h.hour))
  }, [peakHours])

  const maxPeakCount = useMemo(() => {
    if (!peakHoursFiltered.length) return 1
    return Math.max(...peakHoursFiltered.map((h) => h.count), 1)
  }, [peakHoursFiltered])

  // Timeout: show content after 3 seconds even if probes still running
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // Loading state (skip if timed out)
  if (infraLoading && !lastChecked && !timedOut) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  const totalModules = syncStatus?.length || 0

  return (
    <div className="space-y-3">

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <Badge variant="success" className="text-[10px] shrink-0">
            LIVE
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot connected={firebaseAuth.connected} />
            Firebase
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot connected={supabaseStatus.connected} />
            Supabase
            {supabaseStatus.latencyMs != null && (
              <span className="text-[10px] tabular-nums">
                {supabaseStatus.latencyMs}ms
              </span>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {formatTime(lastChecked)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={infraLoading}
          className="gap-1 text-xs border-border text-foreground h-7 px-2 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${infraLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* ── Online Users ───────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
          <CardTitle className="text-sm font-semibold text-black dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            Usuarios Online
            <Badge variant="outline" className="ml-auto text-[11px]">
              {onlineUsersCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3">
          {onlineUsersList && onlineUsersList.length > 0 ? (
            <div className="space-y-1">
              {onlineUsersList.map((user) => (
                <div key={user.userId} className="flex items-center gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-sm font-medium text-black dark:text-white truncate flex-1 min-w-0">
                    {user.name}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline-block ${getRoleBadgeClass(user.role)}`}>
                    {user.role}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {formatOnlineDuration(user.onlineSince)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhum usuario online
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Activity Summary ─────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardContent className="px-3 sm:px-4 py-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Logins Hoje */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">Logins Hoje</p>
                <p className="text-lg font-bold text-foreground leading-tight tabular-nums">{loginsToday}</p>
              </div>
            </div>
            {/* Sessao Media */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">Sessao Media</p>
                <p className="text-lg font-bold text-foreground leading-tight tabular-nums">{formatDuration(avgSessionDuration)}</p>
              </div>
            </div>
            {/* Usuarios Ativos Diarios */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground leading-tight">Usuarios Ativos (30d)</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-foreground leading-tight tabular-nums">
                    {dailyActiveUsers?.length > 0 ? dailyActiveUsers[dailyActiveUsers.length - 1]?.count : 0}
                  </p>
                  {dailyActiveUsers?.length > 0 && (
                    <div className="flex-1 min-w-[40px]">
                      <SparklineChart data={dailyActiveUsers.map((d) => d.count)} height={18} color="#006837" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Docs Abertos */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                <Eye className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">Docs Abertos Hoje</p>
                <p className="text-lg font-bold text-foreground leading-tight tabular-nums">{docsOpenedToday}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Module Status ──────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Status dos Modulos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3">
          <div className="divide-y divide-[#C8E6C9]/50 dark:divide-[#2A3F36]/50">
            {(syncStatus || []).map((item, idx) => (
              <div key={item.module + '-' + idx} className="flex items-center py-2 gap-2">
                <span className="flex-1 text-sm text-foreground truncate min-w-0">
                  {item.module}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {item.backend}
                </span>
                <div className="shrink-0">
                  <ModuleStatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <Progress
              value={summary.modulesLive}
              max={totalModules || 1}
              variant={summary.modulesLive === totalModules ? 'success' : 'default'}
              size="sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {summary.modulesLive}/{totalModules} modulos em producao
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Top Pages ──────────────────────────────────────────────── */}
      {topPages && topPages.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
            <CardTitle className="text-sm font-semibold text-black dark:text-white">
              Paginas Mais Acessadas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 space-y-1.5">
            {topPages.slice(0, 8).map((page, idx) => (
              <div key={page.page} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground w-4 text-right tabular-nums shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-black dark:text-white truncate">
                      {page.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums ml-2 shrink-0">
                      {page.views}
                    </span>
                  </div>
                  <Progress
                    value={page.views}
                    max={topPages[0]?.views || 1}
                    variant="default"
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Top Documents ──────────────────────────────────────────── */}
      {topDocuments && topDocuments.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
            <CardTitle className="text-sm font-semibold text-black dark:text-white">
              Documentos Mais Acessados
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 space-y-1.5">
            {topDocuments.slice(0, 8).map((doc, idx) => (
              <div key={doc.docId} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground w-4 text-right tabular-nums shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-black dark:text-white truncate">
                      {doc.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums ml-2 shrink-0">
                      {doc.views}
                    </span>
                  </div>
                  <Progress
                    value={doc.views}
                    max={topDocuments[0]?.views || 1}
                    variant="default"
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Top Features ───────────────────────────────────────────── */}
      {topFeatures && topFeatures.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
            <CardTitle className="text-sm font-semibold text-black dark:text-white">
              Funcionalidades Mais Usadas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 space-y-1.5">
            {topFeatures.slice(0, 8).map((feat, idx) => (
              <div key={feat.featureId} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground w-4 text-right tabular-nums shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-black dark:text-white truncate">
                      {feat.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums ml-2 shrink-0">
                      {feat.uses}
                    </span>
                  </div>
                  <Progress
                    value={feat.uses}
                    max={topFeatures[0]?.uses || 1}
                    variant="default"
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Peak Hours ─────────────────────────────────────────────── */}
      {peakHoursFiltered.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
            <CardTitle className="text-sm font-semibold text-black dark:text-white">
              Horarios de Pico
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 space-y-1">
            {peakHoursFiltered.map((h) => (
              <div key={h.hour} className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground w-9 text-right tabular-nums shrink-0">
                  {String(h.hour).padStart(2, '0')}:00
                </span>
                <div className="flex-1 h-3 bg-[#F3F4F6] dark:bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-300 ${
                      topPeakHours.has(h.hour)
                        ? 'bg-primary'
                        : 'bg-[#D1D5DB] dark:bg-[#4B5563]'
                    }`}
                    style={{ width: `${(h.count / maxPeakCount) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground w-6 text-right tabular-nums shrink-0">
                  {h.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Recent Logins ──────────────────────────────────────────── */}
      {loginHistory && loginHistory.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
            <CardTitle className="text-sm font-semibold text-black dark:text-white">
              Ultimos Logins
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <Timeline
              size="sm"
              items={loginHistory.slice(0, 8).map((login) => ({
                title: login.name,
                timestamp: formatRelativeTime(login.date),
                status: 'completed',
                description: formatDuration(login.sessionDuration),
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Database Details ───────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-1.5 px-3 sm:px-4 pt-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Dados Armazenados
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 space-y-4">
          {/* Firestore */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Firestore
            </p>
            <div className="divide-y divide-[#C8E6C9]/50 dark:divide-[#2A3F36]/50">
              {(firestoreCollections || []).map((col) => (
                <div key={col.name} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground truncate min-w-0">
                    {col.name}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums shrink-0 ml-2">
                    {col.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-1.5 mt-1 border-t border-border">
              <span className="text-xs font-semibold text-foreground">Total</span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {summary.totalFirestoreRecords}
              </span>
            </div>
          </div>

          {/* Supabase */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Supabase
              {supabaseStatus.latencyMs != null && (
                <span className="normal-case font-normal ml-2">
                  ({supabaseStatus.latencyMs}ms)
                </span>
              )}
            </p>
            <div className="divide-y divide-[#C8E6C9]/50 dark:divide-[#2A3F36]/50">
              {(supabaseTables || []).map((tbl) => (
                <div key={tbl.name} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground truncate min-w-0">
                    {tbl.name}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums shrink-0 ml-2">
                    {tbl.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-1.5 mt-1 border-t border-border">
              <span className="text-xs font-semibold text-foreground">Total</span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {summary.totalSupabaseRecords}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

function DashboardGestaoTabSafe() {
  return (
    <DashboardErrorBoundary>
      <DashboardGestaoTab />
    </DashboardErrorBoundary>
  )
}

export default DashboardGestaoTabSafe
