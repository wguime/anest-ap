import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"
import { Progress } from "@/design-system/components/ui/progress"

/**
 * ScoreTracker - Componente para exibir pontuação de calculadoras clínicas
 *
 * Migrado do legado: calculadoras-clinicas.js, calculadoras-medicas.js
 *
 * @example
 * // Score de risco simples
 * <ScoreTracker
 *   label="Escala de Morse"
 *   score={45}
 *   maxScore={100}
 *   riskLevel="medio"
 * />
 *
 * // Com descrição do risco
 * <ScoreTracker
 *   label="MEWS Score"
 *   score={6}
 *   maxScore={14}
 *   riskLevel="alto"
 *   riskDescription="Risco de deterioração clínica"
 *   showProgress
 * />
 *
 * // Modo compacto
 * <ScoreTracker score={25} maxScore={50} riskLevel="baixo" compact />
 */

// Risk level configuration
// Design System Colors Reference (from Tokens.json):
// Light Mode:
// - status.success: #34C759 | green.medium: #006837
// - status.warning: #F59E0B
// - status.error: #DC2626
// Dark Mode:
// - status.success: #2ECC71
// - status.warning: #F39C12
// - status.error: #E74C3C
// Backgrounds use stronger opacity in light mode for better visibility
const riskLevelConfig = {
  baixo: {
    label: "Baixo Risco",
    // Light: darker green for better contrast | Dark: bright green
    color: "text-primary",
    bgColor: "bg-muted dark:bg-primary/15",
    borderColor: "border-primary/30 dark:border-primary",
    dotColor: "bg-primary",
    progressVariant: "success",
  },
  medio: {
    label: "Risco Moderado",
    // Light: amber/orange | Dark: gold
    color: "text-[#B45309] dark:text-warning",
    bgColor: "bg-[#FEF3C7] dark:bg-[#F39C12]/15",
    borderColor: "border-warning/40 dark:border-warning",
    dotColor: "bg-warning dark:bg-[#F39C12]",
    progressVariant: "warning",
  },
  alto: {
    label: "Alto Risco",
    // Light: strong red | Dark: coral red
    color: "text-destructive",
    bgColor: "bg-[#FEE2E2] dark:bg-destructive/15",
    borderColor: "border-destructive/40 dark:border-destructive",
    dotColor: "bg-destructive",
    progressVariant: "error",
  },
  critico: {
    // Critical uses intense error styling
    // Score text uses same error red as badge, badge has solid bg with white text
    label: "Risco Crítico",
    color: "text-destructive", // Score number in red
    bgColor: "bg-destructive", // Badge background solid red
    borderColor: "border-destructive dark:border-destructive",
    dotColor: "bg-white dark:bg-white",
    badgeTextColor: "text-white dark:text-white", // Badge text white
    progressVariant: "error",
    isIntense: true, // Flag for special styling
  },
}

function ScoreTracker({
  label,
  score,
  maxScore = 100,
  riskLevel = "baixo",
  riskDescription,
  showProgress = true,
  compact = false,
  animated = true,
  className,
  ...props
}) {
  const risk = riskLevelConfig[riskLevel] || riskLevelConfig.baixo
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  // Compact variant
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl p-3",
          "bg-card border border-border",
          className
        )}
        {...props}
      >
        <motion.div
          initial={animated ? { scale: 0.8, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "flex items-center justify-center",
            "min-w-[48px] h-[48px] rounded-xl",
            "text-xl font-bold",
            risk.bgColor,
            risk.color
          )}
        >
          {score}
        </motion.div>

        <div className="flex-1 min-w-0">
          {label && (
            <div className="text-sm font-medium text-foreground truncate">
              {label}
            </div>
          )}
          <div className={cn("text-xs font-semibold", risk.color)}>
            {risk.label}
          </div>
        </div>

        {showProgress && (
          <div className="w-16">
            <Progress
              value={score}
              max={maxScore}
              variant={risk.progressVariant}
              size="sm"
              animated={animated}
            />
          </div>
        )}
      </div>
    )
  }

  // Full variant
  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        "bg-card border border-border",
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none",
        className
      )}
      {...props}
    >
      {/* Header with label */}
      {label && (
        <div className="mb-3 text-sm font-medium text-muted-foreground">
          {label}
        </div>
      )}

      {/* Score display */}
      <div className="flex items-end gap-4 mb-4">
        <motion.div
          initial={animated ? { scale: 0.5, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={cn(
            "text-5xl font-bold tabular-nums tracking-tight",
            risk.color
          )}
        >
          {score}
        </motion.div>

        <div className="pb-1 text-lg text-muted-foreground">
          / {maxScore}
        </div>
      </div>

      {/* Risk badge */}
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
          "text-sm font-semibold",
          risk.bgColor,
          risk.badgeTextColor || risk.color, // Use badgeTextColor for intense levels
          "border",
          risk.borderColor
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            risk.dotColor
          )}
        />
        {risk.label}
      </div>

      {/* Risk description */}
      {riskDescription && (
        <div className="mt-3 text-sm text-muted-foreground">
          {riskDescription}
        </div>
      )}

      {/* Progress bar */}
      {showProgress && (
        <div className="mt-4">
          <Progress
            value={score}
            max={maxScore}
            variant={risk.progressVariant}
            size="md"
            animated={animated}
          />
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>0</span>
            <span>{percentage}%</span>
            <span>{maxScore}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ScoreTrackerMini - Versão inline para uso em tabelas ou listas
 */
function ScoreTrackerMini({
  score,
  maxScore = 100,
  riskLevel = "baixo",
  className,
}) {
  const risk = riskLevelConfig[riskLevel] || riskLevelConfig.baixo

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
        "text-sm font-semibold",
        risk.bgColor,
        risk.color,
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          risk.dotColor
        )}
      />
      {score}/{maxScore}
    </span>
  )
}

export { ScoreTracker, ScoreTrackerMini, riskLevelConfig }
export default ScoreTracker
