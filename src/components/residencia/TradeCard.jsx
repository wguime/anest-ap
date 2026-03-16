/**
 * TradeCard
 * Card para exibir uma solicitação de troca de plantão
 */
import { Badge, Button } from '@/design-system';
import { Calendar, User, Clock, MessageSquare } from 'lucide-react';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', variant: 'warning' },
  aceita: { label: 'Aceita', variant: 'success' },
  rejeitada: { label: 'Rejeitada', variant: 'destructive' },
  cancelada: { label: 'Cancelada', variant: 'secondary' },
};

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';

  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDate(dateStr) {
  if (!dateStr) return 'Data não definida';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function TradeCard({ trade, currentUserId, onAccept, onReject, onCancel }) {
  const statusConfig = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pendente;
  const isPendente = trade.status === 'pendente';
  const isSolicitante = currentUserId === trade.solicitanteId;

  return (
    <div className="bg-white dark:bg-[#1A2420] rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36] p-4 shadow-sm dark:shadow-none">
      {/* Header: código + status + tempo */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge badgeStyle="outline" variant="default">
            <span className="font-mono text-[10px] tracking-wider">
              {trade.codigo || 'TR------'}
            </span>
          </Badge>
          <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF] dark:text-[#6B8178]">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(trade.criadoEm)}
          </span>
        </div>
        <Badge variant={statusConfig.variant}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#006837] dark:text-[#2ECC71] shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {trade.solicitanteNome || 'Solicitante'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#6B7280] dark:text-[#6B8178] shrink-0" />
          <span className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
            {formatDate(trade.dataPlantao)}
          </span>
        </div>

        {trade.destinatarioNome && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#6B7280] dark:text-[#6B8178] shrink-0" />
            <span className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
              Para: <span className="font-medium text-[#006837] dark:text-[#2ECC71]">{trade.destinatarioNome}</span>
            </span>
          </div>
        )}
      </div>

      {/* Descrição */}
      {trade.descricao && (
        <div className="flex gap-2 mb-3 bg-[#E8F5E9] dark:bg-[#1A2F23] rounded-xl p-2.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#9CA3AF] dark:text-[#6B8178] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[#6B7280] dark:text-[#A3B8B0] leading-relaxed">
            {trade.descricao}
          </p>
        </div>
      )}

      {/* Botões de ação */}
      {isPendente && !isSolicitante && (onAccept || onReject) && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#E8F5E9] dark:border-[#2A3F36]">
          <Button
            variant="success"
            size="sm"
            className="flex-1"
            onClick={() => onAccept?.(trade.codigo)}
          >
            Aceitar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => onReject?.(trade.codigo)}
          >
            Rejeitar
          </Button>
        </div>
      )}

      {isPendente && isSolicitante && (
        <div className="pt-2 border-t border-[#E8F5E9] dark:border-[#2A3F36]">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onCancel?.(trade.codigo)}
          >
            Cancelar Solicitação
          </Button>
        </div>
      )}
    </div>
  );
}

export default TradeCard;
