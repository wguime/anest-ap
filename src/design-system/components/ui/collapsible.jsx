// Collapsible.jsx
// Componente colapsável simples com animação
// Baseado em: Radix UI Collapsible

import { useState, createContext, useContext, useId, cloneElement, isValidElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * Collapsible - Componente simples de show/hide
 *
 * Diferente do Accordion:
 * - Não tem estrutura de múltiplos itens
 * - Mais simples, para uso único
 * - Trigger pode ser qualquer elemento
 *
 * @example
 * <Collapsible>
 *   <CollapsibleTrigger>
 *     <Button>Toggle</Button>
 *   </CollapsibleTrigger>
 *   <CollapsibleContent>
 *     Conteúdo colapsável
 *   </CollapsibleContent>
 * </Collapsible>
 */

// Context
const CollapsibleContext = createContext(null)

function useCollapsible() {
  const context = useContext(CollapsibleContext)
  if (!context) {
    throw new Error('Collapsible components must be used within a Collapsible')
  }
  return context
}

// Root component
function Collapsible({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  disabled = false,
  className,
  ...props
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const setIsOpen = (value) => {
    if (disabled) return
    if (!isControlled) {
      setUncontrolledOpen(value)
    }
    onOpenChange?.(value)
  }

  const toggle = () => setIsOpen(!isOpen)

  const contentId = useId()

  return (
    <CollapsibleContext.Provider
      value={{ isOpen, setIsOpen, toggle, disabled, contentId }}
    >
      <div
        data-slot="collapsible"
        data-state={isOpen ? 'open' : 'closed'}
        data-disabled={disabled || undefined}
        className={cn(disabled && "opacity-50", className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

// Trigger component
function CollapsibleTrigger({
  children,
  asChild = false,
  className,
  ...props
}) {
  const { isOpen, toggle, disabled, contentId } = useCollapsible()

  const triggerProps = {
    'aria-expanded': isOpen,
    'aria-controls': contentId,
    disabled,
    onClick: (e) => {
      e.preventDefault()
      toggle()
    },
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
      className={cn(
        "inline-flex items-center justify-center",
        disabled && "pointer-events-none",
        className
      )}
      {...triggerProps}
    >
      {children}
    </button>
  )
}

// Content component
function CollapsibleContent({
  children,
  className,
  forceMount = false,
  ...props
}) {
  const { isOpen, contentId } = useCollapsible()

  return (
    <AnimatePresence initial={false}>
      {(forceMount || isOpen) && (
        <motion.div
          id={contentId}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isOpen ? 'auto' : 0,
            opacity: isOpen ? 1 : 0,
          }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.2 },
          }}
          className={cn("overflow-hidden", className)}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
export default Collapsible
