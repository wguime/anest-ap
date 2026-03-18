import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Circle } from "lucide-react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/design-system/utils/tokens"

function useControllableState({ value, defaultValue, onChange }) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const state = isControlled ? value : uncontrolled
  const setState = React.useCallback(
    (next) => {
      const nextValue = typeof next === "function" ? next(state) : next
      if (!isControlled) setUncontrolled(nextValue)
      onChange?.(nextValue)
    },
    [isControlled, onChange, state]
  )
  return [state, setState]
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function getMenuOrigin(side) {
  switch (side) {
    case "top":
      return "bottom"
    case "bottom":
      return "top"
    case "left":
      return "right"
    case "right":
      return "left"
    default:
      return "top"
  }
}

function getItemNodes(itemsRef) {
  return itemsRef.current
    .map((i) => i?.ref?.current)
    .filter(Boolean)
    .filter((el) => {
      const style = window.getComputedStyle(el)
      return style.display !== "none" && style.visibility !== "hidden"
    })
}

const DropdownContext = React.createContext(null)
const DropdownRadioGroupContext = React.createContext(null)

function useDropdownContext(componentName) {
  const ctx = React.useContext(DropdownContext)
  if (!ctx) throw new Error(`[${componentName}] must be used within <DropdownMenu />`)
  return ctx
}

function DropdownMenu({ open, onOpenChange, defaultOpen = false, children }) {
  const triggerRef = React.useRef(null)
  const contentRef = React.useRef(null)
  const itemsRef = React.useRef([])

  const [portalTarget, setPortalTarget] = React.useState(null)
  const [isOpen, setIsOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })

  const contentId = React.useId()

  React.useEffect(() => {
    if (!isOpen) return
    if (typeof document === "undefined") return
    setPortalTarget(document.body)
  }, [isOpen])

  const registerItem = React.useCallback((id, ref, disabled, closeOnSelect = true) => {
    itemsRef.current = [...itemsRef.current, { id, ref, disabled, closeOnSelect }]
    return () => {
      itemsRef.current = itemsRef.current.filter((i) => i.id !== id)
    }
  }, [])

  const focusFirst = React.useCallback(() => {
    const list = itemsRef.current
    const first = list.find((i) => !i.disabled)?.ref?.current
    if (first && typeof first.focus === "function") first.focus()
  }, [])

  const focusNext = React.useCallback((direction) => {
    const nodes = getItemNodes(itemsRef)
    if (!nodes.length) return
    const active = document.activeElement
    const idx = Math.max(0, nodes.indexOf(active))
    for (let i = 1; i <= nodes.length; i += 1) {
      const next = nodes[(idx + direction * i + nodes.length) % nodes.length]
      if (!next) continue
      if (next.getAttribute("aria-disabled") === "true" || next.hasAttribute("disabled")) {
        continue
      }
      next.focus()
      return
    }
  }, [])

  const close = React.useCallback(() => setIsOpen(false), [setIsOpen])
  const openMenu = React.useCallback(() => setIsOpen(true), [setIsOpen])
  const toggle = React.useCallback(() => setIsOpen((v) => !v), [setIsOpen])

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (e) => {
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      if (triggerRef.current?.contains(t)) return
      if (contentRef.current?.contains(t)) return
      close()
    }
    document.addEventListener("mousedown", onMouseDown, true)
    return () => document.removeEventListener("mousedown", onMouseDown, true)
  }, [isOpen, close])

  // Escape to close
  React.useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      close()
      window.requestAnimationFrame(() => triggerRef.current?.focus?.())
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [isOpen, close])

  const ctx = React.useMemo(
    () => ({
      isOpen,
      setIsOpen,
      openMenu,
      close,
      toggle,
      triggerRef,
      contentRef,
      registerItem,
      focusFirst,
      focusNext,
      portalTarget,
      contentId,
    }),
    [isOpen, setIsOpen, openMenu, close, toggle, registerItem, focusFirst, focusNext, portalTarget, contentId]
  )

  return <DropdownContext.Provider value={ctx}>{children}</DropdownContext.Provider>
}

