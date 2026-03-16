/**
 * IncidentsContext - Single Source of Truth para incidentes e denuncias
 *
 * Supabase as the single data source with real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import supabaseIncidentsService from '@/services/supabaseIncidentsService'
import { incidentsToCamelCase } from '@/services/supabaseIncidentsService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { useToast } from '@/design-system/components/ui/toast'
import { usePullToRefreshListener } from '@/design-system/components/anest/pull-to-refresh'

const IncidentsContext = createContext(null)

const initialState = {
  incidentes: [],
  denuncias: [],
}

function incidentsReducer(state, action) {
  switch (action.type) {
    case 'SET_INCIDENTES':
      return { ...state, incidentes: action.payload }
    case 'SET_DENUNCIAS':
      return { ...state, denuncias: action.payload }
    case 'ADD_INCIDENTE':
      if (state.incidentes.some(inc => inc.id === action.payload.id)) return state
      return { ...state, incidentes: [action.payload, ...state.incidentes] }
    case 'ADD_DENUNCIA':
      if (state.denuncias.some(den => den.id === action.payload.id)) return state
      return { ...state, denuncias: [action.payload, ...state.denuncias] }
    case 'UPDATE_INCIDENTE':
      return {
        ...state,
        incidentes: state.incidentes.map((inc) =>
          inc.id === action.payload.id ? { ...inc, ...action.payload } : inc
        ),
      }
    case 'UPDATE_DENUNCIA':
      return {
        ...state,
        denuncias: state.denuncias.map((den) =>
          den.id === action.payload.id ? { ...den, ...action.payload } : den
        ),
      }
    case 'ANONYMIZE_INCIDENTE':
      return {
        ...state,
        incidentes: state.incidentes.map((inc) =>
          inc.id === action.payload.id
            ? {
                ...inc,
                userId: null,
                notificante: { tipoIdentificacao: 'anonimo' },
                anonymizedAt: new Date().toISOString(),
              }
            : inc
        ),
      }
    case 'ANONYMIZE_DENUNCIA':
      return {
        ...state,
        denuncias: state.denuncias.map((den) =>
          den.id === action.payload.id
            ? {
                ...den,
                userId: null,
                denunciante: { tipoIdentificacao: 'anonimo' },
                anonymizedAt: new Date().toISOString(),
              }
            : den
        ),
      }
    default:
      return state
  }
}

export function IncidentsProvider({ children }) {
  const [state, dispatch] = useReducer(incidentsReducer, initialState)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Reusable data loader — carrega incidentes e denuncias do Supabase
  const loadData = useCallback(async () => {
    try {
      const [incidentes, denuncias] = await Promise.all([
        supabaseIncidentsService.fetchIncidentes(),
        supabaseIncidentsService.fetchDenuncias(),
      ])
      dispatch({ type: 'SET_INCIDENTES', payload: incidentes })
      dispatch({ type: 'SET_DENUNCIAS', payload: denuncias })
    } catch (err) {
      console.error('[IncidentsContext] Failed to load from Supabase:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load from Supabase on mount
  useEffect(() => {
    loadData()

    // Real-time subscription with retry/reconnection
    const { cleanup } = createReliableSubscription({
      channelName: 'incidentes-changes',
      table: 'incidentes',
      transformRow: incidentsToCamelCase,
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return

        if (eventType === 'INSERT') {
          if (newRow.tipo === 'denuncia') {
            dispatch({ type: 'ADD_DENUNCIA', payload: newRow })
          } else {
            dispatch({ type: 'ADD_INCIDENTE', payload: newRow })
          }
        } else if (eventType === 'UPDATE') {
          if (newRow.tipo === 'denuncia') {
            dispatch({ type: 'UPDATE_DENUNCIA', payload: newRow })
          } else {
            dispatch({ type: 'UPDATE_INCIDENTE', payload: newRow })
          }
        }
      },
      onRefetch: loadData,
    })

    return () => cleanup()
  }, [loadData])

  // Pull-to-refresh: recarrega incidentes e denuncias
  usePullToRefreshListener(loadData)

  const addIncidente = useCallback(async (incidente) => {
    try {
      const result = await supabaseIncidentsService.createIncidente(incidente, {
        userId: incidente.userId,
        userName: incidente.notificante?.nome,
        userEmail: incidente.notificante?.email,
      })
      dispatch({ type: 'ADD_INCIDENTE', payload: result })
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao criar incidente', description: error.message })
      throw error
    }
  }, [toast])

  const addDenuncia = useCallback(async (denuncia) => {
    try {
      const result = await supabaseIncidentsService.createDenuncia(denuncia, {
        userId: denuncia.userId,
        userName: denuncia.denunciante?.nome,
        userEmail: denuncia.denunciante?.email,
      })
      dispatch({ type: 'ADD_DENUNCIA', payload: result })
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao criar denuncia', description: error.message })
      throw error
    }
  }, [toast])

  const updateIncidente = useCallback(async (incidente) => {
    try {
      const result = await supabaseIncidentsService.updateIncidente(incidente.id, incidente)
      dispatch({ type: 'UPDATE_INCIDENTE', payload: result })
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao atualizar incidente', description: error.message })
      throw error
    }
  }, [toast])

  const updateDenuncia = useCallback(async (denuncia) => {
    try {
      const result = await supabaseIncidentsService.updateIncidente(denuncia.id, denuncia)
      dispatch({ type: 'UPDATE_DENUNCIA', payload: result })
      return result
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao atualizar denuncia', description: error.message })
      throw error
    }
  }, [toast])

  const updateStatus = useCallback(async (id, newStatus, userInfo = {}) => {
    try {
      await supabaseIncidentsService.updateStatus(id, newStatus, userInfo)
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao atualizar status', description: error.message })
      throw error
    }
  }, [toast])

  const updateGestaoInterna = useCallback(async (id, gestaoData, userInfo = {}) => {
    try {
      const result = await supabaseIncidentsService.updateGestaoInterna(id, gestaoData, userInfo)
      if (result) {
        const actionType = result.tipo === 'denuncia' ? 'UPDATE_DENUNCIA' : 'UPDATE_INCIDENTE'
        dispatch({ type: actionType, payload: result })
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao atualizar gestao interna', description: error.message })
      throw error
    }
  }, [toast])

  const anonymizeIncidente = useCallback(async (id) => {
    try {
      await supabaseIncidentsService.anonymizeIncidente(id)
      const updated = await supabaseIncidentsService.fetchById(id)
      if (updated) {
        dispatch({ type: 'UPDATE_INCIDENTE', payload: updated })
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao anonimizar incidente', description: error.message })
      throw error
    }
  }, [toast])

  const anonymizeDenuncia = useCallback(async (id) => {
    try {
      await supabaseIncidentsService.anonymizeIncidente(id)
      const updated = await supabaseIncidentsService.fetchById(id)
      if (updated) {
        dispatch({ type: 'UPDATE_DENUNCIA', payload: updated })
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao anonimizar denuncia', description: error.message })
      throw error
    }
  }, [toast])

  const fetchByTrackingCode = useCallback(async (trackingCode) => {
    try {
      return await supabaseIncidentsService.fetchByTrackingCode(trackingCode)
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao buscar por codigo de rastreamento', description: error.message })
      throw error
    }
  }, [toast])

  const getIncidentesByUser = useCallback(
    (userId) => {
      return state.incidentes.filter((inc) => inc.userId === userId)
    },
    [state.incidentes]
  )

  const getDenunciasByUser = useCallback(
    (userId) => {
      return state.denuncias.filter((den) => den.userId === userId)
    },
    [state.denuncias]
  )

  const getIncidenteById = useCallback(
    (id) => {
      return state.incidentes.find((inc) => inc.id === id)
    },
    [state.incidentes]
  )

  const getDenunciaById = useCallback(
    (id) => {
      return state.denuncias.find((den) => den.id === id)
    },
    [state.denuncias]
  )

  const value = useMemo(
    () => ({
      incidentes: state.incidentes,
      denuncias: state.denuncias,
      loading,
      addIncidente,
      addDenuncia,
      updateIncidente,
      updateDenuncia,
      updateStatus,
      updateGestaoInterna,
      anonymizeIncidente,
      anonymizeDenuncia,
      fetchByTrackingCode,
      getIncidentesByUser,
      getDenunciasByUser,
      getIncidenteById,
      getDenunciaById,
    }),
    [
      state,
      loading,
      addIncidente,
      addDenuncia,
      updateIncidente,
      updateDenuncia,
      updateStatus,
      updateGestaoInterna,
      anonymizeIncidente,
      anonymizeDenuncia,
      fetchByTrackingCode,
      getIncidentesByUser,
      getDenunciasByUser,
      getIncidenteById,
      getDenunciaById,
    ]
  )

  return (
    <IncidentsContext.Provider value={value}>
      {children}
    </IncidentsContext.Provider>
  )
}

const INCIDENTS_FALLBACK = {
  incidentes: [],
  denuncias: [],
  loading: true,
  addIncidente: async () => {},
  addDenuncia: async () => {},
  updateIncidente: async () => {},
  updateDenuncia: async () => {},
  updateStatus: async () => {},
  updateGestaoInterna: async () => {},
  anonymizeIncidente: async () => {},
  anonymizeDenuncia: async () => {},
  fetchByTrackingCode: async () => null,
  getIncidentesByUser: () => [],
  getDenunciasByUser: () => [],
  getIncidenteById: () => undefined,
  getDenunciaById: () => undefined,
}

export const useIncidents = () => {
  const context = useContext(IncidentsContext)
  if (!context) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return INCIDENTS_FALLBACK
  }
  return context
}

export default IncidentsContext
