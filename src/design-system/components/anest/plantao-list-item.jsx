import * as React from "react"
import { Calendar } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

// Cor única do quadrado (verde pastel) no Light Mode — sem variação por item.
// Dark mode usa bg-muted + border (abaixo).
const SQUARE_BG = 'bg-[#A8D5BA]'

/**
 * PlantaoListItem - Item de lista de plantões
 *
 * Baseado no design exato do index.dev.html (home-v3.css):
 *
 * LIGHT MODE:
 *   - Container ícone: 48x48, border-radius 12px, bg cores variadas (verde pastel)
 *   - Ícone Calendar: 24x24, stroke #006837
 *   - Nome: #000000, 15px, font-weight 600
 *   - Data: #9CA3AF, 13px
 *   - Hora: #9BC53D, 16px, font-weight 700
 *   - Divider: #F3F4F6
 *
 * DARK MODE:
 *   - Container ícone: bg #243530, border 1px #2A3F36
 *   - Ícone Calendar: stroke #2ECC71
 *   - Nome: #FFFFFF
 *   - Data: #6B8178
 *   - Hora: #2ECC71 com text-shadow glow
 *   - Divider: #2A3F36
 */
function PlantaoListItem({
  hospital,
  data,
  hora,
  setor,
  _status,
  index: _index,
  bgColor,
  isLast = false,
  showDivider = true,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"

  // Cor de fundo do quadrado (Light Mode): única, salvo override via bgColor.
  const lightBgClass = bgColor ? null : SQUARE_BG

  // Determinar se deve mostrar divisor
  const shouldShowDivider = showDivider && !isLast

  return (
    <div
      data-slot="anest-plantao-list-item"
      className={cn(
        "flex items-center gap-3 py-[8px]",
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
      {/* Container do Ícone - 40x40 com border-radius 10px */}
      <div
        data-slot="anest-plantao-list-item-icon"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
          // Light mode: cores variadas, sem border
          lightBgClass,
          // Dark mode: bg fixo com border
          "dark:bg-muted dark:border dark:border-border"
        )}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        {setor ? (
          <span className="text-[14px] font-bold leading-none text-primary">
            {setor}
          </span>
        ) : (
          <Calendar
            className="h-5 w-5 text-primary"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div
          data-slot="anest-plantao-list-item-title"
          className="truncate text-[15px] font-bold text-foreground"
        >
          {hospital}
        </div>
        {data && !setor ? (
          <div
            data-slot="anest-plantao-list-item-subtitle"
            className="truncate text-[13px] text-muted-foreground mt-[3px]"
          >
            {data}
          </div>
        ) : null}
      </div>

      {/* Horário */}
      {hora ? (
        <span
          data-slot="anest-plantao-list-item-time"
          className={cn(
            "shrink-0 text-[16px] font-bold",
            "text-[#9BC53D] dark:text-primary",
            "dark:drop-shadow-[0_0_10px_rgba(46,204,113,0.15)]"
          )}
        >
          {hora}
        </span>
      ) : null}
    </div>
  )
}

export { PlantaoListItem }
