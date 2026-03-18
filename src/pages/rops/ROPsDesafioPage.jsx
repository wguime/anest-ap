import { createPortal } from 'react-dom';
import { WidgetCard } from '@/design-system';
import {
  ChevronLeft,
  Shield,
  MessageSquare,
  Pill,
  Users,
  Sparkles,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import ropsData from '@/data/rops-data';
import podcastsData from '@/data/podcasts-data';

// Configuração das macro áreas
const MACRO_AREAS = [
  {
    id: 'cultura-seguranca',
    title: 'Cultura de Segurança',
    icon: Shield,
    color: '#9C27B0',
    gradient: 'linear-gradient(135deg, #9C27B0 0%, #673AB7 100%)',
  },
  {
    id: 'comunicacao',
    title: 'Comunicação',
    icon: MessageSquare,
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  },
  {
    id: 'uso-medicamentos',
    title: 'Uso de Medicamentos',
    icon: Pill,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  },
  {
    id: 'vida-profissional',
    title: 'Vida Profissional',
    icon: Users,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  },
  {
    id: 'prevencao-infeccoes',
    title: 'Prevenção de Infecções',
    icon: Sparkles,
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
  },
  {
    id: 'avaliacao-riscos',
    title: 'Avaliação de Riscos',
    icon: AlertTriangle,
    color: '#EF4444',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
  },
];

export default function ROPsDesafioPage({ onNavigate, goBack }) {
  // Contar ROPs por área
  const getROPCount = (areaId) => {
    const area = ropsData[areaId];
    if (!area?.subdivisoes) return 0;
    return Object.keys(area.subdivisoes).length;
  };

  // Contar podcasts por área
  const getPodcastCount = (areaId) => {
    const podcastsArea = podcastsData?.[areaId];
    return podcastsArea?.audios?.length || 0;
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Desafio das ROPs
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner */}
        <div className="mb-4 p-4 rounded-[16px] bg-muted dark:border dark:border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-white dark:text-foreground" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground dark:text-white">
                Quiz Gamificado Qmentum
              </h2>
              <p className="text-[13px] text-foreground dark:text-muted-foreground mt-1">
                Teste seus conhecimentos sobre as 32 Práticas Organizacionais Obrigatórias.
                640 questões distribuídas em 6 áreas temáticas.
              </p>
            </div>
          </div>
        </div>

        {/* Card de Ranking - abaixo do info banner, largura total */}
        <button
          type="button"
          onClick={() => onNavigate('ropsRanking')}
          className="w-full mb-4 p-4 rounded-[16px] bg-gradient-to-br from-yellow-400 to-orange-500 text-left shadow-[0_2px_12px_rgba(0,66,37,0.08)] hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.12)] active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-white">
                Ranking
              </h3>
              <p className="text-[13px] text-white/80 mt-0.5">
                Veja sua posição e compare com outros usuários
              </p>
            </div>
          </div>
        </button>

        {/* Grid de Macro Áreas */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-4">
          {MACRO_AREAS.map((area) => {
            const IconComponent = area.icon;
            const ropCount = getROPCount(area.id);
            const podcastCount = getPodcastCount(area.id);

            return (
              <WidgetCard
                key={area.id}
                icon={
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: area.gradient }}
                  >
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                }
                iconClassName="!bg-transparent !p-0"
                title={area.title}
                subtitle={`${ropCount} ROPs • ${podcastCount} podcasts`}
                variant="interactive"
                onClick={() => onNavigate('ropsChoiceMenu', { areaKey: area.id })}
              />
            );
          })}
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">
            Como funciona?
          </h3>
          <ul className="space-y-1 text-[12px] text-primary dark:text-muted-foreground">
            <li>• Escolha uma área temática</li>
            <li>• Escolha entre Questões ou Podcasts</li>
            <li>• Responda 20 questões por ROP</li>
            <li>• Ganhe 10 pontos por resposta correta</li>
            <li>• Compare sua pontuação no ranking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
