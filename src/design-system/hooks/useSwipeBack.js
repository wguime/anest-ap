import { useRef, useEffect } from 'react'
import { useMotionValue, animate } from 'framer-motion'
import { prefersReducedMotion } from '@/design-system/utils/motion'

const EDGE_WIDTH = 30
const THRESHOLD = 0.35
const VELOCITY_THRESHOLD = 500

function isInsideScrollableOrDrag(target) {
  let el = target
  while (el && el !== document.body) {
    if (el.hasAttribute('data-no-swipe-back')) return true
    if (el.getAttribute('draggable') === 'true') return true
    const style = window.getComputedStyle(el)
    if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
      if (el.scrollWidth > el.clientWidth) return true
    }
    el = el.parentElement
  }
  return false
}

export function useSwipeBack(goBack, { enabled = true } = {}) {
  const x = useMotionValue(0)
  const containerRef = useRef(null)
  const goBackRef = useRef(goBack)
  const enabledRef = useRef(enabled)
  const tracking = useRef(false)
  const locked = useRef(false)
  const horizontal = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)
  const animating = useRef(false)

  useEffect(() => { goBackRef.current = goBack }, [goBack])
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e) {
      if (!enabledRef.current) return
      if (animating.current) return
      if (prefersReducedMotion()) return

      const touch = e.touches[0]
      if (touch.clientX > EDGE_WIDTH) return
      if (isInsideScrollableOrDrag(e.target)) return

      tracking.current = true
      locked.current = false
      horizontal.current = false
      startX.current = touch.clientX
      startY.current = touch.clientY
      startTime.current = Date.now()
      x.set(0)
    }

    function onTouchMove(e) {
      if (!tracking.current) return

      const touch = e.touches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current

      if (!locked.current) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          locked.current = true
          horizontal.current = Math.abs(dx) > Math.abs(dy)
          if (!horizontal.current) {
            tracking.current = false
            x.set(0)
            return
          }
        } else {
          return
        }
      }

      if (!horizontal.current) return

      e.preventDefault()
      x.set(Math.max(0, dx))
    }

    function onTouchEnd() {
      if (!tracking.current || !horizontal.current) {
        tracking.current = false
        return
      }

      tracking.current = false

      const currentX = x.get()
      const dt = Math.max((Date.now() - startTime.current) / 1000, 0.01)
      const velocity = currentX / dt
      const progress = currentX / window.innerWidth

      if (progress > THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        animating.current = true
        animate(x, window.innerWidth, {
          type: 'spring',
          stiffness: 400,
          damping: 40,
          velocity,
          onComplete: () => {
            x.set(0)
            animating.current = false
            goBackRef.current()
          },
        })
      } else {
        animate(x, 0, {
          type: 'spring',
          stiffness: 500,
          damping: 30,
        })
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [x])

  return { x, containerRef }
}
