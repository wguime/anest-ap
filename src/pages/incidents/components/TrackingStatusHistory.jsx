import { Activity } from 'lucide-react';
import { STATUS_CONFIG } from '@/data/incidentesConfig';
import { formatDate } from '../trackingConfig';

/**
 * Timeline de status customizada (não usa DS Timeline)
 * Segue o layout original: título do status primeiro, data abaixo
 */
function StatusTimeline({ historicoStatus }) {
  if (!historicoStatus || historicoStatus.length === 0) return null;

  return (
    <div className="space-y-0">
      {historicoStatus.map((item, index) => {
        const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const isLast = index === historicoStatus.length - 1;

        return (
          <div key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${statusConfig.color}20` }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: statusConfig.color }}
                />
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 min-h-[24px] bg-[#E5E7EB] dark:bg-[#2D4A3E]" />
              )}
            </div>
            <div className={`flex-1 ${!isLast ? 'pb-4' : ''}`}>
              <p className="text-sm font-medium text-foreground">
                {statusConfig.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(item.date, true)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Card de histórico de status
 */
export function TrackingStatusHistory({ historicoStatus, accentColor }) {
  if (!historicoStatus || historicoStatus.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-muted rounded-2xl p-4 border border-[#E5E7EB] dark:border-border mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-semibold text-foreground">
          Histórico de Status
        </h3>
      </div>
      <StatusTimeline historicoStatus={historicoStatus} />
    </div>
  );
}
