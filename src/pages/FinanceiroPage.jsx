import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
} from '@/design-system';
import {
  GraduationCap,
  Construction,
  ChevronLeft,
} from 'lucide-react';

export default function FinanceiroPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Financeiro
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Conteúdo placeholder */}
        <SectionCard
          title="Gestão Financeira"
          className="mb-4"
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Em Desenvolvimento
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              O módulo de gestão financeira está sendo desenvolvido e estará disponível em breve.
            </p>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
