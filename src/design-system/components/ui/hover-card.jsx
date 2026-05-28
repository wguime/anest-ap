import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

/**
 * HoverCard — cartão leve exibido ao passar o mouse ou focar num trigger.
 * Implementação custom (sem @radix-ui/react-hover-card) para evitar nova dependência.
 *
 * Abre no hover/focus do trigger (com delay configurável) e fecha no leave/blur.
 * Posicionamento simples via `side` (top/bottom) + `align` (start/center/end).
 *
 * @example
 * <HoverCard>
 *   <HoverCardTrigger>@anest</HoverCardTrigger>
 *   <HoverCardContent>
 *     <p className="font-semibold">ANEST</p>
 *     <p className="text-muted-foreground">Gestão de qualidade para anestesiologia.</p>
 *   </HoverCardContent>
 * </HoverCard>
 */
const HoverCardContext = React.createContext(null)

function HoverCard({ children, openDelay = 150, closeDelay = 100 }) {
  const [open, setOpen] = React.useState(false)
  const openTimer = React.useRef(null)
  const closeTimer = React.useRef(null)

  const clearTimers = React.useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }, [])

  const handleOpen = React.useCallback(() => {
    clearTimers()
    openTimer.current = setTimeout(() => setOpen(true), openDelay)
  }, [clearTimers, openDelay])

  const handleClose = React.useCallback(() => {
    clearTimers()
    closeTimer.current = setTimeout(() => setOpen(false), closeDelay)
  }, [clearTimers, closeDelay])

  React.useEffect(() => clearTimers, [clearTimers])

  return (
    <HoverCardContext.Provider value={{ open, handleOpen, handleClose }}>
      <span className="relative inline-flex">{children}</span>
    </HoverCardContext.Provider>
  )
}
HoverCard.displayName = "HoverCard"

const HoverCardTrigger = React.forwardRef(
  ({ className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, ref) => {
    const ctx = React.useContext(HoverCardContext)

    return (
      <span
        ref={ref}
        className={cn("inline-flex cursor-pointer outline-none", className)}
        onMouseEnter={(e) => {
          ctx?.handleOpen()
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          ctx?.handleClose()
          onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          ctx?.handleOpen()
          onFocus?.(e)
        }}
        onBlur={(e) => {
          ctx?.handleClose()
          onBlur?.(e)
        }}
        aria-expanded={ctx?.open || undefined}
        {...props}
      >
        {children}
      </span>
    )
  }
)
HoverCardTrigger.displayName = "HoverCardTrigger"

const SIDE_CLASSES = {
  bottom: "top-full mt-2",
  top: "bottom-full mb-2",
}

const ALIGN_CLASSES = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
}

const HoverCardContent = React.forwardRef(
  ({ className, children, side = "bottom", align = "center", ...props }, ref) => {
    const ctx = React.useContext(HoverCardContext)

    return (
      <div
        ref={ref}
        role="dialog"
        onMouseEnter={ctx?.handleOpen}
        onMouseLeave={ctx?.handleClose}
        className={cn(
          "absolute z-dropdown w-64 rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-elevation-3",
          "transition-opacity duration-150 motion-reduce:transition-none",
          ctx?.open ? "opacity-100" : "pointer-events-none opacity-0",
          SIDE_CLASSES[side] ?? SIDE_CLASSES.bottom,
          ALIGN_CLASSES[align] ?? ALIGN_CLASSES.center,
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
HoverCardContent.displayName = "HoverCardContent"

export { HoverCard, HoverCardTrigger, HoverCardContent }
