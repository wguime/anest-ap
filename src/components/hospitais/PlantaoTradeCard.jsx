/**
 * PlantaoTradeCard
 * Card para exibir uma solicitação de troca de plantão hospitalar (FDS/feriado).
 * Memoizado para evitar re-renders quando contextos globais atualizam.
 */
import { memo } from 'react';
import { Badge, Button } from '@/design-system';
import { Calendar, User, Clock, MessageSquare, ArrowLeftRight, Building2 } from 'lucide-react';
import { formatDate as formatDateIntl } from '@/utils/formatters';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', variant: 'warning' },
  aceita: { label: 'Aceita', variant: 'success' },
  rejeitada: { label: 'Rejeitada', variant: 'destructive' },
  cancelada: { label: 'Cancelada', variant: 'secondary' },
};

const HOSPITAL_LABELS = {
  hro: 'HRO',
  unimed: 'UNIMED',
  plantao_pago: 'Plantão Pago',
};

const TURNO_LABELS = {
  manha: '07h–15h',
  tarde: '15h–23h',
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
  return formatDateIntl(date, 'dayMonth');
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

function formatSlot(hospital, turno) {
  if (!hospital) return null;
  return `${HOSPITAL_LABELS[hospital] || hospital} (${TURNO_LABELS[turno] || turno})`;
}

const PlantaoTradeCard = memo(function PlantaoTradeCard({ trade, currentUserId, onAccept, onReject, onCancel }) {
  const statusConfig = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pendente;
  const isPendente = trade.status === 'pendente';
  const isSolicitante = currentUserId === trade.solicitanteId;
  const slotOferta = formatSlot(trade.hospital, trade.turno);
  const slotRetorno = formatSlot(trade.hospitalDesejado, trade.turnoDesejado);
  const isDia = trade.escopo === 'dia';

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge badgeStyle="outline" variant="default">
            <span className="font-mono text-[10px] tracking-wider">
              {trade.codigo || 'PH------'}
            </span>
          </Badge>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(trade.criadoEm)}
          </span>
        </div>
        <Badge variant={statusConfig.variant}>
          {statusConfig.label}
        </Badge>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {trade.solicitanteNome || 'Solicitante'}
          </span>
          {isDia && (
            <Badge badgeStyle="outline" variant="secondary" className="text-[10px]">
              Dia inteiro
            </Badge>
          )}
        </div>

        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-0.5">
            <div>
              {formatDate(trade.dataPlantao)}
              {slotOferta && (
                <span className="ml-1 text-foreground font-medium">· {slotOferta}</span>
              )}
            </div>
            {trade.dataDesejada && (
              <div className="flex items-center gap-1">
                <ArrowLeftRight className="w-3 h-3 text-primary" />
                <span className="font-medium text-foreground">
                  {formatDate(trade.dataDesejada)}
                  {slotRetorno && <span className="ml-1">· {slotRetorno}</span>}
                </span>
              </div>
            )}
          </div>
        </div>

        {trade.destinatarioNome && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              Para: <span className="font-medium text-primary">{trade.destinatarioNome}</span>
            </span>
          </div>
        )}
      </div>

      {trade.descricao && (
        <div className="flex gap-2 mb-3 bg-muted rounded-xl p-2.5">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {trade.descricao}
          </p>
        </div>
      )}

      {isPendente && !isSolicitante && (onAccept || onReject) && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button variant="success" size="sm" className="flex-1" onClick={() => onAccept?.(trade.codigo)}>
            Aceitar
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={() => onReject?.(trade.codigo)}>
            Rejeitar
          </Button>
        </div>
      )}

      {isPendente && isSolicitante && (
        <div className="pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={() => onCancel?.(trade.codigo)}>
            Cancelar Solicitação
          </Button>
        </div>
      )}
    </div>
  );
});

export default PlantaoTradeCard;
