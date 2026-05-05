/**
 * Tests for src/utils/qmentumScore.js
 *
 * Locks down the 5 mathematical bugs identified by audit 2026-05-04,
 * Agente 7 (Qmentum compliance):
 *
 *   1. qmentumScore: was diluted by categories absent from QMENTUM_CATEGORIES.
 *      Wave 1 fix: ignore categories not in weights map.
 *   2. categoryCompliance: returned score=0 for empty categories, conflating
 *      "empty" with "fully failing". Wave 1: returns null.
 *   3. qmentumScore: ignores entries with score=null (built on top of 2).
 *   4. approvalCycleTime: measured updatedAt-createdAt instead of pendente→ativo
 *      from changeLog. Wave 1: reads changeLog and uses median.
 *   5. reviewComplianceRate: returned 100 when no doc had a scheduled review.
 *      Wave 1: returns null in that case.
 */
import { describe, it, expect } from 'vitest'
import {
  computeCategoryCompliance,
  computeQmentumScore,
  computeApprovalCycleTime,
  computeReviewComplianceRate,
} from '../../utils/qmentumScore'
import { isOverdue, daysUntil } from '../../utils/dateUtils'

const STATUS = {
  ATIVO: 'ativo',
  PENDENTE: 'pendente',
  ARQUIVADO: 'arquivado',
}

const LABELS = {
  etica: 'Ética',
  comites: 'Comitês',
  auditorias: 'Auditorias',
  relatorios: 'Relatórios',
  biblioteca: 'Biblioteca',
  financeiro: 'Financeiro',
}

const WEIGHTS = {
  etica: { weight: 1.2, ropArea: 'governance' },
  comites: { weight: 1.0, ropArea: 'governance' },
  auditorias: { weight: 1.5, ropArea: 'audit' },
  relatorios: { weight: 1.0, ropArea: 'reporting' },
  biblioteca: { weight: 0.8, ropArea: 'library' },
  financeiro: { weight: 1.1, ropArea: 'finance' },
}

// ─── computeCategoryCompliance ─────────────────────────────────────────────

describe('computeCategoryCompliance', () => {
  it('returns null score for empty categories (not 0)', () => {
    const docs = { etica: [], comites: [] }
    const result = computeCategoryCompliance(docs, STATUS, isOverdue, daysUntil, LABELS)
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.score === null)).toBe(true)
    expect(result.every((r) => r.total === 0)).toBe(true)
  })

  it('returns 100 for healthy active docs without overdue/pending', () => {
    const docs = {
      etica: [
        { status: 'ativo', proximaRevisao: '2099-01-01' },
        { status: 'ativo', proximaRevisao: '2099-01-01' },
      ],
    }
    const result = computeCategoryCompliance(docs, STATUS, isOverdue, daysUntil, LABELS)
    expect(result[0].score).toBe(100)
    expect(result[0].active).toBe(2)
    expect(result[0].overdue).toBe(0)
  })

  it('penalizes overdue (-10) and pending (-5)', () => {
    const docs = {
      etica: [
        { status: 'ativo', proximaRevisao: '2020-01-01' }, // overdue
        { status: 'pendente' }, // pending
      ],
    }
    const result = computeCategoryCompliance(docs, STATUS, isOverdue, daysUntil, LABELS)
    expect(result[0].score).toBe(85) // 100 - 10 - 5
    expect(result[0].overdue).toBe(1)
    expect(result[0].pending).toBe(1)
  })

  it('clamps score between 0 and 100', () => {
    const docs = {
      etica: Array.from({ length: 12 }, () => ({
        status: 'ativo',
        proximaRevisao: '2020-01-01',
      })),
    }
    const result = computeCategoryCompliance(docs, STATUS, isOverdue, daysUntil, LABELS)
    expect(result[0].score).toBe(0) // 12*10=120 penalty → clamped to 0
  })

  it('counts upcoming reviews (≤30 days)', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const in40days = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
    const docs = {
      etica: [
        { status: 'ativo', proximaRevisao: tomorrow },
        { status: 'ativo', proximaRevisao: in40days },
      ],
    }
    const result = computeCategoryCompliance(docs, STATUS, isOverdue, daysUntil, LABELS)
    expect(result[0].upcoming).toBe(1) // only tomorrow falls in window
  })

  it('uses category labels when provided, falls back to category id', () => {
    const docs = { etica: [], custom: [] }
    const result = computeCategoryCompliance(docs, STATUS, isOverdue, daysUntil, LABELS)
    expect(result.find((r) => r.category === 'etica').label).toBe('Ética')
    expect(result.find((r) => r.category === 'custom').label).toBe('custom')
  })
})

