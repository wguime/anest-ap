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

const { svcMock, subCallbacks } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLiberacao: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
    updateCaso: vi.fn(async () => {}),
    updateAjudaExterna: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
  },
  // callbacks capturados p/ simular um evento realtime chegando no meio do toque
  subCallbacks: [],
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: (opts) => {
    subCallbacks.push(opts.callback)
    return { cleanup: () => {} }
  },
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
  subCallbacks.length = 0
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'unimed' ? escalaBase() : null))
})

describe('recarga não atropela o toque (dono 19/08: "vai para outra opção e depois retorna")', () => {
  // A sequência real do bug: toque pinta "iniciada" → o commit dispara realtime →
  // loadData repintava o CACHE (snapshot de ANTES do toque — a opção "voltava"
  // p/ agendada) → o fetch fresco aterrissava e a opção "retornava". A recarga
  // de revalidação não pode repintar cache nem aplicar snapshot anterior a uma
  // escrita ainda em voo.
  it('evento realtime durante o toque NÃO devolve o status antigo', async () => {
    await montar()
    // toque: otimista pinta; o RPC fica EM VOO (commit ainda não aconteceu)
    svcMock.updateStatusCirurgia.mockImplementation(pendente)
    act(() => {
      actions.setStatusCirurgia(unimed(), unimed().casos[0], 'iniciada')
    })
    expect(unimed().casos[0].statusCirurgia).toBe('iniciada')
    // realtime chega (ex.: outra marcação da equipe); o fetch devolve o estado
    // do servidor SEM o nosso toque (agendada) — não pode sobrescrever a tela
    await act(async () => {
      subCallbacks.forEach((cb) => cb())
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(unimed().casos[0].statusCirurgia).toBe('iniciada')
  })

  it('escrita pintada DURANTE o voo de uma recarga também não é atropelada', async () => {
    await montar()
    // recarga em voo: o fetch só resolve quando mandarmos (estado do servidor = agendada)
    let soltarFetch
    svcMock.fetchEscala.mockImplementation((_d, hosp) => new Promise((res) => {
      if (hosp !== 'unimed') return res(null)
      soltarFetch = () => res(escalaBase())
    }))
    act(() => { subCallbacks.forEach((cb) => cb()) })
    // toque no meio do voo
    svcMock.updateStatusCirurgia.mockImplementation(pendente)
    act(() => {
      actions.setStatusCirurgia(unimed(), unimed().casos[0], 'iniciada')
    })
    // a resposta velha aterrissa DEPOIS do toque
    await act(async () => {
      soltarFetch?.()
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(unimed().casos[0].statusCirurgia).toBe('iniciada')
  })

  it('troca de DATA continua repintando do cache na hora (SWR de 16/08 preservado)', async () => {
    await montar()
    const diaVisto = estado.data
    // vai para uma data nova (sem cache: zera e busca)…
    await act(async () => { actions.setData('2026-08-25') })
    await waitFor(() => expect(estado.data).toBe('2026-08-25'))
    // …e volta: a escala do dia já visto tem de aparecer de imediato (cache),
    // mesmo com o fetch de revalidação ainda pendente
    svcMock.fetchEscala.mockImplementation(pendente)
    await act(async () => { actions.setData(diaVisto) })
    expect(unimed()?.id).toBe('esc-uni')
  })
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
