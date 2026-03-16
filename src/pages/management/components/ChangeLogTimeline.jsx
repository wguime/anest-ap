/**
 * ChangeLogTimeline Component
 *
 * Vertical timeline that renders a chronological list of document change log entries.
 * Each entry displays an action label (in Portuguese), the user who performed it,
 * a formatted timestamp, an optional changes summary, and an optional comment.
 *
 * Colour-coded dots indicate the nature of each action:
 *   - Green  (#059669): created, approved, restored
 *   - Amber  (#F59E0B): status_changed, updated, version_added
 *   - Red    (#DC2626): rejected, archived, deleted
 *
 * Supports optional filtering by action group and date range via props.
 *
 * @module management/components/ChangeLogTimeline
 */

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/design-system/utils/tokens'
import { ChevronDown, User } from 'lucide-react'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maps internal action keys to human-readable Portuguese labels.
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
}

/**
 * Groups of actions mapped to their dot colour.
 */
const GREEN_ACTIONS = new Set(['created', 'approved', 'restored'])
const AMBER_ACTIONS = new Set(['status_changed', 'updated', 'version_added'])
const RED_ACTIONS = new Set(['rejected', 'archived', 'deleted'])

/**
 * Action group mappings for filtering.
 */
const ACTION_GROUPS = {
  criacao: ['created'],
  edicao: ['updated', 'version_added'],
  aprovacao: ['approved', 'rejected', 'status_changed'],
  arquivamento: ['archived', 'restored', 'deleted']
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns the dot colour hex string for a given action.
 * @param {string} action
 * @returns {string} hex colour
 */
function getDotColor(action) {
  if (GREEN_ACTIONS.has(action)) return '#059669'
  if (AMBER_ACTIONS.has(action)) return '#F59E0B'
  if (RED_ACTIONS.has(action)) return '#DC2626'
  return '#6B7280' // fallback neutral grey
}

/**
 * Returns a light background class string for the action badge.
 * @param {string} action
 * @returns {string} Tailwind classes
 */
function getActionBadgeClasses(action) {
  if (GREEN_ACTIONS.has(action)) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  }
  if (AMBER_ACTIONS.has(action)) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  }
  if (RED_ACTIONS.has(action)) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400'
}

/**
 * Formats an ISO timestamp string or Date to "DD/MM/YYYY HH:mm" using pt-BR locale.
 * @param {string|Date} timestamp
 * @returns {string} formatted date string
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return String(timestamp)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(timestamp)
  }
}

/**
 * Returns a relative time string in Portuguese (e.g., "2 dias atras", "agora").
 * @param {string|Date} timestamp
 * @returns {string} relative time string
 */
function getRelativeTime(timestamp) {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now - date
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffMonths = Math.floor(diffDays / 30)
    const diffYears = Math.floor(diffDays / 365)

    if (diffSecs < 60) return 'agora'
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'} atras`
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'} atras`
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} atras`
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'} atras`
    return `${diffYears} ${diffYears === 1 ? 'ano' : 'anos'} atras`
  } catch {
    return ''
  }
}

/**
 * Returns the Portuguese label for an action, falling back to the raw action value.
 * @param {string} action
 * @returns {string}
 */
function getActionLabel(action) {
  return ACTION_LABELS[action] || action
}

/**
 * Returns whether an entry's timestamp falls within the given date range.
 * @param {string|Date} timestamp
 * @param {'all'|'7d'|'30d'} range
 * @returns {boolean}
 */
