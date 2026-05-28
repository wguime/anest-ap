import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle, X } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { useFocusTrap } from "@/design-system/hooks/useFocusTrap"
import { Button } from "./button"

/**
 * ConfirmDialog - Dialog de confirmação standalone (não usa Modal)
 * Layout: Ícone TRUE centralizado com compensação visual do botão X
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default", // "default" | "danger"
  loading = false,
  icon,
  children,
}) {
  const isDanger = variant === "danger"
  const Icon = icon
  const FallbackIcon = isDanger ? AlertTriangle : CheckCircle
  const iconWrapperClass = isDanger
    ? "text-destructive"
    : "text-primary"
  const iconBgClass = isDanger
    ? "bg-[#FEE2E2] dark:bg-[#7F1D1D]/40"
    : "bg-muted"
  
  const [portalTarget, setPortalTarget] = React.useState(null)
  const contentRef = React.useRef(null)

  React.useEffect(() => {
    if (!open) return
    if (typeof document === "undefined") return
    setPortalTarget(document.body)
  }, [open])

  // Focus trap + scroll lock + escape (hook canônico)
  useFocusTrap({
    active: open,
    containerRef: contentRef,
    onEscape: loading ? undefined : () => onClose?.(),
    lockScroll: true,
    returnFocus: true,
  })

  if (!open || !portalTarget) return null

  const content = (
    <AnimatePresence>
      <motion.div
        key="confirm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4 dark:bg-black/70"
        onMouseDown={(e) => {
          if (!loading && e.target === e.currentTarget) onClose?.()
        }}
      >
        <motion.div
          key="confirm-dialog"
          ref={contentRef}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby={description ? "confirm-desc" : undefined}
          className={cn(
            "relative w-full",
            children ? "max-w-[480px]" : "max-w-[420px]",
            "max-h-[calc(100dvh-32px)] overflow-y-auto",
            "rounded-3xl border border-border bg-card shadow-elevation-4 outline-none"
          )}
        >
          {/* Botão X - Posição absoluta no canto, fora do fluxo */}
          {!loading && (
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className={cn(
                "absolute right-5 top-5 z-10",
                "inline-flex h-10 w-10 items-center justify-center rounded-xl",
                "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          {/* 
            Container de conteúdo com padding uniforme.
            O pt extra compensa visualmente o botão X no topo-direita.
          */}
          <div className="flex flex-col items-center px-10 pb-10 pt-12 text-center sm:px-12 sm:pb-12 sm:pt-14">
            {/* Ícone - Centralizado visualmente */}
            <div
              className={cn(
                "mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-2xl",
                iconBgClass
              )}
            >
              {Icon ? (
                <span
                  className={cn("flex h-11 w-11 items-center justify-center", iconWrapperClass)}
                  aria-hidden="true"
                >
                  {Icon}
                </span>
              ) : (
                <FallbackIcon
                  className={cn(
                    "h-11 w-11",
                    iconWrapperClass
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Título */}
            <h2
              id="confirm-title"
              className="text-xl font-bold leading-tight text-foreground"
            >
              {title}
            </h2>

            {/* Descrição */}
            {description && (
              <p
                id="confirm-desc"
                className="mt-3 max-w-[300px] text-sm leading-relaxed text-muted-foreground"
              >
                {description}
              </p>
            )}

            {/* Conteúdo customizado (children) */}
            {children && (
              <div className="mt-4 w-full text-left text-sm">
                {children}
              </div>
            )}

            {/* Botões */}
            <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="min-w-[120px]"
              >
                {cancelText}
              </Button>
              <Button
                variant={isDanger ? "destructive" : "default"}
                onClick={onConfirm}
                disabled={loading}
                loading={loading}
                className="min-w-[120px]"
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(content, portalTarget)
}


