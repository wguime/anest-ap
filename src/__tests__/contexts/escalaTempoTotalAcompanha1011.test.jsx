/**
 * O TEMPO TOTAL DA PESSOA ACOMPANHA AS CIRURGIAS (dono 10/11/2026).
 *
 * Pedido: "quero melhorar a integração entre as abas Completa e Liberações [...] os tempos
 * devem conversar entre si e NÃO produzir tempos distintos". A auditoria achou a mesma
 * cirurgia com dois números e o total de quem já tinha terminado tudo guardado no banco
 * (83 de 85 totais dos 7 dias anteriores). Às duas perguntas o dono respondeu:
 *
 *  1. Colega com UMA cirurgia só, estimada, ao marcar Iniciada: o tempo total se preenche
 *     sozinho? — "Sim, sempre" (mesmo que já houvesse outro valor).
 *  2. Terminou todas as cirurgias: o total antigo deve ser apagado? — "Sim, apaga".
 *
 * As duas REVOGAM, só nesses extremos, a regra de 15/09 ("o total não muda com o status").
 * Com 2+ cirurgias ativas, dupla "A + B" ou cirurgia sem anestesista nada muda sozinho —
 * o total segue informado à mão (`escalaTerminadaZeraTempo.test.jsx` trava esse lado).
 *
 * Tudo mora no context, que é o funil de todos os caminhos (detalhe do caso, folha do
 * total, "Antes de liberar", faixa de urgências passam por `setStatusCirurgia`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    terminarSemHorario: vi.fn(async () => {}),
    desfazerTerminada: vi.fn(async () => true),
    removeCaso: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const FER = { anestesista: 'FERNANDA', anestesistaUserId: 'uid-fer', semAnestesista: false, turno: 'matutino', tipo: 'eletiva' }
const MELO = { anestesista: 'MELO', anestesistaUserId: 'uid-melo', semAnestesista: false, turno: 'matutino', tipo: 'eletiva' }
const CHAVE = 'matutino:uid-fer'

const escalaHro = (casos, linhaOverrides = {}, extra = {}) => ({
  id: 'esc-hro', hospital: 'hro', status: 'publicada',
  ordemLiberacao: { matutino: ['MELO', 'FERNANDA'] },
  liberacoes: {}, ajudaExterna: {}, linhaOverrides, casos, ...extra,
})
const umaAgendada = (extra = {}) => ({
  id: 'c1', sala: 'Sala 2', ordem: 0, hora: '08:00', cirurgiao: 'Helio Machado',
  statusCirurgia: 'agendada', duracaoEstimadaMin: 120, terminoPrevisto: null, ...FER, ...extra,
})

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}
const montar = async (porHospital) => {
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => porHospital[hosp] || null)
  render(
    <ThemeProvider><ToastProvider>
      <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(estado?.escalas?.hro?.id).toBe('esc-hro'))
}
const hro = () => estado.escalas.hro
const casoDe = (id) => hro().casos.find((c) => c.id === id)
const totalDe = (chave = CHAVE) => hro().linhaOverrides?.[chave]?.termino ?? null
const gravacoesDaLinha = () => svcMock.patchLinhaOverride.mock.calls

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.updateStatusCirurgia.mockImplementation(async () => {})
  svcMock.desfazerTerminada.mockImplementation(async () => true)
})

describe('INICIADA com uma cirurgia só: o tempo total vira o estimado dela — "Sim, sempre"', () => {
  it('total vazio: início informado 09:30 + 2h → a cirurgia e a pílula dizem 11:30', async () => {
    await montar({ hro: escalaHro([umaAgendada()]) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(casoDe('c1').terminoPrevisto).toBe('11:30')
    expect(totalDe()).toBe('11:30')
    // (`setLinhaOverride` grava a chave do turno e limpa a chave legada pelo nome)
    expect(gravacoesDaLinha()[0].slice(0, 2)).toEqual(['esc-hro', CHAVE])
    // audit trail: quem tocou, nunca 'system'
    expect(gravacoesDaLinha()[0][2]).toMatchObject({ termino: '11:30', por: 'uid-fer' })
  })

  it('total JÁ informado (11:00): é substituído — e local/observação da linha ficam', async () => {
    await montar({ hro: escalaHro([umaAgendada()], { [CHAVE]: { termino: '11:00', local: 'IOSC', observacao: 'recado' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(hro().linhaOverrides[CHAVE]).toMatchObject({ termino: '11:30', local: 'IOSC', observacao: 'recado' })
  })

  it('a outra cirurgia dela já TERMINADA não conta: a ativa continua sendo uma só', async () => {
    const feita = umaAgendada({ id: 'c0', hora: '07:00', statusCirurgia: 'terminada', duracaoEstimadaMin: null, terminoReal: '08:10' })
    await montar({ hro: escalaHro([feita, umaAgendada()]) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(totalDe()).toBe('11:30')
  })

  it('sem estimado não há o que espelhar: a pílula fica como estava', async () => {
    await montar({ hro: escalaHro([umaAgendada({ duracaoEstimadaMin: null })], { [CHAVE]: { termino: '11:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(totalDe()).toBe('11:00')
    expect(gravacoesDaLinha()).toHaveLength(0)
  })

  it('erro ao gravar o status: nada vai para a linha', async () => {
    await montar({ hro: escalaHro([umaAgendada()]) })
    svcMock.updateStatusCirurgia.mockRejectedValueOnce(new Error('rede'))
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }).catch(() => {}) })
    expect(totalDe()).toBeNull()
    expect(gravacoesDaLinha()).toHaveLength(0)
  })
})

describe('o recorte é ESTREITO: fora dele nada muda sozinho (15/09 segue valendo)', () => {
  it('2 cirurgias ativas: iniciar uma delas não toca no total', async () => {
    const outra = umaAgendada({ id: 'c2', hora: '11:00', duracaoEstimadaMin: null })
    await montar({ hro: escalaHro([umaAgendada(), outra], { [CHAVE]: { termino: '13:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(casoDe('c1').terminoPrevisto).toBe('11:30')
    expect(totalDe()).toBe('13:00')
    expect(gravacoesDaLinha()).toHaveLength(0)
  })

  it('2 cirurgias ativas e as DUAS com horário depois do toque: ainda assim o status não soma', async () => {
    // a soma de 14/09 vale ao INFORMAR o estimado; a mudança de status só alcança uma cirurgia
    const emCurso = umaAgendada({ id: 'c2', hora: '07:00', statusCirurgia: 'iniciada', duracaoEstimadaMin: null, terminoPrevisto: '10:00' })
    await montar({ hro: escalaHro([emCurso, umaAgendada()]) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(totalDe()).toBeNull()
    expect(gravacoesDaLinha()).toHaveLength(0)
  })

  it('dupla "A + B": de dois donos, o total de nenhum muda', async () => {
    const dupla = umaAgendada({ anestesista: 'FERNANDA + MELO', anestesistaUserId: null })
    await montar({ hro: escalaHro([dupla], { [CHAVE]: { termino: '11:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '10:40' }) })
    expect(totalDe()).toBe('11:00')
    expect(gravacoesDaLinha()).toHaveLength(0)
  })

  it('cirurgia sem anestesista: não há linha de ninguém para mexer', async () => {
    const semDono = umaAgendada({ anestesista: '?', anestesistaUserId: null, semAnestesista: true })
    await montar({ hro: escalaHro([semDono], { [CHAVE]: { termino: '11:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-melo', inicioReal: '09:30' }) })
    expect(gravacoesDaLinha()).toHaveLength(0)
  })
})

describe('SEM CIRURGIA ABERTA o tempo total é apagado — "Sim, apaga"', () => {
  const emCurso = (extra = {}) => umaAgendada({ statusCirurgia: 'iniciada', duracaoEstimadaMin: null, inicioReal: '08:05', terminoPrevisto: '10:00', ...extra })

  it('Terminada na única cirurgia: some o total, ficam local e observação', async () => {
    await montar({ hro: escalaHro([emCurso()], { [CHAVE]: { termino: '10:00', local: 'IOSC', observacao: 'recado' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '09:40' }) })
    expect(totalDe()).toBeNull()
    expect(hro().linhaOverrides[CHAVE]).toMatchObject({ local: 'IOSC', observacao: 'recado' })
  })

  it('só havia o total na linha: o override inteiro some (patch null)', async () => {
    await montar({ hro: escalaHro([emCurso()], { [CHAVE]: { termino: '10:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '09:40' }) })
    expect(hro().linhaOverrides[CHAVE]).toBeUndefined()
    expect(gravacoesDaLinha()).toEqual([['esc-hro', CHAVE, null]])
  })

  it('o defeito que isto fecha: a urgência que chega depois NÃO encontra um total vencido', async () => {
    await montar({ hro: escalaHro([emCurso()], { [CHAVE]: { termino: '10:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '09:40' }) })
    // 11:20: outra pessoa passa uma urgência para ela — a linha nasce sem pílula
    expect(totalDe()).toBeNull()
  })

  it('Suspensa ("não aconteceu") na única cirurgia também apaga; tirar a suspensão não inventa total', async () => {
    await montar({ hro: escalaHro([umaAgendada({ duracaoEstimadaMin: null })], { [CHAVE]: { termino: '10:00' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'suspensa', { userId: 'uid-fer' }) })
    expect(totalDe()).toBeNull()
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'suspensa', { userId: 'uid-fer' }) })
    expect(totalDe()).toBeNull()
  })

  it('"Terminou · horário depois" (Antes de liberar) segue a mesma regra', async () => {
    await montar({ hro: escalaHro([emCurso()], { [CHAVE]: { termino: '10:00' } }) })
    await act(async () => { await actions.terminarSemHorario(hro(), casoDe('c1'), { userId: 'uid-melo' }) })
    expect(totalDe()).toBeNull()
  })

  it('PASSAR a última cirurgia aberta a um colega apaga o total de quem passou — e não o de quem recebe', async () => {
    const doMelo = umaAgendada({ id: 'c9', ...MELO, statusCirurgia: 'iniciada', duracaoEstimadaMin: null, terminoPrevisto: '12:00' })
    await montar({ hro: escalaHro([emCurso(), doMelo], { [CHAVE]: { termino: '10:00' }, 'matutino:uid-melo': { termino: '12:00' } }) })
    await act(async () => { await actions.setAnestesistaCasos(hro(), ['c1'], { uid: 'uid-melo', apelido: 'MELO' }, { userId: 'uid-melo' }) })
    expect(totalDe()).toBeNull()
    expect(totalDe('matutino:uid-melo')).toBe('12:00')
  })

  it('EXCLUIR a única cirurgia aberta apaga o total', async () => {
    await montar({ hro: escalaHro([emCurso()], { [CHAVE]: { termino: '10:00' } }) })
    await act(async () => { await actions.excluirCaso(hro(), 'c1') })
    expect(totalDe()).toBeNull()
  })

  it('ainda há cirurgia aberta: Terminada em uma delas não encosta no total', async () => {
    const segunda = umaAgendada({ id: 'c2', hora: '10:30', duracaoEstimadaMin: null })
    await montar({ hro: escalaHro([emCurso(), segunda], { [CHAVE]: { termino: '12:30' } }) })
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '09:40' }) })
    expect(totalDe()).toBe('12:30')
    expect(gravacoesDaLinha()).toHaveLength(0)
  })
})

describe('DESFAZER o Terminada: o total volta pela regra de uma cirurgia, não por foto', () => {
  it('reabre EM ANDAMENTO com estimado e é a única → o total volta a ser o estimado dela', async () => {
    const emCurso = umaAgendada({ statusCirurgia: 'iniciada', duracaoEstimadaMin: null, inicioReal: '08:05', terminoPrevisto: '10:00' })
    await montar({ hro: escalaHro([emCurso], { [CHAVE]: { termino: '10:00' } }) })
    const antes = { statusCirurgia: 'iniciada', statusExtra: null, statusAtualizadoEm: null, statusAtualizadoPor: null, terminoPrevisto: '10:00', terminoReal: null }
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '09:40' }) })
    expect(totalDe()).toBeNull()
    await act(async () => { await actions.desfazerTerminada('hro', 'c1', antes) })
    expect(casoDe('c1')).toMatchObject({ statusCirurgia: 'iniciada', terminoPrevisto: '10:00' })
    expect(totalDe()).toBe('10:00')
  })

  it('reabre sem estimado: o total fica vazio, a informar', async () => {
    const semEstimado = umaAgendada({ statusCirurgia: 'iniciada', duracaoEstimadaMin: null, inicioReal: '08:05' })
    await montar({ hro: escalaHro([semEstimado], { [CHAVE]: { termino: '10:00' } }) })
    const antes = { statusCirurgia: 'iniciada', statusExtra: null, statusAtualizadoEm: null, statusAtualizadoPor: null, terminoPrevisto: null, terminoReal: null }
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '09:40' }) })
    await act(async () => { await actions.desfazerTerminada('hro', 'c1', antes) })
    expect(totalDe()).toBeNull()
  })
})

describe('FILA ÚNICA (sáb/dom/feriado): a linha da pessoa mora na escala "fds"', () => {
  const SABADO = '2026-11-07'
  const fds = (linhaOverrides = {}) => ({
    id: 'esc-fds', hospital: 'fds', status: 'publicada', data: SABADO,
    ordemLiberacao: { matutino: ['MELO', 'FERNANDA'] }, liberacoes: {}, ajudaExterna: {},
    linhaOverrides, casos: [], fdsMeta: { grade: {}, posicoes: {} },
  })
  const totalFds = () => estado.escalas.fds?.linhaOverrides?.[CHAVE]?.termino ?? null

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(`${SABADO}T09:00:00-03:00`))
  })
  afterEach(() => { vi.useRealTimers() })

  it('o espelho do estimado grava na linha "fds" (a que a fila lê), não na escala do hospital', async () => {
    const emCurso = umaAgendada({ statusCirurgia: 'iniciada', duracaoEstimadaMin: null, inicioReal: '08:05' })
    await montar({ hro: escalaHro([emCurso], {}, { data: SABADO }), fds: fds({ [CHAVE]: { hospital: 'hro', local: 'Sala 2' } }) })
    await waitFor(() => expect(estado.escalas.fds?.id).toBe('esc-fds'))
    await act(async () => { await actions.espelharTempoTotal(hro(), casoDe('c1'), '10:30', { userId: 'uid-fer' }) })
    expect(totalFds()).toBe('10:30')
    // o hospital e o local escolhidos no painel da fila única sobrevivem
    expect(estado.escalas.fds.linhaOverrides[CHAVE]).toMatchObject({ hospital: 'hro', local: 'Sala 2' })
    expect(totalDe()).toBeNull()
    expect(new Set(gravacoesDaLinha().map((c) => c[0]))).toEqual(new Set(['esc-fds']))
  })

  it('"uma cirurgia só" conta os TRÊS hospitais: com outra aberta na Unimed, iniciar não espelha', async () => {
    const naUnimed = umaAgendada({ id: 'u1', sala: 'CC - Sala 1', duracaoEstimadaMin: null })
    await montar({
      hro: escalaHro([umaAgendada()], {}, { data: SABADO }),
      unimed: { ...escalaHro([naUnimed], {}, { data: SABADO }), id: 'esc-uni', hospital: 'unimed' },
      fds: fds(),
    })
    await waitFor(() => expect(estado.escalas.fds?.id).toBe('esc-fds'))
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(totalFds()).toBeNull()
    expect(gravacoesDaLinha()).toHaveLength(0)
  })

  it('Iniciada e Terminada da única cirurgia do dia preenchem e apagam o total na linha "fds"', async () => {
    await montar({ hro: escalaHro([umaAgendada()], {}, { data: SABADO }), fds: fds() })
    await waitFor(() => expect(estado.escalas.fds?.id).toBe('esc-fds'))
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'iniciada', { userId: 'uid-fer', inicioReal: '09:30' }) })
    expect(totalFds()).toBe('11:30')
    await act(async () => { await actions.setStatusCirurgia(hro(), casoDe('c1'), 'terminada', { userId: 'uid-fer', terminoReal: '11:10' }) })
    expect(totalFds()).toBeNull()
  })
})
