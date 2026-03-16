/**
 * DocumentsContext - Single Source of Truth for all documents
 *
 * This context provides centralized state management for documents across:
 * - Centro de Gestao (CentroGestaoPage)
 * - Qualidade page and sub-pages
 * - BibliotecaPage, DocumentoDetalhePage
 * - Any other component that needs document access
 *
 * Features:
 * - CRUD operations with toast feedback
 * - Automatic counts per category
 * - Search across all documents
 * - Status workflow with valid transitions (Qmentum)
 * - Audit trail (changeLog) on every operation
 * - Computed values: overdueDocuments, upcomingReviews, pendingApproval
 * - Supabase as the single data source
 * - Real-time subscriptions via Supabase
 */

import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react'
import { useToast } from '@/design-system/components/ui/toast'

// Import types and constants
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUS,
  DOCUMENT_ACTIONS,
  CHANGE_LOG_ACTIONS,
  INITIAL_DOCUMENTS_STATE,
  countActiveDocuments,
  createChangeLogEntry,
  isRevisaoVencida,
  diasAteRevisao,
} from '@/types/documents'

// Import Supabase service
import supabaseDocumentService from '@/services/supabaseDocumentService'
import { documentToCamelCase } from '@/services/supabaseDocumentService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
// Lazy import to avoid circular dependency at module init time
const getMessagesService = () => import('@/services/supabaseMessagesService').then(m => m.default)

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  documents: INITIAL_DOCUMENTS_STATE,
  isLoading: true,
  isInitialized: false,
  error: null,
  lastSync: null,
}

// ============================================================================
// REDUCER
// ============================================================================

function documentsReducer(state, action) {
  switch (action.type) {
    case DOCUMENT_ACTIONS.SET_DOCUMENTS:
      return {
        ...state,
        documents: action.payload,
        isLoading: false,
        isInitialized: true,
        lastSync: new Date(),
      }

    case DOCUMENT_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      }

    case DOCUMENT_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      }

    case DOCUMENT_ACTIONS.SET_INITIALIZED:
      return {
        ...state,
        isInitialized: action.payload,
      }

    case DOCUMENT_ACTIONS.ADD: {
      const { category, document } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: [document, ...state.documents[category]],
        },
        lastSync: new Date(),
      }
    }

    case DOCUMENT_ACTIONS.UPDATE: {
      const { category, documentId, updates } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: state.documents[category].map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                  changeLog: [
                    ...(updates._changeLogEntry ? [updates._changeLogEntry] : []),
                    ...(doc.changeLog || []),
                  ],
                }
              : doc
          ),
        },
        lastSync: new Date(),
      }
    }

    case DOCUMENT_ACTIONS.DELETE: {
      const { category, documentId } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: state.documents[category].filter((doc) => doc.id !== documentId),
        },
        lastSync: new Date(),
      }
    }

    case DOCUMENT_ACTIONS.CHANGE_STATUS: {
      const { category, documentId, newStatus, logEntry } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: state.documents[category].map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: newStatus,
                  updatedAt: new Date().toISOString(),
                  changeLog: [logEntry, ...(doc.changeLog || [])],
                }
              : doc
          ),
        },
        lastSync: new Date(),
      }
    }

    case DOCUMENT_ACTIONS.ADD_VERSION: {
      const { category, documentId, version, logEntry } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: state.documents[category].map((doc) => {
            if (doc.id !== documentId) return doc
            // Archive current versions
            const updatedVersions = (doc.versoes || []).map((v) =>
              v.status === 'ativo' ? { ...v, status: 'arquivado' } : v
            )
            return {
              ...doc,
              versaoAtual: version.versao,
              arquivoURL: version.arquivoURL || doc.arquivoURL,
              updatedAt: new Date().toISOString(),
              versoes: [version, ...updatedVersions],
              changeLog: [logEntry, ...(doc.changeLog || [])],
            }
          }),
        },
        lastSync: new Date(),
      }
    }

    case DOCUMENT_ACTIONS.ARCHIVE: {
      const { category, documentId, logEntry } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: state.documents[category].map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: DOCUMENT_STATUS.ARQUIVADO,
                  updatedAt: new Date().toISOString(),
                  changeLog: [logEntry, ...(doc.changeLog || [])],
                }
              : doc
          ),
        },
        lastSync: new Date(),
      }
    }

    case DOCUMENT_ACTIONS.RESTORE: {
      const { category, documentId, logEntry } = action.payload
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: state.documents[category].map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: DOCUMENT_STATUS.RASCUNHO,
                  updatedAt: new Date().toISOString(),
                  changeLog: [logEntry, ...(doc.changeLog || [])],
                }
              : doc
          ),
        },
        lastSync: new Date(),
      }
    }

    default:
      return state
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

