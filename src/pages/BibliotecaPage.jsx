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
  AlertCircle,
  Clock,
  Plus,
  FilePlus2,
  Landmark,
  Building2,
  Stethoscope,
  Users,
  GraduationCap,
  DollarSign,
  BadgeCheck,
  Cpu,
  FileBarChart,
  Archive,
} from 'lucide-react';
import { useDocumentsContext } from '@/contexts/DocumentsContext';
import { isRevisaoVencida, DOCUMENT_STATUS, CATEGORY_SUBSECTIONS } from '@/types/documents';
import { cn } from '@/design-system/utils/tokens';
import NewDocumentModal from './management/components/NewDocumentModal';

// =============================================================================
// CATEGORIA CONFIG — mapeia categorias para ícone, label e ordem
// =============================================================================

const CATEGORIA_CONFIG = {
  modelos:           { label: '00 Modelos',           icon: FilePlus2,      order: 1  },
  governanca:        { label: '01 Governança',         icon: Landmark,       order: 2  },
  institucional:     { label: '02 Institucional',      icon: Building2,      order: 3  },
  assistencial:      { label: '03 Assistencial',       icon: Stethoscope,    order: 4  },
  gestao_pessoas:    { label: '04 Gestão Pessoas',     icon: Users,          order: 5  },
  residencia:        { label: '05 Residência',         icon: GraduationCap,  order: 6  },
  financeiro:        { label: '06 Financeiro',         icon: DollarSign,     order: 7  },
  qualidade:         { label: '07 Qualidade',          icon: BadgeCheck,     order: 8  },
  tecnologia_mat:    { label: '08 Tecnologia Mat',     icon: Cpu,            order: 9  },
  relatorios_gerais: { label: '09 Relatórios Gerais',  icon: FileBarChart,   order: 10 },
  obsoletos:         { label: '10 Obsoletos',          icon: Archive,        order: 11 },
};

// =============================================================================
// SUBSECTION LIST — conteúdo interno do accordion
// =============================================================================