function isWithinDateRange(timestamp, range) {
  if (!range || range === 'all') return true
  if (!timestamp) return false
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return true
    const now = new Date()
    const diffMs = now - date
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (range === '7d') return diffDays <= 7
    if (range === '30d') return diffDays <= 30
    return true
  } catch {
    return true
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * A single entry in the timeline.
 *
 * @param {Object} props
 * @param {Object} props.entry - The change log entry object
 * @param {boolean} props.isLast - Whether this is the last visible entry (hides connecting line)
 */
function TimelineEntry({ entry, isLast }) {
  const { action, userName, timestamp, changes, comment } = entry
  const dotColor = getDotColor(action)
  const badgeClasses = getActionBadgeClasses(action)
  const relativeTime = getRelativeTime(timestamp)

  return (
    <div className="relative flex gap-4">
      {/* Left rail: dot + connecting line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={cn(
            'relative z-10 w-3.5 h-3.5 rounded-full shrink-0 mt-1.5',
            'ring-4 ring-white dark:ring-[#1A2420]'
          )}
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
        {/* Connecting line */}
        {!isLast && (
          <div
            className="w-px flex-1 min-h-[24px] bg-[#C8E6C9] dark:bg-[#2A3F36]"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Right content */}
      <div className="pb-6 flex-1 min-w-0">
        {/* Action label badge */}
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold',
            badgeClasses
          )}
        >
          {getActionLabel(action)}
        </span>

        {/* User + timestamp row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
          {userName && (
            <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white">
              <User className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A3B8B0]" />
              {userName}
            </span>
          )}
          {timestamp && (
            <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0]">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        {/* Relative time */}
        {relativeTime && (
          <span className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mt-0.5 block">
            {relativeTime}
          </span>
        )}

        {/* Changes summary */}
        {changes && (
          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A3B8B0] leading-relaxed">
            {typeof changes === 'string' ? changes : JSON.stringify(changes)}
          </p>
        )}

        {/* Optional comment */}
        {comment && (
          <p className="mt-1 text-sm italic text-[#9CA3AF] dark:text-[#6B8178] leading-relaxed">
            &ldquo;{comment}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ChangeLogTimeline Component
 *
 * Renders a vertical timeline of change log entries with colour-coded dots,
 * expandable list, and formatted metadata.
 *
 * @param {Object} props
 * @param {Array} props.entries - Array of change log entry objects
 * @param {number} [props.maxVisible=5] - Number of entries to show before collapsing
 * @param {string} [props.filterAction] - Optional action group filter (criacao, edicao, aprovacao, arquivamento)
 * @param {'all'|'7d'|'30d'} [props.filterDateRange='all'] - Optional date range filter
 */
function ChangeLogTimeline({ entries = [], maxVisible = 5, filterAction, filterDateRange = 'all' }) {
  const [expanded, setExpanded] = useState(false)

  // Apply action and date range filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Action group filter
      if (filterAction) {
        const allowedActions = ACTION_GROUPS[filterAction]
        if (allowedActions && !allowedActions.includes(entry.action)) {
          return false
        }
      }

      // Date range filter
      if (!isWithinDateRange(entry.timestamp, filterDateRange)) {
        return false
      }

      return true
    })
  }, [entries, filterAction, filterDateRange])

  const visibleEntries = useMemo(() => {
    if (expanded || filteredEntries.length <= maxVisible) return filteredEntries
    return filteredEntries.slice(0, maxVisible)
  }, [filteredEntries, maxVisible, expanded])

  const remainingCount = filteredEntries.length - maxVisible

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  if (!entries || entries.length === 0) {
    return null
  }

  if (filteredEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
          Nenhum registro encontrado para os filtros selecionados.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline entries */}
      <div>
        {visibleEntries.map((entry, index) => (
          <TimelineEntry
            key={`${entry.timestamp || ''}-${entry.action || ''}-${index}`}
            entry={entry}
            isLast={index === visibleEntries.length - 1}
          />
        ))}
      </div>

      {/* Expand / collapse toggle */}
      {filteredEntries.length > maxVisible && (
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-1.5 mt-1 ml-7',
            'text-sm font-medium',
            'text-[#006837] dark:text-[#2ECC71]',
            'hover:text-[#004225] dark:hover:text-[#27AE60]',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ECC71]/50 rounded'
          )}
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              expanded && 'rotate-180'
            )}
          />
          {expanded
            ? 'Ver menos'
            : `Ver mais (${remainingCount} restante${remainingCount !== 1 ? 's' : ''})`}
        </button>
      )}
    </div>
  )
}

export default ChangeLogTimeline
