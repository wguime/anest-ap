import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard } from '@/design-system';
import { GraduationCap, ChevronLeft, FileCheck } from 'lucide-react';

export default function AuditoriasConformidadePage({ onNavigate }) {
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
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">Conformidade e Politicas</h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted dark:bg-muted flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Conformidade e Politicas</h3>
              <p className="text-sm text-muted-foreground">Normas institucionais</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao consolida as auditorias de conformidade com politicas institucionais. Verifica a adesao as normas internas, regulamentos e diretrizes estabelecidas pela organizacao, garantindo o alinhamento das praticas com os padroes definidos.</p>
        </SectionCard>
      </div>

    </div>
  );
}
