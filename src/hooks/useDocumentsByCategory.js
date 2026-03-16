/**
 * useDocumentsByCategory - Hook for accessing documents by category
 *
 * Provides:
 * - Documents for a specific category
 * - Filtering by status and search term
 * - Sorting options
 * - Category-specific count
 * - Overdue and pending documents in category
 */

import { useMemo, useState, useCallback } from 'react'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { DOCUMENT_STATUS, isValidCategory, isRevisaoVencida, diasAteRevisao } from '@/types/documents'

export function useDocumentsByCategory(category) {
  const context = useDocumentsContext()
  const { documents, counts, getDocumentsByCategory, getDocumentById } = context

  // Local filter state
  const [statusFilter, setStatusFilter] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState('desc')

  // Validate category
  if (!isValidCategory(category)) {
    console.warn(`useDocumentsByCategory: Invalid category "${category}"`)
  }

  // Get filtered and sorted documents
  const filteredDocuments = useMemo(() => {
    return getDocumentsByCategory(category, {
      status: statusFilter,
      searchTerm,
      sortBy,
      sortOrder,
    })
  }, [category, statusFilter, searchTerm, sortBy, sortOrder, getDocumentsByCategory])

  // Get active documents only (common use case)
  const activeDocuments = useMemo(() => {
    return getDocumentsByCategory(category, {
      status: DOCUMENT_STATUS.ATIVO,
    })
  }, [category, getDocumentsByCategory])

  // Get archived documents only
  const archivedDocuments = useMemo(() => {
    return getDocumentsByCategory(category, {
      status: DOCUMENT_STATUS.ARQUIVADO,
    })
  }, [category, getDocumentsByCategory])

  // Get raw documents (all, no filters)
  const allDocuments = useMemo(() => {
    return documents[category] || []
  }, [documents, category])

  // Overdue documents in this category
  const overdueInCategory = useMemo(() => {
    return allDocuments.filter(
      (doc) => doc.status === DOCUMENT_STATUS.ATIVO && isRevisaoVencida(doc.proximaRevisao)
    )
  }, [allDocuments])

  // Pending approval in this category
  const pendingInCategory = useMemo(() => {
    return allDocuments.filter((doc) => doc.status === DOCUMENT_STATUS.PENDENTE)
  }, [allDocuments])

  // Upcoming reviews in this category (next 30 days)
  const upcomingInCategory = useMemo(() => {
    return allDocuments.filter((doc) => {
      if (doc.status !== DOCUMENT_STATUS.ATIVO || !doc.proximaRevisao) return false
      const dias = diasAteRevisao(doc.proximaRevisao)
      return dias !== null && dias > 0 && dias <= 30
    })
  }, [allDocuments])

  // Get document by ID in this category
  const getById = useCallback(
    (documentId) => {
      return getDocumentById(category, documentId)
    },
    [category, getDocumentById]
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    setStatusFilter(null)
    setSearchTerm('')
    setSortBy('updatedAt')
    setSortOrder('desc')
  }, [])

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }, [])

  return {
    // Documents
    documents: filteredDocuments,
    allDocuments,
    activeDocuments,
    archivedDocuments,

    // Count
    count: counts[category] || 0,
    totalCount: allDocuments.length,
    activeCount: activeDocuments.length,
    archivedCount: archivedDocuments.length,

    // Qmentum compliance per category
    overdueInCategory,
    pendingInCategory,
    upcomingInCategory,
    overdueCount: overdueInCategory.length,
    pendingCount: pendingInCategory.length,

    // Filters
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,

    // Helpers
    getById,
    clearFilters,
    toggleSortOrder,
  }
}

export default useDocumentsByCategory
