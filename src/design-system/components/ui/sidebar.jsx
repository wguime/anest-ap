import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

const SidebarContext = React.createContext(null)

function useSidebarContext(componentName) {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error(`[${componentName}] must be used within <Sidebar />`)
  return ctx
}

function Sidebar({
  open,
  onOpenChange,
  side = "left",
  variant = "default",
  collapsible = "full",
  className,
  children,
  ...props
}) {
  const isControlledOpen = Boolean(open)
  const [portalTarget, setPortalTarget] = React.useState(null)
  const [collapsed, setCollapsed] = React.useState(false)

  React.useEffect(() => {
    if (!isControlledOpen) return
    if (typeof document === "undefined") return
    setPortalTarget(document.body)
  }, [isControlledOpen])

  // Lock scroll when open (drawer mode)
  React.useEffect(() => {
    if (!isControlledOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isControlledOpen])

  // Escape to close
  React.useEffect(() => {
    if (!isControlledOpen) return
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onOpenChange?.(false)
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [isControlledOpen, onOpenChange])

  const width = collapsible === "icon" && collapsed ? 72 : 280

  const ctx = React.useMemo(
    () => ({
      open: isControlledOpen,
      onOpenChange,
      side,
      variant,
      collapsible,
      collapsed,
      setCollapsed,
      width,
    }),
    [isControlledOpen, onOpenChange, side, variant, collapsible, collapsed, width]
  )

  if (!isControlledOpen || !portalTarget) return null

  const isLeft = side === "left"
  const floating = variant === "floating"
  const inset = variant === "inset"

  const panel = (
    <AnimatePresence>
      <motion.div
        key="anest-sidebar-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed inset-0 z-[1200] bg-black/50 dark:bg-black/70",
          inset ? "bg-transparent dark:bg-transparent" : ""
        )}
        onMouseDown={(e) => {
          if (inset) return
          if (e.target === e.currentTarget) onOpenChange?.(false)
        }}
      >
        <SidebarContext.Provider value={ctx}>
          <motion.aside
            key="anest-sidebar"
            initial={{ x: isLeft ? -24 : 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isLeft ? -24 : 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-slot="sidebar"
            data-side={side}
            data-variant={variant}
            data-collapsed={collapsed ? "true" : "false"}
            style={{
              width,
              height: "100vh",
              position: "fixed",
              top: 0,
              [isLeft ? "left" : "right"]: 0,
            }}
            className={cn(
              "flex flex-col overflow-hidden border-border bg-card text-foreground",
              isLeft ? "border-r" : "border-l",
              floating ? "m-4 h-[calc(100vh-2rem)] rounded-2xl shadow-lg" : "",
              className
            )}
            {...props}
          >
            {children}
          </motion.aside>
        </SidebarContext.Provider>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(panel, portalTarget)
}

function SidebarHeader({ className, children, ...props }) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("border-b border-border p-5", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarContent({ className, children, ...props }) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex-1 overflow-y-auto p-3", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarFooter({ className, children, ...props }) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("border-t border-border p-5", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarGroup({ className, children, ...props }) {
  return (
    <div data-slot="sidebar-group" className={cn("mb-3", className)} {...props}>
      {children}
    </div>
  )
}

function SidebarGroupLabel({ className, children, ...props }) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarItem({
  href,
  onClick,
  icon,
  badge,
  active = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  const { collapsible, collapsed } = useSidebarContext("SidebarItem")
  const showLabel = !(collapsible === "icon" && collapsed)

  const base = cn(
    "flex w-full items-center justify-start text-left gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
    active
      ? "bg-[#D4EDDA] text-[#004225] dark:bg-[rgba(46,204,113,0.15)] dark:text-[#2ECC71]"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  )

  const content = (
    <>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      {showLabel ? (
        <span className="min-w-0 truncate text-left">{children}</span>
      ) : (
        <span className="sr-only">{children}</span>
      )}
      {showLabel && badge !== undefined && badge !== null ? (
        <span className="ml-auto inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-muted px-1 text-[11px] font-bold text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        aria-current={active ? "page" : undefined}
        aria-disabled={disabled ? true : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault()
            return
          }
          onClick?.()
        }}
        data-slot="sidebar-item"
        className={cn(base, className)}
        {...props}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onClick?.()
      }}
      data-slot="sidebar-item"
      className={cn(base, className)}
      {...props}
    >
      {content}
    </button>
  )
}

function SidebarTrigger({ className, children, collapse = false, ...props }) {
  const { open, onOpenChange, collapsible, collapsed, setCollapsed } = useSidebarContext(
    "SidebarTrigger"
  )

  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold",
        "bg-secondary text-foreground hover:bg-muted transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      onClick={() => {
        if (collapse && collapsible !== "none") {
          setCollapsed(!collapsed)
        } else {
          onOpenChange?.(!open)
        }
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  SidebarTrigger,
}


