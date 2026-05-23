/**
 * useProfissionaisCateter — Busca anestesiologistas e residentes ativos
 * para popular Selects no módulo de Cateter Peridural.
 */
import { useState, useEffect } from 'react'
import supabaseUsersService from '@/services/supabaseUsersService'
import { normalizeRole } from '@/utils/userTypes'

export default function useProfissionaisCateter() {
  const [anestesiologistas, setAnestesiologistas] = useState([])
  const [residentes, setResidentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Busca todos os ativos e normaliza role no cliente — captura aliases
        // legados ('medico', 'medico-staff', 'anestesista', 'residente'...) que
        // um eq('role', 'anestesiologista') deixaria de fora.
        const allActive = await supabaseUsersService.fetchAllUsers({ active: true })
        if (cancelled) return

        const anest = []
        const resid = []
        for (const u of allActive) {
          const canonical = normalizeRole(u.role)
          if (canonical === 'anestesiologista') {
            anest.push({ value: u.nome, label: u.nome })
          } else if (canonical === 'medico-residente') {
            resid.push({ value: u.nome, label: u.nome })
          }
        }

        setAnestesiologistas(anest)
        setResidentes(resid)
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
