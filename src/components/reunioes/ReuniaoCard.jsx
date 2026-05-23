/**
 * ReuniaoCard - Card component for displaying meeting information
 * Memoizado para evitar re-renders quando contextos globais atualizam.
 * @param {object} reuniao - Meeting data object
 * @param {function} onClick - Callback when card is clicked
 */
import { memo } from 'react';
import { Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { getTipoReuniao } from '@/constants/reunioes';

// Status badge configuration (using DS semantic variants)
const STATUS_CONFIG = {
  agendada: {
    label: 'Agendada',
    variant: 'default',
    badgeStyle: 'solid',
  },
  em_preparacao: {
    label: 'Em Preparação',
    variant: 'warning',
    badgeStyle: 'solid',
  },
  em_andamento: {
    label: 'Em Andamento',
    variant: 'success',
    badgeStyle: 'solid',
  },
  concluida: {
    label: 'Concluída',
    variant: 'secondary',
    badgeStyle: 'outline',
  },
  cancelada: {
    label: 'Cancelada',
    variant: 'destructive',
    badgeStyle: 'outline',
  },
};

/**
 * Safely format any date value (Date object, Timestamp, string) to Brazilian format
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  try {
    if (dateValue?.toDate) {
      dateValue = dateValue.toDate();
    }
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00');
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    return '';
  } catch {
    return '';
  }
}

const ReuniaoCard = memo(function ReuniaoCard({ reuniao, onClick }) {
  const { titulo, data, horario, tipo, local, status = 'agendada' } = reuniao;

  const tipoConfig = getTipoReuniao(tipo);
  const IconComponent = tipoConfig.icon;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.agendada;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  const formattedDate = formatDate(data);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full flex gap-3',
        'bg-card',
        'border border-border',
        'rounded-xl p-3.5',
        'hover:border-primary',
        'hover:shadow-md',
        'active:scale-[0.99]',
        'transition-all duration-200',
        'text-left cursor-pointer',
        'focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
          tipoConfig.iconWrapperClass
        )}
      >
        <IconComponent className={cn('w-5 h-5', tipoConfig.iconClass)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Title + Badge */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {titulo}
          </h3>
          <div className="flex-shrink-0">
            <Badge
              variant={statusConfig.variant}
              badgeStyle={statusConfig.badgeStyle}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Row 2: Tipo badge */}
        {tipoConfig.title && (
          <span
            className={cn(
              'inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-1.5',
              tipoConfig.badgeClass
            )}
          >
            {tipoConfig.title}
          </span>
        )}

        {/* Row 3: Date + Time */}
        <div className="flex items-center gap-x-3 text-xs text-muted-foreground">
          {formattedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
          )}
          {horario && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {horario}
            </span>
          )}
        </div>

        {/* Row 4: Location (always on its own line) */}
        {local && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{local}</span>
          </div>
        )}
      </div>
    </button>
  );
});

export default ReuniaoCard;

// Export STATUS_CONFIG for use in other components
export { STATUS_CONFIG };
