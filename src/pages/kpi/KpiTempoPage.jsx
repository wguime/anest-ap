import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
  BottomNav,
} from '@/design-system';
import {
  GraduationCap,
  ChevronLeft,
  Clock,
  FileText,
  TrendingDown,
  Timer,
} from 'lucide-react';

export default function KpiTempoPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('painelGestao')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Tempo de Atendimento
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

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 border border-[#C8E6C9] dark:border-[#2A3F36]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-[#004225] dark:text-white">Tempo de Atendimento</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Eficiencia operacional</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F0FFF4] dark:bg-[#243530] rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#006837] dark:text-[#2ECC71]">18min</p>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">Tempo Medio</p>
            </div>
            <div className="bg-[#F0FFF4] dark:bg-[#243530] rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#006837] dark:text-[#2ECC71]">&le;20min</p>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">Meta</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre este Indicador">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-[#059669] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#004225] dark:text-white">Objetivo</p>
                <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Otimizar o fluxo de atendimento ao paciente</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#2563eb] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#004225] dark:text-white">Metodologia</p>
                <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Medicao de timestamps em cada etapa</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Timer className="w-5 h-5 text-[#2563eb] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#004225] dark:text-white">Etapas Monitoradas</p>
                <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Chegada, triagem, avaliacao, alta</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-[#6B7280] dark:text-[#6B8178]" fill="none" />,
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
