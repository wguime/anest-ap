/**
 * Motor de regras do Extrato de Férias — fixtures calcadas nos casos REAIS
 * de 2026 (03/08): Adriano 36>35, João Ricardo 36>30, Nathalia 6>5,
 * 17–18/12 com 7 pessoas, semana de Tiradentes com 20+22/04.
 */
import { describe, it, expect } from 'vitest'
import { construirExtrato, ehFimDeSemana } from '../../lib/extratoFerias'
import { getFeriados } from '../../lib/feriasFeriados'
import {
  regraMaxPorDia,
  regraSegundasSextasIsoladas,
  regraCotaEstourada,
  regraSemestre,
  regraSemanasInteiras,
  regraMesesNobres,
  regraPrimeiroAno,
  regraFeriadoSegSex,
  regraSemanaComFeriado,
  REGRAS_TRAVA,
  avaliarRegras,
  fingerprintViolacoes,
  MAX_VAGAS_DIA,
} from '../../lib/extratoFeriasRegras'

const FERIADOS = getFeriados(2026)

const reg = (nome, data, criadoEm = null) => ({
  codigo: `${nome}-${data}`,
  nome,
  data,
  ehFimDeSemana: ehFimDeSemana(data),
  criadoEm,
})

const socio = (nome, anoEntrada, filhosIdadeEscolar = null) => ({ nome, anoEntrada, filhosIdadeEscolar })

const montar = (socios, diasPorNome, ano = 2026, criadoEmPorNome = {}) => {
  const registros = Object.entries(diasPorNome).flatMap(([nome, dias]) =>
    dias.map((d) => reg(nome, d, criadoEmPorNome[nome] ?? null))
  )
  return construirExtrato({ registros, ano, socios, feriados: FERIADOS })
}

// Dias úteis sequenciais a partir de uma segunda-feira (pula FDS)
const semana = (segundaISO, n = 5) => {
  const out = []
  const d = new Date(`${segundaISO}T12:00:00Z`)
  while (out.length < n) {
    const dow = d.getUTCDay()
    if (dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

describe('regraMaxPorDia (V-09/V-10/V-33)', () => {
  const nomes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => `PESSOA ${n}`)
  const socios = nomes.map((n) => socio(n, 2010))
  const todosEm = (data) => montar(socios, Object.fromEntries(nomes.map((n) => [n, [data]])))

  it('7 no mesmo dia vira 1 candidato; 6 não alerta', () => {
    const violacoes = regraMaxPorDia(todosEm('2026-09-17'))
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0]).toMatchObject({ id: 'max-dia:2026-09-17', regra: 'MAX_POR_DIA', pessoa: null, severidade: 'warning' })
    expect(violacoes[0].detalhe).toContain('1 candidato')
    expect(violacoes[0].detalhe).toContain('V-10')

    const noLimite = montar(
      socios.slice(0, MAX_VAGAS_DIA),
      Object.fromEntries(nomes.slice(0, MAX_VAGAS_DIA).map((n) => [n, ['2026-09-17']]))
    )
    expect(regraMaxPorDia(noLimite)).toHaveLength(0)
  })

  it('peri-recesso não é mais proibido: na 2ª quinzena de dezembro o comitê decide sem perda (V-33)', () => {
    const v = regraMaxPorDia(todosEm('2026-12-17'))[0]
    expect(v.severidade).toBe('warning')
    expect(v.detalhe).toContain('V-33')
  })

  it('01 a 15/12 segue a regra comum (V-09)', () => {
    expect(regraMaxPorDia(todosEm('2026-12-15'))[0].detalhe).toContain('V-10')
  })

  it('semana escolar de julho: preferência a quem tem filho, sem perda (V-13)', () => {
    expect(regraMaxPorDia(todosEm('2026-07-22'))[0].detalhe).toContain('V-13')
  })
})

