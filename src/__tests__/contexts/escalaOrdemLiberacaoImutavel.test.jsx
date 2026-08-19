/**
 * ORDEM DE LIBERAÇÃO IMUTÁVEL — trava de regressão (dono 19/08, reforço):
 * "NUNCA altere ordem de liberação e/ou libere usuário em ordem incorreta".
 *
 * A ordem publicada (`ordem_liberacao`) só muda por REPUBLICAÇÃO explícita.
 * Este teste roda TODAS as actions de marcação/edição do context sobre uma
 * escala publicada e prova que:
 *   1. o service de escrita da ordem (updateOrdemLiberacao) NUNCA é chamado;
 *   2. a ordem no estado sai EXATAMENTE como entrou;
 *   3. nenhuma action grava uma LIBERAÇÃO que ninguém fez (liberadoEm só nasce
 *      do toggle manual — o marcador `escalado:true` do repasse não é liberação).
 * Se uma action nova escrever a ordem, este arquivo é o que quebra.
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
    updateOrdemLiberacao: vi.fn(async () => {}),
    addCaso: vi.fn(async (_id, caso) => ({ id: 'novo-1', ...caso })),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const ORDEM = { matutino: ['STAUB', 'GIOVANA', 'DIEGO'], vespertino: ['DIEGO', 'GIOVANA'] }

const escalaBase = () => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: JSON.parse(JSON.stringify(ORDEM)),
  liberacoes: {}, linhaOverrides: {}, ajudaExterna: {},
  casos: [
    { id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', anestesistaUserId: null, semAnestesista: false, turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'agendada' },
    { id: 'c2', sala: 'S2', ordem: 0, anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', semAnestesista: false, turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'agendada' },
    { id: 'c3', sala: 'S4', ordem: 0, anestesista: 'DIEGO', anestesistaUserId: 'uid-die', semAnestesista: false, turno: 'vespertino', tipo: 'eletiva', statusCirurgia: 'agendada' },
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
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
}

const unimed = () => estado.escalas.unimed

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'unimed' ? escalaBase() : null))
})

describe('ordem_liberacao é IMUTÁVEL fora da republicação', () => {
  it('nenhuma action de marcação/edição escreve a ordem nem a muda no estado', async () => {
    await montar()
    const user = { userId: 'u1' }
    await act(async () => {
      await actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, user, 'matutino')
      await actions.toggleEscalado(unimed(), { chave: 'giovana', anestesista: 'GIOVANA' }, user, 'matutino')
      await actions.setLinhaOverride(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { termino: '15:30' }, user, 'matutino')
      await actions.setStatusCirurgia(unimed(), unimed().casos[0], 'iniciada')
      await actions.atualizarCaso(unimed(), 'c2', { gravidade: 'urgente' })
      // repasse que esvazia a linha do DIEGO no vespertino: preserva a linha
      // com escalado:true, mas NUNCA toca a ordem
      await actions.setAnestesistaCasos(unimed(), ['c3'], { uid: 'uid-gio', apelido: 'GIOVANA' }, { rotulo: 'S4', userId: 'u1' })
      await actions.adicionarAjuda(unimed(), 'matutino', 'CURY')
      await actions.removerAjuda(unimed(), 'matutino', 'CURY')
      await actions.marcarTroca(unimed(), { chave: 'staub', anestesista: 'STAUB', nomeOriginal: 'STAUB' }, { uid: 'uid-gio', nome: 'GIOVANA' }, user, 'matutino')
      await actions.adicionarCaso(unimed(), { sala: 'S9', anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', turno: 'matutino' })
    })
    expect(svcMock.updateOrdemLiberacao).not.toHaveBeenCalled()
    expect(unimed().ordemLiberacao).toEqual(ORDEM)
  })

  it('repasse não LIBERA ninguém: nada de liberadoEm sem toque humano', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(unimed(), ['c3'], { uid: 'uid-gio', apelido: 'GIOVANA' }, { rotulo: 'S4', userId: 'u1' })
    })
    // o marcador do repasse é escalado:true (linha segue ATIVA na posição);
    // liberação de verdade (liberadoEm) só nasce do toggle manual
    const entradas = Object.values(unimed().liberacoes || {})
    expect(entradas.some((v) => v?.liberadoEm)).toBe(false)
    expect(unimed().liberacoes['vespertino:uid-die']).toMatchObject({ escalado: true })
    for (const call of svcMock.patchLiberacao.mock.calls) {
      expect(call[2]?.liberadoEm).toBeUndefined()
    }
  })
})
