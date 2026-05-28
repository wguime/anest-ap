import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

/**
 * FilterChips — linha de chips para filtro rápido (Fase 1.6.3 do plano DS).
 *
 * Generaliza o padrão DIY de pílulas de filtro (extraído de TipoTabs.jsx) que
 * aparecia diferente em 4+ páginas. Scroll horizontal, touch-friendly, dark-mode.
 *
 * Uso:
 *   const options = [
 *     { value: 'protocolo', label: 'Protocolos', count: 3 },
 *     { value: 'risco', label: 'Riscos', color: 'bg-destructive' },
 *   ]
 *   <FilterChips options={options} value={selected} onChange={setSelected} />
 *
 * - `includeAll` (default true) adiciona o chip "Todos" que seleciona `null`.
 * - cada option pode trazer `color` (classe bg-*) usada quando o chip está ativo;
 *   sem `color`, usa o verde institucional (`bg-primary`).
 * - `count` opcional renderiza um badge numérico.
 */
function Chip({ active, color, count, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap",
        "px-3 min-h-[36px] rounded-full text-xs font-medium",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        active
          ? cn(color ?? "bg-primary", "text-white dark:text-primary-foreground")
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {count !== undefined && count !== null ? (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold",
            active ? "bg-white/25 text-current" : "bg-background text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

function FilterChips({
  options = [],
  value = null,
  onChange,
  includeAll = true,
  allLabel = "Todos",
  className,
  ...props
}) {
  return (
    <div
      role="group"
      data-slot="filter-chips"
      className={cn(
        "flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1",
        className
      )}
      {...props}
    >
      {includeAll ? (
        <Chip active={value == null} onClick={() => onChange?.(null)}>
          {allLabel}
        </Chip>
      ) : null}

      {options.map((opt) => (
        <Chip
          key={opt.value}
          active={value === opt.value}
          color={opt.color}
          count={opt.count}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  )
}

export { FilterChips }