describe('regraSegundasSextasIsoladas', () => {
  it('3ª segunda isolada no semestre dispara; 2 não', () => {
    const socios = [socio('FULANO TESTE', 2010)]
    const tres = montar(socios, { 'FULANO TESTE': ['2026-03-02', '2026-03-09', '2026-03-16'] })
    const violacoes = regraSegundasSextasIsoladas(tres, { feriados: FERIADOS })
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0].id).toBe('seg-sex:fulano-teste:2026-S1:seg')

    const duas = montar(socios, { 'FULANO TESTE': ['2026-03-02', '2026-03-09'] })
    expect(regraSegundasSextasIsoladas(duas, { feriados: FERIADOS })).toHaveLength(0)
  })

  it('dia SEQUENCIAL não é picado: semana cheia + a segunda seguinte (dono 05/08)', () => {
    // 03–07/08 (seg a sex) + 10/08 (segunda). O fim de semana não quebra o
    // bloco: é UM período de 6 dias úteis, então 10/08 não é "segunda isolada".
    const socios = [socio('FULANO TESTE', 2010)]
    const extrato = montar(socios, {
      'FULANO TESTE': [...semana('2026-08-03'), '2026-08-10'],
    })
    const pessoa = extrato.porPessoa[0]
    expect(pessoa.periodos).toHaveLength(1)
    expect(pessoa.periodos[0]).toMatchObject({ inicio: '2026-08-03', fim: '2026-08-10', diasUteis: 6 })
    expect(regraSegundasSextasIsoladas(extrato)).toHaveLength(0)

    // e a sexta que emenda com a segunda seguinte também não é isolada
    const emenda = montar(socios, { 'FULANO TESTE': ['2026-08-07', '2026-08-10'] })
    expect(regraSegundasSextasIsoladas(emenda)).toHaveLength(0)

    // controle: as MESMAS 3 segundas, agora realmente soltas, seguem violando
    const soltas = montar(socios, { 'FULANO TESTE': ['2026-08-03', '2026-08-17', '2026-08-24'] })
    expect(regraSegundasSextasIsoladas(soltas)).toHaveLength(1)
  })

  it('segunda com terça marcada não é isolada; contagem zera entre semestres', () => {
    const socios = [socio('FULANO TESTE', 2010)]
    const extrato = montar(socios, {
      'FULANO TESTE': [
        '2026-03-02', '2026-03-03', // seg+ter → não isolada
        '2026-08-03', '2026-08-10', // 2 segundas isoladas no S2 → ok
      ],
    })
    expect(regraSegundasSextasIsoladas(extrato, { feriados: FERIADOS })).toHaveLength(0)
  })

  it('semana de Tiradentes: 20/04 com 22/04 marcado NÃO isola (vizinho útil pula o feriado)', () => {
    const socios = [socio('LEANDRO BERNARDES', 2020)]
    const extrato = montar(socios, {
      'LEANDRO BERNARDES': ['2026-04-20', '2026-04-22'],
    })
    expect(regraSegundasSextasIsoladas(extrato, { feriados: FERIADOS })).toHaveLength(0)
  })

  it('3 sextas isoladas disparam com id próprio de sexta', () => {
    const socios = [socio('FULANO TESTE', 2010)]
    const extrato = montar(socios, {
      'FULANO TESTE': ['2026-03-06', '2026-03-13', '2026-03-20'],
    })
    const violacoes = regraSegundasSextasIsoladas(extrato, { feriados: FERIADOS })
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0].id).toBe('seg-sex:fulano-teste:2026-S1:sex')
  })
})

