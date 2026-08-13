/**
 * Roster de anestesistas — cache local (SWR) contra o flicker apelido→nome.
 *
 * O UsersManagementContext é Tier 2 (fetch adiado 2s), então o card da Home e
 * a aba Liberações abriam mostrando o TEXTO CRU do rodapé ("DIDO") e trocavam
 * para o nome completo segundos depois (bug relatado 12/08). O último roster
 * bom fica em localStorage e hidrata o hook já no primeiro render; o dado vivo
 * substitui quando chega e reescreve o cache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const CACHE_KEY = 'anest-roster-anestesistas-v1'

// users controlável por teste (Tier 2: começa vazio = ainda não carregado)
const estado = { users: [] }
vi.mock('@/contexts/UsersManagementContext', () => ({
  useUsersManagement: () => ({ users: estado.users }),
}))

const fetchAliases = vi.fn(async () => [])
vi.mock('@/services/supabaseEscalaAnestesistaService', () => ({
  default: {
    fetchAliases: (...a) => fetchAliases(...a),
    upsertAlias: vi.fn(),
    removeAlias: vi.fn(),
  },
  buildResolver: (aliases) => (nome) =>
    aliases.find((a) => a.apelido === String(nome || '').trim().toUpperCase())?.userId || null,
}))

const CACHE = {
  roster: [
    { uid: 'uid-melo', nome: 'GUILHERME MELO', apelidos: ['MELO'] },
    { uid: 'uid-cury', nome: 'MARCOS TADEU CURY', apelidos: ['CURY'] },
  ],
  duplicadas: [['uid-2a-conta', 'uid-melo']],
  aliases: [
    { id: 1, apelido: 'MELO', userId: 'uid-melo' },
    { id: 3, apelido: 'CURY', userId: 'uid-cury' },
  ],
}

const montar = async () => (await import('@/hooks/useRosterAnestesistas')).default

describe('useRosterAnestesistas — cache local (flicker apelido→nome)', () => {
  beforeEach(() => {
    localStorage.clear()
    estado.users = []
    fetchAliases.mockReset()
    fetchAliases.mockResolvedValue([])
  })

  it('sem users carregados (Tier 2), o roster sai do cache JÁ no primeiro render', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(CACHE))
    const useRoster = await montar()
    const { result } = renderHook(() => useRoster())

    // Primeiro render, síncrono — é o que o card da Home vê antes dos 2s
    expect(result.current.rosterByUid.get('uid-melo')?.nome).toBe('GUILHERME MELO')
    expect(result.current.resolver('MELO')).toBe('uid-melo')
    // conta duplicada do cache também resolve para o perfil principal
    expect(result.current.rosterByUid.get('uid-2a-conta')?.nome).toBe('GUILHERME MELO')
  })

  it('sem cache e sem users, segue vazio (comportamento antigo intacto)', async () => {
    const useRoster = await montar()
    const { result } = renderHook(() => useRoster())
    expect(result.current.roster).toEqual([])
    expect(result.current.resolver('MELO')).toBe(null)
  })

  it('dado vivo substitui o cache e o reescreve para a próxima sessão', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...CACHE,
      roster: [{ uid: 'uid-melo', nome: 'NOME VELHO NO CACHE', apelidos: ['MELO'] }],
    }))
    estado.users = [
      { id: 'uid-melo', nome: 'GUILHERME MELO', role: 'anestesiologista', active: true },
    ]
    fetchAliases.mockResolvedValue([{ id: 1, apelido: 'MELO', userId: 'uid-melo' }])

    const useRoster = await montar()
    const { result } = renderHook(() => useRoster())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // o vivo vence o cache…
    expect(result.current.rosterByUid.get('uid-melo')?.nome).toBe('GUILHERME MELO')
    // …e o cache foi reescrito com o dado vivo
    await waitFor(() => {
      const gravado = JSON.parse(localStorage.getItem(CACHE_KEY))
      expect(gravado.roster[0].nome).toBe('GUILHERME MELO')
    })
  })

  it('cache corrompido não quebra o hook', async () => {
    localStorage.setItem(CACHE_KEY, '{nao é json')
    const useRoster = await montar()
    const { result } = renderHook(() => useRoster())
    expect(result.current.roster).toEqual([])
  })
})
