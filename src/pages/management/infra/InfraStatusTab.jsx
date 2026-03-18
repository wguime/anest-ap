import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Progress, Alert, WidgetCard, Spinner } from '@/design-system'
import { useInfraStatus } from '@/hooks/useInfraStatus'
import { useUser } from '@/contexts/UserContext'
import { isAdministrator } from '@/design-system/components/anest/admin-only'
import { RefreshCw, Database, Server, Cloud, Wifi, WifiOff, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Display name maps
// ---------------------------------------------------------------------------

const FIRESTORE_DISPLAY_NAMES = {
  userProfiles: 'User Profiles',
  educacao_trilhas: 'Trilhas Educacao',
  educacao_cursos: 'Cursos Educacao',
  educacao_aulas: 'Aulas Educacao',
  residencia: 'Residencia',
  staff: 'Staff',
  trocas_plantao: 'Trocas de Plantao',
}

const SUPABASE_DISPLAY_NAMES = {
  documentos: 'Documentos',
  incidentes: 'Incidentes',
  comunicados: 'Comunicados',
  planos_acao: 'Planos de Acao',
  auditoria_execucoes: 'Auditorias',
  autoavaliacao_rop: 'Autoavaliacao ROPs',
  kpi_dados_mensais: 'KPI Dados Mensais',
  lgpd_solicitacoes: 'LGPD Solicitacoes',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(date) {
  if (!date) return '--:--'
  const d = date instanceof Date ? date : new Date(date)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function StatusBadge({ status }) {
  if (status === 'live') {
    return <Badge variant="success">LIVE</Badge>
  }
  if (status === 'mock') {
    return <Badge variant="warning">MOCK</Badge>
  }
  if (status === 'error') {
    return <Badge variant="destructive">ERRO</Badge>
  }
  if (status === 'checking') {
    return <Badge variant="secondary">...</Badge>
  }
  return null
}

function CollectionStatusBadge({ status }) {
  if (status === 'live') {
    return <Badge variant="success">OK</Badge>
  }
  if (status === 'error') {
    return <Badge variant="destructive">ERRO</Badge>
  }
  if (status === 'checking') {
    return <Badge variant="secondary">...</Badge>
  }
  return null
}

function TableStatusBadge({ status, isMocked }) {
  if (isMocked && status !== 'error') {
    return <Badge variant="warning">MOCK</Badge>
  }
  if (status === 'live') {
    return <Badge variant="success">LIVE</Badge>
  }
  if (status === 'error') {
    return <Badge variant="destructive">ERRO</Badge>
  }
  if (status === 'checking') {
    return <Badge variant="secondary">...</Badge>
  }
  return null
}

// ---------------------------------------------------------------------------
// InfraStatusTab
// ---------------------------------------------------------------------------

const InfraStatusTab = () => {
  const {
    isLoading,
    lastChecked,
    refresh,
    firebaseAuth,
    firestoreCollections,
    supabaseStatus,
    supabaseTables,
    syncStatus,
    summary,
  } = useInfraStatus()

  const { user } = useUser()
  const isAdmin = isAdministrator(user)

  const totalModules = syncStatus.length

  // Safety timeout — show content after 3 seconds even if probes still running
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // -------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------

  if (isLoading && !lastChecked && !timedOut) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Verificando infraestrutura..." labelPosition="bottom" />
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Infraestrutura
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ultima verificacao: {formatTime(lastChecked)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">LIVE</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="gap-1.5 border-border text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Connection status cards */}
      <div className="grid grid-cols-2 gap-3">
        <WidgetCard
          icon={<Server />}
          title="Firebase Auth"
          value={firebaseAuth.totalUsers ?? '-'}
          subtitle={firebaseAuth.connected ? 'Conectado' : 'Sem conexao'}
          variant={firebaseAuth.connected ? 'default' : 'outline'}
        />
        <WidgetCard
          icon={<Database />}
          title="Supabase"
          value={supabaseStatus.latencyMs != null ? `${supabaseStatus.latencyMs}ms` : '-'}
          subtitle={supabaseStatus.connected ? 'Conectado' : 'Sem conexao'}
          variant={supabaseStatus.connected ? 'default' : 'outline'}
        />
      </div>

      {/* Status dos Modulos */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Status dos Modulos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table header */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[360px]">
              <div className="flex items-center py-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="flex-1">Modulo</div>
                <div className="w-24 text-center">Backend</div>
                <div className="w-20 text-right">Status</div>
              </div>
              {/* Table rows */}
              <div className="divide-y divide-[#C8E6C9]/50 dark:divide-[#2A3F36]/50">
                {syncStatus.map((item, idx) => (
                  <div
                    key={item.module + '-' + idx}
                    className="flex items-center py-2.5"
                  >
                    <div className="flex-1 text-sm text-foreground">
                      {item.module}
                    </div>
                    <div className="w-24 text-center">
                      <span className="text-xs text-muted-foreground">
                        {item.backend}
                      </span>
                    </div>
                    <div className="w-20 flex justify-end">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 space-y-2">
            <Progress
              value={summary.modulesLive}
              max={totalModules}
              variant={summary.modulesLive === totalModules ? 'success' : 'default'}
              size="md"
            />
            <p className="text-xs text-muted-foreground">
              {summary.modulesLive}/{totalModules} modulos em producao
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Firestore Collections */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Firestore Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[320px]">
              <div className="divide-y divide-[#C8E6C9]/50 dark:divide-[#2A3F36]/50">
                {firestoreCollections.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="text-sm text-foreground">
                      {FIRESTORE_DISPLAY_NAMES[col.name] || col.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {col.count} docs
                      </span>
                      <CollectionStatusBadge status={col.status} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Total row */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                <span className="text-sm font-semibold text-foreground">
                  Total
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {summary.totalFirestoreRecords} registros
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supabase Tables */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Supabase Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[320px]">
              <div className="divide-y divide-[#C8E6C9]/50 dark:divide-[#2A3F36]/50">
                {supabaseTables.map((tbl) => (
                  <div
                    key={tbl.name}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="text-sm text-foreground">
                      {SUPABASE_DISPLAY_NAMES[tbl.name] || tbl.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {tbl.count} rows
                      </span>
                      <TableStatusBadge status={tbl.status} isMocked={tbl.isMocked} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Total row */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                <span className="text-sm font-semibold text-foreground">
                  Total
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {summary.totalSupabaseRecords} registros
                  {supabaseStatus.latencyMs != null
                    ? ` | Conexao: ${supabaseStatus.latencyMs}ms`
                    : ''}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  )
}

export default InfraStatusTab
