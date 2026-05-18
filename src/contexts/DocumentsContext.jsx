/* eslint-disable react-refresh/only-export-components */
/**
 * DocumentsContext - Single Source of Truth for all documents
 *
 * Wave 3 / W3-3 split:
 *   - State context  → documents, counts, computed values (re-renders on data change)
 *   - Actions context → memoized callbacks with stable identity (no re-render on data change)
 *
 * Public hooks:
 *   - useDocumentsState()       → state + computed memos
 *   - useDocumentsActions()     → stable-identity callbacks
 *   - useDocumentsByCategory()  → memoized filter selector
 *   - useDocumentsCounts()      → memoized counts
 *   - useDocuments()            → aggregated (backward compat — equivalent to old shape)
 *   - useDocumentsContext()     → backward compat alias for full aggregated value (used by
 *                                 several hooks like useComplianceMetrics, useSearch, etc.)
 *
 * Provider: <DocumentsProvider> composes both contexts internally.
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

import { createContext, useContext, useReducer, useEffect, useMemo, useCallback, useRef } from 'react'
import { useToast } from '@/design-system/components/ui/toast'

// Import types and constants
import { DOCUMENT_STATUS, DOCUMENT_ACTIONS, CHANGE_LOG_ACTIONS, INITIAL_DOCUMENTS_STATE, countActiveDocuments, createChangeLogEntry, isRevisaoVencida, diasAteRevisao } from '@/types/documents'

// Import Supabase service
import supabaseDocumentService from '@/services/supabaseDocumentService'
import { documentToCamelCase } from '@/services/supabaseDocumentService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'

// Audit trail enforcement (Wave 0b — remove 'sistema' fallback)
import { requireUserId } from '@/utils/audit'
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
      // Dedup: skip if document already exists (local dispatch + real-time can overlap)
      const existing = state.documents[category] || []
      if (existing.some(d => d.id === document.id)) {
        return state
      }
      return {
        ...state,
        documents: {
          ...state.documents,
          [category]: [document, ...existing],
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
      const { category, documentId, logEntry, newSubcategoria, newTipo } = action.payload
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
                  // Move to "10 Obsoletos" section
                  ...(newSubcategoria ? { subcategoria: newSubcategoria } : {}),
                  ...(newTipo ? { tipo: newTipo } : {}),
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
// CONTEXTS — split state from actions (W3-3)
// ============================================================================

// State context: re-renders consumers when documents data changes
const DocumentsStateContext = createContext(null)
// Actions context: stable identity, consumers don't re-render on data updates
const DocumentsActionsContext = createContext(null)

// ============================================================================
// PROVIDER
// ============================================================================

export function DocumentsProvider({ children }) {
  const [state, dispatch] = useReducer(documentsReducer, initialState)
  const { toast } = useToast()

  // Ref mirror of latest documents — lets actions read current docs
  // without invalidating their useCallback identity on every state change.
  const documentsRef = useRef(state.documents)
  useEffect(() => {
    documentsRef.current = state.documents
  }, [state.documents])

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
  // ACTIONS — Supabase. All wrapped with stable identity (no state.documents dep)
  // --------------------------------------------------------------------------

  const addDocument = useCallback(async (category, documentData, userInfo = {}) => {
    try {
      const result = await supabaseDocumentService.createDocument(category, documentData, userInfo)

      // Dispatch locally for immediate UI update (dedup in reducer prevents duplicates
      // if the real-time subscription also fires an INSERT event)
      dispatch({
        type: DOCUMENT_ACTIONS.ADD,
        payload: { category, document: result },
      })

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
              userId: requireUserId(userInfo, 'DocumentsContext.changeStatus').userId,
              userName: requireUserId(userInfo, 'DocumentsContext.changeStatus').userName,
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
        userId: requireUserId(userInfo, 'DocumentsContext').userId,
        userName: requireUserId(userInfo, 'DocumentsContext').userName,
        changes: { versaoNova: version.versao },
        comment: versionData.descricaoAlteracao || '',
      })

      dispatch({
        type: DOCUMENT_ACTIONS.ADD_VERSION,
        payload: { category, documentId, version, logEntry },
      })

      // Notify distribution recipients about the new version
      if (userInfo.distributionRecipientIds && userInfo.distributionRecipientIds.length > 0) {
        // Read latest documents from ref — keeps callback identity stable
        let doc = null
        const currentDocs = documentsRef.current || {}
        for (const [cat, docs] of Object.entries(currentDocs)) {
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
  }, [toast])

  const archiveDocument = useCallback(async (category, documentId, userInfo = {}, archiveSubsection = '') => {
    try {
      await supabaseDocumentService.archiveDocument(documentId, userInfo, archiveSubsection)

      const logEntry = createChangeLogEntry(CHANGE_LOG_ACTIONS.ARCHIVED, {
        userId: requireUserId(userInfo, 'DocumentsContext').userId,
        userName: requireUserId(userInfo, 'DocumentsContext').userName,
        changes: archiveSubsection ? { subcategoria: 'obsoletos', tipoObsoletos: archiveSubsection } : {},
      })

      dispatch({
        type: DOCUMENT_ACTIONS.ARCHIVE,
        payload: {
          category,
          documentId,
          logEntry,
          // Move to obsoletos section in local state
          ...(archiveSubsection ? { newSubcategoria: 'obsoletos', newTipo: archiveSubsection } : {}),
        },
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
        userId: requireUserId(userInfo, 'DocumentsContext').userId,
        userName: requireUserId(userInfo, 'DocumentsContext').userName,
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
  // QUERIES — read from documentsRef so identity stays stable.
  // (Consumers always observe state via useDocumentsState; queries are helpers
  // for callers that want imperative lookup without subscribing to changes.)
  // --------------------------------------------------------------------------

  const getDocumentsByCategory = useCallback((category, options = {}) => {
    const { status, searchTerm, sortBy = 'updatedAt', sortOrder = 'desc' } = options
    const docsByCat = documentsRef.current || {}
    let docs = docsByCat[category] || []

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
  }, [])

  const getDocumentById = useCallback((category, documentId) => {
    const docsByCat = documentsRef.current || {}
    const docs = docsByCat[category] || []
    return docs.find((doc) => doc.id === documentId) || null
  }, [])

  const findDocumentById = useCallback((documentId) => {
    const docsByCat = documentsRef.current || {}
    for (const [category, docs] of Object.entries(docsByCat)) {
      const doc = docs.find((d) => d.id === documentId)
      if (doc) return { ...doc, category }
    }
    return null
  }, [])

  const searchAllDocuments = useCallback((searchTerm) => {
    if (!searchTerm) return []

    const term = searchTerm.toLowerCase()
    const results = []
    const docsByCat = documentsRef.current || {}

    Object.entries(docsByCat).forEach(([category, docs]) => {
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
  }, [])

  // --------------------------------------------------------------------------
  // CONTEXT VALUES
  // --------------------------------------------------------------------------

  // Actions value: stable identity (only changes if `toast` identity changes,
  // which is itself memoized inside the toast provider).
  const actionsValue = useMemo(
    () => ({
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
      dispatch,
    }),
    [
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

  // State value: re-renders consumers when documents/computed values change
  const stateValue = useMemo(
    () => ({
      documents: state.documents,
      counts,
      isLoading: state.isLoading,
      isInitialized: state.isInitialized,
      error: state.error,
      lastSync: state.lastSync,
      overdueDocuments,
      upcomingReviews,
      pendingApproval,
    }),
    [
      state.documents,
      state.isLoading,
      state.isInitialized,
      state.error,
      state.lastSync,
      counts,
      overdueDocuments,
      upcomingReviews,
      pendingApproval,
    ]
  )

  return (
    <DocumentsActionsContext.Provider value={actionsValue}>
      <DocumentsStateContext.Provider value={stateValue}>
        {children}
      </DocumentsStateContext.Provider>
    </DocumentsActionsContext.Provider>
  )
}

// ============================================================================
// HOOKS — granular (W3-3) and aggregated (backward compat)
// ============================================================================

const STATE_FALLBACK = {
  documents: INITIAL_DOCUMENTS_STATE,
  counts: { total: 0 },
  isLoading: true,
  isInitialized: false,
  error: null,
  lastSync: null,
  overdueDocuments: [],
  upcomingReviews: [],
  pendingApproval: [],
}

const ACTIONS_FALLBACK = {
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
  dispatch: () => {},
}

/**
 * useDocumentsState — read state and computed values.
 * Re-renders consumers whenever documents (or derived memos) change.
 */
