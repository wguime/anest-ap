import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, SearchBar } from '@/design-system';
import { DocumentoCard } from '@/components';
import {
  BookOpen,
  X,
  FileText,
  ChevronDown,
  ChevronLeft,
  Shield,
  AlertCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { TIPO_CONFIG } from '../data/documentTypes';
import { isRevisaoVencida, diasAteRevisao, DOCUMENT_STATUS } from '@/types/documents';
import { cn } from '@/design-system/utils/tokens';
import NewDocumentModal from './management/components/NewDocumentModal';

// =============================================================================
// SECTION HEADER COMPONENT (Accordion) - Padrao DS
// =============================================================================

function SectionHeader({ tipo, count, isOpen, onToggle }) {
  const config = TIPO_CONFIG[tipo] || { label: tipo, icon: FileText, color: '#059669' };
  const IconComponent = config.icon;

  return (
    <button
      onClick={onToggle}
      className={cn(
        // Layout base - altura fixa para simetria
        "w-full h-16 flex items-center gap-4 px-4",
        "rounded-xl",
        // Cores e bordas
        "bg-white dark:bg-[#1A2420]",
        "border border-[#E0E0E0] dark:border-[#2A3F36]",
        // Hover state sutil
        "hover:bg-[#F5F5F5] dark:hover:bg-[#243530]",
        "hover:border-[#006837] dark:hover:border-[#2ECC71]",
        // Focus state para acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-[#006837]/50 dark:focus:ring-[#2ECC71]/50",
        // Transicao suave
        "transition-all duration-200",
        // Sombra quando aberto
        isOpen && "shadow-md border-[#006837] dark:border-[#2ECC71]"
      )}
    >
      {/* Icone da secao - tamanho fixo */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-11 h-11 rounded-xl flex-shrink-0",
          "bg-[#E8F5E9] dark:bg-[#243530]",
          isOpen && "bg-[#006837] dark:bg-[#2ECC71]"
        )}
      >
        <IconComponent
          className={cn(
            "w-5 h-5 transition-colors duration-200",
            isOpen
              ? "text-white dark:text-[#0D1F17]"
              : "text-[#006837] dark:text-[#2ECC71]"
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
          "bg-[#E8F5E9] dark:bg-[#243530]",
          "text-[#006837] dark:text-[#2ECC71]"
        )}
      >
        {count}
      </span>

      {/* Icone chevron - no final (padrao F de leitura) */}
      <ChevronDown
        className={cn(
          "w-5 h-5 flex-shrink-0",
          "text-[#757575] dark:text-[#9E9E9E]",
          "transition-transform duration-300 ease-out",
          isOpen && "rotate-180 text-[#006837] dark:text-[#2ECC71]"
        )}
      />
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BibliotecaPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [selectedSetor, setSelectedSetor] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  // Use SSOT context instead of mock data directly
  const {
    allDocuments,
    searchTerm,
    setSearchTerm,
    overdueCount,
    pendingCount,
  } = useDocumentsByCategory('biblioteca');

  // Agrupar documentos por tipo
  const documentosPorTipo = useMemo(() => {
    let docs = allDocuments.filter(d => d.status !== 'arquivado');

    // Filtrar por setor se selecionado
    if (selectedSetor) {
      docs = docs.filter((d) => d.setorId === selectedSetor);
    }

    // Filtrar por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.titulo?.toLowerCase().includes(term) ||
          d.codigo?.toLowerCase().includes(term) ||
          d.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    // Agrupar por tipo
    const grupos = {};
    docs.forEach((doc) => {
      const tipo = doc.tipo || 'outro';
      if (!grupos[tipo]) {
        grupos[tipo] = [];
      }
      grupos[tipo].push(doc);
    });

    // Ordenar documentos dentro de cada grupo (A-Z)
    Object.keys(grupos).forEach((tipo) => {
      grupos[tipo] = grupos[tipo].sort((a, b) =>
        (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR')
      );
    });

    // Converter para array ordenada por ordem do tipo
    return Object.entries(grupos)
      .map(([tipo, documentos]) => ({
        tipo,
        documentos,
        order: TIPO_CONFIG[tipo]?.order || 99
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
    onNavigate('documento-detalhe', { documentoId: documento.id, returnTo: 'biblioteca' });
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Biblioteca
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={() => setShowNewDocModal(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#004225] dark:bg-[#1A3A2A] text-white text-xs font-medium active:scale-95 transition-all"
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
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Header com icone e contador */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "flex items-center justify-center",
              "w-12 h-12 rounded-xl",
              "bg-[#E8F5E9] dark:bg-[#243530]"
            )}
          >
            <BookOpen className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">Documentos</h2>
            <p className="text-sm text-muted-foreground">
              {totalDocs} documento{totalDocs !== 1 ? 's' : ''} {searchTerm && 'encontrado' + (totalDocs !== 1 ? 's' : '')}
            </p>
          </div>
          {/* Badges de revisao */}
          <div className="flex items-center gap-1.5">
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <AlertCircle className="w-3 h-3" />
                {overdueCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <Clock className="w-3 h-3" />
                {pendingCount}
              </span>
            )}
          </div>
        </div>

        {/* Campo de busca */}
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar documentos..."
          className="mb-4"
        />

        {/* Chip de setor ativo */}
        {selectedSetor && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSelectedSetor(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] dark:bg-[#243530] text-[#004225] dark:text-[#2ECC71]"
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
            <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Nenhum documento encontrado
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-xs">
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
            "bg-[#E8F5E9] dark:bg-[#1A2420]",
            "border border-[#A5D6A7] dark:border-[#2A3F36]"
          )}
        >
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Todos os documentos passam por revisao periodica
            conforme cronograma institucional. Versoes anteriores ficam disponiveis
            para consulta historica.
          </p>
        </div>
      </div>

      <NewDocumentModal
        open={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
        category="biblioteca"
      />

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
