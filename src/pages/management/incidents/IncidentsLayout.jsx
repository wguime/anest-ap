import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCog, Users, UserPlus, Shield, Lock, Calendar, Inbox, Timer } from 'lucide-react'
import { Card, CardContent, Badge, Switch } from '@/design-system'
import { getNextDeadline } from '@/data/rcaConfig'
import { cn } from '@/design-system/utils/tokens'
import { useTheme } from '@/design-system'
import { usePdfExport } from '@/hooks/usePdfExport'
import ExportButton from '@/components/ExportButton'
import { formatDate as formatDatePtBR } from '@/utils/formatters'
import SectionCardSelector from '../components/SectionCardSelector'

/**
 * Incident types configuration
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
 * Status filter pills configuration
 */
const STATUS_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'em_analise', label: 'Em análise' },
  { id: 'resolvido', label: 'Resolvidos' },
]

/**
 * ResponsibleCard - Card displaying a responsible user with settings.
 * Quando `canEdit` é false, os controles de recebimento ficam em modo leitura
 * (não-interativos) — apenas exibem o estado configurado.
 */
function ResponsibleCard({ responsible, onToggleSetting, canEdit = false }) {
  const initials = useMemo(() => {
    if (!responsible.nome) return '??'
    const parts = responsible.nome.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }, [responsible.nome])

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      Administrador: 'bg-destructive text-white',
      Coordenador: 'bg-category-purple text-white',
      anestesiologista: 'bg-greenMedium text-white',
      Enfermeiro: 'bg-category-cyan text-white',
    }
    return roleClasses[role] || 'bg-muted-foreground text-white'
  }

  const roleBadgeClass = getRoleBadgeClass(responsible.role)

  // Linha de recebimento: botão interativo (admin) ou estática (read-only).
  const RecebimentoControl = ({ setting, icon: Icon, label, checked }) => (
    <button
      type="button"
      onClick={canEdit ? () => onToggleSetting(responsible.id, setting) : undefined}
      className={cn(
        'flex items-center gap-1.5 select-none rounded-md py-1 -my-1 px-1 -mx-1',
        canEdit
          ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          : 'cursor-default'
      )}
      aria-label={`${label} para ${responsible.nome}`}
      aria-pressed={checked}
      aria-disabled={!canEdit}
      tabIndex={canEdit ? 0 : -1}
    >
      <Icon className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs text-foreground">{label}</span>
      <Switch size="sm" checked={checked} onChange={() => {}} tabIndex={-1} aria-hidden="true" />
    </button>
  )

  return (
    <Card variant="default" className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-primary text-white dark:text-primary-foreground text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{responsible.nome}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge className={cn('text-[10px] px-1.5 py-0', roleBadgeClass)}>{responsible.role}</Badge>
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recebimento
          </p>
          <div className="flex items-center gap-4">
            <RecebimentoControl setting="receberIncidentes" icon={Shield} label="Incidentes" checked={responsible.receberIncidentes} />
            <RecebimentoControl setting="receberDenuncias" icon={Lock} label="Denuncias" checked={responsible.receberDenuncias} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * StatusFilterPills - Status filter pills for incidents/complaints
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
function IncidentCard({ item, type, onNavigate }) {
  const incidentType = INCIDENT_TYPES[item.tipo] || INCIDENT_TYPES.outro
  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendente

  const formatDate = (date) => {
    if (!date) return '-'
    const d = date instanceof Date ? date : new Date(date)
    return formatDatePtBR(d, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <Card
      variant="default"
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={() => onNavigate?.(type === 'incidentes' ? 'incidente-gestao' : 'denuncia-gestao', { id: item.id, returnTo: 'painel-etica' })}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">
            {item.titulo || 'Sem titulo'}
          </h3>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusConfig.className)}>
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
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', deadlineClass)}>
                  <Timer className="w-3 h-3" />
                  {label}
                </span>
              )
            })()}
          </div>
        </div>

        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium mb-3', incidentType.className)}>
          {incidentType.label}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted dark:bg-muted text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {formatDate(item.data)}
          </span>
          {item.protocolo && (
            <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-mono text-primary">{item.protocolo}</span>
          )}
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
function EmptyState({ type }) {
  const isIncident = type === 'incidentes'
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-muted">
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
 * ResponsaveisContent - Lista de responsáveis. Edição (adicionar / alternar
 * recebimento) só quando `canEdit` (full admin); senão é read-only.
 */
function ResponsaveisContent({ incidentResponsibles, onToggleResponsibleSetting, onAddResponsible, canEdit = false, isDark }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {canEdit && (
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
      )}

      {incidentResponsibles && incidentResponsibles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {incidentResponsibles.map((responsible) => (
            <ResponsibleCard
              key={responsible.id}
              responsible={responsible}
              onToggleSetting={onToggleResponsibleSetting}
              canEdit={canEdit}
            />
          ))}
        </div>
      ) : (
        <Card variant="default">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto bg-muted">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum responsavel configurado</h3>
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
 * IncidentList - Lista filtrável de incidentes OU denúncias (tipo fixo).
 */
function IncidentList({ items = [], type, incidentStatusFilter = 'todos', onStatusFilterChange, onNavigate, isDark }) {
  const currentItems = useMemo(() => {
    if (!items) return []
    if (incidentStatusFilter === 'todos') return items
    return items.filter((item) => item.status === incidentStatusFilter)
  }, [items, incidentStatusFilter])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <StatusFilterPills activeFilter={incidentStatusFilter} onFilterChange={onStatusFilterChange} isDark={isDark} />

      {currentItems.length > 0 ? (
        <div className="grid gap-3">
          {currentItems.map((item) => (
            <IncidentCard key={item.id} item={item} type={type} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <EmptyState type={type} />
      )}
    </motion.div>
  )
}

/**
 * IncidentsLayout - Seção Incidentes do Centro de Gestão.
 *
 * Seletor fixo de até 3 cards (Responsáveis / Incidentes / Denúncias). A
 * visibilidade de Incidentes/Denúncias segue `allowedViewModes` (permissão);
 * Responsáveis aparece sempre. Edição de responsáveis só para full admin
 * (`isAdminUser`); demais veem em modo leitura.
 *
 * @param {array} incidentResponsibles
 * @param {function} onToggleResponsibleSetting
 * @param {function} onAddResponsible
 * @param {array} incidents
 * @param {array} denuncias
 * @param {string} incidentStatusFilter
 * @param {function} onStatusFilterChange
 * @param {function} onNavigate
 * @param {boolean} isAdminUser - full admin → pode editar responsáveis
 * @param {string[]} allowedViewModes - ['incidentes','denuncias'] permitidos
 */
function IncidentsLayout({
  incidentResponsibles = [],
  onToggleResponsibleSetting,
  onAddResponsible,
  incidents = [],
  denuncias = [],
  incidentStatusFilter = 'todos',
  onStatusFilterChange,
  onNavigate,
  isAdminUser = true,
  allowedViewModes = ['incidentes', 'denuncias'],
}) {
  const { isDark } = useTheme()
  const { exportPdf, exporting } = usePdfExport()

  // Cards visíveis: Responsáveis sempre; Incidentes/Denúncias por permissão.
  const cards = useMemo(() => {
    const list = [{ id: 'responsaveis', label: 'Responsáveis', icon: UserCog }]
    if (allowedViewModes.includes('incidentes')) list.push({ id: 'incidentes', label: 'Incidentes', icon: Shield })
    if (allowedViewModes.includes('denuncias')) list.push({ id: 'denuncias', label: 'Denúncias', icon: Lock })
    return list
  }, [allowedViewModes])

  const [activeCard, setActiveCard] = useState('responsaveis')
  const effectiveCard = cards.some((c) => c.id === activeCard) ? activeCard : 'responsaveis'

  const handleExportPdf = () => {
    exportPdf('incidentReport', { incidentes: incidents, denuncias }, {
      filename: `ANEST_Incidentes_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  return (
    <div className="space-y-4">
      <SectionCardSelector items={cards} active={effectiveCard} onChange={setActiveCard} />

      <AnimatePresence mode="wait">
        <motion.div
          key={`inc-${effectiveCard}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {effectiveCard === 'responsaveis' ? (
            <ResponsaveisContent
              incidentResponsibles={incidentResponsibles}
              onToggleResponsibleSetting={onToggleResponsibleSetting}
              onAddResponsible={onAddResponsible}
              canEdit={isAdminUser}
              isDark={isDark}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <ExportButton onExport={handleExportPdf} loading={exporting} label="Exportar PDF" size="sm" />
              </div>
              <IncidentList
                items={effectiveCard === 'incidentes' ? incidents : denuncias}
                type={effectiveCard}
                incidentStatusFilter={incidentStatusFilter}
                onStatusFilterChange={onStatusFilterChange}
                onNavigate={onNavigate}
                isDark={isDark}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default IncidentsLayout
