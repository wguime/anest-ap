/**
 * PlanosAcaoContext - Single Source of Truth para planos de acao (PDCA)
 *
 * Supabase as the single data source with real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import supabasePlanosAcaoService from '@/services/supabasePlanosAcaoService'
import { planosAcaoToCamelCase } from '@/services/supabasePlanosAcaoService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'

const PlanosAcaoContext = createContext(null)

const initialState = {
  planos: [],
}

function planosAcaoReducer(state, action) {
  switch (action.type) {
    case 'SET_PLANOS':
      return { ...state, planos: action.payload }
    case 'ADD_PLANO':
      return { ...state, planos: [action.payload, ...state.planos] }
    case 'UPDATE_PLANO':
      return {
        ...state,
        planos: state.planos.map((plano) =>
          plano.id === action.payload.id ? { ...plano, ...action.payload } : plano
        ),
      }
    case 'DELETE_PLANO':
      return {
        ...state,
        planos: state.planos.filter((plano) => plano.id !== action.payload.id),
      }
    default:
      return state
  }
}

export function PlanosAcaoProvider({ children }) {
  const [state, dispatch] = useReducer(planosAcaoReducer, {
    ...initialState,
    planos: [],
  })
  const [loading, setLoading] = useState(true)

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const planos = await supabasePlanosAcaoService.fetchAll()
        dispatch({ type: 'SET_PLANOS', payload: planos })
      } catch (err) {
        console.error('[PlanosAcaoContext] Failed to load from Supabase:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription with retry/reconnection
    const { cleanup } = createReliableSubscription({
      channelName: 'planos-acao-changes',
      table: 'planos_acao',
      transformRow: planosAcaoToCamelCase,
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return

        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_PLANO', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_PLANO', payload: newRow })
        } else if (eventType === 'DELETE') {
          dispatch({ type: 'DELETE_PLANO', payload: { id: newRow.id } })
        }
      },
      onRefetch: loadData,
    })

    return () => cleanup()
  }, [])

  const addPlano = useCallback(async (plano, userInfo) => {
    const result = await supabasePlanosAcaoService.create(plano, userInfo)
    // Real-time subscription handles dispatch
    return result
  }, [])

  const updatePlano = useCallback(async (id, updates, userInfo) => {
    const result = await supabasePlanosAcaoService.update(id, updates, userInfo)
    return result
  }, [])

  const deletePlano = useCallback(async (id) => {
    await supabasePlanosAcaoService.remove(id)
  }, [])

  const advancePdcaPhase = useCallback(async (id, newPhase, userInfo) => {
    await supabasePlanosAcaoService.advancePdcaPhase(id, newPhase, userInfo)
  }, [])

  const evaluateEficacia = useCallback(async (id, eficaciaValue, justificativa, userInfo) => {
    await supabasePlanosAcaoService.evaluateEficacia(id, eficaciaValue, justificativa, userInfo)
  }, [])

  const getPlanosByOrigem = useCallback(
    (tipoOrigem, origemId) => {
      return state.planos.filter(
        (plano) => plano.tipoOrigem === tipoOrigem && plano.origemId === origemId
      )
    },
    [state.planos]
  )

  const getOverduePlanos = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    return state.planos.filter(
      (plano) =>
        plano.prazo < today &&
        plano.status !== 'concluido' &&
        plano.status !== 'cancelado'
    )
  }, [state.planos])

  const getPlanoById = useCallback(
    (id) => {
      return state.planos.find((plano) => plano.id === id)
    },
    [state.planos]
  )

  const value = useMemo(
    () => ({
      planos: state.planos,
      loading,
      addPlano,
      updatePlano,
      deletePlano,
      advancePdcaPhase,
      evaluateEficacia,
      getPlanosByOrigem,
      getOverduePlanos,
      getPlanoById,
    }),
    [
      state.planos,
      loading,
      addPlano,
      updatePlano,
      deletePlano,
      advancePdcaPhase,
      evaluateEficacia,
      getPlanosByOrigem,
      getOverduePlanos,
      getPlanoById,
    ]
  )

  return (
    <PlanosAcaoContext.Provider value={value}>
      {children}
    </PlanosAcaoContext.Provider>
  )
}

const PLANOS_ACAO_FALLBACK = {
  planos: [],
  loading: true,
  addPlano: async () => {},
  updatePlano: async () => {},
  deletePlano: async () => {},
  advancePdcaPhase: async () => {},
  evaluateEficacia: async () => {},
  getPlanosByOrigem: () => [],
  getOverduePlanos: () => [],
  getPlanoById: () => undefined,
}

export const usePlanosAcao = () => {
  const context = useContext(PlanosAcaoContext)
  if (!context) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return PLANOS_ACAO_FALLBACK
  }
  return context
}

export default PlanosAcaoContext
