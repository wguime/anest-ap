/**
 * CateterPeridualContext - Single Source of Truth for epidural catheters
 *
 * Supabase as the single data source with real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import supabaseCateterPeridualService from '@/services/supabaseCateterPeridualService'
import { cateterToCamelCase } from '@/services/supabaseCateterPeridualService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { useDeferredReady } from './DeferredReadyContext'
import { requireUserId } from '@/utils/audit'

const CateterPeridualContext = createContext(null)

const initialState = {
  cateteres: [],
}

function cateterReducer(state, action) {
  switch (action.type) {
    case 'SET_CATETERES':
      return { ...state, cateteres: action.payload }
    case 'ADD_CATETER':
      // Avoid duplicates from real-time
      if (state.cateteres.some((c) => c.id === action.payload.id)) {
        return {
          ...state,
          cateteres: state.cateteres.map((c) =>
            c.id === action.payload.id ? { ...c, ...action.payload } : c
          ),
        }
      }
      return { ...state, cateteres: [action.payload, ...state.cateteres] }
    case 'UPDATE_CATETER':
      return {
        ...state,
        cateteres: state.cateteres.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      }
    default:
      return state
  }
}

export function CateterPeridualProvider({ children }) {
  const [state, dispatch] = useReducer(cateterReducer, initialState)
  const [loading, setLoading] = useState(true)

  // Tier 2: fetch adiado 2s — ver DeferredReadyContext
  const deferredReady = useDeferredReady()
  useEffect(() => {
    if (!deferredReady) return
    async function loadData() {
      try {
        const cateteres = await supabaseCateterPeridualService.fetchAll()
        dispatch({ type: 'SET_CATETERES', payload: cateteres })
      } catch (err) {
        console.error('[CateterPeridualContext] Failed to load from Supabase:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const { cleanup } = createReliableSubscription({
      channelName: 'cateteres-peridural-changes',
      table: 'cateteres_peridural',
      transformRow: cateterToCamelCase,
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return

        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_CATETER', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_CATETER', payload: newRow })
        }
      },
      onRefetch: loadData,
    })

    return () => cleanup()
  }, [deferredReady])

  const addCateter = useCallback(async (cateterData, userInfo) => {
    // Audit-trail: exige user real (lança se ausente), nunca fallback 'Usuário'.
    const audited = requireUserId(userInfo, 'CateterPeridualContext.addCateter')
    const result = await supabaseCateterPeridualService.create(cateterData, audited)
    if (result) {
      dispatch({ type: 'ADD_CATETER', payload: result })
    }
    return result
  }, [])

  const updateCateter = useCallback(async (id, updates, userInfo) => {
    const audited = requireUserId(userInfo, 'CateterPeridualContext.updateCateter')
    const result = await supabaseCateterPeridualService.update(id, updates, audited)
    if (result) {
      dispatch({ type: 'UPDATE_CATETER', payload: result })
    }
    return result
  }, [])

  const markAsRemoved = useCallback(async (id, dataRetirada, motivoRetirada, userInfo) => {
    const result = await supabaseCateterPeridualService.markAsRemoved(id, dataRetirada, motivoRetirada, userInfo)
    if (result) {
      dispatch({ type: 'UPDATE_CATETER', payload: result })
    }
    return result
  }, [])

  const fetchFollowups = useCallback(async (cateterId) => {
    return supabaseCateterPeridualService.fetchFollowups(cateterId)
  }, [])

  const addFollowup = useCallback(async (followupData, userInfo) => {
    // Audit-trail: exige user real (lança se ausente), nunca fallback 'Usuario'.
    const audited = requireUserId(userInfo, 'CateterPeridualContext.addFollowup')
    return supabaseCateterPeridualService.createFollowup(followupData, audited)
  }, [])

  const updateFollowup = useCallback(async (id, updates, userInfo) => {
    const audited = requireUserId(userInfo, 'CateterPeridualContext.updateFollowup')
    return supabaseCateterPeridualService.updateFollowup(id, updates, audited)
  }, [])

  const getCateterById = useCallback(
    (id) => state.cateteres.find((c) => c.id === id),
    [state.cateteres]
  )

  const value = useMemo(
    () => ({
      cateteres: state.cateteres,
      loading,
      addCateter,
      updateCateter,
      markAsRemoved,
      fetchFollowups,
      addFollowup,
      updateFollowup,
      getCateterById,
    }),
    [
      state.cateteres,
      loading,
      addCateter,
      updateCateter,
      markAsRemoved,
      fetchFollowups,
      addFollowup,
      updateFollowup,
      getCateterById,
    ]
  )

  return (
    <CateterPeridualContext.Provider value={value}>
      {children}
    </CateterPeridualContext.Provider>
  )
}

const CATETER_PERIDURAL_FALLBACK = {
  cateteres: [],
  loading: true,
  addCateter: async () => {},
  updateCateter: async () => {},
  markAsRemoved: async () => {},
  fetchFollowups: async () => [],
  addFollowup: async () => {},
  updateFollowup: async () => {},
  getCateterById: () => undefined,
}

export const useCateterPeridural = () => {
  const context = useContext(CateterPeridualContext)
  if (!context) {
    return CATETER_PERIDURAL_FALLBACK
  }
  return context
}

export default CateterPeridualContext
