// Tooltip.jsx
// Tooltip acessível com suporte a keyboard, ARIA e animações
// Baseado em: React Aria useTooltip, Radix UI patterns, WAI-ARIA tooltip role

import { useState, useRef, useId, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { cn } from "@/design-system/utils/tokens"

/**
 * Tooltip - Dica flutuante acessível
 *
 * Features:
 * - ARIA: role="tooltip", aria-describedby
 * - Keyboard: Mostra em focus, esconde com Escape
 * - Delay configurável para mostrar/esconder
 * - Posicionamento automático (top, bottom, left, right)
 * - Animações suaves com Framer Motion
 * - Light/Dark mode
 *
 * @example
 * <Tooltip content="Texto de ajuda">
 *   <Button>Hover me</Button>
 * </Tooltip>
 */

const POSITIONS = {
  top: {
    initial: { opacity: 0, y: 4, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 4, scale: 0.96 },
  },
  bottom: {
    initial: { opacity: 0, y: -4, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -4, scale: 0.96 },
  },
  left: {
    initial: { opacity: 0, x: 4, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 4, scale: 0.96 },
  },
  right: {
    initial: { opacity: 0, x: -4, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -4, scale: 0.96 },
  },
}

function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  delayShow = 300,
  delayHide = 100,
  disabled = false,
  className,
  contentClassName,
  asChild = false,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const showTimeoutRef = useRef(null)
  const hideTimeoutRef = useRef(null)
  const tooltipId = useId()

  // Calcular posição do tooltip
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    let top = 0
    let left = 0

    // Posição vertical
    switch (side) {
      case 'top':
        top = triggerRect.top + scrollY - tooltipRect.height - sideOffset
        break
      case 'bottom':
        top = triggerRect.bottom + scrollY + sideOffset
        break
      case 'left':
        top = triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2
        break
      case 'right':
        top = triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2
        break
    }

    // Posição horizontal
    switch (side) {
      case 'top':
      case 'bottom':
        if (align === 'start') {
          left = triggerRect.left + scrollX
        } else if (align === 'end') {
          left = triggerRect.right + scrollX - tooltipRect.width
        } else {
          left = triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2
        }
        break
      case 'left':
        left = triggerRect.left + scrollX - tooltipRect.width - sideOffset
        break
      case 'right':
        left = triggerRect.right + scrollX + sideOffset
        break
    }

    // Boundary checking (keep tooltip in viewport)
    const padding = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Horizontal bounds
    if (left < padding) left = padding
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding
    }

    // Vertical bounds
    if (top < scrollY + padding) top = scrollY + padding
    if (top + tooltipRect.height > scrollY + viewportHeight - padding) {
      top = scrollY + viewportHeight - tooltipRect.height - padding
    }

    setPosition({ top, left })
  }, [side, align, sideOffset])

  // Handlers
  const handleShow = useCallback(() => {
    if (disabled) return
    clearTimeout(hideTimeoutRef.current)
    showTimeoutRef.current = setTimeout(() => {
      setIsOpen(true)
    }, delayShow)
  }, [disabled, delayShow])

  const handleHide = useCallback(() => {
    clearTimeout(showTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, delayHide)
  }, [delayHide])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  // Update position when open
  useEffect(() => {
    if (isOpen) {
      // Delay to allow tooltip to render
      requestAnimationFrame(updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen, updatePosition])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      clearTimeout(showTimeoutRef.current)
      clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // Global escape handler
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!content) return children

  const triggerProps = {
    ref: triggerRef,
    'aria-describedby': isOpen ? tooltipId : undefined,
    onMouseEnter: handleShow,
    onMouseLeave: handleHide,
    onFocus: handleShow,
    onBlur: handleHide,
  }

  return (
    <>
      {/* Trigger */}
      {asChild ? (
        <span {...triggerProps} className="inline-flex">
          {children}
        </span>
      ) : (
        <span {...triggerProps} className="inline-flex">
          {children}
        </span>
      )}

      {/* Tooltip Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              initial={POSITIONS[side].initial}
              animate={POSITIONS[side].animate}
              exit={POSITIONS[side].exit}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                // Base
                "fixed z-[9999] pointer-events-none",
                "px-3 py-1.5 rounded-lg",
                "text-[13px] font-medium leading-tight",
                "max-w-[280px]",
                // Light mode
                "bg-[#18181B] text-white",
                // Dark mode
                "dark:bg-[#FAFAFA] dark:text-[#18181B]",
                // Shadow
                "shadow-lg",
                contentClassName
              )}
              style={{
                top: position.top,
                left: position.left,
              }}
              {...props}
            >
              {content}

              {/* Arrow (optional visual indicator) */}
              <div
                className={cn(
                  "absolute w-2 h-2 rotate-45",
                  "bg-[#18181B] dark:bg-[#FAFAFA]",
                  side === 'top' && "bottom-[-4px] left-1/2 -translate-x-1/2",
                  side === 'bottom' && "top-[-4px] left-1/2 -translate-x-1/2",
                  side === 'left' && "right-[-4px] top-1/2 -translate-y-1/2",
                  side === 'right' && "left-[-4px] top-1/2 -translate-y-1/2"
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

/**
 * TooltipProvider - Context provider para configurações globais de tooltip
 * (Opcional, para projetos maiores)
 */
function TooltipProvider({ children, delayShow = 300, delayHide = 100 }) {
  return children
}

export { Tooltip, TooltipProvider }
export default Tooltip
