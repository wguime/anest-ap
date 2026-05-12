/**
 * Skeleton (anest)
 *
 * Family of named skeleton primitives for loading states across ANEST pages.
 * Design tokens only — uses `bg-muted` + `animate-pulse` (no hex).
 *
 * Components:
 * - <Skeleton />         base shimmer rectangle (rounded-md, h-4 default)
 * - <SkeletonCard />     card-shaped placeholder (h-32, border, rounded-xl)
 * - <SkeletonRow />      single line (h-4, rounded)
 * - <SkeletonText lines={3} /> N stacked SkeletonRows with gap
 * - <SkeletonAvatar size="md" /> circular skeleton
 *
 * Convention:
 * - Wrappers expose `role="presentation"` + `aria-hidden="true"` (decorative).
 *   Pages providing the loading state already announce it (e.g. `role="status"`,
 *   `aria-live="polite"`); skeletons are purely visual placeholders.
 * - All components accept an optional `className` prop merged via `cn()`.
 */
import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

const AVATAR_SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
}

/**
 * Base shimmer rectangle. Uses `bg-muted` (DS token) + `animate-pulse`.
 * Default height: h-4. Default radius: rounded-md.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        "block h-4 w-full rounded-md bg-muted animate-pulse",
        className
      )}
      {...props}
    />
  )
}

/**
 * Card-shaped skeleton. Mimics list/grid cards while data loads.
 * h-32, border-border, rounded-xl.
 */
export function SkeletonCard({ className, ...props }) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        "h-32 w-full rounded-xl border border-border bg-muted animate-pulse",
        className
      )}
      {...props}
    />
  )
}

/**
 * Single line skeleton (h-4). Use for table rows / list items / paragraphs.
 */
export function SkeletonRow({ className, ...props }) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        "h-4 w-full rounded-md bg-muted animate-pulse",
        className
      )}
      {...props}
    />
  )
}

/**
 * Stacked SkeletonRows. `lines` controls how many rows are rendered.
 * Last row is rendered slightly shorter (w-4/5) to mimic a paragraph.
 */
export function SkeletonText({ lines = 3, className, ...props }) {
  const safeLines = Math.max(1, Number(lines) || 1)
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {Array.from({ length: safeLines }).map((_, idx) => {
        const isLast = idx === safeLines - 1
        return (
          <SkeletonRow
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className={isLast && safeLines > 1 ? "w-4/5" : "w-full"}
          />
        )
      })}
    </div>
  )
}

/**
 * Circular avatar skeleton. Sizes: sm (32), md (44), lg (56), xl (80).
 */
export function SkeletonAvatar({ size = "md", className, ...props }) {
  const sizeClass = AVATAR_SIZE_CLASSES[size] ?? AVATAR_SIZE_CLASSES.md
  return (
    <div
      role="presentation"
      aria-hidden="true"
      data-size={size}
      className={cn(
        sizeClass,
        "shrink-0 rounded-full bg-muted animate-pulse",
        className
      )}
      {...props}
    />
  )
}
