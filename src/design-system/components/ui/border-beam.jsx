import * as React from "react"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * <BorderBeam> — brilho percorrendo a borda do container (Magic UI <ShineBorder> tokenizado, Fase 4.2).
 *
 * Uso: comunicado urgente, deliberação aberta. Coloque dentro de um container
 * `relative overflow-hidden` com `rounded-*` — o anel herda o raio. Verde institucional
 * por padrão (greenBright→greenLight) para não competir com o conteúdo (DNA: movimento sutil).
 *
 * Técnica: radial-gradient com `background-size: 300%` mascarado só no anel da borda
 * (`mask-composite: exclude`); anima-se `background-position` (`.anest-border-shine`).
 * É o padrão validado em produção do Magic UI ShineBorder — barato e SEM geometria de
 * path, então NÃO trava nos cantos como `offset-path: rect()` (a abordagem do BorderBeam
 * original do Magic UI, que pivota nas quinas arredondadas).
 *
 * Cores em hex espelham os tokens institucionais — gradient NÃO resolve `hsl(var(--*))`
 * (mesma regra de SVG/Recharts em design-tokens.md).
 *
 * Respeita `prefers-reduced-motion`: não renderiza nada.
 *
 * @param {number} [duration=8] - duração da volta (s)
 * @param {number} [borderWidth=2] - espessura do anel (px)
 * @param {string|string[]} [shineColor=['#2E8B57','#9BC53D']] - cor(es) do brilho (greenBright→greenLight)
 */
export function BorderBeam({
  className,
  duration = 8,
  borderWidth = 2,
  shineColor = ["#2E8B57", "#9BC53D"],
  style,
  ...props
}) {
  if (prefersReducedMotion()) return null

  const colors = Array.isArray(shineColor) ? shineColor.join(",") : shineColor

  return (
    <div
      className={cn(
        "anest-border-shine pointer-events-none absolute inset-0 size-full rounded-[inherit]",
        "will-change-[background-position]",
        className
      )}
      style={{
        backgroundImage: `radial-gradient(transparent,transparent,${colors},transparent,transparent)`,
        backgroundSize: "300% 300%",
        mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        padding: borderWidth,
        "--bb-duration": `${duration}s`,
        ...style,
      }}
      {...props}
    />
  )
}
