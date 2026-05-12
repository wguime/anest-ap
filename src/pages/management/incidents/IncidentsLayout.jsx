import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserCog,
  Scale,
  Users,
  UserPlus,
  Shield,
  Lock,
  Bell,
  Calendar,
  Inbox,
  Timer,
} from 'lucide-react'
import { Card, CardContent, Button, Badge, Avatar, Switch } from '@/design-system'
import { getNextDeadline } from '@/data/rcaConfig'
import { cn } from '@/design-system/utils/tokens'
import { useTheme } from '@/design-system'
import { usePdfExport } from '@/hooks/usePdfExport'
import ExportButton from '@/components/ExportButton'

/**
 * Incident types configuration
 * Each type has a label and color for visual distinction
 */
const INCIDENT_TYPES = {
  queda: { label: 'Queda', className: 'bg-destructive/10 text-destructive' },
  medicacao: { label: 'Erro de Medicacao', className: 'bg-warning/10 text-warning' },
  equipamento: { label: 'Falha de Equipamento', className: 'bg-category-blue-bg text-category-blue-fg' },
  procedimento: { label: 'Procedimento', className: 'bg-category-purple-bg text-category-purple-fg' },
  comunicacao: { label: 'Comunicacao', className: 'bg-category-cyan-bg text-category-cyan-fg' },
  outro: { label: 'Outro', className: 'bg-muted text-muted-foreground' },
}

/**
 * Status configuration for incidents/complaints
 * Inclui status em português (mapeados do CentroGestaoPage) e
 * status em inglês (caso cheguem sem mapeamento)
 */
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', className: 'bg-warning/10 text-warning', activeClassName: 'bg-warning text-white' },
  em_analise: { label: 'Em análise', className: 'bg-category-blue-bg text-category-blue-fg', activeClassName: 'bg-category-blue text-white' },
  resolvido: { label: 'Resolvido', className: 'bg-success/10 text-success', activeClassName: 'bg-success text-white' },
  investigating: { label: 'Em investigacao', className: 'bg-category-purple-bg text-category-purple-fg', activeClassName: 'bg-category-purple text-white' },
  action_required: { label: 'Acao requerida', className: 'bg-category-pink-bg text-category-pink-fg', activeClassName: 'bg-category-pink text-white' },
  closed: { label: 'Encerrado', className: 'bg-muted text-muted-foreground', activeClassName: 'bg-muted-foreground text-white' },
}

/**
 * Sub-tabs configuration
 */
const SUB_TABS = [
  { id: 'responsaveis', label: 'Responsaveis', icon: UserCog },
  { id: 'painel-etica', label: 'Painel de Etica', icon: Scale },
]

/**
 * Status filter pills configuration
 */
const STATUS_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'em_analise', label: 'Em análise' },
  { id: 'resolvido', label: 'Resolvidos' },
]

/**
 * SubTabPill - Individual sub-tab pill button
 */
function SubTabPill({ tab, isActive, onClick, isDark }) {
  const Icon = tab.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2',
        'py-3 px-4 rounded-xl text-sm font-medium',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2',
        isDark ? 'focus-visible:ring-primary' : 'focus-visible:ring-primary',
        isActive
          ? 'bg-card dark:bg-muted text-primary shadow-sm'
          : 'text-muted-foreground hover:text-primary dark:hover:text-primary'
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{tab.label}</span>
    </button>
  )
}

/**
 * ResponsibleCard - Card displaying a responsible user with settings
 */
