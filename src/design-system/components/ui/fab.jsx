import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/design-system/utils/tokens"

/**
 * FloatingActionButton (FAB) — botão de ação flutuante canônico (Fase 1.6.3).
 *
 * Resolve FABs improvisados com z-index aleatório (z-30, z-1050, z-1101).
 * Posição fixa acima do BottomNav, respeita safe-area, touch ≥56px, z-sticky.
 *
 * Uso (icon-only — `label` vira aria-label):
 *   <FloatingActionButton icon={<Plus />} label="Novo evento" onClick={...} />
 *
 * Uso (extended — mostra texto):
 *   <FloatingActionButton icon={<Plus />} label="Novo" extended onClick={...} />
 */
const fabVariants = cva(
  cn(
    "fixed z-sticky inline-flex items-center justify-center gap-2",
    "rounded-full shadow-elevation-3 transform-gpu",
    "transition-transform duration-200 ease-in-out active:scale-[0.95]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:opacity-50 disabled:pointer-events-none",
    "[&_svg]:size-6 [&_svg]:shrink-0 [&_svg]:pointer-events-none"
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-card text-primary border border-border hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      // Touch targets: default 56px (Material FAB), sm 48px.
      size: {
        default: "h-14 min-h-[56px]",
        sm: "h-12 min-h-[48px]",
      },
      // Largura: icon-only = quadrado; extended = pill com padding.
      extended: {
        true: "px-5 text-sm font-semibold",
        false: "",
      },
    },
    compoundVariants: [
      { extended: false, size: "default", className: "w-14 min-w-[56px]" },
      { extended: false, size: "sm", className: "w-12 min-w-[48px]" },
    ],
    defaultVariants: { variant: "default", size: "default", extended: false },
  }
)

// Posições pré-definidas — sempre acima do BottomNav (~5rem) + safe-area.
const positionClasses = {
  "bottom-right": "right-4 sm:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom))]",
  "bottom-center": "left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))]",
}

const FloatingActionButton = React.forwardRef(function FloatingActionButton(
  {
    icon,
    label,
    extended = false,
    variant = "default",
    size = "default",
    position = "bottom-right",
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-slot="fab"
      className={cn(
        fabVariants({ variant, size, extended }),
        positionClasses[position] ?? positionClasses["bottom-right"],
        className
      )}
      {...props}
    >
      {icon}
      {extended ? <span>{children ?? label}</span> : null}
    </button>
  )
})

export { FloatingActionButton, fabVariants }
