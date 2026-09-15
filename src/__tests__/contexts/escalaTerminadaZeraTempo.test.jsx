/**
 * TERMINADA ZERA O TEMPO DA CIRURGIA — e SÓ dela (dono 15/09).
 *
 * A foto do próprio card do dono, 16:31 de 15/09: "13:00 Varizes · faltam 1h56" na
 * cirurgia e "2h29" na pílula. Reproduzido com os dados reais do HRO à tarde: a
 * pílula (19:00) tinha sido gravada à mão às 14:56 com três cirurgias sem término;
 * às 16:27 uma foi marcada terminada, outra ganhou 18:27 e a terceira seguiu sem
 * término. O pedido: "ao clicar em terminada o tempo referente àquela cirurgia
 * fique zerado para que não continue contando como tempo".
 *
 * ⚠️ A pílula do total NÃO entra: "quero que mantenha o sistema em que é informado
 * o tempo total independente dos tempos individuais das cirurgias" (dono, 15/09 à
 * tarde, revertendo o recálculo que a v5.12.8 fazia aqui). Este teste trava o
 * caminho no context, que é o funil dos dois botões (detalhe do caso e faixa de
 * urgências):
 *   · o otimista pinta `terminoPrevisto: null` junto com o status
 *   · o banco recebe o status pela RPC E o término zerado pelo `updateCaso`
 *   · erro na RPC reverte o término junto com o status
 *   · o total da linha (linha_overrides.termino) fica exatamente como estava
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLiberacao: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
    updateCaso: vi.fn(async () => {}),
    updateAjudaExterna: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
    updateAnestesistaCasos: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

// o cenário real de 15/09 (HRO, tarde, MELO): três cirurgias, pílula 19:00 à mão
const MELO = { anestesista: 'MELO', anestesistaUserId: 'uid-melo', semAnestesista: false, turno: 'vespertino', tipo: 'eletiva' }
const escalaBase = () => ({
  id: 'esc-hro', hospital: 'hro', status: 'publicada',
  ordemLiberacao: { vespertino: ['MELO'] },
  liberacoes: {}, ajudaExterna: {},
  linhaOverrides: { 'vespertino:uid-melo': { termino: '19:00', local: 'Bloco M - Sala 4', por: 'uid-melo' } },
  casos: [
    { id: 'c-let', sala: 'Bloco M - Sala 4', ordem: 20, hora: '13:00', cirurgiao: 'Leticia Mattiello', statusCirurgia: 'iniciada', terminoPrevisto: '18:27', ...MELO },
    { id: 'c-h1', sala: 'Bloco M - Sala 4', ordem: 21, hora: 'AS', cirurgiao: 'Helio Machado', statusCirurgia: 'iniciada', terminoPrevisto: '19:00', ...MELO },
    { id: 'c-h2', sala: 'Bloco M - Sala 4', ordem: 22, hora: 'AS', cirurgiao: 'Helio Machado', statusCirurgia: 'agendada', terminoPrevisto: null, ...MELO },
  ],
})

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}
const montar = async () => {
  render(
    <ThemeProvider><ToastProvider>
      <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(estado?.escalas?.hro?.id).toBe('esc-hro'))
}
const hro = () => estado.escalas.hro
const casoDe = (id) => hro().casos.find((c) => c.id === id)
const totalDe = () => hro().linhaOverrides?.['vespertino:uid-melo']?.termino ?? null

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks não desfaz `mockImplementation`: a promise pendente e o erro de
  // rede de um teste vazariam para o seguinte
  svcMock.updateStatusCirurgia.mockImplementation(async () => {})
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'hro' ? escalaBase() : null))
})

describe('marcar TERMINADA zera o término da cirurgia (dono 15/09)', () => {
  it('otimista: status e terminoPrevisto mudam juntos, no toque', async () => {
    await montar()
    svcMock.updateStatusCirurgia.mockImplementation(() => new Promise(() => {}))
    act(() => { actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'terminada', { userId: 'uid-melo' }) })
    expect(casoDe('c-h1').statusCirurgia).toBe('terminada')
    expect(casoDe('c-h1').terminoPrevisto).toBeNull()
  })

  it('banco: a RPC do status E o término zerado pelo updateCaso', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'terminada', { userId: 'uid-melo' }) })
    expect(svcMock.updateStatusCirurgia).toHaveBeenCalledWith('c-h1', 'terminada')
    expect(svcMock.updateCaso).toHaveBeenCalledWith('c-h1', { terminoPrevisto: null })
  })

  it('cirurgia que já não tinha término: só o status vai ao banco (nada a zerar)', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h2'), 'terminada', { userId: 'uid-melo' }) })
    expect(svcMock.updateStatusCirurgia).toHaveBeenCalledWith('c-h2', 'terminada')
    expect(svcMock.updateCaso).not.toHaveBeenCalled()
  })

  it('"iniciada" e os avisos (atrasada) NÃO mexem no término', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h2'), 'iniciada', { userId: 'uid-melo' }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-let'), 'atrasada', { userId: 'uid-melo' }) })
    expect(casoDe('c-let').terminoPrevisto).toBe('18:27')
    expect(svcMock.updateCaso).not.toHaveBeenCalled()
  })

  it('a RPC falha → status E término voltam ao que eram', async () => {
    await montar()
    svcMock.updateStatusCirurgia.mockImplementation(async () => { throw new Error('rede') })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'terminada', { userId: 'uid-melo' }).catch(() => {}) })
    expect(casoDe('c-h1').statusCirurgia).toBe('iniciada')
    expect(casoDe('c-h1').terminoPrevisto).toBe('19:00')
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })
})

describe('o total da pessoa NÃO muda com o status — é informado independente (dono 15/09)', () => {
  it('termina a de 19:00 → a pílula segue 19:00 e nada é gravado em linha_overrides', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'terminada', { userId: 'uid-melo' }) })
    expect(casoDe('c-h1').terminoPrevisto).toBeNull()
    expect(totalDe()).toBe('19:00')
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })

  it('termina TODAS as cirurgias → a pílula continua como a pessoa deixou', async () => {
    await montar()
    for (const id of ['c-let', 'c-h1', 'c-h2']) {
      await act(async () => { await actions.setStatusCirurgia(hro(), casoDe(id), 'terminada', { userId: 'uid-melo' }) })
    }
    expect(totalDe()).toBe('19:00')
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })

  it('suspensa / reabrir também não encostam na pílula nem no término da cirurgia', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'suspensa', { userId: 'uid-melo' }) })
    expect(casoDe('c-h1').terminoPrevisto).toBe('19:00')
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'suspensa', { userId: 'uid-melo' }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c-h1'), 'agendada', { userId: 'uid-melo' }) })
    expect(totalDe()).toBe('19:00')
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })
})
