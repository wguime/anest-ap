import * as React from "react"
import { Target, ChevronRight, Trophy, Zap } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge, Progress } from "@/design-system/components/ui"

/**
 * ROPProgressCard - Card de progresso nos ROPs (Required Organizational Practices)
 *
 * Exibe o progresso do usuário em uma área específica dos ROPs com:
 * - Nome da área
 * - Barra de progresso
 * - Questões respondidas / total
 * - Última atividade
 *
 * @example
 * <ROPProgressCard
 *   area="Cultura de Segurança"
 *   progresso={75}
 *   questoesRespondidas={15}
 *   totalQuestoes={20}
 *   ultimaAtividade="Ontem"
 *   onClick={() => navigate('/rops/cultura')}
 * />
 */

function getProgressColor(progresso) {
  if (progresso >= 100) return "success"
  if (progresso >= 70) return "default"
  if (progresso >= 40) return "warning"
  return "destructive"
}

function ROPProgressCard({
  area,
  progresso = 0,
  questoesRespondidas = 0,
  totalQuestoes = 0,
  ultimaAtividade,
  pontos,
  nivel,
  onClick,
  variant = "default",
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"
  const isCompleted = progresso >= 100
  const progressVariant = getProgressColor(progresso)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      data-slot="rop-progress-card"
      data-variant={variant}
      data-completed={isCompleted ? "true" : undefined}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      className={cn(
        "rounded-[20px] p-4 sm:p-5 overflow-hidden",
        // Light mode
        variant === "highlight"
          ? "bg-accent border border-border"
          : "bg-card border border-border",
        // Dark mode
        variant === "highlight"
          ? "dark:bg-muted dark:border-border"
          : "dark:bg-card dark:border-border",
        // Shadow
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
        // Interactive
        isClickable && "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-shadow",
        className
      )}
      {...props}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Icon container */}
          <div
            data-slot="rop-progress-card-icon"
            className={cn(
              "flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-[10px] sm:rounded-[12px]",
              isCompleted
                ? "bg-success/20 dark:bg-primary/20"
                : "bg-[#F3F4F6] dark:bg-muted"
            )}
          >
            {isCompleted ? (
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-success dark:text-primary" />
            ) : (
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              data-slot="rop-progress-card-title"
              className="text-[14px] sm:text-[15px] font-semibold text-black dark:text-white truncate"
            >
              {area}
            </h3>
            <p
              data-slot="rop-progress-card-count"
              className="text-[12px] sm:text-[13px] text-muted-foreground"
            >
              {questoesRespondidas} de {totalQuestoes} questões
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isCompleted ? (
            <Badge variant="success" badgeStyle="solid">
              Completo
            </Badge>
          ) : (
            <span className="text-[14px] sm:text-[15px] font-bold text-primary">
              {progresso}%
            </span>
          )}

          {isClickable ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div data-slot="rop-progress-card-progress" className="mb-2 sm:mb-3">
        <Progress
          value={progresso}
          variant={progressVariant}
          size="md"
          showValue={false}
        />
      </div>

      {/* Footer */}
      <div
        data-slot="rop-progress-card-footer"
        className="flex items-center justify-between text-[12px]"
      >
        <div className="flex items-center gap-4">
          {ultimaAtividade ? (
            <span className="text-muted-foreground">
              Última atividade: {ultimaAtividade}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {pontos !== undefined ? (
            <span className="flex items-center gap-1 text-warning dark:text-warning font-semibold">
              <Zap className="h-3.5 w-3.5" />
              {pontos} pts
            </span>
          ) : null}

          {nivel ? (
            <Badge variant="default" badgeStyle="outline" className="text-[11px]">
              {nivel}
            </Badge>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

export { ROPProgressCard }