function ResponsibleCard({ responsible, onToggleSetting, _isDark }) {
  // Generate initials from name
  const initials = useMemo(() => {
    if (!responsible.nome) return '??'
    const parts = responsible.nome.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }, [responsible.nome])

  // Role badge class (DS tokens)
  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      Administrador: 'bg-destructive text-white',
      Coordenador: 'bg-category-purple text-white',
      'anestesiologista': 'bg-greenMedium text-white',
      Enfermeiro: 'bg-category-cyan text-white',
    }
    return roleClasses[role] || 'bg-muted-foreground text-white'
  }

  const roleBadgeClass = getRoleBadgeClass(responsible.role)

  return (
    <Card variant="default" className="overflow-hidden">
      <CardContent className="p-3">
        {/* Header: Avatar + Name + Role em linha */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
              'bg-primary text-white dark:text-primary-foreground text-xs font-bold'
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {responsible.nome}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge className={cn('text-[10px] px-1.5 py-0', roleBadgeClass)}>
                {responsible.role}
              </Badge>
            </div>
          </div>
        </div>

        {/* Recebimento */}
        <div className="pt-2.5 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recebimento
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onToggleSetting(responsible.id, 'receberIncidentes')}
              className="flex items-center gap-1.5 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md py-1 -my-1 px-1 -mx-1"
              aria-label={`Alternar recebimento de incidentes para ${responsible.nome}`}
              aria-pressed={responsible.receberIncidentes}
            >
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-foreground">Incidentes</span>
              <Switch
                size="sm"
                checked={responsible.receberIncidentes}
                onChange={() => {}}
                tabIndex={-1}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={() => onToggleSetting(responsible.id, 'receberDenuncias')}
              className="flex items-center gap-1.5 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md py-1 -my-1 px-1 -mx-1"
              aria-label={`Alternar recebimento de denuncias para ${responsible.nome}`}
              aria-pressed={responsible.receberDenuncias}
            >
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-foreground">Denuncias</span>
              <Switch
                size="sm"
                checked={responsible.receberDenuncias}
                onChange={() => {}}
                tabIndex={-1}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * ViewModeToggle - Toggle between Incidentes and Denuncias
 * When allowedViewModes has only 1 item, the toggle is hidden (rendered by parent)
 */
function ViewModeToggle({ viewMode, onViewModeChange, _isDark, allowedViewModes = ['incidentes', 'denuncias'] }) {
  const VIEW_MODE_CONFIG = [
    { id: 'incidentes', label: 'Incidentes', icon: Shield },
    { id: 'denuncias', label: 'Denuncias', icon: Lock },
  ]

  const visibleModes = VIEW_MODE_CONFIG.filter((m) => allowedViewModes.includes(m.id))

  // Don't render toggle if only one mode is available
  if (visibleModes.length <= 1) return null

  return (
    <div className="flex gap-2 p-1 bg-muted rounded-xl">
      {visibleModes.map((mode) => {
        const Icon = mode.icon
        return (
          <button
            key={mode.id}
            onClick={() => onViewModeChange(mode.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2',
              'py-2.5 px-4 rounded-lg text-sm font-medium',
              'transition-all duration-200',
              viewMode === mode.id
                ? 'bg-card dark:bg-muted text-primary shadow-sm'
                : 'text-muted-foreground hover:text-primary dark:hover:text-primary'
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * StatusFilterPills - Status filter pills for filtering incidents/complaints
 */
function StatusFilterPills({ activeFilter, onFilterChange, isDark }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id
        const statusConfig = STATUS_CONFIG[filter.id]

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium',
              'transition-all duration-200 whitespace-nowrap',
              'focus:outline-none focus-visible:ring-2',
              isDark ? 'focus-visible:ring-primary' : 'focus-visible:ring-primary',
              isActive
                ? statusConfig
                  ? statusConfig.activeClassName
                  : 'bg-primary text-white dark:text-primary-foreground'
                : 'bg-muted dark:bg-muted text-muted-foreground hover:bg-border dark:hover:bg-muted'
            )}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * IncidentCard - Card displaying an incident or complaint
 */
function IncidentCard({ item, type, onNavigate, _isDark }) {
  const incidentType = INCIDENT_TYPES[item.tipo] || INCIDENT_TYPES.outro
  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendente

  const formatDate = (date) => {
    if (!date) return '-'
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <Card
      variant="default"
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={() => onNavigate?.(type === 'incidentes' ? 'incidente-gestao' : 'denuncia-gestao', { id: item.id, returnTo: 'painel-etica' })}
    >
      <CardContent className="p-4">
        {/* Linha 1: Titulo + Status */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">
            {item.titulo || 'Sem titulo'}
          </h3>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                statusConfig.className
              )}
            >
              {statusConfig.label}
            </span>
            {(() => {
              const dl = getNextDeadline(item.rca, item.historicoStatus, item.statusOriginal, item.createdAt)
              if (!dl) return null
              const daysLeft = (dl.nextDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              let deadlineClass, label
              if (daysLeft <= 0) { deadlineClass = 'bg-destructive/10 text-destructive'; label = 'Prazo vencido' }
              else if (daysLeft <= 3) { deadlineClass = 'bg-warning/10 text-warning'; label = `Prazo: ${Math.ceil(daysLeft)}d` }
              else { deadlineClass = 'bg-success/10 text-success'; label = `Prazo: ${Math.ceil(daysLeft)}d` }
              return (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                    deadlineClass
                  )}
                >
                  <Timer className="w-3 h-3" />
                  {label}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Linha 2: Tipo */}
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium mb-3',
            incidentType.className
          )}
        >
          {incidentType.label}
        </span>

        {/* Linha 3: Metadados */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted dark:bg-muted text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {formatDate(item.data)}
          </span>
          {item.protocolo && (
            <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-mono text-primary">
              {item.protocolo}
            </span>
          )}
          {/* Badge de origem (Fase 4.4 — distinguir QR/link público vs in-app) */}
          {item.source === 'formulario_publico' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-category-blue-bg text-category-blue-fg text-[10px] font-semibold">
              QR / Link público
            </span>
          )}
          {item.source === 'externo' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-category-purple-bg text-category-purple-fg text-[10px] font-semibold">
              Canal externo
            </span>
          )}
          {item.isNeverEvent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-wide">
              Never Event
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * EmptyState - Empty state when no items are available
 */
function EmptyState({ type, _isDark }) {
  const isIncident = type === 'incidentes'

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
          'bg-muted'
        )}
      >
        <Inbox className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Nenhum {isIncident ? 'incidente' : 'denuncia'} encontrado
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {isIncident
          ? 'Nao ha incidentes registrados com os filtros selecionados.'
          : 'Nao ha denuncias registradas com os filtros selecionados.'}
      </p>
    </div>
  )
}

/**
 * ResponsaveisContent - Content for the Responsaveis sub-tab
 */
function ResponsaveisContent({
  incidentResponsibles,
  onToggleResponsibleSetting,
  onAddResponsible,
  isDark,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Add Responsible Button */}
      <div className="flex justify-end">
        <button
          onClick={onAddResponsible}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
            'bg-primary hover:bg-primary-hover text-white',
            'dark:bg-primary dark:hover:bg-primary-hover dark:text-primary-foreground',
            'transition-colors focus:outline-none focus-visible:ring-2',
            isDark ? 'focus-visible:ring-primary' : 'focus-visible:ring-primary'
          )}
        >
          <UserPlus className="w-4 h-4" />
          Adicionar Responsavel
        </button>
      </div>

      {/* Responsibles List */}
      {incidentResponsibles && incidentResponsibles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {incidentResponsibles.map((responsible) => (
            <ResponsibleCard
              key={responsible.id}
              responsible={responsible}
              onToggleSetting={onToggleResponsibleSetting}
              isDark={isDark}
            />
          ))}
        </div>
      ) : (
        <Card variant="default">
          <CardContent className="p-8 text-center">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto',
                'bg-muted'
              )}
            >
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum responsavel configurado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Configure responsaveis na aba Usuarios, em "Editar Permissoes".
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

/**
 * PainelEticaContent - Content for the Painel de Etica sub-tab
 */
function PainelEticaContent({
  incidents,
  denuncias,
  incidentViewMode,
  onViewModeChange,
  incidentStatusFilter,
  onStatusFilterChange,
  onNavigate,
  isDark,
  allowedViewModes = ['incidentes', 'denuncias'],
}) {
  const { exportPdf, exporting } = usePdfExport()

  const handleExportPdf = () => {
    exportPdf('incidentReport', { incidentes: incidents, denuncias }, {
      filename: `ANEST_Incidentes_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  // Get current items based on view mode
  const currentItems = useMemo(() => {
    const items = incidentViewMode === 'incidentes' ? incidents : denuncias
    if (!items) return []

    if (incidentStatusFilter === 'todos') return items
    return items.filter((item) => item.status === incidentStatusFilter)
  }, [incidentViewMode, incidents, denuncias, incidentStatusFilter])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExportPdf}
          loading={exporting}
          label="Exportar PDF"
          size="sm"
        />
      </div>

      {/* View Mode Toggle */}
      <ViewModeToggle
        viewMode={incidentViewMode}
        onViewModeChange={onViewModeChange}
        isDark={isDark}
        allowedViewModes={allowedViewModes}
      />

      {/* Status Filter Pills */}
      <StatusFilterPills
        activeFilter={incidentStatusFilter}
        onFilterChange={onStatusFilterChange}
        isDark={isDark}
      />

      {/* Items List */}
      {currentItems.length > 0 ? (
        <div className="grid gap-3">
          {currentItems.map((item) => (
            <IncidentCard
              key={item.id}
              item={item}
              type={incidentViewMode}
              onNavigate={onNavigate}
              isDark={isDark}
            />
          ))}
        </div>
      ) : (
        <EmptyState type={incidentViewMode} isDark={isDark} />
      )}
    </motion.div>
  )
}

/**
 * IncidentsLayout - Layout component for the Incidentes section of the Management Center
 *
 * This component manages the Incidentes section with two sub-tabs:
 * - Responsaveis: Configure users who receive incident/complaint notifications
 * - Painel de Etica: View and manage incidents and complaints
 *
 * Features:
 * - Sub-tabs toggle (2 column grid)
 * - Warning banner for notification settings
 * - Counter showing configured responsibles
 * - List of responsible users with notification toggles
 * - View mode toggle between Incidentes and Denuncias
 * - Status filter pills
 * - List of incidents/complaints cards
 * - Empty state when no items
 * - Dark mode support
 * - Responsive design
 *
 * Note: Responsáveis são configurados via "Usuários > Editar Permissões"
 *
 * @param {string} activeSubTab - Current active sub-tab ID ('responsaveis' | 'painel-etica')
 * @param {function} onSubTabChange - Callback when sub-tab changes (tab) => void
 * @param {array} incidentResponsibles - Array of responsible users
 * @param {function} onToggleResponsibleSetting - Callback when a setting is toggled (id, setting) => void
 * @param {function} onAddResponsible - Callback to open the add-responsible modal () => void
 * @param {array} incidents - Array of incidents
 * @param {array} denuncias - Array of complaints
 * @param {string} incidentStatusFilter - Current status filter
 * @param {function} onStatusFilterChange - Callback when status filter changes (status) => void
 * @param {string} incidentViewMode - Current view mode ('incidentes' | 'denuncias')
 * @param {function} onViewModeChange - Callback when view mode changes (mode) => void
 * @param {function} onNavigate - Callback for navigation (route, params) => void
 */
function IncidentsLayout({
  activeSubTab = 'responsaveis',
  onSubTabChange,
  incidentResponsibles = [],
  onToggleResponsibleSetting,
  onAddResponsible,
  incidents = [],
  denuncias = [],
  incidentStatusFilter = 'todos',
  onStatusFilterChange,
  incidentViewMode = 'incidentes',
  onViewModeChange,
  onNavigate,
  isAdminUser = true,
  allowedViewModes = ['incidentes', 'denuncias'],
}) {
  const { isDark } = useTheme()

  // For non-admin users, force painel-etica and hide responsaveis tab
  const effectiveSubTab = isAdminUser ? activeSubTab : 'painel-etica'
  const showSubTabs = isAdminUser

  // Handle sub-tab change
  const handleSubTabChange = (tabId) => {
    if (!isAdminUser) return // non-admin can only see painel-etica
    onSubTabChange?.(tabId)
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs Container (2 column grid) — only for admins */}
      {showSubTabs && (
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted rounded-xl">
          {SUB_TABS.map((tab) => (
            <SubTabPill
              key={tab.id}
              tab={tab}
              isActive={effectiveSubTab === tab.id}
              onClick={() => handleSubTabChange(tab.id)}
              isDark={isDark}
            />
          ))}
        </div>
      )}

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${effectiveSubTab}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {effectiveSubTab === 'responsaveis' ? (
            <ResponsaveisContent
              incidentResponsibles={incidentResponsibles}
              onToggleResponsibleSetting={onToggleResponsibleSetting}
              onAddResponsible={onAddResponsible}
              isDark={isDark}
            />
          ) : (
            <PainelEticaContent
              incidents={incidents}
              denuncias={denuncias}
              incidentViewMode={incidentViewMode}
              onViewModeChange={onViewModeChange}
              incidentStatusFilter={incidentStatusFilter}
              onStatusFilterChange={onStatusFilterChange}
              onNavigate={onNavigate}
              isDark={isDark}
              allowedViewModes={allowedViewModes}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default IncidentsLayout
