import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, Eye, FileText, MessageSquare, Heart, Shield, AlertTriangle, Users, Clock } from 'lucide-react';
import { PageHeader } from '../../components';

// ============================================================================
// DADOS DA POLITICA DE DISCLOSURE
// ============================================================================

const ETAPAS_DISCLOSURE = [
  {
    id: 'identificacao',
    title: 'Identificacao do Evento',
    description: 'Reconhecimento e avaliacao inicial do evento adverso ou incidente de seguranca.',
    icon: AlertTriangle,
    color: '#dc2626',
  },
  {
    id: 'preparacao',
    title: 'Preparacao da Equipe',
    description: 'Treinamento e alinhamento da equipe sobre como conduzir a comunicacao.',
    icon: Users,
    color: '#7c3aed',
  },
  {
    id: 'comunicacao',
    title: 'Comunicacao ao Paciente',
    description: 'Dialogo honesto e compassivo com o paciente e/ou familiares sobre o ocorrido.',
    icon: MessageSquare,
    color: '#0891b2',
  },
  {
    id: 'suporte',
    title: 'Suporte Continuo',
    description: 'Acompanhamento e apoio ao paciente, familiares e equipe envolvida.',
    icon: Heart,
    color: '#059669',
  },
  {
    id: 'documentacao',
    title: 'Documentacao',
    description: 'Registro formal de todas as etapas do processo de disclosure.',
    icon: FileText,
    color: '#2563eb',
  },
];

const PRINCIPIOS = [
  'Comunicacao honesta, clara e compassiva',
  'Respeito a autonomia e dignidade do paciente',
  'Transparencia sobre o evento e suas consequencias',
  'Compromisso com a aprendizagem organizacional',
  'Protecao da privacidade e confidencialidade',
  'Suporte emocional a todos os envolvidos',
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function PoliticaDisclosurePage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  const handleNavigate = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Politica de Disclosure" onBack={() => handleNavigate('auditorias')} />

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {/* Header Card */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-category-cyan to-category-cyan flex items-center justify-center">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Politica de Disclosure</h3>
              <p className="text-sm text-muted-foreground">Transparencia e comunicacao aberta</p>
            </div>
          </div>
        </div>

        {/* O que e Disclosure */}
        <SectionCard title="O que e Disclosure?" icon={<Eye className="w-5 h-5 text-category-cyan-fg" />}>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Disclosure e o processo de comunicacao aberta e honesta com pacientes e familiares
            sobre eventos adversos ou incidentes de seguranca que ocorreram durante a
            assistencia a saude. E uma pratica fundamental para construir confianca,
            promover a transparencia e melhorar a seguranca do paciente.
          </p>
          <div className="bg-info/10 dark:bg-info/20 rounded-lg p-3 border border-info/30">
            <p className="text-sm text-info font-medium">
              "A comunicacao aberta nao e apenas uma obrigacao etica, mas uma oportunidade
              de fortalecer a relacao medico-paciente e promover a cura."
            </p>
          </div>
        </SectionCard>

        {/* Etapas do Disclosure */}
        <SectionCard title="Etapas do Processo" icon={<Clock className="w-5 h-5 text-category-purple-fg" />}>
          <div className="space-y-3">
            {ETAPAS_DISCLOSURE.map((etapa, index) => {
              const IconComponent = etapa.icon;
              return (
                <div
                  key={etapa.id}
                  className="bg-white dark:bg-muted rounded-xl p-4 border border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${etapa.color}20` }}
                      >
                        <IconComponent className="w-5 h-5" style={{ color: etapa.color }} />
                      </div>
                      <span
                        className="text-xs font-bold"
                        style={{ color: etapa.color }}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground mb-1">
                        {etapa.title}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {etapa.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Principios */}
        <SectionCard title="Principios Norteadores" icon={<Shield className="w-5 h-5 text-success" />}>
          <div className="space-y-2">
            {PRINCIPIOS.map((principio, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-muted rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                <p className="text-sm text-foreground">
                  {principio}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Card Importante */}
        <div className="bg-warning/10 dark:bg-warning/20 rounded-xl p-4 border border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-warning mb-1">
                Importante
              </h4>
              <p className="text-sm text-warning leading-relaxed">
                Em caso de evento adverso, procure o Comite de Qualidade ou a Coordenacao
                para orientacoes sobre como conduzir o processo de disclosure de forma
                adequada e respeitosa.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
