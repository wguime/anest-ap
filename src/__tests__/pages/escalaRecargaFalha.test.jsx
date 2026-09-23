import { beforeEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { EscalaCirurgicaProvider, useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'

const { svc, toast } = vi.hoisted(() => ({
  svc: { fetchEscala: vi.fn(), fetchP4Hospital: vi.fn(async () => null) },
  toast: vi.fn(),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svc }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({ createReliableSubscription: () => ({ cleanup() {} }) }))
vi.mock('@/design-system/components/ui/toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/data/escalaCirurgicaDemo', () => ({ getDemoEscala: () => null }))
vi.mock('@/lib/devClock', () => ({ agora: () => new Date('2026-09-08T10:00:00-03:00') }))

const wrapper = ({ children }) => <EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider>
const escala = (dia, h) => ({ id: `${dia}-${h}`, data: dia, hospital: h, casos: [], ordemLiberacao: ['ANA'], liberacoes: {} })
beforeEach(() => {
  vi.clearAllMocks()
  svc.fetchEscala.mockImplementation(async (dia, h) => escala(dia, h))
})

async function montar(dia) {
  const r = renderHook(() => useEscalaCirurgica(), { wrapper })
  await waitFor(() => expect(r.result.current.loading).toBe(false))
  if (dia) {
    await act(async () => { r.result.current.setData(dia) })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
  }
  return r
}

describe('falha de recarga não é ausência de escala', () => {
  it('resposta válida nula continua removendo a escala que deixou de existir', async () => {
    const { result } = await montar()
    svc.fetchEscala.mockResolvedValue(null)
    await act(async () => { await result.current.refresh() })
    expect(result.current.escalas).toEqual({ unimed: null, hro: null, materno: null, fds: null })
    expect(toast).not.toHaveBeenCalled()
  })

  it('prefetch falho não guarda conjunto parcial no cache e pode ser repetido', async () => {
    const { result } = await montar()
    svc.fetchEscala.mockImplementation(async (d, h) => {
      if (h === 'hro') throw new Error('rede indisponível')
      return escala(d, h)
    })
    await act(async () => { await result.current.prefetch('2026-09-09') })
    svc.fetchEscala.mockImplementation(async (d, h) => escala(d, h))
    await act(async () => { await result.current.prefetch('2026-09-09') })
    expect(svc.fetchEscala.mock.calls.filter(([d, h]) => d === '2026-09-09' && h === 'unimed')).toHaveLength(2)
    expect(toast).not.toHaveBeenCalled()
  })
})
