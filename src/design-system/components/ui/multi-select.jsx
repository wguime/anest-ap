// ANEST Design System - MultiSelect Component
// Dropdown multi-seleção com busca, tags removíveis e suporte a avatars

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, Search, X, ChevronDown, Users } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

// ============================================================================
// MULTI SELECT COMPONENT
// ============================================================================

const MultiSelect = React.forwardRef(
  (
    {
      options = [],
      value = [],
      onChange,
      placeholder = "Selecione...",
      label,
      error,
      disabled = false,
      searchable = true,
      maxSelected,
      groupBy,
      renderOption,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [focusedIndex, setFocusedIndex] = React.useState(-1)
    const [searchQuery, setSearchQuery] = React.useState("")
    const containerRef = React.useRef(null)
    const dropdownRef = React.useRef(null)
    const listboxRef = React.useRef(null)
    const searchInputRef = React.useRef(null)

    // Portal target
    const [portalTarget] = React.useState(() => {
      if (typeof document === "undefined") return null
      return document.body
    })
    const [dropdownPos, setDropdownPos] = React.useState({ top: 0, left: 0, width: 200 })

    const autoId = React.useId()
    const selectId = id ?? autoId
    const labelId = label ? `${selectId}-label` : undefined
    const errorId = error ? `${selectId}-error` : undefined
    const listboxId = `${selectId}-listbox`

    const hasError = typeof error === "string" && error.trim().length > 0
    const selectedValues = new Set(value)
    const isMaxReached = maxSelected != null && value.length >= maxSelected

    // ========================================================================
    // FILTERED + GROUPED OPTIONS
    // ========================================================================

    const filteredOptions = React.useMemo(() => {
      let opts = options
      if (searchable && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        opts = opts.filter(
          (opt) =>
            opt.label.toLowerCase().includes(q) ||
            (opt.description && opt.description.toLowerCase().includes(q))
        )
      }
      return opts
    }, [options, searchable, searchQuery])

    const groupedOptions = React.useMemo(() => {
      if (!groupBy) return null
      const groups = new Map()
      for (const opt of filteredOptions) {
        const key = groupBy(opt) || "Outros"
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(opt)
      }
      return groups
    }, [filteredOptions, groupBy])

    // Flat list for keyboard navigation (keeps group order)
    const flatOptions = React.useMemo(() => {
      if (!groupedOptions) return filteredOptions
      const flat = []
      for (const [, opts] of groupedOptions) {
        flat.push(...opts)
      }
      return flat
    }, [filteredOptions, groupedOptions])

    // ========================================================================
    // POSITION COMPUTATION (same pattern as Select)
    // ========================================================================

    const computePosition = React.useCallback(() => {
      const triggerEl = containerRef.current
      if (!triggerEl) return

      const rect = triggerEl.getBoundingClientRect()
      const viewportH = window.innerHeight
      const viewportW = window.innerWidth
      const triggerWidth = rect.width
      const spaceBelow = viewportH - rect.bottom
      const spaceAbove = rect.top

      const searchBarHeight = searchable ? 56 : 0
      const actionsHeight = 44
      const dropdownHeight = Math.min(
        320 + searchBarHeight + actionsHeight,
        flatOptions.length * 52 + 8 + searchBarHeight + actionsHeight
      )
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      let top = showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4

      const pad = 8
      const width = Math.min(triggerWidth, viewportW - pad * 2)
      let left = rect.left
      if (left < pad) left = pad
      if (left + width > viewportW - pad) left = viewportW - width - pad
      top = Math.max(pad, Math.min(top, viewportH - dropdownHeight - pad))

      setDropdownPos((prev) => {
        if (prev.top === top && prev.left === left && prev.width === width) return prev
        return { top, left, width }
      })
    }, [flatOptions.length, searchable])

    React.useLayoutEffect(() => {
      if (!isOpen) return
      computePosition()
    }, [isOpen, computePosition])

    React.useEffect(() => {
      if (!isOpen) return
      const onResize = () => computePosition()
      const onScroll = (e) => {
        if (dropdownRef.current?.contains(e.target)) return
        setIsOpen(false)
      }
      window.addEventListener("resize", onResize)
      window.addEventListener("scroll", onScroll, true)

      let ro = null
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        ro = new ResizeObserver(() => computePosition())
        ro.observe(containerRef.current)
      }

      return () => {
        window.removeEventListener("resize", onResize)
        window.removeEventListener("scroll", onScroll, true)
        ro?.disconnect()
      }
    }, [isOpen, computePosition])

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleToggle = (e) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (!disabled) {
        setIsOpen((prev) => {
          const next = !prev
          if (next) {
            setFocusedIndex(0)
            setSearchQuery("")
          }
          return next
        })
      }
    }

    const handleSelect = (optionValue) => {
      const isSelected = selectedValues.has(optionValue)
      let next
      if (isSelected) {
        next = value.filter((v) => v !== optionValue)
      } else {
        if (isMaxReached) return
        next = [...value, optionValue]
      }
      onChange?.(next)
    }

    const handleRemove = (optionValue, e) => {
      e?.stopPropagation()
      onChange?.(value.filter((v) => v !== optionValue))
    }

    const handleSelectAll = () => {
      const allValues = filteredOptions.map((o) => o.value)
      if (maxSelected != null) {
        onChange?.(allValues.slice(0, maxSelected))
      } else {
        onChange?.(allValues)
      }
    }

    const handleClear = () => {
      onChange?.([])
    }

    // Focus search on open
    React.useEffect(() => {
      if (isOpen && searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }, [isOpen, searchable])

    // ========================================================================
    // KEYBOARD NAVIGATION
    // ========================================================================

    const handleKeyDown = (e) => {
      if (disabled) return
      e.stopPropagation()

      switch (e.key) {
        case "Enter":
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            const opt = flatOptions[focusedIndex]
            if (opt) handleSelect(opt.value)
          } else {
            setIsOpen(true)
          }
          break
        case " ":
          if (searchable && isOpen) break
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            const opt = flatOptions[focusedIndex]
            if (opt) handleSelect(opt.value)
          } else {
            setIsOpen(true)
          }
          break
        case "ArrowDown":
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          } else {
            setFocusedIndex((prev) => {
              const next = prev + 1
              return next < flatOptions.length ? next : 0
            })
          }
          break
        case "ArrowUp":
          e.preventDefault()
          if (isOpen) {
            setFocusedIndex((prev) => {
              const next = prev - 1
              return next >= 0 ? next : flatOptions.length - 1
            })
          }
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          break
        case "Backspace":
          if (isOpen && searchable && searchQuery) break
          if (value.length > 0) {
            onChange?.(value.slice(0, -1))
          }
          break
        case "Tab":
          setIsOpen(false)
          break
        default:
          break
      }
    }

    // ========================================================================
    // CLICK OUTSIDE
    // ========================================================================

    React.useEffect(() => {
      if (!isOpen) return

      const handleClickOutside = (e) => {
        const target = e.target
        if (containerRef.current?.contains(target)) return
        if (dropdownRef.current?.contains(target)) return
        setIsOpen(false)
      }

      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside)
      }, 100)

      return () => {
        clearTimeout(timer)
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [isOpen])

    // Scroll focused item into view
    React.useEffect(() => {
      if (!isOpen || !listboxRef.current || focusedIndex < 0) return
      const listbox = listboxRef.current
      const items = listbox.querySelectorAll('[role="option"]')
      const item = items[focusedIndex]
      if (!item) return

      const listboxRect = listbox.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()
      const delta = itemRect.top - listboxRect.top

      if (delta < 0) {
        listbox.scrollTop += delta
      } else if (itemRect.bottom > listboxRect.bottom) {
        listbox.scrollTop += itemRect.bottom - listboxRect.bottom
      }
    }, [focusedIndex, isOpen])

    // ========================================================================
    // SELECTED LABELS for chips
    // ========================================================================

    const selectedOptions = React.useMemo(() => {
      const optMap = new Map(options.map((o) => [o.value, o]))
      return value.map((v) => optMap.get(v)).filter(Boolean)
    }, [options, value])

    // ========================================================================
    // RENDER OPTION
    // ========================================================================

    const renderOptionContent = (option, isSelected, isFocused) => {
      if (renderOption) {
        return renderOption(option, { isSelected, isFocused })
      }

      return (
        <>
          {/* Checkbox indicator */}
          <span
            className={cn(
              "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-[6px]",
              "border-2 transition-all duration-200",
              isSelected
                ? "bg-primary border-transparent"
                : "bg-transparent border-border"
            )}
            aria-hidden="true"
          >
            {isSelected && (
              <Check size={12} strokeWidth={3} className="text-white dark:text-primary-foreground" />
            )}
          </span>

          {/* Avatar */}
          {option.avatar && (
            <img
              src={option.avatar}
              alt=""
              className="shrink-0 w-8 h-8 rounded-full object-cover"
            />
          )}

          {/* Label + Description */}
          <span className="flex-1 min-w-0">
            <span className="block truncate text-[15px] font-medium">
              {option.label}
            </span>
            {option.description && (
              <span className="block truncate text-[13px] text-muted-foreground">
                {option.description}
              </span>
            )}
          </span>

          {/* Badge */}
          {option.badge && (
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-[10px] bg-muted text-muted-foreground">
              {option.badge}
            </span>
          )}
        </>
      )
    }

    // ========================================================================
    // RENDER OPTIONS LIST (flat or grouped)
    // ========================================================================

    const renderOptions = () => {
      if (flatOptions.length === 0) {
        return (
          <li className="px-4 py-3 text-muted-foreground text-center text-[15px]">
            {searchable && searchQuery
              ? "Nenhum resultado encontrado"
              : "Nenhuma opção disponível"}
          </li>
        )
      }

      if (groupedOptions) {
        let globalIndex = 0
        const groups = []

        for (const [groupLabel, opts] of groupedOptions) {
          groups.push(
            <li
              key={`group-${groupLabel}`}
              className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              role="presentation"
            >
              {groupLabel}
            </li>
          )

          for (const option of opts) {
            const idx = globalIndex++
            const isSelected = selectedValues.has(option.value)
            const isFocused = idx === focusedIndex
            const isDisabledOption = !isSelected && isMaxReached

            groups.push(
              <motion.li
                key={option.value}
                role="option"
                variants={
                  !prefersReducedMotion() && idx < 15
                    ? {
                        hidden: { opacity: 0, y: 4 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.15 } },
                      }
                    : undefined
                }
                aria-selected={isSelected}
                aria-disabled={isDisabledOption}
                onClick={() => !isDisabledOption && handleSelect(option.value)}
                onMouseEnter={() => !isDisabledOption && setFocusedIndex(idx)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                  isDisabledOption && "opacity-40 cursor-not-allowed",
                  isFocused && !isDisabledOption && "bg-background dark:bg-muted",
                  isSelected
                    ? "text-primary"
                    : "text-black dark:text-white"
                )}
              >
                {renderOptionContent(option, isSelected, isFocused)}
              </motion.li>
            )
          }
        }

        return groups
      }

      // Flat list
      return flatOptions.map((option, index) => {
        const isSelected = selectedValues.has(option.value)
        const isFocused = index === focusedIndex
        const isDisabledOption = !isSelected && isMaxReached

        return (
          <motion.li
            key={option.value}
            role="option"
            variants={
              !prefersReducedMotion() && index < 15
                ? {
                    hidden: { opacity: 0, y: 4 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.15 } },
                  }
                : undefined
            }
            aria-selected={isSelected}
            aria-disabled={isDisabledOption}
            onClick={() => !isDisabledOption && handleSelect(option.value)}
            onMouseEnter={() => !isDisabledOption && setFocusedIndex(index)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
              isDisabledOption && "opacity-40 cursor-not-allowed",
              isFocused && !isDisabledOption && "bg-background dark:bg-muted",
              isSelected
                ? "text-primary"
                : "text-black dark:text-white"
            )}
          >
            {renderOptionContent(option, isSelected, isFocused)}
          </motion.li>
        )
      })
    }

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
      <div
        ref={containerRef}
        data-slot="multi-select-field"
        className={cn("grid gap-1.5 relative", className)}
        {...props}
      >
        {/* Label */}
        {label && (
          <label
            id={labelId}
            data-slot="multi-select-label"
            className={cn(
              "text-sm font-semibold",
              "text-primary"
            )}
          >
            {label}
          </label>
        )}

        {/* Trigger Button */}
        <button
          ref={ref}
          type="button"
          id={selectId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-labelledby={labelId}
          aria-describedby={hasError ? errorId : undefined}
          aria-invalid={hasError ? true : undefined}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full flex flex-wrap items-center gap-2",
            "min-h-[44px]",
            "rounded-[16px] border-2 transition-all duration-200",
            "text-left outline-none cursor-pointer",
            "py-2.5 px-[14px]",
            // Background
            "bg-card dark:bg-card",
            // Border states
            hasError
              ? "border-destructive dark:border-destructive"
              : value.length > 0
              ? "border-primary"
              : isOpen
              ? "border-primary ring-2 ring-primary/20 dark:ring-primary/20"
              : "border-border",
            // Focus
            "focus:border-primary dark:focus:border-primary",
            "focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/20",
            // Disabled
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Selected chips */}
          {selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className={cn(
                "inline-flex items-center gap-1 max-w-[200px]",
                "rounded-[10px] px-2.5 py-1",
                "text-[13px] font-semibold leading-none",
                "bg-primary/10 text-primary",
                "dark:bg-primary/20 dark:text-primary"
              )}
            >
              {opt.avatar && (
                <img
                  src={opt.avatar}
                  alt=""
                  className="shrink-0 w-4 h-4 rounded-full object-cover"
                />
              )}
              <span className="truncate">{opt.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(opt.value, e)}
                  aria-label={`Remover ${opt.label}`}
                  className={cn(
                    "shrink-0 ml-0.5 p-0.5 rounded-full transition-colors",
                    "hover:bg-primary/20 dark:hover:bg-primary/30",
                    "focus:outline-none focus:ring-1 focus:ring-primary/40"
                  )}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}

          {/* Placeholder / count */}
          {value.length === 0 && (
            <span className="flex-1 min-w-0 text-[15px] text-muted-foreground truncate">
              {placeholder}
            </span>
          )}

          {/* Spacer + Chevron */}
          <span className="flex-1 min-w-0" />
          <span className="shrink-0 flex items-center gap-1.5">
            {value.length > 0 && (
              <span className="text-[13px] font-semibold text-primary tabular-nums">
                {value.length}
              </span>
            )}
            <motion.span
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground"
            >
              <ChevronDown size={20} />
            </motion.span>
          </span>
        </button>

        {/* Dropdown via Portal */}
        {isOpen && portalTarget && createPortal(
          <div
            ref={dropdownRef}
            className={cn(
              "bg-card border-2 border-border rounded-2xl",
              "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]"
            )}
            style={{
              position: "fixed",
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              zIndex: 9999,
              overflow: "hidden",
              maxHeight: "400px",
            }}
          >
            {/* Search input */}
            {searchable && (
              <div className="px-3 pt-3 pb-2 border-b border-border">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setFocusedIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar..."
                    aria-label="Buscar opções"
                    className={cn(
                      "w-full pl-9 pr-3 py-2 text-sm rounded-xl border",
                      "border-border",
                      "bg-background dark:bg-card",
                      "text-foreground",
                      "placeholder:text-muted-foreground dark:placeholder:text-muted-foreground",
                      "outline-none focus:border-primary dark:focus:border-primary"
                    )}
                  />
                </div>
              </div>
            )}

            {/* Select all / Clear actions */}
            {flatOptions.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isMaxReached && value.length < filteredOptions.length}
                  className={cn(
                    "text-[13px] font-semibold transition-colors",
                    "text-primary hover:text-foreground dark:hover:text-primary/80",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={value.length === 0}
                  className={cn(
                    "text-[13px] font-semibold transition-colors",
                    "text-primary hover:text-foreground dark:hover:text-primary/80",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  Limpar
                </button>
              </div>
            )}

            {/* Options list */}
            <motion.ul
              ref={listboxRef}
              role="listbox"
              id={listboxId}
              aria-labelledby={labelId}
              aria-multiselectable="true"
              className="max-h-[260px] overflow-y-auto py-1"
              initial="hidden"
              animate="visible"
              variants={
                prefersReducedMotion()
                  ? undefined
                  : {
                      hidden: { opacity: 1 },
                      visible: {
                        opacity: 1,
                        transition: { staggerChildren: 0.03, delayChildren: 0.02 },
                      },
                    }
              }
            >
              {renderOptions()}
            </motion.ul>

            {/* Max selected hint */}
            {maxSelected != null && (
              <div className="px-4 py-2 border-t border-border text-center">
                <span className="text-[12px] text-muted-foreground">
                  {value.length}/{maxSelected} selecionados
                </span>
              </div>
            )}
          </div>,
          portalTarget
        )}

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="multi-select-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

MultiSelect.displayName = "MultiSelect"

export { MultiSelect }
