import * as React from "react"

import { Badge } from "@/design-system/components/ui"
import { cn } from "@/design-system/utils/tokens"

function SectionCard({
  title,
  subtitle,
  action,
  headerAction,
  badge,
  children,
  variant = "default",
  className,
  ...props
}) {
  return (
    <div
      data-slot="anest-section-card"
      data-variant={variant}
      className={cn(
        "rounded-[20px] p-4 md:p-5",
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-shadow duration-300 ease-out",
        variant === "highlight"
          ? "bg-accent border border-border dark:bg-muted dark:border-[#344840] dark:shadow-none"
          : "bg-card border border-border dark:bg-card dark:border-border dark:shadow-none",
        className
      )}
      {...props}
    >
      <div
        data-slot="anest-section-card-header"
        className="flex items-start justify-between gap-4"
      >
        <div data-slot="anest-section-card-header-left" className="min-w-0">
          {subtitle ? (
            <div
              data-slot="anest-section-card-subtitle"
              className="text-[12px] font-medium uppercase tracking-[0.5px] text-primary"
            >
              {subtitle}
            </div>
          ) : null}
          <div
            data-slot="anest-section-card-title"
            className="text-[16px] md:text-[18px] font-bold text-[#000000] dark:text-[#FFFFFF]"
          >
            {title}
          </div>
        </div>

        <div
          data-slot="anest-section-card-header-right"
          className="flex shrink-0 items-center gap-3"
        >
          {badge ? (
            <Badge variant={badge.variant ?? "default"}>{badge.text}</Badge>
          ) : null}

          {headerAction ? headerAction : null}

          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:opacity-90 dark:text-primary min-h-[44px] px-2"
            >
              <span aria-hidden="true" className="inline-flex [&_svg]:size-4">
                {action.icon}
              </span>
              <span>{action.label}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div data-slot="anest-section-card-content" className="mt-4">
        {children}
      </div>
    </div>
  )
}

export { SectionCard }


