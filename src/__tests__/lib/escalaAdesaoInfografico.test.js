/**
 * Infográfico "Evolução da adesão" (dono 27/10/2026): a conta do aumento % por semana ("mostre
 * esse dado em aumento de % e não em pontos") e as frases que seguem os dados ao vivo.
 */
import { describe, it, expect } from 'vitest'
import { crescimentoSemanal, montarInfografico, percentualSemana } from '@/lib/escalaAdesaoInfografico'

// as 5 semanas de 21/09 a 25/10/2026 e as 4 anteriores, como saíram do banco em 27/10
const INI = [54.6, 62.2, 65.8, 77.0, 86.3]
const INI_ANTES = [45.8, 40.5, 46.2, 47.1]
const TER = [68.0, 74.3, 73.0, 77.8, 89.48]
const TER_PROPRIO = [21.8, 32.1, 34.3, 37.6, 38.8]
const TOT = [13.4, 23.6, 18.6, 21.1, 29.8]
const ROT = ['21/09', '28/09', '05/10', '12/10', '19/10']
const SEG = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']
const ENG = [8, 16, 18, 17, 22]
const ANEST = [5, 11, 14, 14, 17]
const BASE_ANEST = [41, 41, 44, 39, 44]

const hosp = (ini, ter, casos = 100) => ({ casos, ini, ter, tot: 20 })
function ev(sobre = {}) {
  return {
    serie: SEG.map((de, i) => ({
      de, ate: `2026-${de.slice(5, 7)}-${String(Number(de.slice(8)) + 6).padStart(2, '0')}`, rotulo: ROT[i],
      engajadosTotal: ENG[i], engajadosAnest: ANEST[i], engajadosEnf: [2, 3, 2, 2, 4][i], engajadosRes: [1, 2, 2, 1, 1][i],
      baseAnest: BASE_ANEST[i], baseEnf: 6, baseRes: 8,
      ini: INI[i], ter: TER[i], tot: TOT[i], terProprio: TER_PROPRIO[i], abre: [73.9, 81.8, 84.6, 80.6, 85.0][i],
    })),
    anteriores: ['24/08', '31/08', '07/09', '14/09'].map((rotulo, i) => ({ rotulo, engajadosTotal: [5, 5, 9, 6][i], ini: INI_ANTES[i] })),
    marco: { indice: 4, virada: true },
    hospitais: {
      primeira: { total: hosp(54.6, 68), hro: hosp(63, 72), unimed: hosp(53, 66), materno: hosp(5, 52, 42) },
      ultima: { total: hosp(86.3, 89.5), hro: hosp(87, 91), unimed: hosp(88, 92), materno: hosp(64, 58, 36) },
    },
    quemMarca: { primeira: { pct: { proprio: 28, colega: 12, outros: 60 } }, ultima: { pct: { proprio: 42, colega: 32, outros: 26 } } },
    enf: { primeira: { base: 6, engajados: 2, abriram: 5 }, ultima: { base: 6, engajados: 4, abriram: 5 } },
    res: { primeira: { base: 8, engajados: 1, abriram: 5 }, ultima: { base: 8, engajados: 1, abriram: 5 } },
    ...sobre,
  }
}

describe('aumento % por semana', () => {
  it('início marcado: +7,8 pontos/semana sobre a reta que começa em ~54% = +15% por semana', () => {
    expect(crescimentoSemanal(INI)).toBeCloseTo(14.6, 1)
    expect(percentualSemana(crescimentoSemanal(INI))).toBe('+15%')
  })

  it('antes do relatório: +2% por semana', () => {
    expect(crescimentoSemanal(INI_ANTES)).toBeCloseTo(2.2, 1)
    expect(percentualSemana(crescimentoSemanal(INI_ANTES))).toBe('+2%')
  })

  it('formato: casa decimal só abaixo de 1%, sinal de menos tipográfico, travessão sem dado', () => {
    expect(percentualSemana(0.44)).toBe('+0,4%')
    expect(percentualSemana(-3.2)).toBe('−3%')
    expect(percentualSemana(0.01)).toBe('0%')
    expect(percentualSemana(null)).toBe('—')
  })

  it('sem base para a porcentagem (reta começa em 0 ou menos, ou 1 ponto só) → null', () => {
    expect(crescimentoSemanal([0, 0, 0])).toBeNull()
    expect(crescimentoSemanal([10])).toBeNull()
    expect(crescimentoSemanal([null, 40, null, 60])).not.toBeNull()
  })
})

