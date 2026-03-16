// ANEST Design System - useMediaQuery Hook
// Detecta media queries, breakpoints e tipo de dispositivo

import { useCallback, useEffect, useMemo, useState } from "react"

// Breakpoints do Design System (em px)
const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 640,
  lg: 768,
  xl: 1024,
  "2xl": 1440,
}

const BREAKPOINT_ORDER = ["xs", "sm", "md", "lg", "xl", "2xl"]

function getMqList(query) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }
  return window.matchMedia(query)
}

/**
 * Hook para detectar media queries
 * @param {string} query - Media query CSS (ex: "(min-width: 768px)")
 * @returns {boolean} - Se a query corresponde
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = getMqList(query)
    if (!mql) return

    // Inicial
    setMatches(mql.matches)

    const handler = (event) => setMatches(Boolean(event?.matches))

    // Modern browsers
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler)
      return () => mql.removeEventListener("change", handler)
    }

    // Safari / legacy
    if (typeof mql.addListener === "function") {
      mql.addListener(handler)
      return () => mql.removeListener(handler)
    }
  }, [query])

  return matches
}

/**
 * Hook para detectar breakpoint atual
 * @returns {Object} - { breakpoint, isMobile, isTablet, isDesktop, ... }
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState("xs")

  // Breakpoints individuais (faixas)
  const isXs = useMediaQuery("(max-width: 479px)")
  const isSm = useMediaQuery("(min-width: 480px) and (max-width: 639px)")
  const isMd = useMediaQuery("(min-width: 640px) and (max-width: 767px)")
  const isLg = useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
  const isXl = useMediaQuery("(min-width: 1024px) and (max-width: 1439px)")
  const is2xl = useMediaQuery("(min-width: 1440px)")

  // Orientação / device capabilities
  const isPortrait = useMediaQuery("(orientation: portrait)")
  const isLandscape = useMediaQuery("(orientation: landscape)")
  const isTouchDevice = useMediaQuery("(hover: none) and (pointer: coarse)")

  // Preferências do usuário
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)")

  useEffect(() => {
    if (is2xl) setBreakpoint("2xl")
    else if (isXl) setBreakpoint("xl")
    else if (isLg) setBreakpoint("lg")
    else if (isMd) setBreakpoint("md")
    else if (isSm) setBreakpoint("sm")
    else setBreakpoint("xs")
  }, [isSm, isMd, isLg, isXl, is2xl])

  const isAtLeast = useCallback(
    (bp) => {
      const currentIndex = BREAKPOINT_ORDER.indexOf(breakpoint)
      const targetIndex = BREAKPOINT_ORDER.indexOf(bp)
      if (targetIndex === -1) return false
      return currentIndex >= targetIndex
    },
    [breakpoint]
  )

  const isAtMost = useCallback(
    (bp) => {
      const currentIndex = BREAKPOINT_ORDER.indexOf(breakpoint)
      const targetIndex = BREAKPOINT_ORDER.indexOf(bp)
      if (targetIndex === -1) return false
      return currentIndex <= targetIndex
    },
    [breakpoint]
  )

  return useMemo(
    () => ({
      breakpoint,

      // Breakpoints individuais
      isXs,
      isSm,
      isMd,
      isLg,
      isXl,
      is2xl,

      // Categorias de dispositivo
      isMobile: isXs || isSm, // < 640px
      isTablet: isMd || isLg, // 640px - 1023px
      isDesktop: isXl || is2xl, // >= 1024px

      // Orientação
      isPortrait,
      isLandscape,

      // Touch device
      isTouchDevice,

      // Preferências
      prefersReducedMotion,
      prefersDarkMode,

      // Helpers
      isAtLeast,
      isAtMost,
    }),
    [
      breakpoint,
      isXs,
      isSm,
      isMd,
      isLg,
      isXl,
      is2xl,
      isPortrait,
      isLandscape,
      isTouchDevice,
      prefersReducedMotion,
      prefersDarkMode,
      isAtLeast,
      isAtMost,
    ]
  )
}

function parsePx(value) {
  if (!value || typeof value !== "string") return 0
  const n = Number.parseFloat(value.replace("px", "").trim())
  return Number.isFinite(n) ? n : 0
}

function getCssVarPx(name) {
  if (typeof window === "undefined" || typeof document === "undefined") return 0
  const v = window.getComputedStyle(document.documentElement).getPropertyValue(name)
  return parsePx(v)
}

/**
 * Hook para detectar se é dispositivo iOS e se há safe-area
 * @returns {Object} - { isIOS, isIPad, isIPhone, hasSafeArea, hasNotch, hasDynamicIsland }
 */
export function useIOSDevice() {
  const [deviceInfo, setDeviceInfo] = useState({
    isIOS: false,
    isIPad: false,
    isIPhone: false,
    hasSafeArea: false,
    hasNotch: false,
    hasDynamicIsland: false,
  })

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return

    const compute = () => {
      const ua = navigator.userAgent ?? ""
      const platform = navigator.platform ?? ""

      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        // iPadOS 13+ (iPad reports as Mac)
        (platform === "MacIntel" && navigator.maxTouchPoints > 1)
      const isIPad =
        /iPad/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)
      const isIPhone = /iPhone/.test(ua)

      const supportsEnv =
        typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        (CSS.supports("padding-top: env(safe-area-inset-top)") ||
          CSS.supports("padding-top: constant(safe-area-inset-top)"))

      const safeAreaTop = getCssVarPx("--safe-area-top")
      const safeAreaBottom = getCssVarPx("--safe-area-bottom")
      const safeAreaLeft = getCssVarPx("--safe-area-left")
      const safeAreaRight = getCssVarPx("--safe-area-right")

      const hasSafeArea =
        supportsEnv &&
        (safeAreaTop > 0 || safeAreaBottom > 0 || safeAreaLeft > 0 || safeAreaRight > 0)

      const hasNotch = safeAreaTop >= 44
      const hasDynamicIsland = safeAreaTop >= 59

      setDeviceInfo({
        isIOS,
        isIPad,
        isIPhone,
        hasSafeArea,
        hasNotch,
        hasDynamicIsland,
      })
    }

    compute()
    window.addEventListener("resize", compute)
    window.addEventListener("orientationchange", compute)
    return () => {
      window.removeEventListener("resize", compute)
      window.removeEventListener("orientationchange", compute)
    }
  }, [])

  return deviceInfo
}

export default useMediaQuery


