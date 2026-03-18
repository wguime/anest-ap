import * as React from "react"
import { User } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * FeriasListItem - Item de lista de férias programadas
 *
 * Baseado no design exato do index.dev.html:
 *
 * LIGHT MODE:
 *   - Container ícone: 48x48, border-radius 12px, bg #F3F4F6
 *   - Ícone User: 24x24, stroke #9CA3AF
 *   - Nome: #000000, 15px, font-weight 600
 *   - Período: #9CA3AF, 13px
 *   - Divider: #F3F4F6
 *
 * DARK MODE:
 *   - Container ícone: bg #243530, border 1px #2A3F36
 *   - Ícone User: stroke #6B8178
 *   - Nome: #FFFFFF
 *   - Período: #6B8178
 *   - Divider: #2A3F36
 */
function FeriasListItem({
  nome,
  periodo,
  showDivider = true,
  isLast = false,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"

  // Determinar se deve mostrar divisor
  const shouldShowDivider = showDivider && !isLast

  return (
    <div
      data-slot="anest-ferias-list-item"
      className={cn(
        "flex items-center gap-[14px] py-[14px]",
        shouldShowDivider
          ? "border-b border-[#F3F4F6] dark:border-border"
          : null,
        isClickable
          ? "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter") onClick(e)
        if (e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      {...props}
    >
      {/* Container do Ícone - Quadrado com bordas arredondadas */}
      <div
        data-slot="anest-ferias-list-item-icon"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]",
          // Light mode: fundo cinza claro
          "bg-[#F3F4F6]",
          // Dark mode: fundo escuro com border
          "dark:bg-muted dark:border dark:border-border"
        )}
      >
        <User
          className="h-6 w-6 text-muted-foreground"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div
          data-slot="anest-ferias-list-item-title"
          className="truncate text-[15px] font-semibold text-[#000000] dark:text-[#FFFFFF]"
        >
          {nome}
        </div>
        {periodo ? (
          <div
            data-slot="anest-ferias-list-item-subtitle"
            className="truncate text-[13px] text-muted-foreground mt-[3px]"
          >
            {periodo}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { FeriasListItem }
