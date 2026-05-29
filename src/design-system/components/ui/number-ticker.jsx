import * as React from "react"
import { useInView, useMotionValue, useSpring } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"
import { formatNumber } from "@/utils/formatters"

/**
 * <NumberTicker> — count-up animado para KPIs/métricas (Magic UI tokenizado, Fase 4.2).
 *
 * Anima de 0 (ou de `value` quando `direction="down"`) até o valor final ao entrar
 * em viewport. Usa `tabular-nums` para não dar jitter de largura. Saída numérica
 * formatada em pt-BR via `formatNumber` (consistente com o resto do app).
 *
 * Respeita `prefers-reduced-motion`: renderiza o valor final imediatamente, sem animar.
 *
 * @param {number} value - valor final
 * @param {'up'|'down'} [direction='up']
 * @param {number} [delay=0] - atraso em segundos
 * @param {number} [decimalPlaces=0]
 * @param {Intl.NumberFormatOptions} [numberOptions] - repassado a formatNumber
 */
export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  numberOptions,
  className,
  ...props
}) {
  const ref = React.useRef(null)
  const reduce = prefersReducedMotion()
  const motionValue = useMotionValue(direction === "down" ? value : 0)
  const springValue = useSpring(motionValue, { damping: 30, stiffness: 200 })
  const isInView = useInView(ref, { once: true, margin: "0px" })

  const fmt = React.useCallback(
    (n) =>
      formatNumber(n, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
        ...numberOptions,
      }),
    [decimalPlaces, numberOptions]
  )

  React.useEffect(() => {
    if (reduce) return
    if (isInView) {
      const t = setTimeout(() => {
        motionValue.set(direction === "down" ? 0 : value)
      }, delay * 1000)
      return () => clearTimeout(t)
    }
  }, [motionValue, isInView, delay, value, direction, reduce])

  React.useEffect(() => {
    if (reduce) return
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = fmt(Number(latest.toFixed(decimalPlaces)))
      }
    })
  }, [springValue, decimalPlaces, fmt, reduce])

  const initial = reduce ? value : direction === "down" ? value : 0

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums tracking-tight", className)}
      {...props}
    >
      {fmt(initial)}
    </span>
  )
}
