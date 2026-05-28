import * as React from "react"
import { cva } from "class-variance-authority"
import { AlertTriangle, Info } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * Variantes do container do WarningCallout.
 *
 * Diferente do disclaimer discreto, este callout estilo NHS CHAMA atenção
 * para alertas clínicos críticos. Cores semânticas (warning/critical/info)
 * via tokens DS — nunca hex / cores Tailwind cruas.
 */
const warningCalloutVariants = cva(
  "flex items-start gap-3 rounded-[20px] border p-4",
  {
    variants: {
      variant: {
        warning: "bg-warning/10 border-warning/30 text-foreground",
        critical: "bg-destructive/10 border-destructive/40 text-foreground",
        info: "bg-info/10 border-info/30 text-foreground",
      },
    },
    defaultVariants: {
      variant: "warning",
    },
  }
)

// Mapa variante → cor semântica do ícone (token DS).
const ICON_COLOR = {
  warning: "text-warning",
  critical: "text-destructive",
  info: "text-info",
}

// Ícone padrão por variante (lucide-react).
const DEFAULT_ICON = {
  warning: AlertTriangle,
  critical: AlertTriangle,
  info: Info,
}

/**
 * WarningCallout — callout proeminente estilo NHS para alertas clínicos críticos.
 *
 * Use quando o alerta precisa CHAMAR atenção (ex.: APACHE II / P-POSSUM com
 * score crítico). Para avisos discretos use o disclaimer padrão.
 *
 * Acessibilidade: variantes `critical`/`warning` usam `role="alert"` (anúncio
 * assistivo imediato); `info` usa `role="note"`.
 *
 * @param {object} props
 * @param {'warning'|'critical'|'info'} [props.variant='warning'] - Severidade semântica.
 * @param {React.ReactNode} [props.title] - Título em destaque (opcional).
 * @param {React.ReactNode} [props.icon] - Override do ícone padrão da variante.
 * @param {React.ReactNode} [props.children] - Corpo do callout.
 * @param {string} [props.className] - Classes extras.
 *
 * @example
 * <WarningCallout variant="critical" title="Score crítico">
 *   APACHE II ≥ 25 indica mortalidade elevada. Reavalie conduta.
 * </WarningCallout>
 *
 * @example
 * <WarningCallout variant="warning" title="Atenção" icon={<CustomIcon />}>
 *   Texto do aviso.
 * </WarningCallout>
 */
const WarningCallout = React.forwardRef(
  ({ variant = "warning", title, icon, children, className, ...props }, ref) => {
    const safeVariant = ICON_COLOR[variant] ? variant : "warning"
    const role = safeVariant === "info" ? "note" : "alert"

    const IconComponent = DEFAULT_ICON[safeVariant]

    return (
      <div
        ref={ref}
        role={role}
        className={cn(warningCalloutVariants({ variant: safeVariant }), className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn("shrink-0", ICON_COLOR[safeVariant])}
        >
          {icon ?? <IconComponent className="w-5 h-5" />}
        </span>

        <div className="min-w-0 flex-1">
          {title ? (
            <p className="text-sm font-semibold text-foreground">{title}</p>
          ) : null}
          {children ? (
            <div className={cn("text-sm leading-relaxed text-foreground/90", title && "mt-1")}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
    )
  }
)

WarningCallout.displayName = "WarningCallout"

export { WarningCallout, warningCalloutVariants }
