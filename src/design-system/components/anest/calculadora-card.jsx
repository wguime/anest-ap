import * as React from "react"
import { Calculator, ChevronRight, Star, Clock } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge } from "@/design-system/components/ui"

/**
 * CalculadoraCard - Card de calculadora médica
 *
 * Card para exibir uma calculadora médica/clínica com:
 * - Nome da calculadora
 * - Descrição breve
 * - Ícone customizado
 * - Categoria
 * - Indicador de favorito
 * - Último uso
 *
 * @example
 * <CalculadoraCard
 *   nome="Goldman Risk"
 *   descricao="Risco cardíaco perioperatório"
 *   icon={<Heart />}
 *   categoria="Avaliação"
 *   isFavorite={true}
 *   onClick={() => navigate('/calc/goldman')}
 * />
 */

// Category colors aligned with Design System
// Light: status.info #007AFF, green.medium #006837, status.error #DC2626, status.warning #F59E0B, green.bright #2E8B57
// Dark: status.info #3498DB, green.primary #2ECC71, status.error #E74C3C, status.warning #F39C12, green.light #58D68D
const categoriaColors = {
  "Avaliação": "bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#3498DB]/20 dark:text-[#3498DB]",
  "Dosagem": "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
  "Risco": "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive",
  "Pediatria": "bg-warning/10 text-warning dark:bg-[#F39C12]/20 dark:text-warning",
  "Anestesia": "bg-[#2E8B57]/10 text-[#2E8B57] dark:bg-[#58D68D]/20 dark:text-[#58D68D]",
  "Qmentum": "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
  default: "bg-[#6B7280]/10 text-muted-foreground dark:bg-[#6B7280]/20 dark:text-muted-foreground",
}

function CalculadoraCard({
  nome,
  descricao,
  icon,
  categoria = "Avaliação",
  isFavorite = false,
  ultimoUso,
  onClick,
  onFavoriteClick,
  variant = "default",
  size = "default",
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"
  const categoriaColor = categoriaColors[categoria] || categoriaColors.default
  const IconComponent = icon || Calculator

  const sizeClasses = {
    sm: "p-3 sm:p-4",
    default: "p-4 sm:p-5",
    lg: "p-5 sm:p-6",
  }

  const iconSizeClasses = {
    sm: "h-9 w-9 sm:h-10 sm:w-10",
    default: "h-10 w-10 sm:h-12 sm:w-12",
    lg: "h-12 w-12 sm:h-14 sm:w-14",
  }

  const titleSizeClasses = {
    sm: "text-[13px] sm:text-[14px]",
    default: "text-[14px] sm:text-[15px]",
    lg: "text-[15px] sm:text-[16px]",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      data-slot="calculadora-card"
      data-variant={variant}
      data-size={size}
      data-favorite={isFavorite ? "true" : undefined}
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
        "rounded-[20px] overflow-hidden",
        sizeClasses[size] || sizeClasses.default,
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
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Icon container */}
        <div
          data-slot="calculadora-card-icon"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[10px] sm:rounded-[12px]",
            iconSizeClasses[size] || iconSizeClasses.default,
            "bg-[#F3F4F6] dark:bg-muted"
          )}
        >
          {React.isValidElement(IconComponent) ? (
            React.cloneElement(IconComponent, {
              className: cn(
                "h-5 w-5 sm:h-6 sm:w-6",
                "text-primary"
              ),
            })
          ) : (
            <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-0.5 sm:mb-1">
            <h3
              data-slot="calculadora-card-title"
              className={cn(
                "font-semibold text-black dark:text-white truncate",
                titleSizeClasses[size] || titleSizeClasses.default
              )}
            >
              {nome}
            </h3>

            <div className="flex shrink-0 items-center gap-2">
              {/* Favorite button */}
              {onFavoriteClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFavoriteClick(e)
                  }}
                  className={cn(
                    "p-1 rounded-full transition-colors",
                    isFavorite
                      ? "text-warning dark:text-warning"
                      : "text-[#D1D5DB] dark:text-[#4B5563] hover:text-warning dark:hover:text-warning"
                  )}
                  aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Star
                    className="h-4 w-4"
                    fill={isFavorite ? "currentColor" : "none"}
                  />
                </button>
              ) : isFavorite ? (
                <Star
                  className="h-4 w-4 text-warning dark:text-warning"
                  fill="currentColor"
                  aria-label="Favorito"
                />
              ) : null}

              {isClickable ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : null}
            </div>
          </div>

          {/* Description */}
          {descricao ? (
            <p
              data-slot="calculadora-card-descricao"
              className="text-[12px] sm:text-[13px] text-muted-foreground line-clamp-2 mb-1.5 sm:mb-2"
            >
              {descricao}
            </p>
          ) : null}

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {categoria ? (
              <Badge
                data-slot="calculadora-card-categoria"
                className={cn("text-[10px] font-medium border-0", categoriaColor)}
              >
                {categoria}
              </Badge>
            ) : null}

            {ultimoUso ? (
              <span
                data-slot="calculadora-card-ultimo-uso"
                className="flex items-center gap-1 text-[11px] text-muted-foreground"
              >
                <Clock className="h-3 w-3" />
                {ultimoUso}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export { CalculadoraCard }