function DropdownTrigger({ asChild = false, className, children, ...props }) {
  const { isOpen, toggle, triggerRef, contentId } = useDropdownContext("DropdownTrigger")
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={triggerRef}
      type={!asChild ? "button" : undefined}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? contentId : undefined}
      data-slot="dropdown-trigger"
      onClick={(e) => {
        props.onClick?.(e)
        toggle()
      }}
      className={cn(
        !asChild
          ? cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
              "bg-secondary text-foreground hover:bg-muted",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )
          : "",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}

function DropdownContent({
  align = "start",
  side = "bottom",
  sideOffset = 8,
  minWidth: minWidthProp,
  className,
  children,
  ...props
}) {
  const {
    isOpen,
    close,
    triggerRef,
    contentRef,
    focusFirst,
    focusNext,
    portalTarget,
    contentId,
  } = useDropdownContext("DropdownContent")

  const [pos, setPos] = React.useState({ top: 0, left: 0, minWidth: 200 })

  const computePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const minWidth = Math.max(minWidthProp || 200, rect.width)

    let left = rect.left
    if (align === "center") left = rect.left + rect.width / 2 - minWidth / 2
    if (align === "end") left = rect.right - minWidth

    let top = rect.bottom + sideOffset
    if (side === "top") top = rect.top - sideOffset
    if (side === "left" || side === "right") {
      top = rect.top
      if (align === "center") top = rect.top + rect.height / 2
      if (align === "end") top = rect.bottom
    }

    if (side === "left") left = rect.left - sideOffset
    if (side === "right") left = rect.right + sideOffset

    // keep in viewport with padding
    const pad = 8
    left = clamp(left, pad, viewportW - minWidth - pad)
    top = clamp(top, pad, viewportH - pad)

    setPos({ top, left, minWidth })
  }, [align, side, sideOffset, minWidthProp, triggerRef])

  React.useLayoutEffect(() => {
    if (!isOpen) return
    computePosition()
  }, [isOpen, computePosition])

  React.useEffect(() => {
    if (!isOpen) return
    const onResize = () => computePosition()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [isOpen, computePosition])

  React.useEffect(() => {
    if (!isOpen) return
    const raf = window.requestAnimationFrame(() => focusFirst())
    return () => window.cancelAnimationFrame(raf)
  }, [isOpen, focusFirst])

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      focusNext(1)
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      focusNext(-1)
      return
    }
    if (e.key === "Home") {
      e.preventDefault()
      focusFirst()
      return
    }
    if (e.key === "End") {
      e.preventDefault()
      focusNext(-1) // from active; good enough
      return
    }
    if (e.key === "Tab") {
      // keep focus inside menu: close and allow normal tab flow
      close()
    }
  }

  if (!isOpen || !portalTarget) return null

  const origin = getMenuOrigin(side)

  const content = (
    <AnimatePresence>
      <motion.div
        key={contentId}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          minWidth: pos.minWidth,
          transformOrigin: origin,
          zIndex: 1200,
        }}
        ref={contentRef}
        id={contentId}
        role="menu"
        aria-orientation="vertical"
        data-slot="dropdown-content"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(content, portalTarget)
}

function DropdownItem({
  onClick,
  disabled = false,
  icon,
  shortcut,
  destructive = false,
  className,
  children,
  ...props
}) {
  const { close, registerItem } = useDropdownContext("DropdownItem")
  const id = React.useId()
  const ref = React.useRef(null)

  React.useEffect(() => registerItem(id, ref, disabled, true), [registerItem, id, disabled])

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      data-slot="dropdown-item"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-3 min-h-[44px] text-left text-[14px]",
        "transition-colors duration-150",
        "focus-visible:outline-none",
        "hover:bg-muted focus:bg-muted dark:focus:bg-[rgba(46,204,113,0.15)]",
        destructive ? "text-destructive" : "text-foreground",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      onClick={() => {
        if (disabled) return
        onClick?.()
        close()
      }}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      ) : (
        <span className="w-4" aria-hidden="true" />
      )}

      <span className="min-w-0 flex-1 truncate">{children}</span>

      {shortcut ? <DropdownShortcut>{shortcut}</DropdownShortcut> : null}
    </button>
  )
}

