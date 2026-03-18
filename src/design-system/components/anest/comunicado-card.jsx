import * as React from "react"
import { Megaphone, ChevronRight, Clock, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge } from "@/design-system/components/ui"

/**
 * ComunicadoCard - Card individual de comunicado
 *
 * Card para exibir um comunicado individual com:
 * - Título e resumo
 * - Data/hora de publicação
 * - Indicador de novo
 * - Prioridade (normal, alta, urgente)
 *
 * @example
 * <ComunicadoCard
 *   titulo="Novo protocolo de sedação"
 *   resumo="Atualização importante sobre o protocolo..."
 *   data="15 Dez 2025"
 *   isNew={true}
 *   prioridade="alta"
 *   onClick={() => handleClick()}
 * />
 */

const prioridadeConfig = {
  normal: {
    badge: null,
    border: "border-border",
    icon: null,
  },
  alta: {
    badge: { text: "Alta", variant: "warning" },
    border: "border-warning/30 dark:border-warning/30",
    icon: null,
  },
  urgente: {
    badge: { text: "Urgente", variant: "destructive" },
    border: "border-destructive/30 dark:border-destructive/30",
    icon: <AlertCircle className="h-4 w-4" />,
  },
}

function ComunicadoCard({
  titulo,
  resumo,
  data,
  isNew = false,
  prioridade = "normal",
  onClick,
  className,
  ...props
}) {
  const config = prioridadeConfig[prioridade] || prioridadeConfig.normal
  const isClickable = typeof onClick === "function"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      data-slot="comunicado-card"
      data-priority={prioridade}
      data-is-new={isNew ? "true" : undefined}
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
        "rounded-[20px] p-4 md:p-5 overflow-hidden",
        // Light mode
        "bg-white border",
        // Dark mode
        "dark:bg-card",
        // Border based on priority
        config.border,
        // Shadow
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
        // Interactive
        isClickable && "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-shadow duration-300 ease-out",
        className
      )}
      {...props}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 md:gap-3 mb-2 md:mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* New indicator dot */}
          {isNew ? (
            <span
              data-slot="comunicado-card-new-dot"
              className="shrink-0 h-2 w-2 rounded-full bg-primary dark:shadow-[0_0_6px_#2ECC71]"
              aria-label="Novo"
            />
          ) : null}

          <h3
            data-slot="comunicado-card-title"
            className={cn(
              "text-[14px] md:text-[15px] font-semibold truncate",
              "text-black dark:text-white"
            )}
          >
            {titulo}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {config.badge ? (
            <Badge
              variant={config.badge.variant}
              badgeStyle="subtle"
              icon={config.icon}
            >
              {config.badge.text}
            </Badge>
          ) : null}

          {isClickable ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </div>
      </div>

      {/* Resume */}
      {resumo ? (
        <p
          data-slot="comunicado-card-resumo"
          className={cn(
            "text-[14px] leading-relaxed mb-3",
            "text-muted-foreground",
            "line-clamp-2"
          )}
        >
          {resumo}
        </p>
      ) : null}

      {/* Footer with date */}
      {data ? (
        <div
          data-slot="comunicado-card-footer"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{data}</span>
        </div>
      ) : null}
    </motion.div>
  )
}

export { ComunicadoCard }
