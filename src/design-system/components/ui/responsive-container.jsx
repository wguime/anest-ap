// ANEST Design System - ResponsiveContainer Component
// Container que se adapta automaticamente ao viewport

import * as React from "react"
import { cn } from "@/design-system/utils/tokens"
import { useBreakpoint } from "../../hooks/useMediaQuery"

/**
 * Container responsivo que ajusta padding e max-width por breakpoint
 */
export function ResponsiveContainer({
  children,
  className,
  as: Component = "div",
  maxWidth = true, // Se deve limitar largura máxima
  safeArea = false, // Se deve aplicar safe area padding
  centered = true, // Se deve centralizar
  ...props
}) {
  // Garante re-render em mudanças de breakpoint (útil para SSR/hydration e futuras features)
  useBreakpoint()

  return (
    <Component
      className={cn(
        "w-full",
        // Padding horizontal responsivo (xs base)
        "px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-12",
        // Max width (tokens: 720 / 960 / 1200)
        maxWidth && "lg:max-w-[720px] xl:max-w-[960px] 2xl:max-w-[1200px]",
        // Centralizar
        centered && "mx-auto",
        // Safe area (classes globais em index.css)
        safeArea && "safe-area-x",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

/**
 * Grid responsivo que ajusta colunas automaticamente
 */
export function ResponsiveGrid({
  children,
  className,
  cols = { xs: 1, sm: 2, lg: 3, xl: 4 },
  gap = { xs: "12px", sm: "16px", lg: "20px", xl: "24px" },
  ...props
}) {
  const { breakpoint } = useBreakpoint()

  const getValueForBreakpoint = (values) => {
    if (!values || typeof values !== "object") return values
    const order = ["2xl", "xl", "lg", "md", "sm", "xs"]
    const currentIndex = order.indexOf(breakpoint)

    for (let i = currentIndex; i < order.length; i++) {
      if (values[order[i]] !== undefined) return values[order[i]]
    }
    return values.xs ?? Object.values(values)[0]
  }

  const currentCols = getValueForBreakpoint(cols)
  const currentGap = getValueForBreakpoint(gap)

  return (
    <div
      className={cn("grid", className)}
      style={{
        gridTemplateColumns: `repeat(${currentCols}, minmax(0, 1fr))`,
        gap: currentGap,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Stack que muda de column para row em breakpoints maiores
 */
export function ResponsiveStack({
  children,
  className,
  direction = { xs: "column", md: "row" },
  gap = { xs: "12px", md: "16px" },
  align = "stretch",
  justify = "flex-start",
  wrap = false,
  ...props
}) {
  const { breakpoint } = useBreakpoint()

  const getValueForBreakpoint = (values) => {
    if (!values || typeof values !== "object") return values
    const order = ["2xl", "xl", "lg", "md", "sm", "xs"]
    const currentIndex = order.indexOf(breakpoint)

    for (let i = currentIndex; i < order.length; i++) {
      if (values[order[i]] !== undefined) return values[order[i]]
    }
    return Object.values(values)[0]
  }

  const currentDirection = getValueForBreakpoint(direction)
  const currentGap = getValueForBreakpoint(gap)

  return (
    <div
      className={cn("flex", wrap && "flex-wrap", className)}
      style={{
        flexDirection: currentDirection,
        gap: currentGap,
        alignItems: align,
        justifyContent: justify,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Componente que mostra/esconde baseado no breakpoint
 */
export function ShowAt({ children, breakpoints = [] }) {
  const { breakpoint } = useBreakpoint()
  if (!breakpoints.includes(breakpoint)) return null
  return <>{children}</>
}

/**
 * Componente que esconde baseado no breakpoint
 */
export function HideAt({ children, breakpoints = [] }) {
  const { breakpoint } = useBreakpoint()
  if (breakpoints.includes(breakpoint)) return null
  return <>{children}</>
}

/**
 * Atalhos para mostrar em mobile/tablet/desktop
 */
export function MobileOnly({ children }) {
  return <ShowAt breakpoints={["xs", "sm"]}>{children}</ShowAt>
}

export function TabletOnly({ children }) {
  return <ShowAt breakpoints={["md", "lg"]}>{children}</ShowAt>
}

export function DesktopOnly({ children }) {
  return <ShowAt breakpoints={["xl", "2xl"]}>{children}</ShowAt>
}

export function MobileAndTablet({ children }) {
  return <ShowAt breakpoints={["xs", "sm", "md", "lg"]}>{children}</ShowAt>
}

export function TabletAndDesktop({ children }) {
  return <ShowAt breakpoints={["md", "lg", "xl", "2xl"]}>{children}</ShowAt>
}

export default ResponsiveContainer