function DropdownCheckboxItem({
  checked,
  defaultChecked = false,
  onCheckedChange,
  onClick,
  disabled = false,
  icon,
  shortcut,
  className,
  children,
  ...props
}) {
  const { registerItem } = useDropdownContext("DropdownCheckboxItem")
  const id = React.useId()
  const ref = React.useRef(null)
  const [isChecked, setIsChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  })

  React.useEffect(() => registerItem(id, ref, disabled, false), [registerItem, id, disabled])

  return (
    <button
      ref={ref}
      type="button"
      role="menuitemcheckbox"
      aria-checked={Boolean(isChecked)}
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      data-slot="dropdown-checkbox-item"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-3 min-h-[44px] text-left text-[14px]",
        "transition-colors duration-150",
        "focus-visible:outline-none",
        "hover:bg-muted focus:bg-muted dark:focus:bg-[rgba(46,204,113,0.15)]",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      onClick={() => {
        if (disabled) return
        onClick?.()
        setIsChecked((v) => !v)
      }}
      {...props}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
        {isChecked ? <Check className="h-4 w-4" /> : null}
      </span>

      {icon ? (
        <span className="inline-flex shrink-0 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? <DropdownShortcut>{shortcut}</DropdownShortcut> : null}
    </button>
  )
}

function DropdownRadioGroup({ value, defaultValue, onValueChange, children, ...props }) {
  const [current, setCurrent] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  })
  const ctx = React.useMemo(() => ({ value: current, setValue: setCurrent }), [current, setCurrent])
  return (
    <DropdownRadioGroupContext.Provider value={ctx}>
      <div data-slot="dropdown-radio-group" {...props}>
        {children}
      </div>
    </DropdownRadioGroupContext.Provider>
  )
}

function useRadioGroup() {
  const ctx = React.useContext(DropdownRadioGroupContext)
  if (!ctx) throw new Error("[DropdownRadioItem] must be used within <DropdownRadioGroup />")
  return ctx
}

function DropdownRadioItem({
  value,
  onClick,
  disabled = false,
  icon,
  shortcut,
  className,
  children,
  ...props
}) {
  const { registerItem } = useDropdownContext("DropdownRadioItem")
  const group = useRadioGroup()
  const id = React.useId()
  const ref = React.useRef(null)
  const checked = group.value === value

  React.useEffect(() => registerItem(id, ref, disabled, false), [registerItem, id, disabled])

  return (
    <button
      ref={ref}
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      data-slot="dropdown-radio-item"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-3 min-h-[44px] text-left text-[14px]",
        "transition-colors duration-150",
        "focus-visible:outline-none",
        "hover:bg-muted focus:bg-muted dark:focus:bg-[rgba(46,204,113,0.15)]",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      onClick={() => {
        if (disabled) return
        onClick?.()
        group.setValue(value)
      }}
      {...props}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
        {checked ? <Circle className="h-2.5 w-2.5 fill-current" /> : null}
      </span>

      {icon ? (
        <span className="inline-flex shrink-0 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? <DropdownShortcut>{shortcut}</DropdownShortcut> : null}
    </button>
  )
}

function DropdownLabel({ className, children, ...props }) {
  return (
    <div
      data-slot="dropdown-label"
      className={cn(
        "px-3 py-[10px] text-[12px] font-semibold uppercase tracking-[0.5px] text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownSeparator({ className, ...props }) {
  return (
    <div
      role="separator"
      data-slot="dropdown-separator"
      className={cn("my-2 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownShortcut({ className, children, ...props }) {
  return (
    <span
      data-slot="dropdown-shortcut"
      className={cn("ml-auto text-[12px] text-muted-foreground", className)}
      {...props}
    >
      {children}
    </span>
  )
}

export {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownCheckboxItem,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownShortcut,
}


