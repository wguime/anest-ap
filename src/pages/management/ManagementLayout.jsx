import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Users, FolderOpen, AlertTriangle, GraduationCap, BookOpen, Megaphone, ChevronDown, Calendar, LayoutDashboard } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'
import { useTheme } from '@/design-system'
import { useBreakpoint } from '@/design-system/hooks'
import { PageHeader } from '@/components'
import CentroGestaoHub from './components/CentroGestaoHub'
import SectionQuickSwitch from './components/SectionQuickSwitch'

/**
 * Navigation items configuration for the Management Center
 *
 * Items with `subItems` are umbrella groups: clicking navigates to the first
 * sub-item and expands the group. Each sub-item id must match a leaf section
 * handled by CentroGestaoPage.renderContent().
 */
const NAVIGATION_ITEMS = [
  {
    id: 'usuarios-group',
    label: 'Usuarios',
    icon: Users,
    subItems: [
      { id: 'usuarios', label: 'Usuarios' },
      { id: 'cargos', label: 'Cargos' },
      { id: 'emails', label: 'Emails' },
      { id: 'auditLog', label: 'Auditorias' },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FolderOpen,
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
    id: 'painel-group',
    label: 'Painel',
    icon: LayoutDashboard,
    subItems: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'infraestrutura', label: 'Infraestrutura' },
      { id: 'lgpd', label: 'LGPD' },
      { id: 'conflitos', label: 'Conflitos' },
      { id: 'indicadores', label: 'Indicadores' },
      { id: 'planosAcao', label: 'Planos de Acao' },
      { id: 'apiTokens', label: 'API Tokens' },
    ],
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
  activeSection,
  isSidebarCollapsed,
  onSelect,
  isDark,
}) {
  const hasSubItems = item.subItems && item.subItems.length > 0
  const subItemIds = hasSubItems ? item.subItems.map((s) => s.id) : []
  const isActive = hasSubItems
    ? subItemIds.includes(activeSection)
    : activeSection === item.id
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(isActive)
  const Icon = item.icon

  const handleClick = () => {
    if (hasSubItems) {
      if (!isSidebarCollapsed) {
        setIsSubMenuOpen(!isSubMenuOpen)
      }
      if (!isActive) {
        onSelect(item.subItems[0].id)
      }
    } else {
      onSelect(item.id)
    }
  }

  const handleSubItemClick = (subItem) => {
    onSelect(subItem.id)
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
            ? 'focus-visible:ring-primary focus-visible:ring-offset-card'
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
                      activeSection === subItem.id
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
  _activeSubSection = null,
  onSectionChange,
  onBack,
  headerRight,
  tabsActionsRight = null,
  visibleSections = null,
  showHub = false,
  onEnterHub,
  badges = {},
  children,
}) {
  const { isDark } = useTheme()
  const { isMobile, isTablet } = useBreakpoint()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Filter navigation items based on visibleSections prop. Umbrella groups are
  // kept when any sub-item is visible, and their subItems are filtered in turn.
  const filteredNavItems = visibleSections
    ? NAVIGATION_ITEMS.reduce((acc, item) => {
        if (item.subItems?.length) {
          const visibleSubs = item.subItems.filter((sub) =>
            visibleSections.includes(sub.id)
          )
          if (visibleSubs.length > 0) {
            acc.push({ ...item, subItems: visibleSubs })
          }
        } else if (visibleSections.includes(item.id)) {
          acc.push(item)
        }
        return acc
      }, [])
    : NAVIGATION_ITEMS

  // Use mobile layout for mobile and tablet
  const useMobileLayout = isMobile || isTablet

  const sidebarWidth = isSidebarCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED

  return (
    <div
      className={cn(
        'min-h-dvh',
        'bg-background',
        'transition-colors duration-200'
      )}
    >
      {/* Header - Padrao do App */}
      <PageHeader title="Centro de Gestao" onBack={onBack} actions={headerRight} />

      {/* Mobile/Tablet: barra de quick-switch (some quando o hub está aberto) */}
      {useMobileLayout && !showHub && (
        <SectionQuickSwitch
          navigationItems={filteredNavItems}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onEnterHub={onEnterHub}
          actionsRight={tabsActionsRight}
          badges={badges}
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
              {filteredNavItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  activeSection={activeSection}
                  isSidebarCollapsed={isSidebarCollapsed}
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
            'flex-1 min-w-0 overflow-x-hidden min-h-[calc(100dvh-57px)]',
            'transition-all duration-200'
          )}
          style={{
            marginLeft: useMobileLayout ? 0 : sidebarWidth,
          }}
        >
          <div className="p-4 md:p-6 pb-24">
            {useMobileLayout && showHub ? (
              <CentroGestaoHub
                navigationItems={filteredNavItems}
                badges={badges}
                onSelect={onSectionChange}
              />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default ManagementLayout
