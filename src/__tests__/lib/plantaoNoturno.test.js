/**
 * plantaoNoturno — fase noturna das Liberações (decisões do dono a/b/c 23/07):
 * 19h vira 'noite' (P3 Unimed / P2 SRPA / P1 HRO / P4 coringa), 22h ZERA,
 * FDS sem transição, feriado seg–sex SEGUE a regra, outra data sempre 'dia'.
 */
import { describe, it, expect } from 'vitest'
import {
  faseLiberacoes, plantonistasNoturnos, candidatosNome, plantonistaNoturnoDe, linhasNoturnas,
} from '../../lib/plantaoNoturno'

const HOJE = '2026-07-23' // quinta-feira
const args = (agoraMin, dataEscala = HOJE, hojeIso = HOJE) => ({ agoraMin, dataEscala, hojeIso })

describe('faseLiberacoes', () => {
  it('dia útil: dia antes das 19h, noite 19h–22h, zerada às 22h', () => {
    expect(faseLiberacoes(args(18 * 60 + 59))).toBe('dia')
    expect(faseLiberacoes(args(19 * 60))).toBe('noite')
    expect(faseLiberacoes(args(21 * 60 + 59))).toBe('noite')
    expect(faseLiberacoes(args(22 * 60))).toBe('zerada')
    expect(faseLiberacoes(args(23 * 60 + 59))).toBe('zerada')
  })
  it('FDS: sem transição (sempre dia)', () => {
    expect(faseLiberacoes({ agoraMin: 20 * 60, dataEscala: '2026-07-25', hojeIso: '2026-07-25' })).toBe('dia') // sábado
    expect(faseLiberacoes({ agoraMin: 22 * 60, dataEscala: '2026-07-26', hojeIso: '2026-07-26' })).toBe('dia') // domingo
  })
  it('feriado em dia de semana SEGUE a regra (decisão c) — qualquer seg–sex vira noite às 19h', () => {
    // 2026-09-07 (Independência) cai numa segunda
    expect(faseLiberacoes({ agoraMin: 20 * 60, dataEscala: '2026-09-07', hojeIso: '2026-09-07' })).toBe('noite')
  })
  it('outra data que não hoje: sempre dia (consultar ontem/amanhã não zera nada)', () => {
    expect(faseLiberacoes({ agoraMin: 23 * 60, dataEscala: '2026-07-22', hojeIso: '2026-07-23' })).toBe('dia')
  })
})

describe('plantonistasNoturnos', () => {
  it('extrai P1–P4 pelo setor (1º de cada), ignorando P5+ e vazios', () => {
    const plantoes = [
      { setor: 'P1', nome: 'Guilherme Xavier Di Domenico', hora: '19:00' },
      { setor: 'P2', nome: 'G. Staub', hora: '19:00' },
      { setor: 'P3', nome: 'João Ricardo Moreira', hora: '19:00' },
      { setor: 'P4', nome: 'Gabriel Juan Kettenhuber Costa', hora: '19:00' },
      { setor: 'P5', nome: 'Fulano' },
      { setor: 'P1', nome: 'Duplicado Ignorado' },
      { setor: 'P2', nome: '' },
    ]
    expect(plantonistasNoturnos(plantoes)).toEqual({
      P1: 'Guilherme Xavier Di Domenico',
      P2: 'G. Staub',
      P3: 'João Ricardo Moreira',
      P4: 'Gabriel Juan Kettenhuber Costa',
    })
  })
  it('vazio/null → {}', () => {
    expect(plantonistasNoturnos([])).toEqual({})
    expect(plantonistasNoturnos(null)).toEqual({})
  })
})

describe('candidatosNome', () => {
  it('nome completo gera variações (completo, primeiro+último, último, primeiro)', () => {
    expect(candidatosNome('João Ricardo Moreira')).toEqual([
      'João Ricardo Moreira', 'João Moreira', 'Moreira', 'João',
    ])
  })
  it('inicial abreviada ("G. Staub") cai no sobrenome', () => {
    expect(candidatosNome('G. Staub')).toEqual(['Staub'])
  })
  it('honorífico "Dr."/"Dra." é descartado', () => {
    expect(candidatosNome('Dr. Carlos Silva')).toContain('Carlos Silva')
  })
  it('vazio → []', () => {
    expect(candidatosNome('')).toEqual([])
  })
})

describe('plantonistaNoturnoDe + linhasNoturnas', () => {
  const noturnos = { P1: 'P1 Nome', P2: 'P2 Nome', P3: 'P3 Nome', P4: 'P4 Nome' }
  it('unimed: plantonista = P3; linhas P3 + P2 (SRPA) + P4 (coringa)', () => {
    expect(plantonistaNoturnoDe('unimed', noturnos)).toBe('P3 Nome')
    expect(linhasNoturnas('unimed', noturnos).map((l) => l.setor)).toEqual(['P3', 'P2', 'P4'])
  })
  it('hro: plantonista = P1; linhas P1 + P4', () => {
    expect(plantonistaNoturnoDe('hro', noturnos)).toBe('P1 Nome')
    expect(linhasNoturnas('hro', noturnos).map((l) => l.setor)).toEqual(['P1', 'P4'])
  })
  it('materno: sem plantonista fixo; só o P4 coringa', () => {
    expect(plantonistaNoturnoDe('materno', noturnos)).toBeNull()
    expect(linhasNoturnas('materno', noturnos).map((l) => l.setor)).toEqual(['P4'])
  })
  it('setores ausentes somem das linhas', () => {
    expect(linhasNoturnas('unimed', { P3: 'X' }).map((l) => l.setor)).toEqual(['P3'])
  })
})
