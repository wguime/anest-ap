/**
 * NoticiasContext — Central de Notícias
 *
 * Lazy-load: o provider é montado em DeferredProviders, mas as fetches só
 * disparam quando algum componente chama loadHighlights/loadNoticias.
 * Sem subscription realtime — atualização única diária via cron.
 */
import {
  createContext,
  useContext,
  useReducer,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import supabaseNoticiasService from '@/services/supabaseNoticiasService'
import { useToast } from '@/design-system/components/ui/toast'

const NoticiasContext = createContext(null)

const initialState = {
  noticias: [],
  highlights: [],
  byId: {},
}

function noticiasReducer(state, action) {
  switch (action.type) {
    case 'SET_NOTICIAS': {
      const byId = { ...state.byId }
      for (const n of action.payload) byId[n.id] = n
      return { ...state, noticias: action.payload, byId }
    }
    case 'SET_HIGHLIGHTS': {
      const byId = { ...state.byId }
      for (const n of action.payload) byId[n.id] = n
      return { ...state, highlights: action.payload, byId }
    }
    case 'CACHE_ONE':
      return { ...state, byId: { ...state.byId, [action.payload.id]: action.payload } }
    default:
      return state
  }
}

export function NoticiasProvider({ children }) {
  const [state, dispatch] = useReducer(noticiasReducer, initialState)
  const [loading, setLoading] = useState(false)
  const [highlightsLoaded, setHighlightsLoaded] = useState(false)
  const [noticiasLoaded, setNoticiasLoaded] = useState(false)
  const [error, setError] = useState(null)
  const { toast } = useToast()
  const loadingRef = useRef({ highlights: false, noticias: false })

  const loadHighlights = useCallback(async ({ force = false } = {}) => {
    if (highlightsLoaded && !force) return
    if (loadingRef.current.highlights) return
    loadingRef.current.highlights = true
    try {
      const data = await supabaseNoticiasService.fetchHighlights({ limit: 5 })
      dispatch({ type: 'SET_HIGHLIGHTS', payload: data })
      setHighlightsLoaded(true)
      setError(null)
    } catch (err) {
      console.error('[NoticiasContext] loadHighlights:', err)
      setError(err.message)
    } finally {
      loadingRef.current.highlights = false
    }
  }, [highlightsLoaded])

  const loadNoticias = useCallback(async (filters = {}) => {
    if (loadingRef.current.noticias) return
    loadingRef.current.noticias = true
    setLoading(true)
    try {
      const data = await supabaseNoticiasService.fetchLatest({ limit: 50, ...filters })
      dispatch({ type: 'SET_NOTICIAS', payload: data })
      setNoticiasLoaded(true)
      setError(null)
    } catch (err) {
      console.error('[NoticiasContext] loadNoticias:', err)
      setError(err.message)
      toast({ variant: 'error', title: 'Erro ao carregar notícias', description: err.message })
    } finally {
      setLoading(false)
      loadingRef.current.noticias = false
    }
  }, [toast])

  const getById = useCallback(async (id) => {
    if (!id) return null
    const cached = state.byId[id]
    if (cached) return cached
    try {
      const fresh = await supabaseNoticiasService.fetchById(id)
      if (fresh) dispatch({ type: 'CACHE_ONE', payload: fresh })
      return fresh
    } catch (err) {
      console.error('[NoticiasContext] getById:', err)
      toast({ variant: 'error', title: 'Erro ao carregar notícia', description: err.message })
      return null
    }
  }, [state.byId, toast])

  const value = useMemo(() => ({
    noticias: state.noticias,
    highlights: state.highlights,
    byId: state.byId,
    loading,
    highlightsLoaded,
    noticiasLoaded,
    error,
    loadHighlights,
    loadNoticias,
    getById,
  }), [
    state.noticias,
    state.highlights,
    state.byId,
    loading,
    highlightsLoaded,
    noticiasLoaded,
    error,
    loadHighlights,
    loadNoticias,
    getById,
  ])

  return <NoticiasContext.Provider value={value}>{children}</NoticiasContext.Provider>
}

export const useNoticias = () => {
  const context = useContext(NoticiasContext)
  if (!context) {
    throw new Error('useNoticias must be used within a NoticiasProvider')
  }
  return context
}

export default NoticiasContext
