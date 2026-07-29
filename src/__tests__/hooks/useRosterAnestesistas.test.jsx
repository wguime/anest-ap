/**
 * Roster de anestesistas — UMA PESSOA, UM NOME (pedido do dono 29/07): quem tem
 * duas contas aparecia duas vezes na lista de escolha ("Guilherme Melo" e
 * "Guilherme Souza Melo"). A 2ª conta sai da lista mas continua resolvendo para
 * o perfil principal: registro antigo salvo nela não pode perder o nome.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'

const USERS = [
  { id: 'uid-principal', nome: 'GUILHERME MELO', role: 'anestesiologista', active: true },
  { id: 'uid-2a-conta', nome: 'GUILHERME SOUZA MELO', role: 'anestesiologista', active: true, contaDuplicadaDe: 'uid-principal' },
  { id: 'uid-cury', nome: 'MARCOS TADEU CURY', role: 'anestesiologista', active: true },
  { id: 'uid-inativo', nome: 'FULANO INATIVO', role: 'anestesiologista', active: false },
  { id: 'uid-secretaria', nome: 'SECRETARIA', role: 'secretaria', active: true },
  { id: 'uid-augusto', nome: 'Augusto', role: 'medico-residente', active: true },
  { id: 'uid-jacinta', nome: 'Jacinta', role: 'residente', active: true }, // alias legado do cargo
]

vi.mock('@/contexts/UsersManagementContext', () => ({ useUsersManagement: () => ({ users: USERS }) }))
vi.mock('@/services/supabaseEscalaAnestesistaService', () => ({
  default: { fetchAliases: async () => ([
    { id: 1, apelido: 'MELO', userId: 'uid-principal' },
    { id: 2, apelido: 'GUILHERME S.', userId: 'uid-2a-conta' }, // apelido gravado na 2ª conta
    { id: 3, apelido: 'CURY', userId: 'uid-cury' },
  ]) },
  buildResolver: (aliases) => (nome) =>
    aliases.find((a) => a.apelido === String(nome || '').trim().toUpperCase())?.userId || null,
}))

const render = async () => {
  const h = renderHook(() => useRosterAnestesistas())
  await waitFor(() => expect(h.result.current.loading).toBe(false))
  return h
}

describe('useRosterAnestesistas — conta duplicada', () => {
  it('a 2ª conta NÃO aparece na lista de escolha', async () => {
    const { result } = await render()
    const nomes = result.current.options.map((o) => o.label)
    expect(nomes).toEqual(['Guilherme Melo', 'Marcos Tadeu Cury'])
    expect(nomes.filter((n) => /Guilherme/.test(n))).toHaveLength(1)
  })

  it('o uid da 2ª conta ainda devolve a pessoa (registro antigo não perde o nome)', async () => {
    const { result } = await render()
    expect(result.current.rosterByUid.get('uid-2a-conta')?.nome).toBe('GUILHERME MELO')
    expect(result.current.rosterByUid.get('uid-2a-conta')?.uid).toBe('uid-principal')
  })

  it('apelido gravado na 2ª conta resolve para o perfil principal', async () => {
    const { result } = await render()
    expect(result.current.resolver('GUILHERME S.')).toBe('uid-principal')
    expect(result.current.resolver('MELO')).toBe('uid-principal')
    expect(result.current.canonicalUid('uid-2a-conta')).toBe('uid-principal')
    expect(result.current.canonicalUid('uid-cury')).toBe('uid-cury')
  })

  it('o apelido da 2ª conta entra na busca do principal (keywords)', async () => {
    const { result } = await render()
    const opt = result.current.options.find((o) => o.value === 'uid-principal')
    expect(opt.keywords).toContain('MELO')
    expect(opt.keywords).toContain('GUILHERME S.')
  })

  it('inativo e quem não é do corpo clínico seguem fora da lista', async () => {
    const { result } = await render()
    const uids = result.current.options.map((o) => o.value)
    expect(uids).not.toContain('uid-inativo')
    expect(uids).not.toContain('uid-secretaria')
  })

  // Dono 29/07: o residente ACOMPANHA o caso, não responde por ele — misturado no
  // seletor, dava para escalá-lo como responsável por engano. Ele tem lista própria
  // (useRosterResidentes) e sai de TODO seletor de anestesista, que lê deste roster.
  it('residente NÃO aparece em nenhum seletor de anestesista', async () => {
    const { result } = await render()
    const uids = result.current.options.map((o) => o.value)
    expect(uids).not.toContain('uid-augusto')
    expect(uids).not.toContain('uid-jacinta') // cargo em alias legado também fica fora
    expect(result.current.roster.map((r) => r.uid)).toEqual(['uid-principal', 'uid-cury'])
  })
})
