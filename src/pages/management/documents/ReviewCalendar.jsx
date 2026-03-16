import React, { useMemo } from 'react'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import { Card, CardContent, Badge } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { CATEGORY_LABELS, diasAteRevisao as diasAteRevisaoFn } from '@/types/documents'
import { Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

/**
 * Portuguese month names used for grouping headers.
 */
const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/**
 * Format an ISO date string to "dd/mm/yyyy" in Portuguese locale style.
 */
function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Build a human-readable month/year key from an ISO date string.
 * e.g. "2026-02-15" -> "Fevereiro 2026"
 */
function monthYearKey(isoString) {
  const d = new Date(isoString)
  return `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Sort key for month groups so they appear in chronological order.
 * Returns a numeric value derived from year * 100 + month.
 */
function monthSortValue(isoString) {
  const d = new Date(isoString)
  return d.getFullYear() * 100 + d.getMonth()
}

/**
 * ReviewCalendar - Calendar-style view of document reviews grouped by month.
 *
 * Displays two main areas:
 *   1. A highlighted "overdue" section for documents past their review date.
 *   2. Monthly-grouped upcoming reviews sorted chronologically.
 *
 * Data is sourced from useComplianceMetrics which aggregates all active
 * documents from the DocumentsContext.
 */
function ReviewCalendar() {
  const { overdueDocuments, upcomingReviews } = useComplianceMetrics()

  // Sort overdue documents: most overdue first (most negative diasAteRevisao)
  const sortedOverdue = useMemo(() => {
    return [...overdueDocuments].sort((a, b) => {
      const daysA = diasAteRevisaoFn(a.proximaRevisao) ?? 0
      const daysB = diasAteRevisaoFn(b.proximaRevisao) ?? 0
      return daysA - daysB // more negative = more overdue = first
    })
  }, [overdueDocuments])

  // Group upcoming reviews by month/year
  const monthlyGroups = useMemo(() => {
    const groups = {}

    upcomingReviews.forEach((doc) => {
      if (!doc.proximaRevisao) return
      const key = monthYearKey(doc.proximaRevisao)
      if (!groups[key]) {
        groups[key] = {
          label: key,
          sortValue: monthSortValue(doc.proximaRevisao),
          items: [],
        }
      }
      groups[key].items.push(doc)
    })

    // Sort each group's items by date ascending
    Object.values(groups).forEach((group) => {
      group.items.sort(
        (a, b) => new Date(a.proximaRevisao) - new Date(b.proximaRevisao)
      )
    })

    // Return groups sorted chronologically
    return Object.values(groups).sort((a, b) => a.sortValue - b.sortValue)
  }, [upcomingReviews])

  const isEmpty = sortedOverdue.length === 0 && monthlyGroups.length === 0

  // -- Empty state -----------------------------------------------------------
  if (isEmpty) {
    return (
      <Card className="bg-white dark:bg-[#1A2420] rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36]">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhuma revisao pendente
          </h3>
          <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0] max-w-sm">
            Todos os documentos estao com as revisoes em dia.
          </p>
        </CardContent>
      </Card>
    )
  }

  // -- Main layout -----------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Overdue documents section                                          */}
      {/* ------------------------------------------------------------------ */}
      {sortedOverdue.length > 0 && (
        <Card className="bg-white dark:bg-[#1A2420] rounded-2xl border border-red-200 dark:border-red-900/40">
          <CardContent className="p-6">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-red-700 dark:text-red-400">
                  Revisoes Vencidas
                </h3>
                <p className="text-xs text-red-500 dark:text-red-400/70 mt-0.5">
                  {sortedOverdue.length}{' '}
                  {sortedOverdue.length === 1 ? 'documento' : 'documentos'} com
                  revisao vencida
                </p>
              </div>
            </div>

            {/* Overdue items list */}
            <div className="space-y-3">
              {sortedOverdue.map((doc) => {
                const daysOverdue = Math.abs(
                  diasAteRevisaoFn(doc.proximaRevisao) ?? 0
                )

                return (
                  <div
                    key={doc.id}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4',
                      'p-3 rounded-xl',
                      'bg-red-50 dark:bg-red-900/10',
                      'border border-red-100 dark:border-red-900/20'
                    )}
                  >
                    {/* Title + code */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {doc.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0] font-mono">
                          {doc.codigo}
                        </span>
                        {doc.category && (
                          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
                            {CATEGORY_LABELS[doc.category] || doc.category}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Overdue indicator */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        )}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {daysOverdue}d atrasada
                      </span>
                      {doc.responsavelRevisao && (
                        <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0] truncate max-w-[140px]">
                          {doc.responsavelRevisao}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Monthly upcoming reviews                                           */}
      {/* ------------------------------------------------------------------ */}
      {monthlyGroups.map((group) => (
        <Card
          key={group.label}
          className="bg-white dark:bg-[#1A2420] rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36]"
        >
          <CardContent className="p-6">
            {/* Month header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-[#E8F5E9] dark:bg-[#243530]">
                <Calendar className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {group.label}
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0] mt-0.5">
                  {group.items.length}{' '}
                  {group.items.length === 1 ? 'revisao' : 'revisoes'} programada
                  {group.items.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Monthly items list */}
            <div className="space-y-3">
              {group.items.map((doc) => {
                const dias = diasAteRevisaoFn(doc.proximaRevisao) ?? 0
                const isUrgent = dias <= 7
                const isWarning = dias > 7 && dias <= 30

                return (
                  <div
                    key={doc.id}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4',
                      'p-3 rounded-xl',
                      'bg-gray-50 dark:bg-[#0D1512]',
                      'border border-[#C8E6C9]/50 dark:border-[#2A3F36]/50'
                    )}
                  >
                    {/* Title + code + category */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {doc.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0] font-mono">
                          {doc.codigo}
                        </span>
                        {doc.category && (
                          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
                            {CATEGORY_LABELS[doc.category] || doc.category}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Date + days remaining + responsible */}
                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0]">
                        {formatDate(doc.proximaRevisao)}
                      </span>

                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          isUrgent
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : isWarning
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        )}
                      >
                        {isUrgent || isWarning ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {dias}d restante{dias !== 1 ? 's' : ''}
                      </span>

                      {doc.responsavelRevisao && (
                        <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0] truncate max-w-[140px]">
                          {doc.responsavelRevisao}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default ReviewCalendar
