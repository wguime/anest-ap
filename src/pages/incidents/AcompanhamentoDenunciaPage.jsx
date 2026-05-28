import { ShieldAlert, Eye, AlertCircle } from 'lucide-react';
import { DENUNCIA_TYPES } from '@/data/incidentesConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { PageHeader } from '../../components';
import { TRACKING_THEMES } from './trackingConfig';
import { TrackingNotFound, TrackingHeader, TrackingCodeAlert, TrackingBadges, TrackingDates, TrackingSummary, TrackingStatusHistory, TrackingResponses, TrackingConclusion, TrackingPrivacyNote } from './components';

// Configuração de gravidade
const GRAVIDADE_CONFIG = {
  baixa: { label: 'Gravidade: Baixa', color: '#22C55E', variant: 'success' },
  media: { label: 'Gravidade: Média', color: '#F59E0B', variant: 'warning' },
  alta: { label: 'Gravidade: Alta', color: '#EF4444', variant: 'destructive' },
  critica: { label: 'Gravidade: Crítica', color: '#7C3AED', variant: 'destructive' },
};

export default function AcompanhamentoDenunciaPage({ onNavigate, denunciaId }) {
  const { getDenunciaById } = useIncidents();
  const denuncia = getDenunciaById(denunciaId);
  const theme = TRACKING_THEMES.denuncia;

  if (!denuncia) {
    return <TrackingNotFound theme={theme} onBack={() => onNavigate('meusRelatos')} />;
  }

  // Construir badges específicos de denúncia
  const tipoConfig = DENUNCIA_TYPES.find(t => t.value === denuncia.denuncia?.tipo);
  const gravidadeConfig = denuncia.admin?.gravidade
    ? GRAVIDADE_CONFIG[denuncia.admin.gravidade]
    : null;

  const badges = [];

  // Badge de tipo
  if (tipoConfig) {
    badges.push({
      icon: ShieldAlert,
      label: tipoConfig.label,
      variant: 'secondary',
    });
  }

  // Badge de anônimo
  if (denuncia.denunciante?.isAnonimo) {
    badges.push({
      icon: Eye,
      label: 'Anônimo',
      variant: 'secondary',
    });
  }

  // Badge de gravidade
  if (gravidadeConfig) {
    badges.push({
      icon: AlertCircle,
      label: gravidadeConfig.label,
      variant: gravidadeConfig.variant,
    });
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title={theme.pageTitle} onBack={() => onNavigate('meusRelatos')} />

      <div className="px-4 sm:px-5">
        {/* Card de Status Principal */}
        <div className="bg-card rounded-2xl p-4 border border-border mb-4">
          <TrackingHeader protocol={denuncia.protocolo} status={denuncia.status} />

          {/* Código de rastreio */}
          <TrackingCodeAlert
            trackingCode={denuncia.trackingCode}
            variant={theme.trackingCodeVariant}
            type={theme.type}
          />

          {/* Badges */}
          <TrackingBadges badges={badges} />

          {/* Datas */}
          <TrackingDates
            createdAt={denuncia.createdAt}
            occurredAt={denuncia.denuncia?.dataOcorrencia}
          />
        </div>

        {/* Resumo da Denúncia */}
        <TrackingSummary
          title={denuncia.denuncia?.titulo}
          description={denuncia.denuncia?.descricao}
          sectionTitle={theme.summaryTitle}
          accentColor={theme.primaryColor}
        />

        {/* Histórico de Status */}
        <TrackingStatusHistory
          historicoStatus={denuncia.admin?.historicoStatus}
          accentColor={theme.primaryColor}
        />

        {/* Atualizações */}
        <TrackingResponses
          respostas={denuncia.admin?.respostas}
          defaultResponder={theme.defaultResponder}
          accentColor={theme.primaryColor}
        />

        {/* Conclusão */}
        <TrackingConclusion
          conclusion={denuncia.admin?.conclusao}
          variant={theme.conclusionVariant}
        />

        {/* Nota de privacidade */}
        <TrackingPrivacyNote
          isAnonymous={denuncia.denunciante?.isAnonimo}
          footerContact={theme.footerContact}
        />
      </div>
    </div>
  );
}
