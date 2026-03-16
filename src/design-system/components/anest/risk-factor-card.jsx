import * as React from "react"
import { motion } from "framer-motion"
import { Check, AlertTriangle, Info, CircleDot } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"

/**
 * RiskFactorCard - Card selecionável para fatores de risco em calculadoras clínicas
 *
 * Migrado do legado: calculadoras-clinicas.js (Morse, Braden, Goldman, etc.)
 *
 * @example
 * // Fator de risco simples
 * <RiskFactorCard
 *   title="Histórico de quedas"
 *   description="Paciente caiu nos últimos 3 meses"
 *   points={25}
 *   selected={isSelected}
 *   onSelect={() => toggleFactor("quedas")}
 * />
 *
 * // Com nível de severidade
 * <RiskFactorCard
 *   title="Déficit sensorial"
 *   points={15}
 *   severity="moderado"
 *   selected={selected}
 *   onSelect={handleSelect}
 * />
 *
 * // Modo boolean (sim/não)
 * <RiskFactorCard
 *   title="Uso de dispositivo IV"
 *   points={20}
 *   type="boolean"
 *   selected={hasIV}
 *   onSelect={setHasIV}
 * />
 */

// Severity level configuration
const severityConfig = {
  nenhum: {
    label: "Sem risco",
    color: "text-[#6B7280] dark:text-[#9CA3AF]",
    bgColor: "bg-[#F3F4F6] dark:bg-[#1A2420]",
    icon: CircleDot,
  },
  leve: {
    label: "Risco leve",
    color: "text-[#34C759] dark:text-[#2ECC71]",
    bgColor: "bg-[#34C759]/10 dark:bg-[#2ECC71]/10",
    icon: Info,
  },
  moderado: {
    label: "Risco moderado",
    color: "text-[#F59E0B] dark:text-[#F39C12]",
    bgColor: "bg-[#F59E0B]/10 dark:bg-[#F39C12]/10",
    icon: AlertTriangle,
  },
  alto: {
    label: "Alto risco",
    color: "text-[#DC2626] dark:text-[#E74C3C]",
    bgColor: "bg-[#DC2626]/10 dark:bg-[#E74C3C]/10",
    icon: AlertTriangle,
  },
}

function RiskFactorCard({
  title,
  description,
  points = 0,
  severity,
  type = "checkbox", // "checkbox" | "boolean" | "radio"
  selected = false,
  disabled = false,
  showPoints = true,
  onSelect,
  className,
  ...props
}) {
  const sev = severity ? severityConfig[severity] : null
  const SeverityIcon = sev?.icon

  const handleClick = React.useCallback(() => {
    if (!disabled && onSelect) {
      onSelect(!selected)
    }
  }, [disabled, onSelect, selected])

  const handleKeyDown = React.useCallback(
    (e) => {
      if (disabled) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    },
    [disabled, handleClick]
  )

  return (
    <motion.button
      type="button"
      role={type === "radio" ? "radio" : "checkbox"}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={cn(
        // Base
        "relative w-full text-left",
        "rounded-xl p-4",
        "border-2 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-[#004225] dark:focus-visible:ring-[#2ECC71]",
        "focus-visible:ring-offset-background",

        // Unselected state
        !selected && [
          "bg-card border-[#E5E7EB] dark:border-[#2A3F36]",
          !disabled && "hover:border-[#A5D6A7] dark:hover:border-[#3D5A4C]",
          !disabled && "cursor-pointer",
        ],

        // Selected state
        selected && [
          "bg-[#E8F5E9] border-[#004225] dark:bg-[#1A3D2E] dark:border-[#2ECC71]",
          "shadow-[0_0_0_1px_rgba(0,66,37,0.1)] dark:shadow-[0_0_0_1px_rgba(46,204,113,0.15)]",
        ],

        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",

        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-md",
            "flex items-center justify-center",
            "border-2 transition-all duration-200",
            !selected && "border-[#D1D5DB] dark:border-[#4B5563] bg-transparent",
            selected && "border-[#004225] bg-[#004225] dark:border-[#2ECC71] dark:bg-[#2ECC71]"
          )}
        >
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Check className="w-4 h-4 text-white dark:text-[#0D1F17]" strokeWidth={3} />
            </motion.div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  selected
                    ? "text-[#004225] dark:text-[#2ECC71]"
                    : "text-foreground"
                )}
              >
                {title}
              </div>

              {description && (
                <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {description}
                </div>
              )}

              {/* Severity badge */}
              {sev && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md",
                    "text-xs font-medium",
                    sev.bgColor,
                    sev.color
                  )}
                >
                  {SeverityIcon && <SeverityIcon className="w-3 h-3" />}
                  {sev.label}
                </div>
              )}
            </div>

            {/* Points badge */}
            {showPoints && points > 0 && (
              <div
                className={cn(
                  "flex-shrink-0 px-2.5 py-1 rounded-lg",
                  "text-xs font-bold",
                  selected
                    ? "bg-[#004225] text-white dark:bg-[#2ECC71] dark:text-[#0D1F17]"
                    : "bg-[#F3F4F6] text-[#6B7280] dark:bg-[#2A3F36] dark:text-[#9CA3AF]"
                )}
              >
                +{points}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

/**
 * RiskFactorGroup - Container para grupo de RiskFactorCards
 * Gerencia seleção única (radio) ou múltipla (checkbox)
 */
function RiskFactorGroup({
  factors,
  selectedFactors = [],
  onSelectionChange,
  type = "checkbox", // "checkbox" | "radio"
  showPoints = true,
  className,
  ...props
}) {
  const handleSelect = React.useCallback(
    (factorId, isSelected) => {
      if (type === "radio") {
        // Radio: single selection
        onSelectionChange?.(isSelected ? [factorId] : [])
      } else {
        // Checkbox: multiple selection
        if (isSelected) {
          onSelectionChange?.([...selectedFactors, factorId])
        } else {
          onSelectionChange?.(selectedFactors.filter((id) => id !== factorId))
        }
      }
    },
    [type, selectedFactors, onSelectionChange]
  )

  // Calculate total points
  const totalPoints = React.useMemo(() => {
    return factors
      .filter((f) => selectedFactors.includes(f.id))
      .reduce((sum, f) => sum + (f.points || 0), 0)
  }, [factors, selectedFactors])

  return (
    <div className={cn("space-y-3", className)} {...props}>
      {factors.map((factor) => (
        <RiskFactorCard
          key={factor.id}
          title={factor.title}
          description={factor.description}
          points={factor.points}
          severity={factor.severity}
          type={type}
          selected={selectedFactors.includes(factor.id)}
          disabled={factor.disabled}
          showPoints={showPoints}
          onSelect={(isSelected) => handleSelect(factor.id, isSelected)}
        />
      ))}

      {/* Total points summary */}
      {showPoints && factors.some((f) => f.points) && (
        <div
          className={cn(
            "flex items-center justify-between",
            "px-4 py-3 rounded-xl",
            "bg-[#F3F4F6] dark:bg-[#1A2420]",
            "border border-[#E5E7EB] dark:border-[#2A3F36]"
          )}
        >
          <span className="text-sm font-medium text-foreground">
            Pontuação Total
          </span>
          <span
            className={cn(
              "text-lg font-bold",
              totalPoints > 0
                ? "text-[#004225] dark:text-[#2ECC71]"
                : "text-muted-foreground"
            )}
          >
            {totalPoints} pontos
          </span>
        </div>
      )}
    </div>
  )
}

export { RiskFactorCard, RiskFactorGroup, severityConfig }
export default RiskFactorCard
