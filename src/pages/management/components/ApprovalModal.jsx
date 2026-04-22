/**
 * ApprovalModal Component
 *
 * Confirmation modal for approve/reject document actions.
 * Uses createPortal to render directly in document.body.
 *
 * @module management/components/ApprovalModal
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

/**
 * ApprovalModal Component
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Object} props.document - Document object with titulo, codigo, etc.
 * @param {string} props.action - 'approve' or 'reject'
 * @param {Function} props.onConfirm - Callback with { comment } when confirmed
 */
function ApprovalModal({ open, onClose, document: doc, action, onConfirm }) {
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset comment when modal opens/closes or document changes
  useEffect(() => {
    if (open) {
      setComment('')
      setIsSubmitting(false)
    }
  }, [open, doc?.id])

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      await onConfirm?.({ comment: comment.trim() })
      onClose?.()
    } catch (error) {
      console.error('Error confirming action:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [comment, isSubmitting, onConfirm, onClose])

  if (!open) return null

  const isApprove = action === 'approve'

  const actionLabel = isApprove ? 'Aprovar' : 'Rejeitar'
  const actionDescription = isApprove
    ? 'O documento sera ativado e ficara disponivel para consulta.'
    : 'O documento sera rejeitado e retornara para revisao.'

  const ActionIcon = isApprove ? CheckCircle : XCircle

  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center p-4',
        'animate-in fade-in-0 duration-200'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-md',
          'bg-card',
          'border border-border',
          'rounded-2xl shadow-xl',
          'animate-in zoom-in-95 duration-200',
          'overflow-hidden'
        )}
      >
        {/* Header accent bar */}
        <div
          className={cn(
            'h-1',
            isApprove ? 'bg-primary' : 'bg-destructive'
          )}
        />

        {/* Content */}
        <div className="p-6">
          {/* Icon and title */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                'flex-shrink-0 p-3 rounded-xl',
                isApprove
                  ? 'bg-muted text-primary'
                  : 'bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive'
              )}
            >
              <ActionIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {actionLabel} Documento
              </h3>
              <p className="text-sm text-muted-foreground">
                {actionDescription}
              </p>
            </div>
          </div>

          {/* Document info */}
          {doc && (
            <div
              className={cn(
                'p-3 rounded-xl mb-4',
                'bg-muted dark:bg-muted',
                'border border-border'
              )}
            >
              <p className="text-sm font-semibold text-foreground truncate">
                {doc.titulo}
              </p>
              {doc.codigo && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {doc.codigo}
                </p>
              )}
            </div>
          )}

          {/* Comment textarea */}
          <div className="mb-6">
            <label
              htmlFor="approval-comment"
              className="block text-sm font-semibold text-primary mb-2"
            >
              Comentario {isApprove ? '(opcional)' : '(recomendado)'}
            </label>
            <textarea
              id="approval-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isApprove
                  ? 'Adicione um comentario sobre a aprovacao...'
                  : 'Explique o motivo da rejeicao...'
              }
              rows={3}
              className={cn(
                'w-full px-3 py-2 rounded-xl text-sm resize-none',
                'bg-card dark:bg-muted',
                'border border-border',
                'text-foreground',
                'placeholder:text-muted-foreground dark:placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2',
                isApprove
                  ? 'focus:ring-primary/50 dark:focus:ring-primary/50'
                  : 'focus:ring-destructive/50',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                'border-border',
                'text-muted-foreground',
                'hover:bg-muted dark:hover:bg-muted'
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={cn(
                'text-white',
                isApprove
                  ? 'bg-primary hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover dark:text-primary-foreground'
                  : 'bg-destructive hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/80'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ActionIcon className="w-4 h-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, window.document.body)
}

export default ApprovalModal
