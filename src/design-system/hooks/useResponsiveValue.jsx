// ANEST Design System - useResponsiveValue Hook
// Retorna valor baseado no breakpoint atual

import { useMemo } from "react"
import { useBreakpoint } from "./useMediaQuery"

/**
 * Hook para retornar valor baseado no breakpoint
 * @param {Object} values - Objeto com valores por breakpoint { xs, sm, md, lg, xl, 2xl }
 * @param {*} defaultValue - Valor padrão se nenhum breakpoint corresponder
 * @returns {*} - Valor correspondente ao breakpoint atual
 *
 * @example
 * const columns = useResponsiveValue({ xs: 1, sm: 2, lg: 3, xl: 4 }, 1);
 * const padding = useResponsiveValue({ xs: '16px', md: '24px', xl: '32px' });
 */
export function useResponsiveValue(values, defaultValue = null) {
  const { breakpoint } = useBreakpoint()

  return useMemo(() => {
    if (!values || typeof values !== "object") return defaultValue

    // Ordem de prioridade (do maior para menor)
    const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"]
    const currentIndex = breakpointOrder.indexOf(breakpoint)

    // Procura o valor mais próximo (igual ou menor)
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i]
      if (values[bp] !== undefined) return values[bp]
    }

    // Se não encontrou, procura o maior definido
    for (const bp of breakpointOrder) {
      if (values[bp] !== undefined) return values[bp]
    }

    return defaultValue
  }, [values, breakpoint, defaultValue])
}

/**
 * Hook para grid columns responsivo
 * @param {Object} overrides - Override de colunas por breakpoint
 * @returns {number} - Número de colunas
 */
export function useResponsiveColumns(overrides = {}) {
  const defaults = { xs: 1, sm: 2, md: 2, lg: 3, xl: 4, "2xl": 5 }
  return useResponsiveValue({ ...defaults, ...overrides }, 1)
}

/**
 * Hook para padding responsivo
 * @param {Object} overrides - Override de padding por breakpoint
 * @returns {string} - Valor do padding
 */
export function useResponsivePadding(overrides = {}) {
  const defaults = { xs: "16px", sm: "20px", md: "24px", lg: "32px", xl: "40px" }
  return useResponsiveValue({ ...defaults, ...overrides }, "16px")
}

export default useResponsiveValue


