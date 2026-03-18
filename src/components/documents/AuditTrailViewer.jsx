/**
 * AuditTrailViewer Component
 *
 * Displays an audit trail timeline for document changelogs.
 * Can show changelog for a specific document or all recent activity (admin view).
 *
 * @module components/documents/AuditTrailViewer
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, Badge, Button } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import supabaseDocumentService from '@/services/supabaseDocumentService'
import {
  Loader2,
  Plus,
  CheckCircle,
  XCircle,
  FileText,
  Edit3,
  RefreshCw,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  BookOpen,
  Send,
  Filter,
  Clock,
  History,
} from 'lucide-react'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Action type labels (pt-BR)
 */
const ACTION_LABELS = {
  created: 'Documento criado',
  status_changed: 'Status alterado',
  updated: 'Documento atualizado',
  version_added: 'Nova versao adicionada',
  approved: 'Documento aprovado',
  rejected: 'Documento rejeitado',
  archived: 'Documento arquivado',
  restored: 'Documento restaurado',
  deleted: 'Documento excluido',
  viewed: 'Documento visualizado',
  acknowledged: 'Leitura reconhecida',
  distributed: 'Documento distribuido',
}

/**
 * Action type color configuration
 * Each action maps to a color variant with icon bg, dot, and text styles
 */
