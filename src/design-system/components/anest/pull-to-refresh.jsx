/**
 * PullToRefresh — Componente nativo de atualização por gesto de puxar.
 *
 * Padrão nativo (Twitter/Instagram): o conteúdo inteiro desliza para baixo,
 * revelando o indicador no gap entre o header fixo e o conteúdo.
 * Ao soltar, o conteúdo retorna à posição original com spring animation.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, animate, useMotionValue, useTransform } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

const THRESHOLD = 70  // px mínimo para disparar refresh
const MAX_PULL = 130  // px máximo de puxada (rubber band)
const HOLD_Y = 70     // px onde o conteúdo fica durante o refresh

export function PullToRefresh({ children, disabled = false, className }) {
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const startX = useRef(0)
  const pulling = useRef(false)
  const pullY = useMotionValue(0)
  const containerRef = useRef(null)

  // Transforms visuais baseados na distância de puxada
  const indicatorOpacity = useTransform(pullY, [0, 25, THRESHOLD], [0, 0.4, 1])
  const indicatorScale = useTransform(pullY, [0, THRESHOLD], [0.3, 1])
  const rotation = useTransform(pullY, [0, THRESHOLD, MAX_PULL], [0, 180, 360])
  // Centraliza o indicador (40px) no gap que abre (0 → pullY)
  const indicatorTop = useTransform(pullY, (v) => Math.max(0, v / 2 - 20))

  const onTouchStart = useCallback((e) => {
    if (disabled || refreshing) return
    // Só ativa se a página está no topo
    if (window.scrollY > 5) return
    startY.current = e.touches[0].clientY
    startX.current = e.touches[0].clientX
    pulling.current = false
  }, [disabled, refreshing])

  const onTouchMove = useCallback((e) => {
    if (disabled || refreshing) return
    if (window.scrollY > 5) {
      pulling.current = false
      pullY.set(0)
      return
    }

    const dy = e.touches[0].clientY - startY.current
    const dx = Math.abs(e.touches[0].clientX - startX.current)

    // Ignorar swipe horizontal
    if (!pulling.current && dx > Math.abs(dy)) return

    if (dy > 0) {
      pulling.current = true
      // Efeito rubber band — desacelera quanto mais puxa
      const dampened = Math.min(dy * 0.45, MAX_PULL)
      pullY.set(dampened)
      if (dampened > 10) e.preventDefault()
    }
  }, [disabled, refreshing, pullY])

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false

    const current = pullY.get()

    if (current >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      // Anima para posição de "carregando" — indicador visível abaixo do header
      animate(pullY, HOLD_Y, { duration: 0.2, ease: 'easeOut' })

      try {
        // Dispara evento com array de promises para os contextos preencherem
        const detail = { promises: [] }
        window.dispatchEvent(new CustomEvent('anest:pull-refresh', { detail }))

        // Aguarda todas as promises dos contextos + tempo mínimo visual
        await Promise.allSettled([
          ...detail.promises,
          new Promise(r => setTimeout(r, 600)),
        ])
      } catch {
        // silent
      }

      setRefreshing(false)
      // Volta ao topo após atualizar
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Anima de volta para posição original
    animate(pullY, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }, [pullY, refreshing])

  // Event listeners com passive: false para preventDefault no touchmove
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Indicador — absolute no container, ATRÁS do conteúdo (z-0).
          Coberto pelo conteúdo opaco em repouso. Revelado quando o
          conteúdo desliza para baixo via translateY. */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ opacity: indicatorOpacity, top: indicatorTop }}
      >
        <motion.div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-card border border-border',
            'shadow-lg'
          )}
          style={{ scale: indicatorScale }}
        >
          {refreshing ? (
            <RefreshCw className="w-5 h-5 text-primary-hover animate-spin" />
          ) : (
            <motion.div style={{ rotate: rotation }}>
              <RefreshCw className="w-5 h-5 text-primary-hover" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Conteúdo — z-[1] + bg opaco cobre o indicador em repouso.
          translateY desliza para baixo, revelando o indicador no gap. */}
      <motion.div
        className="relative z-[1] bg-background"
        style={{ y: pullY }}
      >
        {children}
      </motion.div>
    </div>
  )
}

/**
 * Hook para contextos se registrarem como listeners de pull-to-refresh.
 * @param {() => Promise<void>} refreshFn - Função async de refresh do contexto
 */
export function usePullToRefreshListener(refreshFn) {
  useEffect(() => {
    if (!refreshFn) return

    const handler = (e) => {
      if (e.detail?.promises) {
        e.detail.promises.push(refreshFn())
      }
    }

    window.addEventListener('anest:pull-refresh', handler)
    return () => window.removeEventListener('anest:pull-refresh', handler)
  }, [refreshFn])
}
