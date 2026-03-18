import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

const SIZE_CLASSES = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

// Trilho usa token do DS; preenchimento segue a mesma lógica de status (primary = em progresso, success = concluído, warning = atenção, destructive = crítico)
const TRACK_CLASSES =
  "w-full rounded-full bg-muted overflow-hidden"

const VARIANT_STYLES = {
  default: {
    fill: "bg-primary",
  },
  success: {
    fill: "bg-success",
  },
  warning: {
    fill: "bg-warning",
  },
  error: {
    fill: "bg-destructive",
  },
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export function Progress({
  value,
  max = 100,
  variant = "default",
  size = "md",
  showValue = false,
  label,
  animated = true,
  striped = false,
  className,
}) {
  const pct = React.useMemo(() => {
    const safeMax = typeof max === "number" && max > 0 ? max : 100
    const raw = (Number(value) / safeMax) * 100
    return clamp(Number.isFinite(raw) ? raw : 0, 0, 100)
  }, [value, max])

  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default
  const heightClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md

  const fillStyle = striped
    ? {
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.28) 25%, rgba(255,255,255,0) 25%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.28) 75%, rgba(255,255,255,0) 75%, rgba(255,255,255,0))",
        backgroundSize: "16px 16px",
      }
    : undefined

  return (
    <div className={cn("w-full", className)}>
      {label || showValue ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[14px] text-foreground">{label}</div>
          {showValue ? (
            <div className="text-[14px] font-semibold text-foreground">
              {Math.round(pct)}%
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={cn(TRACK_CLASSES, heightClass)} aria-hidden="true">
        {striped ? (
          <motion.div
            className={cn("h-full rounded-full", v.fill)}
            style={{
              width: `${pct}%`,
              ...fillStyle,
              ...(animated ? { willChange: "transform" } : {}),
            }}
            animate={
              animated
                ? { backgroundPositionX: ["0px", "16px"] }
                : undefined
            }
            transition={
              animated
                ? { duration: 1, ease: "linear", repeat: Infinity }
                : undefined
            }
          />
        ) : (
          <div
            className={cn(
              "h-full rounded-full",
              v.fill,
              animated ? "transition-[width] duration-300" : ""
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}


