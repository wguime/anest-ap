// Accordion.jsx
// Accordion acessível com animações suaves
// Baseado em: Radix UI Accordion, WAI-ARIA Accordion pattern

import { useState, createContext, useContext, useId, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from "@/design-system/utils/tokens"

/**
 * Accordion - Seções colapsáveis acessíveis
 *
 * Features:
 * - ARIA: role, aria-expanded, aria-controls
 * - Keyboard: Enter/Space para toggle, setas para navegar
 * - Modo single (só uma aberta) ou multiple (várias abertas)
 * - Animações suaves de altura
 * - Light/Dark mode
 *
 * @example
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Seção 1</AccordionTrigger>
 *     <AccordionContent>Conteúdo da seção 1</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 */

// Contexts
const AccordionContext = createContext(null)
const AccordionItemContext = createContext(null)

function useAccordion() {
  const context = useContext(AccordionContext)
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion')
  }
  return context
}

function useAccordionItem() {
  const context = useContext(AccordionItemContext)
  if (!context) {
    throw new Error('AccordionItem components must be used within an AccordionItem')
  }
  return context
}

// Root component
function Accordion({
  children,
  type = 'single', // 'single' | 'multiple'
  collapsible = false, // permite fechar todos em modo single
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  ...props
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(() => {
    if (defaultValue) {
      return type === 'single' ? [defaultValue] : defaultValue
    }
    return []
  })

  const isControlled = controlledValue !== undefined
  const value = isControlled
    ? (type === 'single' ? [controlledValue] : controlledValue)
    : uncontrolledValue

  const toggleItem = useCallback((itemValue) => {
    let newValue

    if (type === 'single') {
      if (value.includes(itemValue)) {
        newValue = collapsible ? [] : value
      } else {
        newValue = [itemValue]
      }
    } else {
      if (value.includes(itemValue)) {
        newValue = value.filter(v => v !== itemValue)
      } else {
        newValue = [...value, itemValue]
      }
    }

    if (!isControlled) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(type === 'single' ? (newValue[0] || '') : newValue)
  }, [type, value, collapsible, isControlled, onValueChange])

  const isExpanded = useCallback((itemValue) => {
    return value.includes(itemValue)
  }, [value])

  return (
    <AccordionContext.Provider value={{ toggleItem, isExpanded, type }}>
      <div
        data-slot="accordion"
         // Light mode (paleta ANEST): divisores verdes claros
         className={cn("divide-y divide-[#C8E6C9] dark:divide-[#2A3F36]", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

// Item component
function AccordionItem({
  children,
  value,
  disabled = false,
  className,
  ...props
}) {
  const itemId = useId()
  const triggerId = `accordion-trigger-${itemId}`
  const contentId = `accordion-content-${itemId}`
  const { isExpanded } = useAccordion()
  const expanded = isExpanded(value)

  return (
    <AccordionItemContext.Provider
      value={{ value, disabled, triggerId, contentId, expanded }}
    >
      <div
        data-slot="accordion-item"
        data-state={expanded ? 'open' : 'closed'}
        data-disabled={disabled || undefined}
        className={cn(
          "group",
          "border-0",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

// Trigger component
function AccordionTrigger({
  children,
  className,
  showIcon = true,
  ...props
}) {
  const { toggleItem } = useAccordion()
  const { value, disabled, triggerId, contentId, expanded } = useAccordionItem()

  const handleClick = () => {
    if (!disabled) {
      toggleItem(value)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) {
        toggleItem(value)
      }
    }
  }

  return (
    <h3 className="flex">
      <button
        type="button"
        id={triggerId}
        aria-expanded={expanded}
        aria-controls={contentId}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base
          "flex flex-1 items-center justify-between",
          "py-4 text-left",
          "font-medium text-[15px]",
          // Colors
          "text-[#18181B] dark:text-white",
          // Hover (apenas em dispositivos com hover real; evita :hover “grudar” no mobile)
          "supports-[hover:hover]:hover:bg-[#F0FFF4] supports-[hover:hover]:dark:hover:bg-[#212D28]",
          // Estado aberto (mais contraste tonal no light)
          "group-data-[state=open]:bg-[#D4EDDA] dark:group-data-[state=open]:bg-[#212D28]",
          // Active (mantém o fundo estável ao tocar/clicar)
          "active:bg-transparent dark:active:bg-transparent",
          // Focus
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] focus-visible:ring-offset-2",
          "dark:focus-visible:ring-[#2ECC71]",
          // Transition
          "transition-colors",
          // Disabled
          disabled && "pointer-events-none",
          className
        )}
        {...props}
      >
        {children}

        {showIcon && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="ml-2 shrink-0"
          >
            <ChevronDown
              size={18}
              className="text-[#71717A] dark:text-[#A3B8B0]"
            />
          </motion.div>
        )}
      </button>
    </h3>
  )
}

// Content component
function AccordionContent({
  children,
  className,
  forceMount = false,
  ...props
}) {
  const { triggerId, contentId, expanded } = useAccordionItem()

  return (
    <AnimatePresence initial={false}>
      {(forceMount || expanded) && (
        <motion.div
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: expanded ? 'auto' : 0,
            opacity: expanded ? 1 : 0,
          }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.2 },
          }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              "pb-4 pt-0",
              "text-[14px] text-[#52525B] dark:text-[#A3B8B0]",
              "leading-relaxed",
              className
            )}
            {...props}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
export default Accordion
