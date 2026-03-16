/**
 * DeadlineBadge - Badge compartilhado de urgencia de prazo (Tailwind DS)
 */
import { AlertTriangle, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { getDeadlineUrgency } from '@/data/auditoriaTemplatesConfig'

const ICONS = {
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
}

const URGENCY_CLASSES = {
  onTrack: 'bg-success/20 text-success',
  approaching: 'bg-warning/20 text-warning',
  critical: 'bg-destructive/10 text-destructive',
  overdue: 'bg-destructive/10 text-destructive',
  none: 'bg-muted text-muted-foreground',
}

export default function DeadlineBadge({ prazo, compact = false, showDays = false }) {
  const urgency = getDeadlineUrgency(prazo)
  const key = urgency.key || 'none'
  const badgeClasses = URGENCY_CLASSES[key] || URGENCY_CLASSES.none

  if (!prazo && !compact) return null
  if (!prazo && compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        Sem prazo
      </span>
    )
  }

  const Icon = urgency.icon ? ICONS[urgency.icon] : null
  const diasText =
    urgency.dias != null
      ? urgency.dias < 0
        ? `${Math.abs(urgency.dias)}d atrasado`
        : urgency.dias === 0
          ? 'Hoje'
          : `${urgency.dias}d restante${urgency.dias !== 1 ? 's' : ''}`
      : ''

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClasses}`}
      >
        {Icon && <Icon className="w-3 h-3" />}
        <span>{showDays && diasText ? diasText : urgency.label}</span>
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${badgeClasses}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>
        {urgency.label}
        {showDays && diasText ? ` — ${diasText}` : ''}
      </span>
    </div>
  )
}
