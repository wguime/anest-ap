/**
 * useModalA11y — focus trap + ESC handler + focus restore para modais
 * que não usam o DS Modal (createPortal manual).
 *
 * Sprint 7 (audit issue #9): adicionado para fechar gap em
 * NewVersionModal + AddResponsibleModal sem migrar para o DS Modal
 * (que tem layout diferente — minimiza diff visual).
 *
 * Uso:
 *   const containerRef = useRef(null)
 *   useModalA11y({ containerRef, onClose, isOpen: true })
 *   return <div ref={containerRef} role="dialog">...</div>
 */
import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null
  )
}

export function useModalA11y({ containerRef, onClose, isOpen = true, initialFocusRef }) {
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    // 1. Salva o elemento focado antes de abrir o modal
    previousFocusRef.current = document.activeElement

    // 2. Move o foco para o initialFocusRef se fornecido, senão para o
    //    primeiro focável dentro do modal (ou o próprio container)
    const setInitialFocus = () => {
      const target = initialFocusRef?.current
      if (target && typeof target.focus === 'function') {
        target.focus()
        return
      }
      const focusables = getFocusable(containerRef.current)
      if (focusables.length > 0) {
        focusables[0].focus()
      } else if (containerRef.current) {
        containerRef.current.setAttribute('tabindex', '-1')
        containerRef.current.focus()
      }
    }
    // microtask para aguardar render
    const timer = setTimeout(setInitialFocus, 0)

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab') {
        const focusables = getFocusable(containerRef.current)
        if (focusables.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey) {
          if (active === first || !containerRef.current?.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (active === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKey)
      // 3. Restaura foco
      const prev = previousFocusRef.current
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus() } catch (_) { /* noop */ }
      }
    }
  }, [isOpen, containerRef, onClose, initialFocusRef])
}

export default useModalA11y
