import { AlertTriangle, Flag } from 'lucide-react';
import { useIncidents } from '@/contexts/IncidentsContext';
import { INCIDENT_TYPES, SEVERITY_LEVELS, LOCAIS } from '@/data/incidentesConfig';
import { PageHeader } from '../../components';
import { TRACKING_THEMES } from './trackingConfig';
import { TrackingNotFound, TrackingHeader, TrackingCodeAlert, TrackingBadges, TrackingDates, TrackingSummary, TrackingStatusHistory, TrackingResponses, TrackingConclusion, TrackingPrivacyNote } from './components';

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

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title={theme.pageTitle} onBack={() => onNavigate('meusRelatos')} />

      <div className="px-4 sm:px-5">
        {/* Card de Status Principal */}
        <div className="bg-card rounded-2xl p-4 border border-border mb-4">
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
