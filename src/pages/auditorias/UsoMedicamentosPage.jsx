import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard } from '@/design-system';
import { ChevronLeft } from 'lucide-react';

export default function UsoMedicamentosPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

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
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">Uso de Medicamentos</h1>
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
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao apresenta as auditorias relacionadas ao uso seguro de medicamentos, incluindo verificacao de prescricoes, armazenamento, dispensacao e administracao. Monitora a conformidade com os protocolos de seguranca medicamentosa.</p>
        </SectionCard>
      </div>

    </div>
  );
}
