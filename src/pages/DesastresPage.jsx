import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  WidgetCard,
  SectionCard,
  BottomNav,
  SearchBar,
} from '@/design-system';
import { DocumentoCard } from '@/components';
import {
  ChevronLeft,
  ChevronDown,
  Flame,
  Users,
  Zap,
  Biohazard,
  Droplets,
  Bomb,
  FileText,
  Info,
  Plus,
} from 'lucide-react';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { DESASTRE_TIPO_CONFIG, getDesastreConfig } from '../data/desastresConfig';
import { cn } from '@/design-system/utils/tokens';
import NewDocumentModal from './management/components/NewDocumentModal';

// Siglas e seus significados
const SIGLAS = [
  { sigla: 'CGPED', significado: 'Comite de Gerenciamento de Preparacao para Emergencias e Desastres' },
  { sigla: 'SESMT', significado: 'Servico Especializado em Engenharia de Seguranca e em Medicina do Trabalho' },
  { sigla: 'CCIH', significado: 'Comissao de Controle de Infeccao Hospitalar' },
  { sigla: 'CC', significado: 'Centro Cirurgico' },
  { sigla: 'UTI', significado: 'Unidade de Terapia Intensiva' },
  { sigla: 'SRPA', significado: 'Sala de Recuperacao Pos-Anestesica' },
  { sigla: 'SAMU', significado: 'Servico de Atendimento Movel de Urgencia' },
  { sigla: 'EPIs', significado: 'Equipamentos de Protecao Individual' },
  { sigla: 'TI', significado: 'Tecnologia da Informacao' },
  { sigla: 'PCR', significado: 'Parada Cardiorrespiratoria' },
];

// Secao 1 - Emergencias em Andamento (6 tipos)
const EMERGENCIAS = [
  {
    id: 'emergenciaIncendio',
    title: 'Incendio / Abandono',
    subtitle: 'Evacuacao de area',
    icon: Flame,
  },
  {
    id: 'emergenciaVitimas',
    title: 'Multiplas Vitimas',
    subtitle: 'Desastre externo',
    icon: Users,
  },
  {
    id: 'emergenciaPane',
    title: 'Pane Eletrica',
    subtitle: 'Falha estrutural',
    icon: Zap,
  },
  {
    id: 'emergenciaQuimico',
    title: 'Desastre Quimico',
    subtitle: 'Biologico / Contaminacao',
    icon: Biohazard,
  },
  {
    id: 'emergenciaInundacao',
    title: 'Inundacao',
    subtitle: 'Clima extremo',
    icon: Droplets,
  },
  {
    id: 'emergenciaBomba',
    title: 'Ameaca de Bomba',
    subtitle: 'Seguranca fisica',
    icon: Bomb,
  },
];

// =============================================================================
// ACCORDION HEADER - Mesmo padrao do ComitesPage
// =============================================================================

function AccordionHeader({ tipo, count, isOpen, onToggle }) {
  const config = getDesastreConfig(tipo);
  const IconComponent = config.icon;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full h-16 flex items-center gap-4 px-4",
        "rounded-xl",
        "bg-white dark:bg-[#1A2420]",
        "border border-[#E0E0E0] dark:border-[#2A3F36]",
        "hover:bg-[#F5F5F5] dark:hover:bg-[#243530]",
        "hover:border-[#006837] dark:hover:border-[#2ECC71]",
        "focus:outline-none focus:ring-2 focus:ring-[#006837]/50 dark:focus:ring-[#2ECC71]/50",
        "transition-all duration-200",
        isOpen && "shadow-md border-[#006837] dark:border-[#2ECC71]"
      )}
    >
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

      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">
        {config.label}
      </span>

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

