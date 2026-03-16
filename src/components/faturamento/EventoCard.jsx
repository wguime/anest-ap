/**
 * EventoCard - Card para exibição de evento de faturamento
 * Seguindo o padrão visual do design system ANEST
 */
import { Calendar, Building2, User, Stethoscope, DollarSign, ChevronRight } from 'lucide-react';
import { formatarMoeda, STATUS_EVENTO } from '../../data/cbhpmData';

export function EventoCard({ evento, onClick, compact = false }) {
  const statusInfo = STATUS_EVENTO[evento.status?.toUpperCase()] || STATUS_EVENTO.RASCUNHO;

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  // Status badge variant
  const getStatusBadgeClasses = () => {
    switch (statusInfo.cor) {
      case '#34C759': return 'bg-[#E8F5E9] text-[#006837] dark:bg-[#1E3A2F] dark:text-[#2ECC71]';
      case '#DC2626': return 'bg-[#FFEBEE] text-[#C62828] dark:bg-[#3F1E1E] dark:text-[#E74C3C]';
      case '#F59E0B': return 'bg-[#FFF3E0] text-[#E65100] dark:bg-[#3F2E1E] dark:text-[#F59E0B]';
      case '#004225': return 'bg-[#E8F5E9] text-[#004225] dark:bg-[#1E3A2F] dark:text-[#2ECC71]';
      case '#2E8B57': return 'bg-[#E8F5E9] text-[#2E8B57] dark:bg-[#1E3A2F] dark:text-[#58D68D]';
      default: return 'bg-[#F3F4F6] text-[#6B7280] dark:bg-[#2A3F36] dark:text-[#A3B8B0]';
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1A2420] rounded-xl border border-[#A5D6A7] dark:border-[#2A3F36] text-left hover:border-[#004225] dark:hover:border-[#2ECC71] transition-all active:scale-[0.99]"
      >
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-semibold text-[14px] text-[#004225] dark:text-white truncate">
            {evento.patientName}
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#6B8178] truncate mt-0.5">
            {evento.procedureDescription || 'Procedimento não informado'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] font-bold text-[#006837] dark:text-[#2ECC71]">
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
      className="w-full text-left rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none cursor-pointer hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] hover:border-[#004225] dark:hover:border-[#2ECC71] transition-all active:scale-[0.99]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] text-[#004225] dark:text-white truncate leading-tight">
            {evento.patientName}
          </h3>
          <p className="text-[12px] text-[#6B7280] dark:text-[#6B8178] truncate mt-1">
            {evento.procedureDescription || 'Procedimento não informado'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${getStatusBadgeClasses()}`}>
            {statusInfo.descricao}
          </span>
          <ChevronRight className="w-4 h-4 text-[#9CA3AF] dark:text-[#6B8178]" />
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#6B8178]">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{formatDate(evento.eventDate)}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#6B8178]">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{evento.hospitalName || '-'}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#6B8178]">
          <Stethoscope className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{evento.healthInsuranceName || '-'}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#6B8178]">
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{evento.anesthesiologistName || '-'}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#E8F5E9] dark:border-[#2A3F36]">
        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#6B8178]">
          <span>Porte:</span>
          <span className="font-semibold text-[#004225] dark:text-white px-1.5 py-0.5 bg-[#E8F5E9] dark:bg-[#243530] rounded">
            {evento.porte || '-'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-[#34C759]" />
          <span className="font-bold text-[16px] text-[#006837] dark:text-[#2ECC71]">
            {formatarMoeda(evento.finalValue)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default EventoCard;
