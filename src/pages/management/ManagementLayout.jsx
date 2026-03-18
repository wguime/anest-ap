import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  FolderOpen,
  BarChart3,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  Megaphone,
  ChevronDown,
  ClipboardList,
  TrendingUp,
  Calendar,
  LayoutDashboard,
  Server,
  FileText,
  Shield,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'
import { useTheme } from '@/design-system'
import { useBreakpoint } from '@/design-system/hooks'

/**
 * Navigation items configuration for the Management Center
 */
const NAVIGATION_ITEMS = [
  {
    id: 'usuarios',
    label: 'Usuarios',
    icon: Users,
  },
  {
    id: 'cargos',
    label: 'Cargos',
    icon: Briefcase,
  },
  {
    id: 'emails',
    label: 'Emails',
    icon: Mail,
  },
  {
    id: 'auditLog',
    label: 'Auditoria',
    icon: FileText,
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FolderOpen,
    subItems: [
      { id: 'etica', label: 'Etica' },
      { id: 'comites', label: 'Comites' },
      { id: 'auditorias', label: 'Auditorias' },
      { id: 'relatorios', label: 'Relatorios' },
      { id: 'biblioteca', label: 'Biblioteca' },
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'medicamentos', label: 'Medicamentos' },
      { id: 'infeccoes', label: 'Infeccoes' },
      { id: 'desastres', label: 'Desastres' },
    ],
  },
  {
    id: 'comunicados',
    label: 'Comunicados',
    icon: Megaphone,
  },
  {
    id: 'incidentes',
    label: 'Incidentes',
    icon: AlertTriangle,
  },
  {
    id: 'indicadores',
    label: 'Indicadores',
    icon: TrendingUp,
  },
  {
    id: 'planosAcao',
    label: 'Planos de Acao',
    icon: ClipboardList,
  },
  {
    id: 'residencia',
    label: 'Residencia',
    icon: GraduationCap,
  },
  {
    id: 'educacao',
    label: 'Educacao',
    icon: BookOpen,
  },
  {
    id: 'funcionarios',
    label: 'Funcionarios',
    icon: Calendar,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'infraestrutura',
    label: 'Infraestrutura',
    icon: Server,
  },
  {
    id: 'lgpd',
    label: 'LGPD',
    icon: Shield,
  },
]

/**
 * Desktop sidebar widths
 */
const SIDEBAR_WIDTH_EXPANDED = 260
const SIDEBAR_WIDTH_COLLAPSED = 64

/**
 * NavItem - Individual navigation item for the sidebar
 */
