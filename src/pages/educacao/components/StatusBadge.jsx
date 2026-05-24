import { Badge } from '@/design-system';
import { getStatusLabel } from '../data/educacaoUtils';

// Mapear status para variantes do Badge do Design System
const statusVariants = {
  nao_iniciado: 'secondary',
  em_andamento: 'warning',
  concluido: 'success',
  aprovado: 'success',
  reprovado: 'destructive',
  expirado: 'secondary',
  atrasado: 'destructive',
};

// Mapear status para estilos do Badge
const statusStyles = {
  nao_iniciado: 'solid',
  em_andamento: 'solid',
  concluido: 'solid',
  aprovado: 'solid',
  reprovado: 'solid',
  expirado: 'solid',
  atrasado: 'subtle',
};

export function StatusBadge({ status }) {
  const variant = statusVariants[status] || 'secondary';
  const badgeStyle = statusStyles[status] || 'subtle';
  const label = getStatusLabel(status);

  return (
    <Badge
      variant={variant}
      badgeStyle={badgeStyle}
      className="uppercase"
    >
      {label}
    </Badge>
  );
}
