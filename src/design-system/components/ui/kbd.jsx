import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

/**
 * Kbd — exibe uma tecla ou atalho de teclado.
 *
 * @example
 * <Kbd>⌘</Kbd>
 * <Kbd>Ctrl</Kbd>
 * <span className="inline-flex items-center gap-1">
 *   <Kbd>⌘</Kbd>
 *   <Kbd>K</Kbd>
 * </span>
 */
const Kbd = React.forwardRef(({ className, children, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </kbd>
))
Kbd.displayName = "Kbd"

export { Kbd }
