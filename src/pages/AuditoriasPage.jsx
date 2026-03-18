import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, SearchBar } from '@/design-system';
import { DocumentoCard } from '@/components';
import {
  GraduationCap,
  ClipboardCheck,
  X,
  FileText,
  ChevronDown,
  ChevronLeft,
  Plus,
} from 'lucide-react';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { AUDITORIA_TIPO_CONFIG } from '../data/auditoriasConfig';
import { cn } from '@/design-system/utils/tokens';
import NewDocumentModal from './management/components/NewDocumentModal';

// =============================================================================
// SECTION HEADER COMPONENT (Accordion) - Padrao DS igual BibliotecaPage
// =============================================================================

function SectionHeader({ tipo, count, isOpen, onToggle }) {
  const config = AUDITORIA_TIPO_CONFIG[tipo] || { label: tipo, icon: FileText, color: '#059669' };
  const IconComponent = config.icon;

  return (
    <button
      onClick={onToggle}
      className={cn(
        // Layout base - altura fixa para simetria
        "w-full h-16 flex items-center gap-4 px-4",
        "rounded-xl",
        // Cores e bordas
        "bg-card",
        "border border-[#E0E0E0] dark:border-border",
        // Hover state sutil
        "hover:bg-[#F5F5F5] dark:hover:bg-muted",
        "hover:border-primary dark:hover:border-primary",
        // Focus state para acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50",
        // Transicao suave
        "transition-all duration-200",
        // Sombra quando aberto
        isOpen && "shadow-md border-primary"
      )}
    >
      {/* Icone da secao - tamanho fixo */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-11 h-11 rounded-xl flex-shrink-0",
          "bg-muted",
          isOpen && "bg-primary"
        )}
      >
        <IconComponent
          className={cn(
            "w-5 h-5 transition-colors duration-200",
            isOpen
              ? "text-white dark:text-primary-foreground"
              : "text-primary"
          )}
        />
      </div>

      {/* Titulo - flex grow */}
      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">
        {config.label}
      </span>

      {/* Badge de contagem - tamanho fixo */}
      <span
        className={cn(
          "flex items-center justify-center",
          "min-w-[32px] h-7 px-2.5 rounded-full",
          "text-sm font-bold",
          "bg-muted",
          "text-primary"
        )}
      >
        {count}
      </span>

      {/* Icone chevron - no final (padrao F de leitura) */}
      <ChevronDown
        className={cn(
          "w-5 h-5 flex-shrink-0",
          "text-muted-foreground dark:text-muted-foreground",
          "transition-transform duration-300 ease-out",
          isOpen && "rotate-180 text-primary"
        )}
      />
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AuditoriasPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSetor, setSelectedSetor] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  // Use DocumentsContext (SSOT) instead of direct mock import
  const { allDocuments } = useDocumentsByCategory('auditorias');

  // Agrupar documentos por tipo
  const documentosPorTipo = useMemo(() => {
    let docs = allDocuments.filter((d) => d.status !== 'arquivado');

    // Filtrar por setor se selecionado
    if (selectedSetor) {
      docs = docs.filter((d) => d.setorId === selectedSetor);
    }

    // Filtrar por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.titulo.toLowerCase().includes(term) ||
          d.codigo.toLowerCase().includes(term) ||
          d.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    // Agrupar por tipo
    const grupos = {};
    docs.forEach((doc) => {
      if (!grupos[doc.tipo]) {
        grupos[doc.tipo] = [];
      }
      grupos[doc.tipo].push(doc);
    });

    // Ordenar documentos dentro de cada grupo (A-Z)
    Object.keys(grupos).forEach((tipo) => {
      grupos[tipo] = grupos[tipo].sort((a, b) =>
        a.titulo.localeCompare(b.titulo, 'pt-BR')
      );
    });

    // Converter para array ordenada por ordem do tipo
    return Object.entries(grupos)
      .map(([tipo, documentos]) => ({
        tipo,
        documentos,
        order: AUDITORIA_TIPO_CONFIG[tipo]?.order || 99
      }))
      .sort((a, b) => a.order - b.order);
  }, [allDocuments, searchTerm, selectedSetor]);

  // Abrir todas as secoes quando buscando
  useEffect(() => {
    if (searchTerm.trim()) {
      // Quando buscando, abrir todas as secoes com resultados
      const allOpen = {};
      documentosPorTipo.forEach(({ tipo }) => {
        allOpen[tipo] = true;
      });
      setOpenSections(allOpen);
    }
  }, [documentosPorTipo, searchTerm]);

  // Toggle secao
  const toggleSection = (tipo) => {
    setOpenSections(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  // Total de documentos
  const totalDocs = useMemo(() => {
    return documentosPorTipo.reduce((sum, { documentos }) => sum + documentos.length, 0);
  }, [documentosPorTipo]);

  const handleDocumentoClick = (documento) => {
    onNavigate('documento-detalhe', { documentoId: documento.id, returnTo: 'auditorias' });
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('qualidade')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Auditorias e Conformidade
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={() => setShowNewDocModal(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary dark:bg-[#1A3A2A] text-white text-xs font-medium active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espacador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Campo de busca */}
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar auditorias..."
          className="mb-4"
        />

        {/* Chip de setor ativo */}
        {selectedSetor && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSelectedSetor(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-primary"
            >
              Setor selecionado
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Accordions por tipo */}
        {documentosPorTipo.length === 0 ? (
          /* Estado vazio */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ClipboardCheck className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Nenhum documento encontrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tente ajustar os filtros ou buscar por outro termo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documentosPorTipo.map(({ tipo, documentos }) => {
              const isOpen = openSections[tipo] || false;
              return (
                <section key={tipo}>
                  <SectionHeader
                    tipo={tipo}
                    count={documentos.length}
                    isOpen={isOpen}
                    onToggle={() => toggleSection(tipo)}
                  />
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mt-3 ml-2">
                      {documentos.map((doc) => (
                        <DocumentoCard
                          key={doc.id}
                          documento={doc}
                          onClick={() => handleDocumentoClick(doc)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Info Footer */}
        <div
          className={cn(
            "mt-6 p-4 rounded-xl",
            "bg-muted",
            "border border-border"
          )}
        >
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> As auditorias sao realizadas conforme calendario institucional
            e os resultados sao apresentados ao Comite de Qualidade. Documentos de evidencia
            podem ser adicionados pelos coordenadores no Centro de Gestao.
          </p>
        </div>
      </div>

      <NewDocumentModal
        open={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
        category="auditorias"
      />

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground"
                fill="none"
              />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
