import { useCallback } from 'react'

/**
 * useHaptic — feedback tátil leve via `navigator.vibrate` (Fase 4.4 do plano DS).
 *
 * Retorna uma função `trigger(pattern)` estável. No-op silencioso quando:
 * - o device não suporta `navigator.vibrate` (iOS Safari, desktop);
 * - o usuário pediu `prefers-reduced-motion: reduce`.
 *
 * Padrões nomeados (ms) ou array custom (`[on, off, on, ...]`):
 *   light · medium · heavy · success · warning · error · selection
 *
 * @example
 * const haptic = useHaptic();
 * <button onClick={() => { haptic('selection'); ... }} />
 */
const PATTERNS = {
  selection: 5,
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 40, 10],
  warning: [20, 60, 20],
  error: [30, 80, 30, 80, 30],
}

export function useHaptic() {
  return useCallback((pattern = 'light') => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return false
    }
    const value = typeof pattern === 'string' ? (PATTERNS[pattern] ?? PATTERNS.light) : pattern
    try {
      return navigator.vibrate(value)
    } catch {
      return false
    }
  }, [])
}
