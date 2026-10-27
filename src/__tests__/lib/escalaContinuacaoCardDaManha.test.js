/**
 * CONTINUAÇÃO FICA NO CARD DA MANHÃ (dono 26/10).
 *
 * Tarde de 26/10, Umanitá: a "Minhas" do Guilherme Melo mostrava o card das 07:30
 * ("Iniciada · Passa para tarde") e, logo abaixo, o das 13:00 da linha
 * "CONTINUAÇÃO +-14h" da foto — a mesma cirurgia duas vezes. Pedido: um card só,
 * o da manhã, com as informações dele, para o horário não ir para o card errado.
 *
 * INVARIANTE: à tarde, cirurgia que continua da manhã com a mesma pessoa aparece
 * UMA vez — pelo caso da manhã — na Minhas, na Completa e na fila; e a
 * continuação nunca sobrevive sozinha ao Terminada do caso de origem.
 */
import { describe, it, expect } from 'vitest'
import {
  filtrarPorTurno, filtrarPorTurnoExibicao, casosDaFilaDoTurno, fundirContinuacoesNaOrigem,
  origemDaContinuacao, procedimentoComContinuacao,
} from '@/pages/escala-cirurgica/utils'

const RITIDO = 'RITIDOPLASTIA + BLEFARO - 5H30'
// como a publicação grava: herança da manhã + o texto da foto
const manha = (o = {}) => ({
  id: 'm-umanita', sala: 'Umanitá', ordem: 3, hora: '07:30', turno: 'matutino', procedimento: RITIDO,
  cirurgiao: 'GUSTAVO RE', anestesista: 'GUILHERME MELO', statusCirurgia: 'iniciada', inicioReal: '07:41', ...o,
})
const cont = (o = {}) => ({
  id: 't-umanita', sala: 'Umanitá', ordem: 40, hora: '13:00', turno: 'vespertino', isContinuacao: true,
  procedimento: `${RITIDO} · CONTINUAÇÃO +-14h`, cirurgiao: 'GUSTAVO RE', anestesista: 'GUILHERME MELO', ...o,
})
const outraTarde = { id: 't-sala1', sala: 'CC - Sala 1', ordem: 10, hora: '13:30', turno: 'vespertino', procedimento: 'RUPTURA DO MANGUITO ROTADOR', cirurgiao: 'GUILHERME WENTZ BIASUZ', anestesista: 'RODNEI' }
const ids = (l) => l.map((c) => c.id)

describe('a tela (Minhas) mostra um card só — o da manhã', () => {
  it('marcada "Passa para tarde": fica o card da manhã, a continuação sai', () => {
    const dia = [manha({ statusExtra: 'passa_tarde' }), cont(), outraTarde]
    const tarde = filtrarPorTurnoExibicao(dia, 'vespertino')
    expect(ids(tarde).sort()).toEqual(['m-umanita', 't-sala1'])
    const card = tarde.find((c) => c.id === 'm-umanita')
    expect(card.statusCirurgia).toBe('iniciada')
    expect(card.inicioReal).toBe('07:41')
  })

  it('sem a marcação: a continuação da foto também vira o card da manhã, com "(continuação)"', () => {
    const tarde = filtrarPorTurnoExibicao([manha(), cont(), outraTarde], 'vespertino')
    expect(ids(tarde)).toEqual(['m-umanita', 't-sala1'])
    const card = tarde[0]
    expect(procedimentoComContinuacao(card.procedimento, card, 'vespertino')).toBe(`${RITIDO} (continuação)`)
  })

  it('a manhã continua igual (o card da manhã não ganha marca nenhuma lá)', () => {
    const manhaLista = filtrarPorTurnoExibicao([manha(), cont()], 'matutino')
    expect(ids(manhaLista)).toEqual(['m-umanita'])
    expect(procedimentoComContinuacao(RITIDO, manhaLista[0], 'matutino')).toBe(RITIDO)
  })

  it('a Completa (filtro exato + fusão) também troca a continuação pelo card da manhã', () => {
    const dia = [manha(), cont(), outraTarde]
    const board = fundirContinuacoesNaOrigem(filtrarPorTurno(dia, 'vespertino'), dia, 'vespertino', { marcar: true })
    expect(ids(board)).toEqual(['m-umanita', 't-sala1'])
  })
})

