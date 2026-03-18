import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/design-system/utils/tokens"

const navLinkVariants = cva(
  [
    "inline-flex items-center gap-2 select-none",
    "transition-[color,background-color,transform] duration-150 ease-in-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent hover:bg-muted/60",
        subtle: "bg-muted/60 hover:bg-muted",
        pill: "rounded-full bg-muted/40 hover:bg-muted",
      },
      size: {
        sm: "px-3 py-2 text-[13px] rounded-lg [&_svg]:h-4 [&_svg]:w-4",
        md: "px-4 py-[10px] text-[14px] rounded-xl [&_svg]:h-5 [&_svg]:w-5",
        lg: "px-5 py-3 text-[15px] rounded-xl [&_svg]:h-6 [&_svg]:w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export function NavLink({
  href,
  onClick,
  active = false,
  disabled = false,
  icon,
  iconPosition = "left",
  badge,
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}) {
  const isButton = !href
  const Comp = isButton ? "button" : "a"

  const stateClassName = cn(
    active
      ? "text-primary font-semibold bg-muted dark:bg-[rgba(46,204,113,0.15)]"
      : "text-muted-foreground hover:text-primary-hover",
    disabled ? "opacity-50 pointer-events-none" : ""
  )

  const iconNode = icon ? (
    <span className="inline-flex shrink-0" aria-hidden="true">
      {icon}
    </span>
  ) : null

  const badgeNode =
    badge !== undefined && badge !== null ? (
      <span className="ml-auto inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
        {badge}
      </span>
    ) : null

  return (
    <Comp
      data-slot="nav-link"
      href={!isButton ? href : undefined}
      type={isButton ? "button" : undefined}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault?.()
          return
        }
        onClick?.()
      }}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled ? true : undefined}
      disabled={isButton ? disabled : undefined}
      className={cn(navLinkVariants({ variant, size }), stateClassName, className)}
      {...props}
    >
      {iconPosition === "left" ? iconNode : null}
      <span className="min-w-0 truncate">{children}</span>
      {iconPosition === "right" ? iconNode : null}
      {badgeNode}
    </Comp>
  )
}


