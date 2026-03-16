import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/design-system/utils/tokens"

const buttonVariants = cva(
  // Base - box-border garante consistência com borders
  // NOTE:
  // - Em Tailwind, `text-*` também define line-height (default). Para evitar variações (especialmente
  //   perceptíveis em layouts responsivos), o `leading-none` é aplicado nos tamanhos (após `text-*`).
  // - `transform-gpu` força comportamento consistente de rendering quando há classes com transform/transition.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-center box-border transform-gpu transition-[colors,transform] duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border border-[#004225] text-[#004225] bg-transparent hover:bg-[#D4EDDA] dark:border-[#2ECC71] dark:text-[#2ECC71] dark:hover:bg-[rgba(46,204,113,0.15)]",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost: "bg-transparent text-foreground hover:bg-muted/50",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
        outline:
          "border border-primary bg-transparent text-primary hover:bg-primary/10",
      },
      size: {
        // Touch targets: sm=36px, default=44px, lg=48px
        sm: "h-9 min-h-[36px] px-3 text-xs leading-none",
        default: "h-11 min-h-[44px] px-4 text-sm leading-none",
        lg: "h-12 min-h-[48px] px-8 text-base leading-none",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Spinner({ className }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  ...props
}) {
  const Comp = asChild ? Slot : "button"
  const isDisabled = disabled || loading
  return (
    <Comp
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      aria-busy={loading ? true : undefined}
      aria-disabled={isDisabled ? true : undefined}
      disabled={!asChild ? isDisabled : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : leftIcon ? (
        <span data-slot="button-left-icon" className="inline-flex">
          {leftIcon}
        </span>
      ) : null}

      {children}

      {!loading && rightIcon ? (
        <span data-slot="button-right-icon" className="inline-flex">
          {rightIcon}
        </span>
      ) : null}
    </Comp>
  )
}

export { Button, buttonVariants }


