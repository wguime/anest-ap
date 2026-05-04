/**
 * UptodateContext — Atualizações UpToDate (anestesiologia).
 *
 * Padrão stale-while-revalidate (espelha NoticiasContext):
 *  - Mount → loadFromCache (localStorage) → dispatch imediato (UI rendera).
 *  - loadTopics/loadFeatured → revalida em background se cache > 1h ou force.
 *  - Compara fingerprint (length:max(publicadoEm)) e só dispatch se diferente.
 *
 * Provider montado em main.jsx (DeferredProviders), depois de NoticiasProvider.
 */
import {
  createContext,
  useContext,
  useReducer,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react'
import supabaseUptodateService from '@/services/supabaseUptodateService'
import { useToast } from '@/design-system/components/ui/toast'

const UptodateContext = createContext(null)
const CACHE_KEY = 'anest:uptodate:cache:v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias
const REVALIDATE_AFTER_MS = 60 * 60 * 1000   // 1 hora

const initialState = {
  topics: [],
  featured: [],
  byId: {},
}

function uptodateReducer(state, action) {
  switch (action.type) {
    case 'SET_TOPICS': {
      const byId = { ...state.byId }
      for (const t of action.payload) byId[t.id] = t
      return { ...state, topics: action.payload, byId }
    }
    case 'SET_FEATURED': {
      const byId = { ...state.byId }
      for (const t of action.payload) byId[t.id] = t
      return { ...state, featured: action.payload, byId }
    }
    case 'CACHE_ONE':
      return { ...state, byId: { ...state.byId, [action.payload.id]: action.payload } }
    default:
      return state
  }
}

function fingerprint(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '0:'
  let max = ''
  for (const r of rows) {
    if (r?.publicadoEm && r.publicadoEm > max) max = r.publicadoEm
  }
  return `${rows.length}:${max}`
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function saveToCache(payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), ...payload }),
    )
  } catch {
    // localStorage cheio ou indisponível — silencioso
  }
}

export function UptodateProvider({ children }) {
  const [state, dispatch] = useReducer(uptodateReducer, initialState)
  const [loading, setLoading] = useState(false)
  const [topicsLoaded, setTopicsLoaded] = useState(false)
  const [featuredLoaded, setFeaturedLoaded] = useState(false)
  const { toast } = useToast()

  const loadingRef = useRef({ topics: false, featured: false })
  const lastFetchRef = useRef({ topics: 0, featured: 0 })
  const stateRef = useRef(state)
  stateRef.current = state

  // Hidrata do cache no mount — UI renderiza imediatamente sem fetch
  useEffect(() => {
    const cached = loadFromCache()
    if (!cached) return
    if (Array.isArray(cached.topics) && cached.topics.length) {
      dispatch({ type: 'SET_TOPICS', payload: cached.topics })
      setTopicsLoaded(true)
    }
    if (Array.isArray(cached.featured) && cached.featured.length) {
      dispatch({ type: 'SET_FEATURED', payload: cached.featured })
      setFeaturedLoaded(true)
    }
  }, [])

  const loadFeatured = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current.featured < REVALIDATE_AFTER_MS) return
    if (loadingRef.current.featured) return
    loadingRef.current.featured = true
    try {
      const data = await supabaseUptodateService.fetchFeatured({ limit: 10 })
      const prev = stateRef.current.featured
      if (fingerprint(prev) !== fingerprint(data)) {
        dispatch({ type: 'SET_FEATURED', payload: data })
      }
      setFeaturedLoaded(true)
      lastFetchRef.current.featured = now
      saveToCache({ featured: data, topics: stateRef.current.topics })
    } catch (err) {
      console.error('[UptodateContext] loadFeatured:', err)
    } finally {
      loadingRef.current.featured = false
    }
  }, [])

  const loadTopics = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current.topics < REVALIDATE_AFTER_MS && stateRef.current.topics.length > 0) {
      return
    }
    if (loadingRef.current.topics) return
    loadingRef.current.topics = true
    setLoading(true)
    try {
      const data = await supabaseUptodateService.fetchLatest({ limit: 50 })
      const prev = stateRef.current.topics
      if (fingerprint(prev) !== fingerprint(data)) {
        dispatch({ type: 'SET_TOPICS', payload: data })
      }
      setTopicsLoaded(true)
      lastFetchRef.current.topics = now
      saveToCache({ topics: data, featured: stateRef.current.featured })
    } catch (err) {
      console.error('[UptodateContext] loadTopics:', err)
      toast({ variant: 'error', title: 'Erro ao carregar UpToDate', description: err.message })
    } finally {
      setLoading(false)
      loadingRef.current.topics = false
    }
  }, [toast])

  const getById = useCallback(async (id) => {
    if (!id) return null
    const cached = stateRef.current.byId[id]
    // Se cache não tem resumoHtml (veio do LIST_COLUMNS), buscar full
    if (cached && cached.resumoHtml !== undefined) return cached
    try {
      const fresh = await supabaseUptodateService.fetchById(id)
      if (fresh) dispatch({ type: 'CACHE_ONE', payload: fresh })
      return fresh
    } catch (err) {
      console.error('[UptodateContext] getById:', err)
      toast({ variant: 'error', title: 'Erro ao carregar tópico', description: err.message })
      return null
    }
  }, [toast])

  const value = useMemo(
    () => ({
      topics: state.topics,
      featured: state.featured,
      byId: state.byId,
      loading,
      topicsLoaded,
      featuredLoaded,
      loadFeatured,
      loadTopics,
      getById,
    }),
    [
      state.topics,
      state.featured,
      state.byId,
      loading,
      topicsLoaded,
      featuredLoaded,
      loadFeatured,
      loadTopics,
      getById,
    ],
  )

  return <UptodateContext.Provider value={value}>{children}</UptodateContext.Provider>
}

export const useUptodate = () => {
  const context = useContext(UptodateContext)
  if (!context) {
    throw new Error('useUptodate must be used within an UptodateProvider')
  }
  return context
}

export default UptodateContext
