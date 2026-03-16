// ANEST Design System - Select Component
// Dropdown customizado com suporte a light/dark mode e animações

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Check } from "lucide-react"
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
      size = "md",
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [focusedIndex, setFocusedIndex] = React.useState(-1)
    const containerRef = React.useRef(null)
    const listboxRef = React.useRef(null)
    const dropdownRef = React.useRef(null)

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

    // Compute dropdown position relative to trigger
    const computePosition = React.useCallback(() => {
      const triggerEl = containerRef.current
      if (!triggerEl) return
      
      // Aguardar um tick para garantir que o elemento está renderizado
      requestAnimationFrame(() => {
        const rect = triggerEl.getBoundingClientRect()
        const viewportH = window.innerHeight
        const viewportW = window.innerWidth
        const width = rect.width
        const spaceBelow = viewportH - rect.bottom
        const spaceAbove = rect.top

        // Prefer below, but flip to above if not enough space
        const dropdownHeight = Math.min(240, options.length * 48 + 8) // Estimate dropdown height
        const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

        let top = showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4
        let left = rect.left

        // Clamp into viewport (prevents dropdown rendering off-screen)
        const pad = 8
        top = Math.max(pad, Math.min(top, viewportH - dropdownHeight - pad))
        left = Math.max(pad, Math.min(left, viewportW - width - pad))

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

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            const opt = options[focusedIndex]
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
              return next < options.length ? next : 0
            })
          }
          break
        case "ArrowUp":
          e.preventDefault()
          if (isOpen) {
            setFocusedIndex((prev) => {
              const next = prev - 1
              return next >= 0 ? next : options.length - 1
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
              "text-[#004225] dark:text-[#2ECC71]"
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
              ? "bg-[#F0FFF4] dark:bg-[#1A2E24]"
              : "bg-card dark:bg-[#1A2420]",
            // Border states - destaque quando selecionado
            hasError
              ? "border-[#DC2626] dark:border-[#E74C3C]"
              : selectedOption
              ? "border-[#006837] dark:border-[#2ECC71]"
              : isOpen
              ? "border-[#006837] dark:border-[#2ECC71] ring-2 ring-[#006837]/20 dark:ring-[#2ECC71]/20"
              : "border-[#C8E6C9] dark:border-[#2A3F36]",
            // Focus
            "focus:border-[#006837] dark:focus:border-[#2ECC71]",
            "focus:ring-2 focus:ring-[#006837]/20 dark:focus:ring-[#2ECC71]/20",
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
                ? "text-[#004225] dark:text-[#2ECC71] font-medium"
                : "text-[#9CA3AF] dark:text-[#6B8178]"
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          {/* Checkmark quando selecionado, Chevron quando não */}
          {selectedOption ? (
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#006837] dark:bg-[#2ECC71] flex items-center justify-center">
              <Check size={14} className="text-white dark:text-[#0D1F17]" />
            </div>
          ) : (
            <motion.span
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 text-[#9CA3AF] dark:text-[#6B8178]"
            >
              <ChevronDown size={sizeStyles.iconSize} />
            </motion.span>
          )}
        </button>

        {/* Dropdown via Portal (fixes modal overflow clipping) */}
        {isOpen && portalTarget && createPortal(
            <div
              ref={dropdownRef}
              className="bg-card border-2 border-[#A5D6A7] dark:border-[#2A3F36] rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]"
              style={{
                position: "fixed",
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                width: `${dropdownPos.width}px`,
                zIndex: 9999,
                overflow: 'hidden',
                maxHeight: '300px',
              }}
            >
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
                {options.map((option, index) => {
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
                        isFocused && !isDisabled && "bg-[#F0FFF4] dark:bg-[#243530]",
                        isSelected
                          ? "text-[#004225] dark:text-[#2ECC71] font-semibold"
                          : "text-black dark:text-white"
                      )}
                    >
                      <span className="flex-1">{option.label}</span>
                      {isSelected && (
                        <Check
                          size={16}
                          className="shrink-0 text-[#006837] dark:text-[#2ECC71]"
                        />
                      )}
                    </motion.li>
                  )
                })}

                {options.length === 0 && (
                  <li className="px-4 py-3 text-[#9CA3AF] dark:text-[#6B8178] text-center">
                    Nenhuma opção disponível
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
            className="text-sm text-[#DC2626] dark:text-[#E74C3C]"
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

