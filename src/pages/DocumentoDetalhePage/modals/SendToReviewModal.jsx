/**
 * SendToReviewModal — Bloco 5
 * -----------------------------------------------------------------------------
 * Modal de confirmação para "Enviar para revisão" (ativo → revisao_pendente).
 * Coleta um motivo (opcional) que vai para o changelog e para a notificação do
 * autor. Segue o padrão visual do ApprovalModal (createPortal + DS tokens).
 */
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function SendToReviewModal({ open, onClose, document: doc, onConfirm }) {
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setComment('')
      setIsSubmitting(false)
    }
  }, [open, doc?.id])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

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
      console.error('Error sending to review:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [comment, isSubmitting, onConfirm, onClose])

  if (!open) return null

  const modalContent = (
    <div className={cn('fixed inset-0 z-overlay flex items-center justify-center p-4', 'animate-in fade-in-0 duration-200')}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl',
          'animate-in zoom-in-95 duration-200 overflow-hidden'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Enviar documento para revisão"
      >
        <div className="h-1 bg-warning" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 p-3 rounded-xl bg-warning/10 dark:bg-warning/20 text-warning">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Enviar para revisão</h3>
              <p className="text-sm text-muted-foreground">
                O documento entra em revisão e o autor é notificado.
              </p>
            </div>
          </div>

          {doc && (
            <div className="p-3 rounded-xl mb-4 bg-muted border border-border">
              <p className="text-sm font-semibold text-foreground truncate">{doc.titulo}</p>
              {doc.codigo && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{doc.codigo}</p>}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="review-reason" className="block text-sm font-semibold text-primary mb-2">
              Motivo da revisão (opcional)
            </label>
            <textarea
              id="review-reason"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex.: revisão periódica, atualização normativa, correção solicitada..."
              rows={3}
              className={cn(
                'w-full px-3 py-2 rounded-xl text-sm resize-none bg-card dark:bg-muted border border-border',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-warning/50 transition-all duration-200'
              )}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting} variant="warning">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Enviar para revisão
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
