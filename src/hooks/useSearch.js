/**
 * useSearch — Global search hook with debounce and dual-path (mock / Supabase)
 *
 * Mock path: uses searchAll() for pages + searchAllDocuments() for documents
 * Supabase path: uses supabaseSearchService.searchGlobal() + searchAll() for pages
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { SEARCH_RESULT_TYPES } from '@/types/documents'
import { searchAll } from '@/data/searchUtils'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { searchGlobal } from '@/services/supabaseSearchService'

const DEBOUNCE_MS = 300

export function useSearch(query, filters = {}) {
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const timerRef = useRef(null)
  const abortRef = useRef(0)

  const { searchAllDocuments } = useDocumentsContext()

  // Debounced search
  useEffect(() => {
    const trimmed = (query || '').trim()

    if (!trimmed) {
      setResults([])
      setIsLoading(false)
      setError(null)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setError(null)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const callId = ++abortRef.current
      performSearch(trimmed, filters, callId)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, filters.type, filters.status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function performSearch(q, f, callId) {
    try {
      let combined = []

      // Pages always come from local search
      const localResults = searchAll(q)
      const pageResults = localResults.pages.map((p) => ({
        resultId: p.id,
        resultType: SEARCH_RESULT_TYPES.PAGE,
        titulo: p.label,
        descricao: p.descricao,
        route: p.route,
        icon: p.icon,
        categoria: p.categoria,
        rank: 1,
      }))

      if (!f.type || f.type === SEARCH_RESULT_TYPES.PAGE) {
        combined = [...pageResults]
      }

      // Supabase path: call rpc_search_global for documents + incidents + planos
      const filterType = f.type === SEARCH_RESULT_TYPES.PAGE ? null : (f.type || null)
      if (!f.type || f.type !== SEARCH_RESULT_TYPES.PAGE) {
        const supaResults = await searchGlobal(q, {
          type: filterType,
          status: f.status || null,
          limit: 30,
        })
        combined = [...combined, ...supaResults]
      }

      // Sort by rank descending
      combined.sort((a, b) => (b.rank || 0) - (a.rank || 0))

      // Only update if this is still the latest search
      if (callId === abortRef.current) {
        setResults(combined)
        setHasSearched(true)
        setIsLoading(false)
      }
    } catch (err) {
      if (callId === abortRef.current) {
        console.error('[useSearch] Error:', err)
        setError(err.message || 'Erro na busca')
        setIsLoading(false)
        setHasSearched(true)
      }
    }
  }

  // Faceted counts
  const facets = useMemo(() => {
    const counts = {
      [SEARCH_RESULT_TYPES.PAGE]: 0,
      [SEARCH_RESULT_TYPES.DOCUMENTO]: 0,
      [SEARCH_RESULT_TYPES.INCIDENTE]: 0,
      [SEARCH_RESULT_TYPES.PLANO_ACAO]: 0,
    }
    for (const r of results) {
      if (counts[r.resultType] !== undefined) {
        counts[r.resultType]++
      }
    }
    counts.total = results.length
    return counts
  }, [results])

  return { results, facets, isLoading, error, hasSearched }
}
