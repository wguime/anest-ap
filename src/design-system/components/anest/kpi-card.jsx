import * as React from "react"
import { Target, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge, Progress, Modal, Spinner } from "@/design-system/components/ui"

const LazyKPIChart = React.lazy(() => import('./kpi-chart-inner'))

/**
 * KPICard - Card de Indicador de Qualidade (Key Performance Indicator)
 * Baseado no "Painel de Gestão" do app em produção
 *
 * @example
 * <KPICard
 *   titulo="Taxa de Infecção"
 *   valor={2.3}
 *   meta={3.0}
 *   metaLabel="≤3%"
 *   unidade="%"
 *   periodo="Setembro"
 *   icon={<Activity />}
 *   accentColor="green"
 *   historico={[2.1, 2.5, 2.8, 2.4, 2.3, 2.6, 2.2, 2.3, 2.3]}
 *   mesesLabels={['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set']}
 * />
 */

// ============================================================================
// CONFIGS
// ============================================================================

const statusConfig = {
  conforme: {
    color: "#34C759",
    colorDark: "#2ECC71",
    badgeVariant: "success",
    progressVariant: "success",
    label: "Conforme",
  },
  parcial: {
    color: "#F59E0B",
    colorDark: "#F39C12",
    badgeVariant: "warning",
    progressVariant: "warning",
    label: "Parcial",
  },
  "nao-conforme": {
    color: "#DC2626",
    colorDark: "#E74C3C",
    badgeVariant: "destructive",
    progressVariant: "error",
    label: "Não conforme",
  },
}

const accentColors = {
  green: {
    bg: "bg-muted dark:bg-[#1E3A2F]",
    icon: "text-primary",
  },
  blue: {
    bg: "bg-[#E3F2FD] dark:bg-[#1E3A5F]",
    icon: "text-[#1565C0] dark:text-[#3B82F6]",
  },
  orange: {
    bg: "bg-[#FFF3E0] dark:bg-[#3F2E1E]",
    icon: "text-[#E65100] dark:text-warning",
  },
  red: {
    bg: "bg-[#FFEBEE] dark:bg-[#3F1E1E]",
    icon: "text-[#C62828] dark:text-destructive",
  },
  purple: {
    bg: "bg-[#F3E5F5] dark:bg-[#2E1E3F]",
    icon: "text-[#6A1B9A] dark:text-[#8B5CF6]",
  },
  cyan: {
    bg: "bg-[#E0F7FA] dark:bg-[#1E3A3F]",
    icon: "text-[#00838F] dark:text-[#06B6D4]",
  },
}

