/**
 * Validação/simulação da marcação: prazos (bloqueios duros), custo da 7ª
 * vaga, avisos e o resumo de confirmação (saldo antes/depois + violações
 * NOVAS). Filosofia: só prazo bloqueia; custo e cota confirmam.
 */
import { describe, it, expect } from 'vitest'
import {
  hojeLocalISO, avaliarMarcacaoDia, avaliarDesmarcacaoDia,
  montarResumoConfirmacao, montarMovimentacoesParaInsert, CUSTO_SETIMA_VAGA,
} from '../../lib/feriasMarcacao'
import { chaveDia } from '../../lib/feriasMovimentacoes'
import { getFeriados } from '../../lib/feriasFeriados'

const NOME = 'G. MELO'
const HOJE = '2026-08-04' // terça
const FERIADOS = getFeriados(2026)
const socios = [{ nome: NOME, nomeCompleto: 'Guilherme Souza Melo', anoEntrada: 2021, filhosIdadeEscolar: null }]

describe('hojeLocalISO — virada de ano em UTC-3', () => {
  it('21h de 31/12 continua sendo 31/12 (toISOString diria 01/01)', () => {
    const noite = new Date(2026, 11, 31, 21, 30, 0) // local
    expect(hojeLocalISO(noite)).toBe('2026-12-31')
    expect(hojeLocalISO(noite)).not.toBe(noite.toISOString().slice(0, 10))
  })

  it('formata com zero à esquerda', () => {
    expect(hojeLocalISO(new Date(2026, 0, 5, 8, 0, 0))).toBe('2026-01-05')
  })
})

describe('avaliarMarcacaoDia — bloqueios e avisos', () => {
  const base = { nome: NOME, hojeISO: HOJE, feriados: FERIADOS }

  it('bloqueia fim de semana, passado e hoje', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-08-08' }).bloqueio.tipo).toBe('FDS')
    expect(avaliarMarcacaoDia({ ...base, data: '2026-08-03' }).bloqueio.tipo).toBe('PASSADO')
    expect(avaliarMarcacaoDia({ ...base, data: HOJE }).bloqueio.tipo).toBe('PASSADO')
  })

  it('amanhã é permitido, com aviso de véspera', () => {
    const r = avaliarMarcacaoDia({ ...base, data: '2026-08-05' })
    expect(r.ok).toBe(true)
    expect(r.avisos.map((a) => a.tipo)).toContain('VESPERA')
  })

  it('dia já marcado bloqueia', () => {
    const estadoPorDia = new Map([[chaveDia(NOME, '2026-09-10'), { codigo: 'c1', origem: 'pp' }]])
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-10', estadoPorDia }).bloqueio.tipo).toBe('JA_MARCADO')
  })

  it('dia com 6 vagas: permitido, custo 3 declarado', () => {
    const porDia = new Map([['2026-09-10', ['A', 'B', 'C', 'D', 'E', 'F']]])
    const r = avaliarMarcacaoDia({ ...base, data: '2026-09-10', porDia })
    expect(r.ok).toBe(true)
    expect(r.custoDias).toBe(CUSTO_SETIMA_VAGA)
    expect(r.avisos.find((a) => a.tipo === 'SETIMA_VAGA')).toBeTruthy()
  })

  it('dia com 5 vagas: custo normal', () => {
    const porDia = new Map([['2026-09-10', ['A', 'B', 'C', 'D', 'E']]])
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-10', porDia }).custoDias).toBe(1)
  })

  it('feriado avisa sobre a regra da semana inteira', () => {
    const r = avaliarMarcacaoDia({ ...base, data: '2026-09-07' })
    expect(r.avisos.map((a) => a.tipo)).toContain('FERIADO')
  })
})

describe('avaliarMarcacaoDia — teto do 2º semestre (dono 19/08)', () => {
  const base = { nome: NOME, hojeISO: HOJE, feriados: FERIADOS }
  // Cota 30 → metade 15. O corte é 30/06 (ninguém marcado com filhos em
  // idade escolar hoje em feriasSocios.js).
  const semestre = (usadosS2) => ({ corte: '2026-06-30', maxS2: 15, usadosS2 })

  it('no teto, dia do 2º semestre é BLOQUEIO — não é custo a confirmar', () => {
    const r = avaliarMarcacaoDia({ ...base, data: '2026-09-15', semestre: semestre(15) })
    expect(r.ok).toBe(false)
    expect(r.bloqueio.tipo).toBe('METADE_SEGUNDO_SEMESTRE')
    expect(r.bloqueio.msg).toContain('15')
  })

  it('abaixo do teto libera o mesmo dia', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-15', semestre: semestre(14) }).ok).toBe(true)
  })

  it('o teto não alcança o 1º semestre — lá pode passar da metade', () => {
    // 30/06 é o próprio corte: ainda é 1º semestre (hoje recuado para o dia
    // ser futuro; senão o bloqueio de prazo responde antes)
    const r = avaliarMarcacaoDia({ ...base, hojeISO: '2026-03-02', data: '2026-06-30', semestre: semestre(20) })
    expect(r.ok).toBe(true)
  })

  it('sem `semestre` (1º ano, cota livre) nada é bloqueado', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-15' }).ok).toBe(true)
  })
})