// ─── computeQmentumScore ───────────────────────────────────────────────────

describe('computeQmentumScore', () => {
  it('returns null for empty input', () => {
    expect(computeQmentumScore([], WEIGHTS)).toBeNull()
    expect(computeQmentumScore(null, WEIGHTS)).toBeNull()
  })

  it('ignores categories not present in weights map (Wave 1 fix #1)', () => {
    // `desconhecida` is NOT in WEIGHTS — should be excluded
    const cc = [
      { category: 'etica', score: 100 },
      { category: 'desconhecida', score: 0 }, // ignore this
    ]
    expect(computeQmentumScore(cc, WEIGHTS)).toBe(100)
  })

  it('ignores entries with score=null (Wave 1 fix #3)', () => {
    const cc = [
      { category: 'etica', score: 100 },
      { category: 'biblioteca', score: null }, // empty — ignore
    ]
    expect(computeQmentumScore(cc, WEIGHTS)).toBe(100)
  })

  it('returns null when ALL entries are excluded', () => {
    const cc = [
      { category: 'desconhecida', score: 50 },
      { category: 'biblioteca', score: null },
    ]
    expect(computeQmentumScore(cc, WEIGHTS)).toBeNull()
  })

  it('computes weighted average correctly', () => {
    // (1.2 * 80 + 1.0 * 100) / (1.2 + 1.0) = (96 + 100) / 2.2 = 89.0909
    const cc = [
      { category: 'etica', score: 80 },
      { category: 'comites', score: 100 },
    ]
    expect(computeQmentumScore(cc, WEIGHTS)).toBe(89)
  })

  it('matches the regression test vector documented in the audit report', () => {
    // 6 categories all at 100 → score = 100
    const cc = [
      { category: 'etica', score: 100 },
      { category: 'comites', score: 100 },
      { category: 'auditorias', score: 100 },
      { category: 'relatorios', score: 100 },
      { category: 'biblioteca', score: 100 },
      { category: 'financeiro', score: 100 },
    ]
    expect(computeQmentumScore(cc, WEIGHTS)).toBe(100)
  })

  it('does NOT dilute score with extra categories that have no weight defined', () => {
    // Pre-Wave-1 bug: medicamentos with weight fallback 1.0 would push the
    // denominator from 6.6 to 7.6 and dilute the result. Now medicamentos is
    // excluded entirely (no weight defined).
    const cc = [
      { category: 'etica', score: 100 },
      { category: 'medicamentos', score: 0 }, // no weight in WEIGHTS
    ]
    expect(computeQmentumScore(cc, WEIGHTS)).toBe(100)
  })
})

// ─── computeApprovalCycleTime ──────────────────────────────────────────────

