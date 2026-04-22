/**
 * EventoStatusBadge - Badge de status para eventos
 * Usa componente Badge do DS via mapping hex → variant.
 */
import { Badge } from '@/design-system';
import { STATUS_EVENTO } from '../../data/cbhpmData';

// STATUS_EVENTO.cor são hex que espelham tokens DS. Mapeamos para variant do Badge.
const COR_TO_TOKEN = {
  '#6B7280': { variant: 'secondary', dot: 'bg-muted-foreground' },
  '#F59E0B': { variant: 'warning', dot: 'bg-warning' },
  '#004225': { variant: 'default', dot: 'bg-primary' },
  '#2E8B57': { variant: 'default', dot: 'bg-greenBright' },
  '#34C759': { variant: 'success', dot: 'bg-success' },
  '#DC2626': { variant: 'destructive', dot: 'bg-destructive' },
};

export function EventoStatusBadge({ status, size = 'default' }) {
  const statusInfo = STATUS_EVENTO[status?.toUpperCase()] || STATUS_EVENTO.RASCUNHO;
  const token = COR_TO_TOKEN[statusInfo.cor] || COR_TO_TOKEN['#6B7280'];

  return (
    <Badge variant={token.variant} badgeStyle="subtle" size={size}>
      <span className={`w-2 h-2 rounded-full mr-2 ${token.dot}`} />
      {statusInfo.descricao}
    </Badge>
  );
}

/**
 * WorkflowStatus - Exibe o workflow completo de status
 */
export function WorkflowStatus({ currentStatus }) {
  const statusOrder = ['rascunho', 'pendente', 'aprovado', 'faturado', 'pago'];
  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1">
      {statusOrder.map((status, index) => {
        const statusInfo = STATUS_EVENTO[status.toUpperCase()];
        const isActive = index <= currentIndex;
        const isCurrent = status === currentStatus;
        const token = COR_TO_TOKEN[statusInfo.cor] || COR_TO_TOKEN['#6B7280'];

        return (
          <div key={status} className="flex items-center">
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                isActive ? token.dot : 'bg-border-strong'
              } ${isCurrent ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
              title={statusInfo.descricao}
            />
            {index < statusOrder.length - 1 && (
              <div
                className={`w-4 h-0.5 mx-0.5 ${
                  index < currentIndex ? token.dot : 'bg-border-strong'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EventoStatusBadge;
