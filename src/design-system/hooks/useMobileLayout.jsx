// ANEST Design System - useMobileLayout Hook
// Detecta se deve usar layout mobile para tabelas e grids

import { useState, useEffect, useMemo } from "react"

/**
 * Breakpoints padrão para layouts mobile (em px)
 */
const DEFAULT_MOBILE_BREAKPOINT = 640 // sm breakpoint

/**
 * Hook para detectar se deve usar layout mobile
 * 
 * @param {Object} options - Opções de configuração
 * @param {number} options.breakpoint - Breakpoint em pixels (padrão: 640)
 * @param {string} options.layout - Layout preferido: 'auto' | 'scroll' | 'cards' | 'accordion'
 * @returns {Object} - { isMobile, shouldUseCards, currentLayout, windowWidth }
 * 
 * @example
 * const { isMobile, shouldUseCards } = useMobileLayout({ breakpoint: 768 })
 * 
 * @example
 * const { currentLayout } = useMobileLayout({ layout: 'cards' })
 */
export function useMobileLayout({
  breakpoint = DEFAULT_MOBILE_BREAKPOINT,
  layout = "auto",
} = {}) {
  const [windowWidth, setWindowWidth] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth
    }
    return 1024 // Default para SSR
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    // Atualizar no mount
    handleResize()

    // Throttle para performance
    let timeoutId = null
    const throttledResize = () => {
      if (timeoutId) return
      timeoutId = setTimeout(() => {
        handleResize()
        timeoutId = null
      }, 100)
    }

    window.addEventListener("resize", throttledResize)
    return () => {
      window.removeEventListener("resize", throttledResize)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const isMobile = windowWidth < breakpoint

  // Determinar layout baseado na configuração
  const currentLayout = useMemo(() => {
    // Se layout está fixo, usar ele
    if (layout !== "auto") {
      return layout
    }
    // Auto: usar cards no mobile, scroll no desktop
    return isMobile ? "cards" : "scroll"
  }, [layout, isMobile])

  const shouldUseCards = currentLayout === "cards"
  const shouldUseAccordion = currentLayout === "accordion"
  const shouldUseScroll = currentLayout === "scroll"

  return {
    isMobile,
    windowWidth,
    currentLayout,
    shouldUseCards,
    shouldUseAccordion,
    shouldUseScroll,
    breakpoint,
  }
}

/**
 * Hook para obter colunas visíveis baseado em prioridade
 * 
 * @param {Array} columns - Array de colunas com propriedade `priority`
 * @param {number} maxPriority - Prioridade máxima a mostrar (1 = mais importante)
 * @returns {Array} - Colunas filtradas por prioridade
 * 
 * @example
 * const columns = [
 *   { key: 'name', header: 'Nome', priority: 1 },
 *   { key: 'email', header: 'Email', priority: 2 },
 *   { key: 'role', header: 'Cargo', priority: 3 },
 * ]
 * const visibleColumns = usePriorityColumns(columns, 2) // Mostra name e email
 */
export function usePriorityColumns(columns, maxPriority = Infinity) {
  return useMemo(() => {
    if (!columns || !Array.isArray(columns)) return []
    
    return columns.filter((col) => {
      // Se não tem prioridade definida, sempre mostrar
      if (col.priority === undefined || col.priority === null) return true
      // Mostrar apenas se prioridade <= maxPriority
      return col.priority <= maxPriority
    })
  }, [columns, maxPriority])
}

export default useMobileLayout