const DocumentsContext = createContext(null)

// ============================================================================
// PROVIDER
// ============================================================================

export function DocumentsProvider({ children }) {
  const [state, dispatch] = useReducer(documentsReducer, initialState)
  const { toast } = useToast()

  // --------------------------------------------------------------------------
  // INITIALIZATION + REAL-TIME (with reliable reconnection)
  // --------------------------------------------------------------------------

  useEffect(() => {
    async function loadAllDocuments() {
      dispatch({ type: DOCUMENT_ACTIONS.SET_LOADING, payload: true })

      try {
        const data = await supabaseDocumentService.fetchAllDocuments()
        dispatch({ type: DOCUMENT_ACTIONS.SET_DOCUMENTS, payload: data })
      } catch (error) {
        console.error('Error loading documents:', error)
        dispatch({ type: DOCUMENT_ACTIONS.SET_ERROR, payload: error.message })
      }
    }

    loadAllDocuments()

    // Real-time subscription with retry/reconnection
    const { cleanup } = createReliableSubscription({
      channelName: 'documentos-changes',
      table: 'documentos',
      transformRow: documentToCamelCase,
      callback: ({ eventType, new: newDoc, old: oldDoc }) => {
        if (eventType === 'INSERT' && newDoc) {
          dispatch({
            type: DOCUMENT_ACTIONS.ADD,
            payload: { category: newDoc.categoria, document: newDoc },
          })
        } else if (eventType === 'UPDATE' && newDoc) {
          dispatch({
            type: DOCUMENT_ACTIONS.UPDATE,
            payload: {
              category: newDoc.categoria,
              documentId: newDoc.id,
              updates: newDoc,
            },
          })
        } else if (eventType === 'DELETE' && oldDoc) {
          dispatch({
            type: DOCUMENT_ACTIONS.DELETE,
            payload: { category: oldDoc.categoria, documentId: oldDoc.id },
          })
        }
      },
      onRefetch: loadAllDocuments,
    })

    return () => cleanup()
  }, [])

  // --------------------------------------------------------------------------
  // COMPUTED VALUES - Memoized counts and totals
  // --------------------------------------------------------------------------

  const counts = useMemo(() => {
    const categoryCounts = {}
    let total = 0

    Object.entries(state.documents).forEach(([category, docs]) => {
      const activeCount = countActiveDocuments(docs)
      categoryCounts[category] = activeCount
      total += activeCount
    })

    return {
      ...categoryCounts,
      total,
    }
  }, [state.documents])

  // Overdue documents (active docs past their review date)
  const overdueDocuments = useMemo(() => {
    const results = []
    Object.entries(state.documents).forEach(([category, docs]) => {
      docs.forEach((doc) => {
        if (doc.status === DOCUMENT_STATUS.ATIVO && isRevisaoVencida(doc.proximaRevisao)) {
          results.push({ ...doc, category })
        }
      })
    })
    return results
  }, [state.documents])

  // Upcoming reviews (active docs with review in next 30 days)
  const upcomingReviews = useMemo(() => {
    const results = []
    Object.entries(state.documents).forEach(([category, docs]) => {
      docs.forEach((doc) => {
        if (doc.status === DOCUMENT_STATUS.ATIVO && doc.proximaRevisao) {
          const dias = diasAteRevisao(doc.proximaRevisao)
          if (dias !== null && dias > 0 && dias <= 30) {
            results.push({ ...doc, category, diasAteRevisao: dias })
          }
        }
      })
    })
    return results.sort((a, b) => a.diasAteRevisao - b.diasAteRevisao)
  }, [state.documents])

  // Pending approval documents
  const pendingApproval = useMemo(() => {
    const results = []
    Object.entries(state.documents).forEach(([category, docs]) => {
      docs.forEach((doc) => {
        if (doc.status === DOCUMENT_STATUS.PENDENTE) {
          results.push({ ...doc, category })
        }
      })
    })
    return results
  }, [state.documents])

  // --------------------------------------------------------------------------
  // ACTIONS — Supabase
  // --------------------------------------------------------------------------

  const addDocument = useCallback(async (category, documentData, userInfo = {}) => {
    try {
      // Supabase path — do NOT dispatch ADD locally; the real-time subscription
      // will handle the INSERT event and dispatch ADD to avoid duplicate documents.
      const result = await supabaseDocumentService.createDocument(category, documentData, userInfo)

      // Notify all users about the new document (fire-and-forget)
      const docTitle = documentData.titulo || documentData.title || 'Novo documento'
      getMessagesService().then(async (svc) => {
        try {
          const usrModule = await import('@/services/supabaseUsersService')
          const allUsers = await usrModule.default.fetchAllUsers({ active: true })
          const recipientIds = allUsers.map(u => u.id).filter(id => id !== userInfo.userId)
          if (recipientIds.length > 0) {
            await svc.createNotificationBatch(recipientIds, {
              category: 'documento',
              subject: `Novo documento: ${docTitle}`,
              content: `Um novo documento foi adicionado: ${docTitle}`,
              senderName: userInfo.userName || 'Gestão Documental',
              priority: 'normal',
              actionUrl: 'documentos',
              actionLabel: 'Ver Documento',
              actionParams: { id: result.id, category },
            })
          }
        } catch (err) {
          console.error('[DocumentsContext] Notification error on addDocument:', err)
        }
      })

      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao criar documento', description: error.message })
      throw error
    }
  }, [toast])

  const updateDocument = useCallback(async (category, documentId, updates, userInfo = {}) => {
    try {
      const result = await supabaseDocumentService.updateDocument(documentId, updates, userInfo)
      dispatch({
        type: DOCUMENT_ACTIONS.UPDATE,
        payload: { category, documentId, updates: result },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao atualizar documento', description: error.message })
      throw error
    }
  }, [toast])

  const deleteDocument = useCallback(async (category, documentId, userInfo = {}) => {
    try {
      await supabaseDocumentService.deleteDocument(documentId, userInfo)
      dispatch({
        type: DOCUMENT_ACTIONS.DELETE,
        payload: { category, documentId },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao excluir documento', description: error.message })
      throw error
    }
  }, [toast])

  const changeStatus = useCallback(async (category, documentId, newStatus, userInfo = {}) => {
    try {
      const result = await supabaseDocumentService.changeStatus(documentId, newStatus, userInfo)
      if (result.success && result.document) {
        dispatch({
          type: DOCUMENT_ACTIONS.CHANGE_STATUS,
          payload: {
            category,
            documentId,
            newStatus,
            logEntry: createChangeLogEntry(CHANGE_LOG_ACTIONS.STATUS_CHANGED, {
              userId: userInfo.userId || 'sistema',
              userName: userInfo.userName || 'Sistema',
              changes: { statusNovo: newStatus },
            }),
          },
        })

        // Fire-and-forget notifications for status changes
        const doc = result.document
        const docTitle = doc.titulo || doc.title || 'Documento'

        if (newStatus === DOCUMENT_STATUS.PENDENTE && userInfo.approverId) {
          // Submitted for approval — notify approver
          getMessagesService().then(svc => svc.createNotification({
            recipientId: userInfo.approverId,
            category: 'documento',
            subject: 'Aprovação pendente',
            content: `Documento aguardando sua aprovação: ${docTitle}`,
            senderName: 'Gestão Documental',
            priority: 'alta',
            actionUrl: 'documentos',
            actionLabel: 'Ver Documento',
            actionParams: { id: documentId, category },
          })).catch(err => console.error('[DocumentsContext] Notification error:', err))
        }

        if ((newStatus === DOCUMENT_STATUS.ATIVO || newStatus === DOCUMENT_STATUS.REJEITADO) && doc.created_by) {
          // Approved or rejected — notify author
          const action = newStatus === DOCUMENT_STATUS.ATIVO ? 'aprovado' : 'rejeitado'
          getMessagesService().then(svc => svc.createNotification({
            recipientId: doc.created_by,
            category: 'documento',
            subject: `Documento ${action}`,
            content: `${docTitle} foi ${action} por ${userInfo.userName || 'o aprovador'}`,
            senderName: 'Gestão Documental',
            priority: 'normal',
            actionUrl: 'documentos',
            actionLabel: 'Ver Documento',
            actionParams: { id: documentId, category },
          })).catch(err => console.error('[DocumentsContext] Notification error:', err))
        }
      }
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao alterar status do documento', description: error.message })
      throw error
    }
  }, [toast])

  const addVersion = useCallback(async (category, documentId, versionData, userInfo = {}) => {
    try {
      const version = await supabaseDocumentService.addVersion(documentId, versionData, userInfo)

      const logEntry = createChangeLogEntry(CHANGE_LOG_ACTIONS.VERSION_ADDED, {
        userId: userInfo.userId || 'sistema',
        userName: userInfo.userName || 'Sistema',
        changes: { versaoNova: version.versao },
        comment: versionData.descricaoAlteracao || '',
      })

      dispatch({
        type: DOCUMENT_ACTIONS.ADD_VERSION,
        payload: { category, documentId, version, logEntry },
      })

      // Notify distribution recipients about the new version
      if (userInfo.distributionRecipientIds && userInfo.distributionRecipientIds.length > 0) {
        // Inline lookup instead of findDocumentById (declared later in component)
        let doc = null
        for (const [cat, docs] of Object.entries(state.documents)) {
          const found = docs.find((d) => d.id === documentId)
          if (found) { doc = { ...found, category: cat }; break }
        }
        const docTitle = doc?.titulo || 'Documento'
        getMessagesService().then(svc => svc.createNotificationBatch(userInfo.distributionRecipientIds, {
          category: 'documento',
          subject: 'Nova versão disponível',
          content: `O documento "${docTitle}" foi atualizado para a versão ${version.versao}`,
          senderName: 'Gestão Documental',
          priority: 'normal',
          actionUrl: 'documentos',
          actionLabel: 'Ver Documento',
          actionParams: { id: documentId, category },
        })).catch(err => console.error('[DocumentsContext] Notification error:', err))
      }

      return version
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao adicionar versao', description: error.message })
      throw error
    }
  }, [toast, state.documents])

  const archiveDocument = useCallback(async (category, documentId, userInfo = {}) => {
    try {
      await supabaseDocumentService.archiveDocument(documentId, userInfo)

      const logEntry = createChangeLogEntry(CHANGE_LOG_ACTIONS.ARCHIVED, {
        userId: userInfo.userId || 'sistema',
        userName: userInfo.userName || 'Sistema',
      })

      dispatch({
        type: DOCUMENT_ACTIONS.ARCHIVE,
        payload: { category, documentId, logEntry },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao arquivar documento', description: error.message })
      throw error
    }
  }, [toast])

  const restoreDocument = useCallback(async (category, documentId, userInfo = {}) => {
    try {
      await supabaseDocumentService.restoreDocument(documentId, userInfo)

      const logEntry = createChangeLogEntry(CHANGE_LOG_ACTIONS.RESTORED, {
        userId: userInfo.userId || 'sistema',
        userName: userInfo.userName || 'Sistema',
      })

      dispatch({
        type: DOCUMENT_ACTIONS.RESTORE,
        payload: { category, documentId, logEntry },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao restaurar documento', description: error.message })
      throw error
    }
  }, [toast])

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  const getDocumentsByCategory = useCallback(
    (category, options = {}) => {
      const { status, searchTerm, sortBy = 'updatedAt', sortOrder = 'desc' } = options
      let docs = state.documents[category] || []

      // Filter by status
      if (status) {
        docs = docs.filter((doc) => doc.status === status)
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        docs = docs.filter(
          (doc) =>
            doc.titulo?.toLowerCase().includes(term) ||
            doc.codigo?.toLowerCase().includes(term) ||
            doc.descricao?.toLowerCase().includes(term) ||
            doc.tags?.some((tag) => tag.toLowerCase().includes(term))
        )
      }

      // Sort
      docs = [...docs].sort((a, b) => {
        const aValue = a[sortBy]
        const bValue = b[sortBy]

        if (aValue instanceof Date && bValue instanceof Date) {
          return sortOrder === 'desc'
            ? bValue.getTime() - aValue.getTime()
            : aValue.getTime() - bValue.getTime()
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'desc'
            ? bValue.localeCompare(aValue)
            : aValue.localeCompare(bValue)
        }

        return 0
      })

      return docs
    },
    [state.documents]
  )

  const getDocumentById = useCallback(
    (category, documentId) => {
      const docs = state.documents[category] || []
      return docs.find((doc) => doc.id === documentId) || null
    },
    [state.documents]
  )

  const findDocumentById = useCallback(
    (documentId) => {
      for (const [category, docs] of Object.entries(state.documents)) {
        const doc = docs.find((d) => d.id === documentId)
        if (doc) return { ...doc, category }
      }
      return null
    },
    [state.documents]
  )

  const searchAllDocuments = useCallback(
    (searchTerm) => {
      if (!searchTerm) return []

      const term = searchTerm.toLowerCase()
      const results = []

      Object.entries(state.documents).forEach(([category, docs]) => {
        const matches = docs.filter(
          (doc) =>
            doc.status === DOCUMENT_STATUS.ATIVO &&
            (doc.titulo?.toLowerCase().includes(term) ||
              doc.codigo?.toLowerCase().includes(term) ||
              doc.descricao?.toLowerCase().includes(term) ||
              doc.tags?.some((tag) => tag.toLowerCase().includes(term)))
        )

        matches.forEach((doc) => {
          results.push({ ...doc, category })
        })
      })

      return results
    },
    [state.documents]
  )

  // --------------------------------------------------------------------------
  // CONTEXT VALUE
  // --------------------------------------------------------------------------

  const value = useMemo(
    () => ({
      // State
      documents: state.documents,
      counts,
      isLoading: state.isLoading,
      isInitialized: state.isInitialized,
      error: state.error,
      lastSync: state.lastSync,

      // Computed - Qmentum compliance
      overdueDocuments,
      upcomingReviews,
      pendingApproval,

      // Actions
      addDocument,
      updateDocument,
      deleteDocument,
      changeStatus,
      addVersion,
      archiveDocument,
      restoreDocument,

      // Queries
      getDocumentsByCategory,
      getDocumentById,
      findDocumentById,
      searchAllDocuments,
    }),
    [
      state,
      counts,
      overdueDocuments,
      upcomingReviews,
      pendingApproval,
      addDocument,
      updateDocument,
      deleteDocument,
      changeStatus,
      addVersion,
      archiveDocument,
      restoreDocument,
      getDocumentsByCategory,
      getDocumentById,
      findDocumentById,
      searchAllDocuments,
    ]
  )

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
}

// ============================================================================
// HOOK
// ============================================================================

const DOCUMENTS_FALLBACK = {
  documents: INITIAL_DOCUMENTS_STATE,
  counts: { total: 0 },
  isLoading: true,
  isInitialized: false,
  error: null,
  lastSync: null,
  overdueDocuments: [],
  upcomingReviews: [],
  pendingApproval: [],
  addDocument: async () => {},
  updateDocument: async () => {},
  deleteDocument: async () => {},
  changeStatus: async () => {},
  addVersion: async () => {},
  archiveDocument: async () => {},
  restoreDocument: async () => {},
  getDocumentsByCategory: () => [],
  getDocumentById: () => null,
  findDocumentById: () => null,
  searchAllDocuments: () => [],
}

export function useDocumentsContext() {
  const context = useContext(DocumentsContext)

  if (!context) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return DOCUMENTS_FALLBACK
  }

  return context
}

export default DocumentsContext
