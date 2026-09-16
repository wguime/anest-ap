/**
 * ESCALA COMPLETA → LIBERAÇÕES: quem RECEBE casos perde a anotação da linha
 * (dono 16/09/2026: "ajustes na Escala completa devem sincronizar com a aba
 * Liberações").
 *
 * O caso real: às 13h52 a linha do ADRIANO na fila estava editada à mão
 * ("CO - Cesárea · Cesária > Junior") e a do PAULO tinha `renovado` (desfazer
 * liberação). Às 14h13 a Escala completa trocou as cirurgias dos dois
 * (setAnestesistaCasos) — e na fila nada mudou, porque `local`/`cirurgioes`
 * manuais e `renovado` VENCEM o derivado dos casos. Regra travada aqui: ao
 * receber casos, a linha perde esses três; tempo informado, observação, troca,
 * assunção, origem e decisões da conferência sobrevivem; sem nada restando, o
 * override some (patch com null).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    updateAnestesistaCasos: vi.fn(async () => {}),
    updateAjudaExterna: vi.fn(async () => {}),
    patchLiberacao: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
    updateCaso: vi.fn(async () => {}),
    addCaso: vi.fn(async (escalaId, c) => ({ id: 'novo-1', ...c })),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const TROCA = { uid: 'uid-x', nome: 'X', tipo: 'entre_hospitais', apenasRegistro: true }

const escalaBase = () => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { vespertino: ['PAULO', 'ADRIANO'] },
  liberacoes: {}, ajudaExterna: {},
  linhaOverrides: {
    // ADRIANO: anotação manual + tempo informado + observação
    'vespertino:uid-adr': { local: 'CO - Cesárea', cirurgioes: 'Cesária > Junior', termino: '19:00', observacao: 'volta 18h', por: 'u-louise', em: '2026-09-16T16:52:40Z' },
    // PAULO: renovado (desfazer liberação) + troca declarada
    'vespertino:uid-pau': { renovado: true, trocaCom: TROCA, por: 'u-dono', em: '2026-09-16T17:13:18Z' },
    // KARINE: só um local manual — ao receber caso, o override inteiro some
    'vespertino:uid-kar': { local: 'Accurata', por: 'u-dono', em: '2026-09-16T16:00:00Z' },
  },
  casos: [
    { id: 'c1', sala: 'CO - Sala 3', ordem: 0, anestesista: 'PAULO', anestesistaUserId: 'uid-pau', semAnestesista: false, turno: 'vespertino', tipo: 'eletiva', statusCirurgia: 'agendada' },
    { id: 'c2', sala: 'CC - Sala 10', ordem: 0, anestesista: 'ADRIANO', anestesistaUserId: 'uid-adr', semAnestesista: false, turno: 'vespertino', tipo: 'eletiva', statusCirurgia: 'agendada' },
    { id: 'c3', sala: 'CC - Sala 1', ordem: 0, anestesista: 'OSCAR', anestesistaUserId: 'uid-osc', semAnestesista: false, turno: 'vespertino', tipo: 'eletiva', statusCirurgia: 'agendada' },
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
  svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
})

describe('setAnestesistaCasos limpa a anotação da linha de quem recebe casos', () => {
  it('ADRIANO recebe o C.O: perde local/cirurgiões manuais, mantém tempo e observação', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(unimed(), ['c1'], { uid: 'uid-adr', apelido: 'ADRIANO' }, { userId: 'u-dono' })
    })
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('esc-uni', 'vespertino:uid-adr', expect.objectContaining({ termino: '19:00', observacao: 'volta 18h', por: 'u-dono' }))
    const gravado = svcMock.patchLinhaOverride.mock.calls.find((c) => c[1] === 'vespertino:uid-adr')[2]
    expect(gravado).not.toHaveProperty('local')
    expect(gravado).not.toHaveProperty('cirurgioes')
    // estado otimista acompanha
    expect(unimed().linhaOverrides['vespertino:uid-adr']).not.toHaveProperty('local')
    expect(unimed().linhaOverrides['vespertino:uid-adr'].termino).toBe('19:00')
    expect(unimed().casos.find((c) => c.id === 'c1').anestesista).toBe('ADRIANO')
  })

  it('PAULO recebe a Sala 10: perde `renovado`, mantém a troca declarada', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(unimed(), ['c2'], { uid: 'uid-pau', apelido: 'PAULO' }, { userId: 'u-dono' })
    })
    const gravado = svcMock.patchLinhaOverride.mock.calls.find((c) => c[1] === 'vespertino:uid-pau')[2]
    expect(gravado).not.toHaveProperty('renovado')
    expect(gravado.trocaCom).toEqual(TROCA)
    expect(unimed().linhaOverrides['vespertino:uid-pau'].renovado).toBeUndefined()
  })

  it('linha só com local manual: o override inteiro some (patch com null)', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(unimed(), ['c3'], { uid: 'uid-kar', apelido: 'KARINE' }, { userId: 'u-dono' })
    })
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('esc-uni', 'vespertino:uid-kar', null)
    expect(unimed().linhaOverrides['vespertino:uid-kar']).toBeUndefined()
  })

  it('linha sem anotação de exibição não é tocada', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(unimed(), ['c3'], { uid: 'uid-osc', apelido: 'OSCAR' }, { userId: 'u-dono' })
    })
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })

  it('adicionarCaso para alguém com linha anotada: a anotação cede', async () => {
    await montar()
    await act(async () => {
      await actions.adicionarCaso(unimed(), { sala: 'CC - Sala 2', ordem: 0, hora: '15:00', procedimento: 'HERNIORRAFIA', anestesista: 'KARINE', anestesistaUserId: 'uid-kar', turno: 'vespertino', semAnestesista: false })
    })
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('esc-uni', 'vespertino:uid-kar', null)
    expect(unimed().linhaOverrides['vespertino:uid-kar']).toBeUndefined()
  })

  it('atualizarCaso com sala nova limpa a anotação da pessoa do caso; só hora, não', async () => {
    await montar()
    await act(async () => {
      await actions.atualizarCaso(unimed(), 'c2', { hora: '14:00' }, { silencioso: true })
    })
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
    await act(async () => {
      await actions.atualizarCaso(unimed(), 'c2', { sala: 'CO - Sala 3' }, { silencioso: true })
    })
    const gravado = svcMock.patchLinhaOverride.mock.calls.find((c) => c[1] === 'vespertino:uid-adr')?.[2]
    expect(gravado).toBeTruthy()
    expect(gravado).not.toHaveProperty('local')
    expect(gravado.termino).toBe('19:00')
  })

  it('dupla (A + B) não mexe em anotação de ninguém', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(unimed(), ['c3'], { uid: null, apelido: 'ADRIANO + PAULO', dupla: true }, { userId: 'u-dono' })
    })
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })
})
