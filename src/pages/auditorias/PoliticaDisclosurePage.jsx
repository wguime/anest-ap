import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav } from '@/design-system';
import { GraduationCap, ChevronLeft, Eye, FileText, MessageSquare, Heart, Shield, AlertTriangle, Users, Clock } from 'lucide-react';

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
  const [activeNav, setActiveNav] = useState('shield');

  const handleNavigate = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => handleNavigate('auditorias')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Politica de Disclosure
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {/* Header Card */}
        <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 border border-[#C8E6C9] dark:border-[#2A3F36]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0891b2] to-[#06b6d4] flex items-center justify-center">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[#004225] dark:text-white">Politica de Disclosure</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Transparencia e comunicacao aberta</p>
            </div>
          </div>
        </div>

        {/* O que e Disclosure */}
        <SectionCard title="O que e Disclosure?" icon={<Eye className="w-5 h-5 text-[#0891b2]" />}>
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] leading-relaxed mb-3">
            Disclosure e o processo de comunicacao aberta e honesta com pacientes e familiares
            sobre eventos adversos ou incidentes de seguranca que ocorreram durante a
            assistencia a saude. E uma pratica fundamental para construir confianca,
            promover a transparencia e melhorar a seguranca do paciente.
          </p>
          <div className="bg-[#DBEAFE] dark:bg-[#1e3a5f]/30 rounded-lg p-3 border border-[#93C5FD] dark:border-[#1e40af]">
            <p className="text-sm text-[#1e40af] dark:text-[#93C5FD] font-medium">
              "A comunicacao aberta nao e apenas uma obrigacao etica, mas uma oportunidade
              de fortalecer a relacao medico-paciente e promover a cura."
            </p>
          </div>
        </SectionCard>

        {/* Etapas do Disclosure */}
        <SectionCard title="Etapas do Processo" icon={<Clock className="w-5 h-5 text-[#7c3aed]" />}>
          <div className="space-y-3">
            {ETAPAS_DISCLOSURE.map((etapa, index) => {
              const IconComponent = etapa.icon;
              return (
                <div
                  key={etapa.id}
                  className="bg-white dark:bg-[#243530] rounded-xl p-4 border border-[#C8E6C9] dark:border-[#2A3F36]"
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
                      <h4 className="font-semibold text-[#004225] dark:text-white mb-1">
                        {etapa.title}
                      </h4>
                      <p className="text-sm text-[#6B7280] dark:text-[#6B8178] leading-relaxed">
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
        <SectionCard title="Principios Norteadores" icon={<Shield className="w-5 h-5 text-[#059669]" />}>
          <div className="space-y-2">
            {PRINCIPIOS.map((principio, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-[#E8F5E9] dark:bg-[#243530] rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-[#059669] flex-shrink-0" />
                <p className="text-sm text-[#004225] dark:text-white">
                  {principio}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Card Importante */}
        <div className="bg-[#FEF3C7] dark:bg-[#78350f]/30 rounded-xl p-4 border border-[#FCD34D] dark:border-[#92400e]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-[#FCD34D] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#92400e] dark:text-[#FCD34D] mb-1">
                Importante
              </h4>
              <p className="text-sm text-[#B45309] dark:text-[#FBBF24] leading-relaxed">
                Em caso de evento adverso, procure o Comite de Qualidade ou a Coordenacao
                para orientacoes sobre como conduzir o processo de disclosure de forma
                adequada e respeitosa.
              </p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-[#6B7280] dark:text-[#6B8178]" fill="none" />, active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') handleNavigate('home');
          else if (item.id === 'shield') handleNavigate('gestao');
          else if (item.id === 'education') handleNavigate('educacao');
          else if (item.id === 'menu') handleNavigate('menuPage');
        }}
      />
    </div>
  );
}
