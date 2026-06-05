import { Scale, Users, ClipboardCheck, FileText, BookOpen, DollarSign, Pill, ShieldAlert, Flame, FolderOpen } from 'lucide-react'

/**
 * SECTION_CONFIG — declarative config for the parametrized DocumentSection.
 *
 * Each entry drives the unified UI:
 *  - icon              : lucide icon component used in EmptyState/StatsCard
 *  - color             : token color class (e.g. 'text-primary', 'text-info', 'text-destructive')
 *                        — drives icon color in EmptyState and stat highlights
 *  - statColor         : hex used by StatsCard (which renders inline svg/style)
 *  - label             : human-readable label for the section
 *  - unit              : singular noun for category card counts ('documento' | 'auditoria' | 'relatorio')
 *  - searchPlaceholder : placeholder text for the FilterBar search input
 *  - addLabel          : label for the "add new" CTA button
 *  - emptyTitle        : empty-state title (no docs match filter)
 *  - emptyDescription  : empty-state description when no search
 *  - statsTotalLabel   : label for the "total" StatsCard
 *  - statsCategoryTitle: title for the "Documentos por Categoria" card in stats tab
 *  - categoriesGridCols: tailwind classes for category-tab grid (varies per section)
 *  - extraTabs         : array of additional sub-tab IDs supported by the section
 *                        (e.g. ['revisoes', 'relatorios'] for AuditoriasSection)
 *  - extraStats        : optional extra StatsCard rows for stats tab
 */
export const SECTION_CONFIG = {
  // Bloco 2 — visão unificada do Centro de Gestão: TODOS os documentos navegados
  // por subcategoria (11 + 99 Outros), igual à Biblioteca. `grouped: true` ativa
  // a árvore de accordions no DocumentSection.
  todos: {
    icon: FolderOpen,
    color: 'text-primary',
    statColor: '#006837',
    label: 'Todos os Documentos',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Subcategoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    extraTabs: [],
    grouped: true,
  },
  etica: {
    icon: Scale,
    color: 'text-primary',
    statColor: '#006837',
    label: 'Ética e Bioética',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos de etica...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento de etica',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    extraTabs: [],
  },
  comites: {
    icon: Users,
    color: 'text-info',
    statColor: '#1565C0',
    label: 'Comités',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos de comites...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento de comite',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Comité',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    extraTabs: [],
  },
  auditorias: {
    icon: ClipboardCheck,
    color: 'text-primary',
    statColor: '#7B1FA2',
    label: 'Auditorias',
    unit: 'auditoria',
    searchPlaceholder: 'Buscar auditorias...',
    addLabel: 'Nova Auditoria',
    addEmptyLabel: 'Adicionar Auditoria',
    emptyTitle: 'Nenhuma auditoria encontrada',
    emptyDescription: 'Comece adicionando uma nova auditoria',
    statsTotalLabel: 'Total de Auditorias',
    statsCategoryTitle: 'Auditorias por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    extraTabs: ['revisoes', 'relatorios'],
  },
  relatorios: {
    icon: FileText,
    color: 'text-primary',
    statColor: '#00838F',
    label: 'Relatórios',
    unit: 'relatorio',
    searchPlaceholder: 'Buscar relatorios...',
    addLabel: 'Novo Relatório',
    addEmptyLabel: 'Adicionar Relatório',
    emptyTitle: 'Nenhum relatorio encontrado',
    emptyDescription: 'Comece adicionando um novo relatorio',
    statsTotalLabel: 'Total de Relatorios',
    statsCategoryTitle: 'Relatorios por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    extraTabs: [],
  },
  biblioteca: {
    icon: BookOpen,
    color: 'text-primary',
    statColor: '#059669',
    label: 'Biblioteca',
    unit: 'documento',
    searchPlaceholder: 'Buscar na biblioteca...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo protocolo ou documento',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Tipo',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    extraTabs: [],
    /** Biblioteca uniquely also supports a tag-search filter */
    searchByTags: true,
  },
  financeiro: {
    icon: DollarSign,
    color: 'text-primary',
    statColor: '#2E7D32',
    label: 'Financeiro',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos financeiros...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento financeiro',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    extraTabs: [],
  },
  medicamentos: {
    icon: Pill,
    color: 'text-primary',
    statColor: '#006837',
    label: 'Medicamentos',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos de medicamentos...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento de medicamentos',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    extraTabs: [],
  },
  infeccoes: {
    icon: ShieldAlert,
    color: 'text-primary',
    statColor: '#006837',
    label: 'Prevenção de Infecções',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos de infeccoes...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento de prevencao de infeccoes',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    extraTabs: [],
  },
  desastres: {
    icon: Flame,
    color: 'text-destructive',
    statColor: '#D32F2F',
    label: 'Gerenciamento de Desastres',
    unit: 'documento',
    searchPlaceholder: 'Buscar documentos de desastres...',
    addLabel: 'Novo Documento',
    addEmptyLabel: 'Adicionar Documento',
    emptyTitle: 'Nenhum documento encontrado',
    emptyDescription: 'Comece adicionando um novo documento de gerenciamento de desastres',
    statsTotalLabel: 'Total de Documentos',
    statsCategoryTitle: 'Documentos por Categoria',
    categoriesGridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    extraTabs: [],
  },
}

/**
 * Get config for a categoryId.
 * @param {string} categoryId
 * @returns {object|null}
 */
export function getSectionConfig(categoryId) {
  return SECTION_CONFIG[categoryId] || null
}

export default SECTION_CONFIG
