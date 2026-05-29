import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * <BorderBeam> — feixe de luz percorrendo a borda do container (Magic UI tokenizado, Fase 4.2).
 *
 * Uso: comunicado urgente, deliberação aberta. Coloque dentro de um container
 * `relative` com `rounded-*` — o beam herda o raio. Lento (8s) e mono-verde por
 * padrão (greenBright) para não competir com o conteúdo (DNA: movimento sutil).
 *
 * Cores em hex espelham os tokens institucionais — gradient/offset-path NÃO resolvem
 * `hsl(var(--*))` (mesma regra de SVG/Recharts em design-tokens.md).
 *
 * Respeita `prefers-reduced-motion`: não renderiza nada.
 *
 * @param {number} [size=60] - tamanho do feixe (px)
 * @param {number} [duration=8] - duração da volta (s)
 * @param {string} [colorFrom='#2E8B57'] - greenBright
 * @param {string} [colorTo='#2E8B57'] - greenBright (mono por padrão)
 */
export function BorderBeam({
  className,
  size = 60,
  duration = 8,
  delay = 0,
  colorFrom = "#2E8B57",
  colorTo = "#2E8B57",
  ...props
}) {
  if (prefersReducedMotion()) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect]",
        "[mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        className
      )}
      {...props}
    >
      <motion.div
        className="absolute aspect-square bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          "--beam-from": colorFrom,
          "--beam-to": colorTo,
        }}
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay }}
      />
    </div>
  )
}
