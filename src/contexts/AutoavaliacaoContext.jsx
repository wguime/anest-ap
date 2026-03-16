/**
 * AutoavaliacaoContext - Single Source of Truth para autoavaliacao de ROPs
 *
 * Supabase as the single data source with real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import { getCurrentCycle, AREA_CONFIG, getEffectiveDeadline } from '@/data/autoavaliacaoConfig'
import { getDeadlineUrgency } from '@/data/auditoriaTemplatesConfig'
import supabaseAutoavaliacaoService from '@/services/supabaseAutoavaliacaoService'
import { autoavaliacaoToCamelCase } from '@/services/supabaseAutoavaliacaoService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'

const AutoavaliacaoContext = createContext(null)

const initialState = {
  avaliacoes: [],
  cicloAtual: getCurrentCycle(),
}

function autoavaliacaoReducer(state, action) {
  switch (action.type) {
    case 'SET_AVALIACOES':
      return { ...state, avaliacoes: action.payload }
    case 'UPSERT_AVALIACAO': {
      const exists = state.avaliacoes.find(
        (a) => a.ropId === action.payload.ropId && a.ciclo === action.payload.ciclo
      )
      if (exists) {
        return {
          ...state,
          avaliacoes: state.avaliacoes.map((a) =>
            a.ropId === action.payload.ropId && a.ciclo === action.payload.ciclo
              ? { ...a, ...action.payload }
              : a
          ),
        }
      }
      return { ...state, avaliacoes: [...state.avaliacoes, action.payload] }
    }
    case 'DELETE_AVALIACAO':
      return {
        ...state,
        avaliacoes: state.avaliacoes.filter((a) => a.id !== action.payload.id),
      }
    case 'SET_CICLO':
      return { ...state, cicloAtual: action.payload }
    default:
      return state
  }
}

export function AutoavaliacaoProvider({ children }) {
  const [state, dispatch] = useReducer(autoavaliacaoReducer, {
    ...initialState,
    avaliacoes: [],
  })
  const [loading, setLoading] = useState(true)

  // Load from Supabase on mount and when ciclo changes
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const avaliacoes = await supabaseAutoavaliacaoService.fetchByCiclo(state.cicloAtual)
        dispatch({ type: 'SET_AVALIACOES', payload: avaliacoes })
      } catch (err) {
        console.error('[AutoavaliacaoContext] Failed to load from Supabase:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription with retry/reconnection
    const { cleanup } = createReliableSubscription({
      channelName: 'autoavaliacao-rop-changes',
      table: 'autoavaliacao_rop',
      transformRow: autoavaliacaoToCamelCase,
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          dispatch({ type: 'UPSERT_AVALIACAO', payload: newRow })
        } else if (eventType === 'DELETE') {
          dispatch({ type: 'DELETE_AVALIACAO', payload: { id: newRow.id } })
        }
      },
      onRefetch: loadData,
    })

    return () => cleanup()
  }, [state.cicloAtual])

  const setCiclo = useCallback((ciclo) => {
    dispatch({ type: 'SET_CICLO', payload: ciclo })
  }, [])

  const upsertAvaliacao = useCallback(async (data, userInfo) => {
    const result = await supabaseAutoavaliacaoService.upsert(data, userInfo)
    // Real-time subscription handles dispatch
    return result
  }, [])

  const deleteAvaliacao = useCallback(async (id) => {
    await supabaseAutoavaliacaoService.remove(id)
  }, [])

  const getAvaliacaoByRop = useCallback(
    (ropId) => {
      return state.avaliacoes.find(
        (a) => a.ropId === ropId && a.ciclo === state.cicloAtual
      )
    },
    [state.avaliacoes, state.cicloAtual]
  )

  const getAvaliacoesByArea = useCallback(
    (areaKey) => {
      return state.avaliacoes.filter(
        (a) => a.ropArea === areaKey && a.ciclo === state.cicloAtual
      )
    },
    [state.avaliacoes, state.cicloAtual]
  )

  const getProgressoGeral = useCallback(() => {
    const total = Object.values(AREA_CONFIG).reduce((sum, area) => sum + area.ropCount, 0)
    const cicloAvaliacoes = state.avaliacoes.filter((a) => a.ciclo === state.cicloAtual)
    const avaliados = cicloAvaliacoes.filter((a) => a.status !== 'nao_avaliado').length
    const conformes = cicloAvaliacoes.filter((a) => a.status === 'conforme').length
    const parciais = cicloAvaliacoes.filter((a) => a.status === 'parcialmente_conforme').length
    const naoConformes = cicloAvaliacoes.filter((a) => a.status === 'nao_conforme').length
    const percentual = total > 0 ? Math.round((avaliados / total) * 100) : 0
    const scoreConformidade = avaliados > 0 ? Math.round(((conformes * 100 + parciais * 50) / (avaliados * 100)) * 100) : 0

    return { total, avaliados, conformes, parciais, naoConformes, percentual, scoreConformidade }
  }, [state.avaliacoes, state.cicloAtual])

  const getProgressoByArea = useCallback(
    (areaKey) => {
      const areaConfig = AREA_CONFIG[areaKey]
      if (!areaConfig) return { total: 0, avaliados: 0, conformes: 0, parciais: 0, naoConformes: 0, percentual: 0, scoreConformidade: 0 }

      const total = areaConfig.ropCount
      const areaAvaliacoes = state.avaliacoes.filter(
        (a) => a.ropArea === areaKey && a.ciclo === state.cicloAtual
      )
      const avaliados = areaAvaliacoes.filter((a) => a.status !== 'nao_avaliado').length
      const conformes = areaAvaliacoes.filter((a) => a.status === 'conforme').length
      const parciais = areaAvaliacoes.filter((a) => a.status === 'parcialmente_conforme').length
      const naoConformes = areaAvaliacoes.filter((a) => a.status === 'nao_conforme').length
      const percentual = total > 0 ? Math.round((avaliados / total) * 100) : 0
      const scoreConformidade = avaliados > 0 ? Math.round(((conformes * 100 + parciais * 50) / (avaliados * 100)) * 100) : 0

      return { total, avaliados, conformes, parciais, naoConformes, percentual, scoreConformidade }
    },
    [state.avaliacoes, state.cicloAtual]
  )

  const getOverdueAvaliacoes = useCallback(() => {
    return state.avaliacoes.filter((a) => {
      if (a.status === 'conforme') return false
      const deadline = getEffectiveDeadline(a, state.cicloAtual)
      return deadline && getDeadlineUrgency(deadline).dias < 0
    })
  }, [state.avaliacoes, state.cicloAtual])

  const value = useMemo(
    () => ({
      avaliacoes: state.avaliacoes,
      loading,
      cicloAtual: state.cicloAtual,
      setCiclo,
      upsertAvaliacao,
      deleteAvaliacao,
      getAvaliacaoByRop,
      getAvaliacoesByArea,
      getProgressoGeral,
      getProgressoByArea,
      getOverdueAvaliacoes,
    }),
    [
      state.avaliacoes,
      loading,
      state.cicloAtual,
      setCiclo,
      upsertAvaliacao,
      deleteAvaliacao,
      getAvaliacaoByRop,
      getAvaliacoesByArea,
      getProgressoGeral,
      getProgressoByArea,
      getOverdueAvaliacoes,
    ]
  )

  return (
    <AutoavaliacaoContext.Provider value={value}>
      {children}
    </AutoavaliacaoContext.Provider>
  )
}

const AUTOAVALIACAO_FALLBACK = {
  avaliacoes: [],
  loading: true,
  cicloAtual: null,
  setCiclo: () => {},
  upsertAvaliacao: async () => {},
  deleteAvaliacao: async () => {},
  getAvaliacaoByRop: () => undefined,
  getAvaliacoesByArea: () => [],
  getProgressoGeral: () => ({ total: 0, avaliados: 0, conformes: 0, parciais: 0, naoConformes: 0, percentual: 0, scoreConformidade: 0 }),
  getProgressoByArea: () => ({ total: 0, avaliados: 0, conformes: 0, parciais: 0, naoConformes: 0, percentual: 0, scoreConformidade: 0 }),
  getOverdueAvaliacoes: () => [],
}

export const useAutoavaliacao = () => {
  const context = useContext(AutoavaliacaoContext)
  if (!context) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return AUTOAVALIACAO_FALLBACK
  }
  return context
}

export default AutoavaliacaoContext
