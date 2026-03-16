/**
 * useDocuments - General hook for accessing documents state
 *
 * Provides:
 * - Access to all documents
 * - Document counts by category
 * - Loading and initialization state
 * - Global search across all categories
 * - Qmentum compliance computed values
 */

import { useMemo, useCallback } from 'react'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { isRevisaoVencida, diasAteRevisao, DOCUMENT_STATUS } from '@/types/documents'

export function useDocuments() {
  const context = useDocumentsContext()

  const {
    documents = {},
    counts = {},
    isLoading = true,
    isInitialized = false,
    error = null,
    lastSync = null,
    searchAllDocuments = () => [],
    overdueDocuments = [],
    upcomingReviews = [],
    pendingApproval = [],
  } = context || {}

  // Memoized helper to check if documents are ready
  const isReady = useMemo(
    () => isInitialized && !isLoading && !error,
    [isInitialized, isLoading, error]
  )

  // Compliance metrics computed from context data
  const complianceMetrics = useMemo(() => {
    const totalDocs = counts.total || 0
    const overdueCount = overdueDocuments.length
    const pendingCount = pendingApproval.length
    const upcomingCount = upcomingReviews.length

    // Simple compliance score: 100% minus penalties for overdue/pending
    const penalties = (overdueCount * 10) + (pendingCount * 5)
    const score = totalDocs > 0 ? Math.max(0, Math.min(100, 100 - penalties)) : 100

    return {
      score,
      totalDocuments: totalDocs,
      overdueCount,
      pendingCount,
      upcomingCount,
      isFullyCompliant: overdueCount === 0 && pendingCount === 0,
    }
  }, [counts.total, overdueDocuments.length, pendingApproval.length, upcomingReviews.length])

  const getUpcomingReviews = useCallback((days = 30) => {
    const allDocs = Object.values(documents).flat()
    return allDocs.filter(doc => {
      if (doc.status !== 'ativo' || !doc.proximaRevisao) return false
      const daysUntil = diasAteRevisao(doc.proximaRevisao)
      return daysUntil !== null && daysUntil > 0 && daysUntil <= days
    })
  }, [documents])

  const getOverdueDocuments = useCallback(() => {
    const allDocs = Object.values(documents).flat()
    return allDocs.filter(doc =>
      doc.status === 'ativo' && doc.proximaRevisao && isRevisaoVencida(doc.proximaRevisao)
    )
  }, [documents])

  const getDocumentsByApprovalStatus = useCallback((status) => {
    const allDocs = Object.values(documents).flat()
    return allDocs.filter(doc => doc.status === status)
  }, [documents])

  const reviewAlerts = useMemo(() => {
    const allDocs = Object.values(documents).flat()
    const activeDocs = allDocs.filter(d => d.status === 'ativo' && d.proximaRevisao)

    const critical = activeDocs.filter(d => {
      const days = diasAteRevisao(d.proximaRevisao)
      return days !== null && days < -30
    })
    const warning = activeDocs.filter(d => {
      const days = diasAteRevisao(d.proximaRevisao)
      return days !== null && days < 0 && days >= -30
    })
    const upcoming = activeDocs.filter(d => {
      const days = diasAteRevisao(d.proximaRevisao)
      return days !== null && days > 0 && days <= 30
    })

    return { critical, warning, upcoming }
  }, [documents])

  return {
    // Documents map by category
    documents,

    // Counts per category + total
    counts,

    // Loading state
    isLoading,
    isInitialized,
    isReady,

    // Error state
    error,

    // Last sync timestamp
    lastSync,

    // Search function
    searchAllDocuments,

    // Qmentum compliance
    overdueDocuments,
    upcomingReviews,
    pendingApproval,
    complianceMetrics,

    // Review notifications
    getUpcomingReviews,
    getOverdueDocuments,
    getDocumentsByApprovalStatus,
    reviewAlerts,
  }
}

export default useDocuments
