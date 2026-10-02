/**
 * HORÁRIO REAL anda junto com o STATUS — o funil do context (dono 02/10).
 *
 * `setStatusCirurgia` é o caminho dos botões Iniciada/Terminada do detalhe do caso,
 * da faixa de urgências e, desde 02/10, do bloco INÍCIO (cirurgia agendada passa a
 * iniciada com o horário). O banco preenche pelo trigger; o otimista pinta o MESMO —
 * senão o bloco do horário piscaria vazio até o refetch. Travas:
 *   · Iniciada pinta o início com a hora do toque; Terminada pinta o término;
 *   · o início INFORMADO vai ao banco ANTES da RPC (o trigger só preenche vazio —
 *     invertido, ele gravaria a hora do toque e o informado chegaria depois);
 *   · erro na RPC devolve o horário junto com o status;
 *   · o "Desfazer" do Terminada tira o término real.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'

const { svcMock, toastMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
    updateAjudaExterna: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
    updateCaso: vi.fn(async () => {}),
    desfazerTerminada: vi.fn(async () => true),
  },
  toastMock: vi.fn(),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({ createReliableSubscription: () => ({ cleanup: () => {} }) }))
vi.mock('@/design-system/components/ui/toast', () => ({ useToast: () => ({ toast: toastMock }) }))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const escalaBase = () => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { vespertino: ['STAUB'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [
    { id: 'c-ag', sala: 'S1', ordem: 0, hora: '15:30', anestesista: 'STAUB', turno: 'vespertino', statusCirurgia: 'agendada' },
    { id: 'c-ini', sala: 'S2', ordem: 0, hora: '13:30', anestesista: 'STAUB', turno: 'vespertino', statusCirurgia: 'iniciada',
      statusAtualizadoEm: '2026-10-02T14:33:00-03:00', terminoPrevisto: '16:30' },
  ],
})

let actions
let estado
function Grab() { actions = useEscalaCirurgicaActions(); estado = useEscalaCirurgica(); return null }
const montar = async () => {
  render(<EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>)
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
}
const unimed = () => estado.escalas.unimed
const casoDe = (id) => unimed().casos.find((c) => c.id === id)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-02T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => {
  vi.clearAllMocks()
  svcMock.updateStatusCirurgia.mockImplementation(async () => {})
  svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
})

describe('o toque no status pinta o horário (espelho do trigger)', () => {
  it('Iniciada: o início vira a hora do toque, já no otimista', async () => {
    await montar()
    svcMock.updateStatusCirurgia.mockImplementation(() => new Promise(() => {}))
    act(() => { actions.setStatusCirurgia(unimed(), casoDe('c-ag'), 'iniciada', { userId: 'u1' }) })
    expect(casoDe('c-ag')).toMatchObject({ statusCirurgia: 'iniciada', inicioReal: '15:45', terminoReal: null })
  })

  it('Terminada: término = hora do toque; o início perdido vem do carimbo de iniciada', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(unimed(), casoDe('c-ini'), 'terminada', { userId: 'u1' }) })
    expect(casoDe('c-ini')).toMatchObject({ statusCirurgia: 'terminada', inicioReal: '14:33', terminoReal: '15:45', terminoPrevisto: null })
    // a RPC do status é quem grava no banco (o trigger preenche lá); só o término
    // PREVISTO zerado vai pelo updateCaso, como desde 15/09
    expect(svcMock.updateCaso).toHaveBeenCalledWith('c-ini', { terminoPrevisto: null })
    expect(svcMock.updateCaso).not.toHaveBeenCalledWith('c-ini', expect.objectContaining({ terminoReal: expect.anything() }))
  })

  it('Agendada apaga os dois', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(unimed(), casoDe('c-ini'), 'agendada', { userId: 'u1' }) })
    expect(casoDe('c-ini')).toMatchObject({ statusCirurgia: 'agendada', inicioReal: null, terminoReal: null })
  })
})

describe('início INFORMADO numa cirurgia agendada', () => {
  it('pinta o horário informado (não a hora do toque) e o grava ANTES da RPC', async () => {
    await montar()
    await act(async () => {
      await actions.setStatusCirurgia(unimed(), casoDe('c-ag'), 'iniciada', { userId: 'u1', inicioReal: '15:10' })
    })
    expect(casoDe('c-ag')).toMatchObject({ statusCirurgia: 'iniciada', inicioReal: '15:10' })
    expect(svcMock.updateCaso).toHaveBeenCalledWith('c-ag', { inicioReal: '15:10' })
    expect(svcMock.updateStatusCirurgia).toHaveBeenCalledWith('c-ag', 'iniciada')
    // a ordem é o que faz o trigger respeitar o informado (ele só preenche vazio)
    expect(svcMock.updateCaso.mock.invocationCallOrder[0]).toBeLessThan(svcMock.updateStatusCirurgia.mock.invocationCallOrder[0])
  })

  it('a RPC falha → status E horário voltam ao que eram', async () => {
    await montar()
    svcMock.updateStatusCirurgia.mockImplementation(async () => { throw new Error('rede') })
    await act(async () => {
      await actions.setStatusCirurgia(unimed(), casoDe('c-ag'), 'iniciada', { userId: 'u1', inicioReal: '15:10' }).catch(() => {})
    })
    expect(casoDe('c-ag').statusCirurgia).toBe('agendada')
    expect(casoDe('c-ag').inicioReal ?? null).toBeNull()
  })
})

describe('término INFORMADO numa cirurgia aberta (02/10, tarde)', () => {
  it('pinta o término informado e o grava ANTES da RPC; a previsão zera como no Terminada', async () => {
    await montar()
    await act(async () => {
      await actions.setStatusCirurgia(unimed(), casoDe('c-ini'), 'terminada', { userId: 'u1', terminoReal: '15:30' })
    })
    expect(casoDe('c-ini')).toMatchObject({ statusCirurgia: 'terminada', inicioReal: '14:33', terminoReal: '15:30', terminoPrevisto: null })
    expect(svcMock.updateCaso).toHaveBeenCalledWith('c-ini', { terminoReal: '15:30' })
    const ordemTermino = svcMock.updateCaso.mock.invocationCallOrder[0]
    expect(ordemTermino).toBeLessThan(svcMock.updateStatusCirurgia.mock.invocationCallOrder[0])
  })
})

describe('Desfazer o Terminada', () => {
  it('tira o término real e mantém o início', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(unimed(), casoDe('c-ini'), 'terminada', { userId: 'u1' }) })
    expect(casoDe('c-ini').terminoReal).toBe('15:45')
    const acao = toastMock.mock.calls.at(-1)?.[0]?.action
    expect(acao?.label).toBe('Desfazer')
    await act(async () => { await acao.onClick() })
    await waitFor(() => expect(svcMock.desfazerTerminada).toHaveBeenCalled())
    expect(casoDe('c-ini')).toMatchObject({ statusCirurgia: 'iniciada', inicioReal: '14:33', terminoReal: null, terminoPrevisto: '16:30' })
  })
})
