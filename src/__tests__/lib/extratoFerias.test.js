/**
 * Contagem do Extrato de Férias — casos calcados nos dados REAIS de 2026
 * levantados na sessão de 03/08 (07/09 marcado por 6 pessoas em semana
 * inteira; domingo 12/07 marcado por engano; semana do Carnaval).
 */
import { describe, it, expect } from 'vitest'
import {
  diaDaSemana,
  ehFimDeSemana,
  segundaDaSemana,
  diasUteisDaSemana,
  normalizarRegistrosFerias,
  calcularCota,
  contarDias,
  agruparPeriodos,
  construirExtrato,
} from '../../lib/extratoFerias'
import { getFeriados } from '../../lib/feriasFeriados'

const FERIADOS = getFeriados(2026)

const plantaoFerias = (nome, data, extra = {}) => ({
  CodigoPlantao: `${nome}-${data}`,
  Setor: 'Férias',
  ProfDePlantao: nome,
  Inicio: `${data}T07:00:00`,
  Fim: `${data}T19:00:00`,
  ...extra,
})

describe('helpers de data', () => {
  it('dia da semana imune a timezone', () => {
    expect(diaDaSemana('2026-07-12')).toBe(0) // domingo real dos dados
    expect(diaDaSemana('2026-08-03')).toBe(1)
    expect(ehFimDeSemana('2026-07-11')).toBe(true)
    expect(ehFimDeSemana('2026-07-13')).toBe(false)
  })

  it('segunda da semana: domingo pertence à semana ANTERIOR', () => {
    expect(segundaDaSemana('2026-07-12')).toBe('2026-07-06')
    expect(segundaDaSemana('2026-07-13')).toBe('2026-07-13')
    expect(segundaDaSemana('2026-09-11')).toBe('2026-09-07')
  })

  it('dias úteis da semana excluem feriado (semana da Independência)', () => {
    expect(diasUteisDaSemana('2026-09-07', FERIADOS)).toEqual([
      '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    ])
  })
})

describe('normalizarRegistrosFerias', () => {
  it('filtra Setor férias, dedup por CodigoPlantao e marca FDS', () => {
    const regs = normalizarRegistrosFerias([
      plantaoFerias('G. Melo', '2026-01-05'),
      plantaoFerias('G. Melo', '2026-01-05'), // duplicado
      plantaoFerias('João Ricardo Moreira', '2026-07-12'), // domingo
      { CodigoPlantao: 'x', Setor: 'ANESTESIA CHAPECO - 1 - P1', ProfDePlantao: 'Outro', Inicio: '2026-01-05T19:00:00' },
    ])
    expect(regs).toHaveLength(2)
    expect(regs[0]).toMatchObject({ nome: 'G. MELO', data: '2026-01-05', ehFimDeSemana: false })
    expect(regs[1]).toMatchObject({ nome: 'JOÃO RICARDO MOREIRA', data: '2026-07-12', ehFimDeSemana: true })
  })

  it('aceita "FÉRIAS" sem acento e usa ProfFixo como fallback', () => {
    const regs = normalizarRegistrosFerias([
      { CodigoPlantao: 'a', Setor: 'FERIAS', ProfFixo: 'Raquel Schneider', Inicio: '2026-01-05T07:00:00' },
    ])
    expect(regs).toHaveLength(1)
    expect(regs[0].nome).toBe('RAQUEL SCHNEIDER')
  })
})

describe('calcularCota — fronteiras da progressão', () => {
  const cota = (anoEntrada) => calcularCota({ anoEntrada, anoRef: 2026 }).cota
  it.each([
    [2026, 5],   // 1º ano
    [2025, 20],  // 2º ano
    [2024, 20],  // 3º ano
    [2023, 30],  // 4º ano
    [2002, 30],  // 24 anos
    [2001, 31],  // 25 anos → +1
    [2000, 32],  // 26 anos → +2
    [1997, 35],  // 29 anos → +5 (teto)
    [1988, 35],  // 38 anos → teto mantém 35
  ])('entrada %i → cota %i', (anoEntrada, esperado) => {
    expect(cota(anoEntrada)).toBe(esperado)
  })
})

describe('contarDias — regra de feriado e FDS', () => {
  it('feriado com semana inteira marcada NÃO conta (07/09 real)', () => {
    const dias = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
    const r = contarDias(dias, FERIADOS)
    expect(r.diasContados).toBe(4)
    expect(r.feriadosNaoContados).toEqual(['2026-09-07'])
    expect(r.semanas).toEqual([
      { segunda: '2026-09-07', dias, inteira: true },
    ])
  })

  it('feriado marcado em semana PARCIAL conta como dia de férias', () => {
    const r = contarDias(['2026-09-07', '2026-09-08'], FERIADOS)
    expect(r.diasContados).toBe(2)
    expect(r.feriadosContados).toEqual(['2026-09-07'])
  })

  it('fim de semana nunca conta (domingo 12/07 sujo dos dados reais)', () => {
    const r = contarDias(['2026-07-12', '2026-07-13'], FERIADOS)
    expect(r.diasContados).toBe(1)
    expect(r.fdsIgnorados).toEqual(['2026-07-12'])
  })

  it('semana do Carnaval: 16+18+19+20/02 é semana INTEIRA (17/02 é feriado do grupo)', () => {
    const r = contarDias(['2026-02-16', '2026-02-18', '2026-02-19', '2026-02-20'], FERIADOS)
    expect(r.diasContados).toBe(4)
    expect(r.semanas[0].inteira).toBe(true)
  })

  it('semana sem feriado exige os 5 dias para ser inteira', () => {
    const r = contarDias(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'], FERIADOS)
    expect(r.semanas[0].inteira).toBe(false)
  })
})

describe('agruparPeriodos — ponte sobre FDS e feriado', () => {
  it('duas semanas emendadas viram um período de 10 dias úteis', () => {
    const dias = [
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
      '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24',
    ]
    expect(agruparPeriodos(dias, FERIADOS)).toEqual([
      { inicio: '2026-07-13', fim: '2026-07-24', diasUteis: 10 },
    ])
  })

  it('feriado no meio não quebra o período (20 e 22/04, Tiradentes dia 21)', () => {
    expect(agruparPeriodos(['2026-04-20', '2026-04-22'], FERIADOS)).toEqual([
      { inicio: '2026-04-20', fim: '2026-04-22', diasUteis: 2 },
    ])
  })

  it('dias avulsos distantes viram períodos separados', () => {
    expect(agruparPeriodos(['2026-02-09', '2026-02-26'], FERIADOS)).toHaveLength(2)
  })
})

describe('construirExtrato', () => {
  const socios = [
    { nome: 'LEANDRO BERNARDES', anoEntrada: 2020, filhosIdadeEscolar: null },
    { nome: 'NATHALIA FORNARI FERNANDES', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'SEM FERIAS', anoEntrada: 2010, filhosIdadeEscolar: null },
  ]

  it('gera entrada para todo sócio (mesmo com 0 dias) e calcula saldo', () => {
    const registros = normalizarRegistrosFerias([
      plantaoFerias('Leandro Bernardes', '2026-02-09'),
      plantaoFerias('Nathalia Fornari Fernandes', '2026-03-13'),
    ])
    const extrato = construirExtrato({ registros, ano: 2026, socios, feriados: FERIADOS })
    expect(extrato.porPessoa).toHaveLength(3)
    const leandro = extrato.porPessoa.find((p) => p.nome === 'LEANDRO BERNARDES')
    expect(leandro).toMatchObject({ cota: 30, diasContados: 1, saldo: 29 })
    const semFerias = extrato.porPessoa.find((p) => p.nome === 'SEM FERIAS')
    expect(semFerias).toMatchObject({ diasContados: 0, saldo: 30, periodos: [] })
    expect(extrato.totalPessoasComFerias).toBe(2)
  })

  it('nome da API fora da lista de sócios vai para naoReconhecidos', () => {
    const registros = normalizarRegistrosFerias([plantaoFerias('Visitante Novo', '2026-05-04')])
    const extrato = construirExtrato({ registros, ano: 2026, socios, feriados: FERIADOS })
    expect(extrato.naoReconhecidos).toEqual([{ nome: 'VISITANTE NOVO', dias: 1 }])
  })

  it('porDia inclui feriado marcado (ocupa vaga) e exclui FDS', () => {
    const registros = normalizarRegistrosFerias([
      plantaoFerias('Leandro Bernardes', '2026-09-07'),
      plantaoFerias('Nathalia Fornari Fernandes', '2026-09-07'),
      plantaoFerias('Leandro Bernardes', '2026-07-12'), // domingo
    ])
    const extrato = construirExtrato({ registros, ano: 2026, socios, feriados: FERIADOS })
    expect(extrato.porDia.get('2026-09-07')).toHaveLength(2)
    expect(extrato.porDia.has('2026-07-12')).toBe(false)
  })

  it('porMes agrega só dias contáveis', () => {
    const registros = normalizarRegistrosFerias([
      plantaoFerias('Leandro Bernardes', '2026-09-07'),
      plantaoFerias('Leandro Bernardes', '2026-09-08'),
      plantaoFerias('Leandro Bernardes', '2026-09-09'),
      plantaoFerias('Leandro Bernardes', '2026-09-10'),
      plantaoFerias('Leandro Bernardes', '2026-09-11'),
      plantaoFerias('Leandro Bernardes', '2026-10-01'),
    ])
    const extrato = construirExtrato({ registros, ano: 2026, socios, feriados: FERIADOS })
    const leandro = extrato.porPessoa.find((p) => p.nome === 'LEANDRO BERNARDES')
    // semana inteira da Independência: 07/09 não conta
    expect(leandro.porMes).toEqual({ '2026-09': 4, '2026-10': 1 })
  })
})
