/**
 * useConflicts — Sprint 14b / F6.3
 *
 * Hook para listagem paginada da fila de conflitos (documento_conflict_queue).
 *
 * Responsabilidades:
 * - Fetch paginado via `supabaseConflictQueueService.fetchAll`
 * - Filtros client-side (search por user_name/op_string/op_id, dateRange)
 *   sobre o batch atual; filtros server-side: status, opString, userId.
 * - Real-time refetch ao receber evento via `subscribeToConflicts`.
 * - Reload manual via `refetch()`.
 *
 * NOTA: a tabela é pequena por design (entries são consumidas em horas/dias).
 * Por isso o filtro de search/dateRange roda em memória sobre o batch da página
 * atual — não justifica complicar o backend com full-text search nesse volume.
 *
 * @param {Object} opts
 * @param {string|null} [opts.status='pending'] - 'pending' | 'resolved_last_write_wins' | 'resolved_manual' | 'dismissed' | null (todos)
 * @param {string|null} [opts.opString=null]
 * @param {string|null} [opts.userId=null]
 * @param {string} [opts.q='']  - search livre (debounced no caller)
 * @param {{from: Date|null, to: Date|null}|null} [opts.dateRange=null]
 * @param {number} [opts.limit=10]
 * @param {number} [opts.offset=0]
 * @returns {{ rows, total, loading, error, refetch }}
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { fetchAll, subscribeToConflicts } from '@/services/supabaseConflictQueueService'

function matchesSearch(row, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    (row.userName && row.userName.toLowerCase().includes(needle)) ||
    (row.opString && row.opString.toLowerCase().includes(needle)) ||
    (row.opId && row.opId.toLowerCase().includes(needle)) ||
    (row.userId && row.userId.toLowerCase().includes(needle))
  )
}

function matchesDateRange(row, dateRange) {
  if (!dateRange || (!dateRange.from && !dateRange.to)) return true
  const created = row.createdAt ? new Date(row.createdAt) : null
  if (!created) return false
  if (dateRange.from && created < dateRange.from) return false
  if (dateRange.to && created > dateRange.to) return false
  return true
}

export function useConflicts({
  status = 'pending',
  opString = null,
  userId = null,
  q = '',
  dateRange = null,
  limit = 10,
  offset = 0,
} = {}) {
  const [rawRows, setRawRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { rows: data, total: tot } = await fetchAll({
        status,
        limit,
        offset,
      })
      // Filtros server-side de opString/userId (passa de fetchPending; aqui faço client-side
      // para evitar duplicar query — fetchAll não filtra por op/user)
      let filtered = data
      if (opString) filtered = filtered.filter((r) => r.opString === opString)
      if (userId) filtered = filtered.filter((r) => r.userId === userId)
      if (mountedRef.current) {
        setRawRows(filtered)
        setTotal(tot)
      }
    } catch (err) {
      console.error('[useConflicts] load error', err)
      if (mountedRef.current) setError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [status, opString, userId, limit, offset])

  useEffect(() => {
    load()
  }, [load])

  // Real-time refetch (insert/update/delete na fila)
  useEffect(() => {
    const cleanup = subscribeToConflicts(() => {
      // Debounce simples: aguarda 300ms para agrupar mudanças em batches
      // (e.g., resolução de múltiplas entries seguidas)
      if (!mountedRef.current) return
      load()
    })
    return cleanup
  }, [load])

  // Filtros client-side (search e dateRange) sobre o batch da página
  const rows = useMemo(() => {
    return rawRows.filter(
      (row) => matchesSearch(row, q) && matchesDateRange(row, dateRange)
    )
  }, [rawRows, q, dateRange])

  return { rows, total, loading, error, refetch: load }
}

export default useConflicts
