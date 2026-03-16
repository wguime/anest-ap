import { createPortal } from 'react-dom';
import { AlertTriangle, Flag, ChevronLeft } from 'lucide-react';
import { useIncidents } from '@/contexts/IncidentsContext';
import { INCIDENT_TYPES, SEVERITY_LEVELS, LOCAIS } from '@/data/incidentesConfig';
import { TRACKING_THEMES } from './trackingConfig';
import {
  TrackingNotFound,
  TrackingHeader,
  TrackingCodeAlert,
  TrackingBadges,
  TrackingDates,
  TrackingSummary,
  TrackingStatusHistory,
  TrackingResponses,
  TrackingConclusion,
  TrackingPrivacyNote,
} from './components';

// Mapear severidade para variant do Badge
const severityToVariant = (severity) => {
  switch (severity) {
    case 'leve':
      return 'success';
    case 'moderado':
      return 'warning';
    case 'grave':
    case 'critico':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function AcompanhamentoIncidentePage({ onNavigate, incidenteId }) {
  const { getIncidenteById } = useIncidents();
  const incidente = getIncidenteById(incidenteId);
  const theme = TRACKING_THEMES.incidente;

  if (!incidente) {
    return <TrackingNotFound theme={theme} onBack={() => onNavigate('meusRelatos')} />;
  }

  // Construir badges específicos de incidente
  const tipoConfig = INCIDENT_TYPES[incidente.incidente?.tipo];
  const severityConfig = SEVERITY_LEVELS.find((s) => s.value === incidente.incidente?.severidade);
  const localConfig = LOCAIS.find((l) => l.value === incidente.incidente?.local);

  const badges = [];

  // Badge de tipo
  if (tipoConfig) {
    badges.push({
      icon: AlertTriangle,
      label: tipoConfig.label,
      variant: 'secondary',
    });
  }

  // Badge de severidade
  if (severityConfig) {
    badges.push({
      icon: Flag,
      label: severityConfig.label,
      variant: severityToVariant(incidente.incidente?.severidade),
    });
  }

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('meusRelatos')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            {theme.pageTitle}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Card de Status Principal */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-4 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          <TrackingHeader protocol={incidente.protocolo} status={incidente.status} />

          {/* Código de rastreio */}
          <TrackingCodeAlert
            trackingCode={incidente.trackingCode}
            variant={theme.trackingCodeVariant}
            type={theme.type}
          />

          {/* Badges */}
          <TrackingBadges badges={badges} />

          {/* Datas e localização */}
          <TrackingDates
            createdAt={incidente.createdAt}
            occurredAt={incidente.incidente?.dataOcorrencia}
            occurredTime={incidente.incidente?.horaOcorrencia}
            location={localConfig?.label}
          />
        </div>

        {/* Resumo do Incidente */}
        <TrackingSummary
          description={incidente.incidente?.descricao}
          sectionTitle={theme.summaryTitle}
          accentColor={theme.primaryColor}
        />

        {/* Histórico de Status */}
        <TrackingStatusHistory
          historicoStatus={incidente.admin?.historicoStatus}
          accentColor={theme.primaryColor}
        />

        {/* Atualizações */}
        <TrackingResponses
          respostas={incidente.admin?.respostas}
          defaultResponder={theme.defaultResponder}
          accentColor={theme.primaryColor}
        />

        {/* Conclusão */}
        <TrackingConclusion
          conclusion={incidente.admin?.conclusao}
          variant={theme.conclusionVariant}
        />

        {/* Nota de privacidade */}
        <TrackingPrivacyNote
          isAnonymous={false}
          footerContact={theme.footerContact}
        />
      </div>
    </div>
  );
}
