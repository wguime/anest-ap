import { Clock, CheckCircle2, Search } from 'lucide-react';
import { STATUS_CONFIG } from '@/data/incidentesConfig';

/**
 * Cabeçalho do card de status com protocolo e badge de status
 * Usa styling inline para consistência com design original
 */
export function TrackingHeader({ protocol, status }) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  // Ícone baseado no status
  const StatusIcon = () => {
    if (status === 'resolved' || status === 'closed') {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    if (status === 'in_review' || status === 'investigating') {
      return <Search className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">Protocolo</p>
        <p className="text-lg font-mono font-bold text-[#111827] dark:text-white">
          {protocol}
        </p>
      </div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          backgroundColor: `${statusConfig.color}20`,
          color: statusConfig.color,
        }}
      >
        <StatusIcon />
        <span className="text-sm font-medium">{statusConfig.label}</span>
      </div>
    </div>
  );
}
