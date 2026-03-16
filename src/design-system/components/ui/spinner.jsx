import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

const SIZE_PX = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

const VARIANT_CLASS = {
  default: "text-[#004225] dark:text-[#2ECC71]",
  primary: "text-[#004225] dark:text-[#2ECC71]",
  white: "text-white",
}

function Ring({ sizePx, className }) {
  const border = sizePx >= 32 ? 3 : 2
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-solid border-current border-t-transparent",
        className
      )}
      style={{ width: sizePx, height: sizePx, borderWidth: border }}
    />
  )
}

function Dots({ sizePx, className }) {
  const dot = Math.max(4, Math.round(sizePx / 6))
  const gap = Math.max(4, Math.round(sizePx / 6))
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex items-center", className)}
      style={{ gap }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block rounded-full bg-current"
          style={{ width: dot, height: dot }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }}
          transition={{
            duration: 0.9,
            ease: "easeInOut",
            repeat: Infinity,
            delay: i * 0.12,
          }}
        />
      ))}
    </span>
  )
}

export function Spinner({
  size = "md",
  variant = "default",
  label,
  labelPosition = "right",
  className,
  type = "spinner", // "spinner" | "dots"
}) {
  const sizePx = SIZE_PX[size] ?? SIZE_PX.md
  const colorClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.default

  const visual =
    type === "dots" ? (
      <Dots sizePx={sizePx} />
    ) : (
      <Ring sizePx={sizePx} />
    )

  if (!label) {
    return (
      <span className={cn(colorClass, className)} aria-label="Carregando">
        {visual}
      </span>
    )
  }

  const isRight = labelPosition === "right"
  return (
    <span
      className={cn(
        "inline-flex",
        isRight ? "items-center" : "flex-col items-center",
        colorClass,
        className
      )}
    >
      {visual}
      <span
        className={cn(
          "text-[14px] text-current/90",
          isRight ? "ml-2" : "mt-2"
        )}
      >
        {label}
      </span>
    </span>
  )
}


