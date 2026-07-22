/**
 * CirurgiasParticularesContext - Single Source of Truth para lançamentos
 * de cobrança de cirurgias particulares.
 *
 * Supabase como fonte única com subscription em tempo real.
 * LGPD: nunca logar dados do paciente — apenas mensagens de erro.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import supabaseCirurgiasParticularesService, { cirurgiaToCamelCase } from '@/services/supabaseCirurgiasParticularesService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { requireUserId } from '@/utils/audit'

const CirurgiasParticularesContext = createContext(null)

const initialState = {
  cirurgias: [],
}

function cirurgiasReducer(state, action) {
  switch (action.type) {
    case 'SET_CIRURGIAS':
      return { ...state, cirurgias: action.payload }
    case 'ADD_CIRURGIA':
      // Evita duplicata do real-time
      if (state.cirurgias.some((c) => c.id === action.payload.id)) {
        return {
          ...state,
          cirurgias: state.cirurgias.map((c) =>
            c.id === action.payload.id ? { ...c, ...action.payload } : c
          ),
        }
      }
      return { ...state, cirurgias: [action.payload, ...state.cirurgias] }
    case 'UPDATE_CIRURGIA':
      return {
        ...state,
        cirurgias: state.cirurgias.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      }
    default:
      return state
  }
}

export function CirurgiasParticularesProvider({ children }) {
  const [state, dispatch] = useReducer(cirurgiasReducer, initialState)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const cirurgias = await supabaseCirurgiasParticularesService.fetchAll()
        dispatch({ type: 'SET_CIRURGIAS', payload: cirurgias })
      } catch (err) {
        console.error('[CirurgiasParticularesContext] Failed to load from Supabase:', err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const { cleanup } = createReliableSubscription({
      channelName: 'cirurgias-particulares-changes',
      table: 'cirurgias_particulares',
      transformRow: cirurgiaToCamelCase,
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return

        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_CIRURGIA', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_CIRURGIA', payload: newRow })
        }
      },
      onRefetch: loadData,
    })

    return () => cleanup()
  }, [])

  const addCirurgia = useCallback(async (cirurgiaData, userInfo) => {
    // Audit-trail: exige user real (lança se ausente), nunca fallback genérico.
    const audited = requireUserId(userInfo, 'CirurgiasParticularesContext.addCirurgia')
    const result = await supabaseCirurgiasParticularesService.create(cirurgiaData, audited)
    if (result) {
      dispatch({ type: 'ADD_CIRURGIA', payload: result })
    }
    return result
  }, [])

  const updateCirurgia = useCallback(async (id, updates, userInfo) => {
    const audited = requireUserId(userInfo, 'CirurgiasParticularesContext.updateCirurgia')
    const result = await supabaseCirurgiasParticularesService.update(id, updates, audited)
    if (result) {
      dispatch({ type: 'UPDATE_CIRURGIA', payload: result })
    }
    return result
  }, [])

  const cancelarCirurgia = useCallback(async (id, motivo, userInfo) => {
    const audited = requireUserId(userInfo, 'CirurgiasParticularesContext.cancelarCirurgia')
    const result = await supabaseCirurgiasParticularesService.cancelar(id, motivo, audited)
    if (result) {
      dispatch({ type: 'UPDATE_CIRURGIA', payload: result })
    }
    return result
  }, [])

  const getCirurgiaById = useCallback(
    (id) => state.cirurgias.find((c) => c.id === id),
    [state.cirurgias]
  )

  const value = useMemo(
    () => ({
      cirurgias: state.cirurgias,
      loading,
      addCirurgia,
      updateCirurgia,
      cancelarCirurgia,
      getCirurgiaById,
    }),
    [state.cirurgias, loading, addCirurgia, updateCirurgia, cancelarCirurgia, getCirurgiaById]
  )

  return (
    <CirurgiasParticularesContext.Provider value={value}>
      {children}
    </CirurgiasParticularesContext.Provider>
  )
}

const CIRURGIAS_PARTICULARES_FALLBACK = {
  cirurgias: [],
  loading: true,
  addCirurgia: async () => {},
  updateCirurgia: async () => {},
  cancelarCirurgia: async () => {},
  getCirurgiaById: () => undefined,
}

export const useCirurgiasParticulares = () => {
  const context = useContext(CirurgiasParticularesContext)
  if (!context) {
    return CIRURGIAS_PARTICULARES_FALLBACK
  }
  return context
}

export default CirurgiasParticularesContext
