/* eslint-disable react-refresh/only-export-components */
/**
 * IncidentsContext - Single Source of Truth para incidentes e denuncias
 *
 * Split State/Actions pattern (same as DocumentsContext):
 *   - State context  → incidentes, denuncias, loading (re-renders on data change)
 *   - Actions context → memoized callbacks with stable identity (no re-render on data change)
 *
 * Public hooks:
 *   - useIncidents()        → aggregated (backward compat — returns state + actions)
 *   - useIncidentActions()  → stable-identity callbacks only (optimization path)
 *
 * Supabase as the single data source with real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState, useRef } from 'react'
import supabaseIncidentsService from '@/services/supabaseIncidentsService'
import { incidentsToCamelCase } from '@/services/supabaseIncidentsService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { useDeferredReady } from './DeferredReadyContext'
import { useToast } from '@/design-system/components/ui/toast'

// ============================================================================
// CONTEXTS — split state from actions
// ============================================================================

// State context: re-renders consumers when incidents data changes
const IncidentsStateContext = createContext(null)
// Actions context: stable identity, consumers don't re-render on data updates
const IncidentsActionsContext = createContext(null)
// Legacy single context (kept for default export backward compat)
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

  // Stable refs for state — lets actions read current data without
  // invalidating their useCallback identity on every state change.
  const stateRef = useRef(state)
  stateRef.current = state

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

  // Load from Supabase (Tier 2: fetch adiado 2s — ver DeferredReadyContext)
  const deferredReady = useDeferredReady()
  useEffect(() => {
    if (!deferredReady) return
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
  }, [deferredReady, loadData])


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
      return stateRef.current.incidentes.filter((inc) => inc.userId === userId)
    },
    []
  )

  const getDenunciasByUser = useCallback(
    (userId) => {
      return stateRef.current.denuncias.filter((den) => den.userId === userId)
    },
    []
  )

  const getIncidenteById = useCallback(
    (id) => {
      return stateRef.current.incidentes.find((inc) => inc.id === id)
    },
    []
  )

  const getDenunciaById = useCallback(
    (id) => {
      return stateRef.current.denuncias.find((den) => den.id === id)
    },
    []
  )

  // ====================================================================
  // CONTEXT VALUES — split state from actions
  // ====================================================================

  // Actions value: stable identity (only changes if `toast` identity changes)
  const actionsValue = useMemo(
    () => ({
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

  // State value: re-renders consumers when incidents/denuncias change
  const stateValue = useMemo(
    () => ({
      incidentes: state.incidentes,
      denuncias: state.denuncias,
      loading,
    }),
    [
      state.incidentes,
      state.denuncias,
      loading,
    ]
  )

  return (
    <IncidentsActionsContext.Provider value={actionsValue}>
      <IncidentsStateContext.Provider value={stateValue}>
        {children}
      </IncidentsStateContext.Provider>
    </IncidentsActionsContext.Provider>
  )
}

// ============================================================================
// HOOKS — granular and aggregated (backward compat)
// ============================================================================

const STATE_FALLBACK = {
  incidentes: [],
  denuncias: [],
  loading: true,
}

const ACTIONS_FALLBACK = {
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

/**
 * useIncidentActions — read action callbacks with stable identity.
 * Components that only invoke actions (e.g. a form submit button)
 * will NOT re-render when incidents data changes.
 */
export function useIncidentActions() {
  const ctx = useContext(IncidentsActionsContext)
  return ctx ?? ACTIONS_FALLBACK
}

/**
 * useIncidents — aggregated hook (backward compat).
 * Returns the SAME shape as before the split. All existing consumers
 * keep working unchanged. Safe fallback while DeferredProviders hasn't
 * mounted yet.
 */
export const useIncidents = () => {
  const state = useContext(IncidentsStateContext)
  const actions = useContext(IncidentsActionsContext)
  if (!state && !actions) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return { ...STATE_FALLBACK, ...ACTIONS_FALLBACK }
  }
  return { ...(state ?? STATE_FALLBACK), ...(actions ?? ACTIONS_FALLBACK) }
}

export default IncidentsStateContext
