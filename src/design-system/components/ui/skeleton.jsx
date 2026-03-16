import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

let __dsShimmerInjected = false
function ensureShimmerKeyframes() {
  if (typeof document === "undefined") return
  if (__dsShimmerInjected) return
  __dsShimmerInjected = true

  const styleId = "ds-skeleton-shimmer-keyframes"
  if (document.getElementById(styleId)) return

  const style = document.createElement("style")
  style.id = styleId
  style.textContent = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`
  document.head.appendChild(style)
}

function toCssSize(v) {
  if (v == null) return undefined
  return typeof v === "number" ? `${v}px` : v
}

const avatarSizeMap = {
  sm: 32,
  md: 44,
  lg: 52,
  xl: 80,
}

function Skeleton({
  className,
  variant = "custom",
  size = "md",
  width,
  height,
  borderRadius,
  count = 1,
  ...props
}) {
  ensureShimmerKeyframes()

  const baseClass = cn(
    "relative overflow-hidden",
    // shimmer gradient (light/dark)
    "bg-[linear-gradient(90deg,#F3F4F6_0%,#E5E7EB_50%,#F3F4F6_100%)]",
    "dark:bg-[linear-gradient(90deg,#1A2420_25%,#243530_50%,#1A2420_75%)]",
    // shimmer movement
    "bg-[length:200%_100%] [animation:shimmer_1.5s_infinite_ease-in-out]"
  )

  if (variant === "listItem") {
    return (
      <div
        data-slot="skeleton"
        data-variant="listItem"
        className={cn("flex items-center gap-3", className)}
        {...props}
      >
        <div
          aria-hidden="true"
          className={cn(baseClass, "shrink-0 rounded-full")}
          style={{ width: "48px", height: "48px", borderRadius: "9999px" }}
        />
        <div className="grid flex-1 gap-2">
          <div
            aria-hidden="true"
            className={cn(baseClass, "h-4 rounded-md")}
            style={{ height: "16px" }}
          />
          <div
            aria-hidden="true"
            className={cn(baseClass, "h-4 w-4/5 rounded-md")}
            style={{ height: "16px" }}
          />
        </div>
      </div>
    )
  }

  if (variant === "text" && Number(count) > 1) {
    const safeCount = Math.max(1, Number(count) || 1)
    return (
      <div
        data-slot="skeleton"
        data-variant="text"
        className={cn("grid gap-2", className)}
        {...props}
      >
        {Array.from({ length: safeCount }).map((_, idx) => {
          const isLast = idx === safeCount - 1
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              aria-hidden="true"
              className={cn(
                baseClass,
                "h-4 rounded-md",
                isLast ? "w-4/5" : "w-full"
              )}
              style={{ height: "16px" }}
            />
          )
        })}
      </div>
    )
  }

  const style = {
    width: toCssSize(width),
    height: toCssSize(height),
    borderRadius: toCssSize(borderRadius),
  }

  switch (variant) {
    case "text":
      return (
        <div
          data-slot="skeleton"
          data-variant="text"
          aria-hidden="true"
          className={cn(baseClass, "h-4 w-full rounded-md", className)}
          style={{ ...style, height: style.height ?? "16px" }}
          {...props}
        />
      )

    case "avatar": {
      const px = avatarSizeMap[size] ?? avatarSizeMap.md
      return (
        <div
          data-slot="skeleton"
          data-variant="avatar"
          data-size={size}
          aria-hidden="true"
          className={cn(baseClass, "rounded-full", className)}
          style={{
            ...style,
            width: style.width ?? `${px}px`,
            height: style.height ?? `${px}px`,
            borderRadius: style.borderRadius ?? "9999px",
          }}
          {...props}
        />
      )
    }

    case "card":
      return (
        <div
          data-slot="skeleton"
          data-variant="card"
          aria-hidden="true"
          className={cn(baseClass, "w-full", className)}
          style={{
            ...style,
            width: style.width ?? "100%",
            height: style.height ?? "160px",
            borderRadius: style.borderRadius ?? "20px",
          }}
          {...props}
        />
      )

    case "button":
      return (
        <div
          data-slot="skeleton"
          data-variant="button"
          aria-hidden="true"
          className={cn(baseClass, "w-full", className)}
          style={{
            ...style,
            width: style.width ?? "100%",
            height: style.height ?? "40px",
            borderRadius: style.borderRadius ?? "12px",
          }}
          {...props}
        />
      )

    case "custom":
    default:
      return (
        <div
          data-slot="skeleton"
          data-variant="custom"
          aria-hidden="true"
          className={cn(baseClass, className)}
          style={style}
          {...props}
        />
      )
  }
}

export { Skeleton }