function SubsectionList({ categoria, documentos, onDocClick, matchInfo }) {
  const subsections = CATEGORY_SUBSECTIONS[categoria] || []
  const [openSubs, setOpenSubs] = useState({})
  const isSearching = matchInfo !== null

  const toggleSub = (value) => {
    if (isSearching) return // controlado pela busca
    setOpenSubs(prev => ({ ...prev, [value]: !prev[value] }))
  }

  const knownValues = new Set(subsections.map(s => s.value))
  const ungrouped = documentos.filter(d => !knownValues.has(d.tipo))

  // Determina docs visíveis por subseção durante busca
  const getVisibleDocs = (subValue, allSubDocs) => {
    if (!isSearching) return allSubDocs
    if (matchInfo.categoryMatched || matchInfo.matchedSubValues.has(subValue)) return allSubDocs
    return allSubDocs.filter(d => matchInfo.matchedDocIds.has(d.id))
  }

  // Determina se subseção deve aparecer durante busca
  const isSubVisible = (subValue, allSubDocs) => {
    if (!isSearching) return true
    return (
      matchInfo.categoryMatched ||
      matchInfo.matchedSubValues.has(subValue) ||
      allSubDocs.some(d => matchInfo.matchedDocIds.has(d.id))
    )
  }

  return (
    <div className="mt-2 ml-4 space-y-1.5">
      {subsections.map(sub => {
        const allSubDocs = documentos.filter(d => d.tipo === sub.value)

        if (!isSubVisible(sub.value, allSubDocs)) return null

        const visibleDocs = getVisibleDocs(sub.value, allSubDocs)
        const autoOpen = isSearching && (
          matchInfo.categoryMatched ||
          matchInfo.matchedSubValues.has(sub.value) ||
          allSubDocs.some(d => matchInfo.matchedDocIds.has(d.id))
        )
        const isOpen = isSearching ? autoOpen : (openSubs[sub.value] || false)

        return (
          <div key={sub.value} className="rounded-lg overflow-hidden border border-border/60">
            <button
              onClick={() => toggleSub(sub.value)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5",
                !isSearching && "hover:bg-muted/60 transition-colors duration-150",
                "focus:outline-none",
                isOpen ? "bg-muted/50" : "bg-card",
              )}
            >
              <span className={cn(
                "flex-1 text-left text-sm font-medium",
                isOpen ? "text-foreground" : "text-muted-foreground",
              )}>
                {sub.label}
              </span>
              {visibleDocs.length > 0 && (
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {visibleDocs.length}
                </span>
              )}
              {!isSearching && (
                <ChevronDown className={cn(
                  "w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180 text-primary",
                )} />
              )}
            </button>

            {isOpen && (
              visibleDocs.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-t border-border/40">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum documento. Clique em <strong>Novo</strong> para adicionar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 border-t border-border/40">
                  {visibleDocs.map(doc => (
                    <DocumentoCard key={doc.id} documento={doc} onClick={() => onDocClick(doc)} />
                  ))}
                </div>
              )
            )}
          </div>
        )
      })}

      {/* Docs sem subseção reconhecida */}
      {(() => {
        const visibleUngrouped = isSearching
          ? (matchInfo.categoryMatched
              ? ungrouped
              : ungrouped.filter(d => matchInfo.matchedDocIds.has(d.id)))
          : ungrouped
        if (visibleUngrouped.length === 0) return null
        const isOpen = isSearching ? true : (openSubs['__ungrouped__'] || false)
        return (
          <div className="rounded-lg overflow-hidden border border-border/60">
            <button
              onClick={() => toggleSub('__ungrouped__')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5",
                !isSearching && "hover:bg-muted/60 transition-colors duration-150",
                "focus:outline-none",
                isOpen ? "bg-muted/50" : "bg-card",
              )}
            >
              <span className="flex-1 text-left text-sm font-medium text-muted-foreground">Outros</span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {visibleUngrouped.length}
              </span>
              {!isSearching && (
                <ChevronDown className={cn(
                  "w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180 text-primary",
                )} />
              )}
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-3 p-3 border-t border-border/40">
                {visibleUngrouped.map(doc => (
                  <DocumentoCard key={doc.id} documento={doc} onClick={() => onDocClick(doc)} />
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// =============================================================================
// SECTION HEADER COMPONENT (Accordion) - Padrao DS
// =============================================================================

function SectionHeader({ categoria, count, isOpen, onToggle }) {
  const config = CATEGORIA_CONFIG[categoria] || { label: categoria, icon: FileText };
  const IconComponent = config.icon;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full h-16 flex items-center gap-4 px-4",
        "rounded-xl",
        "bg-card",
        "border border-[#E0E0E0] dark:border-border",
        "hover:bg-[#F5F5F5] dark:hover:bg-muted",
        "hover:border-primary dark:hover:border-primary",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50",
        "transition-all duration-200",
        isOpen && "shadow-md border-primary"
      )}
    >
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
            isOpen ? "text-white dark:text-primary-foreground" : "text-primary"
          )}
        />
      </div>

      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">
        {config.label}
      </span>

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

export default function BibliotecaPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [openSections, setOpenSections] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  // Todos os documentos de todas as categorias via contexto SSOT
  const { documents } = useDocumentsContext();

  // Agrupar documentos por categoria — busca em seções, subseções e docs
  const documentosPorCategoria = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const sortedCategories = Object.entries(CATEGORIA_CONFIG)
      .sort(([, a], [, b]) => a.order - b.order);

    // Sem busca — todas as 11 categorias com todos os docs
    if (!term) {
      return sortedCategories.map(([categoria]) => ({
        categoria,
        documentos: (documents[categoria] || [])
          .filter(d => d.status !== 'arquivado')
          .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR')),
        order: CATEGORIA_CONFIG[categoria].order,
        matchInfo: null,
      }));
    }

    // Com busca — verificar cada nível: seção, subseção, documento
    return sortedCategories.flatMap(([categoria, config]) => {
      const allDocs = (documents[categoria] || [])
        .filter(d => d.status !== 'arquivado')
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));

      // 1. Label da seção bate com o termo?
      const categoryMatched = config.label.toLowerCase().includes(term);

      // 2. Subseções cujo label bate
      const subsections = CATEGORY_SUBSECTIONS[categoria] || [];
      const matchedSubValues = new Set(
        subsections.filter(s => s.label.toLowerCase().includes(term)).map(s => s.value)
      );

      // 3. Docs que batem diretamente
      const matchedDocIds = new Set(
        allDocs
          .filter(d =>
            d.titulo?.toLowerCase().includes(term) ||
            d.codigo?.toLowerCase().includes(term) ||
            d.tags?.some(t => t.toLowerCase().includes(term))
          )
          .map(d => d.id)
      );

      // Propagar: subseções que contêm docs que batem também ficam abertas
      allDocs.forEach(d => {
        if (matchedDocIds.has(d.id) && d.tipo) matchedSubValues.add(d.tipo);
      });

      // Excluir categoria se nada bater
      if (!categoryMatched && matchedSubValues.size === 0 && matchedDocIds.size === 0) {
        return [];
      }

      return [{
        categoria,
        documentos: allDocs,
        order: config.order,
        matchInfo: { categoryMatched, matchedSubValues, matchedDocIds },
      }];
    });
  }, [documents, searchTerm]);

  // Abrir seções que têm resultados ao buscar; fechar todas ao limpar busca
  useEffect(() => {
    if (searchTerm.trim()) {
      const toOpen = {};
      documentosPorCategoria.forEach(({ categoria }) => { toOpen[categoria] = true; });
      setOpenSections(toOpen);
    } else {
      setOpenSections({});
    }
  }, [documentosPorCategoria, searchTerm]);

  // Toggle secao
  const toggleSection = (categoria) => {
    setOpenSections(prev => ({
      ...prev,
      [categoria]: !prev[categoria],
    }));
  };

  // Total de documentos
  const totalDocs = useMemo(() => {
    return documentosPorCategoria.reduce((sum, { documentos }) => sum + documentos.length, 0);
  }, [documentosPorCategoria]);

  // Badges: vencidos e pendentes (todas as categorias)
  const overdueCount = useMemo(() => {
    return Object.values(documents).flat().filter(
      doc => doc.status === DOCUMENT_STATUS.ATIVO && isRevisaoVencida(doc.proximaRevisao)
    ).length;
  }, [documents]);

  const pendingCount = useMemo(() => {
    return Object.values(documents).flat().filter(
      doc => doc.status === DOCUMENT_STATUS.PENDENTE
    ).length;
  }, [documents]);

  const handleDocumentoClick = (documento) => {
    onNavigate('documento-detalhe', { documentoId: documento.id, returnTo: 'biblioteca' });
  };

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
            Biblioteca
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

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Header com icone e contador */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "flex items-center justify-center",
              "w-12 h-12 rounded-xl",
              "bg-muted"
            )}
          >
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">Documentos</h2>
            <p className="text-sm text-muted-foreground">
              {totalDocs} documento{totalDocs !== 1 ? 's' : ''}{searchTerm && ' encontrado' + (totalDocs !== 1 ? 's' : '')}
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

        {/* Accordions por categoria */}
        {searchTerm.trim() && documentosPorCategoria.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Nenhum documento encontrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tente buscar por outro termo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documentosPorCategoria.map(({ categoria, documentos, matchInfo }) => {
              const isOpen = openSections[categoria] || false;
              return (
                <section key={categoria}>
                  <SectionHeader
                    categoria={categoria}
                    count={documentos.length}
                    isOpen={isOpen}
                    onToggle={() => toggleSection(categoria)}
                  />
                  {isOpen && (
                    <SubsectionList
                      categoria={categoria}
                      documentos={documentos}
                      onDocClick={handleDocumentoClick}
                      matchInfo={matchInfo}
                    />
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
            <strong>Nota:</strong> Todos os documentos passam por revisao periodica
            conforme cronograma institucional. Versoes anteriores ficam disponiveis
            para consulta historica.
          </p>
        </div>
      </div>

      {/* Modal sem categoria pré-definida — usuário escolhe a seção */}
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
