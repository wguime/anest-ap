/**
 * useRosterAnestesistas — roster de anestesistas (login estável) + dicionário de apelidos.
 *
 * Junta os anestesistas/residentes ativos (UsersManagementContext, reativo) com os
 * apelidos de escala (tabela escala_anestesista_alias). Expõe:
 *   - roster:   [{ uid, nome, apelidos:[] }]
 *   - options:  p/ <Select> (value=uid, label=NOME COMPLETO; apelidos vão em
 *               `keywords`, que o Select busca sem exibir — lista limpa)
 *   - resolver: (apelidoBruto) => uid|null
 *   - upsertAlias / refresh
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { normalizeRole } from '@/utils/userTypes'
import svc, { buildResolver } from '@/services/supabaseEscalaAnestesistaService'
import { titleCaseNome } from '@/lib/colunaLiberacao'

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

  // Rótulo = só o NOME COMPLETO (pedido do dono 26/07): "NOME (APELIDO/APELIDO)"
  // deixava a lista poluída e difícil de varrer. Os apelidos continuam achando a
  // pessoa na busca via `keywords`, sem aparecer na lista.
  const options = useMemo(
    () => roster.map((r) => ({
      value: r.uid,
      label: titleCaseNome(r.nome),
      keywords: r.apelidos.join(' '),
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
