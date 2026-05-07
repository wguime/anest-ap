/**
 * Date utilities with timezone awareness for Brazilian users.
 *
 * Why this exists: `new Date('2026-05-04')` is parsed as UTC midnight, so
 * comparing it against `new Date()` in São Paulo (UTC-3) makes a document
 * appear "overdue" 3 hours before the local end-of-day. Wave 1 fix —
 * normalize all date comparisons to local-day granularity.
 *
 * All exports are pure functions with no side effects, fully unit-tested.
 */

/**
 * Returns true if `dateStr` is strictly before today (local time).
 * Both inputs are normalized to local midnight before comparison so the
 * function is agnostic to time-of-day jitter and timezone offsets that
 * cross UTC boundaries.
 *
 * @param {string|Date|null|undefined} dateStr — ISO string or Date instance
 * @returns {boolean} — false if dateStr is missing or invalid
 */
export function isOverdue(dateStr) {
  if (!dateStr) return false
  const target = toLocalMidnight(dateStr)
  if (!target) return false
  const today = startOfToday()
  return target.getTime() < today.getTime()
}

/**
 * Returns the integer number of days from today to the target date.
 * Positive = future, negative = past, 0 = today. Returns null on invalid input.
 *
 * @param {string|Date|null|undefined} dateStr
 * @returns {number|null}
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = toLocalMidnight(dateStr)
  if (!target) return null
  const today = startOfToday()
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / 86_400_000)
}

/**
 * Returns true if dateStr is within the next `windowDays` days (inclusive of
 * today and the boundary date). Used by the upcoming-reviews calendar.
 *
 * @param {string|Date|null|undefined} dateStr
 * @param {number} windowDays — positive integer
 * @returns {boolean}
 */
export function isWithinNextDays(dateStr, windowDays) {
  const days = daysUntil(dateStr)
  return days !== null && days >= 0 && days <= windowDays
}

/**
 * Median of a numeric array. Returns null for empty input. Robust against
 * outliers (used for approvalCycleTime — a single 2-year-old draft would
 * skew the arithmetic mean badly).
 *
 * @param {number[]} values
 * @returns {number|null}
 */
export function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n % 2 === 1) return sorted[(n - 1) / 2]
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

// ─── internal helpers ──────────────────────────────────────────────────────

/**
 * Returns a Date at the local midnight of the given input. Handles ISO date
 * strings (YYYY-MM-DD) by interpreting them as local-day, not UTC. This is
 * the behavior every Brazilian medical user expects when entering a date.
 */
function toLocalMidnight(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    const d = new Date(input)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (typeof input !== 'string') return null

  const trimmed = input.trim()
  // Pure date format YYYY-MM-DD — interpret as local day
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch
    return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0)
  }

  // Full ISO with time — accept JS native parse, then normalize to local midnight
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function startOfToday() {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}
