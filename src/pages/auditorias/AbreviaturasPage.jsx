import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav } from '@/design-system';
import { GraduationCap, ChevronLeft, Ban } from 'lucide-react';

export default function AbreviaturasPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button type="button" onClick={() => onNavigate('auditorias')} className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">Abreviaturas Perigosas</h1>
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
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] dark:bg-[#2A3F36] flex items-center justify-center">
              <Ban className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#004225] dark:text-white">Abreviaturas Perigosas</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Identificacao e correcao</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre">
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Esta secao apresenta as auditorias de identificacao e correcao de abreviaturas perigosas em prontuarios e prescricoes. A padronizacao da linguagem medica evita erros de interpretacao que podem comprometer a seguranca do paciente.</p>
        </SectionCard>
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
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
