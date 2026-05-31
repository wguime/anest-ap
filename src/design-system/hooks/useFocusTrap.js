import { useEffect, useRef } from "react"

const FOCUSABLE_SELECTORS = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",")

function getFocusableElements(container) {
  if (!container) return []
  const nodes = container.querySelectorAll(FOCUSABLE_SELECTORS)
  return Array.from(nodes).filter((el) => {
    const style = window.getComputedStyle(el)
    return style.visibility !== "hidden" && style.display !== "none"
  })
}

export function useFocusTrap({
  active,
  containerRef,
  onEscape,
  lockScroll = true,
  returnFocus = true,
  initialFocus = "first",
} = {}) {
  const previouslyFocusedRef = useRef(null)

  // Mantém o onEscape mais recente sem incluí-lo nas deps do efeito principal.
  // Se onEscape entrasse nas deps, o efeito re-rodaria a cada render do modal
  // (callbacks inline tipo `() => onClose()` mudam de identidade toda vez),
  // e o requestAnimationFrame abaixo roubaria o foco do input ativo a cada
  // tecla digitada — fechando o teclado no mobile. Ver auditoria 2026-05-31.
  const onEscapeRef = useRef(onEscape)
  useEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return
    if (typeof document === "undefined") return

    previouslyFocusedRef.current = document.activeElement

    let prevOverflow = ""
    if (lockScroll) {
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }

    const raf = window.requestAnimationFrame(() => {
      const el = containerRef.current
      if (!el) return
      if (initialFocus === "container") {
        if (typeof el.focus === "function") el.focus()
        return
      }
      const focusables = getFocusableElements(el)
      const target = focusables[0] ?? el
      if (target && typeof target.focus === "function") target.focus()
    })

    const onKeyDown = (e) => {
      if (e.key === "Escape" && onEscapeRef.current) {
        e.stopPropagation()
        onEscapeRef.current(e)
        return
      }
      if (e.key !== "Tab") return

      const el = containerRef.current
      if (!el) return
      const focusables = getFocusableElements(el)
      if (focusables.length === 0) {
        e.preventDefault()
        if (typeof el.focus === "function") el.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement

      if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown, true)

    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener("keydown", onKeyDown, true)
      if (lockScroll) {
        document.body.style.overflow = prevOverflow
      }
      if (returnFocus) {
        const prev = previouslyFocusedRef.current
        if (prev && typeof prev.focus === "function") prev.focus()
      }
      previouslyFocusedRef.current = null
    }
  }, [active, containerRef, lockScroll, returnFocus, initialFocus])
}
