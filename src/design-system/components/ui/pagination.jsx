import * as React from "react"
import { cva } from "class-variance-authority"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center select-none",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:opacity-50 disabled:pointer-events-none",
    "rounded-lg",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-10 w-10 md:h-8 md:w-8 text-[13px] [&_svg]:h-4 [&_svg]:w-4",
        md: "h-11 w-11 md:h-10 md:w-10 text-[14px] [&_svg]:h-5 [&_svg]:w-5",
        lg: "h-12 w-12 text-[15px] [&_svg]:h-6 [&_svg]:w-6",
      },
      variant: {
        default: "bg-transparent hover:bg-muted",
        current: "bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { size: "md", variant: "default" },
  }
)

function buildPages(currentPage, totalPages, siblingCount) {
  const total = Math.max(1, totalPages)
  const current = Math.min(Math.max(1, currentPage), total)

  if (total <= 1) return [1]

  const leftSibling = Math.max(current - siblingCount, 2)
  const rightSibling = Math.min(current + siblingCount, total - 1)

  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < total - 1

  const pages = [1]

  if (showLeftEllipsis) {
    pages.push("ellipsis-left")
  } else {
    for (let p = 2; p < leftSibling; p += 1) pages.push(p)
  }

  for (let p = leftSibling; p <= rightSibling; p += 1) pages.push(p)

  if (showRightEllipsis) {
    pages.push("ellipsis-right")
  } else {
    for (let p = rightSibling + 1; p <= total - 1; p += 1) pages.push(p)
  }

  pages.push(total)
  return pages
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  showPrevNext = true,
  size = "md",
  className,
}) {
  const total = Math.max(1, totalPages)
  const current = Math.min(Math.max(1, currentPage), total)
  const pages = React.useMemo(
    () => buildPages(current, total, siblingCount),
    [current, total, siblingCount]
  )

  const canPrev = current > 1
  const canNext = current < total

  if (total <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn("flex items-center gap-1", className)}
    >
      {showFirstLast ? (
        <button
          type="button"
          aria-label="Primeira página"
          disabled={!canPrev}
          onClick={() => onPageChange(1)}
          className={cn(buttonVariants({ size, variant: "default" }), "hidden md:inline-flex")}
        >
          <ChevronsLeft aria-hidden="true" />
        </button>
      ) : null}

      {showPrevNext ? (
        <button
          type="button"
          aria-label="Página anterior"
          disabled={!canPrev}
          onClick={() => onPageChange(current - 1)}
          className={cn(buttonVariants({ size, variant: "default" }))}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : null}

      {pages.map((p) => {
        if (typeof p !== "number") {
          return (
            <span
              key={p}
              aria-hidden="true"
              className={cn(
                "inline-flex items-center justify-center text-muted-foreground",
                size === "sm" ? "h-8 w-8 text-[13px]" : "",
                size === "md" ? "h-10 w-10 text-[14px]" : "",
                size === "lg" ? "h-12 w-12 text-[15px]" : ""
              )}
            >
              ...
            </span>
          )
        }

        const isCurrent = p === current
        return (
          <button
            key={p}
            type="button"
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={cn(buttonVariants({ size, variant: isCurrent ? "current" : "default" }))}
          >
            {p}
          </button>
        )
      })}

      {showPrevNext ? (
        <button
          type="button"
          aria-label="Próxima página"
          disabled={!canNext}
          onClick={() => onPageChange(current + 1)}
          className={cn(buttonVariants({ size, variant: "default" }))}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}

      {showFirstLast ? (
        <button
          type="button"
          aria-label="Última página"
          disabled={!canNext}
          onClick={() => onPageChange(total)}
          className={cn(buttonVariants({ size, variant: "default" }), "hidden md:inline-flex")}
        >
          <ChevronsRight aria-hidden="true" />
        </button>
      ) : null}
    </nav>
  )
}


