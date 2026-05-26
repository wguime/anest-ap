import { useMemo } from 'react';
import { SectionCard, Timeline, EmptyState } from '@/design-system';
import { Clock } from 'lucide-react';
import { STATUS_CONFIG } from '@/services/reunioesService';

/**
 * HistoricoTab — Timeline of status changes. Uses Timeline DS component.
 */
export default function HistoricoTab({ statusHistorico, formatDateTime }) {
  // Preparar itens da timeline
  const timelineItems = useMemo(() => {
    return statusHistorico.map((item, index) => {
      const config = STATUS_CONFIG[item.newStatus] || STATUS_CONFIG.agendada;

      return {
        id: item.id,
        title: `${config.label}${item.comment ? ` - ${item.comment}` : ''}`,
        description: `Por ${item.userName}`,
        timestamp: formatDateTime(item.timestamp),
        status: index === 0 ? 'active' : 'completed',
      };
    });
  }, [statusHistorico, formatDateTime]);

  if (timelineItems.length === 0) {
    return (
      <SectionCard
        title="Histórico de Status"
        subtitle="Linha do tempo da reunião"
      >
        <EmptyState
          size="sm"
          icon={<Clock className="h-full w-full" aria-hidden="true" />}
          title="Sem histórico"
          description="Nenhuma mudança de status registrada."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Histórico de Status"
      subtitle="Linha do tempo da reunião"
    >
      <Timeline
        items={timelineItems}
        orientation="vertical"
        size="default"
        animated={false}
      />
    </SectionCard>
  );
}