describe('montarInfografico', () => {
  it('os 8 blocos com os números de 27/10', () => {
    const vm = montarInfografico(ev())
    expect(vm.periodo).toBe('21/09 a 25/10')
    expect(vm.engajados).toMatchObject({ agora: 22, antes: 8, faixaAnterior: [5, 9], quando: 'antes do relatório' })
    expect(vm.engajados.colunas).toHaveLength(9)
    expect(vm.engajados.colunas.filter((c) => c.anterior)).toHaveLength(4)
    expect(vm.inclinacao.valor).toBeCloseTo(14.6, 1)
    expect(vm.inclinacao.antes).toBeCloseTo(2.2, 1)
    expect(vm.inclinacao).toMatchObject({ primeiro: 55, ultimo: 86, marco: { rotulo: '23/09 · relatório no app' } })
    expect(vm.agora.map((a) => a.valor)).toEqual(['86%', '89%', '85%'])
    expect(vm.quemMarca).toMatchObject({ agora: 74, antes: 40 })
    expect(vm.cargos.map((c) => [c.agora, c.antes, c.base, c.melhorou])).toEqual([[17, 5, 44, true], [4, 2, 6, true], [1, 1, 8, false]])
    expect(vm.hospitais.map((h) => [h.nome, h.ter, h.abaixo])).toEqual([['HRO', 91, false], ['Unimed', 92, false], ['Materno', 58, true]])
  })

  it('evolução: a manchete segue o maior aumento % (hoje o tempo total, que saiu de uma base baixa)', () => {
    const vm = montarInfografico(ev())
    expect(vm.evolucao.linhas.map((l) => Math.round(l.crescimento))).toEqual([15, 7, 16, 20])
    expect(vm.evolucao.manchete).toBe('Todos sobem — o tempo total do turno, mais rápido')
  })

  it('o que falta: só o que está abaixo da meta, com o detalhe de cada um', () => {
    const vm = montarInfografico(ev())
    expect(vm.falta.map((f) => [f.valor, f.rotulo, f.detalhe])).toEqual([
      ['30%', 'turnos com tempo total', 'meta 80% · falta em 7 de cada 10'],
      ['39%', 'término pelo próprio anestesiologista', 'na sala chega a 89%'],
      ['58%', 'término no Materno', 'HRO e Unimed em 91–92%'],
      ['1/8', 'residentes engajados', '3 não abriram a escala na última semana'],
    ])
  })

  it('depois que a janela anda, "antes do relatório" vira "nas N semanas anteriores" e o marco some', () => {
    const vm = montarInfografico(ev({ marco: { indice: 2, virada: false } }))
    expect(vm.engajados.quando).toBe('nas 4 semanas anteriores')
    expect(vm.inclinacao.marco).toBeNull()
  })

  it('tudo na meta → "o que falta" vazio; sem semanas → null', () => {
    const cheio = ev()
    cheio.serie = cheio.serie.map((x) => ({ ...x, tot: 90, terProprio: 85, ter: 95 }))
    cheio.hospitais.ultima.materno = hosp(90, 90)
    cheio.res.ultima = { base: 8, engajados: 6, abriram: 8 }
    expect(montarInfografico(cheio).falta).toEqual([])
    expect(montarInfografico(null)).toBeNull()
    expect(montarInfografico({ serie: [] })).toBeNull()
  })
})
