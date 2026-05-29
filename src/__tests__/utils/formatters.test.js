/**
 * Tests for src/utils/formatters.js
 *
 * Cobre equivalência com toLocaleDateString('pt-BR') (migração sem
 * regressão), presets de data, número/moeda/percentual, tolerância a
 * entrada nula/inválida e tempo relativo (com timers congelados).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
} from '../../utils/formatters'

// Data fixa fora de fronteira DST/UTC: 15/03/2026 14:30 local.
const SAMPLE = new Date(2026, 2, 15, 14, 30, 0)

describe('formatDate', () => {
  it('default (short) é idêntico a toLocaleDateString(pt-BR)', () => {
    expect(formatDate(SAMPLE)).toBe(SAMPLE.toLocaleDateString('pt-BR'))
  })

  it('aceita string ISO e number (epoch)', () => {
    expect(formatDate('2026-03-15')).toBe(new Date('2026-03-15').toLocaleDateString('pt-BR'))
    expect(formatDate(SAMPLE.getTime())).toBe(SAMPLE.toLocaleDateString('pt-BR'))
  })

  it('presets espelham as opções Intl correspondentes', () => {
    expect(formatDate(SAMPLE, 'long')).toBe(
      SAMPLE.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    )
    expect(formatDate(SAMPLE, 'medium')).toBe(
      SAMPLE.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    )
    expect(formatDate(SAMPLE, 'dayMonth')).toBe(
      SAMPLE.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    )
  })

  it('null/invalid → fallback (default vazio)', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('not-a-date')).toBe('')
    expect(formatDate(undefined, 'long', '—')).toBe('—')
  })
})

describe('formatDateTime / formatTime', () => {
  it('datetime inclui hora', () => {
    expect(formatDateTime(SAMPLE)).toBe(
      SAMPLE.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    )
  })
  it('time só hora:minuto', () => {
    expect(formatTime(SAMPLE)).toBe(
      SAMPLE.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    )
  })
  it('null → fallback', () => {
    expect(formatTime(null, '--:--')).toBe('--:--')
  })
})

describe('formatNumber / formatCurrency / formatPercent', () => {
  it('número pt-BR == toLocaleString', () => {
    expect(formatNumber(1234.5)).toBe((1234.5).toLocaleString('pt-BR'))
    expect(formatNumber(1234.567, { maximumFractionDigits: 1 })).toBe(
      (1234.567).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    )
  })
  it('aceita string numérica', () => {
    expect(formatNumber('42')).toBe((42).toLocaleString('pt-BR'))
  })
  it('moeda BRL', () => {
    expect(formatCurrency(1234.56)).toBe(
      (1234.56).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    )
  })
  it('percentual', () => {
    expect(formatPercent(42.5)).toBe('42,5%')
    expect(formatPercent(100, 0)).toBe('100%')
  })
  it('null/NaN → fallback', () => {
    expect(formatNumber(null)).toBe('')
    expect(formatNumber('abc')).toBe('')
    expect(formatCurrency(null, 'R$ 0,00')).toBe('R$ 0,00')
    expect(formatPercent(null)).toBe('')
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers())

  function freezeAt(date) {
    vi.useFakeTimers()
    vi.setSystemTime(date)
  }

  it('< 1 min → agora', () => {
    freezeAt(new Date(2026, 2, 15, 14, 30, 30))
    expect(formatRelativeTime(new Date(2026, 2, 15, 14, 30, 0))).toBe('agora')
  })
  it('minutos', () => {
    freezeAt(new Date(2026, 2, 15, 14, 30, 0))
    expect(formatRelativeTime(new Date(2026, 2, 15, 14, 25, 0))).toBe('há 5 min')
  })
  it('horas (plural)', () => {
    freezeAt(new Date(2026, 2, 15, 14, 0, 0))
    expect(formatRelativeTime(new Date(2026, 2, 15, 11, 0, 0))).toBe('há 3 horas')
  })
  it('ontem e dias', () => {
    freezeAt(new Date(2026, 2, 15, 12, 0, 0))
    expect(formatRelativeTime(new Date(2026, 2, 14, 12, 0, 0))).toBe('ontem')
    expect(formatRelativeTime(new Date(2026, 2, 12, 12, 0, 0))).toBe('há 3 dias')
  })
  it('> 7 dias cai para data dia/mês', () => {
    freezeAt(new Date(2026, 2, 30, 12, 0, 0))
    const old = new Date(2026, 2, 1, 12, 0, 0)
    expect(formatRelativeTime(old)).toBe(
      old.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    )
  })
  it('null → fallback', () => {
    expect(formatRelativeTime(null, '—')).toBe('—')
  })
})
