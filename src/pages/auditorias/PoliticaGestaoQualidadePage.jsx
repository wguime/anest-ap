import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav } from '@/design-system';
import { GraduationCap, ChevronLeft, Shield, FileText, CheckCircle, Target, Users, TrendingUp } from 'lucide-react';

// ============================================================================
// DADOS DA POLITICA DE GESTAO DA QUALIDADE
// ============================================================================

const PRINCIPIOS = [
  {
    id: 'foco-paciente',
    title: 'Foco no Paciente',
    description: 'Atender as necessidades e expectativas dos pacientes, garantindo seguranca e satisfacao em todos os processos assistenciais.',
    icon: Users,
  },
  {
    id: 'melhoria-continua',
    title: 'Melhoria Continua',
    description: 'Busca constante pela excelência através da análise de indicadores, auditorias e implementação de ações corretivas e preventivas.',
    icon: TrendingUp,
  },
  {
    id: 'seguranca',
    title: 'Seguranca do Paciente',
    description: 'Prevencao de eventos adversos e danos ao paciente atraves de protocolos, treinamentos e cultura de notificacao.',
    icon: Shield,
  },
  {
    id: 'conformidade',
    title: 'Conformidade Regulatoria',
    description: 'Atendimento aos requisitos legais, normativos e de acreditacao aplicaveis aos servicos de anestesiologia.',
    icon: CheckCircle,
  },
];

const OBJETIVOS = [
  'Manter a acreditacao Qmentum com nivel de excelencia',
  'Reduzir eventos adversos relacionados a anestesia',
  'Aumentar a satisfacao dos pacientes e equipe medica',
  'Garantir conformidade com os 6 ROPs de seguranca do paciente',
  'Promover cultura de qualidade e seguranca entre os colaboradores',
  'Monitorar e melhorar continuamente os indicadores de desempenho',
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function PoliticaGestaoQualidadePage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  const handleNavigate = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => handleNavigate('auditorias')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Politica de Gestao da Qualidade
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {/* Header Card */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Politica de Gestao da Qualidade</h3>
              <p className="text-sm text-muted-foreground">Diretrizes institucionais ANEST</p>
            </div>
          </div>
        </div>

        {/* Declaracao */}
        <SectionCard title="Declaracao" icon={<FileText className="w-5 h-5 text-[#7c3aed]" />}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Servico de Anestesiologia ANEST esta comprometido com a excelencia na prestacao
            de servicos de anestesia, priorizando a seguranca do paciente, a satisfacao da
            equipe e a melhoria continua de seus processos. Nossa politica de qualidade
            estabelece as diretrizes fundamentais para alcancar e manter os mais altos
            padroes de atendimento, alinhados aos requisitos de acreditacao Qmentum e as
            melhores praticas internacionais.
          </p>
        </SectionCard>

        {/* Principios */}
        <SectionCard title="Principios Fundamentais" icon={<Target className="w-5 h-5 text-success" />}>
          <div className="space-y-3">
            {PRINCIPIOS.map((principio) => {
              const IconComponent = principio.icon;
              return (
                <div
                  key={principio.id}
                  className="bg-muted rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        {principio.title}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {principio.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Objetivos */}
        <SectionCard title="Objetivos da Qualidade" icon={<CheckCircle className="w-5 h-5 text-[#2563eb]" />}>
          <div className="space-y-2">
            {OBJETIVOS.map((objetivo, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-white dark:bg-muted rounded-lg border border-border"
              >
                <div className="w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{index + 1}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {objetivo}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Responsabilidades */}
        <SectionCard title="Responsabilidades">
          <div className="space-y-3">
            <div className="bg-[#FEF3C7] dark:bg-[#78350f]/30 rounded-lg p-3 border border-[#FCD34D] dark:border-[#92400e]">
              <h4 className="font-semibold text-[#92400e] dark:text-warning text-sm mb-1">
                Direcao
              </h4>
              <p className="text-sm text-[#B45309] dark:text-warning">
                Definir diretrizes, prover recursos e garantir a implementacao da politica de qualidade.
              </p>
            </div>
            <div className="bg-[#DBEAFE] dark:bg-[#1e3a5f]/30 rounded-lg p-3 border border-[#93C5FD] dark:border-[#1e40af]">
              <h4 className="font-semibold text-[#1e40af] dark:text-[#93C5FD] text-sm mb-1">
                Comite de Qualidade
              </h4>
              <p className="text-sm text-[#2563eb] dark:text-[#60A5FA]">
                Monitorar indicadores, analisar eventos e propor acoes de melhoria continua.
              </p>
            </div>
            <div className="bg-muted dark:bg-[#14532d]/30 rounded-lg p-3 border border-border dark:border-[#166534]">
              <h4 className="font-semibold text-[#166534] dark:text-[#A5D6A7] text-sm mb-1">
                Colaboradores
              </h4>
              <p className="text-sm text-[#15803d] dark:text-[#86EFAC]">
                Cumprir protocolos, notificar eventos e participar ativamente das acoes de qualidade.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground" fill="none" />, active: false, id: 'education' },
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