describe('a fila conta a cirurgia uma vez, pelo caso da manhã', () => {
  it('com "Passa para tarde": um caso só para a pessoa', () => {
    const dia = [manha({ statusExtra: 'passa_tarde' }), cont(), outraTarde]
    const fila = casosDaFilaDoTurno(dia, 'vespertino', ['GUILHERME MELO', 'RODNEI'])
    expect(ids(fila).filter((id) => id.includes('umanita'))).toEqual(['m-umanita'])
  })

  it('Terminada no card da manhã: nenhuma continuação "agendada" fica segurando a pessoa', () => {
    const dia = [manha({ statusExtra: 'passa_tarde', statusCirurgia: 'terminada', terminoReal: '13:50' }), cont(), outraTarde]
    const fila = casosDaFilaDoTurno(dia, 'vespertino', ['GUILHERME MELO', 'RODNEI'])
    const daPessoa = fila.filter((c) => c.anestesista === 'GUILHERME MELO')
    expect(daPessoa.map((c) => c.statusCirurgia)).toEqual(['terminada'])
  })

  it('a fila recebe o objeto original (sem a marca da tela)', () => {
    const origem = manha()
    const fila = casosDaFilaDoTurno([origem, cont()], 'vespertino', ['GUILHERME MELO'])
    expect(fila[0]).toBe(origem)
  })
})

describe('o que NÃO funde', () => {
  it('continuação com outra pessoa (a tarde assumiu a sala) fica no card dela', () => {
    const tarde = filtrarPorTurnoExibicao([manha({ statusExtra: 'passa_tarde' }), cont({ anestesista: 'OSCAR' })], 'vespertino')
    expect(ids(tarde).sort()).toEqual(['m-umanita', 't-umanita'])
  })

  // dono 27/10, HIPEC da Unimed: a metade em comum (Erlei) fundia, e a fila da tarde
  // dizia Oscar no lugar do Alexandre
  it('dupla com UMA pessoa trocada fica no card da tarde', () => {
    const dia = [manha({ anestesista: 'OSCAR + ERLEI', statusExtra: 'passa_tarde' }), cont({ anestesista: 'ALEXANDRE D + ERLEI' })]
    expect(ids(filtrarPorTurnoExibicao(dia, 'vespertino')).sort()).toEqual(['m-umanita', 't-umanita'])
    const fila = casosDaFilaDoTurno(dia, 'vespertino', ['ALEXANDRE D', 'ERLEI'])
    expect(fila.map((c) => c.anestesista)).toEqual(['ALEXANDRE D + ERLEI'])
  })

  it('a MESMA dupla, em outra ordem, funde', () => {
    const dia = [manha({ anestesista: 'OSCAR + ERLEI' }), cont({ anestesista: 'ERLEI + OSCAR' })]
    expect(ids(casosDaFilaDoTurno(dia, 'vespertino', []))).toEqual(['m-umanita'])
  })

  it('manhã com "?" e a continuação com nome: o nome da tarde não se perde', () => {
    const tarde = filtrarPorTurnoExibicao([manha({ anestesista: '?', semAnestesista: true }), cont({ anestesista: 'OSCAR' })], 'vespertino')
    expect(ids(tarde)).toEqual(['t-umanita'])
  })

  it('continuação sem caso da manhã do cirurgião fica como está', () => {
    const tarde = filtrarPorTurnoExibicao([manha({ cirurgiao: 'OUTRO' }), cont()], 'vespertino')
    expect(ids(tarde)).toEqual(['t-umanita'])
  })

  it('sem linha de continuação, nada muda (mesma referência)', () => {
    const lista = [outraTarde]
    expect(fundirContinuacoesNaOrigem(lista, [manha(), outraTarde], 'vespertino')).toBe(lista)
  })
})

describe('a origem certa entre dois casos do mesmo cirurgião', () => {
  it('vence o que deixou iniciais e procedimento na continuação, não o último da sala', () => {
    const certo = manha({ id: 'm1', ordem: 1, pacienteIniciais: 'E.M.T.', procedimento: 'PROSTATOVESICULECTOMIA RADICAL ROBOTICA', cirurgiao: 'PAULO CALDAS', sala: 'CC - Sala 10' })
    const outro = manha({ id: 'm2', ordem: 5, pacienteIniciais: 'S.L.D.', procedimento: 'CISTOSCOPIA E/OU URETEROSCOPIA', cirurgiao: 'PAULO CALDAS', sala: 'CC - Sala 3' })
    const c = cont({ sala: 'CC - Sala 10', cirurgiao: 'PAULO CALDAS', pacienteIniciais: 'E.M.T.', procedimento: 'PROSTATOVESICULECTOMIA RADICAL ROBOTICA · CONTINUAÇÃO ROBOTICA +-17h' })
    expect(origemDaContinuacao(c, [certo, outro, c]).id).toBe('m1')
  })

  it('o "//" da manhã é resolvido antes de comparar a pessoa', () => {
    const primeira = manha({ id: 'm0', ordem: 0, procedimento: 'OUTRA', hora: '07:30' })
    const segunda = manha({ id: 'm-umanita', ordem: 1, anestesista: '//', hora: '10:00' })
    const tarde = filtrarPorTurnoExibicao([primeira, segunda, cont()], 'vespertino')
    expect(ids(tarde)).toEqual(['m-umanita'])
  })
})
