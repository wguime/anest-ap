import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

function getFocusableElements(container) {
  if (!container) return []
  const nodes = container.querySelectorAll(
    [
      'a[href]:not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",")
  )
  return Array.from(nodes).filter((el) => {
    const style = window.getComputedStyle(el)
    return style.visibility !== "hidden" && style.display !== "none"
  })
}

// --- Motion variants per side ---

const SLIDE_VARIANTS = {
  right: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
  },
  left: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
  },
  top: {
    initial: { y: "-100%" },
    animate: { y: 0 },
    exit: { y: "-100%" },
  },
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
  },
}

// --- Reduced motion: instant (opacity only) ---

const REDUCED_MOTION_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

// --- Position + sizing classes per side ---

const POSITION_CLASSES = {
  right: "inset-y-0 right-0 w-full sm:w-[420px] md:w-[480px] rounded-l-[20px]",
  left: "inset-y-0 left-0 w-full sm:w-[420px] md:w-[480px] rounded-r-[20px]",
  top: "inset-x-0 top-0 h-[85vh] rounded-b-[20px]",
  bottom: "inset-x-0 bottom-0 h-[85vh] rounded-t-[20px]",
}

// --- Context for open/onClose propagation ---

const SheetContext = React.createContext(null)

function useSheetContext() {
  const ctx = React.useContext(SheetContext)
  if (!ctx) {
    throw new Error("Sheet compound components must be used within <Sheet>")
  }
  return ctx
}

// --- Root ---

function Sheet({ open, onOpenChange, children }) {
  const value = React.useMemo(
    () => ({ open, onOpenChange }),
    [open, onOpenChange]
  )
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
}

// --- Trigger ---

const SheetTrigger = React.forwardRef(function SheetTrigger(
  { children, asChild, className, ...props },
  ref
) {
  const { onOpenChange } = useSheetContext()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ref,
      onClick: (...args) => {
        children.props.onClick?.(...args)
        onOpenChange?.(true)
      },
    })
  }

  return (
    <button
      type="button"
      ref={ref}
      className={className}
      onClick={() => onOpenChange?.(true)}
      data-slot="sheet-trigger"
      {...props}
    >
      {children}
    </button>
  )
})

// --- Content (the panel) ---

const SheetContent = React.forwardRef(function SheetContent(
  {
    side = "right",
    children,
    className,
    showCloseButton = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  forwardedRef
) {
  const { open, onOpenChange } = useSheetContext()
  const onClose = React.useCallback(() => onOpenChange?.(false), [onOpenChange])

  const contentRef = React.useRef(null)
  const previouslyFocusedRef = React.useRef(null)
  const [portalTarget, setPortalTarget] = React.useState(null)

  // Merge forwarded ref with internal ref
  const mergedRef = React.useCallback(
    (node) => {
      contentRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )

  // Detect prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Portal target
  React.useEffect(() => {
    if (!open) return
    if (typeof document === "undefined") return
    setPortalTarget(document.body)
  }, [open])

  // Lock scroll + store previous focus
  React.useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current =
      typeof document !== "undefined" ? document.activeElement : null

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // Initial focus + return focus
  React.useEffect(() => {
    if (!open) return

    const raf = window.requestAnimationFrame(() => {
      const el = contentRef.current
      if (!el) return
      const focusables = getFocusableElements(el)
      const target = focusables[0] ?? el
      if (target && typeof target.focus === "function") {
        target.focus()
      }
    })

    return () => {
      window.cancelAnimationFrame(raf)
      const prev = previouslyFocusedRef.current
      if (prev && typeof prev.focus === "function") {
        prev.focus()
      }
      previouslyFocusedRef.current = null
    }
  }, [open])

  // Escape close + focus trap
  React.useEffect(() => {
    if (!open) return

    const onKeyDown = (e) => {
      if (e.key === "Escape" && closeOnEscape) {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key !== "Tab") return
      const el = contentRef.current
      if (!el) return
      const focusables = getFocusableElements(el)
      if (focusables.length === 0) {
        e.preventDefault()
        el.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open, closeOnEscape, onClose])

  if (!open || !portalTarget) return null

  const variants = reducedMotion
    ? REDUCED_MOTION_VARIANTS
    : SLIDE_VARIANTS[side] ?? SLIDE_VARIANTS.right

  const isHorizontal = side === "left" || side === "right"

  const sheet = (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="anest-sheet-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[1100] bg-black/50 dark:bg-black/70"
        onMouseDown={(e) => {
          if (!closeOnOverlayClick) return
          if (e.target === e.currentTarget) onClose()
        }}
        data-slot="sheet-overlay"
      />

      {/* Panel */}
      <motion.div
        key="anest-sheet-panel"
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        ref={mergedRef}
        className={cn(
          "fixed z-[1100] flex flex-col",
          "border-border bg-card text-foreground shadow-lg outline-none",
          "overflow-hidden",
          isHorizontal ? "border-l border-r" : "border-t border-b",
          POSITION_CLASSES[side] ?? POSITION_CLASSES.right,
          className
        )}
        data-slot="sheet-content"
        {...props}
      >
        {showCloseButton ? (
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className={cn(
              "absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl",
              "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              "transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        {children}
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(sheet, portalTarget)
})

// --- Header ---

const SheetHeader = React.forwardRef(function SheetHeader(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("px-6 pt-6 pb-4 pr-14", className)}
      data-slot="sheet-header"
      {...props}
    >
      {children}
    </div>
  )
})

// --- Title ---

const SheetTitle = React.forwardRef(function SheetTitle(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("text-[20px] font-bold leading-6 break-all", className)}
      data-slot="sheet-title"
      {...props}
    >
      {children}
    </div>
  )
})

// --- Description ---

const SheetDescription = React.forwardRef(function SheetDescription(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("mt-2 text-[14px] leading-5 text-muted-foreground", className)}
      data-slot="sheet-description"
      {...props}
    >
      {children}
    </div>
  )
})

// --- Footer ---

const SheetFooter = React.forwardRef(function SheetFooter(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "mt-auto border-t border-border px-6 py-4",
        "flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3",
        "[&_button]:w-full sm:[&_button]:w-auto",
        className
      )}
      data-slot="sheet-footer"
      {...props}
    >
      {children}
    </div>
  )
})

// --- Close (inline close button helper) ---

const SheetClose = React.forwardRef(function SheetClose(
  { children, asChild, className, ...props },
  ref
) {
  const { onOpenChange } = useSheetContext()
  const handleClose = React.useCallback(() => onOpenChange?.(false), [onOpenChange])

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ref,
      onClick: (...args) => {
        children.props.onClick?.(...args)
        handleClose()
      },
    })
  }

  return (
    <button
      type="button"
      ref={ref}
      className={className}
      onClick={handleClose}
      data-slot="sheet-close"
      {...props}
    >
      {children}
    </button>
  )
})

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
}
