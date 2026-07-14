/**
 * useRosterAnestesistas — roster de anestesistas (login estável) + dicionário de apelidos.
 *
 * Junta os anestesistas/residentes ativos (UsersManagementContext, reativo) com os
 * apelidos de escala (tabela escala_anestesista_alias). Expõe:
 *   - roster:   [{ uid, nome, apelidos:[] }]
 *   - options:  p/ <Select> (value=uid, label=nome + apelidos)
 *   - resolver: (apelidoBruto) => uid|null
 *   - upsertAlias / refresh
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { normalizeRole } from '@/utils/userTypes'
import svc, { buildResolver } from '@/services/supabaseEscalaAnestesistaService'

export default function useRosterAnestesistas() {
  const { users } = useUsersManagement()
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setAliases(await svc.fetchAliases())
    } catch {
      /* RLS/cold start — sem aliases ainda */
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const roster = useMemo(() => {
    const byUid = new Map()
    for (const u of users || []) {
      if (u?.active === false || !u?.nome) continue
      if (!['anestesiologista', 'medico-residente'].includes(normalizeRole(u.role))) continue
      byUid.set(u.id, { uid: u.id, nome: u.nome, apelidos: [] })
    }
    for (const a of aliases) {
      const r = byUid.get(a.userId)
      if (r) r.apelidos.push(a.apelido)
    }
    return [...byUid.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [users, aliases])

  const resolver = useMemo(() => buildResolver(aliases), [aliases])

  const options = useMemo(
    () => roster.map((r) => ({
      value: r.uid,
      label: r.apelidos.length ? `${r.nome} (${r.apelidos.join('/')})` : r.nome,
    })),
    [roster]
  )

  const rosterByUid = useMemo(() => new Map(roster.map((r) => [r.uid, r])), [roster])

  const upsertAlias = useCallback(async (args) => {
    const saved = await svc.upsertAlias(args)
    await refresh()
    return saved
  }, [refresh])

  const removeAlias = useCallback(async (id) => {
    await svc.removeAlias(id)
    await refresh()
  }, [refresh])

  return { roster, rosterByUid, aliases, resolver, options, loading, refresh, upsertAlias, removeAlias }
}
