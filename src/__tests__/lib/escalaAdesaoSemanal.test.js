import { describe, it, expect } from 'vitest'
import {
  ultimasSemanasCompletas, janelasComparacao, rotuloSemana, somarDias, resumoSemana, indiceAnest,
  porcentagensInteiras, inclinacao, compararJanelas, montarEvolucao,
} from '@/lib/escalaAdesaoSemanal'

// ─── Fixtures ────────────────────────────────────────────────────────────────────────────────

const anest = (over = {}) => ({
  cargo: 'anest', nome: 'ANEST A',
  de: 5, dne: 5, dn: 5, dnu: 5, casos: 10, ini_eu: 8, ter_eu: 8, tp_inf: 5, turnos: 5, tot_eu: 4,
  ini_n: 8, ter_n: 8,
  ...over,
})
const equipe = (cargo, over = {}) => ({
  cargo, nome: `${cargo.toUpperCase()} X`,
  de: 0, dne: 0, dn: 0, dnu: 0, casos: 0, ini_eu: 0, ter_eu: 0, tp_inf: 0, turnos: 0, tot_eu: 0,
  ini_n: 0, ter_n: 0,
  ...over,
})
const hosp = (hospital, casos, com_ini, com_ter, turnos, com_total) => ({
  hospital, casos, com_ini, com_ter, com_tp: 0, turnos, com_total,
})
const semana = (desde, pessoas, hospitais = [], uteis = 5) => ({
  desde, ate: somarDias(desde, 6), uteis, gravado_ate: '2026-10-27', pessoas, hospitais,
})

