// combobox.jsx
// Combobox single-select controlado: Button (estilo input) + Popover + Command.
// Tokens-only, dark mode via tokens. Reaproveita Popover e Command do DS.
//
// @example
// const [value, setValue] = React.useState("")
// <Combobox
//   options={[{ value: "co", label: "Convênio" }, { value: "pa", label: "Particular" }]}
//   value={value}
//   onChange={setValue}
//   placeholder="Selecione..."
//   searchPlaceholder="Buscar..."
//   emptyText="Nada encontrado."
// />

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Popover, PopoverTrigger, PopoverContent } from "./popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command"

/**
 * Combobox — seleção única filtrável.
 *
 * @param {Object} props
 * @param {{value:string,label:string}[]} props.options - opções disponíveis
 * @param {string} props.value - valor selecionado (controlado)
 * @param {(value:string)=>void} props.onChange - callback ao selecionar
 * @param {string} [props.placeholder="Selecione..."] - texto sem seleção
 * @param {string} [props.searchPlaceholder="Buscar..."] - placeholder do input
 * @param {string} [props.emptyText="Nenhum resultado."] - estado vazio
 * @param {string} [props.className] - classes extras do trigger
 * @param {boolean} [props.disabled] - desabilita o trigger
 */
const Combobox = React.forwardRef(function Combobox(
  {
    options = [],
    value,
    onChange,
    placeholder = "Selecione...",
    searchPlaceholder = "Buscar...",
    emptyText = "Nenhum resultado.",
    className,
    disabled = false,
  },
  ref
) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  const handleSelect = (optValue) => {
    onChange?.(optValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "flex h-11 min-h-[44px] w-full items-center justify-between gap-2",
            "rounded-lg border border-border bg-card px-3 text-sm text-foreground",
            "transition-colors hover:bg-muted/50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-50",
            className
          )}
        >
          <span
            className={cn(
              "truncate text-left",
              !selected && "text-muted-foreground"
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(360px,90vw)] min-w-[220px] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => handleSelect(opt.value)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 text-primary",
                      opt.value === value ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})

export { Combobox }