const ACTION_COLORS = {
  created: {
    dot: 'bg-primary',
    iconBg: 'bg-muted',
    iconColor: 'text-primary',
    badge: 'bg-muted text-primary dark:bg-muted dark:text-primary',
  },
  approved: {
    dot: 'bg-primary',
    iconBg: 'bg-muted',
    iconColor: 'text-primary',
    badge: 'bg-muted text-primary dark:bg-muted dark:text-primary',
  },
  rejected: {
    dot: 'bg-red-500 dark:bg-red-400',
    iconBg: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  },
  deleted: {
    dot: 'bg-red-500 dark:bg-red-400',
    iconBg: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  },
  updated: {
    dot: 'bg-blue-500 dark:bg-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  },
  version_added: {
    dot: 'bg-blue-500 dark:bg-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  },
  status_changed: {
    dot: 'bg-amber-500 dark:bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  },
  archived: {
    dot: 'bg-gray-500 dark:bg-gray-400',
    iconBg: 'bg-gray-100 dark:bg-gray-800/30',
    iconColor: 'text-gray-600 dark:text-gray-400',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
  },
  restored: {
    dot: 'bg-primary',
    iconBg: 'bg-muted',
    iconColor: 'text-primary',
    badge: 'bg-muted text-primary dark:bg-muted dark:text-primary',
  },
  viewed: {
    dot: 'bg-gray-400 dark:bg-gray-500',
    iconBg: 'bg-gray-100 dark:bg-gray-800/30',
    iconColor: 'text-gray-500 dark:text-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  },
  acknowledged: {
    dot: 'bg-primary',
    iconBg: 'bg-muted',
    iconColor: 'text-primary',
    badge: 'bg-muted text-primary dark:bg-muted dark:text-primary',
  },
  distributed: {
    dot: 'bg-blue-500 dark:bg-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  },
}

/**
 * Default color config for unknown action types
 */
const DEFAULT_COLOR = {
  dot: 'bg-gray-400 dark:bg-gray-500',
  iconBg: 'bg-gray-100 dark:bg-gray-800/30',
  iconColor: 'text-gray-500 dark:text-gray-400',
  badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
}

/**
 * Action type icon mapping
 */
const ACTION_ICONS = {
  created: Plus,
  status_changed: RefreshCw,
  updated: Edit3,
  version_added: FileText,
  approved: CheckCircle,
  rejected: XCircle,
  archived: Archive,
  restored: RotateCcw,
  deleted: Trash2,
  viewed: Eye,
  acknowledged: BookOpen,
  distributed: Send,
}

/**
 * Pagination step size
 */
const PAGE_SIZE = 50

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format a timestamp to "dd/mm/yyyy HH:mm"
 */
function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

/**
 * Format a timestamp to relative time in Portuguese
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return ''

  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now - date
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Agora mesmo'
  if (diffMinutes < 60) return `${diffMinutes} min atras`
  if (diffHours < 24) return `${diffHours}h atras`
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atras`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atras`
  return formatDateTime(timestamp)
}

/**
 * Format date only (for group headers)
 */
function formatDateOnly(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Get the date key (YYYY-MM-DD) from a timestamp for grouping
 */
function getDateKey(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Loading spinner
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full border-4',
            'border-border border-t-[#006837]',
            'dark:border-border dark:border-t-[#2ECC71]',
            'animate-spin'
          )}
        />
        <p className="text-sm text-muted-foreground">
          Carregando historico de alteracoes...
        </p>
      </div>
    </div>
  )
}

/**
 * Empty state when no entries are found
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className={cn(
          'w-20 h-20 rounded-2xl flex items-center justify-center mb-6',
          'bg-muted'
        )}
      >
        <History className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Nenhuma atividade registrada
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        O historico de alteracoes aparecera aqui quando houver atividade nos documentos.
      </p>
    </div>
  )
}

/**
 * Individual timeline entry
 */
function TimelineEntry({ entry, isLast }) {
  const actionLabel = ACTION_LABELS[entry.action] || entry.action || 'Acao desconhecida'
  const colors = ACTION_COLORS[entry.action] || DEFAULT_COLOR
  const IconComponent = ACTION_ICONS[entry.action] || FileText
  const relativeTime = formatRelativeTime(entry.createdAt)
  const fullDateTime = formatDateTime(entry.createdAt)

  return (
    <div className="flex gap-3 sm:gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            'w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            colors.iconBg
          )}
        >
          <IconComponent className={cn('w-4 h-4 sm:w-5 sm:h-5', colors.iconColor)} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px] bg-[#C8E6C9] dark:bg-muted mt-2" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0 pb-5', isLast && 'pb-0')}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
          <div className="min-w-0 flex-1">
            {/* Action label */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {actionLabel}
              </span>
              <Badge
                className={cn(
                  'text-[10px] px-1.5 py-0 font-medium border-0',
                  colors.badge
                )}
              >
                {entry.action}
              </Badge>
            </div>

            {/* User */}
            {entry.userName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                por {entry.userName}
                {entry.userEmail && (
                  <span className="hidden sm:inline"> ({entry.userEmail})</span>
                )}
              </p>
            )}

            {/* Comment */}
            {entry.comment && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                &quot;{entry.comment}&quot;
              </p>
            )}

            {/* Changes details */}
            {entry.changes && typeof entry.changes === 'object' && Object.keys(entry.changes).length > 0 && (
              <div
                className={cn(
                  'mt-2 px-3 py-2 rounded-lg text-xs',
                  'bg-gray-50 dark:bg-[#0D1512]',
                  'border border-border/50 dark:border-border/50',
                  'text-muted-foreground'
                )}
              >
                {Object.entries(entry.changes).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium">{key}:</span>
                    <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex-shrink-0 text-right">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {relativeTime}
            </span>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">
              {fullDateTime}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Filter bar with action type and date range controls
 */
function FilterBar({ actionFilter, dateFrom, dateTo, onActionChange, onDateFromChange, onDateToChange }) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row gap-3 p-4 rounded-xl',
        'bg-card',
        'border border-border'
      )}
    >
      {/* Action type filter */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <select
          value={actionFilter}
          onChange={(e) => onActionChange(e.target.value)}
          className={cn(
            'flex-1 min-w-0 px-3 py-2 rounded-xl text-sm',
            'bg-background',
            'border border-border',
            'text-gray-900 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50',
            'transition-all duration-200'
          )}
        >
          <option value="all">Todas as acoes</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Date range filters */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          placeholder="De"
          className={cn(
            'w-[130px] px-2.5 py-2 rounded-xl text-sm',
            'bg-background',
            'border border-border',
            'text-gray-900 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50',
            'transition-all duration-200'
          )}
        />
        <span className="text-xs text-muted-foreground">ate</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          placeholder="Ate"
          className={cn(
            'w-[130px] px-2.5 py-2 rounded-xl text-sm',
            'bg-background',
            'border border-border',
            'text-gray-900 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50',
            'transition-all duration-200'
          )}
        />
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AuditTrailViewer - Displays document changelog as a vertical timeline
 *
 * @param {string|null} documentoId - Document ID for single-document view, null for all activity
 * @param {boolean} isAdmin - Whether the current user is an admin (affects data source)
 */
function AuditTrailViewer({ documentoId = null, isAdmin = false, searchFilter = '' }) {
  // State
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [currentLimit, setCurrentLimit] = useState(PAGE_SIZE)
  const [hasMore, setHasMore] = useState(true)

  // Filters
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchData = useCallback(
    async (limit) => {
      try {
        let data
        if (documentoId) {
          data = await supabaseDocumentService.fetchChangelog(documentoId, limit, isAdmin)
        } else {
          data = await supabaseDocumentService.fetchRecentActivity(limit)
        }
        return data || []
      } catch (error) {
        console.error('[AuditTrailViewer] Error fetching changelog:', error)
        return []
      }
    },
    [documentoId, isAdmin]
  )

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const data = await fetchData(PAGE_SIZE)
      if (!cancelled) {
        setEntries(data)
        setHasMore(data.length >= PAGE_SIZE)
        setCurrentLimit(PAGE_SIZE)
        setIsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetchData])

  // Load more handler
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true)
    const newLimit = currentLimit + PAGE_SIZE
    const data = await fetchData(newLimit)
    setEntries(data)
    setHasMore(data.length >= newLimit)
    setCurrentLimit(newLimit)
    setIsLoadingMore(false)
  }, [currentLimit, fetchData])

  // ------------------------------------------------------------------
  // Client-side filtering
  // ------------------------------------------------------------------

  const filteredEntries = useMemo(() => {
    let result = entries

    // Filter by search text (document title, code, user name, or action)
    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      result = result.filter((entry) =>
        entry.documentTitle?.toLowerCase().includes(q) ||
        entry.documentCode?.toLowerCase().includes(q) ||
        entry.userName?.toLowerCase().includes(q) ||
        entry.action?.toLowerCase().includes(q)
      )
    }

    // Filter by action type
    if (actionFilter !== 'all') {
      result = result.filter((entry) => entry.action === actionFilter)
    }

    // Filter by date range
    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter((entry) => {
        const entryDate = new Date(entry.createdAt)
        return entryDate >= from
      })
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter((entry) => {
        const entryDate = new Date(entry.createdAt)
        return entryDate <= to
      })
    }

    return result
  }, [entries, searchFilter, actionFilter, dateFrom, dateTo])

  // Group entries by date for visual separation
  const groupedEntries = useMemo(() => {
    const groups = []
    let currentDateKey = null

    filteredEntries.forEach((entry) => {
      const dateKey = getDateKey(entry.createdAt)
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey
        groups.push({
          dateKey,
          dateLabel: formatDateOnly(entry.createdAt),
          entries: [entry],
        })
      } else {
        groups[groups.length - 1].entries.push(entry)
      }
    })

    return groups
  }, [filteredEntries])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Trilha de Auditoria
        </h3>
        <span className="text-xs text-muted-foreground ml-1">
          {filteredEntries.length} registro{filteredEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter controls */}
      <FilterBar
        actionFilter={actionFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onActionChange={setActionFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {/* Timeline content */}
      {filteredEntries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {groupedEntries.map((group) => (
            <div key={group.dateKey}>
              {/* Date group header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[#C8E6C9] dark:bg-muted" />
                <span
                  className={cn(
                    'text-xs font-medium px-3 py-1 rounded-full capitalize',
                    'bg-muted',
                    'text-primary'
                  )}
                >
                  {group.dateLabel}
                </span>
                <div className="h-px flex-1 bg-[#C8E6C9] dark:bg-muted" />
              </div>

              {/* Timeline entries for this date */}
              <Card
                className={cn(
                  'rounded-2xl overflow-hidden',
                  'bg-card',
                  'border border-border'
                )}
              >
                <CardContent className="p-4 sm:p-5">
                  {group.entries.map((entry, index) => (
                    <TimelineEntry
                      key={entry.id || `${entry.documentoId}-${entry.createdAt}-${index}`}
                      entry={entry}
                      isLast={index === group.entries.length - 1}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Load more button */}
      {hasMore && filteredEntries.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            className={cn(
              'border-border',
              'text-primary',
              'hover:bg-muted dark:hover:bg-muted',
              'transition-colors duration-200'
            )}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Carregando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Carregar mais
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default AuditTrailViewer
