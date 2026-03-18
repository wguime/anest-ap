import * as React from "react"
import { Check, Star } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const sizeClasses = {
  small: "col-span-1 row-span-1 min-h-[140px]",
  medium: "col-span-2 row-span-1 min-h-[140px]",
  large: "col-span-2 row-span-2 min-h-[300px]",
}

const variantClasses = {
  default:
    "bg-card shadow-[0_2px_12px_rgba(0,66,37,0.06)] border border-solid border-[1px] border-border dark:bg-card dark:border-border dark:shadow-none",
  highlight:
    "bg-accent shadow-[0_2px_12px_rgba(0,66,37,0.06)] border border-solid border-[1px] border-border dark:bg-card dark:border-[#344840] dark:shadow-none",
  interactive:
    "bg-card shadow-[0_2px_12px_rgba(0,66,37,0.06)] border border-solid border-[1px] border-border cursor-pointer hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99] dark:bg-card dark:border-border dark:shadow-none dark:hover:translate-y-0 dark:hover:border-[#344840] dark:hover:bg-card",
  outline:
    "bg-transparent border border-solid border-[1px] border-border shadow-none dark:bg-transparent dark:border-border",
}

// Selected state classes (for multi-select scenarios like risk factor cards)
const selectedClasses = {
  light: "border-primary border-2 bg-muted shadow-[0_0_0_2px_rgba(0,66,37,0.15)]",
  dark: "dark:border-primary dark:border-2 dark:bg-[#1A3D2E] dark:shadow-[0_0_0_2px_rgba(46,204,113,0.2)]",
}

/**
 * WidgetCard - Card de widget para dashboards
 *
 * @param {boolean} selected - Estado selecionado (para multi-select em calculadoras/riscos)
 * @param {boolean} showCheckmark - Mostrar checkmark quando selecionado (default: true)
 */
function WidgetCard({
  size = "small",
  variant = "default",
  selected = false,
  showCheckmark = true,
  isFavorite = false,
  onFavoriteClick,
  icon,
  iconClassName,
  title,
  subtitle,
  value,
  badge,
  onClick,
  onKeyDown,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function" || variant === "interactive"
  const hasValue = value != null && value !== ""
  const hasBadge = badge != null && badge !== ""

  const Root = isClickable ? "button" : "div"

  return (
    <Root
      type={isClickable ? "button" : undefined}
      data-slot="widget-card"
      data-size={size}
      data-variant={variant}
      data-selected={selected ? "true" : undefined}
      aria-pressed={isClickable ? selected : undefined}
      className={cn(
        "relative overflow-hidden text-left",
        "rounded-[20px] p-4 text-[hsl(var(--foreground))]",
        // Match Card's pattern: background/border/shadow change by variant
        variantClasses[variant] ?? variantClasses.default,
        // Selected state overrides
        selected && [selectedClasses.light, selectedClasses.dark],
        "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        sizeClasses[size] ?? sizeClasses.small,
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter") onClick(e)
        if (e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      {...props}
    >
      {/* Selected checkmark indicator */}
      {selected && showCheckmark && (
        <div
          className={cn(
            "absolute top-3 right-3 z-10",
            "flex items-center justify-center",
            "size-6 rounded-full",
            "bg-primary text-white",
            "dark:bg-primary dark:text-primary-foreground",
            "shadow-sm"
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </div>
      )}
      {/* Favorite star indicator */}
      {onFavoriteClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onFavoriteClick(e);
          }}
          className={cn(
            "absolute top-3 right-3 z-10",
            "p-1 rounded-full transition-colors",
            isFavorite
              ? "text-warning dark:text-warning"
              : "text-[#D1D5DB] dark:text-[#4B5563] hover:text-warning dark:hover:text-warning"
          )}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star
            className="size-4"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      )}
      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          {icon ? (
            <div
              data-slot="widget-card-icon"
              className={cn(
                "inline-flex items-center justify-center",
                "size-[44px] rounded-[12px]",
                !iconClassName && "bg-muted text-primary",
                !iconClassName && "dark:bg-muted dark:text-primary",
                iconClassName
              )}
            >
              <span className="inline-flex [&_svg]:size-6 [&_svg]:shrink-0">
                {icon}
              </span>
            </div>
          ) : (
            <span />
          )}

          {hasBadge ? (
            <span
              data-slot="widget-card-badge"
              className={cn(
                "inline-flex min-w-[22px] items-center justify-center rounded-full px-2",
                "h-[22px] text-[12px] font-bold leading-none",
                "bg-[#FF3B30] text-white",
                "ring-2 ring-[hsl(var(--card))] dark:ring-[hsl(var(--card))]",
                "shadow-[0_0_10px_rgba(255,59,48,0.25)] dark:shadow-[0_0_14px_rgba(255,69,58,0.35)]"
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div className="mt-auto space-y-1">
          <div className="space-y-0.5">
            <div
              data-slot="widget-card-title"
              className="line-clamp-2 text-[15px] font-bold leading-snug text-[hsl(var(--foreground))]"
            >
              {title}
            </div>

            {subtitle ? (
              <div
                data-slot="widget-card-subtitle"
                className="line-clamp-1 text-[12px] font-medium text-[hsl(var(--muted-foreground))]"
              >
                {subtitle}
              </div>
            ) : null}
          </div>

          {hasValue ? (
            <div
              data-slot="widget-card-value"
              className={cn(
                "pt-1 text-[28px] font-extrabold leading-none tracking-tight",
                "text-[#9BC53D] dark:text-primary"
              )}
            >
              {value}
            </div>
          ) : null}
        </div>
      </div>
    </Root>
  )
}

export { WidgetCard }


