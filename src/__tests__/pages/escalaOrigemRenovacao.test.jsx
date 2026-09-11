import { beforeEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { EscalaCirurgicaProvider, useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'

const { svc, toast } = vi.hoisted(() => ({
  svc: { fetchEscala: vi.fn(), fetchP4Hospital: vi.fn(async () => null), patchLiberacao: vi.fn(async () => {}), patchLinhaOverride: vi.fn(async () => {}) },
  toast: vi.fn(),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svc }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({ createReliableSubscription: () => ({ cleanup() {} }) }))
vi.mock('@/design-system/components/ui/toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/data/escalaCirurgicaDemo', () => ({ getDemoEscala: () => null }))
vi.mock('@/lib/devClock', () => ({ agora: () => new Date('2026-09-08T10:00:00-03:00') }))

beforeEach(() => vi.clearAllMocks())
const wrapper = ({ children }) => <EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider>

function fila(escala) {
  const origemManual = Object.fromEntries(Object.entries(escala.linhaOverrides)
    .filter(([k, v]) => k.startsWith('matutino:') && v.origem)
    .map(([k, v]) => [k.slice(9), { hospital: v.origem }]))
  return gerarColunaLiberacao([], [], { ajudaExterna: ['ANA', 'BETO'], origemManual }).linhas.map((l) => l.chave)
}

describe('renovar a linha preserva de qual hospital a ajuda veio', () => {
  it.each(['toggleLiberacao', 'toggleEscalado'])('%s preserva origem, fila e o outro turno', async (action) => {
    const escala = {
      id: 'e1', hospital: 'unimed', data: '2026-09-08', casos: [], ordemLiberacao: [],
      liberacoes: action === 'toggleLiberacao' ? { 'matutino:ANA': { liberadoEm: 'antes' } } : {},
      linhaOverrides: {
        'matutino:ANA': { origem: 'materno', local: 'SALA ANTIGA', termino: '12:00' },
        'matutino:BETO': { origem: 'hro' },
        'vespertino:ANA': { origem: 'hro', local: 'OUTRO TURNO' },
      },
    }
    svc.fetchEscala.mockImplementation(async (_dia, h) => h === 'unimed' ? escala : null)
    const { result } = renderHook(() => useEscalaCirurgica(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const antes = fila(escala)
    expect(antes).toEqual(['BETO', 'ANA'])
    await act(async () => { await result.current[action](escala, 'ANA', { userId: 'secretaria-real' }, 'matutino') })
    const atual = result.current.escalas.unimed
    expect(atual.linhaOverrides['matutino:ANA']).toMatchObject({ origem: 'materno', por: 'secretaria-real' })
    expect(atual.linhaOverrides['matutino:ANA'].local).toBeUndefined()
    expect(atual.linhaOverrides['vespertino:ANA']).toEqual(escala.linhaOverrides['vespertino:ANA'])
    expect(fila(atual)).toEqual(antes)
    expect(svc.patchLinhaOverride).toHaveBeenCalledWith('e1', 'matutino:ANA', expect.objectContaining({ origem: 'materno' }))
  })
})


it('desfazer liberação por UID preserva a identidade guardada no apelido do mesmo turno', async () => {
  const flags = { origem: 'materno', assumidaPor: { uid: 'uid-beto', nome: 'BETO' },
    trocaCom: { uid: 'uid-carla', nome: 'CARLA' }, duplicidade: 'intencional', conferido: true }
  const escala = { id: 'e1', hospital: 'unimed', data: '2026-09-08', casos: [],
    liberacoes: { 'matutino:ANA': { liberadoEm: 'antes' } },
    linhaOverrides: { 'matutino:ANA': flags, 'vespertino:ANA': { origem: 'hro' } } }
  svc.fetchEscala.mockImplementation(async (_dia, h) => h === 'unimed' ? escala : null)
  const { result } = renderHook(() => useEscalaCirurgica(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.toggleLiberacao(escala,
    { chave: 'uid-ana', anestesista: 'ANA' }, { userId: 'secretaria-real' }, 'matutino') })
  expect(result.current.escalas.unimed.linhaOverrides['matutino:uid-ana']).toMatchObject(flags)
  expect(result.current.escalas.unimed.linhaOverrides['matutino:ANA']).toBeUndefined()
  expect(result.current.escalas.unimed.linhaOverrides['vespertino:ANA']).toEqual({ origem: 'hro' })
  expect(svc.patchLinhaOverride).toHaveBeenCalledWith('e1', 'matutino:uid-ana', expect.objectContaining(flags))
})
