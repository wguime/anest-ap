import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * StepIndicator — indicador de progresso multi-step estilo USWDS.
 *
 * Útil em fluxos de várias etapas (ex.: registro de incidentes multi-step,
 * fluxo de consentimento LGPD). Cada step possui um dos três estados:
 * - completed (índice < current): círculo `bg-primary` com ícone Check
 * - current   (índice === current): círculo `bg-primary` com ring de destaque
 * - upcoming  (índice > current): círculo `bg-muted` com número
 *
 * @param {Object} props
 * @param {(string|{label: string, description?: string})[]} props.steps - Lista de etapas.
 * @param {number} props.current - Índice 0-based da etapa atual.
 * @param {string} [props.className]
 *
 * @example
 * <StepIndicator
 *   steps={['Dados', 'Detalhes', 'Revisão', 'Envio']}
 *   current={1}
 * />
 *
 * @example
 * <StepIndicator
 *   steps={[
 *     { label: 'Dados', description: 'Informações básicas' },
 *     { label: 'Revisão', description: 'Confira tudo' },
 *   ]}
 *   current={0}
 * />
 */
const StepIndicator = React.forwardRef(
  ({ steps = [], current = 0, className, ...props }, ref) => {
    const total = steps.length

    return (
      <ol
        ref={ref}
        role="list"
        data-slot="step-indicator"
        className={cn(
          "flex w-full items-start overflow-x-auto scrollbar-hide",
          className
        )}
        {...props}
      >
        {steps.map((step, index) => {
          const label = typeof step === "string" ? step : step?.label
          const description =
            typeof step === "string" ? undefined : step?.description

          const isCompleted = index < current
          const isCurrent = index === current
          const isUpcoming = index > current
          const isLast = index === total - 1

          return (
            <li
              key={index}
              data-slot="step"
              data-state={
                isCompleted ? "completed" : isCurrent ? "current" : "upcoming"
              }
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center",
                !isLast && "flex-1"
              )}
            >
              <div className="flex w-full items-center">
                {/* Círculo do step */}
                <span
                  className={cn(
                    "flex h-8 w-8 min-h-[32px] shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    (isCompleted || isCurrent) &&
                      "bg-primary text-primary-foreground",
                    isCurrent && "ring-2 ring-primary/30",
                    isUpcoming &&
                      "border border-border bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>

                {/* Conector para o próximo step */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>

              {/* Label + descrição */}
              <div
                className={cn(
                  "mt-2 flex flex-col px-1 text-center",
                  !isLast && "pr-3"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    isUpcoming ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {label}
                </span>
                {description ? (
                  <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {description}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }
)
StepIndicator.displayName = "StepIndicator"

export { StepIndicator }
