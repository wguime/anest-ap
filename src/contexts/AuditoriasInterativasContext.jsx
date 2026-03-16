/**
 * AuditoriasInterativasContext - Single Source of Truth para auditorias interativas
 *
 * Supabase as the single data source with real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import supabaseAuditoriasService from '@/services/supabaseAuditoriasService'
import { auditoriasToCamelCase } from '@/services/supabaseAuditoriasService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { AUDIT_TEMPLATES, getDeadlineUrgency } from '@/data/auditoriaTemplatesConfig'

const AuditoriasInterativasContext = createContext(null)

const initialState = {
  execucoes: [],
  templates: AUDIT_TEMPLATES,
}

function auditoriasReducer(state, action) {
  switch (action.type) {
    case 'SET_EXECUCOES':
      return { ...state, execucoes: action.payload }
    case 'ADD_EXECUCAO':
      return { ...state, execucoes: [action.payload, ...state.execucoes] }
    case 'UPDATE_EXECUCAO':
      return {
        ...state,
        execucoes: state.execucoes.map((exec) =>
          exec.id === action.payload.id ? { ...exec, ...action.payload } : exec
        ),
      }
    case 'DELETE_EXECUCAO':
      return {
        ...state,
        execucoes: state.execucoes.filter((exec) => exec.id !== action.payload.id),
      }
    default:
      return state
  }
}

export function AuditoriasInterativasProvider({ children }) {
  const [state, dispatch] = useReducer(auditoriasReducer, {
    ...initialState,
    execucoes: [],
  })
  const [loading, setLoading] = useState(true)

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const execucoes = await supabaseAuditoriasService.fetchAllExecucoes()
        dispatch({ type: 'SET_EXECUCOES', payload: execucoes })
      } catch (err) {
        console.error('[AuditoriasInterativasContext] Failed to load from Supabase:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription with retry/reconnection
    const { cleanup } = createReliableSubscription({
      channelName: 'auditoria-execucoes-changes',
      table: 'auditoria_execucoes',
      transformRow: auditoriasToCamelCase,
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return

        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_EXECUCAO', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_EXECUCAO', payload: newRow })
        } else if (eventType === 'DELETE') {
          dispatch({ type: 'DELETE_EXECUCAO', payload: { id: newRow.id } })
        }
      },
      onRefetch: loadData,
    })

    return () => cleanup()
  }, [])

  const addExecucao = useCallback(async (data, userInfo) => {
    const result = await supabaseAuditoriasService.create(data, userInfo)
    // Real-time subscription handles dispatch
    return result
  }, [])

  const updateExecucao = useCallback(async (id, updates) => {
    const result = await supabaseAuditoriasService.update(id, updates)
    return result
  }, [])

  const finalizeExecucao = useCallback(async (id, score, userInfo) => {
    const result = await supabaseAuditoriasService.finalize(id, score, userInfo)
    return result
  }, [])

  const deleteExecucao = useCallback(async (id) => {
    await supabaseAuditoriasService.remove(id)
  }, [])

  const getExecucaoById = useCallback(
    (id) => {
      return state.execucoes.find((exec) => exec.id === id)
    },
    [state.execucoes]
  )

  const getExecucoesByTipo = useCallback(
    (tipo) => {
      return state.execucoes.filter((exec) => exec.templateTipo === tipo)
    },
    [state.execucoes]
  )

  const getExecucoesByStatus = useCallback(
    (status) => {
      return state.execucoes.filter((exec) => exec.status === status)
    },
    [state.execucoes]
  )

  const getOverdueExecucoes = useCallback(() => {
    return state.execucoes.filter((e) =>
      e.status !== 'concluida' && e.prazo && getDeadlineUrgency(e.prazo).dias < 0
    )
  }, [state.execucoes])

  const getApproachingExecucoes = useCallback(() => {
    return state.execucoes.filter((e) => {
      if (e.status === 'concluida' || !e.prazo) return false
      const u = getDeadlineUrgency(e.prazo)
      return u.dias >= 0 && u.dias <= 7
    })
  }, [state.execucoes])

  const value = useMemo(
    () => ({
      execucoes: state.execucoes,
      templates: state.templates,
      loading,
      addExecucao,
      updateExecucao,
      finalizeExecucao,
      deleteExecucao,
      getExecucaoById,
      getExecucoesByTipo,
      getExecucoesByStatus,
      getOverdueExecucoes,
      getApproachingExecucoes,
    }),
    [
      state.execucoes,
      state.templates,
      loading,
      addExecucao,
      updateExecucao,
      finalizeExecucao,
      deleteExecucao,
      getExecucaoById,
      getExecucoesByTipo,
      getExecucoesByStatus,
      getOverdueExecucoes,
      getApproachingExecucoes,
    ]
  )

  return (
    <AuditoriasInterativasContext.Provider value={value}>
      {children}
    </AuditoriasInterativasContext.Provider>
  )
}

const AUDITORIAS_FALLBACK = {
  execucoes: [],
  templates: [],
  loading: true,
  addExecucao: async () => {},
  updateExecucao: async () => {},
  finalizeExecucao: async () => {},
  deleteExecucao: async () => {},
  getExecucaoById: () => undefined,
  getExecucoesByTipo: () => [],
  getExecucoesByStatus: () => [],
  getOverdueExecucoes: () => [],
  getApproachingExecucoes: () => [],
}

export const useAuditoriasInterativas = () => {
  const context = useContext(AuditoriasInterativasContext)
  if (!context) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return AUDITORIAS_FALLBACK
  }
  return context
}

export default AuditoriasInterativasContext
