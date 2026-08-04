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
  regraMetadeMeioAno,
  regraSemanasInteiras,
  regraMesesNobres,
  avaliarRegras,
  fingerprintViolacoes,
  MAX_VAGAS_DIA,
} from '../../lib/extratoFeriasRegras'

const FERIADOS = getFeriados(2026)

const reg = (nome, data) => ({
  codigo: `${nome}-${data}`,
  nome,
  data,
  ehFimDeSemana: ehFimDeSemana(data),
})

const socio = (nome, anoEntrada, filhosIdadeEscolar = null) => ({ nome, anoEntrada, filhosIdadeEscolar })

const montar = (socios, diasPorNome, ano = 2026) => {
  const registros = Object.entries(diasPorNome).flatMap(([nome, dias]) => dias.map((d) => reg(nome, d)))
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

describe('regraMaxPorDia', () => {
  it('7 pessoas no mesmo dia viola; 6 não (caso real 17/12)', () => {
    const nomes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => `PESSOA ${n}`)
    const socios = nomes.map((n) => socio(n, 2010))
    const cheio = montar(socios, Object.fromEntries(nomes.map((n) => [n, ['2026-12-17']])))
    const violacoes = regraMaxPorDia(cheio)
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0]).toMatchObject({
      id: 'max-dia:2026-12-17',
      regra: 'MAX_POR_DIA',
      pessoa: null,
      severidade: 'warning',
    })

    const noLimite = montar(
      socios.slice(0, MAX_VAGAS_DIA),
      Object.fromEntries(nomes.slice(0, MAX_VAGAS_DIA).map((n) => [n, ['2026-12-17']]))
    )
    expect(regraMaxPorDia(noLimite)).toHaveLength(0)
  })

  it('peri-recesso configurado vira critical', () => {
    const nomes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => `PESSOA ${n}`)
    const socios = nomes.map((n) => socio(n, 2010))
    const extrato = montar(socios, Object.fromEntries(nomes.map((n) => [n, ['2026-12-17']])))
    const config = { recesso: { inicio: '2026-12-21', fim: '2027-01-02' } }
    expect(regraMaxPorDia(extrato, config)[0].severidade).toBe('critical')
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
})

describe('regraMetadeMeioAno', () => {
  it('filhos=false: tudo no 2º semestre viola; filhos=null pula', () => {
    const socios = [
      socio('SEM FILHOS', 2010, false),
      socio('NAO INFORMADO', 2010, null),
    ]
    const extrato = montar(socios, {
      'SEM FILHOS': semana('2026-08-03'),
      'NAO INFORMADO': semana('2026-08-10'),
    })
    const violacoes = regraMetadeMeioAno(extrato)
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0].pessoa).toBe('SEM FILHOS')
  })

  it('filhos=true usa corte 31/07 (dias de julho contam para a metade)', () => {
    const socios = [socio('COM FILHOS', 2010, true)]
    const extrato = montar(socios, {
      'COM FILHOS': [...semana('2026-07-13'), ...semana('2026-08-10')],
    })
    expect(regraMetadeMeioAno(extrato)).toHaveLength(0)
  })
})

describe('regraSemanasInteiras', () => {
  it('cota 30: 11 dias fracionados viola, 10 não', () => {
    const socios = [socio('FRACIONADO TESTE', 2010)]
    const onzeAvulsos = [
      '2026-02-03', '2026-02-11', '2026-02-19', '2026-03-03', '2026-03-11',
      '2026-03-19', '2026-04-08', '2026-04-14', '2026-05-06', '2026-05-13', '2026-05-20',
    ]
    const viola = montar(socios, { 'FRACIONADO TESTE': onzeAvulsos })
    expect(regraSemanasInteiras(viola)).toHaveLength(1)

    const ok = montar(socios, { 'FRACIONADO TESTE': onzeAvulsos.slice(0, 10) })
    expect(regraSemanasInteiras(ok)).toHaveLength(0)
  })

  it('semana inteira não conta como fracionado; cota 5 (1º ano) nunca dispara', () => {
    const socios = [socio('VETERANO', 2010), socio('NOVATO', 2026)]
    const extrato = montar(socios, {
      VETERANO: [...semana('2026-03-02'), '2026-04-08'],
      NOVATO: ['2026-02-03', '2026-02-11', '2026-02-19', '2026-03-03', '2026-03-11', '2026-03-19'],
    })
    expect(regraSemanasInteiras(extrato)).toHaveLength(0)
  })
})

describe('regraMesesNobres', () => {
  it('dia solto na 1ª quinzena de janeiro dispara; semana cheia não', () => {
    const socios = [socio('AVULSO JAN', 2010), socio('SEMANA JAN', 2010)]
    const extrato = montar(socios, {
      'AVULSO JAN': ['2026-01-07'],
      'SEMANA JAN': semana('2026-01-05'),
    })
    const violacoes = regraMesesNobres(extrato)
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0]).toMatchObject({ pessoa: 'AVULSO JAN', referencia: 'jan1q' })
  })

  it('2 semanas inteiras em julho geram o alerta de excesso (caso real João Ricardo)', () => {
    const socios = [socio('JOÃO RICARDO MOREIRA', 2022)]
    const extrato = montar(socios, {
      'JOÃO RICARDO MOREIRA': [...semana('2026-07-06'), ...semana('2026-07-13')],
    })
    const violacoes = regraMesesNobres(extrato)
    expect(violacoes.map((v) => v.id)).toContain('nobre:joao-ricardo-moreira:2026-jul-excesso')
  })

  it('semana 29/06–03/07 cruza o mês: os dias de julho pertencem a semana cheia → sem alerta', () => {
    const socios = [socio('VIRADA DE MES', 2010)]
    const extrato = montar(socios, { 'VIRADA DE MES': semana('2026-06-29') })
    expect(regraMesesNobres(extrato)).toHaveLength(0)
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
