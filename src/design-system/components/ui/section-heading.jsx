import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/design-system/utils/tokens"

/**
 * SectionHeading — título de seção/subseção canônico (Fase 1.6.3 do plano DS).
 *
 * Resolve o drift de 5 sizes/weights diferentes para h2/h3 nas páginas.
 * Trava a hierarquia da DNA rule #8:
 *   - level 2 (section h2): text-lg font-semibold
 *   - level 3 (subsection h3): text-sm font-semibold uppercase tracking-wide text-primary
 *
 * Uso:
 *   <SectionHeading title="Resumo" />
 *   <SectionHeading level={3} title="Filtros" icon={<Filter className="w-4 h-4" />} />
 *   <SectionHeading title="Eventos" action={<Button size="sm">Novo</Button>} subtitle="12 itens" />
 */
const titleVariants = cva("truncate", {
  variants: {
    level: {
      2: "text-lg font-semibold",
      3: "text-sm font-semibold uppercase tracking-wide",
    },
    // tone controla a COR do título de forma theme-aware (não usar hex)
    tone: {
      primary: "",
      muted: "",
    },
  },
  compoundVariants: [
    { level: 2, tone: "primary", class: "text-foreground" },
    { level: 3, tone: "primary", class: "text-primary" },
    { level: 2, tone: "muted", class: "text-muted-foreground" },
    { level: 3, tone: "muted", class: "text-muted-foreground" },
  ],
  defaultVariants: { level: 2, tone: "primary" },
})

const SectionHeading = React.forwardRef(function SectionHeading(
  { level = 2, tone = "primary", title, subtitle, icon, action, className, children, ...props },
  ref
) {
  const Tag = level === 3 ? "h3" : "h2"
  const content = title ?? children
  const iconColor = tone === "muted" ? "text-muted-foreground" : "text-primary"

  return (
    <div
      ref={ref}
      data-slot="section-heading"
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon ? (
          <span className={cn("shrink-0", iconColor)} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <Tag className={cn(titleVariants({ level, tone }))}>{content}</Tag>
          {subtitle ? (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
})

export { SectionHeading }
