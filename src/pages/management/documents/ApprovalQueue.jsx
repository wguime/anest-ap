/**
 * ApprovalQueue Component
 *
 * Displays all documents pending approval across ALL categories.
 * Provides approve/reject actions with confirmation via ApprovalModal.
 *
 * @module management/documents/ApprovalQueue
 */

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, Badge, Button } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { CATEGORY_LABELS, DOCUMENT_STATUS, DOCUMENT_CATEGORIES } from '@/types/documents'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { CheckCircle, XCircle, FileText, Clock, Loader2 } from 'lucide-react'
import ApprovalModal from '../components/ApprovalModal'

// ============================================================================
// CATEGORY COLORS
// ============================================================================

/**
 * Visual color mapping for category badges
 */
const CATEGORY_COLORS = {
  [DOCUMENT_CATEGORIES.ETICA]: '#006837',
  [DOCUMENT_CATEGORIES.COMITES]: '#1565C0',
  [DOCUMENT_CATEGORIES.AUDITORIAS]: '#7B1FA2',
  [DOCUMENT_CATEGORIES.RELATORIOS]: '#00838F',
  [DOCUMENT_CATEGORIES.BIBLIOTECA]: '#EF6C00',
  [DOCUMENT_CATEGORIES.FINANCEIRO]: '#2E7D32',
}

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

// ============================================================================
// SUB-COMPONENT: ApprovalItem
// ============================================================================

/**
 * Individual document item in the approval queue
 */
function ApprovalItem({ doc, onApprove, onReject, isProcessing }) {
  const categoryLabel = CATEGORY_LABELS[doc.category] || doc.category
  const categoryColor = CATEGORY_COLORS[doc.category] || '#006837'

  return (
    <Card
      className={cn(
        'bg-white dark:bg-[#1A2420]',
        'border border-[#C8E6C9] dark:border-[#2A3F36]',
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
                'text-gray-900 dark:text-white'
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
                    'bg-gray-100 dark:bg-[#0D1512]',
                    'text-xs font-mono text-[#6B7280] dark:text-[#A3B8B0]'
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
                <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0]">
                  {doc.tipo}
                </span>
              )}

              {/* Separator dot */}
              <span className="hidden sm:inline text-[#C8E6C9] dark:text-[#2A3F36]">
                ·
              </span>

              {/* Created by */}
              {doc.createdByName && (
                <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0]">
                  por {doc.createdByName}
                </span>
              )}

              {/* Creation date */}
              {doc.createdAt && (
                <span className="text-xs text-[#6B7280] dark:text-[#A3B8B0] ml-auto sm:ml-0">
                  {formatDate(doc.createdAt)}
                </span>
              )}
            </div>

            {/* Approval workflow progress */}
            {doc.approval_workflow?.approvers && doc.approval_workflow.approvers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#2A3F36]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[#6B7280] dark:text-[#A3B8B0]">
                    Progresso: {doc.approval_workflow.approvers.filter(a => a.status === 'approved').length} de {doc.approval_workflow.approvers.length}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[#E5E7EB] dark:bg-[#2A3F36] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#006837] dark:bg-[#2ECC71] rounded-full transition-all duration-300"
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
                          ? 'bg-[#E8F5E9] dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71]'
                          : approver.status === 'rejected'
                          ? 'bg-[#FEE2E2] dark:bg-[#450A0A]/50 text-[#DC2626] dark:text-[#F87171]'
                          : 'bg-gray-100 dark:bg-[#0D1512] text-[#6B7280] dark:text-[#A3B8B0]'
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
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => onApprove(doc)}
              className={cn(
                'border-[#006837] dark:border-[#2ECC71]',
                'text-[#006837] dark:text-[#2ECC71]',
                'hover:bg-[#E8F5E9] dark:hover:bg-[#243530]',
                'transition-colors duration-200'
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
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => onReject(doc)}
              className={cn(
                'border-red-500 dark:border-red-400',
                'text-red-600 dark:text-red-400',
                'hover:bg-red-50 dark:hover:bg-red-900/20',
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
          'bg-[#E8F5E9] dark:bg-[#243530]'
        )}
      >
        <Clock className="w-10 h-10 text-[#006837] dark:text-[#2ECC71]" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Nenhum documento pendente de aprovacao
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-sm">
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
  const { changeStatus } = useDocumentsContext()

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

  // Open approval modal
  const handleApprove = useCallback((doc) => {
    setModalState({ open: true, document: doc, action: 'approve' })
  }, [])

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

      setProcessingDocId(doc.id)

      try {
        const newStatus =
          modalState.action === 'approve'
            ? DOCUMENT_STATUS.ATIVO
            : DOCUMENT_STATUS.REJEITADO

        const userInfo = {
          comment:
            comment ||
            (modalState.action === 'approve'
              ? 'Documento aprovado'
              : 'Documento rejeitado'),
        }

        await changeStatus(doc.category, doc.id, newStatus, userInfo)
        handleCloseModal()
      } catch (error) {
        console.error('Error processing document:', error)
      } finally {
        setProcessingDocId(null)
      }
    },
    [modalState, changeStatus]
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#006837] dark:text-[#2ECC71]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Fila de Aprovacao
          </h2>
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
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
              className="text-sm font-medium text-[#6B7280] dark:text-[#A3B8B0] whitespace-nowrap"
            >
              Filtrar:
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-xl text-sm',
                'bg-white dark:bg-[#0D1512]',
                'border border-[#C8E6C9] dark:border-[#2A3F36]',
                'text-gray-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-[#006837]/50 dark:focus:ring-[#2ECC71]/50',
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
