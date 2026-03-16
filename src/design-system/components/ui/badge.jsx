import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/design-system/utils/tokens"

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] border px-2 py-1 text-[11px] font-semibold leading-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "[--badge-color:var(--badge-default)] [--badge-fg:var(--badge-default-foreground)]",
        secondary:
          "[--badge-color:var(--badge-secondary)] [--badge-fg:var(--badge-secondary-foreground)]",
        success:
          "[--badge-color:var(--badge-success)] [--badge-fg:var(--badge-success-foreground)]",
        warning:
          "[--badge-color:var(--badge-warning)] [--badge-fg:var(--badge-warning-foreground)]",
        destructive:
          "[--badge-color:var(--badge-destructive)] [--badge-fg:var(--badge-destructive-foreground)]",
        info: "[--badge-color:var(--badge-info)] [--badge-fg:var(--badge-info-foreground)]",
      },
      badgeStyle: {
        solid:
          "border-transparent bg-[hsl(var(--badge-color))] text-[hsl(var(--badge-fg))] [--badge-dot:hsl(var(--badge-fg))]",
        outline:
          "bg-transparent text-[hsl(var(--badge-color))] border-[hsl(var(--badge-color))] [--badge-dot:hsl(var(--badge-color))]",
        subtle:
          "border-transparent bg-[hsl(var(--badge-color)/0.1)] text-[hsl(var(--badge-color))] [--badge-dot:hsl(var(--badge-color))]",
      },
    },
    defaultVariants: {
      variant: "default",
      badgeStyle: "solid",
    },
  }
)

function Badge({
  className,
  variant,
  badgeStyle,
  dot = false,
  count,
  icon,
  children,
  ...props
}) {
  const hasCount = typeof count === "number"
  const hasContent = children != null && children !== false

  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-style={badgeStyle}
      className={cn(
        badgeVariants({ variant, badgeStyle }),
        hasCount && !hasContent ? "min-w-[22px]" : null,
        (dot && hasContent) || (icon && hasContent) ? "gap-1.5" : null,
        className
      )}
      {...props}
    >
      {dot && hasContent ? (
        <span
          data-slot="badge-dot"
          aria-hidden="true"
          className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--badge-dot)]"
        />
      ) : null}

      {icon && hasContent ? (
        <span
          data-slot="badge-icon"
          aria-hidden="true"
          className="inline-flex shrink-0 [&_svg]:size-3"
        >
          {icon}
        </span>
      ) : null}

      {hasContent ? children : hasCount ? count : null}
    </span>
  )
}

export { Badge, badgeVariants }


