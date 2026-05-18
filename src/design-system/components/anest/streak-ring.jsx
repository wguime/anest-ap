import * as React from "react"
import { Flame } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * StreakRing — anel circular animado mostrando os dias consecutivos do user.
 * T1.5.18 — Wave 1.5
 *
 * Cores semânticas:
 *  - streakDays >= 3 → success (chama mais forte)
 *  - 1-2            → warning
 *  - 0/null         → muted (estado "comece hoje")
 *
 * Tamanhos: sm (32px), md (40px — default). Touch target ≥44px via wrapper button.
 */
export function StreakRing({
  streakDays = 0,
  size = "md",
  onClick,
  className,
  ariaLabel,
}) {
  const reduced = prefersReducedMotion()
  const days = Math.max(0, Math.floor(Number(streakDays) || 0))

  const tier = days >= 3 ? "success" : days >= 1 ? "warning" : "muted"
  const tierColor = tier === "success"
    ? "text-success stroke-success"
    : tier === "warning"
      ? "text-warning stroke-warning"
      : "text-muted-foreground stroke-muted-foreground/40"
  const tierBg = tier === "success"
    ? "bg-success/10"
    : tier === "warning"
      ? "bg-warning/10"
      : "bg-muted"

  const sizes = size === "sm"
    ? { svg: 32, ring: 14, stroke: 2, font: "text-[10px]", iconCls: "h-3 w-3" }
    : { svg: 40, ring: 17, stroke: 2.5, font: "text-[11px]", iconCls: "h-4 w-4" }

  const circumference = 2 * Math.PI * sizes.ring
  // anel "preenche" até 7 dias (semana cheia)
  const fillRatio = Math.min(1, days / 7)
  const dashOffset = circumference * (1 - fillRatio)

  const label = ariaLabel ?? (days > 0
    ? `Streak de ${days} ${days === 1 ? "dia" : "dias"} consecutivos`
    : "Nenhum dia consecutivo ainda — comece hoje")

  const ringSvg = (
    <svg
      width={sizes.svg}
      height={sizes.svg}
      viewBox={`0 0 ${sizes.svg} ${sizes.svg}`}
      aria-hidden="true"
      className="-rotate-90"
    >
      <circle
        cx={sizes.svg / 2}
        cy={sizes.svg / 2}
        r={sizes.ring}
        strokeWidth={sizes.stroke}
        fill="none"
        className="stroke-border/40"
      />
      <motion.circle
        cx={sizes.svg / 2}
        cy={sizes.svg / 2}
        r={sizes.ring}
        strokeWidth={sizes.stroke}
        fill="none"
        strokeLinecap="round"
        className={cn(tierColor)}
        strokeDasharray={circumference}
        initial={reduced ? { strokeDashoffset: dashOffset } : { strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  )

  const content = (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      <span className={cn("absolute inset-0 rounded-full", tierBg)} aria-hidden="true" />
      {ringSvg}
      <span className={cn("absolute inset-0 flex flex-col items-center justify-center pointer-events-none")}>
        <Flame className={cn(sizes.iconCls, tierColor)} aria-hidden="true" />
        {days > 0 && (
          <span className={cn(sizes.font, "font-bold leading-none mt-0.5", tierColor)}>
            {days}
          </span>
        )}
      </span>
    </span>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full",
          "transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <span role="img" aria-label={label} className="inline-flex">
      {content}
    </span>
  )
}
