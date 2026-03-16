import React from 'react'
import { isRevisaoVencida, diasAteRevisao, DOCUMENT_STATUS } from '@/types/documents'
import { cn } from '@/design-system/utils/tokens'
import { AlertCircle, Clock, CheckCircle } from 'lucide-react'

/**
 * ReviewStatusBadge - Reusable badge showing document review status.
 *
 * Renders a colored pill badge indicating whether a document's next review
 * is overdue (red), approaching within 30 days (amber), or on track (green).
 * Returns null when the document is not active or has no scheduled review.
 *
 * @param {Object} props
 * @param {string} props.proximaRevisao - ISO date string of the next review
 * @param {string} props.status - Current document status (e.g. 'ativo')
 * @param {string} [props.className] - Additional CSS classes to merge
 */
function ReviewStatusBadge({ proximaRevisao, status, className }) {
  // Only display for active documents
  if (status !== DOCUMENT_STATUS.ATIVO) return null

  // Nothing to show without a scheduled review date
  if (!proximaRevisao) return null

  // Determine variant based on review timeline
  let variant
  if (isRevisaoVencida(proximaRevisao)) {
    variant = 'overdue'
  } else {
    const dias = diasAteRevisao(proximaRevisao)
    if (dias !== null && dias >= 1 && dias <= 30) {
      variant = 'approaching'
    } else {
      variant = 'onTrack'
    }
  }

  // Variant configuration map
  const variants = {
    overdue: {
      label: 'Vencida',
      icon: AlertCircle,
      colors: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    },
    approaching: {
      label: `Em ${diasAteRevisao(proximaRevisao)}d`,
      icon: Clock,
      colors: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    },
    onTrack: {
      label: 'Em dia',
      icon: CheckCircle,
      colors: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    },
  }

  const { label, icon: Icon, colors } = variants[variant]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        colors,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

export default ReviewStatusBadge
