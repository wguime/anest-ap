import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav } from '@/design-system';
import { ChevronLeft } from 'lucide-react';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { DocumentoCard } from '@/components';

export default function PlanoManualPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const { allDocuments } = useDocumentsByCategory('desastres');
  const documentos = allDocuments
    .filter(d => d.tipo === 'manual_gestao' && d.status !== 'arquivado')
    .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));

  const handleDocumentoClick = (doc) => {
    onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'planoManual' });
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('desastres')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Manual de Gestao
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

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Arquivos" subtitle={`${documentos.length} documento${documentos.length !== 1 ? 's' : ''}`}>
          {documentos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {documentos.map((doc) => (
                <DocumentoCard
                  key={doc.id}
                  documento={doc}
                  onClick={() => handleDocumentoClick(doc)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum documento disponivel.
            </p>
          )}
        </SectionCard>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'BarChart3', active: false, id: 'dashboard' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'dashboard') onNavigate('dashboardExecutivo');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
