/**
 * Regressão 08/08 — "evoluí o cateter e o aviso de falta de evolução continuou".
 *
 * O trigger tr_cateter_touch_ultima_avaliacao atualiza ultima_avaliacao_at no
 * banco, mas o insert do followup NÃO devolve a linha do cateter e a tabela
 * cateteres_peridural não estava na publicação supabase_realtime — então nada
 * chegava ao cliente e o card seguia marcando "sem evolução há Xh" até o app
 * recarregar. O context passa a espelhar o trigger localmente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as React from 'react'

const CATETER_ID = 'cat-1'

const { mockCreateFollowup, mockUpdateFollowup, mockFetchAll } = vi.hoisted(() => ({
  mockCreateFollowup: vi.fn(),
  mockUpdateFollowup: vi.fn(),
  mockFetchAll: vi.fn(),
}))

vi.mock('@/services/supabaseCateterPeridualService', () => ({
  default: {
    fetchAll: mockFetchAll,
    createFollowup: mockCreateFollowup,
    updateFollowup: mockUpdateFollowup,
    create: vi.fn(),
    update: vi.fn(),
    markAsRemoved: vi.fn(),
    fetchFollowups: vi.fn(() => Promise.resolve([])),
  },
  cateterToCamelCase: (r) => r,
}))

vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: vi.fn() }),
}))

vi.mock('@/contexts/DeferredReadyContext', () => ({ useDeferredReady: () => true }))

const { CateterPeridualProvider, useCateterPeridural } = await import(
  '@/contexts/CateterPeridualContext'
)

const USER = { userId: 'user-1', userName: 'Dra. Teste' }
const wrapper = ({ children }) => (
  <CateterPeridualProvider>{children}</CateterPeridualProvider>
)

async function renderComCateter(ultimaAvaliacaoAt) {
  mockFetchAll.mockResolvedValue([
    {
      id: CATETER_ID,
      status: 'ativo',
      hospital: 'unimed',
      dataInsercao: '2026-08-06T13:45:00Z',
      ultimaAvaliacaoAt,
    },
  ])
  const { result } = renderHook(() => useCateterPeridural(), { wrapper })
  await waitFor(() => expect(result.current.cateteres).toHaveLength(1))
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CateterPeridualContext — ultima_avaliacao_at após evoluir', () => {
  it('addFollowup atualiza ultimaAvaliacaoAt do cateter na hora', async () => {
    const result = await renderComCateter('2026-08-07T13:16:00Z')
    mockCreateFollowup.mockResolvedValue({
      id: 'fu-1',
      cateterId: CATETER_ID,
      diaPo: 2,
      dataAvaliacao: '2026-08-08T14:41:00Z',
    })

    await act(async () => {
      await result.current.addFollowup({ cateterId: CATETER_ID, diaPo: 2 }, USER)
    })

    expect(result.current.cateteres[0].ultimaAvaliacaoAt).toBe('2026-08-08T14:41:00Z')
  })

  it('primeira evolução de cateter nunca evoluído preenche o campo', async () => {
    const result = await renderComCateter(null)
    mockCreateFollowup.mockResolvedValue({
      id: 'fu-1',
      cateterId: CATETER_ID,
      diaPo: 1,
      dataAvaliacao: '2026-08-08T14:41:00Z',
    })

    await act(async () => {
      await result.current.addFollowup({ cateterId: CATETER_ID, diaPo: 1 }, USER)
    })

    expect(result.current.cateteres[0].ultimaAvaliacaoAt).toBe('2026-08-08T14:41:00Z')
  })

  it('editar uma evolução ANTIGA não regride o campo (GREATEST, como o trigger)', async () => {
    const result = await renderComCateter('2026-08-08T14:41:00Z')
    mockUpdateFollowup.mockResolvedValue({
      id: 'fu-antigo',
      cateterId: CATETER_ID,
      diaPo: 1,
      dataAvaliacao: '2026-08-07T13:16:00Z',
    })

    await act(async () => {
      await result.current.updateFollowup('fu-antigo', { observacoes: 'ajuste' }, USER)
    })

    // Regredir ressuscitaria o alerta de "sem evolução" já resolvido.
    expect(result.current.cateteres[0].ultimaAvaliacaoAt).toBe('2026-08-08T14:41:00Z')
  })

  it('não toca em outros cateteres', async () => {
    mockFetchAll.mockResolvedValue([
      { id: CATETER_ID, status: 'ativo', ultimaAvaliacaoAt: '2026-08-07T13:16:00Z' },
      { id: 'cat-2', status: 'ativo', ultimaAvaliacaoAt: '2026-08-05T10:00:00Z' },
    ])
    const { result } = renderHook(() => useCateterPeridural(), { wrapper })
    await waitFor(() => expect(result.current.cateteres).toHaveLength(2))

    mockCreateFollowup.mockResolvedValue({
      id: 'fu-1',
      cateterId: CATETER_ID,
      dataAvaliacao: '2026-08-08T14:41:00Z',
    })
    await act(async () => {
      await result.current.addFollowup({ cateterId: CATETER_ID }, USER)
    })

    expect(result.current.cateteres[1].ultimaAvaliacaoAt).toBe('2026-08-05T10:00:00Z')
  })

  it('resposta sem dataAvaliacao não corrompe o estado', async () => {
    const result = await renderComCateter('2026-08-07T13:16:00Z')
    mockCreateFollowup.mockResolvedValue({ id: 'fu-1', cateterId: CATETER_ID })

    await act(async () => {
      await result.current.addFollowup({ cateterId: CATETER_ID }, USER)
    })

    expect(result.current.cateteres[0].ultimaAvaliacaoAt).toBe('2026-08-07T13:16:00Z')
  })
})
