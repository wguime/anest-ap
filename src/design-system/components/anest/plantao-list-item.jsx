import * as React from "react"
import { Calendar } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * Cores de fundo variadas para o Light Mode (verde pastel)
 */
const LIGHT_BG_COLORS = [
  'bg-[#B8E0C8]',
  'bg-[#A8D5BA]',
  'bg-[#C5E8D5]',
  'bg-muted',
]

/**
 * Gera um índice baseado no hash da string para selecionar cor de fundo
 */
function getColorIndex(hospital, data, hora) {
  const str = `${hospital || ''}|${data || ''}|${hora || ''}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % LIGHT_BG_COLORS.length
}

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
  status,
  index,
  bgColor,
  isLast = false,
  showDivider = true,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"

  // Calcular cor de fundo para Light Mode
  const colorIndex = index !== undefined ? index : getColorIndex(hospital, data, hora)
  const lightBgClass = bgColor ? null : LIGHT_BG_COLORS[colorIndex % LIGHT_BG_COLORS.length]

  // Determinar se deve mostrar divisor
  const shouldShowDivider = showDivider && !isLast

  return (
    <div
      data-slot="anest-plantao-list-item"
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
      {/* Container do Ícone - 48x48 com border-radius 12px */}
      <div
        data-slot="anest-plantao-list-item-icon"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]",
          // Light mode: cores variadas, sem border
          lightBgClass,
          // Dark mode: bg fixo com border
          "dark:bg-muted dark:border dark:border-border"
        )}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        <Calendar
          className="h-6 w-6 text-primary"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div
          data-slot="anest-plantao-list-item-title"
          className="truncate text-[15px] font-bold text-foreground"
        >
          {hospital}
        </div>
        {data ? (
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
