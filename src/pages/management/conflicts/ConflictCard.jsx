/**
 * ConflictCard — Sprint 14b / F6.3
 *
 * Render visual de uma entry da fila de conflitos.
 *
 * Estados:
 * - 'pending': mostra 4 ações (Aplicar minha versão / Manter do servidor /
 *   Resolver… / Descartar)
 * - 'resolved_*' / 'dismissed': opacity-70, esconde ações primárias, mostra
 *   "Ver histórico"
 *
 * Preview side-by-side payload vs server_state (max 5 linhas; "Ver completo"
 * expande inline). Linhas divergentes destacadas com bg-warning/10.
 */
import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  History,
} from 'lucide-react'
import { Card, CardContent, Badge } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    variant: 'warning',
    icon: Clock,
  },
  resolved_last_write_wins: {
    label: 'Aplicado (LWW)',
    variant: 'success',
    icon: CheckCircle,
  },
  resolved_manual: {
    label: 'Resolvido manual',
    variant: 'success',
    icon: CheckCircle,
  },
  dismissed: {
    label: 'Descartado',
    variant: 'secondary',
    icon: X,
  },
}

function formatRelative(dateString) {
  if (!dateString) return '-'
  const now = new Date()
  const then = new Date(dateString)
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffSec < 60) return `${diffSec}s atras`
  if (diffMin < 60) return `${diffMin}min atras`
  if (diffHour < 24) return `${diffHour}h atras`
  if (diffDay < 7) return `${diffDay}d atras`
  return then.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getInitials(name) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return parts[0].substring(0, 2).toUpperCase()
}

function truncate(str, max = 8) {
  if (!str) return ''
  return str.length > max ? `${str.substring(0, max)}…` : str
}

/**
 * Formata um objeto JSON como array de linhas legíveis (key: value).
 * Retorna array para permitir comparação de linhas com server_state.
 */
function jsonToLines(obj) {
  if (!obj || typeof obj !== 'object') return ['(vazio)']
  return Object.entries(obj).map(([k, v]) => {
    let display
    if (v === null) display = 'null'
    else if (typeof v === 'object') display = JSON.stringify(v)
    else display = String(v)
    return `${k}: ${display}`
  })
}

function DiffPreview({ payload, serverState, expanded, onToggle }) {
  const payloadLines = useMemo(() => jsonToLines(payload), [payload])
  const serverLines = useMemo(() => jsonToLines(serverState), [serverState])

  // Quais keys diferem? para destacar
  const divergent = useMemo(() => {
    const set = new Set()
    if (!serverState || !payload) return set
    const allKeys = new Set([
      ...Object.keys(payload || {}),
      ...Object.keys(serverState || {}),
    ])
    for (const k of allKeys) {
      const a = JSON.stringify(payload?.[k] ?? null)
      const b = JSON.stringify(serverState?.[k] ?? null)
      if (a !== b) set.add(k)
    }
    return set
  }, [payload, serverState])

  const MAX_LINES = 5
  const payloadVisible = expanded ? payloadLines : payloadLines.slice(0, MAX_LINES)
  const serverVisible = expanded ? serverLines : serverLines.slice(0, MAX_LINES)
  const canExpand =
    payloadLines.length > MAX_LINES || serverLines.length > MAX_LINES

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-border">
            Sua versao (payload)
          </div>
          <pre className="px-3 py-2 text-xs text-foreground font-mono whitespace-pre-wrap break-all">
            {payloadVisible.map((line, idx) => {
              const key = line.split(':')[0]
              const isDivergent = divergent.has(key)
              return (
                <div
                  key={idx}
                  className={cn(
                    'py-0.5',
                    isDivergent && 'bg-warning/10 border-l-2 border-warning pl-2 -ml-2'
                  )}
                >
                  {line}
                </div>
              )
            })}
            {!expanded && payloadLines.length > MAX_LINES && (
              <div className="text-muted-foreground text-[10px] mt-1">
                +{payloadLines.length - MAX_LINES} linha(s) ocultas
              </div>
            )}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-border">
            Versao do servidor
          </div>
          <pre className="px-3 py-2 text-xs text-foreground font-mono whitespace-pre-wrap break-all">
            {serverState ? (
              serverVisible.map((line, idx) => {
                const key = line.split(':')[0]
                const isDivergent = divergent.has(key)
                return (
                  <div
                    key={idx}
                    className={cn(
                      'py-0.5',
                      isDivergent && 'bg-warning/10 border-l-2 border-warning pl-2 -ml-2'
                    )}
                  >
                    {line}
                  </div>
                )
              })
            ) : (
              <div className="text-muted-foreground italic">
                (sem snapshot do servidor)
              </div>
            )}
            {!expanded && serverLines.length > MAX_LINES && (
              <div className="text-muted-foreground text-[10px] mt-1">
                +{serverLines.length - MAX_LINES} linha(s) ocultas
              </div>
            )}
          </pre>
        </div>
      </div>

      {canExpand && (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1 min-h-[44px] sm:min-h-0"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Ocultar
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Ver completo
            </>
          )}
        </button>
      )}
    </div>
  )
}

