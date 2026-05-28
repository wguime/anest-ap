import * as React from "react"
import { ShieldCheck } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const DEFAULT_TEXT =
  "Ferramenta auxiliar de apoio à decisão — não substitui o julgamento clínico. Os resultados devem ser interpretados e validados pelo profissional responsável."
const DEFAULT_REFERENCE = "CFM 2.454/2026"

/**
 * ClinicalDisclaimer — nota de rodapé regulatória discreta exibida sob todas as
 * calculadoras clínicas (regulatório CFM 2.454/2026). Tom informativo, não-alarmante.
 *
 * @example
 * // Texto e referência padrão
 * <ClinicalDisclaimer />
 *
 * @example
 * // Override de texto e referência
 * <ClinicalDisclaimer text="..." reference="CFM 2.454/2026" />
 *
 * @example
 * // Versão compacta inline (menos padding, ainda legível)
 * <ClinicalDisclaimer compact />
 */
const ClinicalDisclaimer = React.forwardRef(function ClinicalDisclaimer(
  {
    text = DEFAULT_TEXT,
    reference = DEFAULT_REFERENCE,
    compact = false,
    icon: Icon = ShieldCheck,
    className,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      role="note"
      data-slot="anest-clinical-disclaimer"
      data-compact={compact ? "true" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-xl border border-border bg-muted/50",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className
      )}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {text}
        {reference ? (
          <span className="ml-1.5 text-[11px] font-medium text-foreground/70">
            {reference}
          </span>
        ) : null}
      </p>
    </div>
  )
})

export { ClinicalDisclaimer }
