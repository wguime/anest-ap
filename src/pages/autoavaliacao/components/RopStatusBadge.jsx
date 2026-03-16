import { AVALIACAO_STATUS } from '@/data/autoavaliacaoConfig'
import { Badge } from '@/design-system'

export default function RopStatusBadge({ status }) {
  const config = AVALIACAO_STATUS[status] || AVALIACAO_STATUS.nao_avaliado
  const Icon = config.icon

  return (
    <Badge variant={config.variant} badgeStyle="subtle" dot>
      {config.label}
    </Badge>
  )
}
