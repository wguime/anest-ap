import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav } from '@/design-system';
import { GraduationCap, ChevronLeft, ClipboardCheck } from 'lucide-react';

export default function AuditoriasOperacionaisPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button type="button" onClick={() => onNavigate('auditorias')} className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">Auditorias Operacionais</h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted dark:bg-muted flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Auditorias Operacionais</h3>
              <p className="text-sm text-muted-foreground">Processos assistenciais</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao consolida as auditorias operacionais relacionadas aos processos assistenciais. Inclui verificacoes de conformidade com protocolos clinicos, checagem de processos criticos e monitoramento da qualidade da assistencia prestada.</p>
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
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
