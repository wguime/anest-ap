import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function WidgetGrid({
  className,
  variant = "widgets",
  columns,
  gap,
  children,
  ...props
}) {
  const resolvedColumns =
    typeof columns === "number" && columns > 0
      ? columns
      : variant === "apps"
        ? 4
        : 2

  const resolvedGap =
    typeof gap === "number" && gap >= 0 ? `${gap}px` : "16px"

  return (
    <div
      data-slot="widget-grid"
      data-variant={variant}
      style={{
        "--wg-cols": String(resolvedColumns),
        "--wg-gap": resolvedGap,
      }}
      className={cn(
        "grid",
        "grid-cols-[repeat(var(--wg-cols),minmax(0,1fr))] gap-[var(--wg-gap)]",
        variant === "widgets" ? "auto-rows-[160px]" : "justify-items-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { WidgetGrid }


