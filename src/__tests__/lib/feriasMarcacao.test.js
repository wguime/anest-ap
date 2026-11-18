/**
 * Validação/simulação da marcação — regras 2026/27 (desde 18/11/2026): o app
 * TRAVA o que descumpre regra [TRAVA] (por dia e pela seleção inteira) e o
 * dia lotado vira CANDIDATO, sem custo agora (V-10).
 */
import { describe, it, expect } from 'vitest'
import {
  hojeLocalISO, avaliarMarcacaoDia, avaliarDesmarcacaoDia,
  montarResumoConfirmacao, montarMovimentacoesParaInsert, limitesDaPessoa,
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

  it('V-10: dia com 6 vagas aceita como CANDIDATO, sem custo agora', () => {
    const porDia = new Map([['2026-09-10', ['A', 'B', 'C', 'D', 'E', 'F']]])
    const r = avaliarMarcacaoDia({ ...base, data: '2026-09-10', porDia })
    expect(r.ok).toBe(true)
    expect(r.custoDias).toBe(1)
    expect(r.avisos.find((a) => a.tipo === 'CANDIDATO').msg).toContain('V-10')
  })

  it('V-33: na 2ª quinzena de dezembro o candidato não perde dias', () => {
    const porDia = new Map([['2026-12-17', ['A', 'B', 'C', 'D', 'E', 'F']]])
    const r = avaliarMarcacaoDia({ ...base, data: '2026-12-17', porDia })
    expect(r.avisos.find((a) => a.tipo === 'CANDIDATO').msg).toContain('V-33')
  })

  it('dia com 5 vagas: custo normal', () => {
    const porDia = new Map([['2026-09-10', ['A', 'B', 'C', 'D', 'E']]])
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-10', porDia }).custoDias).toBe(1)
  })

  it('V-11: o dia do feriado não tem vaga — bloqueia', () => {
    const r = avaliarMarcacaoDia({ ...base, data: '2026-09-07' })
    expect(r.ok).toBe(false)
    expect(r.bloqueio.tipo).toBe('FERIADO')
  })

  it('sócio fora da lista do ano não marca', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-10', socioNoAno: false }).bloqueio.tipo).toBe('FORA_DO_GRUPO')
  })

  it('período de congresso avisa sobre os 2 dias com comprovante (V-22)', () => {
    const r = avaliarMarcacaoDia({ ...base, data: '2026-11-26', hojeISO: '2026-11-18' })
    expect(r.avisos.map((a) => a.tipo)).toContain('CONGRESSO')
  })
})

