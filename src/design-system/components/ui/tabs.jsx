import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { useTheme } from "../../hooks/useTheme.jsx"
import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

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

  return [state, setState, isControlled]
}

function getTabStopValue(values, getDisabled, activeValue) {
  if (activeValue && values.includes(activeValue) && !getDisabled(activeValue)) {
    return activeValue
  }
  return values.find((v) => !getDisabled(v)) ?? values[0]
}

function getNextEnabledValue(values, getDisabled, fromValue, direction) {
  if (!values.length) return null
  const startIndex = Math.max(0, values.indexOf(fromValue))

  for (let i = 1; i <= values.length; i += 1) {
    const idx = (startIndex + direction * i + values.length) % values.length
    const v = values[idx]
    if (!getDisabled(v)) return v
  }
  return null
}

const TabsContext = React.createContext(null)

function useTabsContext(componentName) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error(`[${componentName}] must be used within <Tabs />`)
  }
  return ctx
}

/**
 * Tabs - Container principal das abas
 *
 * @param {string} variant - "default" | "pills" | "underline"
 *   - default: Abas com background em container
 *   - pills: Botões pill-shaped para filtros (scrollável horizontal)
 *   - underline: Abas com sublinhado (sem container)
 */
function Tabs({
  defaultValue,
  value,
  onValueChange,
  orientation = "horizontal",
  variant = "default",
  className,
  children,
  ...props
}) {
  const baseId = React.useId()
  const triggers = React.useRef(new Map())
  const [values, setValues] = React.useState([])

  const getDisabled = React.useCallback((v) => {
    const entry = triggers.current.get(v)
    return Boolean(entry?.disabled)
  }, [])

  const [currentValue, setCurrentValue, isControlled] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  })

  const tabStopValue = React.useMemo(() => {
    return getTabStopValue(values, getDisabled, currentValue)
  }, [values, getDisabled, currentValue])

  // Uncontrolled: if no initial value, pick the first enabled tab once triggers register.
  React.useEffect(() => {
    if (isControlled) return
    if (!values.length) return
    if (!currentValue && tabStopValue) setCurrentValue(tabStopValue)
  }, [isControlled, values, currentValue, tabStopValue, setCurrentValue])

  const registerTrigger = React.useCallback((tabValue, ref, disabled) => {
    triggers.current.set(tabValue, { ref, disabled: Boolean(disabled) })
    setValues((prev) => (prev.includes(tabValue) ? prev : [...prev, tabValue]))
    return () => {
      triggers.current.delete(tabValue)
      setValues((prev) => prev.filter((v) => v !== tabValue))
    }
  }, [])

  const updateTriggerDisabled = React.useCallback((tabValue, disabled) => {
    const entry = triggers.current.get(tabValue)
    if (!entry) return
    triggers.current.set(tabValue, { ...entry, disabled: Boolean(disabled) })
  }, [])

  const focusTrigger = React.useCallback((tabValue) => {
    const entry = triggers.current.get(tabValue)
    const node = entry?.ref?.current
    if (node && typeof node.focus === "function") node.focus()
  }, [])

  const ctx = React.useMemo(
    () => ({
      baseId,
      orientation,
      variant,
      value: tabStopValue,
      setValue: setCurrentValue,
      values,
      getDisabled,
      registerTrigger,
      updateTriggerDisabled,
      focusTrigger,
    }),
    [
      baseId,
      orientation,
      variant,
      tabStopValue,
      setCurrentValue,
      values,
      getDisabled,
      registerTrigger,
      updateTriggerDisabled,
      focusTrigger,
    ]
  )

  return (
    <TabsContext.Provider value={ctx}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        data-variant={variant}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, children, ...props }) {
  const { isDark } = useTheme()
  const { orientation, variant } = useTabsContext("TabsList")

  const isVertical = orientation === "vertical"
  const isPills = variant === "pills"
  const isUnderline = variant === "underline"

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      data-slot="tabs-list"
      data-orientation={orientation}
      data-variant={variant}
      className={cn(
        "flex",
        // Pills variant: horizontal scroll, no container background
        isPills && [
          "flex-row items-center gap-2 overflow-x-auto scrollbar-hide pb-1",
        ],
        // Underline variant: border bottom instead of container
        isUnderline && [
          "flex-row items-center gap-0 border-b-2 overflow-x-auto scrollbar-hide",
          isDark ? "border-[#2A3F36]" : "border-[#E5E7EB]",
        ],
        // Default variant: container with background
        !isPills && !isUnderline && [
          "gap-1 rounded-xl p-1 border",
          isVertical
            ? "flex-col items-stretch w-fit min-w-[200px]"
            : "flex-row items-center w-full overflow-x-auto scrollbar-hide",
          isDark ? "bg-[#1A2420] border-[#2A3F36]" : "bg-[#F3F4F6] border-[#C8E6C9]",
        ],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({
  value,
  disabled = false,
  icon,
  badge,
  className,
  children,
  ...props
}) {
  const { isDark } = useTheme()
  const {
    baseId,
    orientation,
    variant,
    value: activeValue,
    setValue,
    values,
    getDisabled,
    registerTrigger,
    updateTriggerDisabled,
    focusTrigger,
  } = useTabsContext("TabsTrigger")

  const ref = React.useRef(null)
  const isActive = activeValue === value
  const isVertical = orientation === "vertical"
  const isPills = variant === "pills"
  const isUnderline = variant === "underline"

  React.useEffect(() => registerTrigger(value, ref, disabled), [registerTrigger, value, disabled])
  React.useEffect(() => updateTriggerDisabled(value, disabled), [updateTriggerDisabled, value, disabled])

  const tabId = `${baseId}-tab-${value}`
  const panelId = `${baseId}-panel-${value}`

  const onKeyDown = (e) => {
    if (disabled) return

    const isHorizontal = orientation === "horizontal"
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp"
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown"

    if (e.key === prevKey || e.key === nextKey) {
      e.preventDefault()
      const dir = e.key === nextKey ? 1 : -1
      const nextValue = getNextEnabledValue(values, getDisabled, value, dir)
      if (!nextValue) return
      setValue(nextValue)
      window.requestAnimationFrame(() => focusTrigger(nextValue))
      return
    }

    if (e.key === "Home") {
      e.preventDefault()
      const first = values.find((v) => !getDisabled(v))
      if (!first) return
      setValue(first)
      window.requestAnimationFrame(() => focusTrigger(first))
      return
    }

    if (e.key === "End") {
      e.preventDefault()
      const last = [...values].reverse().find((v) => !getDisabled(v))
      if (!last) return
      setValue(last)
      window.requestAnimationFrame(() => focusTrigger(last))
      return
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setValue(value)
    }
  }

  // Pills variant styling
  const pillsStyles = isPills
    ? cn(
        "px-4 py-2 min-h-[36px] rounded-full text-sm font-medium border",
        "transition-all duration-200",
        isActive
          ? cn(
              isDark
                ? "bg-[#2ECC71] text-[#0D1F17] border-[#2ECC71]"
                : "bg-[#004225] text-white border-[#004225]"
            )
          : cn(
              isDark
                ? "bg-transparent text-[#6B8178] border-[#2A3F36] hover:border-[#2ECC71] hover:text-[#2ECC71]"
                : "bg-transparent text-[#6B7280] border-[#D1D5DB] hover:border-[#004225] hover:text-[#004225]"
            )
      )
    : null

  // Underline variant styling
  const underlineStyles = isUnderline
    ? cn(
        "flex-1 px-4 py-3 min-h-[44px] rounded-none text-sm font-medium text-center",
        "border-b-2 -mb-[2px]", // Overlap with TabsList border
        "transition-all duration-200",
        isActive
          ? cn(
              isDark
                ? "text-[#2ECC71] border-[#2ECC71]"
                : "text-[#004225] border-[#004225]"
            )
          : cn(
              "border-transparent",
              isDark
                ? "text-[#6B8178] hover:text-[#2ECC71] hover:border-[#2ECC71]/50"
                : "text-[#6B7280] hover:text-[#004225] hover:border-[#004225]/50"
            )
      )
    : null

  // Default variant styling
  const defaultStyles =
    !isPills && !isUnderline
      ? cn(
          "px-3 py-2 md:px-5 md:py-3 min-h-[44px] rounded-lg text-sm font-medium",
          isVertical ? "justify-start w-full text-left" : "justify-center flex-1 text-center",
          isActive
            ? cn(
                "shadow-[0_1px_3px_rgba(0,0,0,0.1)]",
                isDark ? "bg-[rgba(46,204,113,0.15)] text-[#2ECC71]" : "bg-[#D4EDDA] text-[#004225]"
              )
            : cn(
                "bg-transparent",
                isDark ? "text-[#6B8178]" : "text-[#6B7280]",
                !disabled ? (isDark ? "hover:bg-[rgba(46,204,113,0.08)]" : "hover:bg-[rgba(0,66,37,0.05)]") : ""
              )
        )
      : null

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isActive}
      aria-controls={panelId}
      aria-disabled={disabled ? true : undefined}
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      data-slot="tabs-trigger"
      data-orientation={orientation}
      data-variant={variant}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => {
        if (!disabled) setValue(value)
      }}
      onKeyDown={onKeyDown}
      className={cn(
        // Base specs
        "relative flex items-center justify-center gap-2",
        "border-none bg-transparent shrink-0",
        "transition-all duration-200 ease-in-out",
        // Focus (a11y)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isDark ? "focus-visible:ring-[#2ECC71] focus-visible:ring-offset-[#1A2420]" : "focus-visible:ring-[#004225] focus-visible:ring-offset-[#F3F4F6]",
        // Disabled specs
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer",
        // Variant-specific styles
        pillsStyles,
        underlineStyles,
        defaultStyles,
        className
      )}
      {...props}
    >
      {/* Vertical indicator for default variant */}
      {!isPills && !isUnderline && isVertical && isActive ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%]",
            isDark ? "bg-[#2ECC71]" : "bg-[#004225]",
            "rounded-r-sm"
          )}
        />
      ) : null}

      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}

      <span className="truncate">{children}</span>

      {badge !== undefined && badge !== null ? (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-[10px]",
            "text-xs font-semibold",
            isPills && isActive
              ? (isDark ? "bg-[#0D1F17] text-[#2ECC71]" : "bg-white/20 text-white")
              : "bg-primary text-primary-foreground"
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function TabsContent({ value, forceMount = false, className, children, ...props }) {
  const { baseId, value: activeValue } = useTabsContext("TabsContent")
  const isActive = activeValue === value
  const reduced = prefersReducedMotion()

  const tabId = `${baseId}-tab-${value}`
  const panelId = `${baseId}-panel-${value}`

  if (!forceMount && !isActive) return null

  return (
    <motion.div
      key={value}
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      hidden={!isActive}
      data-slot="tabs-content"
      data-state={isActive ? "active" : "inactive"}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }


