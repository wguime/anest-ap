/**
 * useProfissionaisCateter — Deriva listas de anestesiologistas + residentes ativos
 * a partir do UsersManagementContext (que já mantém realtime subscription em
 * profiles). Substitui o fetch próprio anterior, garantindo reatividade
 * automática quando user:
 *   - é criado (rpc_create_profile dispara INSERT)
 *   - muda role (UPDATE em profiles.role)
 *   - é desativado (UPDATE em profiles.active)
 *   - é deletado (DELETE em profiles)
 *
 * Filtro: normalizeRole captura aliases legados ('medico', 'anestesista', etc).
 */
import { useMemo } from 'react'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { normalizeRole, ehContaDeTeste } from '@/utils/userTypes'

export default function useProfissionaisCateter() {
  const { users, loading } = useUsersManagement()

  const { anestesiologistas, residentes } = useMemo(() => {
    const anest = []
    const resid = []
    for (const u of users || []) {
      if (u?.active === false) continue
      if (!u?.nome) continue
      if (ehContaDeTeste(u)) continue // conta e2e nunca entra em lista de gente real
      const canonical = normalizeRole(u.role)
      if (canonical === 'anestesiologista') {
        anest.push({ value: u.nome, label: u.nome })
      } else if (canonical === 'medico-residente') {
        resid.push({ value: u.nome, label: u.nome })
      }
    }
    // Ordena alfabeticamente (DB já vem ordenado mas refetches optimistic
    // podem misturar ordem)
    const sortFn = (a, b) => a.label.localeCompare(b.label, 'pt-BR')
    anest.sort(sortFn)
    resid.sort(sortFn)
    return { anestesiologistas: anest, residentes: resid }
  }, [users])

  return { anestesiologistas, residentes, loading }
}