describe('regraCotaEstourada — casos reais', () => {
  it('Nathalia (1º ano, cota 5) com 6 dias e João Ricardo (cota 30) com 31 estouram', () => {
    const socios = [
      socio('NATHALIA FORNARI FERNANDES', 2026),
      socio('JOÃO RICARDO MOREIRA', 2022),
      socio('LEANDRO BERNARDES', 2020),
    ]
    const extrato = montar(socios, {
      'NATHALIA FORNARI FERNANDES': ['2026-03-13', ...semana('2026-08-17')],
      'JOÃO RICARDO MOREIRA': [
        ...semana('2026-02-02'), ...semana('2026-02-09'), ...semana('2026-03-02'),
        ...semana('2026-05-04'), ...semana('2026-08-31'), ...semana('2026-10-05'),
        '2026-11-23',
      ],
      'LEANDRO BERNARDES': semana('2026-09-14'),
    })
    const violacoes = regraCotaEstourada(extrato)
    expect(violacoes.map((v) => v.pessoa).sort()).toEqual([
      'JOÃO RICARDO MOREIRA',
      'NATHALIA FORNARI FERNANDES',
    ])
    expect(violacoes.every((v) => v.severidade === 'critical')).toBe(true)
    expect(violacoes.find((v) => v.pessoa === 'NATHALIA FORNARI FERNANDES').id).toBe(
      'cota:nathalia-fornari-fernandes:2026'
    )
  })

  it('a penalidade da 7ª vaga estoura a cota mesmo com os dias marcados dentro dela', () => {
    // Dono 04/08: o custo extra é debitado e conta como dia de férias. 29
    // marcados numa cota de 30 não alertava; com +3 da 7ª vaga, alerta.
    const extrato = {
      ano: 2026,
      porPessoa: [{
        nome: 'FULANO DE TAL', nomeCompleto: 'Fulano de Tal',
        cota: 30, regraCota: '4º ano+', diasContados: 29,
        diasPenalidade: 3, diasEfetivos: 32,
      }],
    }
    const violacoes = regraCotaEstourada(extrato)
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0].severidade).toBe('critical')
    expect(violacoes[0].detalhe).toContain('32 dias')
    expect(violacoes[0].detalhe).toContain('29 marcados + 3 de penalidade')
  })

  it('sem penalidade aplicada, cai no comportamento antigo (dias marcados)', () => {
    const dentro = { ano: 2026, porPessoa: [{ nome: 'X', nomeCompleto: 'X', cota: 30, regraCota: '4º ano+', diasContados: 29 }] }
    expect(regraCotaEstourada(dentro)).toHaveLength(0)
    const fora = { ano: 2026, porPessoa: [{ nome: 'X', nomeCompleto: 'X', cota: 30, regraCota: '4º ano+', diasContados: 31 }] }
    expect(regraCotaEstourada(fora)).toHaveLength(1)
    expect(regraCotaEstourada(fora)[0].detalhe).toContain('31 dias marcados')
  })
})

describe('regraSemestre (V-02)', () => {
  it('cota 30: 16 dias no 1º semestre passa do teto de 15; 15 não', () => {
    const socios = [socio('TETO S1', 2010)]
    const dias16 = [...semana('2026-03-02'), ...semana('2026-03-09'), ...semana('2026-03-16'), '2026-03-24']
    const v = regraSemestre(montar(socios, { 'TETO S1': dias16 }))
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ id: 'semestre:teto-s1:2026-S1', regra: 'SEMESTRE_EXCEDIDO' })
    expect(regraSemestre(montar(socios, { 'TETO S1': dias16.slice(0, 15) }))).toHaveLength(0)
  })

  it('cota ímpar aceita a metade para cima em qualquer semestre (31 → 16)', () => {
    const socios = [{ ...socio('IMPAR', 2010), cota: 31 }]
    const dias16 = [...semana('2026-08-03'), ...semana('2026-08-10'), ...semana('2026-08-17'), '2026-08-25']
    expect(regraSemestre(montar(socios, { IMPAR: dias16 }))).toHaveLength(0)
  })

  it('1º ano não tem teto por semestre', () => {
    expect(regraSemestre(montar([socio('NOVATO', 2026)], { NOVATO: semana('2026-08-03') }))).toHaveLength(0)
  })
})

describe('regraSemanasInteiras (V-06)', () => {
  const socios = [socio('FRACIONADO TESTE', 2010)]
  // sem semana de feriado (17/02 é Carnaval: dia solto naquela semana pagaria o feriado)
  const avulsos = ['2026-02-03', '2026-02-11', '2026-02-26', '2026-03-03', '2026-03-11', '2026-03-19']

  it('cota 30 (15 no semestre): 5 avulsos cabem, 6 não', () => {
    expect(regraSemanasInteiras(montar(socios, { 'FRACIONADO TESTE': avulsos.slice(0, 5) }))).toHaveLength(0)
    const v = regraSemanasInteiras(montar(socios, { 'FRACIONADO TESTE': avulsos }))
    expect(v).toHaveLength(1)
    expect(v[0].id).toBe('semanas:fracionado-teste:2026-S1')
  })

  it('o mínimo é em SEMANAS: semana normal + semana com feriado liberam 6 avulsos (exemplo da V-06)', () => {
    // 20–24/04 tem Tiradentes (21/04): semana cheia com 4 dias
    const dias = [...semana('2026-03-02'), '2026-04-20', '2026-04-22', '2026-04-23', '2026-04-24', ...avulsos]
    expect(regraSemanasInteiras(montar(socios, { 'FRACIONADO TESTE': dias }))).toHaveLength(0)
  })

  it('conta por semestre: avulsos do 2º não somam aos do 1º', () => {
    const dias = [...avulsos.slice(0, 5), '2026-08-04', '2026-08-12', '2026-08-19', '2026-09-02', '2026-09-16']
    expect(regraSemanasInteiras(montar(socios, { 'FRACIONADO TESTE': dias }))).toHaveLength(0)
  })

  it('cota 5 (1º ano) fica com a regra própria', () => {
    expect(regraSemanasInteiras(montar([socio('NOVATO', 2026)], { NOVATO: avulsos }))).toHaveLength(0)
  })
})

