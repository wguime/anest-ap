/**
 * useAgoraMinuto — cronômetro das Liberações (escala cirúrgica).
 *
 * Cobre o bug de produção 2026-07-22 (pills congeladas): iOS/PWA suspende
 * timers em segundo plano e pode nunca retomá-los. O hook precisa:
 *  - ticar em foreground (intervalo de 30s);
 *  - recalcular NA HORA ao voltar do segundo plano (visibilitychange/pageshow/
 *    focus), sem esperar tick nenhum — simulado aqui avançando o relógio SEM
 *    disparar timers (exatamente o que a suspensão faz);
 *  - re-armar o intervalo após o resume (o antigo pode ter morrido).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useAgoraMinuto, { minutosDoDia } from '../../pages/escala-cirurgica/useAgoraMinuto'

describe('useAgoraMinuto', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 22, 14, 0, 0)) // 14:00 → 840 min
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('minutosDoDia converte hora local em minutos', () => {
    expect(minutosDoDia(new Date(2026, 6, 22, 0, 0))).toBe(0)
    expect(minutosDoDia(new Date(2026, 6, 22, 16, 47))).toBe(16 * 60 + 47)
  })

  it('valor inicial = agora', () => {
    const { result } = renderHook(() => useAgoraMinuto())
    expect(result.current).toBe(14 * 60)
  })

  it('tica em foreground com o intervalo de 30s', () => {
    const { result } = renderHook(() => useAgoraMinuto())
    act(() => { vi.advanceTimersByTime(2 * 60_000) })
    expect(result.current).toBe(14 * 60 + 2)
  })

  it('voltar do segundo plano (visibilitychange) recalcula na hora, sem tick', () => {
    const { result } = renderHook(() => useAgoraMinuto())
    // suspensão: o relógio anda mas NENHUM timer dispara (iOS mata o interval)
    act(() => { vi.setSystemTime(new Date(2026, 6, 22, 16, 47)) })
    expect(result.current).toBe(14 * 60) // congelado — nada disparou ainda
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(16 * 60 + 47)
  })

  it('após o resume o intervalo volta a ticar (re-armado)', () => {
    const { result } = renderHook(() => useAgoraMinuto())
    act(() => { vi.setSystemTime(new Date(2026, 6, 22, 16, 0)) })
    act(() => { window.dispatchEvent(new Event('pageshow')) })
    expect(result.current).toBe(16 * 60)
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current).toBe(16 * 60 + 1)
  })

  it('focus também recalcula (desktop voltando à aba)', () => {
    const { result } = renderHook(() => useAgoraMinuto())
    act(() => { vi.setSystemTime(new Date(2026, 6, 22, 15, 30)) })
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(result.current).toBe(15 * 60 + 30)
  })

  it('unmount limpa interval e listeners (sem setState em componente morto)', () => {
    const { unmount } = renderHook(() => useAgoraMinuto())
    unmount()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => {
      vi.setSystemTime(new Date(2026, 6, 22, 18, 0))
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(60_000)
    })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