describe('avaliarMarcacaoDia — teto do semestre e cota (V-02/V-05)', () => {
  const base = { nome: NOME, hojeISO: '2026-03-02', feriados: FERIADOS }
  const limites = (S1, S2, extra = {}) => ({
    cota: 30, usadosAno: S1 + S2, maxSemestre: 15, semestreLivre: false, usados: { S1, S2 },
    temFilho: null, listaFilhos: false, ...extra,
  })

  it('no teto, o semestre BLOQUEIA — nos dois semestres', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-15', limites: limites(0, 15) }).bloqueio.tipo).toBe('SEMESTRE')
    expect(avaliarMarcacaoDia({ ...base, data: '2026-06-30', limites: limites(15, 0) }).bloqueio.tipo).toBe('SEMESTRE')
  })

  it('abaixo do teto libera', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-09-15', limites: limites(10, 14) }).ok).toBe(true)
  })

  it('cota completa bloqueia (adiantamento só com o comitê)', () => {
    const r = avaliarMarcacaoDia({ ...base, data: '2026-09-15', limites: { ...limites(15, 14), usadosAno: 30 } })
    expect(r.bloqueio.tipo).toBe('COTA')
    expect(r.bloqueio.msg).toContain('V-05')
  })

  it('V-13: com a lista de filhos cadastrada, julho escolar é só de quem tem filho até 2 meses antes', () => {
    const lim = limites(0, 0, { listaFilhos: true, temFilho: false })
    expect(avaliarMarcacaoDia({ ...base, data: '2026-08-18', limites: lim }).bloqueio.tipo).toBe('JULHO_ESCOLAR')
    expect(avaliarMarcacaoDia({ ...base, data: '2026-08-18', limites: { ...lim, temFilho: true } }).ok).toBe(true)
    // a partir de 2 meses antes da semana, qualquer sócio
    expect(avaliarMarcacaoDia({ ...base, hojeISO: '2026-06-18', data: '2026-08-18', limites: lim }).ok).toBe(true)
  })

  it('sem lista de filhos cadastrada, julho não trava ninguém', () => {
    expect(avaliarMarcacaoDia({ ...base, data: '2026-08-18', limites: limites(0, 0) }).ok).toBe(true)
  })

  it('limitesDaPessoa soma a seleção pendente no semestre certo', () => {
    const pessoa = { cota: 30, diasContaveis: ['2026-03-02', '2026-09-01'], diasContados: 2, penalidades: [] }
    const l = limitesDaPessoa({ pessoa, pendentes: ['2026-09-02', '2026-09-03'] })
    expect(l.usados).toEqual({ S1: 1, S2: 3 })
    expect(l.usadosAno).toBe(4)
    expect(l.maxSemestre).toBe(15)
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

  it('saldo cai ao marcar e sobe ao desmarcar; dia lotado vira candidatura sem custo extra', () => {
    // semana 14–18/09 sem feriado (na de 07/09 o dia solto pagaria o feriado, V-19)
    const porDia = new Map([['2026-09-17', ['A', 'B', 'C', 'D', 'E', 'F']]])
    const estadoPorDia = new Map([[chaveDia(NOME, '2026-03-02'), { codigo: 'c0', origem: 'pp' }]])
    const resumo = montarResumoConfirmacao({
      registrosPP,
      movimentacoes: [],
      selecoes: { marcar: new Set(['2026-09-17', '2026-09-18']), desmarcar: new Set(['2026-03-02']) },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: [], estadoPorDia, porDia,
    })
    expect(resumo.totalMarcar).toBe(2)
    expect(resumo.totalDesmarcar).toBe(1)
    expect(resumo.diasAntes).toBe(3)
    expect(resumo.diasDepois).toBe(4)
    expect(resumo.custoDeclaradoExtra).toBe(0)
    expect(resumo.candidaturas).toEqual(['2026-09-17'])
    expect(resumo.bloqueios).toEqual([])
  })

  it('seleção que quebra regra [TRAVA] vira BLOQUEIO com o código (seção 9)', () => {
    // 6 dias avulsos no 2º semestre (cota 30 → 15, exige 2 semanas cheias → máx. 5 avulsos)
    const avulsos = ['2026-09-01', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-20']
    const resumo = montarResumoConfirmacao({
      registrosPP: [], movimentacoes: [],
      selecoes: { marcar: new Set(avulsos), desmarcar: new Set() },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: [], estadoPorDia: new Map(), porDia: new Map(),
    })
    const b = resumo.bloqueios.find((v) => v.regra === 'SEMANAS_INTEIRAS')
    expect(b).toBeTruthy()
    expect(b.codigo).toBe('V-06')
    expect(resumo.bloqueios.every((v) => v.pessoa === NOME)).toBe(true)
  })

  it('V-07: a 3ª sexta isolada só passa na semana vigente', () => {
    const tresSextas = ['2026-09-04', '2026-09-18', '2026-10-02']
    const fora = montarResumoConfirmacao({
      registrosPP: [], movimentacoes: [],
      selecoes: { marcar: new Set(tresSextas), desmarcar: new Set() },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: [], estadoPorDia: new Map(), porDia: new Map(),
    })
    expect(fora.bloqueios.some((v) => v.regra === 'SEG_SEX_ISOLADA')).toBe(true)

    // já tem 2 sextas isoladas; a 3ª é a sexta desta semana (hoje = terça 04/08)
    const registrosPP2 = ['2026-08-21', '2026-09-04'].map((data, i) => ({ codigo: `s${i}`, nome: NOME, data, ehFimDeSemana: false }))
    const vigente = montarResumoConfirmacao({
      registrosPP: registrosPP2, movimentacoes: [],
      selecoes: { marcar: new Set(['2026-08-07']), desmarcar: new Set() },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: [], estadoPorDia: new Map(), porDia: new Map(),
    })
    expect(vigente.bloqueios.some((v) => v.regra === 'SEG_SEX_ISOLADA')).toBe(false)
    expect(vigente.avisosNovos.some((v) => v.regra === 'SEG_SEX_ISOLADA')).toBe(true)
  })

  it('V-25: desmarcar semana em mês nobre a menos de 1 mês bloqueia', () => {
    const semanaJan = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08']
    const regs = semanaJan.map((data, i) => ({ codigo: `j${i}`, nome: NOME, data, ehFimDeSemana: false }))
    const estadoPorDia = new Map(semanaJan.map((d, i) => [chaveDia(NOME, d), { codigo: `j${i}`, origem: 'pp' }]))
    const r = montarResumoConfirmacao({
      registrosPP: regs, movimentacoes: [],
      selecoes: { marcar: new Set(), desmarcar: new Set(['2027-01-08']) },
      nome: NOME, ano: 2027, socios, feriados: getFeriados(2027), hojeISO: '2026-12-20',
      violacoesAtuais: [], estadoPorDia, porDia: new Map(),
    })
    expect(r.bloqueios.map((v) => v.codigo)).toContain('V-25')
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
    const novas = (r) => [...r.bloqueios, ...r.avisosNovos]
    expect(novas(resumo).some((v) => v.regra === 'SEMANAS_INTEIRAS')).toBe(true)

    // com a mesma violação já listada como atual, ela não reaparece
    const jaExistente = novas(resumo).filter((v) => v.regra === 'SEMANAS_INTEIRAS')
    const resumo2 = montarResumoConfirmacao({
      registrosPP: [], movimentacoes: [],
      selecoes: { marcar: new Set(avulsos), desmarcar: new Set() },
      nome: NOME, ano: 2026, socios, feriados: FERIADOS, hojeISO: HOJE,
      violacoesAtuais: jaExistente, estadoPorDia: new Map(), porDia: new Map(),
    })
    expect(novas(resumo2).some((v) => v.regra === 'SEMANAS_INTEIRAS')).toBe(false)
  })
})

describe('montarMovimentacoesParaInsert', () => {
  it('marcar sai app/sem código; desmarcar de dia do PP leva codigo_pp; custo e reqId', () => {
    const estadoPorDia = new Map([
      [chaveDia(NOME, '2026-03-02'), { codigo: 'cPP', origem: 'pp' }],
      [chaveDia(NOME, '2026-03-03'), { codigo: 'app:m1', origem: 'app' }],
    ])
    const resumo = {
      linhas: [{ data: '2026-09-10', acao: 'marcar', custoDias: 3, avisos: [{ tipo: 'CANDIDATO' }] }],
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

describe('lista de filhos em idade escolar (V-13, dono 18/11/2026)', () => {
  it('13 sócios marcados, lista vale em 2026 e 2027', async () => {
    const { getSocios } = await import('../../lib/feriasSocios')
    for (const ano of [2026, 2027]) {
      const com = getSocios(ano).filter((s) => s.filhosIdadeEscolar === true).map((s) => s.nome)
      expect(com, String(ano)).toHaveLength(13)
      expect(com).toContain('G. STAUB')
      expect(getSocios(ano).every((s) => typeof s.filhosIdadeEscolar === 'boolean')).toBe(true)
    }
  })
})
