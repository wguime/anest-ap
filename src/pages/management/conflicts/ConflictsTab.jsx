/**
 * ConflictsTab — Sprint 14b / F6.3
 *
 * Painel admin para resolver entries da fila de conflitos offline
 * (documento_conflict_queue). Aparece em Centro de Gestao → "Conflitos".
 *
 * Features:
 * - Header: badge de count pendente, Atualizar, Exportar CSV
 * - Chips quick-filter: Todos / Pendentes / Resolvidos / Descartados
 * - Filtros: search (300ms debounce), opString select, dateRange
 * - Lista paginada de ConflictCard (10/pg default; 10/25/50 desktop)
 * - Real-time via subscribeToConflicts (refetch on event)
 * - Empty state
 *
 * Audit trail: changedBy = user.uid real (NUNCA 'admin'/'system'). O trigger
 * `documento_conflict_queue_audit` registra mudanças de status automaticamente
 * — não é necessário audit log adicional aqui.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  X,
  CheckCircle,
  Inbox,
} from 'lucide-react'
import { Card, CardContent, Badge, Select, useToast } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useUser } from '@/contexts/UserContext'
import {
  resolveLastWriteWins,
  resolveManual,
  dismiss,
} from '@/services/supabaseConflictQueueService'
import useConflicts from '@/hooks/useConflicts'
import { downloadConflictsCsv } from '@/utils/conflictsToCsv'
import ConflictCard from './ConflictCard'
import ResolveModal from './ResolveModal'

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos', status: null },
  { value: 'pending', label: 'Pendentes', status: 'pending' },
  { value: 'resolved', label: 'Resolvidos', status: 'resolved_manual' },
  { value: 'dismissed', label: 'Descartados', status: 'dismissed' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 por pagina' },
  { value: '25', label: '25 por pagina' },
  { value: '50', label: '50 por pagina' },
]

const OP_OPTIONS = [
  { value: '', label: 'Todas as operacoes' },
  { value: 'documento.recordAcknowledgement', label: 'documento.recordAcknowledgement' },
  { value: 'comunicado.completarAcao', label: 'comunicado.completarAcao' },
  { value: 'comunicado.desfazerAcao', label: 'comunicado.desfazerAcao' },
]

// Debounce util sem dep externa
function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// Helper inline removido — Sprint 15a / F6.3 closeout (A2.b) migrou para
// `src/utils/conflictsToCsv.js` (compartilhável + testável + BOM UTF-8 para
// Excel pt-BR + inclui colunas payload_json / server_state_json).

export default function ConflictsTab() {
  const { toast } = useToast()
  const { user } = useUser()

  // Filtros
  const [statusFilter, setStatusFilterRaw] = useState('pending')
  const [opStringFilter, setOpStringFilterRaw] = useState('')
  const [searchInput, setSearchInputRaw] = useState('')
  const search = useDebounced(searchInput, 300)
  const [dateFrom, setDateFromRaw] = useState('')
  const [dateTo, setDateToRaw] = useState('')

  // Paginação
  const [pageSize, setPageSizeRaw] = useState(10)
  const [page, setPage] = useState(0)

  // Resolve modal
  const [resolvingConflict, setResolvingConflict] = useState(null)

  // Wrappers que resetam a paginação ao mudar qualquer filtro
  // (evita setState-síncrono em useEffect; React 19 best practice)
  const setStatusFilter = useCallback((v) => {
    setStatusFilterRaw(v)
    setPage(0)
  }, [])
  const setOpStringFilter = useCallback((v) => {
    setOpStringFilterRaw(v)
    setPage(0)
  }, [])
  const setSearchInput = useCallback((v) => {
    setSearchInputRaw(v)
    setPage(0)
  }, [])
  const setDateFrom = useCallback((v) => {
    setDateFromRaw(v)
    setPage(0)
  }, [])
  const setDateTo = useCallback((v) => {
    setDateToRaw(v)
    setPage(0)
  }, [])
  const setPageSize = useCallback((v) => {
    setPageSizeRaw(v)
    setPage(0)
  }, [])

  const dateRange = useMemo(() => {
    return {
      from: dateFrom ? new Date(dateFrom) : null,
      to: dateTo ? new Date(`${dateTo}T23:59:59`) : null,
    }
  }, [dateFrom, dateTo])

  const statusEntry = STATUS_FILTERS.find((s) => s.value === statusFilter)
  const serverStatus = statusEntry ? statusEntry.status : null

  // Quando o filtro é "Resolvidos", queremos todos os resolved_* (LWW + manual).
  // Para simplicidade, vamos buscar 'resolved_manual'; se quisermos LWW também
  // precisaríamos de OR no fetch. Por ora, mostramos resolved_manual; admin pode
  // ver LWW via filtro "Todos".
  const { rows, total, loading, error, refetch } = useConflicts({
    status: serverStatus,
    opString: opStringFilter || null,
    q: search,
    dateRange,
    limit: pageSize,
    offset: page * pageSize,
  })

  // Count pendentes para badge (independente do filtro ativo)
  const { rows: pendingRows } = useConflicts({
    status: 'pending',
    limit: 100,
    offset: 0,
  })
  const pendingCount = pendingRows.length

  const userInfo = useMemo(() => {
    if (!user) return null
    return {
      uid: user.uid || user.id,
      displayName: user.displayName || user.firstName || user.email || 'Admin',
    }
  }, [user])

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const ensureUser = useCallback(() => {
    if (!userInfo?.uid) {
      toast({
        title: 'Usuario nao identificado',
        description: 'Faca login novamente para resolver conflitos.',
        variant: 'error',
      })
      return false
    }
    return true
  }, [userInfo, toast])

  const handleApplyMine = useCallback(
    async (conflict) => {
      if (!ensureUser()) return
      try {
        await resolveLastWriteWins(conflict.id, userInfo)
        toast({
          title: 'Resolvido (LWW)',
          description: 'Versao do usuario marcada como vencedora.',
          variant: 'success',
        })
        refetch()
      } catch (err) {
        toast({
          title: 'Erro ao resolver',
          description: err.message,
          variant: 'error',
        })
      }
    },
    [userInfo, toast, refetch, ensureUser]
  )

  const handleKeepServer = useCallback(
    async (conflict) => {
      if (!ensureUser()) return
      try {
        await resolveManual(
          conflict.id,
          'Manter versao do servidor (botao rapido)',
          userInfo
        )
        toast({
          title: 'Servidor mantido',
          description: 'Versao do servidor preservada; op do usuario descartada.',
          variant: 'success',
        })
        refetch()
      } catch (err) {
        toast({
          title: 'Erro ao resolver',
          description: err.message,
          variant: 'error',
        })
      }
    },
    [userInfo, toast, refetch, ensureUser]
  )

  const handleDismiss = useCallback(
    async (conflict) => {
      if (!ensureUser()) return
      const ok = window.confirm(
        'Descartar este conflito? A entry sera marcada como descartada e nao podera ser reaplicada.'
      )
      if (!ok) return
      try {
        await dismiss(conflict.id, userInfo)
        toast({
          title: 'Conflito descartado',
          variant: 'success',
        })
        refetch()
      } catch (err) {
        toast({
          title: 'Erro ao descartar',
          description: err.message,
          variant: 'error',
        })
      }
    },
    [userInfo, toast, refetch, ensureUser]
  )

  const handleResolveSubmit = useCallback(
    async (strategy, notes) => {
      if (!ensureUser() || !resolvingConflict) return
      try {
        if (strategy === 'last_write_wins') {
          // Combina LWW + nota detalhada via resolveManual com notes do admin.
          // (resolveLastWriteWins atual usa nota padrão; manter strategy fica via notes prefix)
          await resolveManual(
            resolvingConflict.id,
            `[LWW] ${notes}`,
            userInfo
          )
        } else if (strategy === 'keep_server') {
          await resolveManual(
            resolvingConflict.id,
            `[Servidor] ${notes}`,
            userInfo
          )
        } else {
          // register_only
          await resolveManual(
            resolvingConflict.id,
            `[Registro] ${notes}`,
            userInfo
          )
        }
        toast({
          title: 'Conflito resolvido',
          variant: 'success',
        })
        setResolvingConflict(null)
        refetch()
      } catch (err) {
        toast({
          title: 'Erro ao resolver',
          description: err.message,
          variant: 'error',
        })
        throw err
      }
    },
    [userInfo, toast, refetch, ensureUser, resolvingConflict]
  )

  const handleExport = useCallback(() => {
    if (!rows || rows.length === 0) {
      toast({
        title: 'Nada para exportar',
        description: 'A lista atual esta vazia.',
        variant: 'warning',
      })
      return
    }
    try {
      downloadConflictsCsv(rows)
      toast({
        title: 'CSV exportado',
        description: `${rows.length} registro(s).`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Erro ao exportar',
        description: err.message,
        variant: 'error',
      })
    }
  }, [rows, toast])

  // ============================================================================
  // RENDER
  // ============================================================================

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showPagination = total > pageSize

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Conflitos offline
            </h2>
            <p className="text-sm text-muted-foreground">
              Resolva mutations que falharam com 409 (state mismatch).
            </p>
          </div>
          <Badge
            variant={pendingCount > 0 ? 'warning' : 'success'}
            className="ml-1"
            data-testid="conflicts-pending-badge"
          >
            {pendingCount} pendente{pendingCount === 1 ? '' : 's'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Atualizar lista"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || rows.length === 0}
            data-testid="conflicts-export-csv"
            className="min-h-[44px] px-3 py-2 rounded-lg bg-primary text-white dark:text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Exportar CSV (${rows.length} registros)`}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">
              Exportar CSV ({rows.length})
            </span>
            <span className="sm:hidden">({rows.length})</span>
          </button>
        </div>
      </div>

      {/* Quick-filter chips */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro de status">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active
                  ? 'bg-primary text-white dark:text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              data-testid={`chip-${f.value}`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por usuario, op, uid…"
                className="w-full pl-9 pr-9 py-2 min-h-[44px] rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Buscar conflitos"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                  aria-label="Limpar busca"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Op string */}
            <div>
              <Select
                value={opStringFilter}
                onChange={(val) => setOpStringFilter(val)}
                options={OP_OPTIONS}
                placeholder="Operacao"
              />
            </div>

            {/* Date range */}
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 px-2 py-2 min-h-[44px] rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Data inicial"
              />
              <span className="text-xs text-muted-foreground" aria-hidden="true">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 px-2 py-2 min-h-[44px] rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Data final"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Erro ao carregar conflitos: {error.message || String(error)}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            {statusFilter === 'pending' ? (
              <>
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="text-foreground font-medium">
                  Nenhum conflito pendente.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Toda mutation offline foi sincronizada com sucesso.
                </p>
              </>
            ) : (
              <>
                <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum conflito encontrado com os filtros atuais.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* List */}
      {!loading && rows.length > 0 && (
        <div className="space-y-3" data-testid="conflicts-list">
          {rows.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onApplyMine={() => handleApplyMine(conflict)}
              onKeepServer={() => handleKeepServer(conflict)}
              onResolveOpen={() => setResolvingConflict(conflict)}
              onDismiss={() => handleDismiss(conflict)}
              onViewHistory={() => setResolvingConflict(conflict)}
            />
          ))}
        </div>
      )}

      {/* Pagination + page size */}
      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="hidden md:block">
            <Select
              value={String(pageSize)}
              onChange={(val) => setPageSize(Number(val))}
              options={PAGE_SIZE_OPTIONS}
            />
          </div>

          {showPagination && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                Pagina {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resolve modal */}
      <ResolveModal
        open={Boolean(resolvingConflict)}
        onClose={() => setResolvingConflict(null)}
        conflict={resolvingConflict}
        onSubmit={handleResolveSubmit}
      />
    </div>
  )
}