function NavItem({
  item,
  isActive,
  isExpanded,
  isSidebarCollapsed,
  activeSubSection,
  onSelect,
  isDark,
}) {
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(isExpanded)
  const hasSubItems = item.subItems && item.subItems.length > 0
  const Icon = item.icon

  const handleClick = () => {
    if (hasSubItems) {
      if (!isSidebarCollapsed) {
        setIsSubMenuOpen(!isSubMenuOpen)
      }
      // Select the first sub-item if clicking on parent
      if (!isActive) {
        onSelect(item.id, item.subItems[0].id)
      }
    } else {
      onSelect(item.id)
    }
  }

  const handleSubItemClick = (subItem) => {
    onSelect(item.id, subItem.id)
  }

  return (
    <div className="mb-1">
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
          'transition-all duration-200 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isDark
            ? 'focus-visible:ring-primary focus-visible:ring-offset-[#1A2420]'
            : 'focus-visible:ring-primary focus-visible:ring-offset-white',
          isActive && !hasSubItems
            ? cn(
                'bg-muted',
                'border-l-[3px] border-primary',
                'text-primary',
                'font-semibold'
              )
            : cn(
                'text-muted-foreground',
                'hover:bg-background dark:hover:bg-card',
                'hover:text-foreground dark:hover:text-primary'
              ),
          isSidebarCollapsed ? 'justify-center px-0' : 'justify-start'
        )}
        title={isSidebarCollapsed ? item.label : undefined}
      >
        <Icon
          className={cn(
            'w-5 h-5 flex-shrink-0',
            isActive
              ? 'text-primary'
              : 'text-muted-foreground'
          )}
        />
        {!isSidebarCollapsed && (
          <>
            <span className="flex-1 text-left text-sm font-medium truncate">
              {item.label}
            </span>
            {hasSubItems && (
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  isSubMenuOpen ? 'rotate-180' : 'rotate-0'
                )}
              />
            )}
          </>
        )}
      </button>

      {/* Sub-items */}
      {hasSubItems && !isSidebarCollapsed && (
        <AnimatePresence initial={false}>
          {isSubMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pl-8 pr-2 py-1 space-y-0.5">
                {item.subItems.map((subItem) => (
                  <button
                    key={subItem.id}
                    onClick={() => handleSubItemClick(subItem)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm',
                      'transition-all duration-150',
                      'focus:outline-none focus-visible:ring-2',
                      isDark
                        ? 'focus-visible:ring-primary'
                        : 'focus-visible:ring-primary',
                      activeSubSection === subItem.id
                        ? cn(
                            'bg-muted',
                            'text-primary',
                            'font-medium'
                          )
                        : cn(
                            'text-muted-foreground',
                            'hover:bg-background dark:hover:bg-card',
                            'hover:text-foreground dark:hover:text-primary'
                          )
                    )}
                  >
                    {subItem.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

/**
 * MobileTabBar - Horizontal scrollable tabs for mobile
 */
function MobileTabBar({
  activeSection,
  activeSubSection,
  onSectionChange,
  isDark,
}) {
  const [expandedSection, setExpandedSection] = useState(null)

  const handleTabClick = (item) => {
    if (item.subItems && item.subItems.length > 0) {
      if (expandedSection === item.id) {
        setExpandedSection(null)
      } else {
        setExpandedSection(item.id)
        // Select first sub-item if not already in this section
        if (activeSection !== item.id) {
          onSectionChange(item.id, item.subItems[0].id)
        }
      }
    } else {
      setExpandedSection(null)
      onSectionChange(item.id)
    }
  }

  return (
    <div className="border-b border-border">
      {/* Main tabs */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 gap-1">
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          const hasSubItems = item.subItems && item.subItems.length > 0

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-t-lg',
                'whitespace-nowrap text-sm font-medium',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                isDark
                  ? 'focus-visible:ring-primary'
                  : 'focus-visible:ring-primary',
                isActive
                  ? cn(
                      'bg-muted',
                      'text-primary',
                      'border-b-2 border-primary'
                    )
                  : cn(
                      'text-muted-foreground',
                      'hover:bg-background dark:hover:bg-card'
                    )
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {hasSubItems && (
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-200',
                    expandedSection === item.id ? 'rotate-180' : 'rotate-0'
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Sub-items dropdown */}
      <AnimatePresence>
        {expandedSection && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-background"
          >
            <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2">
              {NAVIGATION_ITEMS.find((item) => item.id === expandedSection)?.subItems?.map(
                (subItem) => (
                  <button
                    key={subItem.id}
                    onClick={() => onSectionChange(expandedSection, subItem.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium',
                      'whitespace-nowrap transition-all duration-150',
                      'border',
                      activeSubSection === subItem.id
                        ? cn(
                            'bg-primary',
                            'text-white dark:text-primary-foreground',
                            'border-primary'
                          )
                        : cn(
                            'bg-transparent',
                            'text-muted-foreground',
                            'border-border',
                            'hover:border-primary dark:hover:border-primary',
                            'hover:text-foreground dark:hover:text-primary'
                          )
                    )}
                  >
                    {subItem.label}
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * ManagementLayout - Main layout component for the Centro de Gestao (Management Center)
 *
 * Features:
 * - Desktop: Fixed sidebar (260px expanded, 64px collapsed) + content area
 * - Mobile: Collapsible horizontal tabs at top
 * - Dark mode support
 * - Expandable sub-navigation for Documentos section
 *
 * @param {string} activeSection - Current active section ID
 * @param {string|null} activeSubSection - Current active sub-section ID (for docs)
 * @param {function} onSectionChange - Callback when section changes (section, subSection?) => void
 * @param {function} onBack - Callback for back button
 * @param {React.ReactNode} children - Content to render in the main area
 */
function ManagementLayout({
  activeSection,
  activeSubSection = null,
  onSectionChange,
  onBack,
  headerRight,
  children,
}) {
  const { isDark } = useTheme()
  const { isMobile, isTablet } = useBreakpoint()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Use mobile layout for mobile and tablet
  const useMobileLayout = isMobile || isTablet

  const sidebarWidth = isSidebarCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED

  return (
    <div
      className={cn(
        'min-h-screen',
        'bg-background',
        'transition-colors duration-200'
      )}
    >
      {/* Header - Padrao do App */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50',
          'bg-card',
          'border-b border-border',
          'shadow-sm'
        )}
      >
        <div className="px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-[70px]">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </button>
            </div>
            <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
              Centro de Gestao
            </h1>
            <div className="min-w-[70px] flex justify-end">{headerRight}</div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      {/* Mobile Tab Bar */}
      {useMobileLayout && (
        <MobileTabBar
          activeSection={activeSection}
          activeSubSection={activeSubSection}
          onSectionChange={onSectionChange}
          isDark={isDark}
        />
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        {!useMobileLayout && (
          <motion.aside
            initial={false}
            animate={{ width: sidebarWidth }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed left-0 top-[57px] bottom-0',
              'bg-card',
              'border-r border-border',
              'flex flex-col',
              'z-30'
            )}
          >
            {/* Collapse toggle button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                'absolute -right-3 top-4',
                'w-6 h-6 rounded-full',
                'bg-card',
                'border border-border',
                'flex items-center justify-center',
                'text-muted-foreground',
                'hover:text-foreground dark:hover:text-primary',
                'hover:border-primary dark:hover:border-primary',
                'transition-all duration-200',
                'shadow-sm',
                'focus:outline-none focus-visible:ring-2',
                isDark
                  ? 'focus-visible:ring-primary'
                  : 'focus-visible:ring-primary'
              )}
              aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Navigation items */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              {NAVIGATION_ITEMS.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activeSection === item.id}
                  isExpanded={activeSection === item.id && item.subItems?.length > 0}
                  isSidebarCollapsed={isSidebarCollapsed}
                  activeSubSection={activeSubSection}
                  onSelect={onSectionChange}
                  isDark={isDark}
                />
              ))}
            </nav>
          </motion.aside>
        )}

        {/* Main Content Area */}
        <main
          className={cn(
            'flex-1 min-w-0 overflow-x-hidden min-h-[calc(100vh-57px)]',
            'transition-all duration-200'
          )}
          style={{
            marginLeft: useMobileLayout ? 0 : sidebarWidth,
          }}
        >
          <div className="p-4 md:p-6 pb-24">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default ManagementLayout
