/**
 * useRosterAnestesistas — roster de anestesistas (login estável) + dicionário de apelidos.
 *
 * SÓ anestesiologistas (dono 29/07): o residente ACOMPANHA o caso, não responde por
 * ele — misturado no seletor, poluía a lista e dava para escalar um residente como
 * responsável por engano. Os residentes têm lista própria em `useRosterResidentes`,
 * que alimenta o campo Residente DENTRO do caso.
 *
 * Junta os anestesiologistas ativos (UsersManagementContext, reativo) com os
 * apelidos de escala (tabela escala_anestesista_alias). Expõe:
 *   - roster:   [{ uid, nome, apelidos:[] }]
 *   - options:  p/ <Select> (value=uid, label=NOME COMPLETO; apelidos vão em
 *               `keywords`, que o Select busca sem exibir — lista limpa)
 *   - resolver: (apelidoBruto) => uid|null
 *   - upsertAlias / refresh
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { normalizeRole, ehContaDeTeste } from '@/utils/userTypes'
import svc, { buildResolver } from '@/services/supabaseEscalaAnestesistaService'
import { titleCaseNome } from '@/lib/colunaLiberacao'

// Cache local do roster derivado (SWR). O UsersManagementContext é Tier 2 —
// fetch adiado 2s — então todo lugar que resolve apelido→nome (card da Home,
// Liberações) abria com o TEXTO CRU do rodapé e trocava para o nome completo
// segundos depois (bug relatado 12/08: "aparece o apelido e depois o nome").
// O último roster bom fica em localStorage e hidrata o hook no primeiro
// render; quando os dados vivos chegam, substituem (e reescrevem o cache).
// Só dados operacionais internos (nome/uid/apelido de staff — mesmo padrão do
// cache de férias em pegaPlantaoApi); nunca dado de paciente.
const ROSTER_CACHE_KEY = 'anest-roster-anestesistas-v1'

function lerRosterCache() {
  try {
    const raw = localStorage.getItem(ROSTER_CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!Array.isArray(c?.roster) || !Array.isArray(c?.duplicadas) || !Array.isArray(c?.aliases)) return null
    return c
  } catch {
    return null // localStorage indisponível/corrompido — segue sem cache
  }
}

let _ultimoCacheJson = null // evita N writes idênticos (o hook tem várias instâncias)
function gravarRosterCache(payload) {
  try {
    const json = JSON.stringify(payload)
    if (json === _ultimoCacheJson) return
    _ultimoCacheJson = json
    localStorage.setItem(ROSTER_CACHE_KEY, json)
  } catch { /* quota/private mode — cache é só aceleração */ }
}

/**
 * @param {{ inerte?: boolean }} [opts]  `inerte`: a instância não busca os apelidos — para
 *   componente que recebe o roster de fora (as abas do lote usam o do pai, Onda 2 item 2.5)
 *   e só chama o hook por causa da regra dos hooks. Sem isso cada aba fazia a sua busca e
 *   tinha o seu `resolver`, e a chave da duplicidade divergia entre elas (audit A9).
 */
