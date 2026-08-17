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
      // `keywords` = termos que NÃO aparecem no rótulo mas devem achar a opção
      // (ex.: apelidos de escala). Mantém a lista limpa sem perder a busca.
      return options.filter((opt) =>
        `${opt.label} ${opt.keywords || ""}`.toLowerCase().includes(q)
      )
    }, [searchable, searchQuery, options])

    // Reset search and focus input when dropdown opens/closes
    React.useEffect(() => {
      if (isOpen && searchable) {
        setSearchQuery("")
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }, [isOpen, searchable])

    // Compute dropdown position relative to trigger (síncrono — useLayoutEffect
    // garante que o setState seja flushado antes do paint, evitando o "pulo" do
    // dropdown entre a posição stale e a posição calculada)
    const computePosition = React.useCallback(() => {
      const triggerEl = containerRef.current
      if (!triggerEl) return

      const rect = triggerEl.getBoundingClientRect()
      const viewportH = window.innerHeight
      const viewportW = window.innerWidth
      const triggerWidth = rect.width
      const spaceBelow = viewportH - rect.bottom
      const spaceAbove = rect.top

      // Prefer below, but flip to above if not enough space
      const searchBarHeight = 0 // a busca agora fica no gatilho, não no menu
      const dropdownHeight = Math.min(240 + searchBarHeight, options.length * 48 + 8 + searchBarHeight)
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      let top = showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4

      // Width = triggerWidth (native select behavior); labels longos quebram
      // dentro do item via text-wrap. Nunca deixar o dropdown "flutuar" com
      // largura diferente do trigger — isso desancora visualmente o flyout.
      const pad = 8
      const width = Math.min(triggerWidth, viewportW - pad * 2)

      // Alinhar borda esquerda do dropdown à borda esquerda do trigger
      let left = rect.left
      if (left < pad) left = pad
      if (left + width > viewportW - pad) left = viewportW - width - pad

      top = Math.max(pad, Math.min(top, viewportH - dropdownHeight - pad))

      setDropdownPos((prev) => {
        // Bail out se nada mudou — evita re-renders quando parent recria
        // o array de options a cada render
        if (prev.top === top && prev.left === left && prev.width === width) {
          return prev
        }
        return { top, left, width }
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
        // e.target pode ser document/window (scroll de página), que não são
        // Node — guardar antes de chamar contains() para não estourar.
        const target = e.target instanceof Node ? e.target : null
        // Ignora scroll dentro do próprio dropdown
        if (target && dropdownRef.current?.contains(target)) return
        // Não fechar quando o scroll é induzido pelo teclado virtual ao focar a
        // busca do próprio dropdown (mobile): o foco está dentro do dropdown.
        // Sem isso, tocar no campo de busca abre o teclado → viewport rola →
        // o dropdown fecha antes de o usuário conseguir digitar.
        // Teclado virtual rola o viewport ao focar a busca — fechar aqui
        // matava a digitação no celular. Com a busca no GATILHO (16/08), o
        // input não está mais dentro do dropdown: checar os dois.
        if (searchable && (
          dropdownRef.current?.contains(document.activeElement)
          || (searchInputRef.current && searchInputRef.current === document.activeElement)
        )) return
        // Fecha o dropdown em qualquer scroll externo (UX nativa mobile —
        // tentar reposicionar durante scroll rápido sempre deixa o dropdown
        // visualmente "atrás" do trigger por causa de RAF/render delay)
        setIsOpen(false)
      }
      window.addEventListener("resize", onResize)
      window.addEventListener("scroll", onScroll, true)

      // ResizeObserver no trigger — captura resize quando, por exemplo, o
      // próprio trigger muda de tamanho (raro mas possível com layout interno)
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
    }, [isOpen, computePosition, searchable])

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

    // Scroll para item focado — só rola o listbox interno (não usa
    // scrollIntoView para evitar que o browser role a página quando o dropdown
    // está portalizado no document.body com position: fixed)
    React.useEffect(() => {
      if (!isOpen || !listboxRef.current || focusedIndex < 0) return
      const listbox = listboxRef.current
      const items = listbox.querySelectorAll('[role="option"]')
      const item = items[focusedIndex]
      if (!item) return

      // Usa bounding rects para evitar dependência de offsetParent
      const listboxRect = listbox.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()
      const delta = itemRect.top - listboxRect.top

      if (delta < 0) {
        listbox.scrollTop += delta
      } else if (itemRect.bottom > listboxRect.bottom) {
        listbox.scrollTop += itemRect.bottom - listboxRect.bottom
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
          {/* BUSCA NO PRÓPRIO GATILHO (dono 16/08): antes o campo ficava dentro
              do menu, abaixo — no celular era preciso um SEGUNDO toque para
              digitar. Aberto, o gatilho vira o input e o teclado sobe no mesmo
              gesto que abriu a lista. */}
          {searchable && isOpen ? (
            <>
            <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setFocusedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              placeholder={selectedOption ? selectedOption.label : placeholder}
              aria-label={placeholder || 'Buscar'}
              className={cn(
                "flex-1 min-w-0 bg-transparent outline-none border-0 p-0",
                "text-foreground placeholder:text-muted-foreground"
              )}
              style={{ fontSize: 'inherit' }}
            />
            </>
          ) : (
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
          )}

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
              {/* A BUSCA VIVE NO GATILHO desde 16/08 (dono): o campo aqui
                  dentro obrigava um segundo toque no celular para digitar. */}

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
                      <span className="flex-1 min-w-0 break-words">{option.label}</span>
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

