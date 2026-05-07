import { useMemo } from 'react'
import {
  Archive,
  CheckCircle2,
  Loader2,
  Clock,
  XCircle,
  FileX,
} from 'lucide-react'
import { Badge } from '@/design-system/components/ui/badge'
import { cn } from '@/design-system/utils/tokens'

const STATUS_CONFIG = {
  pending: {
    label: 'PDF/A pendente',
    short: 'PDF/A pend.',
    variant: 'secondary',
    Icon: Clock,
  },
  processing: {
    label: 'PDF/A em andamento',
    short: 'PDF/A…',
    variant: 'info',
    Icon: Loader2,
    spin: true,
  },
  done: {
    label: 'PDF/A disponível',
    short: 'PDF/A ok',
    variant: 'success',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'PDF/A falhou',
    short: 'PDF/A erro',
    variant: 'destructive',
    Icon: XCircle,
  },
  not_needed: {
    label: 'PDF/A não necessário',
    short: 'sem PDF/A',
    variant: 'secondary',
    Icon: FileX,
  },
  none: {
    label: 'PDF/A não avaliado',
    short: 'PDF/A ?',
    variant: 'secondary',
    Icon: Archive,
  },
}

function pickStatus(documento) {
  const status = typeof documento === 'string' ? documento : documento?.pdfaStatus
  if (!status) return 'none'
  return STATUS_CONFIG[status] ? status : 'none'
}

export function PdfaStatusBadge({ documento, status: statusProp, short = false, className }) {
  const statusKey = useMemo(
    () => pickStatus(statusProp ?? documento),
    [documento, statusProp]
  )
  const config = STATUS_CONFIG[statusKey]
  const Icon = config.Icon

  return (
    <Badge
      variant={config.variant}
      badgeStyle="subtle"
      className={cn('gap-1', className)}
      icon={
        <Icon
          className={cn('size-3', config.spin && 'animate-spin')}
          aria-hidden="true"
        />
      }
      title={config.label}
      aria-label={config.label}
    >
      {short ? config.short : config.label}
    </Badge>
  )
}

export const PDFA_BADGE_STATUSES = Object.keys(STATUS_CONFIG)
