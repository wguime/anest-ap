import { useState, useMemo } from 'react';
import { PageHeader } from '../components';
import DocumentoCard from '../components/DocumentoCard';
import { SearchBar, SectionCard, Badge, Skeleton, EmptySearch } from '@/design-system';
import { useSearch } from '../hooks/useSearch';
import { SEARCH_RESULT_TYPES } from '@/types/documents';
import {
  ChevronRight, Search, FileText, AlertTriangle, ClipboardList,
  Calculator, CheckSquare, Wrench, FileCheck,
  DollarSign, CalendarDays, ShieldCheck, Briefcase, Receipt,
  TrendingUp, ClipboardCheck, Scale, ShieldAlert, Pill, AlertOctagon, FileBarChart,
  BookOpen, Library, Bug, FolderOpen,
  Target, Headphones, GraduationCap, BookMarked, Trophy,
  Network, Users, Calendar,
  Megaphone, Mail, FileSearch,
} from 'lucide-react';

const iconMap = {
  Calculator, CheckSquare, Wrench, FileCheck,
  DollarSign, CalendarDays, ShieldCheck, Briefcase, Receipt,
  AlertTriangle, TrendingUp, ClipboardCheck, Scale, ShieldAlert, Pill, AlertOctagon, FileBarChart,
  BookOpen, Library, Bug, FolderOpen,
  Target, Headphones, GraduationCap, BookMarked, Trophy,
  Network, Users, Calendar,
  Megaphone, ClipboardList, Mail, FileSearch,
};

const TYPE_CONFIG = {
  [SEARCH_RESULT_TYPES.PAGE]: {
    label: 'Secoes',
    icon: BookOpen,
    color: 'bg-[#006837]',
    badgeVariant: 'success',
  },
  [SEARCH_RESULT_TYPES.DOCUMENTO]: {
    label: 'Documentos',
    icon: FileText,
    color: 'bg-[#2563eb]',
    badgeVariant: 'info',
  },
  [SEARCH_RESULT_TYPES.INCIDENTE]: {
    label: 'Incidentes',
    icon: AlertTriangle,
    color: 'bg-[#DC2626]',
    badgeVariant: 'destructive',
  },
  [SEARCH_RESULT_TYPES.PLANO_ACAO]: {
    label: 'Planos de Acao',
    icon: ClipboardList,
    color: 'bg-[#7c3aed]',
    badgeVariant: 'default',
  },
};

