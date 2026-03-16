import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

function Breadcrumb({ className, children, ...props }) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-slot="breadcrumb"
      className={cn("flex items-center gap-2 overflow-x-auto scrollbar-hide", className)}
      {...props}
    >
      {children}
    </nav>
  )
}

function BreadcrumbList({ className, children, ...props }) {
  return (
    <ol
      role="list"
      data-slot="breadcrumb-list"
      className={cn("flex items-center gap-1.5 md:gap-2", className)}
      {...props}
    >
      {children}
    </ol>
  )
}

function BreadcrumbItem({ className, children, ...props }) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("flex items-center gap-1.5 md:gap-2 shrink-0", className)}
      {...props}
    >
      {children}
    </li>
  )
}

function BreadcrumbLink({
  href,
  onClick,
  icon,
  className,
  children,
  ...props
}) {
  const content = (
    <>
      {icon ? (
        <span className="inline-flex" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </>
  )

  const commonClassName = cn(
    "inline-flex items-center gap-1 md:gap-[6px] text-[13px] md:text-[14px] text-muted-foreground whitespace-nowrap min-h-[44px] px-1",
    "transition-colors duration-150 hover:text-primary-hover",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className
  )

  if (href) {
    return (
      <a data-slot="breadcrumb-link" href={href} className={commonClassName} {...props}>
        {content}
      </a>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        data-slot="breadcrumb-link"
        onClick={onClick}
        className={commonClassName}
        {...props}
      >
        {content}
      </button>
    )
  }

  return (
    <span data-slot="breadcrumb-link" className={commonClassName} {...props}>
      {content}
    </span>
  )
}

function BreadcrumbPage({ className, children, ...props }) {
  return (
    <span
      aria-current="page"
      data-slot="breadcrumb-page"
      className={cn("text-[14px] font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </span>
  )
}

function BreadcrumbSeparator({ children, className, ...props }) {
  return (
    <span
      aria-hidden="true"
      data-slot="breadcrumb-separator"
      className={cn("inline-flex w-4 items-center justify-center text-muted-foreground/70", className)}
      {...props}
    >
      {children ?? <ChevronRight className="h-4 w-4" aria-hidden="true" />}
    </span>
  )
}

function BreadcrumbEllipsis({ className, ...props }) {
  return (
    <span
      aria-hidden="true"
      data-slot="breadcrumb-ellipsis"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg",
        "text-muted-foreground",
        className
      )}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Mais</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}