// Duas semanas REAIS de escala_adesao_periodo (consultadas em 27/10/2026), anonimizadas: só o
// cargo e as contagens, em ordem embaralhada. Os números esperados foram calculados direto no
// banco pelas mesmas definições — a trava de que a lib lê o JSON como o SQL lê as tabelas.
const COLUNAS = ['cargo', 'de', 'dne', 'dn', 'dnu', 'casos', 'ini_eu', 'ter_eu', 'tp_inf', 'turnos', 'tot_eu', 'ini_n', 'ter_n']
const COLUNAS_H = ['hospital', 'casos', 'com_ini', 'com_ter', 'com_tp', 'turnos', 'com_total']
const real = (desde, hospitais, linhas) => ({
  desde, ate: somarDias(desde, 6), uteis: 5,
  hospitais: hospitais.map((h) => Object.fromEntries(COLUNAS_H.map((c, i) => [c, h[i]]))),
  pessoas: linhas.map((l, n) => ({ ...Object.fromEntries(COLUNAS.map((c, i) => [c, l[i]])), nome: `P${n}` })),
})
const Z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const REAL_21_09 = real('2026-09-21', [
  ['total', 606, 331, 412, 12, 299, 40], ['unimed', 281, 150, 185, 7, 137, 16],
  ['materno', 42, 2, 22, 0, 13, 0], ['hro', 283, 179, 205, 5, 149, 24],
], [
  ['anest', 5, 4, 4, 4, 16, 0, 0, 0, 8, 0, 0, 0], ['anest', 5, 4, 4, 4, 18, 3, 1, 0, 7, 1, 3, 1],
  ['anest', 6, 4, 4, 4, 18, 2, 7, 0, 8, 2, 5, 7], ['anest', 5, 5, 5, 5, 13, 8, 5, 0, 6, 1, 17, 22],
  ['anest', 6, 6, 6, 5, 27, 4, 6, 1, 10, 4, 5, 8], ['anest', 3, 3, 4, 4, 9, 0, 6, 0, 4, 0, 1, 8],
  ['anest', ...Z], ['anest', 6, 5, 5, 4, 12, 7, 6, 1, 10, 3, 11, 7],
  ['anest', ...Z], ['anest', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  ['anest', 5, 5, 5, 5, 23, 1, 3, 1, 10, 1, 1, 3], ['anest', 6, 5, 5, 5, 19, 0, 12, 0, 10, 2, 1, 14],
  ['anest', 5, 2, 2, 2, 11, 0, 0, 0, 5, 0, 0, 0], ['anest', 5, 4, 4, 4, 16, 0, 3, 0, 10, 0, 0, 3],
  ['anest', 5, 5, 5, 5, 16, 0, 0, 0, 8, 0, 0, 0], ['anest', ...Z],
  ['anest', 5, 3, 3, 3, 15, 0, 0, 0, 8, 0, 0, 0], ['anest', 2, 1, 2, 2, 7, 0, 0, 1, 2, 0, 0, 0],
  ['anest', 5, 1, 1, 1, 11, 0, 0, 0, 6, 0, 0, 0], ['anest', 3, 3, 3, 3, 7, 3, 3, 0, 4, 1, 5, 3],
  ['anest', 5, 2, 2, 2, 11, 1, 2, 0, 5, 0, 1, 2], ['anest', 5, 4, 4, 4, 7, 0, 0, 0, 7, 0, 0, 0],
  ['anest', 2, 0, 1, 1, 4, 0, 0, 0, 2, 0, 0, 0], ['anest', 4, 4, 4, 4, 14, 0, 0, 1, 8, 1, 0, 0],
  ['anest', 1, 1, 2, 2, 5, 2, 3, 0, 2, 0, 2, 4], ['anest', ...Z],
  ['anest', 5, 4, 4, 4, 13, 0, 0, 0, 6, 0, 0, 0], ['anest', 6, 1, 1, 1, 21, 0, 1, 0, 9, 0, 0, 1],
  ['anest', 6, 2, 2, 2, 13, 0, 0, 2, 7, 2, 0, 0], ['anest', 4, 4, 5, 5, 17, 0, 0, 0, 8, 0, 0, 0],
  ['anest', 5, 4, 4, 4, 18, 2, 5, 2, 9, 2, 2, 5], ['anest', 7, 5, 5, 5, 27, 6, 8, 0, 10, 3, 6, 8],
  ['anest', 5, 5, 5, 5, 13, 0, 0, 0, 9, 0, 0, 0], ['anest', 5, 5, 5, 5, 16, 8, 5, 1, 8, 3, 9, 5],
  ['anest', 6, 6, 6, 5, 16, 0, 1, 1, 8, 2, 0, 1], ['anest', 5, 2, 2, 2, 9, 0, 1, 0, 5, 0, 0, 1],
  ['anest', 4, 3, 3, 3, 17, 3, 4, 0, 7, 0, 4, 6], ['anest', 6, 5, 5, 5, 21, 4, 10, 0, 10, 0, 5, 10],
  ['anest', 5, 5, 7, 5, 14, 9, 13, 1, 9, 2, 18, 34], ['anest', 5, 4, 4, 4, 15, 3, 1, 0, 6, 0, 8, 12],
  ['anest', 5, 5, 6, 5, 17, 0, 0, 0, 9, 1, 0, 0], ['anest', 6, 6, 6, 5, 24, 10, 18, 0, 11, 1, 16, 18],
  ['anest', 5, 5, 6, 5, 7, 3, 2, 0, 4, 2, 6, 3], ['anest', 5, 1, 1, 1, 15, 0, 0, 0, 7, 0, 0, 0],
  ['anest', 5, 3, 4, 3, 24, 4, 6, 0, 10, 0, 9, 12], ['anest', 5, 1, 1, 1, 10, 0, 0, 0, 7, 0, 0, 0],
  ['enf', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 2], ['enf', 0, 0, 5, 3, 0, 0, 0, 0, 0, 0, 47, 44],
  ['enf', 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 105, 63], ['enf', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 3],
  ['enf', 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 72, 90], ['enf', ...Z],
  ['hosp', 0, 0, 7, 5, 0, 0, 0, 0, 0, 0, 18, 23], ['hosp', 0, 0, 5, 3, 0, 0, 0, 0, 0, 0, 9, 11],
  ['res', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0], ['res', ...Z],
  ['res', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], ['res', 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 2, 12],
  ['res', ...Z], ['res', 0, 0, 5, 4, 0, 0, 0, 0, 0, 0, 5, 2],
  ['res', ...Z], ['res', 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 1, 7],
  ['sec', ...Z], ['sec', ...Z], ['sec', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], ['sec', ...Z], ['sec', ...Z],
])
const REAL_19_10 = real('2026-10-19', [
  ['total', 637, 550, 570, 8, 312, 93], ['unimed', 301, 265, 276, 4, 149, 45],
  ['materno', 36, 23, 21, 1, 13, 2], ['hro', 300, 262, 273, 3, 150, 46],
], [
  ['anest', 5, 0, 0, 0, 11, 0, 0, 1, 8, 0, 0, 0], ['anest', 7, 6, 6, 4, 23, 11, 9, 0, 12, 5, 13, 10],
  ['anest', 5, 4, 4, 4, 24, 11, 12, 0, 10, 1, 12, 12], ['anest', 6, 6, 6, 5, 22, 10, 13, 2, 9, 5, 14, 16],
  ['anest', 5, 5, 6, 5, 20, 12, 11, 1, 8, 5, 13, 11], ['anest', 5, 5, 6, 5, 15, 9, 9, 0, 6, 3, 39, 39],
  ['anest', 5, 2, 2, 2, 13, 0, 1, 0, 6, 0, 0, 5], ['anest', 6, 6, 6, 5, 19, 10, 11, 0, 9, 6, 11, 11],
  ['anest', 5, 5, 5, 5, 5, 4, 4, 0, 4, 3, 8, 4], ['anest', 6, 6, 6, 5, 12, 5, 4, 0, 7, 0, 6, 4],
  ['anest', 6, 5, 5, 4, 16, 5, 6, 0, 9, 0, 5, 6], ['anest', 5, 4, 4, 4, 15, 7, 5, 0, 7, 1, 10, 15],
  ['anest', 5, 5, 5, 5, 19, 0, 1, 0, 8, 0, 1, 1], ['anest', 5, 5, 5, 5, 16, 0, 0, 0, 8, 0, 1, 0],
  ['anest', 4, 3, 3, 3, 9, 3, 2, 0, 4, 0, 5, 3], ['anest', 5, 5, 5, 5, 10, 5, 4, 0, 7, 6, 7, 4],
  ['anest', 2, 2, 2, 2, 6, 0, 2, 0, 5, 0, 0, 2], ['anest', 5, 5, 5, 5, 8, 4, 4, 1, 6, 1, 6, 15],
  ['anest', 5, 1, 1, 1, 21, 1, 1, 0, 10, 0, 1, 1], ['anest', 5, 2, 2, 2, 7, 2, 4, 0, 4, 1, 3, 5],
  ['anest', 4, 4, 4, 4, 5, 2, 4, 0, 2, 0, 4, 4], ['anest', 5, 5, 5, 5, 13, 0, 0, 0, 6, 0, 1, 0],
  ['anest', 5, 4, 4, 4, 27, 13, 15, 1, 11, 4, 18, 20], ['anest', 5, 5, 5, 5, 18, 5, 7, 0, 8, 4, 31, 42],
  ['anest', 5, 5, 5, 5, 18, 8, 7, 0, 9, 0, 8, 7], ['anest', 7, 6, 6, 5, 18, 12, 11, 0, 10, 3, 30, 43],
  ['anest', 5, 5, 5, 4, 12, 4, 4, 0, 5, 0, 5, 5], ['anest', 3, 1, 1, 1, 10, 1, 0, 0, 6, 0, 1, 0],
  ['anest', 7, 5, 5, 4, 29, 3, 4, 0, 15, 3, 3, 4], ['anest', 6, 5, 5, 5, 14, 4, 6, 0, 7, 0, 5, 8],
  ['anest', 3, 3, 3, 3, 9, 5, 5, 0, 5, 2, 7, 6], ['anest', 5, 5, 5, 5, 16, 4, 4, 0, 7, 1, 7, 6],
  ['anest', 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0], ['anest', 5, 5, 6, 5, 22, 18, 18, 0, 11, 7, 25, 21],
  ['anest', 5, 5, 5, 5, 15, 1, 5, 0, 7, 3, 2, 6], ['anest', 4, 2, 2, 2, 6, 1, 4, 0, 2, 0, 3, 4],
  ['anest', ...Z], ['anest', 3, 0, 0, 0, 9, 0, 0, 0, 3, 0, 0, 0],
  ['anest', 5, 5, 6, 5, 13, 7, 9, 1, 8, 5, 19, 18], ['anest', 3, 3, 4, 4, 11, 6, 2, 0, 6, 0, 9, 4],
  ['anest', ...Z], ['anest', 5, 5, 5, 5, 16, 11, 11, 1, 7, 0, 14, 35],
  ['anest', 4, 4, 5, 5, 7, 3, 4, 0, 4, 2, 7, 4], ['anest', 6, 6, 6, 5, 21, 3, 3, 0, 11, 1, 7, 5],
  ['anest', 5, 5, 5, 5, 23, 21, 20, 0, 5, 1, 76, 64], ['anest', 5, 5, 5, 5, 13, 1, 1, 0, 9, 2, 1, 1],
  ['enf', ...Z], ['enf', 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 35, 23],
  ['enf', 0, 0, 6, 5, 0, 0, 0, 0, 0, 0, 29, 11], ['enf', 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 27, 13],
  ['enf', 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 19, 19], ['enf', 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 6, 4],
  ['hosp', 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 55, 44], ['hosp', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  ['res', ...Z], ['res', 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  ['res', 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 1, 1], ['res', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  ['res', 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], ['res', 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 21, 20],
  ['res', ...Z], ['res', ...Z],
  ['sec', ...Z], ['sec', ...Z], ['sec', ...Z], ['sec', ...Z], ['sec', ...Z],
])

// ─── Datas ───────────────────────────────────────────────────────────────────────────────────

describe('escalaAdesaoSemanal — semanas', () => {
  const CINCO_ATE_25_10 = [
    { de: '2026-09-21', ate: '2026-09-27' },
    { de: '2026-09-28', ate: '2026-10-04' },
    { de: '2026-10-05', ate: '2026-10-11' },
    { de: '2026-10-12', ate: '2026-10-18' },
    { de: '2026-10-19', ate: '2026-10-25' },
  ]

  it('gravado no meio da semana (terça 27/10): a última termina no domingo anterior', () => {
    expect(ultimasSemanasCompletas(5, '2026-10-27')).toEqual(CINCO_ATE_25_10)
  })

  it('gravado num domingo: a semana daquele domingo já está completa', () => {
    expect(ultimasSemanasCompletas(5, '2026-10-25')).toEqual(CINCO_ATE_25_10)
  })

  it('gravado na segunda: ainda vale o domingo da véspera; no sábado, a semana corrente não entra', () => {
    expect(ultimasSemanasCompletas(5, '2026-10-26').at(-1)).toEqual({ de: '2026-10-19', ate: '2026-10-25' })
    expect(ultimasSemanasCompletas(1, '2026-10-24')).toEqual([{ de: '2026-10-12', ate: '2026-10-18' }])
  })

  it('atravessa a virada do ano e aceita data com hora (só os 10 primeiros caracteres)', () => {
    expect(ultimasSemanasCompletas(2, '2027-01-05T02:00:00Z')).toEqual([
      { de: '2026-12-21', ate: '2026-12-27' },
      { de: '2026-12-28', ate: '2027-01-03' },
    ])
  })

  it('sem data gravada ou n inválido → nenhuma semana', () => {
    expect(ultimasSemanasCompletas(5, null)).toEqual([])
    expect(ultimasSemanasCompletas(5, '')).toEqual([])
    expect(ultimasSemanasCompletas(5, '27/10/2026')).toEqual([])
    expect(ultimasSemanasCompletas(0, '2026-10-27')).toEqual([])
  })

  it('janelas: 4 semanas antes da 1ª do gráfico × as 4 últimas', () => {
    expect(janelasComparacao(CINCO_ATE_25_10)).toEqual({
      antes: { de: '2026-08-24', ate: '2026-09-20' },
      depois: { de: '2026-09-28', ate: '2026-10-25' },
    })
    // gráfico menor que a janela: o "depois" é o gráfico inteiro
    expect(janelasComparacao(CINCO_ATE_25_10.slice(3)).depois).toEqual({ de: '2026-10-12', ate: '2026-10-25' })
    expect(janelasComparacao([])).toBeNull()
  })

  it('rótulo da semana = dd/mm da segunda-feira', () => {
    expect(rotuloSemana('2026-09-21')).toBe('21/09')
    expect(rotuloSemana(null)).toBe('')
  })
})

// ─── Uma semana ──────────────────────────────────────────────────────────────────────────────

describe('escalaAdesaoSemanal — resumoSemana', () => {
  it('confere com o banco: semana 19–25/10/2026', () => {
    const r = resumoSemana(REAL_19_10)
    expect(r.anest).toMatchObject({ base: 44, engajados: 17, baixo: 12 })
    expect(r.enf).toMatchObject({ base: 6, engajados: 4 })
    expect(r.res).toMatchObject({ base: 8, engajados: 1 })
    expect(r.engajados).toEqual({ total: 22, base: 58 })
    expect(r.hospitais.total.ini).toBeCloseTo(86.3, 1)
    expect(r.hospitais.total.ter).toBeCloseTo(89.5, 1)
    expect(r.hospitais.total.tot).toBeCloseTo(29.8, 1)
    expect(r.hospitais.total.casos).toBe(637)
    expect(r.anest.abre).toBeCloseTo(85.0, 1)
    expect(r.anest.iniProprio).toBeCloseTo(36.4, 1)
    expect(r.anest.terProprio).toBeCloseTo(38.8, 1)
    expect(r.de).toBe('2026-10-19')
    expect(r.ate).toBe('2026-10-25')
  })

  it('confere com o banco: semana 21–27/09/2026', () => {
    const r = resumoSemana(REAL_21_09)
    expect(r.anest).toMatchObject({ base: 41, engajados: 5 })
    expect(r.enf).toMatchObject({ base: 6, engajados: 2 })
    expect(r.res).toMatchObject({ base: 8, engajados: 1 })
    expect(r.hospitais.total.ini).toBeCloseTo(54.6, 1)
    expect(r.hospitais.total.ter).toBeCloseTo(68.0, 1)
    expect(r.hospitais.total.tot).toBeCloseTo(13.4, 1)
  })

  it('anestesiologista sem cirurgia na semana fica fora da base (mesmo tendo aberto)', () => {
    const r = resumoSemana(semana('2026-10-19', [anest(), anest({ nome: 'SEM CASO', casos: 0, ini_eu: 0, ter_eu: 0 })]))
    expect(r.anest.base).toBe(1)
  })

  it('índice: corte de engajado é ≥ 50 e "baixo" é < 30 (bordas exatas)', () => {
    // abre 100 (100) · início 80% (100) · término 40% (50) · tempo 0 · total 0 → 50
    const cinquenta = anest({ dne: 5, de: 5, ini_eu: 8, ter_eu: 4, tp_inf: 0, tot_eu: 0 })
    // abre 100 (100) · início 40% (50) · resto 0 → 30
    const trinta = anest({ nome: 'B', dne: 5, de: 5, ini_eu: 4, ter_eu: 0, tp_inf: 0, tot_eu: 0 })
    // só abre → 20
    const vinte = anest({ nome: 'C', dne: 5, de: 5, ini_eu: 0, ter_eu: 0, tp_inf: 0, tot_eu: 0 })
    expect(indiceAnest(cinquenta)).toBe(50)
    expect(indiceAnest(trinta)).toBe(30)
    expect(indiceAnest(vinte)).toBe(20)
    const r = resumoSemana(semana('2026-10-19', [cinquenta, trinta, vinte]))
    expect(r.anest).toMatchObject({ base: 3, engajados: 1, baixo: 1 })
  })

  it('denominador 0 vale 0 no índice (sem NaN) e null no agregado', () => {
    // operou (casos 2) sem dia escalado gravado nem turno: abre 0 e tempo total 0
    const p = anest({ de: 0, dne: 0, turnos: 0, tot_eu: 0, casos: 2, ini_eu: 2, ter_eu: 2, tp_inf: 1 })
    expect(indiceAnest(p)).toBe(60)
    const r = resumoSemana(semana('2026-10-19', [p]))
    expect(r.anest.engajados).toBe(1)
    expect(r.anest.abre).toBeNull()
    expect(r.anest.iniProprio).toBe(100)
  })

  it('enfermagem/residente: 70% dos dias úteis (4 de 5) E 3+ marcações', () => {
    const r = resumoSemana(semana('2026-10-19', [
      equipe('enf', { nome: 'A', dn: 4, dnu: 4, ini_n: 2, ter_n: 1 }), // engajada
      equipe('enf', { nome: 'B', dn: 5, dnu: 3, ini_n: 20, ter_n: 20 }), // 3 dias úteis: não
      equipe('enf', { nome: 'C', dn: 5, dnu: 5, ini_n: 1, ter_n: 1 }), // 2 marcações: não
      equipe('enf', { nome: 'D' }), // não abriu
      equipe('res', { nome: 'E', dn: 5, dnu: 5, ini_n: 3, ter_n: 0 }), // engajado
    ]))
    expect(r.enf).toEqual({ base: 4, engajados: 1, abriram: 3, diasAbertos: 60, marcacoes: 45, minDias: 4 })
    expect(r.res).toMatchObject({ base: 1, engajados: 1, abriram: 1, diasAbertos: 100, marcacoes: 3 })
  })

  it('semana com feriado: o feriado segue dia útil (a RPC conta seg–sex) — falta nele pesa', () => {
    // 12/10/2026 (segunda) foi feriado: quem abriu de terça a sexta tem 4 de 5 e ainda é engajado;
    // quem também faltou um dia (3 de 5) não é
    const r = resumoSemana(semana('2026-10-12', [
      equipe('enf', { nome: 'A', dn: 4, dnu: 4, ini_n: 5, ter_n: 5 }),
      equipe('enf', { nome: 'B', dn: 3, dnu: 3, ini_n: 5, ter_n: 5 }),
    ], [], 5))
    expect(r.enf.engajados).toBe(1)
    expect(r.enf.diasAbertos).toBe(70)
  })

  it('semana com menos dias úteis gravados (uteis 4): bastam 3; uteis 0 → ninguém engajado', () => {
    const p = equipe('enf', { dn: 3, dnu: 3, ini_n: 3, ter_n: 0 })
    expect(resumoSemana(semana('2026-10-12', [p], [], 4)).enf).toMatchObject({ engajados: 1, minDias: 3, diasAbertos: 75 })
    expect(resumoSemana(semana('2026-10-12', [p], [], 0)).enf).toMatchObject({ engajados: 0, diasAbertos: null })
  })

  it('hospitais: razões por cirurgia e por turno; hospital ausente vira linha vazia', () => {
    const r = resumoSemana(semana('2026-10-19', [], [
      hosp('total', 100, 80, 90, 40, 10), hosp('hro', 60, 45, 50, 25, 5), hosp('unimed', 40, 35, 40, 15, 5),
    ]))
    expect(r.hospitais.total).toEqual({ casos: 100, ini: 80, ter: 90, tot: 25 })
    expect(r.hospitais.hro.ini).toBe(75)
    expect(r.hospitais.materno).toEqual({ casos: 0, ini: null, ter: null, tot: null })
  })

  it('quem marca: próprio, colega (nunca negativo) e outros cargos; % inteiros somam 100', () => {
    const r = resumoSemana(semana('2026-10-19', [
      anest({ ini_eu: 4, ter_eu: 4, ini_n: 6, ter_n: 6 }), // 8 próprios + 4 em colegas
      anest({ nome: 'B', ini_eu: 3, ter_eu: 3, ini_n: 2, ter_n: 2 }), // 6 próprios, 4 eventos
      equipe('enf', { ini_n: 5, ter_n: 5 }),
      equipe('hosp', { ini_n: 1, ter_n: 0 }),
    ]))
    // colega = max(0, (12 + 4) − 14) = 2
    expect(r.quemMarca).toEqual({ proprio: 14, colega: 2, outros: 11, total: 27, pct: { proprio: 52, colega: 7, outros: 41 } })
    const vazio = resumoSemana(semana('2026-10-19', [anest({ ini_eu: 0, ter_eu: 0, ini_n: 0, ter_n: 0 })]))
    expect(vazio.quemMarca.pct).toBeNull()
  })

  it('JSON vazio não quebra', () => {
    const r = resumoSemana(null)
    expect(r.anest).toMatchObject({ base: 0, engajados: 0, abre: null })
    expect(r.engajados).toEqual({ total: 0, base: 0 })
  })
})

// ─── Auxiliares ──────────────────────────────────────────────────────────────────────────────

describe('escalaAdesaoSemanal — porcentagens e inclinação', () => {
  it('maior resto: soma sempre 100; empate vai para quem vem antes', () => {
    expect(porcentagensInteiras([1, 1, 1])).toEqual([34, 33, 33])
    expect(porcentagensInteiras([2, 1])).toEqual([67, 33])
    expect(porcentagensInteiras([0, 0, 0])).toBeNull()
    for (const v of [[7, 13, 29], [1, 0, 0], [333, 333, 334], [5, 5, 1], [1, 2, 3, 4, 5, 6, 7]]) {
      expect(porcentagensInteiras(v).reduce((s, x) => s + x, 0)).toBe(100)
    }
  })

  it('inclinação por semana; null não muda a posição dos outros', () => {
    expect(inclinacao([1, 2, 3, 4, 5])).toBeCloseTo(1)
    expect(inclinacao([10, null, 30])).toBeCloseTo(10)
    expect(inclinacao([5, null, null, null, 1])).toBeCloseTo(-1)
    expect(inclinacao([3, 3, 3])).toBe(0)
    expect(inclinacao([2, 4, 3, 7, 9])).toBeCloseTo(1.7)
  })

  it('inclinação sem 2 pontos é null', () => {
    expect(inclinacao([null, 5])).toBeNull()
    expect(inclinacao([])).toBeNull()
    expect(inclinacao(undefined)).toBeNull()
  })
})

// ─── Janelas e evolução ──────────────────────────────────────────────────────────────────────

describe('escalaAdesaoSemanal — compararJanelas', () => {
  // índices: só abre = 20 · abre + início 80% = 40 · + término 80% = 60 · tudo = 100
  const so = (nome, nivel, over = {}) => {
    const base = { nome, ini_eu: 0, ter_eu: 0, tp_inf: 0, tot_eu: 0 }
    if (nivel >= 40) base.ini_eu = 8
    if (nivel >= 60) base.ter_eu = 8
    if (nivel >= 100) Object.assign(base, { tp_inf: 5, tot_eu: 4 })
    return anest({ ...base, ...over })
  }

  it('conta só quem operou nas duas janelas e separa melhorou/estável/piorou', () => {
    const antes = semana('2026-08-24', [
      so('VIROU', 20), so('MANTEVE', 60), so('DEIXOU', 60), so('ESTAVEL', 40),
      so('SO ANTES', 100), so('SEM CASO DEPOIS', 20),
    ])
    const depois = semana('2026-09-28', [
      so('VIROU', 60), so('MANTEVE', 100), so('DEIXOU', 20),
      so('ESTAVEL', 40, { de: 5, dne: 5 }), so('SO DEPOIS', 100),
      so('SEM CASO DEPOIS', 100, { casos: 0, ini_eu: 0, ter_eu: 0, tp_inf: 0 }),
    ])
    expect(compararJanelas(antes, depois)).toEqual({
      n: 4, melhoraram: 2, estaveis: 1, pioraram: 1,
      engajadosAntes: 2, engajadosDepois: 2, viraramEngajados: 1, mantiveram: 1, deixaram: 1,
    })
  })

  it('mudança de até 5 pontos é estável; a chave inclui o cargo', () => {
    // 60 → 65 (tempo total 1 de 5 = 20% → 25% da meta ÷ 5 = 5 pontos: exatamente 5 → estável)
    const antes = semana('2026-08-24', [so('A', 60)])
    const depois = semana('2026-09-28', [so('A', 60, { tot_eu: 1 })])
    expect(compararJanelas(antes, depois)).toMatchObject({ n: 1, estaveis: 1, melhoraram: 0 })
    const outroCargo = semana('2026-09-28', [{ ...so('A', 100), cargo: 'res' }])
    expect(compararJanelas(antes, outroCargo).n).toBe(0)
    expect(compararJanelas(null, null).n).toBe(0)
  })
})

describe('escalaAdesaoSemanal — montarEvolucao', () => {
  const SEGUNDAS = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']
  // semana i: i+1 anestesistas engajados, enfermagem engajada só na última; início 50% → 90%
  const semanas = SEGUNDAS.map((seg, i) => semana(seg, [
    ...Array.from({ length: 5 }, (_, k) => (k <= i ? anest({ nome: `A${k}` }) : anest({ nome: `A${k}`, ini_eu: 0, ter_eu: 0, tp_inf: 0, tot_eu: 0, ini_n: 0, ter_n: 0 }))),
    equipe('enf', i === 4 ? { dn: 5, dnu: 5, ini_n: 4, ter_n: 4 } : { dn: 1, dnu: 1 }),
    equipe('res'),
  ], [hosp('total', 100 + i, 50 + 10 * i, 60 + 10 * i, 50, i === 0 ? 0 : 10 * i)]))

  it('séries por semana com rótulo, pontas e inclinações', () => {
    const ev = montarEvolucao({ semanas, antes: semanas[0], depois: semanas[4] })
    expect(ev.serie.map((s) => s.rotulo)).toEqual(['21/09', '28/09', '05/10', '12/10', '19/10'])
    expect(ev.serie.map((s) => s.engajadosAnest)).toEqual([1, 2, 3, 4, 5])
    expect(ev.serie.map((s) => s.engajadosTotal)).toEqual([1, 2, 3, 4, 6])
    expect(ev.serie[0]).toMatchObject({ baseAnest: 5, baseEnf: 1, baseRes: 1, baseTotal: 7, de: '2026-09-21', ate: '2026-09-27' })
    expect(ev.inclinacoes.anest).toBeCloseTo(1)
    expect(ev.inclinacoes.enf).toBeCloseTo(0.2)
    expect(ev.inclinacoes.res).toBe(0)
    expect(ev.inclinacoes.tot).toBeGreaterThan(0)
    expect(ev.pontas.engajadosAnest).toEqual({ primeiro: 1, ultimo: 5, delta: 4 })
    expect(ev.pontas.ini.primeiro).toBeCloseTo(50)
    expect(ev.pontas.ini.ultimo).toBeCloseTo(90 / 104 * 100)
    expect(ev.periodo).toEqual({ de: '2026-09-21', ate: '2026-10-25' })
    expect(Object.keys(ev.inclinacoes).sort()).toEqual(['abre', 'anest', 'enf', 'ini', 'res', 'ter', 'terProprio', 'tot', 'total'])
  })

  it('1ª × última semana, comparação das janelas e total de cirurgias', () => {
    const ev = montarEvolucao({ semanas, antes: semanas[0], depois: semanas[4] })
    expect(ev.hospitais.primeira.total.casos).toBe(100)
    expect(ev.hospitais.ultima.total.casos).toBe(104)
    expect(ev.enf.primeira.engajados).toBe(0)
    expect(ev.enf.ultima.engajados).toBe(1)
    expect(ev.res.ultima.base).toBe(1)
    expect(ev.quemMarca.primeira.proprio).toBe(16)
    expect(ev.quemMarca.ultima.pct.proprio + ev.quemMarca.ultima.pct.colega + ev.quemMarca.ultima.pct.outros).toBe(100)
    expect(ev.janelas).toMatchObject({ n: 5, engajadosAntes: 1, engajadosDepois: 5, viraramEngajados: 4, mantiveram: 1 })
    expect(ev.cirurgias).toBe(100 + 101 + 102 + 103 + 104)
    expect(ev.semanas).toHaveLength(5)
  })

  it('com as semanas reais: 5 → 17 anestesiologistas engajados, 1.243 cirurgias', () => {
    const ev = montarEvolucao({ semanas: [REAL_21_09, REAL_19_10] })
    expect(ev.pontas.engajadosAnest).toEqual({ primeiro: 5, ultimo: 17, delta: 12 })
    expect(ev.pontas.engajadosTotal).toEqual({ primeiro: 8, ultimo: 22, delta: 14 })
    expect(ev.cirurgias).toBe(1243)
    expect(ev.janelas).toBeNull()
  })

  it('tempo total sem turno numa semana fica null e sai da inclinação', () => {
    const s = semanas.map((x, i) => (i === 2 ? { ...x, hospitais: [hosp('total', 10, 5, 5, 0, 0)] } : x))
    const ev = montarEvolucao({ semanas: s })
    expect(ev.serie[2].tot).toBeNull()
    expect(ev.inclinacoes.tot).not.toBeNull()
  })

  it('semanas anteriores de contexto: engajados e início de cada uma, e o marco do relatório na virada', () => {
    const previas = ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'].map((seg) => semana(seg, [anest({ nome: 'A0' })], [hosp('total', 100, 40, 50, 10, 1)]))
    const ev = montarEvolucao({ semanas, previas })
    expect(ev.anteriores.map((a) => a.rotulo)).toEqual(['24/08', '31/08', '07/09', '14/09'])
    expect(ev.anteriores[0]).toMatchObject({ engajadosTotal: 1, ini: 40 })
    expect(ev.inclinacoesAnteriores.ini).toBe(0)
    // 23/09 cai na semana de 21/09, a 1ª do gráfico: as cinzas são exatamente as de antes do relatório
    expect(ev.marco).toEqual({ indice: 4, virada: true })
  })

  it('marco fora da virada quando a janela já andou; fora da série inteira → null', () => {
    const tarde = ['2026-10-26', '2026-11-02'].map((seg) => semana(seg, [anest()]))
    expect(montarEvolucao({ semanas: tarde, previas: semanas.slice(0, 2) }).marco).toEqual({ indice: 0, virada: false })
    expect(montarEvolucao({ semanas: tarde }).marco).toBeNull()
    expect(montarEvolucao({ semanas: tarde }).anteriores).toEqual([])
  })

  it('sem semanas → null', () => {
    expect(montarEvolucao({ semanas: [] })).toBeNull()
    expect(montarEvolucao()).toBeNull()
  })
})
