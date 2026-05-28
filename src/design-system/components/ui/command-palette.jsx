// command-palette.jsx
// Command palette estilo ⌘K: overlay em portal + painel Command (cmdk).
// Tokens-only, dark mode via tokens. Reaproveita as primitivas de ./command.
//
// @example
// const [open, setOpen] = React.useState(false)
// useCommandPaletteShortcut(setOpen) // ⌘K / Ctrl+K alterna
//
// <CommandPalette
//   open={open}
//   onOpenChange={setOpen}
//   groups={[
//     {
//       heading: "Navegação",
//       items: [
//         { id: "home", label: "Início", icon: <Home />, shortcut: "⌘H",
//           onSelect: () => navigate("home"), keywords: ["dashboard"] },
//       ],
//     },
//   ]}
// />

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/design-system/utils/tokens"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "./command"

/**
 * useCommandPaletteShortcut — alterna a palette com ⌘K (mac) ou Ctrl+K.
 * Opcional e independente do componente.
 *
 * @param {(updater:(prev:boolean)=>boolean)|((open:boolean)=>void)} onOpenChange
 *   Setter de estado (recebe um updater) — compatível com useState setter.
 */
function useCommandPaletteShortcut(onOpenChange) {
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange?.((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onOpenChange])
}

/**
 * CommandPalette — overlay global de comandos.
 *
 * @param {Object} props
 * @param {boolean} props.open - controla visibilidade
 * @param {(open:boolean)=>void} props.onOpenChange - callback de mudança
 * @param {{heading?:string, items:{id:string,label:string,icon?:React.ReactNode,shortcut?:string,onSelect:()=>void,keywords?:string[]}[]}[]} props.groups
 * @param {string} [props.placeholder="Buscar..."] - placeholder do input
 * @param {string} [props.emptyText="Nenhum resultado."] - estado vazio
 */
function CommandPalette({
  open,
  onOpenChange,
  groups = [],
  placeholder = "Buscar...",
  emptyText = "Nenhum resultado.",
}) {
  // Lock body scroll enquanto aberto
  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const handleSelect = React.useCallback(
    (item) => {
      item.onSelect?.()
      onOpenChange?.(false)
    },
    [onOpenChange]
  )

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onOpenChange?.(false)
    }
  }

  if (typeof document === "undefined" || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1300] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => onOpenChange?.(false)}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <Command
        className={cn(
          "w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-elevation-4"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        loop
      >
        <CommandInput placeholder={placeholder} autoFocus />
        <CommandList>
          <CommandEmpty>{emptyText}</CommandEmpty>
          {groups.map((group, gi) => (
            <CommandGroup key={group.heading ?? gi} heading={group.heading}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                  onSelect={() => handleSelect(item)}
                >
                  {item.icon ? (
                    <span className="inline-flex shrink-0 text-muted-foreground">
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="truncate">{item.label}</span>
                  {item.shortcut ? (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>,
    document.body
  )
}

export { CommandPalette, useCommandPaletteShortcut }
