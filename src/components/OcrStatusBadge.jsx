import { useMemo } from 'react'
import { ScanLine, CheckCircle2, AlertTriangle, Loader2, FileText, Clock, XCircle } from 'lucide-react'
import { Badge } from '@/design-system/components/ui/badge'
import { cn } from '@/design-system/utils/tokens'

/**
 * OcrStatusBadge — Sprint 4 / O2-2
 *
 * Mostra o status do OCR de um documento. Aceita o registro completo do
 * documento (camelCase) ou apenas o status string. Quando `done`, mostra
 * confiança em tooltip nativo (title); confidence baixa (<0.7) muda
 * variante para `warning` para sinalizar reprocesso.
 */
const STATUS_CONFIG = {
  pending: {
    label: 'OCR pendente',
    short: 'OCR pend.',
    variant: 'secondary',
    Icon: Clock,
  },
  processing: {
    label: 'OCR em andamento',
    short: 'OCR…',
    variant: 'info',
    Icon: Loader2,
    spin: true,
  },
  done: {
    label: 'OCR concluído',
    short: 'OCR ok',
    variant: 'success',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'OCR falhou',
    short: 'OCR erro',
    variant: 'destructive',
    Icon: XCircle,
  },
  skipped: {
    label: 'OCR dispensado',
    short: 'OCR pulado',
    variant: 'secondary',
    Icon: ScanLine,
  },
  not_needed: {
    label: 'PDF com texto (OCR não necessário)',
    short: 'Texto nativo',
    variant: 'secondary',
    Icon: FileText,
  },
  none: {
    label: 'OCR não avaliado',
    short: 'OCR ?',
    variant: 'secondary',
    Icon: ScanLine,
  },
}

function pickStatus(documento) {
  const status = typeof documento === 'string' ? documento : documento?.ocrStatus
  if (!status) return 'none'
  return STATUS_CONFIG[status] ? status : 'none'
}

export function OcrStatusBadge({
  documento,
  status: statusProp,
  short = false,
  className,
  showConfidence = true,
}) {
  const statusKey = useMemo(
    () => pickStatus(statusProp ?? documento),
    [documento, statusProp]
  )

  const config = STATUS_CONFIG[statusKey]
  const confidence =
    typeof documento === 'object' && typeof documento?.ocrConfidence === 'number'
      ? documento.ocrConfidence
      : null

  // Confiança baixa em done → warning
  let variant = config.variant
  if (statusKey === 'done' && confidence !== null && confidence < 0.7) {
    variant = 'warning'
  }

  const title = useMemo(() => {
    const base = config.label
    if (statusKey === 'done' && confidence !== null && showConfidence) {
      return `${base} · confiança ${Math.round(confidence * 100)}%`
    }
    if (statusKey === 'failed') {
      return `${base}. Tente reprocessar pelo menu do documento.`
    }
    return base
  }, [config.label, confidence, showConfidence, statusKey])

  const Icon = config.Icon

  return (
    <Badge
      variant={variant}
      badgeStyle="subtle"
      className={cn('gap-1', className)}
      icon={
        <Icon
          className={cn('size-3', config.spin && 'animate-spin')}
          aria-hidden="true"
        />
      }
      title={title}
      aria-label={title}
    >
      {short ? config.short : config.label}
      {statusKey === 'done' && confidence !== null && showConfidence && !short ? (
        <span className="ml-1 opacity-70">
          {Math.round(confidence * 100)}%
        </span>
      ) : null}
    </Badge>
  )
}

export const OCR_BADGE_STATUSES = Object.keys(STATUS_CONFIG)
