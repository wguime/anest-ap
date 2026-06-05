import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Archive, BarChart3, Clock, AlertTriangle, CheckCircle2, CheckSquare, Calendar, History } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'
import { useTheme } from '@/design-system'

/**
 * Sub-tabs GLOBAIS do módulo de Documentos (Bloco 2 — unificação de taxonomia).
 *
 * Antes, as abas eram por categoria Qmentum (9) e a navegação primária era o
 * eixo das 9 categorias. Após a unificação, o eixo de navegação são as 11
 * SUBcategorias (árvore na aba "Documentos", igual à Biblioteca) e as ferramentas
 * de workflow viram abas globais:
 *  - documentos          → árvore de subcategorias (DocumentSection grouped)
 *  - arquivados          → docs arquivados
 *  - aprovacoes          → ApprovalQueue
 *  - calendario-revisoes → ReviewCalendar
 *  - trilha-auditoria    → AuditTrailPage
 *  - stats               → ComplianceDashboard
 */
const GLOBAL_SUB_TABS = [
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'arquivados', label: 'Arquivados', icon: Archive },
  { id: 'aprovacoes', label: 'Aprovações', icon: CheckSquare },
  { id: 'calendario-revisoes', label: 'Revisões', icon: Calendar },
  { id: 'trilha-auditoria', label: 'Auditoria', icon: History },
  { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
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
 * ComplianceBar - métricas globais de conformidade (totais de todos os docs).
 * Recebe contagens já calculadas pelo parent (a partir do pool unificado),
 * em vez de consultar uma única categoria.
 */
function ComplianceBar({ metrics }) {
  const { activeCount = 0, pendingCount = 0, overdueCount = 0 } = metrics || {}

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
        <div className="flex items-center gap-1.5 text-warning">
          <Clock className="w-4 h-4" />
          <span className="font-semibold">{pendingCount}</span>
          <span className="text-xs">pendentes</span>
        </div>
      )}
      {overdueCount > 0 && (
        <div className="flex items-center gap-1.5 text-destructive">
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

/**
 * DocumentsLayout - Casca do módulo de Documentos do Centro de Gestão.
 *
 * Bloco 2: navegação por 11 subcategorias (na aba "Documentos") + abas globais
 * de workflow. Não há mais seletor de categoria Qmentum (eixo descontinuado);
 * o domínio Qmentum vira filtro secundário dentro da árvore.
 *
 * @param {string} activeSubTab - Sub-tab global ativa
 * @param {function} onSubTabChange - Callback ao trocar de sub-tab (subTab) => void
 * @param {object} metrics - { activeCount, pendingCount, overdueCount } globais
 * @param {React.ReactNode} children - Conteúdo da sub-tab ativa
 */
function DocumentsLayout({
  activeSubTab = 'documentos',
  onSubTabChange,
  metrics,
  children,
}) {
  const { isDark } = useTheme()

  return (
    <div className="space-y-4">
      {/* Barra de conformidade global */}
      <ComplianceBar metrics={metrics} />

      {/* Sub-tabs globais */}
      <div
        className={cn(
          'grid gap-2 p-2 bg-muted rounded-xl overflow-hidden',
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        )}
      >
        {GLOBAL_SUB_TABS.map((tab) => (
          <SubTabPill
            key={tab.id}
            tab={tab}
            isActive={activeSubTab === tab.id}
            onClick={() => onSubTabChange?.(tab.id)}
            isDark={isDark}
          />
        ))}
      </div>

      {/* Área de conteúdo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${activeSubTab}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default DocumentsLayout
