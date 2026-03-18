// ANEST Design System - Select Component
// Dropdown customizado com suporte a light/dark mode e animações

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Check, Search } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

// ============================================================================
// SIZE VARIANTS
// ============================================================================

const SIZES = {
  sm: {
    padding: "12px 14px",
    fontSize: "14px",
    iconSize: 16,
  },
  md: {
    padding: "16px 18px",
    fontSize: "15px",
    iconSize: 20,
  },
  lg: {
    padding: "20px 22px",
    fontSize: "16px",
    iconSize: 24,
  },
}

// ============================================================================
// SELECT COMPONENT
// ============================================================================

const Select = React.forwardRef(
  (
    {
      options = [],
      value,
      onChange,
      placeholder = "Selecione...",
      label,
      error,
      disabled = false,
      searchable = false,
      size = "md",
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
    const listboxRef = React.useRef(null)
    const dropdownRef = React.useRef(null)
    const searchInputRef = React.useRef(null)

    // Portal state for dropdown positioning (fixes modal overflow clipping)
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

    const sizeStyles = SIZES[size] || SIZES.md
    const hasError = typeof error === "string" && error.trim().length > 0

    // Encontra a opção selecionada
    const selectedOption = options.find((opt) => opt.value === value)

    // Filtered options for searchable mode
    const filteredOptions = React.useMemo(() => {
      if (!searchable || !searchQuery.trim()) return options
      const q = searchQuery.toLowerCase().trim()
      return options.filter((opt) => opt.label.toLowerCase().includes(q))
    }, [searchable, searchQuery, options])

    // Reset search and focus input when dropdown opens/closes
    React.useEffect(() => {
      if (isOpen && searchable) {
        setSearchQuery("")
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }, [isOpen, searchable])

    // Compute dropdown position relative to trigger
    const computePosition = React.useCallback(() => {
      const triggerEl = containerRef.current
      if (!triggerEl) return
      
      // Aguardar um tick para garantir que o elemento está renderizado
      requestAnimationFrame(() => {
        const rect = triggerEl.getBoundingClientRect()
        const viewportH = window.innerHeight
        const viewportW = window.innerWidth
        const triggerWidth = rect.width
        const spaceBelow = viewportH - rect.bottom
        const spaceAbove = rect.top

        // Prefer below, but flip to above if not enough space
        const searchBarHeight = searchable ? 48 : 0
        const dropdownHeight = Math.min(240 + searchBarHeight, options.length * 48 + 8 + searchBarHeight) // Estimate dropdown height
        const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

        let top = showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4

        // Compute dropdown width: at least trigger width, grow to fit labels, cap at viewport
        const pad = 8
        const maxLabelLen = options.reduce((max, o) => Math.max(max, (o.label || '').length), 0)
        const desiredWidth = Math.max(triggerWidth, Math.min(maxLabelLen * 10 + 48, 400))
        const width = Math.min(desiredWidth, viewportW - pad * 2)

        // Anchor right edge of dropdown to right edge of trigger
        let left = rect.right - width
        if (left < pad) left = pad
        if (left + width > viewportW - pad) left = viewportW - width - pad

        top = Math.max(pad, Math.min(top, viewportH - dropdownHeight - pad))

        setDropdownPos({ top, left, width })
      })
    }, [options.length])

    // Recompute position on open and when window scrolls/resizes
    React.useLayoutEffect(() => {
      if (!isOpen) return
      computePosition()
    }, [isOpen, computePosition])

    React.useEffect(() => {
      if (!isOpen) return
      const onResize = () => computePosition()
      const onScroll = (e) => {
        // Ignore scroll events from inside the dropdown itself
        if (dropdownRef.current?.contains(e.target)) return
        // For inner container scrolls (e.g. modal body), reposition instead of closing
        const triggerEl = containerRef.current
        if (triggerEl) {
          const rect = triggerEl.getBoundingClientRect()
          if (rect.bottom < 0 || rect.top > window.innerHeight) {
            setIsOpen(false)
            return
          }
        }
        computePosition()
      }
      window.addEventListener("resize", onResize)
      window.addEventListener("scroll", onScroll, true)
      return () => {
        window.removeEventListener("resize", onResize)
        window.removeEventListener("scroll", onScroll, true)
      }
    }, [isOpen, computePosition])

    // Handlers
    const handleToggle = (e) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (!disabled) {
        setIsOpen((prev) => {
          const next = !prev
          if (next) {
            // Focus no item selecionado ao abrir
            const idx = options.findIndex((opt) => opt.value === value)
            setFocusedIndex(idx >= 0 ? idx : 0)
          }
          return next
        })
      }
    }

    const handleSelect = (optionValue) => {
      onChange?.(optionValue)
      setIsOpen(false)
    }

    const handleKeyDown = (e) => {
      if (disabled) return
      e.stopPropagation()

      const activeOptions = searchable ? filteredOptions : options

      switch (e.key) {
        case "Enter":
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            const opt = activeOptions[focusedIndex]
            if (opt && !opt.disabled) {
              handleSelect(opt.value)
            }
          } else {
            setIsOpen(true)
          }
          break
        case " ":
          if (searchable && isOpen) break // allow space in search input
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            const opt = activeOptions[focusedIndex]
            if (opt && !opt.disabled) {
              handleSelect(opt.value)
            }
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
              return next < activeOptions.length ? next : 0
            })
          }
          break
        case "ArrowUp":
          e.preventDefault()
          if (isOpen) {
            setFocusedIndex((prev) => {
              const next = prev - 1
              return next >= 0 ? next : activeOptions.length - 1
            })
          }
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          break
        case "Tab":
          setIsOpen(false)
          break
        default:
          break
      }
    }

    // Click outside para fechar (accounting for portal-rendered dropdown)
    React.useEffect(() => {
      if (!isOpen) return

      const handleClickOutside = (e) => {
        const target = e.target
        // Check if click is inside trigger container
        if (containerRef.current?.contains(target)) return
        // Check if click is inside portal dropdown
        if (dropdownRef.current?.contains(target)) return
        // Otherwise, close
        setIsOpen(false)
      }

      // Delay adding listener to prevent immediate close
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside)
      }, 100)

      return () => {
        clearTimeout(timer)
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [isOpen])

    // Scroll para item focado
    React.useEffect(() => {
      if (isOpen && listboxRef.current && focusedIndex >= 0) {
        const items = listboxRef.current.querySelectorAll('[role="option"]')
        items[focusedIndex]?.scrollIntoView({ block: "nearest" })
      }
    }, [focusedIndex, isOpen])

    return (
      <div
        ref={containerRef}
        data-slot="select-field"
        className={cn("grid gap-1.5 relative", className)}
        {...props}
      >
        {/* Label */}
        {label && (
          <label
            id={labelId}
            data-slot="select-label"
            className={cn(
              "text-sm font-semibold",
              "text-primary"
            )}
          >
            {label}
          </label>
        )}

        {/* Select Button */}
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
            "w-full flex items-center justify-between gap-2 overflow-hidden",
            "min-h-[44px]", // Touch target mínimo
            "rounded-[16px] border-2 transition-all duration-200",
            "text-left outline-none cursor-pointer",
            // Background - destaque quando selecionado
            selectedOption
              ? "bg-background dark:bg-card"
              : "bg-card dark:bg-card",
            // Border states - destaque quando selecionado
            hasError
              ? "border-destructive dark:border-destructive"
              : selectedOption
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
          style={{
            padding: sizeStyles.padding,
            fontSize: sizeStyles.fontSize,
            pointerEvents: disabled ? 'none' : 'auto',
          }}
        >
          <span
            className={cn(
              "flex-1 min-w-0 truncate",
              selectedOption
                ? "text-primary font-medium"
                : "text-muted-foreground"
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          {/* Checkmark quando selecionado, Chevron quando não */}
          {selectedOption ? (
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Check size={14} className="text-white dark:text-primary-foreground" />
            </div>
          ) : (
            <motion.span
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 text-muted-foreground"
            >
              <ChevronDown size={sizeStyles.iconSize} />
            </motion.span>
          )}
        </button>

        {/* Dropdown via Portal (fixes modal overflow clipping) */}
        {isOpen && portalTarget && createPortal(
            <div
              ref={dropdownRef}
              className="bg-card border-2 border-border rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]"
              style={{
                position: "fixed",
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                width: `${dropdownPos.width}px`,
                zIndex: 9999,
                overflow: 'hidden',
                maxHeight: '340px',
              }}
            >
              {/* Search input */}
              {searchable && (
                <div className="px-3 pt-3 pb-2 border-b border-border">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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

              <motion.ul
                ref={listboxRef}
                role="listbox"
                id={listboxId}
                aria-labelledby={labelId}
                className="max-h-[240px] overflow-y-auto py-1"
                initial="hidden"
                animate="visible"
                variants={prefersReducedMotion() ? undefined : {
                  hidden: { opacity: 1 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
                  },
                }}
              >
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === value
                  const isFocused = index === focusedIndex
                  const isDisabled = option.disabled

                  return (
                    <motion.li
                      key={option.value}
                      role="option"
                      variants={!prefersReducedMotion() && index < 15 ? {
                        hidden: { opacity: 0, y: 4 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.15 } },
                      } : undefined}
                      aria-selected={isSelected}
                      aria-disabled={isDisabled}
                      onClick={() => !isDisabled && handleSelect(option.value)}
                      onMouseEnter={() => !isDisabled && setFocusedIndex(index)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                        "text-[15px]",
                        isDisabled && "opacity-50 cursor-not-allowed",
                        isFocused && !isDisabled && "bg-background dark:bg-muted",
                        isSelected
                          ? "text-primary font-semibold"
                          : "text-black dark:text-white"
                      )}
                    >
                      <span className="flex-1">{option.label}</span>
                      {isSelected && (
                        <Check
                          size={16}
                          className="shrink-0 text-primary"
                        />
                      )}
                    </motion.li>
                  )
                })}

                {filteredOptions.length === 0 && (
                  <li className="px-4 py-3 text-muted-foreground text-center">
                    {searchable && searchQuery ? "Nenhum resultado encontrado" : "Nenhuma opcao disponivel"}
                  </li>
                )}
              </motion.ul>
            </div>,
            portalTarget
          )
        }

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="select-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = "Select"

export { Select }

