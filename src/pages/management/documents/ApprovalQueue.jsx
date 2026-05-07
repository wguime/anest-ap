/**
 * ApprovalQueue Component
 *
 * Displays all documents pending approval across ALL categories.
 * Provides approve/reject actions with confirmation via ApprovalModal.
 *
 * Wave 3 / W3-5 additions:
 *   - notifyUser fired on approve/reject (in addition to context-level notify)
 *   - Self-approval blocked in UI (disabled button + tooltip) AND at mutation site
 *   - Real-time subscription notifies all admins when a new doc enters PENDENTE
 *
 * @module management/documents/ApprovalQueue
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, Badge, Button, Tooltip } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { CATEGORY_LABELS, DOCUMENT_STATUS } from '@/types/documents'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import { useDocuments } from '@/contexts/DocumentsContext'
import { useUser } from '@/contexts/UserContext'
import { CheckCircle, XCircle, FileText, Clock, Loader2 } from 'lucide-react'
import { Skeleton } from '@/design-system'
import ApprovalModal from '../components/ApprovalModal'
import { notifyUser, notifyUsers } from '@/services/notificationService'
import { supabase } from '@/config/supabase'
import { isSelfApproval } from './approvalUtils'

// ============================================================================
// CATEGORY COLORS
// ============================================================================

/**
 * Visual color mapping for category badges
 */
const CATEGORY_COLORS = {
  etica:        '#006837',
  comites:      '#1565C0',
  auditorias:   '#7B1FA2',
  relatorios:   '#00838F',
  biblioteca:   '#EF6C00',
  financeiro:   '#2E7D32',
  medicamentos: '#1565C0',
  infeccoes:    '#00838F',
  desastres:    '#D32F2F',
}

const SELF_APPROVAL_TOOLTIP = 'Você não pode aprovar seus próprios documentos'

// ============================================================================
// HELPER: Date formatting
// ============================================================================

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// (HELPER: detect self-approval — see ./approvalUtils.js
//  imported above; kept in a separate module so this file only exports React
//  components, satisfying react-refresh/only-export-components.)

// ============================================================================
// SUB-COMPONENT: ApprovalItem
// ============================================================================

/**
 * Individual document item in the approval queue
 */
