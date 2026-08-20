/**
 * Metades do ano — regra da metade da COTA por semestre (dono 19/08) e a
 * semana corrida do 1º ano. A fixture principal é o extrato REAL que o dono
 * mandou na captura de 19/08: 26 dias marcados, 7 no 1º semestre e 19 no 2º.
 */
import { describe, it, expect } from 'vitest'
import { construirExtrato, ehFimDeSemana } from '../../lib/extratoFerias'
import { getFeriados } from '../../lib/feriasFeriados'
import {
  corteSemestre,
  linhaAnaliseSemestre,
  metadesDaCota,
  resumoSemestres,
  semanaCorridaPrimeiroAno,
  vagasRestantesSegundoSemestre,
} from '../../lib/feriasSemestre'

const FERIADOS = getFeriados(2026)
const NOME = 'PESSOA TESTE'

const reg = (nome, data) => ({ codigo: `${nome}-${data}`, nome, data, ehFimDeSemana: ehFimDeSemana(data) })

/** Dias úteis sequenciais a partir de uma data (pula FDS). */
const uteis = (inicioISO, n) => {
  const out = []
  const d = new Date(`${inicioISO}T12:00:00Z`)
  while (out.length < n) {
    const dow = d.getUTCDay()
    if (dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

const montar = (dias, { anoEntrada = 2010, filhosIdadeEscolar = null, ano = 2026 } = {}) => {
  const extrato = construirExtrato({
    registros: dias.map((d) => reg(NOME, d)),
    ano,
    socios: [{ nome: NOME, anoEntrada, filhosIdadeEscolar }],
    feriados: FERIADOS,
  })
  return extrato.porPessoa[0]
}

// Captura do dono (19/08): 7 dias no 1º semestre, 19 no 2º, cota 30.
const CAPTURA = [
  '2026-03-24',
  ...uteis('2026-05-20', 3),
  ...uteis('2026-05-28', 2),
  '2026-06-29',
  '2026-07-07',
  ...uteis('2026-07-09', 7),
  '2026-08-14',
  ...uteis('2026-10-19', 10),
]

describe('metadesDaCota', () => {
  it('cota par divide ao meio', () => {
    expect(metadesDaCota(30)).toMatchObject({ minS1: 15, maxS2: 15, semestreLivre: false })
    expect(metadesDaCota(20)).toMatchObject({ minS1: 10, maxS2: 10, semestreLivre: false })
  })

  it('cota ímpar sobra para o 1º semestre — o 2º nunca passa da metade', () => {
    // 35 dias (25+ anos de grupo): 17,5 → teto 17 no 2º, piso 18 no 1º
    expect(metadesDaCota(35)).toMatchObject({ minS1: 18, maxS2: 17 })
    expect(metadesDaCota(31)).toMatchObject({ minS1: 16, maxS2: 15 })
  })

  it('1º ano (5 dias) fica livre entre os semestres', () => {
    expect(metadesDaCota(5)).toMatchObject({ minS1: 0, maxS2: 5, semestreLivre: true })
  })
})

describe('corteSemestre', () => {
  it('30/06 por padrão; 31/07 com filhos em idade escolar', () => {
    expect(corteSemestre({ ano: 2026 })).toBe('2026-06-30')
    expect(corteSemestre({ ano: 2026, filhosIdadeEscolar: null })).toBe('2026-06-30')
    expect(corteSemestre({ ano: 2026, filhosIdadeEscolar: true })).toBe('2026-07-31')
  })
})

describe('resumoSemestres — captura real do dono (cota 30)', () => {
  const resumo = resumoSemestres(montar(CAPTURA), { ano: 2026, feriados: FERIADOS })

  it('separa 7 dias no 1º semestre e 19 no 2º', () => {
    expect(resumo.s1.total).toBe(7)
    expect(resumo.s2.total).toBe(19)
    expect(resumo.s1.total + resumo.s2.total).toBe(26)
  })

  it('acusa 8 dias faltando no piso do 1º semestre', () => {
    expect(resumo.s1.minimo).toBe(15)
    expect(resumo.s1.falta).toBe(8)
    expect(resumo.s1.ok).toBe(false)
  })

  it('acusa 4 dias acima do teto do 2º semestre', () => {
    expect(resumo.s2.maximo).toBe(15)
    expect(resumo.s2.excede).toBe(4)
    expect(resumo.s2.restante).toBe(0)
    expect(resumo.s2.ok).toBe(false)
  })

  it('lista os períodos dentro do semestre a que pertencem', () => {
    expect(resumo.s1.periodos.map((p) => p.inicio)).toEqual([
      '2026-03-24', '2026-05-20', '2026-05-28', '2026-06-29',
    ])
    expect(resumo.s2.periodos[0].inicio).toBe('2026-07-07')
    expect(resumo.s2.periodos.at(-1)).toMatchObject({ inicio: '2026-10-19', fim: '2026-10-30', diasUteis: 10 })
  })
})

describe('resumoSemestres — fronteira e casos permitidos', () => {
  it('mais que a metade no 1º semestre é permitido (só o 2º tem teto)', () => {
    const resumo = resumoSemestres(montar(uteis('2026-01-05', 20)), { ano: 2026, feriados: FERIADOS })
    expect(resumo.s1.total).toBe(20)
    expect(resumo.s1.excedente).toBe(5)
    expect(resumo.s1.ok).toBe(true)
    expect(resumo.s2.ok).toBe(true)
  })

  it('bloco que atravessa 30/06 é partido nos dois semestres', () => {
    // 29/06 (seg) a 03/07 (sex): 2 dias caem no 1º semestre, 3 no 2º
    const resumo = resumoSemestres(montar(uteis('2026-06-29', 5)), { ano: 2026, feriados: FERIADOS })
    expect(resumo.s1.total).toBe(2)
    expect(resumo.s2.total).toBe(3)
    expect(resumo.s1.periodos).toEqual([{ inicio: '2026-06-29', fim: '2026-06-30', diasUteis: 2 }])
    expect(resumo.s2.periodos).toEqual([{ inicio: '2026-07-01', fim: '2026-07-03', diasUteis: 3 }])
  })

  it('com filhos em idade escolar, julho ainda conta no 1º semestre', () => {
    const dias = uteis('2026-07-06', 10)
    const pessoa = montar(dias, { filhosIdadeEscolar: true })
    const resumo = resumoSemestres(pessoa, { ano: 2026, feriados: FERIADOS })
    expect(resumo.corte).toBe('2026-07-31')
    expect(resumo.prazoEstendido).toBe(true)
    expect(resumo.s1.total).toBe(10)
    expect(resumo.s2.total).toBe(0)
  })

  it('o dia extra da 7ª vaga conta no semestre em que caiu', () => {
    const resumo = resumoSemestres(montar(['2026-03-24', '2026-10-19']), {
      ano: 2026,
      feriados: FERIADOS,
      penalidades: [{ data: '2026-10-19', diasExtras: 2 }],
    })
    expect(resumo.s1.total).toBe(1)
    expect(resumo.s2.contados).toBe(1)
    expect(resumo.s2.penalidade).toBe(2)
    expect(resumo.s2.total).toBe(3)
  })
})

describe('semana corrida do 1º ano (cota 5)', () => {
  const primeiroAno = (dias) => montar(dias, { anoEntrada: 2026 })

  it('uma semana inteira de segunda a sexta cumpre a regra', () => {
    const pessoa = primeiroAno(uteis('2026-03-09', 5))
    expect(pessoa.cota).toBe(5)
    expect(semanaCorridaPrimeiroAno(pessoa)).toMatchObject({ cumprida: true, semanas: 1 })
  })

  it('dias avulsos na mesma semana não cumprem', () => {
    expect(semanaCorridaPrimeiroAno(primeiroAno(['2026-03-09', '2026-03-11', '2026-03-13']))).toMatchObject({
      cumprida: false,
      motivo: 'fracionada',
    })
  })

  it('cinco dias espalhados em semanas diferentes não cumprem', () => {
    expect(
      semanaCorridaPrimeiroAno(primeiroAno(['2026-03-09', '2026-03-10', '2026-03-16', '2026-03-17', '2026-03-18']))
    ).toMatchObject({ cumprida: false, motivo: 'varias_semanas' })
  })

  it('semana com feriado no meio continua sendo semana cheia', () => {
    // 20/04 a 24/04 com 21/04 (Tiradentes) marcado: 4 dias contam, semana inteira
    const pessoa = primeiroAno(uteis('2026-04-20', 5))
    expect(semanaCorridaPrimeiroAno(pessoa)).toMatchObject({ cumprida: true })
    expect(pessoa.diasContados).toBe(4)
  })

  it('a semana pode ficar inteira no 2º semestre sem violar teto', () => {
    const resumo = resumoSemestres(primeiroAno(uteis('2026-09-14', 5)), { ano: 2026, feriados: FERIADOS })
    expect(resumo.semestreLivre).toBe(true)
    expect(resumo.s2.total).toBe(5)
    expect(resumo.s2.ok).toBe(true)
    expect(resumo.s2.excede).toBe(0)
  })
})

describe('vagasRestantesSegundoSemestre', () => {
  it('conta o que ainda cabe no teto do 2º semestre', () => {
    expect(vagasRestantesSegundoSemestre({ cota: 30, diasNoSegundo: 12 })).toBe(3)
    expect(vagasRestantesSegundoSemestre({ cota: 30, diasNoSegundo: 15 })).toBe(0)
    expect(vagasRestantesSegundoSemestre({ cota: 30, diasNoSegundo: 19 })).toBe(0)
  })

  it('1º ano não tem teto de semestre', () => {
    expect(vagasRestantesSegundoSemestre({ cota: 5, diasNoSegundo: 5 })).toBe(Infinity)
  })
})

describe('linhaAnaliseSemestre — linha do export do grupo', () => {
  it('quebra o 2º semestre em usufruído × agendado e fecha com os contados', () => {
    const pessoa = montar(CAPTURA)
    const a = linhaAnaliseSemestre(pessoa, { ano: 2026, feriados: FERIADOS, hojeISO: '2026-08-20' })
    expect(a.s1Total).toBe(7)
    expect(a.s2Total).toBe(19)
    // 07/07 + 09–17/07 + 14/08 já passaram; 19–30/10 continua agendado
    expect(a.s2Usufruido).toBe(9)
    expect(a.s2Agendado).toBe(10)
    expect(a.s2Usufruido + a.s2Agendado).toBe(a.s2Total)
    // ASCII puro: o jsPDF engole o − tipográfico (viraria "1o sem. 8")
    expect(a.situacao).toBe('faltam 8 no 1º · 4 a mais no 2º')
    // O − tipográfico some no PDF (WinAnsi) — nunca usar aqui
    expect(a.situacao).not.toMatch(/\u2212/)
  })

  it('quem cumpre os dois lados sai como OK', () => {
    // Datas sem feriado dos dois lados (07/09 é Independência e não contaria)
    const dias = [...uteis('2026-01-05', 15), ...uteis('2026-09-14', 15)]
    const a = linhaAnaliseSemestre(montar(dias), { ano: 2026, feriados: FERIADOS, hojeISO: '2026-08-20' })
    expect(a.situacao).toBe('Dentro da regra')
    expect(a.s1Total).toBe(15)
    expect(a.s2Total).toBe(15)
  })

  it('a penalidade da 7ª vaga vem separada por semestre — a linha tem de fechar', () => {
    const pessoa = montar(['2026-03-24', '2026-10-19'])
    pessoa.penalidades = [{ data: '2026-10-19', diasExtras: 2 }]
    const a = linhaAnaliseSemestre(pessoa, { ano: 2026, feriados: FERIADOS, hojeISO: '2026-08-20' })
    expect(a.s1Penalidade).toBe(0)
    expect(a.s2Penalidade).toBe(2)
    expect(a.s2Usufruido + a.s2Agendado + a.s2Penalidade).toBe(a.s2Total)
  })

  it('1º ano não mostra piso/teto e reporta a semana corrida', () => {
    const a = linhaAnaliseSemestre(montar(uteis('2026-09-14', 5), { anoEntrada: 2026 }), {
      ano: 2026, feriados: FERIADOS, hojeISO: '2026-08-20',
    })
    expect(a.semestreLivre).toBe(true)
    expect(a.situacao).toBe('Semana corrida')
    expect(a.primeiroAnoDetalhe).toBe('Uma semana corrida, de segunda a sexta')
    expect(a.s2Agendado).toBe(5)
  })
})

describe('detalhe do 1º ano no export', () => {
  const linhaDe = (dias) =>
    linhaAnaliseSemestre(montar(dias, { anoEntrada: 2026 }), {
      ano: 2026, feriados: FERIADOS, hojeISO: '2026-08-20',
    })

  it('diz em quantas semanas os dias ficaram repartidos', () => {
    const a = linhaDe(['2026-03-09', '2026-03-10', '2026-03-16', '2026-03-17', '2026-03-18'])
    expect(a.primeiroAnoDetalhe).toBe('5 dias repartidos em 2 semanas diferentes')
  })

  it('diz quando é uma semana só, mas incompleta', () => {
    expect(linhaDe(['2026-03-09', '2026-03-11', '2026-03-13']).primeiroAnoDetalhe)
      .toBe('3 dias avulsos numa semana só — falta fechar a semana')
  })

  it('quem não é do 1º ano não tem detalhe', () => {
    expect(linhaAnaliseSemestre(montar(CAPTURA), { ano: 2026, feriados: FERIADOS, hojeISO: '2026-08-20' }).primeiroAnoDetalhe).toBeNull()
  })
})
