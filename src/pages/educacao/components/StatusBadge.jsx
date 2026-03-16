import { Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
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

// Classes customizadas para melhor visualização
const statusClasses = {
  nao_iniciado: 'bg-white/90 text-gray-700 dark:bg-white/90 dark:text-gray-700',
};

export function StatusBadge({ status }) {
  const variant = statusVariants[status] || 'secondary';
  const badgeStyle = statusStyles[status] || 'subtle';
  const label = getStatusLabel(status);
  const customClass = statusClasses[status] || '';

  return (
    <Badge
      variant={variant}
      badgeStyle={badgeStyle}
      className={cn("uppercase", customClass)}
    >
      {label}
    </Badge>
  );
}
