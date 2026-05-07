/**
 * Pure compliance-score calculation utilities for the Qmentum dashboard.
 *
 * Extracted from useComplianceMetrics so the math is testable without React,
 * Supabase, or context plumbing. Wave 1 introduces three corrections vs the
 * previous inline implementation:
 *
 *   1. Empty categories return `score: null` (previously they returned 0,
 *      which made an empty category indistinguishable from a fully failed
 *      category in the dashboard.)
 *
 *   2. computeQmentumScore() ignores categories not present in `weights` and
 *      categories with `score === null`. The previous fallback `weight: 1.0`
 *      diluted the score by every extra category.
 *
 *   3. computeApprovalCycleTime() reads the document's changeLog (status
 *      transitions pendente → ativo) instead of `updatedAt - createdAt`,
 *      which mistakenly counted every edit as approval lag. Uses median for
 *      robustness against outliers.
 *
 * @module utils/qmentumScore
 */

import { median } from '@/utils/dateUtils'

/**
 * Compute per-category compliance entries. One entry per category, with
 * `score === null` when the category has zero documents (so it can be
 * excluded from weighted aggregates instead of penalized).
 *
 * @param {Record<string, Array<{status: string, proximaRevisao?: string}>>} documentsByCategory
 * @param {{
 *   ATIVO: string,
 *   PENDENTE: string,
 *   ARQUIVADO?: string
 * }} statusEnum
 * @param {(date: any) => boolean} isOverdueFn
 * @param {(date: any) => number|null} daysUntilFn
 * @param {Record<string, string>} categoryLabels
 * @returns {Array<{
 *   category: string,
 *   label: string,
 *   total: number,
 *   active: number,
 *   overdue: number,
 *   pending: number,
 *   upcoming: number,
 *   score: number|null
 * }>}
 */
export function computeCategoryCompliance(
  documentsByCategory,
  statusEnum,
  isOverdueFn,
  daysUntilFn,
  categoryLabels = {}
) {
  return Object.keys(documentsByCategory).map((category) => {
    const docs = documentsByCategory[category] || []
    const activeDocs = docs.filter((d) => d.status === statusEnum.ATIVO)
    const overdue = activeDocs.filter((d) => isOverdueFn(d.proximaRevisao))
    const pending = docs.filter((d) => d.status === statusEnum.PENDENTE)
    const upcoming = activeDocs.filter((d) => {
      if (!d.proximaRevisao) return false
      const dias = daysUntilFn(d.proximaRevisao)
      return dias !== null && dias > 0 && dias <= 30
    })

    const total = docs.length
    // Empty category → null (excluded from aggregates), not 0 (failure).
    const score =
      total === 0
        ? null
        : Math.max(0, Math.min(100, 100 - (overdue.length * 10 + pending.length * 5)))

    return {
      category,
      label: categoryLabels[category] || category,
      total,
      active: activeDocs.length,
      overdue: overdue.length,
      pending: pending.length,
      upcoming: upcoming.length,
      score,
    }
  })
}

/**
 * Weighted Qmentum score across category compliance entries.
 *
 * Filters out (a) categories not in `weights` and (b) categories with
 * `score === null` (empty). Returns null when no scorable category remains.
 *
 * @param {Array<{category: string, score: number|null}>} categoryCompliance
 * @param {Record<string, {weight: number, ropArea?: string}>} weights
 * @returns {number|null} — integer 0-100, or null
 */
export function computeQmentumScore(categoryCompliance, weights) {
  if (!Array.isArray(categoryCompliance) || categoryCompliance.length === 0) {
    return null
  }
  let totalWeight = 0
  let weightedSum = 0
  for (const item of categoryCompliance) {
    if (item.score === null || item.score === undefined) continue
    const conf = weights?.[item.category]
    if (!conf || typeof conf.weight !== 'number') continue
    totalWeight += conf.weight
    weightedSum += item.score * conf.weight
  }
  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

/**
 * Compute approval cycle time (days) from a flat list of documents.
 *
 * Reads `changeLog` to find the time between the first transition into
 * `pendente` and the first transition into `ativo`. Uses median across all
 * approved docs, robust against outliers.
 *
 * Falls back to null when no doc has both transitions logged. Never falls
 * back to `updatedAt - createdAt` (that's the bug the previous version had).
 *
 * @param {Array<{
 *   status: string,
 *   changeLog?: Array<{action: string, timestamp: string, changes?: object}>
 * }>} allDocs
 * @param {{ ATIVO: string }} statusEnum
 * @returns {number|null} — median days (rounded to 1 decimal)
 */
export function computeApprovalCycleTime(allDocs, statusEnum) {
  if (!Array.isArray(allDocs) || allDocs.length === 0) return null

  const cycles = []
  for (const doc of allDocs) {
    if (doc.status !== statusEnum.ATIVO) continue
    const log = doc.changeLog || []
    if (!Array.isArray(log) || log.length === 0) continue

    // Find earliest transition into pendente and earliest into ativo
    const pendingEntry = log.find(
      (e) => e.action === 'status_changed' && e.changes?.statusNovo === 'pendente'
    )
    const approvedEntry = log.find(
      (e) =>
        e.action === 'approved' ||
        (e.action === 'status_changed' && e.changes?.statusNovo === 'ativo')
    )
    if (!pendingEntry || !approvedEntry) continue

    const pendingMs = new Date(pendingEntry.timestamp).getTime()
    const approvedMs = new Date(approvedEntry.timestamp).getTime()
    if (Number.isNaN(pendingMs) || Number.isNaN(approvedMs)) continue
    const days = (approvedMs - pendingMs) / 86_400_000
    if (days >= 0) cycles.push(days)
  }

  const med = median(cycles)
  return med === null ? null : Math.round(med * 10) / 10
}

/**
 * Compute the percentage of active documents whose review is on time.
 *
 * Returns null when no document has a scheduled review. The previous
 * implementation returned 100 in that case, which produced false-positive
 * compliance for organizations that simply hadn't scheduled reviews yet.
 *
 * @param {Array<{status: string, proximaRevisao?: string}>} allDocs
 * @param {{ ATIVO: string }} statusEnum
 * @param {(date: any) => boolean} isOverdueFn
 * @returns {number|null}
 */
export function computeReviewComplianceRate(allDocs, statusEnum, isOverdueFn) {
  if (!Array.isArray(allDocs)) return null
  const docsWithReview = allDocs.filter(
    (d) => d.proximaRevisao && d.status === statusEnum.ATIVO
  )
  if (docsWithReview.length === 0) return null
  const onTime = docsWithReview.filter((d) => !isOverdueFn(d.proximaRevisao)).length
  return Math.round((onTime / docsWithReview.length) * 100)
}
