import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  FolderOpen,
  Scale,
  Users,
  ClipboardCheck,
  ClipboardList,
  BookOpen,
  DollarSign,
  Archive,
  BarChart3,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Pill,
  ShieldAlert,
  Flame,
  CheckSquare,
  Calendar,
  History,
} from 'lucide-react'
import { Card, CardContent } from '@/design-system'
import { Button } from '@/design-system'
import { Badge } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useTheme } from '@/design-system'
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory'

/**
 * Document categories configuration
 * Each category has an id, label, icon, and color for visual distinction
 */
const DOC_CATEGORIES = [
  {
    id: 'etica',
    label: 'Ética',
    icon: Scale,
    color: '#006837',
    description: 'Documentos de ética e bioética',
  },
  {
    id: 'comites',
    label: 'Comitês',
    icon: Users,
    color: '#1565C0',
    description: 'Documentos dos comitês institucionais',
  },
  {
    id: 'auditorias',
    label: 'Auditorias',
    icon: ClipboardCheck,
    color: '#7B1FA2',
    description: 'Auditorias internas e externas',
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: ClipboardList,
    color: '#00838F',
    description: 'Relatórios de segurança e qualidade',
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    icon: BookOpen,
    color: '#EF6C00',
    description: 'Biblioteca de protocolos e documentos',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    color: '#2E7D32',
    description: 'Documentos financeiros',
  },
  {
    id: 'medicamentos',
    label: 'Medicamentos',
    icon: Pill,
    color: '#1565C0',
    description: 'Uso de medicamentos',
  },
  {
    id: 'infeccoes',
    label: 'Infecções',
    icon: ShieldAlert,
    color: '#00838F',
    description: 'Prevenção de infecções',
  },
  {
    id: 'desastres',
    label: 'Desastres',
    icon: Flame,
    color: '#D32F2F',
    description: 'Gerenciamento de desastres',
  },
]

/**
 * Sub-tabs configuration for each document category
 * Maps category ID to array of sub-tab definitions
 */
const SUB_TABS_CONFIG = {
  etica: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  comites: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  auditorias: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'revisoes', label: 'Revisões', icon: RefreshCw },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'relatorios', label: 'Relatórios', icon: ClipboardList },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  relatorios: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  biblioteca: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  financeiro: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  medicamentos: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  infeccoes: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
  desastres: [
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'categorias', label: 'Categorias', icon: FolderOpen },
    { id: 'arquivados', label: 'Arquivados', icon: Archive },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ],
}

/**
 * Cross-category sub-tabs for document workflow tools
 * These appear as additional navigation options across all categories
 */
const CROSS_TABS = [
  { id: 'aprovacoes', label: 'Aprovações', icon: CheckSquare },
  { id: 'calendario-revisoes', label: 'Revisões', icon: Calendar },
  { id: 'trilha-auditoria', label: 'Auditoria', icon: History },
]

/**
 * SubTabPill - Individual sub-tab pill button (text-only, no icons)
 */
function SubTabPill({ tab, isActive, onClick, isDark }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'py-2.5 px-3 rounded-xl text-sm font-medium text-center',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2',
        isDark ? 'focus-visible:ring-primary' : 'focus-visible:ring-primary',
        isActive
          ? 'bg-white dark:bg-muted text-primary shadow-sm'
          : 'text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-white/50 dark:hover:bg-muted/50'
      )}
    >
      {tab.label}
    </button>
  )
}

/**
 * ComingSoonPlaceholder - Placeholder for sections that are not yet available
 */
function ComingSoonPlaceholder({ categoryLabel, isDark }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div
        className={cn(
          'w-20 h-20 rounded-2xl flex items-center justify-center mb-6',
          'bg-muted'
        )}
      >
        <Clock className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-xl font-bold text-black dark:text-white mb-2">Em breve</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        A seção de {categoryLabel} está em desenvolvimento e estará disponível em breve.
      </p>
      <Badge variant="outline" className="mt-4">
        Em desenvolvimento
      </Badge>
    </motion.div>
  )
}

/**
 * PlaceholderContent - Generic placeholder for sub-tab content
 */
