import { Calendar, Clock, MapPin } from 'lucide-react';
import { formatDate } from '../trackingConfig';

/**
 * Exibe datas e informações temporais do relato
 * Layout em linhas para melhor legibilidade mobile
 */
export function TrackingDates({ createdAt, occurredAt, occurredTime, location }) {
  return (
    <div className="flex items-center gap-4 text-xs text-[#6B7280] dark:text-[#6B8178] flex-wrap">
      {createdAt && (
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Registrado em {formatDate(createdAt)}
        </span>
      )}
      {occurredAt && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Ocorrência: {formatDate(occurredAt)}
        </span>
      )}
      {occurredTime && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {occurredTime}
        </span>
      )}
      {location && (
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {location}
        </span>
      )}
    </div>
  );
}
