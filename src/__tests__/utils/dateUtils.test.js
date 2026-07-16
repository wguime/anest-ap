/**
 * Tests for src/utils/dateUtils.js
 *
 * Covers timezone-aware overdue detection (the Brazilian UTC-3 bug from
 * audit 2026-05-04, Agente 7), edge cases at midnight, leap year, and
 * median robustness against outliers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isOverdue, daysUntil, isWithinNextDays, median, parseLocalDate, toLocalISODate } from '../../utils/dateUtils'

// Freeze time at a known instant for deterministic assertions.
// Use 2026-05-04 12:00:00 local time so we don't sit at a DST/UTC boundary.
function freezeAt(localIsoLike) {
  const fakeNow = new Date(localIsoLike)
  vi.useFakeTimers()
  vi.setSystemTime(fakeNow)
}

describe('dateUtils.isOverdue', () => {
  beforeEach(() => freezeAt('2026-05-04T12:00:00'))
  afterEach(() => vi.useRealTimers())

  it('returns false for null/undefined/empty', () => {
    expect(isOverdue(null)).toBe(false)
    expect(isOverdue(undefined)).toBe(false)
    expect(isOverdue('')).toBe(false)
  })

  it('returns false for invalid date strings', () => {
    expect(isOverdue('not-a-date')).toBe(false)
    expect(isOverdue('2026-13-99')).toBe(false)
  })

  it('returns false for today (same local day)', () => {
    expect(isOverdue('2026-05-04')).toBe(false)
    expect(isOverdue('2026-05-04T00:00:00')).toBe(false)
    expect(isOverdue('2026-05-04T23:59:59')).toBe(false)
  })

  it('returns true for yesterday', () => {
    expect(isOverdue('2026-05-03')).toBe(true)
    expect(isOverdue('2026-05-03T23:59:59')).toBe(true)
  })

  it('returns false for tomorrow', () => {
    expect(isOverdue('2026-05-05')).toBe(false)
    expect(isOverdue('2026-05-05T00:00:00')).toBe(false)
  })

  it('handles Date instances', () => {
    expect(isOverdue(new Date('2026-05-03'))).toBe(true)
    expect(isOverdue(new Date('2026-05-05'))).toBe(false)
  })

  it('treats YYYY-MM-DD as local day, not UTC midnight (Brazil bug fix)', () => {
    // Pre-Wave-1 bug: '2026-05-04' was parsed as UTC midnight, which is
    // 2026-05-03T21:00 in São Paulo (UTC-3). At 12:00 local, that document
    // would already appear "overdue". This test locks the fix in place.
    expect(isOverdue('2026-05-04')).toBe(false)
  })

  it('handles leap year February 29', () => {
    freezeAt('2024-03-01T12:00:00')
    expect(isOverdue('2024-02-29')).toBe(true)
    expect(isOverdue('2024-03-01')).toBe(false)
  })
})

describe('dateUtils.daysUntil', () => {
  beforeEach(() => freezeAt('2026-05-04T12:00:00'))
  afterEach(() => vi.useRealTimers())

  it('returns null for invalid input', () => {
    expect(daysUntil(null)).toBeNull()
    expect(daysUntil('')).toBeNull()
    expect(daysUntil('xyz')).toBeNull()
  })

  it('returns 0 for today', () => {
    expect(daysUntil('2026-05-04')).toBe(0)
    expect(daysUntil('2026-05-04T15:30:00')).toBe(0)
  })

  it('returns positive for future, negative for past', () => {
    expect(daysUntil('2026-05-05')).toBe(1)
    expect(daysUntil('2026-05-11')).toBe(7)
    expect(daysUntil('2026-05-03')).toBe(-1)
    expect(daysUntil('2026-04-04')).toBe(-30)
  })
})

describe('dateUtils.isWithinNextDays', () => {
  beforeEach(() => freezeAt('2026-05-04T12:00:00'))
  afterEach(() => vi.useRealTimers())

  it('returns true for today within window', () => {
    expect(isWithinNextDays('2026-05-04', 7)).toBe(true)
  })

  it('returns true for boundary (exactly N days ahead)', () => {
    expect(isWithinNextDays('2026-05-11', 7)).toBe(true)
  })

  it('returns false for past dates', () => {
    expect(isWithinNextDays('2026-05-03', 7)).toBe(false)
  })

  it('returns false beyond the window', () => {
    expect(isWithinNextDays('2026-05-12', 7)).toBe(false)
  })

  it('returns false for invalid date', () => {
    expect(isWithinNextDays(null, 30)).toBe(false)
  })
})

describe('dateUtils.median', () => {
  it('returns null for empty or invalid input', () => {
    expect(median([])).toBeNull()
    expect(median(null)).toBeNull()
    expect(median(undefined)).toBeNull()
  })

  it('returns the single element for length 1', () => {
    expect(median([42])).toBe(42)
  })

  it('returns middle element for odd length', () => {
    expect(median([1, 2, 3])).toBe(2)
    expect(median([7, 1, 5, 2, 9])).toBe(5)
  })

  it('returns average of two middles for even length', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([10, 20])).toBe(15)
  })

  it('is robust against outliers (vs arithmetic mean)', () => {
    // 5 docs approved in 1-3 days, 1 zombie doc at 730 days (2 years pending).
    // mean = (1+2+3+2+1+730)/6 = 123.17 (misleading)
    // median = avg(2,2) = 2 (faithful to the typical case)
    const days = [1, 2, 3, 2, 1, 730]
    expect(median(days)).toBe(2)
  })
})

describe('dateUtils.parseLocalDate', () => {
  it('parses YYYY-MM-DD as LOCAL midnight, not UTC (cateter data_cirurgia bug)', () => {
    // Bug 2026-07-16: new Date('2026-07-16') é UTC midnight = 15/07 21:00 em
    // UTC-3 → detalhe e form de edição do cateter mostravam um dia antes,
    // parecendo que a edição não persistia (o banco estava certo).
    const d = parseLocalDate('2026-07-16')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(16)
    expect(d.getHours()).toBe(0)
  })

  it('normalizes ISO strings with time and Date instances to local midnight', () => {
    const fromIso = parseLocalDate('2026-07-16T18:19:09.615Z')
    expect(fromIso.getHours()).toBe(0)
    const fromDate = parseLocalDate(new Date(2026, 6, 16, 15, 30))
    expect(fromDate.getDate()).toBe(16)
    expect(fromDate.getHours()).toBe(0)
  })

  it('returns null for null/invalid input', () => {
    expect(parseLocalDate(null)).toBe(null)
    expect(parseLocalDate(undefined)).toBe(null)
    expect(parseLocalDate('not-a-date')).toBe(null)
    expect(parseLocalDate(new Date('invalid'))).toBe(null)
  })
})

describe('dateUtils.toLocalISODate', () => {
  it('serializes by local calendar components (no UTC shift)', () => {
    // Meia-noite local — toISOString() em fuso a leste de UTC recuaria um dia.
    expect(toLocalISODate(new Date(2026, 6, 16, 0, 0, 0))).toBe('2026-07-16')
    expect(toLocalISODate(new Date(2026, 6, 16, 23, 59, 59))).toBe('2026-07-16')
  })

  it('pads month and day', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('roundtrips with parseLocalDate without shifting the day', () => {
    expect(toLocalISODate(parseLocalDate('2026-07-16'))).toBe('2026-07-16')
    expect(toLocalISODate(parseLocalDate('2026-01-01'))).toBe('2026-01-01')
  })

  it('returns null for invalid input', () => {
    expect(toLocalISODate(null)).toBe(null)
    expect(toLocalISODate('2026-07-16')).toBe(null)
    expect(toLocalISODate(new Date('invalid'))).toBe(null)
  })
})