describe('computeApprovalCycleTime', () => {
  it('returns null when no docs have transitions logged', () => {
    expect(computeApprovalCycleTime([], STATUS)).toBeNull()
    expect(
      computeApprovalCycleTime(
        [{ status: 'ativo', changeLog: [] }],
        STATUS
      )
    ).toBeNull()
  })

  it('measures pendente → ativo time from changeLog (Wave 1 fix #4)', () => {
    const docs = [
      {
        status: 'ativo',
        changeLog: [
          { action: 'created', timestamp: '2026-04-01T10:00:00Z' },
          {
            action: 'status_changed',
            changes: { statusNovo: 'pendente' },
            timestamp: '2026-05-01T10:00:00Z',
          },
          {
            action: 'status_changed',
            changes: { statusNovo: 'ativo' },
            timestamp: '2026-05-04T10:00:00Z',
          },
        ],
      },
    ]
    expect(computeApprovalCycleTime(docs, STATUS)).toBe(3.0) // 3 days
  })

  it('returns the median across multiple docs (robust to outliers)', () => {
    const mkDoc = (pendingDay, approvedDay) => ({
      status: 'ativo',
      changeLog: [
        {
          action: 'status_changed',
          changes: { statusNovo: 'pendente' },
          timestamp: `2026-05-${String(pendingDay).padStart(2, '0')}T10:00:00Z`,
        },
        {
          action: 'status_changed',
          changes: { statusNovo: 'ativo' },
          timestamp: `2026-05-${String(approvedDay).padStart(2, '0')}T10:00:00Z`,
        },
      ],
    })
    const docs = [
      mkDoc(1, 3), // 2 days
      mkDoc(1, 2), // 1 day
      mkDoc(1, 4), // 3 days
      mkDoc(1, 30), // 29 days — outlier
    ]
    // median of [2,1,3,29] sorted [1,2,3,29] = (2+3)/2 = 2.5
    expect(computeApprovalCycleTime(docs, STATUS)).toBe(2.5)
  })

  it('skips docs with negative cycle time (data corruption)', () => {
    const docs = [
      {
        status: 'ativo',
        changeLog: [
          {
            action: 'status_changed',
            changes: { statusNovo: 'pendente' },
            timestamp: '2026-05-04T10:00:00Z',
          },
          {
            action: 'status_changed',
            changes: { statusNovo: 'ativo' },
            timestamp: '2026-05-01T10:00:00Z', // approved BEFORE pendente?!
          },
        ],
      },
    ]
    expect(computeApprovalCycleTime(docs, STATUS)).toBeNull()
  })

  it('accepts action="approved" as alternative to status_changed→ativo', () => {
    const docs = [
      {
        status: 'ativo',
        changeLog: [
          {
            action: 'status_changed',
            changes: { statusNovo: 'pendente' },
            timestamp: '2026-05-01T10:00:00Z',
          },
          { action: 'approved', timestamp: '2026-05-03T10:00:00Z' },
        ],
      },
    ]
    expect(computeApprovalCycleTime(docs, STATUS)).toBe(2.0)
  })

  it('skips draft and rejected docs', () => {
    const docs = [
      {
        status: 'rascunho',
        changeLog: [
          {
            action: 'status_changed',
            changes: { statusNovo: 'pendente' },
            timestamp: '2026-05-01T10:00:00Z',
          },
        ],
      },
    ]
    expect(computeApprovalCycleTime(docs, STATUS)).toBeNull()
  })
})

// ─── computeReviewComplianceRate ───────────────────────────────────────────

describe('computeReviewComplianceRate', () => {
  it('returns null when no document has a scheduled review (Wave 1 fix #5)', () => {
    // Pre-Wave-1: returned 100 — false positive for orgs that simply hadn't
    // scheduled reviews yet. Now: null (unknown / not applicable).
    expect(computeReviewComplianceRate([], STATUS, isOverdue)).toBeNull()
    expect(
      computeReviewComplianceRate(
        [{ status: 'ativo' }, { status: 'rascunho', proximaRevisao: '2099-01-01' }],
        STATUS,
        isOverdue
      )
    ).toBeNull()
  })

  it('returns 100 when all active reviews are on time', () => {
    const docs = [
      { status: 'ativo', proximaRevisao: '2099-01-01' },
      { status: 'ativo', proximaRevisao: '2099-12-31' },
    ]
    expect(computeReviewComplianceRate(docs, STATUS, isOverdue)).toBe(100)
  })

  it('returns 50 when half are overdue', () => {
    const docs = [
      { status: 'ativo', proximaRevisao: '2099-01-01' }, // future
      { status: 'ativo', proximaRevisao: '2020-01-01' }, // overdue
    ]
    expect(computeReviewComplianceRate(docs, STATUS, isOverdue)).toBe(50)
  })

  it('only considers ATIVO docs (ignores rascunho/pendente/arquivado)', () => {
    const docs = [
      { status: 'ativo', proximaRevisao: '2099-01-01' }, // counted
      { status: 'rascunho', proximaRevisao: '2020-01-01' }, // ignored
      { status: 'arquivado', proximaRevisao: '2020-01-01' }, // ignored
    ]
    expect(computeReviewComplianceRate(docs, STATUS, isOverdue)).toBe(100)
  })
})
