import * as React from "react"
import { Plane, Palmtree, PartyPopper, Martini, Sun, Beer, Hospital } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

// Rotação de ícones de férias — viagem/praia/descanso (Plane, Palmtree, Sun)
// mais toque festivo: festa (PartyPopper) e bebidas (Martini, Beer), que
// substituíram Umbrella/Waves/Armchair. Cada item recebe um glifo diferente
// (por posição), em vez de repetir o mesmo em todas as linhas.
const FERIAS_ICONS = [Plane, Palmtree, PartyPopper, Martini, Sun, Beer]

// Licença não é férias — usa ícone de hospital fixo (sem entrar na rotação).
// Detecta via `tipo` explícito ou, na ausência dele, pelo texto de `periodo`
// (fallback usado pelo mock de usePegaPlantao, que traz "Licença" ali).
const isLicenca = (tipo, periodo) => /licen/i.test(tipo || periodo || "")

/**
 * FeriasListItem - Item de lista de férias programadas
 *
 * Alinhado ao dimensionamento/espaçamento do PlantaoListItem (quadrado
 * 40x40, gap/padding reduzidos), mantendo a cor neutra (bg-muted) do
 * ícone — só troca o glifo fixo de User por uma rotação de ícones de férias
 * (Plane/Palmtree/PartyPopper/Martini/Sun/Beer) conforme `index`. Itens de
 * licença (não-férias) usam ícone de hospital fixo (Hospital) em vez da rotação.
 *
 * LIGHT MODE:
 *   - Container ícone: 40x40, border-radius 10px, bg-muted
 *   - Ícone: 20x20, stroke muted-foreground
 *   - Nome: #000000, 15px, font-weight 600
 *   - Período: #9CA3AF, 13px
 *   - Divider: #F3F4F6
 *
 * DARK MODE:
 *   - Container ícone: bg #243530, border 1px #2A3F36
 *   - Ícone: stroke #6B8178
 *   - Nome: #FFFFFF
 *   - Período: #6B8178
 *   - Divider: #2A3F36
 */
function FeriasListItem({
  nome,
  periodo,
  tipo,
  index = 0,
  showDivider = true,
  isLast = false,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"

  const Icon = isLicenca(tipo, periodo)
    ? Hospital
    : FERIAS_ICONS[index % FERIAS_ICONS.length]

  // Determinar se deve mostrar divisor
  const shouldShowDivider = showDivider && !isLast

  return (
    <div
      data-slot="anest-ferias-list-item"
      className={cn(
        "flex items-center gap-3 py-[8px]",
        shouldShowDivider
          ? "border-b border-[#F3F4F6] dark:border-border"
          : null,
        isClickable
          ? "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter") onClick(e)
        if (e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      {...props}
    >
      {/* Container do Ícone - 40x40 com border-radius 10px */}
      <div
        data-slot="anest-ferias-list-item-icon"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
          // Light mode: fundo cinza claro
          "bg-muted",
          // Dark mode: fundo escuro com border
          "dark:bg-muted dark:border dark:border-border"
        )}
      >
        <Icon
          className="h-5 w-5 text-muted-foreground"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div
          data-slot="anest-ferias-list-item-title"
          className="truncate text-[15px] font-semibold text-foreground"
        >
          {nome}
        </div>
        {periodo ? (
          <div
            data-slot="anest-ferias-list-item-subtitle"
            className="truncate text-[13px] text-muted-foreground mt-[3px]"
          >
            {periodo}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { FeriasListItem }
