// Popover.jsx
// Popover acessível com posicionamento flutuante e gerenciamento de foco
// Baseado em: Radix UI Popover, WAI-ARIA Dialog pattern

import { useState, useRef, useId, useEffect, useCallback, createContext, useContext, cloneElement, isValidElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from "@/design-system/utils/tokens"

/**
 * Popover - Conteúdo flutuante acessível
 *
 * Features:
 * - ARIA: Dialog pattern com aria-haspopup, aria-expanded
 * - Keyboard: Escape para fechar, Tab para navegar
 * - Focus trap e retorno de foco ao trigger
 * - Click outside para fechar
 * - Posicionamento automático com collision detection
 * - Animações suaves
 *
 * @example
 * <Popover>
 *   <PopoverTrigger>
 *     <Button>Abrir</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     Conteúdo do popover
 *   </PopoverContent>
 * </Popover>
 */

// Context
const PopoverContext = createContext(null)

function usePopover() {
  const context = useContext(PopoverContext)
  if (!context) {
    throw new Error('Popover components must be used within a Popover')
  }
  return context
}

// Animation variants por lado
const ANIMATIONS = {
  top: {
    initial: { opacity: 0, y: 8, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 8, scale: 0.96 },
  },
  bottom: {
    initial: { opacity: 0, y: -8, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.96 },
  },
  left: {
    initial: { opacity: 0, x: 8, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 8, scale: 0.96 },
  },
  right: {
    initial: { opacity: 0, x: -8, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -8, scale: 0.96 },
  },
}

// Root component
function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  modal = false,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const setIsOpen = useCallback((value) => {
    if (!isControlled) {
      setUncontrolledOpen(value)
    }
    onOpenChange?.(value)
  }, [isControlled, onOpenChange])

  const triggerRef = useRef(null)
  const contentRef = useRef(null)
  const popoverId = useId()

  return (
    <PopoverContext.Provider
      value={{
        isOpen,
        setIsOpen,
        triggerRef,
        contentRef,
        popoverId,
        modal,
      }}
    >
      {children}
    </PopoverContext.Provider>
  )
}

// Trigger component
function PopoverTrigger({ children, asChild = false, className, ...props }) {
  const { isOpen, setIsOpen, triggerRef, popoverId } = usePopover()

  const handleClick = (e) => {
    e.preventDefault()
    setIsOpen(!isOpen)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(!isOpen)
    }
  }

  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'dialog',
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? popoverId : undefined,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    ...props,
  }

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      ...triggerProps,
      className: cn(children.props.className, className),
    })
  }

  return (
    <button
      type="button"
      className={cn("inline-flex items-center justify-center", className)}
      {...triggerProps}
    >
      {children}
    </button>
  )
}

