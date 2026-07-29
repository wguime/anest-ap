/**
 * Roster de RESIDENTES (dono 29/07) — lista própria, separada da de anestesistas.
 * Os residentes estão cadastrados só com o PRIMEIRO NOME e está correto assim:
 * não há repetido entre eles. Este teste trava as duas pontas da decisão — só
 * residentes entram aqui, e o rótulo é o nome como está no cadastro.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useRosterResidentes from '@/hooks/useRosterResidentes'

const USERS = [
  { id: 'uid-rodrigo', nome: 'Rodrigo', role: 'medico-residente', active: true },
  { id: 'uid-augusto', nome: 'Augusto', role: 'medico-residente', active: true },
  { id: 'uid-jacinta', nome: 'Jacinta', role: 'residente', active: true }, // alias legado do cargo
  { id: 'uid-fora', nome: 'Ex-residente', role: 'medico-residente', active: false },
  { id: 'uid-dup', nome: 'Augusto (2ª conta)', role: 'medico-residente', active: true, contaDuplicadaDe: 'uid-augusto' },
  { id: 'uid-anest', nome: 'MARCOS TADEU CURY', role: 'anestesiologista', active: true },
]

vi.mock('@/contexts/UsersManagementContext', () => ({ useUsersManagement: () => ({ users: USERS }) }))

describe('useRosterResidentes', () => {
  it('lista só residentes ativos, em ordem alfabética, com o nome do cadastro', () => {
    const { result } = renderHook(() => useRosterResidentes())
    expect(result.current.options.map((o) => o.label)).toEqual(['Augusto', 'Jacinta', 'Rodrigo'])
  })

  it('anestesiologista, inativo e 2ª conta ficam de fora', () => {
    const { result } = renderHook(() => useRosterResidentes())
    const uids = result.current.options.map((o) => o.value)
    expect(uids).not.toContain('uid-anest')
    expect(uids).not.toContain('uid-fora')
    expect(uids).not.toContain('uid-dup')
  })

  it('residenteByUid devolve a pessoa (caso salvo continua exibindo o nome)', () => {
    const { result } = renderHook(() => useRosterResidentes())
    expect(result.current.residenteByUid.get('uid-augusto')?.nome).toBe('Augusto')
  })
})