describe('regraPrimeiroAno (V-06)', () => {
  it('semana com feriado e dias em 2 semanas alertam; semana futura incompleta não', () => {
    const socios = [socio('COM FERIADO', 2026), socio('PARTIDO', 2026), socio('MONTANDO', 2026), socio('CERTO', 2026)]
    const extrato = montar(socios, {
      'COM FERIADO': ['2026-04-20', '2026-04-22', '2026-04-23', '2026-04-24'],
      PARTIDO: ['2026-03-09', '2026-03-16'],
      MONTANDO: ['2026-12-07', '2026-12-08'],
      CERTO: semana('2026-03-09'),
    })
    const v = regraPrimeiroAno(extrato, { feriados: FERIADOS, hojeISO: '2026-11-18' })
    expect(v.map((x) => x.pessoa).sort()).toEqual(['COM FERIADO', 'PARTIDO'])
  })
})

describe('regraFeriadoSegSex (V-08)', () => {
  it('sexta sozinha com feriado na quinta é proibida; quarta isolada segue a regra comum', () => {
    // 04/06/2026 (quinta) é Corpus Christi
    const socios = [socio('SEXTA', 2010), socio('QUARTA', 2010)]
    const extrato = montar(socios, { SEXTA: ['2026-06-05'], QUARTA: ['2026-06-03'] })
    const v = regraFeriadoSegSex(extrato)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ pessoa: 'SEXTA', id: 'feriado-isolado:sexta:2026-06-05' })
  })
})

describe('regraSemanaComFeriado (V-15/V-16)', () => {
  const socios = [socio('FERIADOES', 2010)]
  // 20–24/04 (Tiradentes) e 01–05/06 (Corpus Christi, 04/06): duas semanas com feriado no 1º semestre
  const duas = ['2026-04-20', '2026-04-22', '2026-04-23', '2026-04-24', '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-05']

  it('a 2ª semana com feriado do semestre marcada cedo alerta', () => {
    const v = regraSemanaComFeriado(montar(socios, { FERIADOES: duas }, 2026, { FERIADOES: '2026-01-10T10:00:00Z' }))
    expect(v).toHaveLength(1)
    expect(v[0].regra).toBe('SEMANA_FERIADO_EXTRA')
  })

  it('extra marcada a partir de 30 dias antes do feriado é permitida', () => {
    const extrato = construirExtrato({
      registros: [
        ...duas.slice(0, 4).map((d) => reg('FERIADOES', d, '2026-01-10T10:00:00Z')),
        ...duas.slice(4).map((d) => reg('FERIADOES', d, '2026-05-20T10:00:00Z')),
      ],
      ano: 2026, socios, feriados: FERIADOS,
    })
    expect(regraSemanaComFeriado(extrato)).toHaveLength(0)
  })

  it('dias soltos em semana com feriado não gastam a "1 por semestre"', () => {
    const dias = ['2026-04-22', ...duas.slice(4)]
    expect(regraSemanaComFeriado(montar(socios, { FERIADOES: dias }, 2026, { FERIADOES: '2026-01-10T10:00:00Z' }))).toHaveLength(0)
  })
})