export default function useRosterAnestesistas({ inerte = false } = {}) {
  const { users } = useUsersManagement()
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)
  const [cacheInicial] = useState(() => lerRosterCache())

  const refresh = useCallback(async () => {
    try {
      setAliases(await svc.fetchAliases())
    } catch {
      /* RLS/cold start — sem aliases ainda */
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { if (!inerte) refresh() }, [refresh, inerte])

  // Aliases vivos vencem; enquanto não chegam, o cache resolve (o dicionário
  // muda raramente e o dado vivo corrige em segundos). `aliases` cru — usado
  // pela VinculosSheet e pelo aprendizado de apelido — segue SÓ o dado vivo.
  const aliasesEfetivos = aliases.length > 0 ? aliases : (cacheInicial?.aliases ?? aliases)
  const usersProntos = (users?.length ?? 0) > 0

  // UMA PESSOA, UM NOME (pedido do dono 29/07): quem tem 2 contas aparecia 2× na
  // lista de escolha. A 2ª conta (`contaDuplicadaDe`, migration 20260729100000)
  // sai da lista mas continua RESOLVENDO para o perfil principal — registro
  // antigo salvo nela não pode perder o nome. A conta segue ativa para login.
  const { roster, duplicadas } = useMemo(() => {
    // Users ainda não carregados (Tier 2, +2s) → último roster bom do cache
    if (!usersProntos && cacheInicial) {
      return {
        roster: cacheInicial.roster,
        duplicadas: new Map(cacheInicial.duplicadas),
      }
    }
    const byUid = new Map()
    const duplicadas = new Map() // uid secundário → uid principal
    // APELIDO NO DICIONÁRIO = responde por casos (fix 30/07: a DANIELA sumiu do
    // seletor). O filtro por cargo de 29/07 continua valendo — residente não
    // polui a lista —, mas quem TEM apelido na escala já foi vinculado pelo
    // dono/secretária justamente porque assume casos, independente do cargo no
    // cadastro (Daniela é medico-residente e responde por casos no HRO; era a
    // única nessa condição no levantamento). Critério baseado em dado curado,
    // sem mexer no cargo — que alimenta o módulo de residência.
    const uidsComAlias = new Set(aliasesEfetivos.map((a) => a.userId))
    for (const u of users || []) {
      if (u?.active === false || !u?.nome) continue
      if (ehContaDeTeste(u)) continue
      if (normalizeRole(u.role) !== 'anestesiologista' && !uidsComAlias.has(u.id)) continue
      if (u.contaDuplicadaDe) { duplicadas.set(u.id, u.contaDuplicadaDe); continue }
      byUid.set(u.id, { uid: u.id, nome: u.nome, apelidos: [] })
    }
    for (const a of aliasesEfetivos) {
      // apelido gravado na conta secundária vale para a principal
      const r = byUid.get(duplicadas.get(a.userId) || a.userId)
      if (r && !r.apelidos.includes(a.apelido)) r.apelidos.push(a.apelido)
    }
    return {
      roster: [...byUid.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      duplicadas,
    }
  }, [users, aliasesEfetivos, usersProntos, cacheInicial])

  // Write-through: roster derivado de dados VIVOS vira o cache da próxima sessão
  useEffect(() => {
    if (!usersProntos || roster.length === 0) return
    gravarRosterCache({ roster, duplicadas: [...duplicadas], aliases: aliasesEfetivos })
  }, [usersProntos, roster, duplicadas, aliasesEfetivos])

  /** uid da conta secundária → uid do perfil principal (identidade canônica). */
  const canonicalUid = useCallback(
    (uid) => (uid && duplicadas.get(uid)) || uid || null,
    [duplicadas]
  )

  const resolverBruto = useMemo(() => buildResolver(aliasesEfetivos), [aliasesEfetivos])
  const resolver = useCallback((nome) => canonicalUid(resolverBruto(nome)), [resolverBruto, canonicalUid])

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

  // inclui as contas secundárias apontando para o MESMO objeto do principal: um
  // caso salvo na 2ª conta continua exibindo o nome da pessoa (sem isso ele
  // ficaria sem rótulo). Só `options` (o picker) é que não as lista.
  const rosterByUid = useMemo(() => {
    const m = new Map(roster.map((r) => [r.uid, r]))
    for (const [dup, principal] of duplicadas) {
      const r = m.get(principal)
      if (r) m.set(dup, r)
    }
    return m
  }, [roster, duplicadas])

  const upsertAlias = useCallback(async (args) => {
    const saved = await svc.upsertAlias(args)
    await refresh()
    return saved
  }, [refresh])

  const removeAlias = useCallback(async (id) => {
    await svc.removeAlias(id)
    await refresh()
  }, [refresh])

  // `pronto` = o hook TEM como resolver apelido→nome agora (cache da última
  // sessão ou dados vivos). Quem exibe nome usa isto para segurar o skeleton
  // em vez de mostrar o texto cru do rodapé e trocar depois (flicker 12-13/08).
  const pronto = usersProntos || cacheInicial != null

  return { roster, rosterByUid, aliases, resolver, canonicalUid, options, loading, pronto, refresh, upsertAlias, removeAlias }
}
