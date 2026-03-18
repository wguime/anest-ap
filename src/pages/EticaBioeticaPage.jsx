import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BottomNav,
  Card,
  CardContent,
  Badge,
} from '@/design-system';
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Scale,
  Brain,
  Heart,
  BookOpen,
  FileText,
  Plus,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { ETICA_CONFIGS } from '../data/eticaConfig';
import NewDocumentModal from './management/components/NewDocumentModal';

// Mapa de labels curtos para badges (uma palavra)
const BADGE_LABELS = {
  dilemas: 'Dilemas',
  parecerUti: 'UTI',
  diretrizes: 'Diretrizes',
  emissaoParecer: 'Parecer',
  codigoEtica: 'Codigo',
};

// =============================================================================
// ACCORDION SECTION HEADER
// =============================================================================

function EticaSectionHeader({ tipo, config, count, isOpen, onToggle }) {
  const iconMap = {
    Brain: Brain,
    Heart: Heart,
    BookOpen: BookOpen,
    FileText: FileText,
    Scale: Scale
  };
  const IconComponent = iconMap[config.icon] || Scale;

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
      {/* Icone da secao */}
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
              ? "text-white dark:text-foreground"
              : "text-primary"
          )}
        />
      </div>

      {/* Titulo */}
      <span className="flex-1 text-left text-[15px] font-semibold text-black dark:text-white">
        {config.titulo}
      </span>

      {/* Badge de contagem */}
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

      {/* Icone chevron */}
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
// DOCUMENT CARD
// =============================================================================

function EticaDocCard({ doc, onNavigate }) {
  const handleClick = () => {
    onNavigate('documento-detalhe', {
      documentoId: doc.id,
      source: 'etica',
      returnTo: 'etica-bioetica',
      returnTab: 'etica'
    });
  };

  // Label curto para o badge
  const badgeLabel = BADGE_LABELS[doc.categoria] || doc.categoria;

  return (
    <Card
      variant="default"
      className="cursor-pointer hover:shadow-md transition-all overflow-hidden bg-card"
      onClick={handleClick}
    >
      <CardContent className="p-3">
        {/* Badge do tipo - uma palavra */}
        <Badge
          style={{ backgroundColor: '#006837', color: 'white' }}
          className="mb-2 text-[10px]"
        >
          {badgeLabel}
        </Badge>

        {/* Titulo */}
        <p className="font-medium text-black dark:text-white text-sm line-clamp-2 mb-2">
          {doc.titulo}
        </p>

        {/* Codigo e versao */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{doc.codigo}</span>
          <span>v{doc.versaoAtual || 1}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function EticaBioeticaPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState({});
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  // Use DocumentsContext (SSOT) instead of direct mock import
  const { allDocuments } = useDocumentsByCategory('etica');

  // Filter active documents (not archived)
  const filteredDocs = useMemo(() => {
    return allDocuments.filter(doc => {
      if (doc.status === 'arquivado') return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        doc.titulo?.toLowerCase().includes(query) ||
        doc.codigo?.toLowerCase().includes(query) ||
        doc.descricao?.toLowerCase().includes(query)
      );
    });
  }, [allDocuments, searchQuery]);

  // Group documents by category
  const docsPorTipo = useMemo(() => {
    const grupos = {};
    filteredDocs.forEach(doc => {
      const categoria = doc.categoria || 'outros';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(doc);
    });

    // Convert to array and sort
    return Object.entries(grupos)
      .map(([categoria, documentos]) => ({
        categoria,
        documentos,
        config: ETICA_CONFIGS[categoria] || { titulo: categoria, icon: 'Scale' }
      }))
      .sort((a, b) => a.config.titulo.localeCompare(b.config.titulo));
  }, [filteredDocs]);

  // Total count
  const totalDocs = useMemo(() => {
    return docsPorTipo.reduce((sum, { documentos }) => sum + documentos.length, 0);
  }, [docsPorTipo]);

  // Toggle section
  const toggleSection = (categoria) => {
    setOpenSections(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };

  // Expand all when searching
  useEffect(() => {
    if (searchQuery) {
      const allOpen = {};
      docsPorTipo.forEach(({ categoria }) => {
        allOpen[categoria] = true;
      });
      setOpenSections(allOpen);
    }
  }, [docsPorTipo, searchQuery]);

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
            Etica e Bioetica
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
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Search field */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border text-black dark:text-white placeholder-[#9CA3AF] focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Header with counter */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {totalDocs} documento{totalDocs !== 1 ? 's' : ''} {searchQuery && 'encontrado' + (totalDocs !== 1 ? 's' : '')}
          </p>
        </div>

        {/* Accordions */}
        {docsPorTipo.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Scale className="w-8 h-8 text-primary" />
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
            {docsPorTipo.map(({ categoria, documentos, config }) => {
              const isOpen = openSections[categoria] || false;
              return (
                <section key={categoria}>
                  <EticaSectionHeader
                    tipo={categoria}
                    config={config}
                    count={documentos.length}
                    isOpen={isOpen}
                    onToggle={() => toggleSection(categoria)}
                  />
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mt-3 ml-2">
                      {documentos.map((doc) => (
                        <EticaDocCard
                          key={doc.id}
                          doc={doc}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <NewDocumentModal
        open={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
        category="etica"
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
