import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function AppIcon({
  icon,
  label,
  onClick,
  onKeyDown,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"
  const Root = isClickable ? "button" : "div"

  return (
    <div
      data-slot="app-icon"
      className={cn("flex w-full flex-col items-center", className)}
      {...props}
    >
      <Root
        type={isClickable ? "button" : undefined}
        className={cn(
          "relative inline-flex items-center justify-center",
          "h-[54px] w-[54px] rounded-full overflow-hidden",
          "transition-[transform,box-shadow] duration-150 ease-out",
          "active:scale-[0.95]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isClickable ? "cursor-pointer" : "",
          // Always filled (same visual as "Calculadoras")
          [
            // LIGHT
            "bg-[linear-gradient(135deg,#006837_0%,#004225_100%)]",
            "border-2 border-[#9BC53D]",
            "text-white",
            "shadow-[0_6px_16px_rgba(0,66,37,0.4)]",
            // DARK
            "dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)]",
            "dark:border-0",
            "dark:text-primary-foreground",
            "dark:shadow-[0_6px_16px_rgba(46,204,113,0.4)]",
          ].join(" ")
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
      >
        <span
          data-slot="app-icon-icon"
          aria-hidden="true"
          className={cn(
            "relative z-[1] inline-flex items-center justify-center text-current",
            "[&_img]:h-full [&_img]:w-full [&_img]:object-contain",
            "[&_svg]:h-full [&_svg]:w-full",
            "[&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.5]"
          )}
        >
          {icon}
        </span>
      </Root>

      <span
        data-slot="app-icon-label"
        title={label}
        className={cn(
          "mt-2 w-full max-w-[90px] truncate text-center",
          "text-[10px] font-medium",
          "text-muted-foreground dark:text-[#8B9A93]"
        )}
      >
        {label}
      </span>
    </div>
  )
}

export { AppIcon }