export function useDocumentsState() {
  const ctx = useContext(DocumentsStateContext)
  return ctx ?? STATE_FALLBACK
}

/**
 * useDocumentsActions — read action callbacks with stable identity.
 * Components that only invoke actions (e.g. a button) will NOT re-render
 * when document data changes.
 */
export function useDocumentsActions() {
  const ctx = useContext(DocumentsActionsContext)
  return ctx ?? ACTIONS_FALLBACK
}

/**
 * useDocumentsCounts — memoized counts ({ pendentes, aprovados, arquivados, total, ... }).
 * Computed once per documents change.
 */
export function useDocumentsCounts() {
  const { documents, counts } = useDocumentsState()

  return useMemo(() => {
    let pendentes = 0
    let aprovados = 0
    let arquivados = 0
    let total = 0

    Object.values(documents).forEach((docs) => {
      docs.forEach((doc) => {
        switch (doc.status) {
          case DOCUMENT_STATUS.PENDENTE:
            pendentes += 1
            break
          case DOCUMENT_STATUS.ATIVO:
            aprovados += 1
            break
          case DOCUMENT_STATUS.ARQUIVADO:
            arquivados += 1
            break
          default:
            break
        }
        total += 1
      })
    })

    // Spread per-category active counts from the original `counts` so existing
    // consumers (counts.etica, counts.biblioteca, ...) keep working.
    return {
      ...counts,
      pendentes,
      aprovados,
      arquivados,
      total,
    }
  }, [documents, counts])
}

/**
 * useDocumentsByCategory — memoized filter selector.
 * Returns the live array of documents for `categoryId`.
 */
export function useDocumentsByCategory(categoryId) {
  const { documents } = useDocumentsState()
  return useMemo(() => documents[categoryId] || [], [documents, categoryId])
}

/**
 * useDocuments — aggregated hook (backward compat).
 * Returns the SAME shape as before the W3-3 split. Existing consumers
 * (BibliotecaPage, CentroGestaoPage, useDocuments hook in src/hooks, etc.)
 * keep working unchanged.
 */
export function useDocuments() {
  const state = useDocumentsState()
  const actions = useDocumentsActions()
  return { ...state, ...actions }
}

/**
 * useDocumentsContext — backward compat alias used by several existing hooks
 * (useSearch, useComplianceMetrics, useDocumentsByCategory in src/hooks/, etc.).
 * Returns the full aggregated value. Identical to useDocuments().
 */
export function useDocumentsContext() {
  return useDocuments()
}

// ============================================================================
// DEFAULT EXPORT — kept for any module that imports the raw context object.
// Now points to the State context (the most commonly read one). Tests that
// need either context import the named hooks above.
// ============================================================================

export default DocumentsStateContext
