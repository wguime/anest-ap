/**
 * NoticiasContext — Central de Notícias
 *
 * Padrão stale-while-revalidate:
 *  - Mount → loadFromCache (localStorage) → dispatch imediato (UI rendera).
 *  - loadNoticias → revalida em background se cache > 1h ou force.
 *  - Compara fingerprint (length:max(publicado_em)) e só dispatch se diferente.
 *
 * CRITICAL para evitar re-render cascata:
 *  - Callbacks usam refs estáveis (stateRef, noticiasLoadedRef).
 *  - useCallback com deps mínimas (sem state.noticias nas deps).
 *  - Memoização do value provider via useMemo com deps controladas.
 *
 * Provider montado em main.jsx Tier 1 (AuthGatedProviders), antes de Deferred.
 */
import { createContext, useContext, useReducer, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import supabaseNoticiasService from '@/services/supabaseNoticiasService'
import { useToast } from '@/design-system/components/ui/toast'

const NoticiasContext = createContext(null)
const CACHE_KEY = 'anest:noticias:cache:v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias
const REVALIDATE_AFTER_MS = 60 * 60 * 1000   // 1 hora

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

function fingerprint(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '0:'
  let max = ''
  let ids = ''
  let chars = 0
  for (const r of rows) {
    if (r?.publicadoEm && r.publicadoEm > max) max = r.publicadoEm
    // ids na conta: sem eles, uma troca de composição da lista com mesmo
    // tamanho e mesma data máxima (ex.: entrada de artigo curado no top 10)
    // não dispararia o dispatch e a UI ficaria presa no cache antigo
    ids += r?.id || ''
    // tamanho do texto PT na conta: edição/tradução de conteúdo não muda
    // id nem data — sem este sinal a revisão só aparecia ao reabrir o app
    chars += (r?.tituloPt?.length || 0) + (r?.resumoPt?.length || 0)
  }
  return `${rows.length}:${max}:${chars}:${ids}`
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

export function NoticiasProvider({ children }) {
  const [state, dispatch] = useReducer(noticiasReducer, initialState)
  const [loading, setLoading] = useState(false)
  const [highlightsLoaded, setHighlightsLoaded] = useState(false)
  const [noticiasLoaded, setNoticiasLoaded] = useState(false)
  const [error, setError] = useState(null)
  const { toast } = useToast()

  const loadingRef = useRef({ highlights: false, noticias: false })
  const lastFetchRef = useRef({ highlights: 0, noticias: 0 })
  const stateRef = useRef(state)
  stateRef.current = state

  // Hidrata do cache no mount — UI renderiza imediatamente sem fetch
  useEffect(() => {
    const cached = loadFromCache()
    if (!cached) return
    if (Array.isArray(cached.noticias) && cached.noticias.length) {
      dispatch({ type: 'SET_NOTICIAS', payload: cached.noticias })
      setNoticiasLoaded(true)
    }
    if (Array.isArray(cached.highlights) && cached.highlights.length) {
      dispatch({ type: 'SET_HIGHLIGHTS', payload: cached.highlights })
      setHighlightsLoaded(true)
    }
  }, [])

  const loadHighlights = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current.highlights < REVALIDATE_AFTER_MS) return
    if (loadingRef.current.highlights) return
    loadingRef.current.highlights = true
    try {
      const data = await supabaseNoticiasService.fetchHighlights({ limit: 10 })
      const prev = stateRef.current.highlights
      if (fingerprint(prev) !== fingerprint(data)) {
        dispatch({ type: 'SET_HIGHLIGHTS', payload: data })
      }
      setHighlightsLoaded(true)
      lastFetchRef.current.highlights = now
      saveToCache({ highlights: data, noticias: stateRef.current.noticias })
      setError(null)
    } catch (err) {
      console.error('[NoticiasContext] loadHighlights:', err)
      setError(err.message)
    } finally {
      loadingRef.current.highlights = false
    }
  }, [])

  const loadNoticias = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current.noticias < REVALIDATE_AFTER_MS && stateRef.current.noticias.length > 0) {
      return
    }
    if (loadingRef.current.noticias) return
    loadingRef.current.noticias = true
    setLoading(true)
    try {
      const data = await supabaseNoticiasService.fetchLatest({ limit: 200 })
      const prev = stateRef.current.noticias
      if (fingerprint(prev) !== fingerprint(data)) {
        dispatch({ type: 'SET_NOTICIAS', payload: data })
      }
      setNoticiasLoaded(true)
      lastFetchRef.current.noticias = now
      saveToCache({ noticias: data, highlights: stateRef.current.highlights })
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
    const cached = stateRef.current.byId[id]
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
  }, [toast])

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  )

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