export default function DesastresPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState({});
  const [showNewDocModal, setShowNewDocModal] = useState(false);

  const { allDocuments } = useDocumentsByCategory('desastres');

  // Agrupar documentos por tipo
  const documentosPorTipo = useMemo(() => {
    let docs = allDocuments.filter((d) => d.status !== 'arquivado');

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(
        (d) =>
          (d.titulo || '').toLowerCase().includes(term) ||
          (d.codigo || '').toLowerCase().includes(term) ||
          d.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    const grupos = {};
    docs.forEach((doc) => {
      if (!grupos[doc.tipo]) {
        grupos[doc.tipo] = [];
      }
      grupos[doc.tipo].push(doc);
    });

    Object.keys(grupos).forEach((tipo) => {
      grupos[tipo] = grupos[tipo].sort((a, b) =>
        (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR')
      );
    });

    return Object.entries(grupos)
      .map(([tipo, documentos]) => ({
        tipo,
        documentos,
        order: DESASTRE_TIPO_CONFIG[tipo]?.order || 99,
      }))
      .sort((a, b) => a.order - b.order);
  }, [allDocuments, searchTerm]);

  // Abrir todas as secoes quando buscando
  useEffect(() => {
    if (searchTerm.trim()) {
      const allOpen = {};
      documentosPorTipo.forEach(({ tipo }) => {
        allOpen[tipo] = true;
      });
      setOpenSections(allOpen);
    }
  }, [documentosPorTipo, searchTerm]);

  const toggleSection = (tipo) => {
    setOpenSections((prev) => ({
      ...prev,
      [tipo]: !prev[tipo],
    }));
  };

  const totalDocs = useMemo(() => {
    return documentosPorTipo.reduce((sum, { documentos }) => sum + documentos.length, 0);
  }, [documentosPorTipo]);

  const handleDocumentoClick = (documento) => {
    onNavigate('documento-detalhe', { documentoId: documento.id, returnTo: 'desastres' });
  };

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
            Gerenciamento de Desastres
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
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4 space-y-4">
        {/* Secao 1 - Emergencia em Andamento */}
        <SectionCard
          title="Emergencia em Andamento"
          subtitle="Protocolos de acao imediata"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {EMERGENCIAS.map((emergencia) => {
              const IconComponent = emergencia.icon;
              return (
                <WidgetCard
                  key={emergencia.id}
                  icon={<IconComponent className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />}
                  title={emergencia.title}
                  subtitle={emergencia.subtitle}
                  variant="interactive"
                  onClick={() => onNavigate(emergencia.id)}
                />
              );
            })}
          </div>
        </SectionCard>

        {/* Secao 2 - Planos e Fluxos (estilo Comites) */}
        <div>
          {/* Hero header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                "flex items-center justify-center",
                "w-12 h-12 rounded-xl",
                "bg-[#E8F5E9] dark:bg-[#243530]"
              )}
            >
              <FileText className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Planos e Fluxos</h2>
              <p className="text-sm text-muted-foreground">
                {totalDocs} documento{totalDocs !== 1 ? 's' : ''}{' '}
                {searchTerm && `encontrado${totalDocs !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Busca */}
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar documentos..."
            className="mb-4"
          />

          {/* Accordions por tipo */}
          {documentosPorTipo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
              </div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                Nenhum documento encontrado
              </h3>
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-xs">
                {searchTerm
                  ? 'Tente ajustar os filtros ou buscar por outro termo.'
                  : 'Nenhum documento disponivel nesta categoria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documentosPorTipo.map(({ tipo, documentos }) => {
                const isOpen = openSections[tipo] || false;
                return (
                  <section key={tipo}>
                    <AccordionHeader
                      tipo={tipo}
                      count={documentos.length}
                      isOpen={isOpen}
                      onToggle={() => toggleSection(tipo)}
                    />
                    {isOpen && (
                      <div className="grid grid-cols-2 gap-3 mt-3 ml-2">
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
        </div>

        {/* Siglas — accordion inline */}
        <section>
          <button
            onClick={() => setOpenSections((prev) => ({ ...prev, _siglas: !prev._siglas }))}
            className={cn(
              "w-full h-16 flex items-center gap-4 px-4",
              "rounded-xl",
              "bg-white dark:bg-[#1A2420]",
              "border border-[#E0E0E0] dark:border-[#2A3F36]",
              "hover:bg-[#F5F5F5] dark:hover:bg-[#243530]",
              "hover:border-[#006837] dark:hover:border-[#2ECC71]",
              "focus:outline-none focus:ring-2 focus:ring-[#006837]/50 dark:focus:ring-[#2ECC71]/50",
              "transition-all duration-200",
              openSections._siglas && "shadow-md border-[#006837] dark:border-[#2ECC71]"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center",
                "w-11 h-11 rounded-xl flex-shrink-0",
                "bg-[#E8F5E9] dark:bg-[#243530]",
                openSections._siglas && "bg-[#006837] dark:bg-[#2ECC71]"
              )}
            >
              <FileText
                className={cn(
                  "w-5 h-5 transition-colors duration-200",
                  openSections._siglas
                    ? "text-white dark:text-[#0D1F17]"
                    : "text-[#006837] dark:text-[#2ECC71]"
                )}
              />
            </div>
            <span className="flex-1 text-left text-[15px] font-semibold text-foreground">
              Siglas
            </span>
            <span
              className={cn(
                "flex items-center justify-center",
                "min-w-[32px] h-7 px-2.5 rounded-full",
                "text-sm font-bold",
                "bg-[#E8F5E9] dark:bg-[#243530]",
                "text-[#006837] dark:text-[#2ECC71]"
              )}
            >
              {SIGLAS.length}
            </span>
            <ChevronDown
              className={cn(
                "w-5 h-5 flex-shrink-0",
                "text-[#757575] dark:text-[#9E9E9E]",
                "transition-transform duration-300 ease-out",
                openSections._siglas && "rotate-180 text-[#006837] dark:text-[#2ECC71]"
              )}
            />
          </button>
          {openSections._siglas && (
            <div className="space-y-2 mt-3 ml-2">
              {SIGLAS.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 bg-white dark:bg-[#1A2420] border border-[#E0E0E0] dark:border-[#2A3F36] rounded-xl p-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#004225] dark:text-white">
                      {item.sigla}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#6B8178] leading-relaxed">
                      {item.significado}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info Box */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                Sobre o Gerenciamento de Desastres
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                O CGPED (Comite de Gerenciamento de Preparacao para Emergencias e Desastres)
                coordena todas as acoes de resposta a emergencias no hospital. Em caso de
                emergencia real, siga os protocolos e comunique imediatamente a equipe responsavel.
              </p>
            </div>
          </div>
        </div>
      </div>

      <NewDocumentModal
        open={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
        category="desastres"
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