function ApprovalItem({ doc, onApprove, onReject, isProcessing, selfApproval }) {
  const categoryLabel = CATEGORY_LABELS[doc.category] || doc.category
  const categoryColor = CATEGORY_COLORS[doc.category] || '#006837'

  const approveButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={isProcessing || selfApproval}
      onClick={() => !selfApproval && onApprove(doc)}
      data-testid={`approve-btn-${doc.id}`}
      data-self-approval={selfApproval ? 'true' : 'false'}
      aria-disabled={selfApproval || isProcessing}
      title={selfApproval ? SELF_APPROVAL_TOOLTIP : undefined}
      className={cn(
        'border-primary',
        'text-primary',
        'hover:bg-muted dark:hover:bg-muted',
        'transition-colors duration-200',
        selfApproval && 'opacity-60 cursor-not-allowed'
      )}
    >
      {isProcessing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Aprovar
        </>
      )}
    </Button>
  )

  return (
    <Card
      className={cn(
        'bg-card',
        'border border-border',
        'rounded-2xl shadow-sm overflow-hidden',
        'hover:shadow-md transition-all duration-200'
      )}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: categoryColor,
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Icon */}
          <div
            className={cn(
              'hidden sm:flex flex-shrink-0 p-3 rounded-xl',
              'transition-transform duration-200'
            )}
            style={{
              backgroundColor: `${categoryColor}15`,
              color: categoryColor,
            }}
          >
            <FileText className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3
              className={cn(
                'text-base font-semibold truncate',
                'text-foreground'
              )}
            >
              {doc.titulo}
            </h3>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Code */}
              {doc.codigo && (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-lg',
                    'bg-muted',
                    'text-xs font-mono text-muted-foreground'
                  )}
                >
                  {doc.codigo}
                </span>
              )}

              {/* Category badge */}
              <Badge
                variant="outline"
                className="text-xs font-medium"
                style={{
                  borderColor: categoryColor,
                  color: categoryColor,
                }}
              >
                {categoryLabel}
              </Badge>

              {/* Type */}
              {doc.tipo && (
                <span className="text-xs text-muted-foreground">
                  {doc.tipo}
                </span>
              )}

              {/* Separator dot */}
              <span className="hidden sm:inline text-border">
                ·
              </span>

              {/* Created by */}
              {doc.createdByName && (
                <span className="text-xs text-muted-foreground">
                  por {doc.createdByName}
                </span>
              )}

              {/* Creation date */}
              {doc.createdAt && (
                <span className="text-xs text-muted-foreground ml-auto sm:ml-0">
                  {formatDate(doc.createdAt)}
                </span>
              )}
            </div>

            {/* Approval workflow progress */}
            {doc.approval_workflow?.approvers && doc.approval_workflow.approvers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Progresso: {doc.approval_workflow.approvers.filter(a => a.status === 'approved').length} de {doc.approval_workflow.approvers.length}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{
                      width: `${(doc.approval_workflow.approvers.filter(a => a.status === 'approved').length / doc.approval_workflow.approvers.length) * 100}%`
                    }}
                  />
                </div>
                {/* Approver chips */}
                <div className="flex flex-wrap gap-1.5">
                  {doc.approval_workflow.approvers.map((approver, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        approver.status === 'approved'
                          ? 'bg-muted text-primary'
                          : approver.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted dark:bg-muted text-muted-foreground'
                      }`}
                    >
                      {approver.status === 'approved' ? '✓' : approver.status === 'rejected' ? '✗' : '○'}
                      {approver.name || approver.email || `Aprovador ${idx + 1}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {selfApproval ? (
              <Tooltip content={SELF_APPROVAL_TOOLTIP}>
                <span data-testid={`approve-tooltip-${doc.id}`}>{approveButton}</span>
              </Tooltip>
            ) : (
              approveButton
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => onReject(doc)}
              data-testid={`reject-btn-${doc.id}`}
              className={cn(
                'border-destructive',
                'text-destructive',
                'hover:bg-destructive/10 dark:hover:bg-destructive/20',
                'transition-colors duration-200'
              )}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Rejeitar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SUB-COMPONENT: EmptyState
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className={cn(
          'w-20 h-20 rounded-2xl flex items-center justify-center mb-6',
          'bg-muted'
        )}
      >
        <Clock className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">
        Nenhum documento pendente de aprovacao
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Todos os documentos foram revisados. Novos documentos enviados para aprovacao aparecerao aqui.
      </p>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ApprovalQueue() {
  const { pendingApproval, isLoading } = useComplianceMetrics()
  const { changeStatus } = useDocuments()
  const { user } = useUser()

  // Local state
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modalState, setModalState] = useState({
    open: false,
    document: null,
    action: null,
  })
  const [processingDocId, setProcessingDocId] = useState(null)

  // Build unique category list from pending documents
  const availableCategories = useMemo(() => {
    const categories = new Set()
    pendingApproval.forEach((doc) => {
      if (doc.category) categories.add(doc.category)
    })
    return Array.from(categories).sort()
  }, [pendingApproval])

  // Filter documents by selected category
  const filteredDocs = useMemo(() => {
    if (categoryFilter === 'all') return pendingApproval
    return pendingApproval.filter((doc) => doc.category === categoryFilter)
  }, [pendingApproval, categoryFilter])

  // Open approval modal — guard self-approval here too (defense in depth)
  const handleApprove = useCallback((doc) => {
    if (isSelfApproval(doc, user)) {
      console.warn('[ApprovalQueue] Self-approval blocked at handler level for doc', doc.id)
      return
    }
    setModalState({ open: true, document: doc, action: 'approve' })
  }, [user])

  // Open rejection modal
  const handleReject = useCallback((doc) => {
    setModalState({ open: true, document: doc, action: 'reject' })
  }, [])

  // Close modal
  const handleCloseModal = useCallback(() => {
    setModalState({ open: false, document: null, action: null })
  }, [])

  // Confirm approval or rejection
  const handleConfirm = useCallback(
    async ({ comment }) => {
      const doc = modalState.document
      if (!doc) return

      // Defense-in-depth — self-approval block at mutation site, not just UI
      if (modalState.action === 'approve' && isSelfApproval(doc, user)) {
        console.warn('[ApprovalQueue] Self-approval blocked at mutation site for doc', doc.id)
        handleCloseModal()
        return
      }

      setProcessingDocId(doc.id)

      try {
        const newStatus =
          modalState.action === 'approve'
            ? DOCUMENT_STATUS.ATIVO
            : DOCUMENT_STATUS.REJEITADO

        const userInfo = {
          userId: user?.uid || user?.id,
          userName: user?.displayName || user?.nome || user?.email,
          comment:
            comment ||
            (modalState.action === 'approve'
              ? 'Documento aprovado'
              : 'Documento rejeitado'),
        }

        await changeStatus(doc.category, doc.id, newStatus, userInfo)

        // Wave 3 / W3-5: notify the document author about the decision.
        // Fire-and-forget — failures in notify must not roll back the mutation.
        const authorId = doc.createdBy || doc.created_by || doc.createdById
        if (authorId) {
          notifyUser(authorId, {
            type: modalState.action === 'approve' ? 'document_approved' : 'document_rejected',
            docId: doc.id,
            docTitle: doc.titulo || doc.title,
            comment: comment || '',
            actorName: userInfo.userName,
          }).catch((err) => console.error('[ApprovalQueue] notifyUser failed:', err))
        }

        handleCloseModal()
      } catch (error) {
        console.error('Error processing document:', error)
      } finally {
        setProcessingDocId(null)
      }
    },
    [modalState, changeStatus, user, handleCloseModal]
  )

  // --------------------------------------------------------------------------
  // REAL-TIME — notify approvers when a new doc enters PENDENTE status
  // --------------------------------------------------------------------------
  // Track IDs we've already notified for in-tab to avoid duplicate notifications
  // when both INSERT and UPDATE→PENDENTE events fire for the same doc.
  const notifiedIdsRef = useRef(new Set())

  useEffect(() => {
    if (!user?.isAdmin) {
      // Only admins observe the approval queue real-time signal
      return undefined
    }

    let cancelled = false

    async function notifyApprovers(docRow) {
      if (cancelled || !docRow?.id) return
      if (notifiedIdsRef.current.has(docRow.id)) return
      notifiedIdsRef.current.add(docRow.id)

      try {
        const usersModule = await import('@/services/supabaseUsersService')
        const all = await usersModule.default.fetchAllUsers({ active: true })
        const adminIds = (all || [])
          .filter((u) => u.isAdmin === true || u.is_admin === true)
          .map((u) => u.id)
          .filter((id) => id && id !== (user?.uid || user?.id))

        if (adminIds.length === 0) return

        await notifyUsers(adminIds, {
          type: 'approval_pending',
          docId: docRow.id,
          docTitle: docRow.titulo || docRow.title || 'Documento',
        })
      } catch (err) {
        console.error('[ApprovalQueue] notifyApprovers failed:', err)
      }
    }

    const channel = supabase
      .channel('approval-queue-pending')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'documentos', filter: 'status=eq.PENDENTE' },
        (payload) => notifyApprovers(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documentos', filter: 'status=eq.PENDENTE' },
        (payload) => {
          const oldStatus = payload.old?.status
          const newStatus = payload.new?.status
          // Only fire when transitioning INTO PENDENTE
          if (oldStatus !== 'PENDENTE' && newStatus === 'PENDENTE') {
            notifyApprovers(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.isAdmin, user?.uid, user?.id])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <Skeleton variant="custom" height={48} className="w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={idx} variant="custom" height={88} className="w-full rounded-2xl" />
        ))}
        <span className="sr-only">Carregando fila de aprovação…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Fila de Aprovacao
          </h2>
          <p className="text-sm text-muted-foreground">
            {filteredDocs.length}{' '}
            {filteredDocs.length === 1
              ? 'documento aguardando'
              : 'documentos aguardando'}{' '}
            aprovacao
          </p>
        </div>

        {/* Category filter */}
        {availableCategories.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="category-filter"
              className="text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              Filtrar:
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-xl text-sm',
                'bg-card',
                'border border-border',
                'text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50',
                'transition-all duration-200'
              )}
            >
              <option value="all">Todas as categorias</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Documents list or empty state */}
      {filteredDocs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filteredDocs.map((doc) => (
            <ApprovalItem
              key={doc.id}
              doc={doc}
              onApprove={handleApprove}
              onReject={handleReject}
              isProcessing={processingDocId === doc.id}
              selfApproval={isSelfApproval(doc, user)}
            />
          ))}
        </div>
      )}

      {/* Approval/Rejection Modal */}
      <ApprovalModal
        open={modalState.open}
        onClose={handleCloseModal}
        document={modalState.document}
        action={modalState.action}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

export default ApprovalQueue