export default function SearchResultsPage({ onNavigate, goBack, params }) {
  const [query, setQuery] = useState(params?.query || '');
  const [activeFilter, setActiveFilter] = useState(null);

  const filters = useMemo(() => ({
    type: activeFilter,
  }), [activeFilter]);

  const { results, facets, isLoading, error, hasSearched } = useSearch(query, filters);

  const hasQuery = query.trim().length > 0;

  // Group results by type
  const grouped = useMemo(() => {
    const groups = {
      [SEARCH_RESULT_TYPES.PAGE]: [],
      [SEARCH_RESULT_TYPES.DOCUMENTO]: [],
      [SEARCH_RESULT_TYPES.INCIDENTE]: [],
      [SEARCH_RESULT_TYPES.PLANO_ACAO]: [],
    };
    for (const r of results) {
      if (groups[r.resultType]) {
        groups[r.resultType].push(r);
      }
    }
    return groups;
  }, [results]);

  // Navigate to result
  const handleResultClick = (result) => {
    switch (result.resultType) {
      case SEARCH_RESULT_TYPES.PAGE:
        if (result.route) onNavigate(result.route);
        break;
      case SEARCH_RESULT_TYPES.DOCUMENTO:
        onNavigate('documento-detalhe', { documentoId: result.resultId });
        break;
      case SEARCH_RESULT_TYPES.INCIDENTE:
        onNavigate('centroGestao', { initialSection: 'incidentes' });
        break;
      case SEARCH_RESULT_TYPES.PLANO_ACAO:
        onNavigate('planosAcao');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      <PageHeader title="Busca" onBack={goBack} />

      <div className="px-4 sm:px-5">
        <SearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSubmit={() => { document.activeElement?.blur(); }}
          placeholder="Buscar documentos, incidentes, planos..."
        />

        {/* Filter chips */}
        {hasQuery && (
          <div className="flex gap-2 mt-3 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                !activeFilter
                  ? 'bg-[#006837] text-white'
                  : 'bg-white dark:bg-[#1A2420] text-[#6B7280] dark:text-[#A3B8B0] border border-[#E5E7EB] dark:border-[#2A3F36]'
              }`}
            >
              Todos
              <Badge variant="secondary" badgeStyle="subtle" className="ml-0.5">
                {facets.total}
              </Badge>
            </button>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
              const count = facets[type] || 0;
              if (count === 0 && activeFilter !== type) return null;
              const TypeIcon = config.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveFilter(activeFilter === type ? null : type)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeFilter === type
                      ? 'bg-[#006837] text-white'
                      : 'bg-white dark:bg-[#1A2420] text-[#6B7280] dark:text-[#A3B8B0] border border-[#E5E7EB] dark:border-[#2A3F36]'
                  }`}
                >
                  <TypeIcon className="w-3.5 h-3.5" />
                  {config.label}
                  <Badge variant="secondary" badgeStyle="subtle" className="ml-0.5">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {isLoading && hasQuery && (
          <div className="space-y-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 border border-[#E5E7EB] dark:border-[#2A3F36]">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Initial state */}
        {!hasQuery && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-12 h-12 text-[#A5D6A7] dark:text-[#2A3F36] mb-3" />
            <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
              Digite para buscar em documentos, incidentes e planos de acao
            </p>
          </div>
        )}

        {/* Empty state */}
        {hasQuery && hasSearched && !isLoading && results.length === 0 && (
          <EmptySearch
            size="sm"
            description="Tente buscar com outros termos"
          />
        )}

        {/* Results header */}
        {hasSearched && !isLoading && results.length > 0 && (
          <p className="text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] mb-3">
            {facets.total} resultado{facets.total !== 1 ? 's' : ''} encontrado{facets.total !== 1 ? 's' : ''}
          </p>
        )}

        {/* Pages section */}
        {!isLoading && grouped[SEARCH_RESULT_TYPES.PAGE].length > 0 && (
          <SectionCard title="Secoes do App" className="mb-4">
            {grouped[SEARCH_RESULT_TYPES.PAGE].map((page) => {
              const Icon = iconMap[page.icon];
              return (
                <button
                  key={page.resultId}
                  type="button"
                  onClick={() => handleResultClick(page)}
                  className="w-full flex items-center gap-3 py-3 border-b border-gray-100 dark:border-[#2A3F36] last:border-0 text-left"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#E8F5E9] dark:bg-[#1A2F23] shrink-0">
                    {Icon && <Icon className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1F2937] dark:text-white truncate">
                      {page.titulo}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#6B8178] truncate">
                      {page.descricao}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF] dark:text-[#6B8178] shrink-0" />
                </button>
              );
            })}
          </SectionCard>
        )}

        {/* Documents section */}
        {!isLoading && grouped[SEARCH_RESULT_TYPES.DOCUMENTO].length > 0 && (
          <SectionCard title="Documentos" className="mb-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 pt-1">
              {grouped[SEARCH_RESULT_TYPES.DOCUMENTO].map((doc) => (
                <DocumentoCard
                  key={doc.resultId}
                  documento={{
                    id: doc.resultId,
                    titulo: doc.titulo,
                    codigo: doc.extra?.codigo || '',
                    tipo: doc.extra?.tipo || '',
                    versaoAtual: doc.extra?.versao || 1,
                  }}
                  onClick={() => handleResultClick(doc)}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Incidents section */}
        {!isLoading && grouped[SEARCH_RESULT_TYPES.INCIDENTE].length > 0 && (
          <SectionCard title="Incidentes" className="mb-4">
            {grouped[SEARCH_RESULT_TYPES.INCIDENTE].map((inc) => (
              <button
                key={inc.resultId}
                type="button"
                onClick={() => handleResultClick(inc)}
                className="w-full flex items-center gap-3 py-3 border-b border-gray-100 dark:border-[#2A3F36] last:border-0 text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-900/20 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1F2937] dark:text-white truncate">
                    {inc.titulo || 'Incidente'}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] truncate">
                    {inc.descricao}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant={inc.status === 'pendente' ? 'warning' : inc.status === 'ativo' ? 'success' : 'secondary'}
                    badgeStyle="subtle"
                  >
                    {inc.status}
                  </Badge>
                  {inc.extra?.tipo && (
                    <span className="text-[10px] text-[#9CA3AF] dark:text-[#6B8178]">
                      {inc.extra.tipo}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </SectionCard>
        )}

        {/* Planos de Acao section */}
        {!isLoading && grouped[SEARCH_RESULT_TYPES.PLANO_ACAO].length > 0 && (
          <SectionCard title="Planos de Acao" className="mb-4">
            {grouped[SEARCH_RESULT_TYPES.PLANO_ACAO].map((plano) => (
              <button
                key={plano.resultId}
                type="button"
                onClick={() => handleResultClick(plano)}
                className="w-full flex items-center gap-3 py-3 border-b border-gray-100 dark:border-[#2A3F36] last:border-0 text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 shrink-0">
                  <ClipboardList className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1F2937] dark:text-white truncate">
                    {plano.titulo}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] truncate">
                    {plano.descricao}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant={plano.status === 'pendente' ? 'warning' : plano.status === 'ativo' ? 'success' : 'secondary'}
                    badgeStyle="subtle"
                  >
                    {plano.status}
                  </Badge>
                  {plano.extra?.fase_pdca && (
                    <span className="text-[10px] font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase">
                      {plano.extra.fase_pdca}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
