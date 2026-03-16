/**
 * ComunicadosContext - Single Source of Truth para comunicados
 *
 * Dados carregados do Supabase com real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import supabaseComunicadosService from '@/services/supabaseComunicadosService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { useToast } from '@/design-system/components/ui/toast'
import { usePullToRefreshListener } from '@/design-system/components/anest/pull-to-refresh'

const ComunicadosContext = createContext(null)

const initialState = {
  comunicados: [],
}

function comunicadosReducer(state, action) {
  switch (action.type) {
    case 'SET_COMUNICADOS':
      return { ...state, comunicados: action.payload }
    case 'ADD_COMUNICADO':
      return { ...state, comunicados: [action.payload, ...state.comunicados] }
    case 'UPDATE_COMUNICADO':
      return {
        ...state,
        comunicados: state.comunicados.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      }
    case 'DELETE_COMUNICADO':
      return {
        ...state,
        comunicados: state.comunicados.filter((c) => c.id !== action.payload.id),
      }
    default:
      return state
  }
}

export function ComunicadosProvider({ children }) {
  const [state, dispatch] = useReducer(comunicadosReducer, initialState)
  const [loading, setLoading] = useState(true)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const { toast } = useToast()

  // Reusable data loader — admin mode fetches all statuses
  const loadData = useCallback(async (adminMode = false) => {
    try {
      const comunicados = adminMode
        ? await supabaseComunicadosService.fetchAllWithDetails()
        : await supabaseComunicadosService.fetchPublicadosWithDetails()
      dispatch({ type: 'SET_COMUNICADOS', payload: comunicados })
    } catch (err) {
      console.error('[ComunicadosContext] Failed to load from Supabase:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load from Supabase on mount
  useEffect(() => {
    loadData(false)

    // Real-time subscription with reliable reconnection
    const { cleanup } = createReliableSubscription({
      channelName: 'comunicados-changes',
      table: 'comunicados',
      callback: ({ eventType, new: newRow, old: oldRow }) => {
        if (eventType === 'DELETE') {
          if (oldRow) {
            dispatch({ type: 'DELETE_COMUNICADO', payload: { id: oldRow.id } })
          }
          return
        }
        if (!newRow) return
        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_COMUNICADO', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_COMUNICADO', payload: newRow })
        }
      },
      onRefetch: () => loadData(isAdminMode),
    })

    return () => cleanup()
  }, [])

  // Enable admin mode — reload all comunicados (any status)
  const enableAdminMode = useCallback(async () => {
    if (!isAdminMode) {
      setIsAdminMode(true)
      await loadData(true)
    }
  }, [isAdminMode, loadData])

  const addComunicado = useCallback(async (comunicadoData, userInfo) => {
    try {
      const result = await supabaseComunicadosService.create(comunicadoData, userInfo)
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao criar comunicado', description: error.message })
      throw error
    }
  }, [toast])

  const updateComunicado = useCallback(async (id, updates) => {
    try {
      const result = await supabaseComunicadosService.update(id, updates)
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao atualizar comunicado', description: error.message })
      throw error
    }
  }, [toast])

  const deleteComunicado = useCallback(async (id) => {
    try {
      await supabaseComunicadosService.remove(id)
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao excluir comunicado', description: error.message })
      throw error
    }
  }, [toast])

  const approveComunicado = useCallback(async (id, userInfo) => {
    try {
      await supabaseComunicadosService.approve(id, userInfo)
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao aprovar comunicado', description: error.message })
      throw error
    }
  }, [toast])

  const publishComunicado = useCallback(async (id) => {
    try {
      await supabaseComunicadosService.publish(id)
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao publicar comunicado', description: error.message })
      throw error
    }
  }, [toast])

  const archiveComunicado = useCallback(async (id) => {
    try {
      await supabaseComunicadosService.archive(id)
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao arquivar comunicado', description: error.message })
      throw error
    }
  }, [toast])

  const confirmLeitura = useCallback(async (comunicadoId, userId, userName) => {
    try {
      await supabaseComunicadosService.confirmLeitura(comunicadoId, userId, userName)
      // Refresh comunicado details
      const updated = await supabaseComunicadosService.fetchById(comunicadoId)
      const confirmacoes = await supabaseComunicadosService.fetchConfirmacoes(comunicadoId)
      dispatch({
        type: 'UPDATE_COMUNICADO',
        payload: { ...updated, confirmacoes },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao confirmar leitura', description: error.message })
      throw error
    }
  }, [toast])

  const completarAcao = useCallback(async (comunicadoId, acaoId, userId, userName) => {
    try {
      await supabaseComunicadosService.completarAcao(comunicadoId, acaoId, userId, userName)
      // Refresh
      const acoesCompletadas = await supabaseComunicadosService.fetchAcoesCompletadas(comunicadoId)
      dispatch({
        type: 'UPDATE_COMUNICADO',
        payload: { id: comunicadoId, acoesCompletadas },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao completar acao', description: error.message })
      throw error
    }
  }, [toast])

  const desfazerAcao = useCallback(async (comunicadoId, acaoId, userId) => {
    try {
      await supabaseComunicadosService.desfazerAcao(comunicadoId, acaoId, userId)
      // Refresh
      const acoesCompletadas = await supabaseComunicadosService.fetchAcoesCompletadas(comunicadoId)
      dispatch({
        type: 'UPDATE_COMUNICADO',
        payload: { id: comunicadoId, acoesCompletadas },
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao desfazer acao', description: error.message })
      throw error
    }
  }, [toast])

  // Helper: check if a comunicado has been read by a specific user
  const isRead = useCallback((comunicado, userId) => {
    return comunicado.confirmacoes?.some((c) => c.userId === userId) || false
  }, [])

  // Computed: publicados only
  const publicados = useMemo(
    () => state.comunicados.filter((c) => c.status === 'publicado'),
    [state.comunicados]
  )

  const rascunhos = useMemo(
    () => state.comunicados.filter((c) => c.status === 'rascunho'),
    [state.comunicados]
  )

  const aprovados = useMemo(
    () => state.comunicados.filter((c) => c.status === 'aprovado'),
    [state.comunicados]
  )

  // Pull-to-refresh: recarrega comunicados quando o usuário puxa a página
  const pullRefreshHandler = useCallback(() => loadData(isAdminMode), [loadData, isAdminMode])
  usePullToRefreshListener(pullRefreshHandler)

  const value = useMemo(
    () => ({
      comunicados: state.comunicados,
      publicados,
      rascunhos,
      aprovados,
      loading,
      addComunicado,
      updateComunicado,
      deleteComunicado,
      approveComunicado,
      publishComunicado,
      archiveComunicado,
      confirmLeitura,
      completarAcao,
      desfazerAcao,
      enableAdminMode,
      isRead,
      refreshData: loadData,
    }),
    [
      state.comunicados,
      publicados,
      rascunhos,
      aprovados,
      loading,
      addComunicado,
      updateComunicado,
      deleteComunicado,
      approveComunicado,
      publishComunicado,
      archiveComunicado,
      confirmLeitura,
      completarAcao,
      desfazerAcao,
      enableAdminMode,
      isRead,
      loadData,
    ]
  )

  return (
    <ComunicadosContext.Provider value={value}>
      {children}
    </ComunicadosContext.Provider>
  )
}

export const useComunicados = () => {
  const context = useContext(ComunicadosContext)
  if (!context) {
    throw new Error('useComunicados must be used within a ComunicadosProvider')
  }
  return context
}

export default ComunicadosContext
