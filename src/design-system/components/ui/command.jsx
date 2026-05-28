// command.jsx
// Primitivas de command menu (palette / filtragem) baseadas em `cmdk`.
// Padrão shadcn/ui tokenizado para o Design System ANEST.
//
// Tokens-only (sem hex/cores cruas), dark mode via tokens semânticos.
//
// @example
// import {
//   Command, CommandInput, CommandList, CommandEmpty,
//   CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
// } from "@/design-system/components/ui/command"
//
// <Command>
//   <CommandInput placeholder="Buscar..." />
//   <CommandList>
//     <CommandEmpty>Nenhum resultado.</CommandEmpty>
//     <CommandGroup heading="Ações">
//       <CommandItem onSelect={() => {}}>
//         Novo documento
//         <CommandShortcut>⌘N</CommandShortcut>
//       </CommandItem>
//     </CommandGroup>
//   </CommandList>
// </Command>

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * Command — container raiz do menu de comandos (cmdk).
 * Envolve a lista filtrável com superfície de card tokenizada.
 */
const Command = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = "Command"

/**
 * CommandInput — campo de busca com ícone, ligado ao filtro do cmdk.
 */
const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div
    className="flex items-center gap-2 border-b border-border px-3"
    cmdk-input-wrapper=""
  >
    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = "CommandInput"

/**
 * CommandList — região rolável que contém grupos e itens.
 */
const CommandList = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      "max-h-[320px] overflow-y-auto overflow-x-hidden p-1",
      className
    )}
    {...props}
  />
))
CommandList.displayName = "CommandList"

/**
 * CommandEmpty — estado vazio exibido quando nenhum item casa com a busca.
 */
const CommandEmpty = React.forwardRef((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-muted-foreground"
    {...props}
  />
))
CommandEmpty.displayName = "CommandEmpty"

/**
 * CommandGroup — agrupa itens sob um heading opcional.
 */
const CommandGroup = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground",
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
      "[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
      "[&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
))
CommandGroup.displayName = "CommandGroup"

/**
 * CommandSeparator — divisor fino entre grupos.
 */
const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = "CommandSeparator"

/**
 * CommandItem — item selecionável (mouse/teclado). Touch-friendly (min-h 40px).
 */
const CommandItem = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-[40px] cursor-pointer select-none items-center gap-2",
      "rounded-lg px-2 py-2.5 text-sm outline-none",
      "aria-selected:bg-muted aria-selected:text-foreground",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))
CommandItem.displayName = "CommandItem"

/**
 * CommandShortcut — dica de atalho de teclado alinhada à direita do item.
 */
const CommandShortcut = ({ className, ...props }) => (
  <span
    className={cn(
      "ml-auto text-xs tracking-widest text-muted-foreground",
      className
    )}
    {...props}
  />
)
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
}
