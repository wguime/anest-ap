import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { useFocusTrap } from "@/design-system/hooks/useFocusTrap"

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

// ⚠️ CELULAR DEITADO a folha de BAIXO vira PAINEL LATERAL (dono 27/08, Fase 4 do
// modo horizontal). Em pé ela ocupa 85% da altura e sobra tela por baixo; deitado
// os mesmos 85% são 331px de 390 e ela cobre a página inteira — some o contexto de
// onde a pessoa estava, que é justamente o que uma folha não deve fazer. À direita,
// com 420px, sobram 424px de tela viva (a faixa lateral mais o conteúdo) e o painel
// ainda fica MAIS ALTO que era: 390px contra 331.
//
// Vale para o app inteiro, e não só para os sheets da escala, porque é mudança de
// ORIENTAÇÃO: em pé nada muda — a variante `deitado:` só existe em celular na
// horizontal. Os 420px são a mesma largura que o lado `right` do próprio DS usa.
//
// ⚠️ `!h-full` e `max-h-none` são necessários porque os sheets da escala passam
// `!h-auto max-h-[88vh]` no className (padrão do módulo desde 17/08): sem o
// `!important` aqui, o `h-auto` deles venceria e o painel teria a altura do
// conteúdo; sem `max-h-none`, os 88vh virariam 343px e ele não chegaria à base.
// A variante entra depois na cascata, então ganha dos dois.
//
// ⚠️ O que NÃO dá para trocar por CSS é a ANIMAÇÃO: ela é inline, escrita pelo
// framer-motion a partir de `SLIDE_VARIANTS[side]`, e trocar o lado em JS
// dependeria de ler a orientação no JS — que é o que faz a tela pular no iOS. O
// painel entra deslizando de baixo para cima, e não da direita. Aceito de
// propósito: numa tela de 390px de altura o movimento é curto e lê como abrir.
const DEITADO_PAINEL_LATERAL = [
  "deitado:inset-y-0 deitado:left-auto deitado:right-0 deitado:w-[420px]",
  "deitado:!h-full deitado:max-h-none",
  "deitado:rounded-l-[20px] deitado:rounded-r-none",
  "deitado:border-l deitado:border-t-0",
].join(" ")

const POSITION_CLASSES = {
  right: "inset-y-0 right-0 w-full sm:w-[420px] md:w-[480px] rounded-l-[20px]",
  left: "inset-y-0 left-0 w-full sm:w-[420px] md:w-[480px] rounded-r-[20px]",
  top: "inset-x-0 top-0 h-[85vh] rounded-b-[20px]",
  bottom: `inset-x-0 bottom-0 h-[85vh] rounded-t-[20px] ${DEITADO_PAINEL_LATERAL}`,
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

  // Focus trap + scroll lock + escape (hook canônico — substitui ~80 linhas)
  useFocusTrap({
    active: open,
    containerRef: contentRef,
    onEscape: closeOnEscape ? onClose : undefined,
    lockScroll: true,
    returnFocus: true,
  })

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

        {/* Corpo rolável — SEM ele, informação some da tela sem aviso.
         *
         * O painel tem altura FIXA (`h-[85vh]` em POSITION_CLASSES, não max-h) e
         * `overflow-hidden`: tudo que passa disso era cortado sem barra de
         * rolagem e ficava inalcançável. Foi o que aconteceu no detalhe do caso
         * da Escala Cirúrgica em 29/07 — o sheet ganhou três blocos (tempo da
         * cirurgia, residente, ajuda) e empurrou os status Atrasada/Suspensa/
         * Passa para tarde para fora, onde o dono não conseguia mais tocá-los.
         * Três dos cinco sheets do app já contornavam isso por conta própria
         * com `overflow-y-auto` no className; agora o padrão é este e eles não
         * precisam mais.
         *
         * Fica aqui e não no painel para o ✕ (absolute) não rolar junto, e
         * espelha a regra do Modal.Body em .claude/rules/responsividade.md.
         * `overscroll-contain` impede o scroll de vazar para a página atrás no
         * iOS quando o corpo chega ao fim.
         *
         * Segue `flex flex-col` porque antes os filhos eram flex items do painel
         * — manter evita mudar espaçamento nos 5 sheets existentes. Medido em
         * browser: num container com `overflow-y: auto` os filhos NÃO encolhem
         * (261 de conteúdo em 253 de caixa, filhos em altura natural), então o
         * flex-shrink que se poderia temer aqui não acontece.
         * `min-h-0` é obrigatório: o corpo é flex ITEM do painel e sem ele o
         * item não encolhe abaixo do conteúdo, o container nunca fica menor que
         * o conteúdo e não há o que rolar. */}
        <div
          data-slot="sheet-body"
          className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          {children}
        </div>
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
