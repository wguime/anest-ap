import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

/**
 * FormActionBar — barra de ações fixa no rodapé para formulários (Fase 1.6.3).
 *
 * Resolve submit bars com posicionamento e z-index inconsistentes.
 * Fixa no rodapé, full-width, glass (backdrop-blur), border-top, safe-area,
 * z-sticky. Os botões são passados como children.
 *
 * IMPORTANTE: a página deve reservar espaço para a barra — use
 * `<PageShell pb="extra">` (pb-32) para o conteúdo não ficar atrás dela.
 *
 * Uso:
 *   <FormActionBar>
 *     <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
 *     <Button onClick={onSave} className="flex-1">Salvar</Button>
 *   </FormActionBar>
 *
 * `align` controla a distribuição: 'end' (default), 'between', 'stretch'.
 */
const alignClasses = {
  end: "justify-end",
  between: "justify-between",
  stretch: "[&>*]:flex-1",
  center: "justify-center",
}

const FormActionBar = React.forwardRef(function FormActionBar(
  { align = "end", className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="form-action-bar"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-sticky",
        "border-t border-border bg-card/95 backdrop-blur-xl",
        "px-4 sm:px-5 py-3",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        "flex items-center gap-3",
        alignClasses[align] ?? alignClasses.end,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

export { FormActionBar }
