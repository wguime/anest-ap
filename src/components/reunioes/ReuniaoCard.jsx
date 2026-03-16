/**
 * ReuniaoCard - Card component for displaying meeting information
 * @param {object} reuniao - Meeting data object
 * @param {function} onClick - Callback when card is clicked
 */
import { Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';

import {
  Users,
  ShieldCheck,
  Stethoscope,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Calendar,
  Clock,
  MapPin,
} from 'lucide-react';

// Map type IDs to icon components
const TIPO_ICONS = {
  comite_qualidade: ShieldCheck,
  reuniao_equipe: Users,
  morbimortalidade: Stethoscope,
  sessao_cientifica: BookOpen,
  planejamento: CalendarClock,
  auditoria_interna: ClipboardList,
};

// Map type IDs to colors
const TIPO_COLORS = {
  comite_qualidade: '#059669',
  reuniao_equipe: '#2563eb',
  morbimortalidade: '#dc2626',
  sessao_cientifica: '#7c3aed',
  planejamento: '#f59e0b',
  auditoria_interna: '#64748b',
};

// Map type IDs to labels
const TIPO_LABELS = {
  comite_qualidade: 'Comitê de Qualidade',
  reuniao_equipe: 'Reunião de Equipe',
  morbimortalidade: 'Morbimortalidade',
  sessao_cientifica: 'Sessão Científica',
  planejamento: 'Planejamento',
  auditoria_interna: 'Auditoria Interna',
};

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
    // Handle Firestore Timestamp
    if (dateValue?.toDate) {
      dateValue = dateValue.toDate();
    }
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    // Handle string
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

export default function ReuniaoCard({ reuniao, onClick }) {
  const { titulo, data, horario, tipo, local, status = 'agendada' } = reuniao;

  const IconComponent = TIPO_ICONS[tipo] || Users;
  const color = TIPO_COLORS[tipo] || '#059669';
  const tipoLabel = TIPO_LABELS[tipo] || '';
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
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-accent"
      >
        <IconComponent className="w-5 h-5 text-primary" />
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
        {tipoLabel && (
          <span
            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-1.5 bg-accent text-primary"
          >
            {tipoLabel}
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
}

// Export STATUS_CONFIG for use in other components
export { STATUS_CONFIG };
