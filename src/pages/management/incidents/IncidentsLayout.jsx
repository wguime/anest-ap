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
  queda: { label: 'Queda', color: '#DC2626' },
  medicacao: { label: 'Erro de Medicacao', color: '#F59E0B' },
  equipamento: { label: 'Falha de Equipamento', color: '#3B82F6' },
  procedimento: { label: 'Procedimento', color: '#8B5CF6' },
  comunicacao: { label: 'Comunicacao', color: '#06B6D4' },
  outro: { label: 'Outro', color: '#6B7280' },
}

/**
 * Status configuration for incidents/complaints
 * Inclui status em português (mapeados do CentroGestaoPage) e
 * status em inglês (caso cheguem sem mapeamento)
 */
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#F59E0B' },
  em_analise: { label: 'Em análise', color: '#3B82F6' },
  resolvido: { label: 'Resolvido', color: '#10B981' },
  investigating: { label: 'Em investigacao', color: '#8B5CF6' },
  action_required: { label: 'Acao requerida', color: '#EC4899' },
  closed: { label: 'Encerrado', color: '#6B7280' },
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
        isDark ? 'focus-visible:ring-[#2ECC71]' : 'focus-visible:ring-[#006837]',
        isActive
          ? 'bg-white dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71] shadow-sm'
          : 'text-[#6B7280] dark:text-[#6B8178] hover:text-[#006837] dark:hover:text-[#2ECC71]'
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
function ResponsibleCard({ responsible, onToggleSetting, isDark }) {
  // Generate initials from name
  const initials = useMemo(() => {
    if (!responsible.nome) return '??'
    const parts = responsible.nome.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }, [responsible.nome])

  // Role badge colors
  const getRoleBadgeStyle = (role) => {
    const roleColors = {
      Administrador: { bg: '#DC2626', text: '#FFFFFF' },
      Coordenador: { bg: '#7C3AED', text: '#FFFFFF' },
      'anestesiologista': { bg: '#006837', text: '#FFFFFF' },
      Enfermeiro: { bg: '#0891B2', text: '#FFFFFF' },
    }
    return roleColors[role] || { bg: '#6B7280', text: '#FFFFFF' }
  }

  const roleStyle = getRoleBadgeStyle(responsible.role)

  return (
    <Card variant="default" className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header: Avatar, Name, Email, Role */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
              'bg-[#006837] dark:bg-[#2ECC71]',
              'text-white dark:text-[#1A2420]',
              'text-sm font-bold'
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-black dark:text-white truncate">
              {responsible.nome}
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#6B8178] truncate">
              {responsible.email}
            </p>
            <Badge
              className="mt-1.5 text-xs"
              style={{
                backgroundColor: roleStyle.bg,
                color: roleStyle.text,
              }}
            >
              {responsible.role}
            </Badge>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="space-y-3 pt-4 border-t border-[#C8E6C9] dark:border-[#2A3F36]">
          <p className="text-xs font-medium text-[#6B7280] dark:text-[#6B8178] uppercase tracking-wide mb-3">
            Recebimento
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#F9FAFB] dark:bg-[#1A2420]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
                <span className="text-sm text-black dark:text-white">Incidentes</span>
              </div>
              <Switch
                size="sm"
                checked={responsible.receberIncidentes}
                onChange={() => onToggleSetting(responsible.id, 'receberIncidentes')}
              />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#F9FAFB] dark:bg-[#1A2420]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
                <span className="text-sm text-black dark:text-white">Denuncias</span>
              </div>
              <Switch
                size="sm"
                checked={responsible.receberDenuncias}
                onChange={() => onToggleSetting(responsible.id, 'receberDenuncias')}
              />
            </div>
          </div>

          {/* TODO: integrar com serviço de email - toggle abaixo é apenas UI por enquanto */}
          <p className="text-xs font-medium text-[#6B7280] dark:text-[#6B8178] uppercase tracking-wide mt-4 mb-3">
            Notificacoes
          </p>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#F9FAFB] dark:bg-[#1A2420]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
              <span className="text-sm text-black dark:text-white">App</span>
            </div>
            <Switch
              size="sm"
              checked={responsible.notificarApp}
              onChange={() => onToggleSetting(responsible.id, 'notificarApp')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * ViewModeToggle - Toggle between Incidentes and Denuncias
 */
function ViewModeToggle({ viewMode, onViewModeChange, isDark }) {
  return (
    <div className="flex gap-2 p-1 bg-[#E8F5E9] dark:bg-[#1A2420] rounded-xl">
      <button
        onClick={() => onViewModeChange('incidentes')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2',
          'py-2.5 px-4 rounded-lg text-sm font-medium',
          'transition-all duration-200',
          viewMode === 'incidentes'
            ? 'bg-white dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71] shadow-sm'
            : 'text-[#6B7280] dark:text-[#6B8178] hover:text-[#006837] dark:hover:text-[#2ECC71]'
        )}
      >
        <Shield className="w-4 h-4" />
        <span>Incidentes</span>
      </button>
      <button
        onClick={() => onViewModeChange('denuncias')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2',
          'py-2.5 px-4 rounded-lg text-sm font-medium',
          'transition-all duration-200',
          viewMode === 'denuncias'
            ? 'bg-white dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71] shadow-sm'
            : 'text-[#6B7280] dark:text-[#6B8178] hover:text-[#006837] dark:hover:text-[#2ECC71]'
        )}
      >
        <Lock className="w-4 h-4" />
        <span>Denuncias</span>
      </button>
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
              isDark ? 'focus-visible:ring-[#2ECC71]' : 'focus-visible:ring-[#006837]',
              isActive
                ? statusConfig
                  ? ''
                  : 'bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#1A2420]'
                : 'bg-[#F3F4F6] dark:bg-[#243530] text-[#6B7280] dark:text-[#6B8178] hover:bg-[#E5E7EB] dark:hover:bg-[#2A3F36]'
            )}
            style={
              isActive && statusConfig
                ? { backgroundColor: statusConfig.color, color: '#FFFFFF' }
                : undefined
            }
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
function IncidentCard({ item, type, onNavigate, isDark }) {
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
          <h3 className="text-sm font-bold text-[#111827] dark:text-white leading-snug line-clamp-2">
            {item.titulo || 'Sem titulo'}
          </h3>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${statusConfig.color}15`, color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
            {(() => {
              const dl = getNextDeadline(item.rca, item.historicoStatus, item.statusOriginal, item.createdAt)
              if (!dl) return null
              const daysLeft = (dl.nextDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              let color, label
              if (daysLeft <= 0) { color = '#DC2626'; label = 'Prazo vencido' }
              else if (daysLeft <= 3) { color = '#F59E0B'; label = `Prazo: ${Math.ceil(daysLeft)}d` }
              else { color = '#22C55E'; label = `Prazo: ${Math.ceil(daysLeft)}d` }
              return (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: `${color}15`, color }}
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
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium mb-3"
          style={{ backgroundColor: `${incidentType.color}15`, color: incidentType.color }}
        >
          {incidentType.label}
        </span>

        {/* Linha 3: Metadados */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-[#243530] text-xs text-[#6B7280] dark:text-[#6B8178]">
            <Calendar className="w-3 h-3" />
            {formatDate(item.data)}
          </span>
          {item.protocolo && (
            <span className="px-2 py-0.5 rounded-md bg-[#E8F5E9] dark:bg-[#243530] text-xs font-mono text-[#006837] dark:text-[#2ECC71]">
              {item.protocolo}
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
function EmptyState({ type, isDark }) {
  const isIncident = type === 'incidentes'

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
          'bg-[#E8F5E9] dark:bg-[#243530]'
        )}
      >
        <Inbox className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
      </div>
      <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
        Nenhum {isIncident ? 'incidente' : 'denuncia'} encontrado
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-xs">
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
            'bg-[#006837] hover:bg-[#005530] text-white',
            'dark:bg-[#2ECC71] dark:hover:bg-[#27AE60] dark:text-[#1A2420]',
            'transition-colors focus:outline-none focus-visible:ring-2',
            isDark ? 'focus-visible:ring-[#2ECC71]' : 'focus-visible:ring-[#006837]'
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
                'bg-[#E8F5E9] dark:bg-[#243530]'
              )}
            >
              <Users className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Nenhum responsavel configurado
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-xs mx-auto">
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
}) {
  const { isDark } = useTheme()

  // Handle sub-tab change
  const handleSubTabChange = (tabId) => {
    onSubTabChange?.(tabId)
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs Container (2 column grid) */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#E8F5E9] dark:bg-[#1A2420] rounded-xl">
        {SUB_TABS.map((tab) => (
          <SubTabPill
            key={tab.id}
            tab={tab}
            isActive={activeSubTab === tab.id}
            onClick={() => handleSubTabChange(tab.id)}
            isDark={isDark}
          />
        ))}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${activeSubTab}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {activeSubTab === 'responsaveis' ? (
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
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default IncidentsLayout
