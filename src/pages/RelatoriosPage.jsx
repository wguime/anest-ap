import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, SearchBar } from '@/design-system';
import { DocumentoCard } from '@/components';
import {
  FileBarChart,
  ChevronDown,
  ChevronLeft,
  FileText,
  Calendar,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { RELATORIO_TIPO_CONFIG } from '../data/relatoriosConfig';
import { cn } from '@/design-system/utils/tokens';
import NewDocumentModal from './management/components/NewDocumentModal';

// =============================================================================
// SECTION HEADER COMPONENT (Accordion) - Padrao DS
// =============================================================================

function SectionHeader({ tipo, count, isOpen, onToggle }) {
  const config = RELATORIO_TIPO_CONFIG[tipo] || { label: tipo, icon: FileText, color: '#059669' };
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

export default function RelatoriosPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState({});
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  // Use DocumentsContext (SSOT) instead of specialized hook
  const { allDocuments } = useDocumentsByCategory('relatorios');

  // Estatisticas para widgets
  const ESTATISTICAS = [
    { label: 'Relatorios 2024', value: String(allDocuments.length || 0), icon: FileText },
    { label: 'Ultimo trimestre', value: 'Q4/2024', icon: Calendar },
    { label: 'KPIs monitorados', value: '21', icon: TrendingUp },
  ];

  // Agrupar relatorios por tipo
  const relatoriosPorTipo = useMemo(() => {
    let docs = allDocuments.filter((r) => r.status !== 'arquivado');

    // Filtrar por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(
        (r) =>
          r.titulo?.toLowerCase().includes(term) ||
          r.codigo?.toLowerCase().includes(term) ||
          r.periodo?.toLowerCase().includes(term) ||
          r.tags?.some((tag) => tag.toLowerCase().includes(term))
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

    // Ordenar documentos dentro de cada grupo (mais recente primeiro)
    Object.keys(grupos).forEach((tipo) => {
      grupos[tipo] = grupos[tipo].sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA;
      });
    });

    // Converter para array ordenada por ordem do tipo
    return Object.entries(grupos)
      .map(([tipo, documentos]) => ({
        tipo,
        documentos,
        order: RELATORIO_TIPO_CONFIG[tipo]?.order || 99
      }))
      .sort((a, b) => a.order - b.order);
  }, [allDocuments, searchTerm]);

  // Abrir todas as secoes quando buscando
  useEffect(() => {
    if (searchTerm.trim()) {
      // Quando buscando, abrir todas as secoes com resultados
      const allOpen = {};
      relatoriosPorTipo.forEach(({ tipo }) => {
        allOpen[tipo] = true;
      });
      setOpenSections(allOpen);
    }
  }, [relatoriosPorTipo, searchTerm]);

  // Toggle secao
  const toggleSection = (tipo) => {
    setOpenSections(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  // Total de documentos
  const totalDocs = useMemo(() => {
    return relatoriosPorTipo.reduce((sum, { documentos }) => sum + documentos.length, 0);
  }, [relatoriosPorTipo]);

  // Click no card navega para detalhe (usa documento-detalhe com busca unificada)
  const handleRelatorioClick = (relatorio) => {
    onNavigate('documento-detalhe', { documentoId: relatorio.id, returnTo: 'relatorios' });
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('qualidade')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Relatorios
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

      {/* Espacador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Cards de estatisticas - MANTIDOS */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {ESTATISTICAS.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-[#1A2420] rounded-xl p-3 border border-[#C8E6C9] dark:border-[#2A3F36] text-center"
              >
                <IconComponent className="w-5 h-5 mx-auto mb-1 text-[#006837] dark:text-[#2ECC71]" />
                <p className="text-lg font-bold text-[#004225] dark:text-white">{stat.value}</p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178] leading-tight">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Campo de busca */}
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar relatorios..."
          className="mb-4"
        />

        {/* Accordions por tipo */}
        {relatoriosPorTipo.length === 0 ? (
          /* Estado vazio */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-4">
              <FileBarChart className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Nenhum relatorio encontrado
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-xs">
              Tente ajustar a busca ou aguarde a publicacao de novos relatorios.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {relatoriosPorTipo.map(({ tipo, documentos }) => {
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
                          documento={{
                            ...doc,
                            tipo: 'relatorio', // Para usar a cor correta no badge
                            versaoAtual: doc.versaoAtual || 1,
                          }}
                          onClick={() => handleRelatorioClick(doc)}
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
            <strong>Nota:</strong> Os relatorios sao gerados periodicamente pelo Comite de Qualidade e Seguranca.
            Em caso de duvidas, entre em contato com a coordenacao.
          </p>
        </div>
      </div>

      <NewDocumentModal
        open={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
        category="relatorios"
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
