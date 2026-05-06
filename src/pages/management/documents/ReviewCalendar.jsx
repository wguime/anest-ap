/**
 * ReviewCalendar - Calendar-style view of document reviews grouped by month.
 *
 * Wave 3 / W3-5 additions:
 *   - "Marcar como revisado" → addVersion (new version on the document)
 *   - "Adiar revisão"        → opens DatePicker, on confirm UPDATE proxima_revisao
 *   - "Delegar responsável"  → Popover with admin list, on confirm UPDATE responsavel_id
 *
 * Reads from useDocuments(). Mutations go through addVersion / updateDocument
 * from the actions context — no direct Supabase access in this component.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import { useDocuments } from '@/contexts/DocumentsContext'
import { useUser } from '@/contexts/UserContext'
import {
  Card,
  CardContent,
  Badge,
  Button,
  DatePicker,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { CATEGORY_LABELS, diasAteRevisao as diasAteRevisaoFn } from '@/types/documents'
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  CalendarClock,
  Users,
} from 'lucide-react'

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

// ============================================================================
// SUB-COMPONENT: ReviewRowActions
// ----------------------------------------------------------------------------
// Three actions per review row:
//  1. Marcar como revisado → calls onMarkReviewed(doc)
//  2. Adiar revisão        → opens DatePicker, on confirm onPostpone(doc, newDate)
//  3. Delegar responsável  → opens Popover, on confirm onDelegate(doc, userId)
// ============================================================================
function ReviewRowActions({
  doc,
  admins,
  isProcessing,
  onMarkReviewed,
  onPostpone,
  onDelegate,
}) {
  const [postponeOpen, setPostponeOpen] = useState(false)
  const [postponeDate, setPostponeDate] = useState(null)
  const [delegateOpen, setDelegateOpen] = useState(false)
  const containerRef = useRef(null)

  // Click-outside for the postpone date picker container
  useEffect(() => {
    if (!postponeOpen) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setPostponeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [postponeOpen])

  const handleConfirmPostpone = () => {
    if (!postponeDate) return
    onPostpone?.(doc, postponeDate)
    setPostponeOpen(false)
    setPostponeDate(null)
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-2 mt-2"
      data-testid={`review-actions-${doc.id}`}
    >
      <Button
        size="sm"
        variant="outline"
        disabled={isProcessing}
        onClick={() => onMarkReviewed?.(doc)}
        data-testid={`mark-reviewed-${doc.id}`}
        className={cn(
          'border-primary text-primary',
          'hover:bg-muted dark:hover:bg-muted'
        )}
      >
        <CheckCircle className="w-4 h-4 mr-1.5" />
        Marcar como revisado
      </Button>

      {/* Adiar revisão — DatePicker */}
      <div className="relative">
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing}
          onClick={() => setPostponeOpen((v) => !v)}
          data-testid={`postpone-btn-${doc.id}`}
          aria-expanded={postponeOpen}
          className={cn(
            'border-border text-foreground',
            'hover:bg-muted dark:hover:bg-muted'
          )}
        >
          <CalendarClock className="w-4 h-4 mr-1.5" />
          Adiar revisão
        </Button>
        {postponeOpen && (
          <div
            data-testid={`postpone-picker-${doc.id}`}
            className={cn(
              'absolute z-40 mt-2 right-0 sm:left-0 sm:right-auto',
              'p-3 rounded-2xl bg-card border border-border shadow-lg'
            )}
          >
            <DatePicker
              label="Nova data de revisão"
              value={postponeDate}
              onChange={(d) => setPostponeDate(d)}
              minDate={new Date()}
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPostponeOpen(false)
                  setPostponeDate(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPostpone}
                disabled={!postponeDate}
                data-testid={`postpone-confirm-${doc.id}`}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delegar responsável — Popover */}
      <Popover open={delegateOpen} onOpenChange={setDelegateOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={isProcessing}
            data-testid={`delegate-btn-${doc.id}`}
            className={cn(
              'border-border text-foreground',
              'hover:bg-muted dark:hover:bg-muted'
            )}
          >
            <Users className="w-4 h-4 mr-1.5" />
            Delegar responsável
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-2"
          data-testid={`delegate-popover-${doc.id}`}
        >
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
            Selecione um administrador
          </div>
          <div className="max-h-64 overflow-y-auto">
            {admins.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-3">
                Nenhum administrador disponível.
              </div>
            )}
            {admins.map((adm) => (
              <button
                key={adm.id}
                type="button"
                data-testid={`delegate-option-${doc.id}-${adm.id}`}
                onClick={() => {
                  onDelegate?.(doc, adm)
                  setDelegateOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg',
                  'text-sm text-foreground',
                  'hover:bg-muted dark:hover:bg-muted',
                  'transition-colors'
                )}
              >
                <div className="font-medium">{adm.nome || adm.displayName || adm.email || adm.id}</div>
                {adm.email && (
                  <div className="text-xs text-muted-foreground">{adm.email}</div>
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
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
  const { addVersion, updateDocument } = useDocuments()
  const { user } = useUser()

  const [admins, setAdmins] = useState([])
  const [processingId, setProcessingId] = useState(null)

  // Lazy-load admin list once per mount
  useEffect(() => {
    let cancelled = false
    async function loadAdmins() {
      try {
        const mod = await import('@/services/supabaseUsersService')
        const all = await mod.default.fetchAllUsers({ active: true })
        if (cancelled) return
        const onlyAdmins = (all || []).filter((u) => u.isAdmin === true || u.is_admin === true)
        setAdmins(onlyAdmins)
      } catch (err) {
        console.error('[ReviewCalendar] failed to load admins:', err)
      }
    }
    loadAdmins()
    return () => {
      cancelled = true
    }
  }, [])

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

  // Build a userInfo bundle for audit-trail mutations
  const userInfo = useMemo(
    () => ({
      userId: user?.uid || user?.id,
      userName: user?.displayName || user?.nome || user?.email,
    }),
    [user]
  )

  // ── Action handlers ───────────────────────────────────────────────
  const handleMarkReviewed = async (doc) => {
    if (!doc?.id || !doc?.category) return
    setProcessingId(doc.id)
    try {
      const nextVersionNumber = (doc.versaoAtual || 0) + 1
      await addVersion(doc.category, doc.id, {
        versao: nextVersionNumber,
        descricaoAlteracao: 'Revisão periódica concluída',
        motivoAlteracao: 'Revisão de documento',
      }, userInfo)
    } catch (err) {
      console.error('[ReviewCalendar] mark reviewed failed:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handlePostpone = async (doc, newDate) => {
    if (!doc?.id || !doc?.category || !newDate) return
    setProcessingId(doc.id)
    try {
      const iso = newDate instanceof Date ? newDate.toISOString() : new Date(newDate).toISOString()
      await updateDocument(doc.category, doc.id, { proximaRevisao: iso }, userInfo)
    } catch (err) {
      console.error('[ReviewCalendar] postpone failed:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelegate = async (doc, admin) => {
    if (!doc?.id || !doc?.category || !admin?.id) return
    setProcessingId(doc.id)
    try {
      await updateDocument(
        doc.category,
        doc.id,
        {
          responsavelId: admin.id,
          responsavelRevisao: admin.nome || admin.displayName || admin.email || admin.id,
        },
        userInfo
      )
    } catch (err) {
      console.error('[ReviewCalendar] delegate failed:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const isEmpty = sortedOverdue.length === 0 && monthlyGroups.length === 0

  // -- Empty state -----------------------------------------------------------
  if (isEmpty) {
    return (
      <Card className="bg-card rounded-2xl border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhuma revisao pendente
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
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
        <Card className="bg-card rounded-2xl border border-destructive/30">
          <CardContent className="p-6">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-destructive/10 dark:bg-destructive/30">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-destructive">
                  Revisoes Vencidas
                </h3>
                <p className="text-xs text-destructive/80 mt-0.5">
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
                      'flex flex-col gap-2',
                      'p-3 rounded-xl',
                      'bg-destructive/5 dark:bg-destructive/10',
                      'border border-destructive/20'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      {/* Title + code */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.titulo}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">
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
                            'bg-destructive/10 dark:bg-destructive/30 text-destructive'
                          )}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {daysOverdue}d atrasada
                        </span>
                        {doc.responsavelRevisao && (
                          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {doc.responsavelRevisao}
                          </span>
                        )}
                      </div>
                    </div>
                    <ReviewRowActions
                      doc={doc}
                      admins={admins}
                      isProcessing={processingId === doc.id}
                      onMarkReviewed={handleMarkReviewed}
                      onPostpone={handlePostpone}
                      onDelegate={handleDelegate}
                    />
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
          className="bg-card rounded-2xl border border-border"
        >
          <CardContent className="p-6">
            {/* Month header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-muted">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {group.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                      'flex flex-col gap-2',
                      'p-3 rounded-xl',
                      'bg-muted',
                      'border border-border/50'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      {/* Title + code + category */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.titulo}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">
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
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.proximaRevisao)}
                        </span>

                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            isUrgent
                              ? 'bg-warning/10 dark:bg-warning/30 text-warning'
                              : isWarning
                                ? 'bg-warning/10 dark:bg-warning/30 text-warning'
                                : 'bg-success/10 dark:bg-success/30 text-success'
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
                          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {doc.responsavelRevisao}
                          </span>
                        )}
                      </div>
                    </div>
                    <ReviewRowActions
                      doc={doc}
                      admins={admins}
                      isProcessing={processingId === doc.id}
                      onMarkReviewed={handleMarkReviewed}
                      onPostpone={handlePostpone}
                      onDelegate={handleDelegate}
                    />
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
