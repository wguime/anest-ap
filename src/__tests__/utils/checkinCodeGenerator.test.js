/**
 * Tests for src/utils/checkinCodeGenerator.js
 *
 * TOTP-like rotating codes for meeting attendance: deterministic 4-digit
 * codes per (seed, 60s window). Time-dependent functions are tested with
 * fake timers (freezeAt pattern, same as dateUtils.test.js).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  generateCheckinCode,
  getCurrentWindowIndex,
  getSecondsUntilNextWindow,
  generateRandomSeed,
} from '../../utils/checkinCodeGenerator'

function freezeAt(epochMs) {
  vi.useFakeTimers()
  vi.setSystemTime(epochMs)
}

afterEach(() => vi.useRealTimers())

describe('checkinCodeGenerator.generateCheckinCode', () => {
  it('is deterministic: same seed + same window → same code', () => {
    const a = generateCheckinCode('abcdef0123456789', 29512345)
    const b = generateCheckinCode('abcdef0123456789', 29512345)
    expect(a).toBe(b)
  })

  it('changes when the window index changes (rotation)', () => {
    const seed = 'abcdef0123456789'
    const w0 = generateCheckinCode(seed, 100)
    const w1 = generateCheckinCode(seed, 101)
    expect(w0).not.toBe(w1)
  })

  it('changes when the seed changes (different meetings)', () => {
    const code1 = generateCheckinCode('seed-meeting-1', 100)
    const code2 = generateCheckinCode('seed-meeting-2', 100)
    expect(code1).not.toBe(code2)
  })

  it('always returns exactly 4 digits, zero-padded', () => {
    const seed = 'abcdef0123456789'
    let sawLeadingZero = false
    for (let w = 0; w < 1000; w++) {
      const code = generateCheckinCode(seed, w)
      expect(code).toMatch(/^\d{4}$/)
      if (code.startsWith('0')) sawLeadingZero = true
    }
    // hash % 10000 < 1000 acontece em ~10% das janelas — garante que o
    // padStart foi de fato exercitado (não só códigos de 4 dígitos naturais).
    expect(sawLeadingZero).toBe(true)
  })

  it('integrates with getCurrentWindowIndex: code rotates after 60s', () => {
    freezeAt(new Date('2026-06-10T12:00:30Z').getTime())
    const seed = 'abcdef0123456789'
    const before = generateCheckinCode(seed, getCurrentWindowIndex())

    vi.advanceTimersByTime(60_000)
    const after = generateCheckinCode(seed, getCurrentWindowIndex())
    expect(after).not.toBe(before)

    // E dentro da mesma janela o código não muda.
    vi.advanceTimersByTime(10_000)
    expect(generateCheckinCode(seed, getCurrentWindowIndex())).toBe(after)
  })
})

describe('checkinCodeGenerator.getCurrentWindowIndex', () => {
  it('returns floor(now / 60000)', () => {
    freezeAt(1_770_000_000_000) // múltiplo arbitrário conhecido
    expect(getCurrentWindowIndex()).toBe(29_500_000)
  })

  it('stays constant within the same 60s window', () => {
    freezeAt(1_770_000_000_000)
    const w = getCurrentWindowIndex()
    vi.advanceTimersByTime(59_999)
    expect(getCurrentWindowIndex()).toBe(w)
  })

  it('increments exactly at the window boundary', () => {
    freezeAt(1_770_000_000_000)
    const w = getCurrentWindowIndex()
    vi.advanceTimersByTime(60_000)
    expect(getCurrentWindowIndex()).toBe(w + 1)
  })
})

describe('checkinCodeGenerator.getSecondsUntilNextWindow', () => {
  // Comportamento ATUAL: no instante exato da virada (ms % 60000 === 0) a
  // função retorna 60, e no último segundo retorna 1 — o range real é 1..60,
  // não 0..59 como diz o JSDoc. Travamos o comportamento atual (ver relatório).
  it('returns 60 exactly at the window boundary', () => {
    freezeAt(1_770_000_000_000) // ms % 60000 === 0
    expect(getSecondsUntilNextWindow()).toBe(60)
  })

  it('returns 30 at the half-window point', () => {
    freezeAt(1_770_000_030_000)
    expect(getSecondsUntilNextWindow()).toBe(30)
  })

  it('returns 1 during the last second of the window', () => {
    freezeAt(1_770_000_059_000)
    expect(getSecondsUntilNextWindow()).toBe(1)
    vi.advanceTimersByTime(999) // 59.999s
    expect(getSecondsUntilNextWindow()).toBe(1)
  })

  it('counts down second by second', () => {
    freezeAt(1_770_000_000_500) // 0.5s dentro da janela
    expect(getSecondsUntilNextWindow()).toBe(60)
    vi.advanceTimersByTime(1_000)
    expect(getSecondsUntilNextWindow()).toBe(59)
    vi.advanceTimersByTime(1_000)
    expect(getSecondsUntilNextWindow()).toBe(58)
  })
})

describe('checkinCodeGenerator.generateRandomSeed', () => {
  it('returns 16 lowercase hex chars (8 bytes)', () => {
    const seed = generateRandomSeed()
    expect(seed).toMatch(/^[0-9a-f]{16}$/)
  })

  it('produces different seeds on consecutive calls', () => {
    // 8 bytes de entropia — colisão em 20 chamadas é ~impossível (2^-64).
    const seeds = new Set(Array.from({ length: 20 }, () => generateRandomSeed()))
    expect(seeds.size).toBe(20)
  })

  it('seeds are valid inputs for generateCheckinCode', () => {
    const seed = generateRandomSeed()
    expect(generateCheckinCode(seed, 12345)).toMatch(/^\d{4}$/)
  })
})
