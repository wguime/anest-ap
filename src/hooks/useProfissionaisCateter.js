/**
 * useProfissionaisCateter — Busca anestesiologistas e residentes ativos
 * para popular Selects no módulo de Cateter Peridural.
 */
import { useState, useEffect } from 'react'
import supabaseUsersService from '@/services/supabaseUsersService'

export default function useProfissionaisCateter() {
  const [anestesiologistas, setAnestesiologistas] = useState([])
  const [residentes, setResidentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [anest, resid] = await Promise.all([
          supabaseUsersService.fetchAllUsers({ role: 'anestesiologista', active: true }),
          supabaseUsersService.fetchAllUsers({ role: 'medico-residente', active: true }),
        ])

        if (cancelled) return

        setAnestesiologistas(
          anest.map((u) => ({ value: u.nome, label: u.nome }))
        )
        setResidentes(
          resid.map((u) => ({ value: u.nome, label: u.nome }))
        )
      } catch (err) {
        console.error('[useProfissionaisCateter] Error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { anestesiologistas, residentes, loading }
}