/**
 * @param {Object} props
 * @param {Object} props.conflict - row do supabase em camelCase
 * @param {() => void} props.onApplyMine
 * @param {() => void} props.onKeepServer
 * @param {() => void} props.onResolveOpen   - abre ResolveModal
 * @param {() => void} props.onDismiss
 * @param {() => void} [props.onViewHistory] - quando já resolvido
 */
export default function ConflictCard({
  conflict,
  onApplyMine,
  onKeepServer,
  onResolveOpen,
  onDismiss,
  onViewHistory,
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[conflict.status] || STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const isPending = conflict.status === 'pending'

  return (
    <Card className={cn(!isPending && 'opacity-70')}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={cfg.variant} className="flex items-center gap-1">
            <StatusIcon className="w-3 h-3" aria-hidden="true" />
            {cfg.label}
          </Badge>
          <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
            {conflict.opString}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelative(conflict.createdAt)}
          </span>
          <span
            className="text-[11px] text-muted-foreground font-mono"
            title={conflict.opId}
          >
            op: {truncate(conflict.opId, 10)}
          </span>
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-white dark:text-primary-foreground text-[11px] font-bold flex-shrink-0"
            aria-hidden="true"
          >
            {getInitials(conflict.userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {conflict.userName || 'Usuario desconhecido'}
            </p>
            <p
              className="text-xs text-muted-foreground font-mono truncate"
              title={conflict.userId}
            >
              uid: {truncate(conflict.userId, 12)}
            </p>
          </div>
          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        </div>

        {/* Diff preview */}
        <DiffPreview
          payload={conflict.payload}
          serverState={conflict.serverState}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />

        {/* Resolution info (if resolved) */}
        {!isPending && conflict.resolutionNotes && (
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            <span className="font-semibold">Resolucao:</span>{' '}
            {conflict.resolutionNotes}
            {conflict.resolvedBy && (
              <>
                {' '}— por{' '}
                <span className="font-mono">{truncate(conflict.resolvedBy, 12)}</span>
              </>
            )}
            {conflict.resolvedAt && (
              <> em {formatRelative(conflict.resolvedAt)}</>
            )}
          </div>
        )}

        {/* Ações */}
        {isPending ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={onApplyMine}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white dark:text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Aplicar minha versao
            </button>
            <button
              type="button"
              onClick={onKeepServer}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Manter do servidor
            </button>
            <button
              type="button"
              onClick={onResolveOpen}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Resolver…
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive flex items-center justify-center gap-1"
              aria-label="Descartar conflito"
            >
              <X className="w-3.5 h-3.5" />
              Descartar
            </button>
          </div>
        ) : (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onViewHistory}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary inline-flex items-center gap-1"
            >
              <History className="w-3.5 h-3.5" />
              Ver historico
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

