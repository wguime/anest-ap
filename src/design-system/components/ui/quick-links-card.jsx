import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function QuickLinksCard({ title, action, children, className, ...props }) {
  return (
    <div
      data-slot="quick-links-card"
      className={cn(
        "rounded-[20px] p-5",
        "bg-card border border-[#A5D6A7] text-[hsl(var(--foreground))]",
        "border border-[#C8E6C9]",
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)]",
        "dark:bg-[#1A2420] dark:border-[#2A3F36] dark:shadow-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="text-[16px] font-bold leading-none">{title}</div>

        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            aria-label={action.label}
            className={cn(
              "inline-flex items-center gap-2",
              "text-[13px] font-medium",
              "text-[#006837] hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "dark:text-[#2ECC71]"
            )}
          >
            <span className="inline-flex [&_svg]:h-4 [&_svg]:w-4">
              {action.icon}
            </span>
            <span>{action.label}</span>
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-4 justify-items-center gap-4">
        {children}
      </div>
    </div>
  )
}

export { QuickLinksCard }


