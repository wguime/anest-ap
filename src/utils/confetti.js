/**
 * Confetti helper para conclusão de aprendizado (T1.5.19).
 * Respeita prefers-reduced-motion: se ativo, no-op silencioso.
 * One-shot — chamada repetida dentro de 1s é ignorada.
 */
import confetti from 'canvas-confetti'

let lastFireAt = 0

export function triggerCompletionConfetti({ intensity = 'curso' } = {}) {
  if (typeof window === 'undefined') return
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return

  const now = Date.now()
  if (now - lastFireAt < 1000) return
  lastFireAt = now

  const baseOpts = {
    spread: intensity === 'trilha' ? 110 : 70,
    startVelocity: intensity === 'trilha' ? 55 : 45,
    ticks: 200,
    gravity: 1.0,
    decay: 0.92,
    colors: ['#34C759', '#2E8B57', '#9BC53D', '#FFFFFF', '#006837'],
    disableForReducedMotion: true,
  }

  if (intensity === 'trilha') {
    confetti({ ...baseOpts, particleCount: 150, origin: { x: 0.2, y: 0.7 } })
    confetti({ ...baseOpts, particleCount: 150, origin: { x: 0.8, y: 0.7 } })
  } else {
    confetti({ ...baseOpts, particleCount: 80, origin: { y: 0.6 } })
  }
}
