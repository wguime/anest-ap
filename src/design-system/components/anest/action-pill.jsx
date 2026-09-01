import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

/**
 * ActionPill - Pill sólido de ação no header de card
 *
 * O modelo nasceu como o "Extrato" do FeriasCard e virou o padrão dos atalhos
 * de header (dono 31/08): a palavra no lugar do ícone — "Editar", "Ver todos",
 * "Importar". Fonte única do visual; FeriasCard/PlantaoCard/StaffScheduleCard
 * consomem daqui.
 *
 * @example
 * <ActionPill onClick={() => onNavigate('extratoFerias')}>Extrato</ActionPill>
 */
const ActionPill = React.forwardRef(function ActionPill(
  { className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        // Medidas reduzidas a pedido do dono (01/09: "um pouco menores") —
        // eram px-[14px] py-[7px] text-[12px] rounded-[12px], as do Extrato original.
        "inline-flex shrink-0 items-center justify-center rounded-[10px] px-[11px] py-[5px]",
        "text-[11px] font-semibold leading-none bg-primary text-white",
        // Dark: gradient espelha o pill "Acessar" do EscalaCirurgicaHomeCard
        "dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)] dark:text-foreground dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

export { ActionPill }