const tendenciaConfig = {
  up: {
    icon: TrendingUp,
    color: "text-destructive",
    label: "Aumento",
  },
  down: {
    icon: TrendingDown,
    color: "text-success dark:text-primary",
    label: "Redução",
  },
  stable: {
    icon: Minus,
    color: "text-muted-foreground",
    label: "Estável",
  },
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateStatus(valor, meta, isLowerBetter = true) {
  if (meta === undefined || meta === null) return "conforme"

  if (isLowerBetter) {
    // Para métricas onde menor é melhor (ex: taxa de infecção)
    if (valor <= meta) return "conforme"
    if (valor <= meta * 1.1) return "parcial" // Dentro de 10% da meta
    return "nao-conforme"
  } else {
    // Para métricas onde maior é melhor (ex: satisfação)
    if (valor >= meta) return "conforme"
    if (valor >= meta * 0.9) return "parcial" // Dentro de 10% da meta
    return "nao-conforme"
  }
}

function calculateProgress(valor, meta, isLowerBetter = true) {
  if (!meta) return 0

  if (isLowerBetter) {
    // Para menor é melhor: 100% quando valor = 0, 0% quando valor = meta * 2
    const pct = Math.max(0, Math.min(100, ((meta * 2 - valor) / (meta * 2)) * 100))
    return pct
  } else {
    // Para maior é melhor: progresso direto
    return Math.min(100, (valor / meta) * 100)
  }
}

function calculateAverage(arr) {
  if (!arr || arr.length === 0) return 0
  // Filtrar valores null/undefined
  const validValues = arr.filter((v) => v !== null && v !== undefined)
  if (validValues.length === 0) return 0
  return validValues.reduce((a, b) => a + b, 0) / validValues.length
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function KPICard({
  // Dados do KPI
  titulo,
  valor,
  meta,
  metaLabel,
  unidade = "",
  periodo,
  descricao,

  // Visual
  icon,
  accentColor = "green",

  // Status
  status: statusProp,
  isLowerBetter = true,
  tendencia = "stable",

  // Dados históricos (para modal)
  historico = [],
  mesesLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set"],

  // Layout
  compact = false,

  // Comportamento
  onClick,
  className,
  ...props
}) {
  const [modalOpen, setModalOpen] = React.useState(false)

  // Calculate status if not provided
  const status = statusProp || calculateStatus(valor, meta, isLowerBetter)
  const statusCfg = statusConfig[status] || statusConfig.conforme
  const accent = accentColors[accentColor] || accentColors.green
  const tendenciaCfg = tendenciaConfig[tendencia] || tendenciaConfig.stable
  const TendenciaIcon = tendenciaCfg.icon

  // Calculate progress percentage
  const progressValue = calculateProgress(valor, meta, isLowerBetter)

  // Calculate average for modal
  const mediaAnual = calculateAverage(historico)

  // Format value
  const formattedValue =
    typeof valor === "number"
      ? valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
      : valor

  const formattedMeta =
    typeof meta === "number"
      ? meta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
      : meta

  // Chart data for modal (filtrar valores null)
  const chartData = React.useMemo(() => {
    return historico
      .map((value, index) => ({
        mes: mesesLabels[index] || `M${index + 1}`,
        valor: value,
      }))
      .filter((item) => item.valor !== null && item.valor !== undefined)
  }, [historico, mesesLabels])

  // Handle card click
  const handleCardClick = (e) => {
    if (onClick) {
      onClick(e)
    } else if (historico.length > 0) {
      setModalOpen(true)
    }
  }

  const isClickable = typeof onClick === "function" || historico.length > 0

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        whileTap={isClickable ? { scale: 0.98 } : undefined}
        data-slot="kpi-card"
        data-status={status}
        onClick={handleCardClick}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!isClickable || e.defaultPrevented) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleCardClick(e)
          }
        }}
        className={cn(
          "overflow-hidden",
          // Light mode
          "bg-card border border-border",
          // Dark mode
          "dark:bg-card dark:border-border",
          // Shadow
          "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
          // Interactive
          isClickable &&
            "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-shadow",
          // Size variants
          compact ? "rounded-xl px-3 py-2.5 sm:px-4 sm:py-3" : "rounded-[20px] p-4 sm:p-5",
          className
        )}
        {...props}
      >
        {compact ? (
          /* ── Compact layout: single row badge + title/value ── */
          <>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={statusCfg.badgeVariant}
                  badgeStyle="subtle"
                  className="text-[10px]"
                >
                  {statusCfg.label}
                </Badge>
                {tendencia !== "stable" && (
                  <div
                    className={cn("flex items-center", tendenciaCfg.color)}
                    aria-label={tendenciaCfg.label}
                  >
                    <TendenciaIcon className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              {isClickable && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <h3
                data-slot="kpi-card-title"
                className="text-[13px] font-semibold text-foreground dark:text-[#D1D5DB] leading-snug"
              >
                {titulo}
              </h3>
              <div className="flex items-baseline gap-0.5 shrink-0">
                <span
                  data-slot="kpi-card-value"
                  className={cn(
                    "text-[20px] font-bold leading-none tabular-nums",
                    status === "conforme" && "text-primary",
                    status === "parcial" && "text-[#D97706] dark:text-warning",
                    status === "nao-conforme" && "text-destructive"
                  )}
                >
                  {formattedValue}
                </span>
                {unidade && (
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {unidade}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ── Default layout: full card ── */
          <>
            {/* Header: Icon + Badge */}
            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
              {/* Left: Icon */}
              <div className="flex items-center gap-3">
                {icon && (
                  <div
                    className={cn(
                      "flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl",
                      accent.bg
                    )}
                  >
                    {typeof icon === "string" ? (
                      <span className="text-xl sm:text-2xl">{icon}</span>
                    ) : (
                      React.cloneElement(icon, {
                        className: cn("h-5 w-5 sm:h-6 sm:w-6", accent.icon),
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Right: Status Badge + Tendencia + Chevron */}
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={statusCfg.badgeVariant}
                  badgeStyle="subtle"
                  className="text-[10px] sm:text-[11px]"
                >
                  {statusCfg.label}
                </Badge>

                {tendencia !== "stable" && (
                  <div
                    className={cn("flex items-center", tendenciaCfg.color)}
                    aria-label={tendenciaCfg.label}
                  >
                    <TendenciaIcon className="h-4 w-4" />
                  </div>
                )}

                {isClickable && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Title + Value */}
            <div className="flex items-baseline justify-between gap-2 mb-3 sm:mb-4">
              <h3
                data-slot="kpi-card-title"
                className="text-[14px] sm:text-[15px] font-bold text-foreground dark:text-[#D1D5DB] leading-tight"
              >
                {titulo}
              </h3>

              <div className="flex items-baseline gap-0.5 shrink-0">
                <span
                  data-slot="kpi-card-value"
                  className={cn(
                    "text-[24px] sm:text-[28px] font-bold leading-none tabular-nums",
                    status === "conforme" && "text-primary",
                    status === "parcial" && "text-[#D97706] dark:text-warning",
                    status === "nao-conforme" && "text-destructive"
                  )}
                >
                  {formattedValue}
                </span>
                {unidade && (
                  <span className="text-[14px] sm:text-[16px] font-medium text-muted-foreground">
                    {unidade}
                  </span>
                )}
              </div>
            </div>

            {/* Period + Meta */}
            <div className="flex items-center gap-2 text-[11px] sm:text-[12px] text-muted-foreground mb-3">
              {periodo && <span>Mês base: {periodo}</span>}
              {periodo && meta !== undefined && <span>•</span>}
              {meta !== undefined && (
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Meta: {metaLabel || `${formattedMeta}${unidade}`}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {meta !== undefined && (
              <Progress
                value={progressValue}
                variant={statusCfg.progressVariant}
                size="sm"
                showValue={false}
              />
            )}

            {/* Description */}
            {descricao && (
              <p
                data-slot="kpi-card-descricao"
                className="mt-3 text-[11px] sm:text-[12px] text-muted-foreground line-clamp-2"
              >
                {descricao}
              </p>
            )}
          </>
        )}
      </motion.div>

      {/* Modal de Detalhes (Verso do Card) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={titulo}
      >
        {/* Spacer para alinhar conteúdo mais abaixo como no app de produção */}
        <div className="pt-2">
          {/* Header com Icon, Valor e Badge */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              {icon && (
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                    accent.bg
                  )}
                >
                  {typeof icon === "string" ? (
                    <span className="text-2xl">{icon}</span>
                  ) : (
                    React.cloneElement(icon, {
                      className: cn("h-7 w-7", accent.icon),
                    })
                  )}
                </div>
              )}
              <div>
                <p className="text-[12px] text-muted-foreground mb-1">
                  Valor atual
                </p>
                <p
                  className={cn(
                    "text-[32px] font-bold leading-none",
                    status === "conforme" && "text-primary",
                    status === "parcial" && "text-[#D97706] dark:text-warning",
                    status === "nao-conforme" &&
                      "text-destructive"
                  )}
                >
                  {formattedValue}
                  <span className="text-[18px] font-medium ml-0.5">{unidade}</span>
                </p>
              </div>
            </div>

            <Badge
              variant={statusCfg.badgeVariant}
              badgeStyle="subtle"
              className="text-[12px] self-start mt-1"
            >
              {statusCfg.label}
            </Badge>
          </div>

          {/* Info: Meta e Média */}
          <div className="flex flex-wrap gap-4 mb-5 text-[13px] text-muted-foreground">
            {meta !== undefined && (
              <span className="flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                Meta: {metaLabel || `${formattedMeta}${unidade}`}
              </span>
            )}
            {historico.length > 0 && (
              <span>
                Média anual:{" "}
                {mediaAnual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                {unidade}
              </span>
            )}
            {periodo && (
              <span>Período: {periodo}</span>
            )}
          </div>

          {/* Gráfico de linha */}
          {chartData.length > 0 && (
            <React.Suspense fallback={<div className="h-[220px] sm:h-[260px] flex items-center justify-center"><Spinner /></div>}>
              <LazyKPIChart chartData={chartData} meta={meta} formattedMeta={formattedMeta} unidade={unidade} statusCfg={statusCfg} />
            </React.Suspense>
          )}
        </div>
      </Modal>
    </>
  )
}

export { KPICard, statusConfig, accentColors }