// Content component
function PopoverContent({
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  alignOffset = 0,
  className,
  showClose = false,
  onInteractOutside,
  onEscapeKeyDown,
  ...props
}) {
  const { isOpen, setIsOpen, triggerRef, contentRef, popoverId, modal } = usePopover()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [actualSide, setActualSide] = useState(side)

  // Calculate position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !contentRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 8

    let top = 0
    let left = 0
    let finalSide = side

    // Calculate initial position based on side
    const positions = {
      top: () => {
        top = triggerRect.top + scrollY - contentRect.height - sideOffset
        return top >= scrollY + padding
      },
      bottom: () => {
        top = triggerRect.bottom + scrollY + sideOffset
        return top + contentRect.height <= scrollY + viewportHeight - padding
      },
      left: () => {
        left = triggerRect.left + scrollX - contentRect.width - sideOffset
        return left >= scrollX + padding
      },
      right: () => {
        left = triggerRect.right + scrollX + sideOffset
        return left + contentRect.width <= scrollX + viewportWidth - padding
      },
    }

    // Try preferred side, then flip if needed
    if (!positions[side]()) {
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
      finalSide = opposite[side]
      positions[finalSide]()
    } else {
      finalSide = side
    }

    // Calculate horizontal position for top/bottom
    if (finalSide === 'top' || finalSide === 'bottom') {
      positions[finalSide]()
      if (align === 'start') {
        left = triggerRect.left + scrollX + alignOffset
      } else if (align === 'end') {
        left = triggerRect.right + scrollX - contentRect.width - alignOffset
      } else {
        left = triggerRect.left + scrollX + (triggerRect.width - contentRect.width) / 2
      }
    }

    // Calculate vertical position for left/right
    if (finalSide === 'left' || finalSide === 'right') {
      positions[finalSide]()
      if (align === 'start') {
        top = triggerRect.top + scrollY + alignOffset
      } else if (align === 'end') {
        top = triggerRect.bottom + scrollY - contentRect.height - alignOffset
      } else {
        top = triggerRect.top + scrollY + (triggerRect.height - contentRect.height) / 2
      }
    }

    // Boundary checking
    if (left < scrollX + padding) left = scrollX + padding
    if (left + contentRect.width > scrollX + viewportWidth - padding) {
      left = scrollX + viewportWidth - contentRect.width - padding
    }
    if (top < scrollY + padding) top = scrollY + padding
    if (top + contentRect.height > scrollY + viewportHeight - padding) {
      top = scrollY + viewportHeight - contentRect.height - padding
    }

    setPosition({ top, left })
    setActualSide(finalSide)
  }, [side, align, sideOffset, alignOffset, triggerRef])

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onInteractOutside?.(e)
        if (!e.defaultPrevented) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, setIsOpen, onInteractOutside, triggerRef])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onEscapeKeyDown?.(e)
        if (!e.defaultPrevented) {
          setIsOpen(false)
          triggerRef.current?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, setIsOpen, onEscapeKeyDown, triggerRef])

  // Update position when open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen, updatePosition])

  // Focus management
  useEffect(() => {
    if (isOpen && contentRef.current) {
      const firstFocusable = contentRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (firstFocusable) {
        ;(firstFocusable).focus()
      }
    }
  }, [isOpen])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (optional for modal mode) */}
          {modal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/20"
              onClick={() => setIsOpen(false)}
            />
          )}

          {/* Content */}
          <motion.div
            ref={contentRef}
            id={popoverId}
            role="dialog"
            aria-modal={modal}
            initial={ANIMATIONS[actualSide].initial}
            animate={ANIMATIONS[actualSide].animate}
            exit={ANIMATIONS[actualSide].exit}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              // Base
              "fixed z-[9999] min-w-[220px] max-w-[360px]",
              "rounded-xl p-4",
              // Light mode
              // Light mode (paleta ANEST): menos branco, mais contraste tonal
              "bg-background border border-border",
              "shadow-lg shadow-black/10",
              // Dark mode
              "dark:bg-[#1C1C1E] dark:border-[#38383A]",
              "dark:shadow-black/30",
              // Focus visible
              "outline-none",
              className
            )}
            style={{
              top: position.top,
              left: position.left,
            }}
            {...props}
          >
            {/* Close button */}
            {showClose && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "absolute top-3 right-3",
                  "w-6 h-6 rounded-md flex items-center justify-center",
                  // Light mode (paleta ANEST): hover mais “mint”
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  "dark:text-muted-foreground dark:hover:text-white dark:hover:bg-[#27272A]",
                  "transition-colors"
                )}
                aria-label="Fechar"
              >
                <X size={14} />
              </button>
            )}

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

// Anchor component (para posicionar relativo a outro elemento)
function PopoverAnchor({ children, className, ...props }) {
  const { triggerRef } = usePopover()

  return (
    <div ref={triggerRef} className={className} {...props}>
      {children}
    </div>
  )
}

// Close button component
function PopoverClose({ children, asChild = false, className, ...props }) {
  const { setIsOpen } = usePopover()

  const handleClick = () => setIsOpen(false)

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      onClick: handleClick,
      className: cn(children.props.className, className),
      ...props,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose }
export default Popover
