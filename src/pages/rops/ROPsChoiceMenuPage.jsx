import { createPortal } from 'react-dom';
import { WidgetCard } from '@/design-system';
import {
  ChevronLeft,
  FileQuestion,
  Headphones,
  Shield,
  MessageSquare,
  Pill,
  Users,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import ropsData from '@/data/rops-data';
import podcastsData from '@/data/podcasts-data';

// Mapeamento de ícones por área
const AREA_ICONS = {
  'cultura-seguranca': Shield,
  'comunicacao': MessageSquare,
  'uso-medicamentos': Pill,
  'vida-profissional': Users,
  'prevencao-infeccoes': Sparkles,
  'avaliacao-riscos': AlertTriangle,
};

// Cores por área
const AREA_COLORS = {
  'cultura-seguranca': { color: '#9C27B0', gradient: 'linear-gradient(135deg, #9C27B0 0%, #673AB7 100%)' },
  'comunicacao': { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  'uso-medicamentos': { color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' },
  'vida-profissional': { color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
  'prevencao-infeccoes': { color: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)' },
  'avaliacao-riscos': { color: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
};

export default function ROPsChoiceMenuPage({ onNavigate, goBack, areaKey }) {
  const area = ropsData[areaKey];
  const AreaIcon = AREA_ICONS[areaKey] || Shield;
  const areaColors = AREA_COLORS[areaKey] || { color: '#006837', gradient: 'linear-gradient(135deg, #006837 0%, #004225 100%)' };

  // Contar questões
  const totalQuestions = area?.subdivisoes
    ? Object.values(area.subdivisoes).reduce((sum, rop) => sum + (rop.questions?.length || 0), 0)
    : 0;

  // Contar podcasts
  const podcastsArea = podcastsData?.[areaKey];
  const totalPodcasts = podcastsArea?.audios?.length || 0;

  if (!area) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] flex flex-col items-center justify-center p-4">
        <p className="text-[#004225] dark:text-white text-lg font-bold mb-2">Área não encontrada</p>
        <p className="text-[#6B7280] dark:text-[#6B8178] text-sm mb-4">areaKey: "{areaKey || 'undefined'}"</p>
        <button
          type="button"
          onClick={goBack}
          className="px-4 py-2 bg-[#006837] text-white rounded-lg"
        >
          Voltar
        </button>
      </div>
    );
  }

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            {area.title}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner */}
        <div className="mb-4 p-4 rounded-[16px] bg-[#D4EDDA] dark:bg-[#1A2420] dark:border dark:border-[#2A3F36]">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: areaColors.gradient }}
            >
              <AreaIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#002215] dark:text-white">
                {area.title}
              </h2>
              <p className="text-[13px] text-[#004225] dark:text-[#A3B8B0] mt-1">
                Escolha como deseja estudar esta área temática
              </p>
            </div>
          </div>
        </div>

        {/* Cards de Escolha */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {/* Card Questões */}
          <WidgetCard
            icon={
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: areaColors.gradient }}
              >
                <FileQuestion className="w-5 h-5 text-white" />
              </div>
            }
            iconClassName="!bg-transparent !p-0"
            title="Questões"
            subtitle={`${totalQuestions} questões`}
            variant="interactive"
            onClick={() => onNavigate('ropsSubdivisoes', { areaKey })}
          />

          {/* Card Podcasts */}
          <WidgetCard
            icon={
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: totalPodcasts > 0 ? areaColors.gradient : 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)' }}
              >
                <Headphones className="w-5 h-5 text-white" />
              </div>
            }
            iconClassName="!bg-transparent !p-0"
            title="Podcasts"
            subtitle={totalPodcasts > 0 ? `${totalPodcasts} áudios` : 'Em breve'}
            variant={totalPodcasts > 0 ? 'interactive' : 'default'}
            onClick={totalPodcasts > 0 ? () => onNavigate('ropsPodcasts', { areaKey }) : undefined}
            className={totalPodcasts === 0 ? 'opacity-60 cursor-not-allowed' : ''}
          />
        </div>

        {/* Info Box */}
        <div className="mt-4 p-4 rounded-[16px] bg-[#E8F5E9] dark:bg-[#243530] border border-[#C8E6C9] dark:border-[#2A3F36]">
          <h3 className="text-[13px] font-bold text-[#004225] dark:text-[#2ECC71] mb-2">
            Dica
          </h3>
          <p className="text-[12px] text-[#006837] dark:text-[#A3B8B0]">
            {totalPodcasts > 0
              ? 'Combine estudo com questões e podcasts para melhor absorção do conteúdo.'
              : 'Comece pelas questões para testar seus conhecimentos sobre as ROPs desta área.'}
          </p>
        </div>
      </div>
    </div>
  );
}
