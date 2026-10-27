/**
 * SETAS SÓ ENTRE AS AJUDAS (dono 27/10, revoga o "mexeu nas setas = ordem informada" de
 * 09/09). Reordenar o bloco de ajuda grava SÓ o array: ligar `ordemInformada` fazia o
 * array mandar na cauda inteira e visitantes que ninguém tocou mudavam de lugar. A marca
 * que veio da publicação (recado numerado) continua lá.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    updateAjudaExterna: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const escalaCom = (ajudaExterna) => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB', 'GIOVANA'] },
  liberacoes: {}, linhaOverrides: {}, ajudaExterna, casos: [],
})

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}
const montar = async (ajudaExterna) => {
  svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaCom(ajudaExterna) : null))
  render(<ThemeProvider><ToastProvider><EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider></ToastProvider></ThemeProvider>)
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
}

beforeEach(() => vi.clearAllMocks())

describe('reordenarAjuda grava só o array (27/10)', () => {
  it('não liga a "ordem informada" do turno', async () => {
    await montar({ matutino: ['CURY', 'GARIM', 'PAULO'] })
    await act(() => actions.reordenarAjuda(estado.escalas.unimed, 'matutino', 0, 2))
    const gravado = svcMock.updateAjudaExterna.mock.calls[0][1]
    expect(gravado.matutino).toEqual(['GARIM', 'PAULO', 'CURY'])
    expect(gravado.ordemInformada).toBeUndefined()
  })

  it('a marca que veio da publicação (recado numerado) é preservada', async () => {
    await montar({ matutino: ['CURY', 'PAULO'], ordemInformada: { matutino: true } })
    await act(() => actions.reordenarAjuda(estado.escalas.unimed, 'matutino', 0, 1))
    expect(svcMock.updateAjudaExterna.mock.calls[0][1]).toEqual({ matutino: ['PAULO', 'CURY'], ordemInformada: { matutino: true } })
  })
})