describe('regraMesesNobres (V-12/V-13)', () => {
  it('dia solto na 1ª quinzena de janeiro sem data de marcação dispara; semana cheia não', () => {
    const socios = [socio('AVULSO JAN', 2010), socio('SEMANA JAN', 2010)]
    const extrato = montar(socios, {
      'AVULSO JAN': ['2026-01-07'],
      'SEMANA JAN': semana('2026-01-05'),
    })
    const violacoes = regraMesesNobres(extrato)
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0]).toMatchObject({ pessoa: 'AVULSO JAN', referencia: 'jan1q' })
  })

  it('dia isolado marcado a partir de 2 meses antes, com vaga, é permitido; antes disso não', () => {
    const socios = [socio('DEZ', 2010)]
    const tarde = montar(socios, { DEZ: ['2026-12-21'] }, 2026, { DEZ: '2026-11-18T10:00:00Z' })
    expect(regraMesesNobres(tarde, { hojeISO: '2026-11-18' })).toHaveLength(0)
    const cedo = montar(socios, { DEZ: ['2026-12-21'] }, 2026, { DEZ: '2026-08-01T10:00:00Z' })
    expect(regraMesesNobres(cedo, { hojeISO: '2026-11-18' })).toHaveLength(1)
  })

  it('julho só é nobre nas semanas escolares, e sem limite de semanas por sócio', () => {
    const socios = [socio('JOÃO RICARDO MOREIRA', 2022), socio('JULHO COMUM', 2010)]
    const extrato = montar(socios, {
      'JOÃO RICARDO MOREIRA': [...semana('2026-07-20'), ...semana('2026-07-27')],
      'JULHO COMUM': ['2026-07-08'],
    })
    expect(regraMesesNobres(extrato)).toHaveLength(0)
  })

  it('semana 29/06–03/07 cruza o mês: sem alerta', () => {
    const socios = [socio('VIRADA DE MES', 2010)]
    const extrato = montar(socios, { 'VIRADA DE MES': semana('2026-06-29') })
    expect(regraMesesNobres(extrato)).toHaveLength(0)
  })
})

describe('avaliarRegras — alertas julgam o ano inteiro (dono 18/11/2026)', () => {
  it('1º semestre já encerrado também é julgado; `desde` explícito volta a filtrar', () => {
    const socios = [socio('TETO S1', 2010)]
    const dias16 = [...semana('2026-03-02'), ...semana('2026-03-09'), ...semana('2026-03-16'), '2026-03-24']
    const extrato = montar(socios, { 'TETO S1': dias16 })
    expect(regraSemestre(extrato)).toHaveLength(1) // a regra em si acusa
    expect(avaliarRegras(extrato, { feriados: FERIADOS }).some((v) => v.regra === 'SEMESTRE_EXCEDIDO')).toBe(true)
    expect(avaliarRegras(extrato, { feriados: FERIADOS, desde: '2026-11-18' }).some((v) => v.regra === 'SEMESTRE_EXCEDIDO')).toBe(false)
  })
})

describe('REGRAS_TRAVA', () => {
  it('dia lotado não trava (vira candidato); as demais regras de marcação travam', () => {
    expect(REGRAS_TRAVA.has('MAX_POR_DIA')).toBe(false)
    for (const r of ['COTA_ESTOURADA', 'SEMESTRE_EXCEDIDO', 'SEMANAS_INTEIRAS', 'SEG_SEX_ISOLADA', 'MES_NOBRE']) {
      expect(REGRAS_TRAVA.has(r)).toBe(true)
    }
  })
})

describe('avaliarRegras + fingerprint', () => {
  it('ordena critical antes de warning e o fingerprint é invariante à ordem', () => {
    const nomes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => `PESSOA ${n}`)
    const socios = [...nomes.map((n) => socio(n, 2010)), socio('NOVATO ESTOURADO', 2026)]
    const extrato = montar(socios, {
      ...Object.fromEntries(nomes.map((n) => [n, ['2026-12-17']])),
      'NOVATO ESTOURADO': ['2026-03-13', ...semana('2026-08-17')],
    })
    const violacoes = avaliarRegras(extrato, { feriados: FERIADOS })
    expect(violacoes.length).toBeGreaterThanOrEqual(2)
    expect(violacoes[0].severidade).toBe('critical') // cota estourada vem antes dos warnings

    const fp = fingerprintViolacoes(violacoes)
    expect(fingerprintViolacoes([...violacoes].reverse())).toBe(fp)
    expect(fingerprintViolacoes([])).not.toBe(fp)
  })
})
