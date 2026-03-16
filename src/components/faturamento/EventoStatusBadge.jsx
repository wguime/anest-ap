/**
 * EventoStatusBadge - Badge de status para eventos
 */
import { Badge } from '@/design-system';
import { STATUS_EVENTO } from '../../data/cbhpmData';

export function EventoStatusBadge({ status, size = 'default' }) {
  const statusInfo = STATUS_EVENTO[status?.toUpperCase()] || STATUS_EVENTO.RASCUNHO;

  const sizeClasses = {
    small: 'text-xs px-2 py-0.5',
    default: 'text-sm px-3 py-1',
    large: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${statusInfo.cor}20`,
        color: statusInfo.cor,
      }}
    >
      <span
        className="w-2 h-2 rounded-full mr-2"
        style={{ backgroundColor: statusInfo.cor }}
      />
      {statusInfo.descricao}
    </span>
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

        return (
          <div key={status} className="flex items-center">
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                isCurrent ? 'ring-2 ring-offset-1' : ''
              }`}
              style={{
                backgroundColor: isActive ? statusInfo.cor : '#D1D5DB',
                ringColor: isCurrent ? statusInfo.cor : 'transparent',
              }}
              title={statusInfo.descricao}
            />
            {index < statusOrder.length - 1 && (
              <div
                className="w-4 h-0.5 mx-0.5"
                style={{
                  backgroundColor: index < currentIndex ? statusInfo.cor : '#D1D5DB',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EventoStatusBadge;
