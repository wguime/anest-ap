import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

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

// Tamanhos do modal - padding extra generoso para afastar conteúdo das bordas (ANEST specs)
// O pt maior compensa visualmente o botão X no canto superior direito
// Mobile: pt-3 (drag handle faz a separação visual) | Desktop: pt-14
const SIZE_CLASSES = {
  sm: "max-w-[440px] px-6 pb-10 pt-3 sm:px-10 sm:pb-10 sm:pt-14",
  md: "max-w-[540px] px-6 pb-10 pt-3 sm:px-10 sm:pb-10 sm:pt-14",
  lg: "max-w-[700px] px-6 pb-10 pt-3 sm:px-12 sm:pb-12 sm:pt-14",
  xl: "max-w-[860px] px-6 pb-10 pt-3 sm:px-12 sm:pb-12 sm:pt-14",
  full: "max-w-[90vw] max-h-[90vh] px-6 pb-10 pt-3 sm:px-12 sm:pb-12 sm:pt-14",
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  footer,
  className,
}) {
  const titleId = React.useId()
  const descriptionId = React.useId()

  const contentRef = React.useRef(null)
  const previouslyFocusedRef = React.useRef(null)
  const [portalTarget, setPortalTarget] = React.useState(null)

  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    setIsMobile(window.innerWidth < 640)
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

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

    // Give the portal a tick to mount before focusing
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
        onClose?.()
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

  const modal = (
    <AnimatePresence>
      <motion.div
        key="anest-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[1100] flex items-start sm:items-center justify-center bg-black/50 p-4 sm:p-6 dark:bg-black/70 overflow-y-auto"
        onMouseDown={(e) => {
          if (!closeOnOverlayClick) return
          if (e.target === e.currentTarget) onClose?.()
        }}
      >
        <motion.div
          key="anest-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
            {...(isMobile ? {
              drag: "y",
              dragConstraints: { top: 0, bottom: 0 },
              dragElastic: { top: 0, bottom: 0.4 },
              onDragEnd: (_, info) => {
                if (info.offset.y > 120) {
                  onClose?.()
                }
              },
            } : {})}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          ref={contentRef}
          className={cn(
            // Mobile: dialog inset com largura/altura seguras e scroll interno
            "relative flex w-full flex-col",
            "max-w-[calc(100vw-32px)] sm:max-w-none",
            "max-h-[calc(100dvh-32px)] sm:max-h-[90vh]",
            "overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-lg outline-none modal-safe",
            SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
            className
          )}
        >
          {isMobile ? (
            <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
          ) : null}

          {showCloseButton ? (
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className={cn(
                "absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-xl",
                "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}

          {title || description ? (
            <Modal.Header titleId={titleId} descriptionId={descriptionId}>
              {title ? <Modal.Title id={titleId}>{title}</Modal.Title> : null}
              {description ? (
                <Modal.Description id={descriptionId}>
                  {description}
                </Modal.Description>
              ) : null}
            </Modal.Header>
          ) : null}

          {children ? <div className="min-h-0 flex-1 min-w-0 flex flex-col">{children}</div> : null}

          {footer ? <Modal.Footer>{footer}</Modal.Footer> : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(modal, portalTarget)
}

Modal.Header = function ModalHeader({ className, children }) {
  return (
    <div
      className={cn(
        // mt-6 garante espaço entre o topo do modal e o título
        // pr-12 reserva espaço para o botão X no mobile
        "mt-6 mb-4 sm:mb-6 pr-12 sm:pr-0",
        className
      )}
      data-slot="modal-header"
    >
      {children}
    </div>
  )
}

Modal.Title = function ModalTitle({ className, children, ...props }) {
  return (
    <div
      className={cn("text-[20px] font-bold leading-6 break-all", className)}
      {...props}
      data-slot="modal-title"
    >
      {children}
    </div>
  )
}

Modal.Description = function ModalDescription({ className, children, ...props }) {
  return (
    <div
      className={cn("mt-2 text-[14px] leading-5 text-muted-foreground", className)}
      {...props}
      data-slot="modal-description"
    >
      {children}
    </div>
  )
}

Modal.Body = function ModalBody({ className, children }) {
  return (
    <div
      className={cn(
        // Mantém alinhamento do conteúdo com header/footer no mobile (sem pr-1),
        // e ainda permite scroll interno quando necessário.
        "min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-hidden pr-0 sm:pr-1",
        className
      )}
      data-slot="modal-body"
    >
      {children}
    </div>
  )
}

Modal.Footer = function ModalFooter({ className, children }) {
  return (
    <div
      className={cn(
        // Mobile: botões em coluna e com largura total (melhor margem/toque)
        // Desktop: lado a lado alinhados à direita
        // pb-2 garante espaçamento do footer em relação à borda inferior do modal
        "mt-6 sm:mt-8 pb-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3",
        "[&_button]:w-full sm:[&_button]:w-auto",
        className
      )}
      data-slot="modal-footer"
    >
      {children}
    </div>
  )
}


