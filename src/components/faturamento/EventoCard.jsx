/**
 * EventoCard - Card para exibição de evento de faturamento
 * Seguindo o padrão visual do design system ANEST
 * Memoizado para evitar re-renders quando contextos globais atualizam.
 */
import { memo } from 'react';
import { Calendar, Building2, User, Stethoscope, DollarSign, ChevronRight } from 'lucide-react';
import { formatarMoeda, STATUS_EVENTO } from '../../data/cbhpmData';
import { formatDate as formatDateBR } from '@/utils/formatters';

export const EventoCard = memo(function EventoCard({ evento, onClick, compact = false }) {
  const statusInfo = STATUS_EVENTO[evento.status?.toUpperCase()] || STATUS_EVENTO.RASCUNHO;

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return formatDateBR(d, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  // Status badge variant
  const getStatusBadgeClasses = () => {
    switch (statusInfo.cor) {
      case '#34C759': return 'bg-muted text-primary';
      case '#DC2626': return 'bg-destructive/10 text-destructive';
      case '#F59E0B': return 'bg-warning/10 text-warning';
      case '#004225': return 'bg-muted text-foreground';
      case '#2E8B57': return 'bg-muted text-greenBright dark:text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 bg-card rounded-xl border border-border text-left hover:border-primary dark:hover:border-primary transition-all active:scale-[0.99]"
      >
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-semibold text-[14px] text-foreground truncate">
            {evento.patientName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {evento.procedureDescription || 'Procedimento não informado'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] font-bold text-primary">
            {formatarMoeda(evento.finalValue)}
          </span>
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: statusInfo.cor }}
          />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-[20px] p-4 bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none cursor-pointer hover:-translate-y-px hover:shadow-elevation-2 hover:border-primary dark:hover:border-primary transition-all active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] text-foreground truncate leading-tight">
            {evento.patientName}
          </h3>
          <p className="text-[12px] text-muted-foreground truncate mt-1">
            {evento.procedureDescription || 'Procedimento não informado'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${getStatusBadgeClasses()}`}>
            {statusInfo.descricao}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{formatDate(evento.eventDate)}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{evento.hospitalName || '-'}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Stethoscope className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{evento.healthInsuranceName || '-'}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{evento.anesthesiologistName || '-'}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Porte:</span>
          <span className="font-semibold text-foreground px-1.5 py-0.5 bg-muted rounded">
            {evento.porte || '-'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-success" />
          <span className="font-bold text-[16px] text-primary">
            {formatarMoeda(evento.finalValue)}
          </span>
        </div>
      </div>
    </button>
  );
});

export default EventoCard;
