/**
 * useComplianceMetrics - Hook for Qmentum compliance metrics
 *
 * Provides:
 * - Compliance score (0-100%)
 * - Documents by status breakdown
 * - Category-level compliance data
 * - Recent change log entries across all categories
 */

import { useMemo, useState, useEffect } from 'react'
import { supabase } from '@/config/supabase'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS, CATEGORY_LABELS, QMENTUM_CATEGORIES, RECOMMENDED_DOCUMENT_COUNTS, isRevisaoVencida, diasAteRevisao } from '@/types/documents'
import { computeCategoryCompliance, computeQmentumScore, computeApprovalCycleTime, computeReviewComplianceRate } from '@/utils/qmentumScore'

export function useComplianceMetrics() {
  const {
    documents,
    counts,
    overdueDocuments,
    upcomingReviews,
    pendingApproval,
    isLoading,
    isInitialized,
  } = useDocumentsContext()

  // Documents grouped by status
  const documentsByStatus = useMemo(() => {
    const result = {
      rascunho: [],
      pendente: [],
      ativo: [],
      arquivado: [],
      rejeitado: [],
    }

    Object.entries(documents).forEach(([category, docs]) => {
      docs.forEach((doc) => {
        const key = doc.status || 'rascunho'
        if (result[key]) {
          result[key].push({ ...doc, category })
        }
      })
    })

    return result
  }, [documents])

  // Compliance per category (Wave 1: returns score=null for empty categories)
  const categoryCompliance = useMemo(() => {
    // Build a category-only document map (DOCUMENT_CATEGORIES enum order)
    const byCat = {}
    for (const cat of Object.values(DOCUMENT_CATEGORIES)) {
      byCat[cat] = documents[cat] || []
    }
    return computeCategoryCompliance(
      byCat,
      DOCUMENT_STATUS,
      isRevisaoVencida,
      diasAteRevisao,
      CATEGORY_LABELS
    )
  }, [documents])

  // Overall compliance score
  const complianceScore = useMemo(() => {
    const totalDocs = counts.total || 0
    const overdueCount = overdueDocuments.length
    const pendingCount = pendingApproval.length

    const penalties = (overdueCount * 10) + (pendingCount * 5)
    return totalDocs > 0 ? Math.max(0, Math.min(100, 100 - penalties)) : 0
  }, [counts.total, overdueDocuments.length, pendingApproval.length])

  // Weighted compliance score (Wave 1: filters null scores + unknown categories)
  const qmentumScore = useMemo(
    () => computeQmentumScore(categoryCompliance, QMENTUM_CATEGORIES),
    [categoryCompliance]
  )

  // Adherence by ROP area
  const ropAdherence = useMemo(() => {
    const adherence = {}
    categoryCompliance.forEach(item => {
      const qCat = QMENTUM_CATEGORIES[item.category]
      if (qCat) {
        adherence[item.category] = {
          area: qCat.ropArea,
          score: item.score,
          total: item.total,
          active: item.active,
          overdue: item.overdue,
        }
      }
    })
    return adherence
  }, [categoryCompliance])

  // Review compliance rate (Wave 1: returns null when no scheduled reviews,
  // not 100 — false positives on organizations that haven't scheduled yet)
  const reviewComplianceRate = useMemo(() => {
    const allDocs = Object.values(documents).flat()
    return computeReviewComplianceRate(allDocs, DOCUMENT_STATUS, isRevisaoVencida)
  }, [documents])

  // Approval cycle time (Wave 1: median of changeLog status transitions
  // pendente→ativo, not the misleading updatedAt-createdAt of every edit)
  const approvalCycleTime = useMemo(() => {
    const allDocs = Object.values(documents).flat()
    return computeApprovalCycleTime(allDocs, DOCUMENT_STATUS)
  }, [documents])

  // Overdue documents grouped by category
  const overdueByCategory = useMemo(() => {
    const result = {}
    overdueDocuments.forEach(doc => {
      const cat = doc.category || 'unknown'
      result[cat] = (result[cat] || 0) + 1
    })
    return result
  }, [overdueDocuments])

  // Document coverage vs recommended counts
  const documentCoverage = useMemo(() => {
    const coverage = {}
    Object.entries(RECOMMENDED_DOCUMENT_COUNTS).forEach(([cat, rec]) => {
      const existing = (documents[cat] || []).filter(d => d.status !== DOCUMENT_STATUS.ARQUIVADO).length
      coverage[cat] = {
        existing,
        recommended: rec,
        coverage: rec > 0 ? Math.min(100, Math.round((existing / rec) * 100)) : 0,
      }
    })
    return coverage
  }, [documents])

  // LGPD metrics from lgpd_solicitacoes table
  const [lgpdMetrics, setLgpdMetrics] = useState({
    totalSolicitacoes: 0,
    pendentes: 0,
    resolvidas: 0,
    tempoMedioResposta: null,
  })

  useEffect(() => {
    async function fetchLgpdMetrics() {
      try {
        const { data, error } = await supabase
          .from('lgpd_solicitacoes')
          .select('id, status, created_at, resolved_at')

        if (error || !data) return

        const pendentes = data.filter(s => s.status === 'pendente').length
        const resolvidas = data.filter(s => s.status === 'concluida' || s.status === 'resolvida').length

        // Calculate average response time for resolved requests
        let tempoMedioResposta = null
        const resolvedWithDates = data.filter(s =>
          (s.status === 'concluida' || s.status === 'resolvida') && s.resolved_at && s.created_at
        )
        if (resolvedWithDates.length > 0) {
          const totalMs = resolvedWithDates.reduce((sum, s) => {
            return sum + (new Date(s.resolved_at) - new Date(s.created_at))
          }, 0)
          tempoMedioResposta = Math.round(totalMs / resolvedWithDates.length / (1000 * 60 * 60 * 24)) // days
        }

        setLgpdMetrics({
          totalSolicitacoes: data.length,
          pendentes,
          resolvidas,
          tempoMedioResposta,
        })
      } catch (err) {
        console.warn('[useComplianceMetrics] Failed to fetch LGPD metrics:', err)
      }
    }
    fetchLgpdMetrics()
  }, [])

  // Recent changes across all documents (last 20)
  const recentChanges = useMemo(() => {
    const allChanges = []

    Object.entries(documents).forEach(([category, docs]) => {
      docs.forEach((doc) => {
        if (doc.changeLog && Array.isArray(doc.changeLog)) {
          doc.changeLog.forEach((entry) => {
            allChanges.push({
              ...entry,
              documentId: doc.id,
              documentTitle: doc.titulo,
              documentCode: doc.codigo,
              category,
            })
          })
        }
      })
    })

    // Sort by timestamp descending and take top 20
    return allChanges
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20)
  }, [documents])

  return {
    // Score
    complianceScore,
    isFullyCompliant: overdueDocuments.length === 0 && pendingApproval.length === 0,

    // Counts
    totalDocuments: counts.total || 0,
    activeCount: documentsByStatus.ativo.length,
    overdueCount: overdueDocuments.length,
    pendingCount: pendingApproval.length,
    upcomingCount: upcomingReviews.length,

    // Grouped data
    documentsByStatus,
    categoryCompliance,
    overdueDocuments,
    upcomingReviews,
    pendingApproval,
    recentChanges,

    // Qmentum metrics
    qmentumScore,
    ropAdherence,
    reviewComplianceRate,
    approvalCycleTime,
    overdueByCategory,
    documentCoverage,

    // LGPD metrics
    lgpdMetrics,

    // Loading state
    isLoading,
    isReady: isInitialized && !isLoading,
  }
}

export default useComplianceMetrics
