/**
 * RESPOSTA TÁTIL IMEDIATA — updates OTIMISTAS do context (dono 19/08).
 *
 * O dono reportou delay ao tocar nos controles da escala (card Andamento do
 * CasoDetalheSheet): várias actions esperavam a ida ao servidor ANTES do
 * dispatch, então o botão ficava "morto" por um RTT inteiro (Brasil →
 * us-west-2 ≥ 200ms) a cada toque. setStatusCirurgia já era otimista desde a
 * mesma reclamação em produção; este teste trava a regra para as demais:
 *
 *   toggleLiberacao · toggleEscalado · setLinhaOverride · atualizarCaso ·
 *   adicionarAjuda · removerAjuda
 *
 * A técnica: o service mockado devolve uma promise PENDENTE (nunca resolve
 * dentro do teste) e o estado tem de refletir o toque MESMO ASSIM — se a action
 * esperar o servidor, o assert falha. O segundo eixo é o rollback: promise
 * rejeitada devolve o estado ao snapshot (com toast de erro por conta do
 * context). Regressão aqui = toque volta a esperar a rede.
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
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

// promise que nunca resolve no teste: se a action esperar por ela antes de
// pintar, o assert de estado imediato falha — é o próprio detector do delay
const pendente = () => new Promise(() => {})

const escalaBase = () => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB', 'GIOVANA'] },
  liberacoes: {}, linhaOverrides: {}, ajudaExterna: {},
  casos: [
    { id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', anestesistaUserId: null, semAnestesista: false, turno: 'matutino', tipo: 'urgencia', statusCirurgia: 'agendada' },
    { id: 'c2', sala: 'S2', ordem: 0, anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', semAnestesista: false, turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'agendada' },
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
  await waitFor(() => expect(svcMock.fetchEscala).toHaveBeenCalled())
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
}

const unimed = () => estado.escalas.unimed

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'unimed' ? escalaBase() : null))
})

describe('resposta tátil — o estado pinta ANTES do servidor responder', () => {
  it('toggleLiberacao marca a liberação com o patch ainda pendente', async () => {
    await montar()
    svcMock.patchLiberacao.mockImplementation(pendente)
    act(() => {
      actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino')
    })
    // pintou já — sem esperar rede
    expect(unimed().liberacoes['matutino:staub']).toBeTruthy()
    expect(unimed().liberacoes['matutino:staub'].por).toBe('u1')
  })

  it('desfazer liberação renova a linha na hora (marcador renovado, sem esperar rede)', async () => {
    await montar()
    act(() => {
      actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino')
    })
    await waitFor(() => expect(unimed().liberacoes['matutino:staub']).toBeTruthy())
    svcMock.patchLiberacao.mockImplementation(pendente)
    svcMock.patchLinhaOverride.mockImplementation(pendente)
    act(() => {
      actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino')
    })
    expect(unimed().liberacoes['matutino:staub']).toBeUndefined()
    expect(unimed().linhaOverrides['matutino:staub']?.renovado).toBe(true)
  })

  it('toggleEscalado marca escalado com o patch pendente', async () => {
    await montar()
    svcMock.patchLiberacao.mockImplementation(pendente)
    act(() => {
      actions.toggleEscalado(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino')
    })
    expect(unimed().liberacoes['matutino:staub']?.escalado).toBe(true)
  })

  it('setLinhaOverride grava o override (cronômetro/observação) com o patch pendente', async () => {
    await montar()
    svcMock.patchLinhaOverride.mockImplementation(pendente)
    act(() => {
      actions.setLinhaOverride(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { termino: '15:30', observacao: 'recado' }, { userId: 'u1' }, 'matutino')
    })
    expect(unimed().linhaOverrides['matutino:staub']?.termino).toBe('15:30')
    expect(unimed().linhaOverrides['matutino:staub']?.observacao).toBe('recado')
  })

  it('atualizarCaso (gravidade do Andamento) pinta com o update pendente', async () => {
    await montar()
    const c2Antes = unimed().casos.find((c) => c.id === 'c2')
    svcMock.updateCaso.mockImplementation(pendente)
    act(() => {
      actions.atualizarCaso(unimed(), 'c1', { gravidade: 'imediata' })
    })
    expect(unimed().casos.find((c) => c.id === 'c1').gravidade).toBe('imediata')
    // e NÃO clona os casos não tocados — é o que deixa o React.memo do CasoCard
    // re-renderizar só o card mexido em vez do quadro inteiro
    expect(unimed().casos.find((c) => c.id === 'c2')).toBe(c2Antes)
  })

  it('adicionarAjuda / removerAjuda refletem no toque com o update pendente', async () => {
    await montar()
    svcMock.updateAjudaExterna.mockImplementation(pendente)
    act(() => {
      actions.adicionarAjuda(unimed(), 'matutino', 'CURY')
    })
    expect(unimed().ajudaExterna.matutino).toEqual(['CURY'])
    act(() => {
      actions.removerAjuda(unimed(), 'matutino', 'CURY')
    })
    expect(unimed().ajudaExterna.matutino).toEqual([])
  })
})

describe('rollback — servidor recusou, o toque desfaz sozinho', () => {
  it('toggleLiberacao rejeitado reverte liberação e override', async () => {
    await montar()
    svcMock.patchLiberacao.mockRejectedValueOnce(new Error('rede caiu'))
    await act(async () => {
      await actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino').catch(() => {})
    })
    expect(unimed().liberacoes['matutino:staub']).toBeUndefined()
    expect(unimed().linhaOverrides['matutino:staub']).toBeUndefined()
  })

  it('atualizarCaso rejeitado devolve o caso ao snapshot', async () => {
    await montar()
    svcMock.updateCaso.mockRejectedValueOnce(new Error('42501'))
    await act(async () => {
      await actions.atualizarCaso(unimed(), 'c1', { gravidade: 'imediata' }).catch(() => {})
    })
    expect(unimed().casos.find((c) => c.id === 'c1').gravidade).toBeUndefined()
  })

  it('setLinhaOverride rejeitado devolve os overrides ao snapshot', async () => {
    await montar()
    svcMock.patchLinhaOverride.mockRejectedValueOnce(new Error('rede caiu'))
    await act(async () => {
      await actions.setLinhaOverride(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { termino: '15:30' }, { userId: 'u1' }, 'matutino').catch(() => {})
    })
    expect(unimed().linhaOverrides['matutino:staub']).toBeUndefined()
  })

  it('adicionarAjuda rejeitado devolve a lista ao snapshot', async () => {
    await montar()
    svcMock.updateAjudaExterna.mockRejectedValueOnce(new Error('rede caiu'))
    await act(async () => {
      await actions.adicionarAjuda(unimed(), 'matutino', 'CURY').catch(() => {})
    })
    expect(unimed().ajudaExterna.matutino || []).toEqual([])
  })
})
