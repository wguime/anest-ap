/**
 * Carga da escala: o P4 do dia sai JUNTO com as escalas (15/10/2026).
 *
 * Buscado depois, ele segurava o "Carregando…" uma ida a mais ao servidor com a
 * escala já na tela (filme de produção: dados aos ~1,56 s, "Carregando…" até ~1,87 s).
 * Trava: o P4 é pedido enquanto as escalas ainda estão a caminho, chega ao estado, e
 * falha dele continua virando null (o coringa nos 3 hospitais).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: { fetchEscala: vi.fn(), fetchP4Hospital: vi.fn(), fetchStatusDia: vi.fn(async () => []) },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'

let estado
function Grab() {
  estado = useEscalaCirurgica()
  return null
}

const montar = () => render(
  <ThemeProvider><ToastProvider>
    <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
  </ToastProvider></ThemeProvider>,
)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // quarta, 10h: dia útil, sem linha 'fds'
  vi.setSystemTime(new Date('2026-10-14T10:00:00-03:00'))
  svcMock.fetchEscala.mockReset()
  svcMock.fetchP4Hospital.mockReset()
})

describe('carga da escala — P4 junto com as escalas', () => {
  it('o P4 é pedido enquanto as escalas ainda estão a caminho', async () => {
    const pendentes = []
    svcMock.fetchEscala.mockImplementation(() => new Promise((r) => pendentes.push(r)))
    svcMock.fetchP4Hospital.mockImplementation(async () => 'hro')

    montar()
    await act(async () => { await Promise.resolve() })

    expect(svcMock.fetchEscala).toHaveBeenCalled()
    expect(svcMock.fetchP4Hospital).toHaveBeenCalledTimes(1)
    expect(pendentes.length).toBeGreaterThan(0) // nenhuma escala chegou ainda

    await act(async () => { pendentes.forEach((r) => r(null)) })
    await waitFor(() => expect(estado.loading).toBe(false))
    vi.useRealTimers()
    expect(estado.p4Hospital).toBe('hro')
  })

  it('falha do P4 continua virando null, sem segurar a escala', async () => {
    svcMock.fetchEscala.mockImplementation(async () => null)
    svcMock.fetchP4Hospital.mockImplementation(async () => { throw new Error('timeout') })

    montar()
    await waitFor(() => expect(estado.loading).toBe(false))
    vi.useRealTimers()
    expect(estado.p4Hospital).toBeNull()
  })
})
