import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * usePullToRefresh — gesto "puxar para atualizar" mobile (Fase 4.4 do plano DS).
 *
 * Auto-gated: só ativa em devices touch. Dispara `onRefresh` quando o usuário
 * puxa para baixo a partir do TOPO da página (window.scrollY <= 0) além do
 * threshold. Em desktop / sem touch é no-op total (não registra listeners).
 *
 * Retorna `{ pullDistance, isRefreshing, threshold }` para o componente
 * renderizar um indicador. O componente decide a animação (use
 * `motion-safe:` para respeitar prefers-reduced-motion).
 *
 * @example
 * const { pullDistance, isRefreshing, threshold } = usePullToRefresh({
 *   onRefresh: async () => { await refetch(); },
 * });
 */
const THRESHOLD = 70 // px (após resistência) p/ disparar
const MAX_PULL = 110 // teto visual do arraste
const RESISTANCE = 0.5 // fator de resistência (drag "pesado")

export function usePullToRefresh({ onRefresh, disabled = false } = {}) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const startY = useRef(null)
  const pullRef = useRef(0)
  const activeRef = useRef(false)
  const refreshingRef = useRef(false)

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setIsRefreshing(true)
    try {
      // duração mínima visível p/ o spinner não "piscar"
      await Promise.all([
        Promise.resolve(onRefresh?.()),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ])
    } finally {
      refreshingRef.current = false
      setIsRefreshing(false)
      pullRef.current = 0
      setPullDistance(0)
    }
  }, [onRefresh])

  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined') return
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouch) return

    const onTouchStart = (e) => {
      if (refreshingRef.current) return
      if (window.scrollY > 0) {
        startY.current = null
        return
      }
      startY.current = e.touches[0].clientY
      activeRef.current = false
    }

    const onTouchMove = (e) => {
      if (startY.current == null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0
          setPullDistance(0)
        }
        activeRef.current = false
        return
      }
      activeRef.current = true
      const dist = Math.min(MAX_PULL, dy * RESISTANCE)
      pullRef.current = dist
      setPullDistance(dist)
    }

    const onTouchEnd = () => {
      if (startY.current == null) return
      const shouldRefresh = activeRef.current && pullRef.current >= THRESHOLD
      startY.current = null
      activeRef.current = false
      if (shouldRefresh) {
        handleRefresh()
      } else {
        pullRef.current = 0
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [disabled, handleRefresh])

  return { pullDistance, isRefreshing, threshold: THRESHOLD }
}