describe('avaliarDesmarcacaoDia — prazo é bloqueio duro', () => {
  const estadoPorDia = new Map([
    [chaveDia(NOME, '2026-08-05'), { codigo: 'c1', origem: 'pp' }], // amanhã
    [chaveDia(NOME, '2026-08-06'), { codigo: 'c2', origem: 'pp' }], // depois de amanhã
  ])

  it('véspera (amanhã) bloqueia — escala já saiu', () => {
    const r = avaliarDesmarcacaoDia({ data: '2026-08-05', nome: NOME, estadoPorDia, hojeISO: HOJE })
    expect(r.ok).toBe(false)
    expect(r.bloqueio.tipo).toBe('PRAZO')
  })

  it('depois de amanhã pode', () => {
    expect(avaliarDesmarcacaoDia({ data: '2026-08-06', nome: NOME, estadoPorDia, hojeISO: HOJE }).ok).toBe(true)
  })

  it('dia sem férias bloqueia', () => {
    const r = avaliarDesmarcacaoDia({ data: '2026-09-30', nome: NOME, estadoPorDia, hojeISO: HOJE })
    expect(r.bloqueio.tipo).toBe('NAO_MARCADO')
  })
})

describe('montarResumoConfirmacao', () => {
  const registrosPP = ['2026-03-02', '2026-03-03', '2026-03-04'].map((data, i) => ({
    codigo: `c${i}`, nome: NOME, data, ehFimDeSemana: false,
  }))

  it('saldo cai ao marcar e sobe ao desmarcar; custo extra da 7ª vaga é somado à parte', () => {
    const porDia = new Map([['2026-09-10', ['A', 'B', 'C', 'D', 'E', 'F']]])
    const estadoPorDia = new Map([[chaveDia(NOME, '2026-03-02'), { codigo: 'c0', origem: 'pp' }]])
    const resumo = montarResumoConfirmacao({
      registrosPP,
      movimentacoes: [],
      selecoes: { marcar: new Set(['2026-09-10', '2026-09-11']), desmarcar: new Set(['2026-03-02']) },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: [], estadoPorDia, porDia,
    })
    expect(resumo.totalMarcar).toBe(2)
    expect(resumo.totalDesmarcar).toBe(1)
    expect(resumo.diasAntes).toBe(3)
    // +2 marcados, -1 desmarcado = 4 no calendário, mais os 2 dias extras da
    // 7ª vaga, que o dono mandou DEBITAR (04/08): o resumo declara o efetivo
    expect(resumo.diasDepois).toBe(6)
    expect(resumo.saldoDepois).toBe(resumo.saldoAntes - 3)
    expect(resumo.custoDeclaradoExtra).toBe(CUSTO_SETIMA_VAGA - 1) // só o dia lotado
    expect(resumo.custoTotal).toBe(CUSTO_SETIMA_VAGA + 1)
  })

  it('lista SÓ violações novas (não repete as pré-existentes)', () => {
    // cota 30 (entrada 2021); marcar muitos dias avulsos cria SEMANAS_INTEIRAS
    const avulsos = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29',
      '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10']
    const resumo = montarResumoConfirmacao({
      registrosPP: [], movimentacoes: [],
      selecoes: { marcar: new Set(avulsos), desmarcar: new Set() },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: [], estadoPorDia: new Map(), porDia: new Map(),
    })
    expect(resumo.avisosNovos.some((v) => v.regra === 'SEMANAS_INTEIRAS')).toBe(true)

    // com a mesma violação já listada como atual, ela não reaparece
    const jaExistente = resumo.avisosNovos.filter((v) => v.regra === 'SEMANAS_INTEIRAS')
    const resumo2 = montarResumoConfirmacao({
      registrosPP: [], movimentacoes: [],
      selecoes: { marcar: new Set(avulsos), desmarcar: new Set() },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: jaExistente, estadoPorDia: new Map(), porDia: new Map(),
    })
    expect(resumo2.avisosNovos.some((v) => v.regra === 'SEMANAS_INTEIRAS')).toBe(false)
  })
})

describe('montarMovimentacoesParaInsert', () => {
  it('marcar sai app/sem código; desmarcar de dia do PP leva codigo_pp; custo e reqId', () => {
    const estadoPorDia = new Map([
      [chaveDia(NOME, '2026-03-02'), { codigo: 'cPP', origem: 'pp' }],
      [chaveDia(NOME, '2026-03-03'), { codigo: 'app:m1', origem: 'app' }],
    ])
    const resumo = {
      linhas: [{ data: '2026-09-10', acao: 'marcar', custoDias: 3, avisos: [{ tipo: 'SETIMA_VAGA' }] }],
    }
    const rows = montarMovimentacoesParaInsert({
      selecoes: { marcar: new Set(['2026-09-10']), desmarcar: new Set(['2026-03-02', '2026-03-03']) },
      nome: NOME, ano: 2026, estadoPorDia, resumo, userId: 'uid-1', reqId: 'req-abc',
    })

    expect(rows).toHaveLength(3)
    const marcar = rows.find((r) => r.acao === 'marcar')
    expect(marcar).toMatchObject({
      origem_dia: 'app', codigo_pp: null, custo_dias: 3, user_id: 'uid-1', req_id: 'req-abc', ano: 2026,
    })
    expect(marcar.avisos_aceitos).toHaveLength(1)

    const desmarcarPP = rows.find((r) => r.data === '2026-03-02')
    expect(desmarcarPP).toMatchObject({ acao: 'desmarcar', origem_dia: 'pegaplantao', codigo_pp: 'cPP', custo_dias: 0 })

    const desmarcarApp = rows.find((r) => r.data === '2026-03-03')
    expect(desmarcarApp).toMatchObject({ acao: 'desmarcar', origem_dia: 'app', codigo_pp: null })
  })
})
