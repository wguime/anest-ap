// GestaoDocumentalShowcase.jsx
// Showcase dos componentes de Gestao Documental (BibliotecaPage e RelatoriosPage)

import { useState, useMemo } from 'react';
import {
  FileText,
  BookOpen,
  ClipboardList,
  ChevronDown,
  FileBarChart,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Search,
  X,
  Calendar,
  User,
  Tag,
  Folder,
  History,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { SearchBar } from '../components';
import { cn } from '../utils/tokens';

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================

const TOKENS = {
  light: {
    background: {
      primary: '#F0FFF4',
      card: '#FFFFFF',
      cardHighlight: '#E8F5E9',
    },
    green: {
      dark: '#004225',
      medium: '#006837',
    },
    text: {
      primary: '#000000',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
    border: {
      default: '#C8E6C9',
    },
  },
  dark: {
    background: {
      darkest: '#0A0F0D',
      card: '#1A2420',
      cardLight: '#243530',
    },
    green: {
      primary: '#2ECC71',
      muted: '#1E8449',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3B8B0',
      muted: '#6B8178',
    },
    border: {
      default: '#2A3F36',
    },
  },
};

// ============================================================================
// MOCK DATA
// ============================================================================

const TIPO_CONFIG = {
  protocolo: {
    label: 'Protocolos',
    icon: FileText,
    color: '#059669',
    order: 1,
  },
  politica: {
    label: 'Politicas',
    icon: BookOpen,
    color: '#6366F1',
    order: 2,
  },
  formulario: {
    label: 'Formularios',
    icon: ClipboardList,
    color: '#F59E0B',
    order: 3,
  },
  manual: {
    label: 'Manuais',
    icon: BookOpen,
    color: '#EC4899',
    order: 4,
  },
};

const RELATORIO_TIPO_CONFIG = {
  trimestral: {
    label: 'Relatorio Trimestral',
    shortLabel: 'Trimestral',
    icon: FileBarChart,
    color: '#3B82F6',
    order: 1,
  },
  incidentes: {
    label: 'Consolidado de Incidentes',
    shortLabel: 'Incidentes',
    icon: AlertTriangle,
    color: '#DC2626',
    order: 2,
  },
  indicadores: {
    label: 'Indicadores de Qualidade',
    shortLabel: 'Indicadores',
    icon: TrendingUp,
    color: '#059669',
    order: 3,
  },
};

const MOCK_DOCUMENTOS = [
  { id: 'doc-1', titulo: 'Protocolo de Higiene das Maos', codigo: 'PROT.HIG.001', tipo: 'protocolo', versaoAtual: 3 },
  { id: 'doc-2', titulo: 'Protocolo de Identificacao do Paciente', codigo: 'PROT.IDENT.001', tipo: 'protocolo', versaoAtual: 2 },
  { id: 'doc-3', titulo: 'Politica de Gestao da Qualidade', codigo: 'POL.QUAL.001', tipo: 'politica', versaoAtual: 1 },
  { id: 'doc-4', titulo: 'Politica de Disclosure', codigo: 'POL.DISC.001', tipo: 'politica', versaoAtual: 2 },
  { id: 'doc-5', titulo: 'Formulario de Notificacao de Incidente', codigo: 'FORM.INC.001', tipo: 'formulario', versaoAtual: 4 },
  { id: 'doc-6', titulo: 'Checklist de Cirurgia Segura', codigo: 'FORM.CIR.001', tipo: 'formulario', versaoAtual: 2 },
];

const MOCK_RELATORIOS = [
  { id: 'rel-1', titulo: 'Relatorio Trimestral Q4 2024', codigo: 'REL.TRIM.2024-Q4', tipo: 'trimestral', versaoAtual: 1, periodo: 'Q4 2024' },
  { id: 'rel-2', titulo: 'Relatorio Trimestral Q3 2024', codigo: 'REL.TRIM.2024-Q3', tipo: 'trimestral', versaoAtual: 1, periodo: 'Q3 2024' },
  { id: 'rel-3', titulo: 'Consolidado de Incidentes - Dezembro 2024', codigo: 'REL.INC.2024-12', tipo: 'incidentes', versaoAtual: 1 },
  { id: 'rel-4', titulo: 'Consolidado de Incidentes - Novembro 2024', codigo: 'REL.INC.2024-11', tipo: 'incidentes', versaoAtual: 1 },
  { id: 'rel-5', titulo: 'Relatorio Anual de Indicadores 2024', codigo: 'REL.IND.2024-ANUAL', tipo: 'indicadores', versaoAtual: 1 },
];

// ============================================================================
// COMPONENTES REUTILIZAVEIS
// ============================================================================

// SectionHeader - Accordion Header Component
function SectionHeader({ tipo, count, isOpen, onToggle, configMap = TIPO_CONFIG }) {
  const config = configMap[tipo] || { label: tipo, icon: FileText, color: '#059669' };
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
      <div className={cn(
        "flex items-center justify-center",
        "w-11 h-11 rounded-xl flex-shrink-0",
        "bg-muted",
        isOpen && "bg-primary"
      )}>
        <IconComponent className={cn(
          "w-5 h-5 transition-colors duration-200",
          isOpen ? "text-white dark:text-primary-foreground" : "text-primary"
        )} />
      </div>

      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">
        {config.shortLabel || config.label}
      </span>

      <span className={cn(
        "flex items-center justify-center",
        "min-w-[32px] h-7 px-2.5 rounded-full",
        "text-sm font-bold",
        "bg-muted",
        "text-primary"
      )}>
        {count}
      </span>

      <ChevronDown className={cn(
        "w-5 h-5 flex-shrink-0",
        "text-muted-foreground dark:text-muted-foreground",
        "transition-transform duration-300 ease-out",
        isOpen && "rotate-180 text-primary"
      )} />
    </button>
  );
}

// DocumentoCard Component
function DocumentoCard({ documento, onClick }) {
  const { titulo, codigo, tipo, versaoAtual } = documento;

  const tipoConfig = {
    protocolo: { label: 'Protocolo', color: 'bg-success' },
    politica: { label: 'Politica', color: 'bg-[#6366F1]' },
    formulario: { label: 'Formulario', color: 'bg-warning' },
    manual: { label: 'Manual', color: 'bg-[#EC4899]' },
    relatorio: { label: 'Relatorio', color: 'bg-[#3B82F6]' },
    trimestral: { label: 'Trimestral', color: 'bg-[#3B82F6]' },
    incidentes: { label: 'Incidentes', color: 'bg-destructive' },
    indicadores: { label: 'Indicadores', color: 'bg-success' },
  };

  const config = tipoConfig[tipo] || tipoConfig.protocolo;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full min-h-[140px] flex flex-col text-left rounded-[20px] p-4 bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99] transition-all"
    >
      <span className={`self-start px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}>
        {config.label}
      </span>
      <h3 className="mt-2 flex-1 text-[14px] font-bold leading-tight text-foreground hyphens-auto overflow-hidden">
        {titulo}
      </h3>
      <div className="mt-auto pt-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[65%]">
          {codigo}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          v{versaoAtual}
        </span>
      </div>
    </button>
  );
}

// StatCard Component
function StatCard({ value, label, color = 'text-primary' }) {
  return (
    <div className="bg-card rounded-xl p-3 text-center border border-border">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// PageHeader Component (Icon + Counter)
function PageHeader({ icon: Icon, title, count, searchTerm = '' }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn(
        "flex items-center justify-center",
        "w-12 h-12 rounded-xl",
        "bg-muted"
      )}>
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {count} documento{count !== 1 ? 's' : ''} {searchTerm && `encontrado${count !== 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  );
}

// EmptyState Component
function EmptyState({ icon: Icon = BookOpen, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {description}
      </p>
    </div>
  );
}

// LoadingState Component
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

// InfoFooter Component
function InfoFooter({ children }) {
  return (
    <div className={cn(
      "mt-6 p-4 rounded-xl",
      "bg-muted",
      "border border-border"
    )}>
      <p className="text-xs text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

// ============================================================================
// SHOWCASE SECTION WRAPPER
// ============================================================================

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme();
  const t = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <div className="mb-12">
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: t.text.primary }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="text-sm mb-4"
          style={{ color: t.text.secondary }}
        >
          {description}
        </p>
      )}
      <div
        className="rounded-2xl p-6 border"
        style={{
          background: isDark ? TOKENS.dark.background.card : TOKENS.light.background.card,
          borderColor: t.border.default,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SHOWCASE COMPONENT
// ============================================================================

export function GestaoDocumentalShowcase() {
  const { isDark } = useTheme();
  const t = isDark ? TOKENS.dark : TOKENS.light;

  // State for interactive demos
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState({ protocolo: true });
  const [openRelatorioSections, setOpenRelatorioSections] = useState({ trimestral: true });
  const [isLoading, setIsLoading] = useState(false);

  // Filter documents based on search
  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return MOCK_DOCUMENTOS;
    const term = searchTerm.toLowerCase();
    return MOCK_DOCUMENTOS.filter(
      (d) =>
        d.titulo.toLowerCase().includes(term) ||
        d.codigo.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Group documents by type
  const documentosPorTipo = useMemo(() => {
    const grupos = {};
    filteredDocs.forEach((doc) => {
      if (!grupos[doc.tipo]) grupos[doc.tipo] = [];
      grupos[doc.tipo].push(doc);
    });
    return Object.entries(grupos)
      .map(([tipo, documentos]) => ({
        tipo,
        documentos,
        order: TIPO_CONFIG[tipo]?.order || 99,
      }))
      .sort((a, b) => a.order - b.order);
  }, [filteredDocs]);

  // Group relatorios by type
  const relatoriosPorTipo = useMemo(() => {
    const grupos = {};
    MOCK_RELATORIOS.forEach((doc) => {
      if (!grupos[doc.tipo]) grupos[doc.tipo] = [];
      grupos[doc.tipo].push(doc);
    });
    return Object.entries(grupos)
      .map(([tipo, documentos]) => ({
        tipo,
        documentos,
        order: RELATORIO_TIPO_CONFIG[tipo]?.order || 99,
      }))
      .sort((a, b) => a.order - b.order);
  }, []);

  const toggleSection = (tipo) => {
    setOpenSections((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  };

  const toggleRelatorioSection = (tipo) => {
    setOpenRelatorioSections((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  };

  const handleCardClick = () => {
    alert('Navegacao para DocumentoDetalhePage');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{ color: t.text.primary }}
        >
          Gestao Documental
        </h1>
        <p
          className="text-base"
          style={{ color: t.text.secondary }}
        >
          Componentes utilizados nas paginas BibliotecaPage e RelatoriosPage
        </p>
      </div>

      {/* 1. Stats Widgets Section */}
      <ShowcaseSection
        title="1. Widgets de Estatisticas"
        description="Grid de 3 colunas com estatisticas resumidas. Usado no topo da pagina de relatorios."
      >
        <div className="grid grid-cols-3 gap-2">
          <StatCard value="4" label="Trimestrais" color="text-blue-600" />
          <StatCard value="8" label="Incidentes" color="text-red-600" />
          <StatCard value="21" label="KPIs" color="text-green-600" />
        </div>
      </ShowcaseSection>

      {/* 2. Page Header Section */}
      <ShowcaseSection
        title="2. Header com Icone e Contador"
        description="Header padrao das paginas de documentos com icone, titulo e contador de documentos."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-background">
            <PageHeader icon={BookOpen} title="Documentos" count={43} />
          </div>
          <div className="p-4 rounded-xl bg-background">
            <PageHeader icon={ClipboardList} title="Relatorios" count={12} searchTerm="2024" />
          </div>
        </div>
      </ShowcaseSection>

      {/* 3. SearchBar Section */}
      <ShowcaseSection
        title="3. Campo de Busca"
        description="SearchBar do Design System para filtrar documentos por titulo, codigo ou tags."
      >
        <div className="space-y-4">
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar documentos..."
          />
          {searchTerm && (
            <p className="text-sm text-muted-foreground">
              Buscando por: <strong>{searchTerm}</strong> ({filteredDocs.length} resultados)
            </p>
          )}
        </div>
      </ShowcaseSection>

      {/* 4. Section Header (Accordion) */}
      <ShowcaseSection
        title="4. Accordion - SectionHeader"
        description="Cabecalho de secao colapsavel. Mostra icone, titulo, contador e seta de expansao."
      >
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Estados do Accordion:</h3>

          {/* Fechado */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Fechado:</p>
            <SectionHeader
              tipo="protocolo"
              count={17}
              isOpen={false}
              onToggle={() => {}}
            />
          </div>

          {/* Aberto */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Aberto:</p>
            <SectionHeader
              tipo="politica"
              count={5}
              isOpen={true}
              onToggle={() => {}}
            />
          </div>

          {/* Interativo */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Interativo (clique para testar):</p>
            <div className="space-y-2">
              {documentosPorTipo.map(({ tipo, documentos }) => (
                <SectionHeader
                  key={tipo}
                  tipo={tipo}
                  count={documentos.length}
                  isOpen={openSections[tipo] || false}
                  onToggle={() => toggleSection(tipo)}
                />
              ))}
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* 5. DocumentoCard Grid */}
      <ShowcaseSection
        title="5. Grid de DocumentoCard"
        description="Cards de documentos em grid de 2 colunas. Cada card mostra badge de tipo, titulo, codigo e versao."
      >
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Tipos de Documentos:</h3>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_DOCUMENTOS.slice(0, 4).map((doc) => (
              <DocumentoCard
                key={doc.id}
                documento={doc}
                onClick={handleCardClick}
              />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-muted-foreground mt-6">Tipos de Relatorios:</h3>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_RELATORIOS.slice(0, 4).map((doc) => (
              <DocumentoCard
                key={doc.id}
                documento={doc}
                onClick={handleCardClick}
              />
            ))}
          </div>
        </div>
      </ShowcaseSection>

      {/* 6. Complete Accordion with Cards */}
      <ShowcaseSection
        title="6. Accordion Completo com Cards"
        description="Demonstracao do padrao completo: SectionHeader + Grid de DocumentoCard quando expandido."
      >
        <div className="space-y-3 bg-background p-4 rounded-xl">
          {/* Biblioteca style */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Biblioteca de Documentos:</h3>
          {documentosPorTipo.map(({ tipo, documentos }) => (
            <section key={tipo}>
              <SectionHeader
                tipo={tipo}
                count={documentos.length}
                isOpen={openSections[tipo] || false}
                onToggle={() => toggleSection(tipo)}
              />
              {openSections[tipo] && (
                <div className="grid grid-cols-2 gap-3 mt-3 ml-2">
                  {documentos.map((doc) => (
                    <DocumentoCard
                      key={doc.id}
                      documento={doc}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Relatorios style */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 mt-6">Relatorios:</h3>
          {relatoriosPorTipo.map(({ tipo, documentos }) => (
            <section key={tipo}>
              <SectionHeader
                tipo={tipo}
                count={documentos.length}
                isOpen={openRelatorioSections[tipo] || false}
                onToggle={() => toggleRelatorioSection(tipo)}
                configMap={RELATORIO_TIPO_CONFIG}
              />
              {openRelatorioSections[tipo] && (
                <div className="grid grid-cols-2 gap-3 mt-3 ml-2">
                  {documentos.map((doc) => (
                    <DocumentoCard
                      key={doc.id}
                      documento={doc}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </ShowcaseSection>

      {/* 7. Empty State */}
      <ShowcaseSection
        title="7. Estado Vazio"
        description="Exibido quando nao ha documentos encontrados na busca ou na categoria."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-background p-4 rounded-xl">
            <EmptyState
              icon={BookOpen}
              title="Nenhum documento encontrado"
              description="Tente ajustar os filtros ou buscar por outro termo."
            />
          </div>
          <div className="bg-background p-4 rounded-xl">
            <EmptyState
              icon={ClipboardList}
              title="Nenhum relatorio encontrado"
              description="Tente ajustar a busca ou aguarde a publicacao de novos relatorios."
            />
          </div>
        </div>
      </ShowcaseSection>

      {/* 8. Loading State */}
      <ShowcaseSection
        title="8. Estado de Carregamento"
        description="Spinner exibido enquanto os dados estao sendo carregados."
      >
        <div className="bg-background p-4 rounded-xl">
          <LoadingState />
        </div>
      </ShowcaseSection>

      {/* 9. Info Footer */}
      <ShowcaseSection
        title="9. Rodape Informativo"
        description="Notas e informacoes adicionais no rodape da pagina."
      >
        <div className="space-y-4">
          <InfoFooter>
            <strong>Nota:</strong> Os documentos sao atualizados periodicamente pelo Comite de Qualidade.
            Em caso de duvidas, entre em contato com a coordenacao.
          </InfoFooter>

          <InfoFooter>
            <strong>Nota:</strong> Os relatorios sao gerados periodicamente pelo Comite de Qualidade e Seguranca.
            Em caso de duvidas, entre em contato com a coordenacao.
          </InfoFooter>
        </div>
      </ShowcaseSection>

      {/* 10. Full Page Demo */}
      <ShowcaseSection
        title="10. Demo Completa da Pagina"
        description="Simulacao completa de uma pagina de gestao documental com todos os componentes integrados."
      >
        <div className="bg-background rounded-xl overflow-hidden">
          {/* Simulated page content */}
          <div className="p-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatCard value="4" label="Trimestrais" color="text-blue-600" />
              <StatCard value="4" label="Incidentes" color="text-red-600" />
              <StatCard value="4" label="Indicadores" color="text-green-600" />
            </div>

            {/* Header */}
            <PageHeader icon={ClipboardList} title="Relatorios" count={12} />

            {/* Search */}
            <SearchBar
              value=""
              onChange={() => {}}
              placeholder="Buscar relatorios..."
              className="mb-4"
            />

            {/* Accordions */}
            <div className="space-y-3">
              <section>
                <SectionHeader
                  tipo="trimestral"
                  count={2}
                  isOpen={true}
                  onToggle={() => {}}
                  configMap={RELATORIO_TIPO_CONFIG}
                />
                <div className="grid grid-cols-2 gap-3 mt-3 ml-2">
                  {MOCK_RELATORIOS.filter(r => r.tipo === 'trimestral').map((doc) => (
                    <DocumentoCard key={doc.id} documento={doc} onClick={handleCardClick} />
                  ))}
                </div>
              </section>

              <SectionHeader
                tipo="incidentes"
                count={2}
                isOpen={false}
                onToggle={() => {}}
                configMap={RELATORIO_TIPO_CONFIG}
              />

              <SectionHeader
                tipo="indicadores"
                count={1}
                isOpen={false}
                onToggle={() => {}}
                configMap={RELATORIO_TIPO_CONFIG}
              />
            </div>

            {/* Info Footer */}
            <InfoFooter>
              <strong>Nota:</strong> Os relatorios sao gerados periodicamente pelo Comite de Qualidade e Seguranca.
            </InfoFooter>
          </div>
        </div>
      </ShowcaseSection>

      {/* Usage Guidelines */}
      <div
        className="mt-8 p-4 rounded-xl"
        style={{
          background: isDark ? TOKENS.dark.background.card : '#E8F5E9',
          border: `1px solid ${t.border.default}`,
        }}
      >
        <h3
          className="font-semibold mb-2"
          style={{ color: t.text.primary }}
        >
          Guia de Uso
        </h3>
        <ul
          className="text-sm space-y-1"
          style={{ color: t.text.secondary }}
        >
          <li>
            <strong>SectionHeader:</strong> Use para criar secoes colapsaveis. Recebe tipo, count, isOpen e onToggle.
          </li>
          <li>
            <strong>DocumentoCard:</strong> Card para exibir documento em grid. Recebe documento e onClick.
          </li>
          <li>
            <strong>PageHeader:</strong> Header padrao com icone e contador. Use no topo da pagina.
          </li>
          <li>
            <strong>StatCard:</strong> Widget de estatistica para grids 3 colunas.
          </li>
          <li>
            <strong>SearchBar:</strong> Componente do Design System para busca.
          </li>
          <li>
            <strong>EmptyState:</strong> Feedback visual quando nao ha resultados.
          </li>
          <li>
            <strong>LoadingState:</strong> Spinner enquanto carrega dados.
          </li>
          <li>
            <strong>InfoFooter:</strong> Notas informativas no rodape.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default GestaoDocumentalShowcase;