function PlaceholderContent({ category, subTab, isDark }) {
  const categoryConfig = DOC_CATEGORIES.find((c) => c.id === category)
  const subTabConfig = SUB_TABS_CONFIG[category]?.find((t) => t.id === subTab)

  if (!categoryConfig || !subTabConfig) return null

  const Icon = subTabConfig.icon
  const CategoryIcon = categoryConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card variant="default" className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${categoryConfig.color}20` }}
            >
              <CategoryIcon className="w-6 h-6" style={{ color: categoryConfig.color }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-black dark:text-white">
                {categoryConfig.label} - {subTabConfig.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {categoryConfig.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-12 text-center border-t border-border">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
                'bg-muted'
              )}
            >
              <Icon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Conteúdo de {subTabConfig.label}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Esta área exibirá a lista de {subTabConfig.label.toLowerCase()} da categoria{' '}
              {categoryConfig.label}.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * DocumentsLayout - Layout component for the Documents section of the Management Center
 *
 * This component manages the Documents section with 6 sub-categories:
 * - Etica (sub-tabs: documentos, categorias, arquivados, stats)
 * - Comites (sub-tabs: documentos, categorias, arquivados, stats)
 * - Auditorias (sub-tabs: documentos, categorias, revisoes, arquivados, relatorios, stats)
 * - Relatorios (sub-tabs: documentos, categorias, arquivados, stats)
 * - Biblioteca (document list with favorites)
 * - Financeiro (placeholder "Em breve")
 *
 * Features:
 * - Category pills at the top for switching between document categories
 * - Sub-tabs for each category with icons on desktop, icons only on mobile
 * - Placeholder content for each section
 * - Dark mode support
 * - Responsive design
 *
 * @param {string} activeCategory - Current active category ID
 * @param {string} activeSubTab - Current active sub-tab ID
 * @param {function} onCategoryChange - Callback when category changes (category) => void
 * @param {function} onSubTabChange - Callback when sub-tab changes (subTab) => void
 * @param {React.ReactNode} children - Content to render in the active section (overrides placeholder)
 */
/**
 * ComplianceBar - Displays compliance metrics for the active document category
 */
function ComplianceBar({ category }) {
  const { activeCount, overdueCount, pendingCount } = useDocumentsByCategory(category)

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-xl',
      'bg-card',
      'border border-border',
      'text-sm'
    )}>
      <div className="flex items-center gap-1.5 text-primary">
        <FileText className="w-4 h-4" />
        <span className="font-semibold">{activeCount}</span>
        <span className="text-xs text-muted-foreground">docs</span>
      </div>
      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Clock className="w-4 h-4" />
          <span className="font-semibold">{pendingCount}</span>
          <span className="text-xs">pendentes</span>
        </div>
      )}
      {overdueCount > 0 && (
        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold">{overdueCount}</span>
          <span className="text-xs">vencidos</span>
        </div>
      )}
      {overdueCount === 0 && pendingCount === 0 && (
        <div className="flex items-center gap-1.5 text-success">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-medium">Em conformidade</span>
        </div>
      )}
    </div>
  )
}

function DocumentsLayout({
  activeCategory = 'etica',
  activeSubTab = 'documentos',
  onCategoryChange,
  onSubTabChange,
  children,
}) {
  const { isDark } = useTheme()

  // Get current category configuration
  const currentCategory = useMemo(
    () => DOC_CATEGORIES.find((c) => c.id === activeCategory) || DOC_CATEGORIES[0],
    [activeCategory]
  )

  // Get sub-tabs for current category (include cross-category workflow tabs)
  const currentSubTabs = useMemo(() => {
    const categoryTabs = SUB_TABS_CONFIG[activeCategory] || []
    if (categoryTabs.length === 0) return categoryTabs
    return [...categoryTabs, ...CROSS_TABS]
  }, [activeCategory])

  // Check if current category is "coming soon" (no category-specific sub-tabs)
  const isComingSoon = (SUB_TABS_CONFIG[activeCategory] || []).length === 0

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    onCategoryChange?.(categoryId)
    // Reset to first sub-tab of the new category
    const newSubTabs = SUB_TABS_CONFIG[categoryId] || []
    if (newSubTabs.length > 0) {
      onSubTabChange?.(newSubTabs[0].id)
    }
  }

  // Handle sub-tab change
  const handleSubTabChange = (subTabId) => {
    onSubTabChange?.(subTabId)
  }

  return (
    <div className="space-y-4">
      {/* Compliance Bar */}
      <ComplianceBar category={activeCategory} />

      {/* Sub-tabs Container (if category has sub-tabs) - Grid layout for symmetric distribution */}
      <AnimatePresence mode="wait">
        {!isComingSoon && currentSubTabs.length > 0 && (
          <motion.div
            key={`subtabs-${activeCategory}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'grid gap-2 p-2 bg-muted rounded-xl overflow-hidden',
              currentSubTabs.length <= 3 ? 'grid-cols-3' :
              currentSubTabs.length === 4 ? 'grid-cols-2' :
              currentSubTabs.length <= 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
            )}
          >
            {currentSubTabs.map((tab) => (
              <SubTabPill
                key={tab.id}
                tab={tab}
                isActive={activeSubTab === tab.id}
                onClick={() => handleSubTabChange(tab.id)}
                isDark={isDark}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${activeCategory}-${activeSubTab}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {isComingSoon ? (
            <ComingSoonPlaceholder categoryLabel={currentCategory.label} isDark={isDark} />
          ) : children ? (
            children
          ) : (
            <PlaceholderContent
              category={activeCategory}
              subTab={activeSubTab}
              isDark={isDark}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default DocumentsLayout
