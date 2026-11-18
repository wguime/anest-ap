/**
 * Penalidade da 7ª vaga (REGRAS pág. 3: a 7ª vaga conta 3 dias).
 * Caso real: 13/10/2026 com 7 pessoas — Raquel Schneider foi a última a
 * marcar (DataCriacao 22/07) e paga 3 dias por esse dia.
 */
import { describe, it, expect } from 'vitest'
import { penalidadesSetimaVaga, VAGAS_DIA } from '../../lib/feriasAnalise'

const seis = ['A', 'B', 'C', 'D', 'E', 'F']

describe('penalidadesSetimaVaga', () => {
  it('dia com 7 e ordem confiável penaliza o ÚLTIMO em 2 dias extras', () => {
    const porDia = new Map([['2026-10-13', [...seis, 'RAQUEL SCHNEIDER']]])
    const ultimos = new Map([['2026-10-13', { confiavel: true, nome: 'RAQUEL SCHNEIDER' }]])
    const out = penalidadesSetimaVaga(porDia, ultimos)
    expect(out.get('RAQUEL SCHNEIDER')).toEqual([{ data: '2026-10-13', diasExtras: 2 }])
    expect(out.size).toBe(1) // ninguém mais é penalizado
  })

  it('dia no teto (6) não penaliza', () => {
    const porDia = new Map([['2026-10-13', seis]])
    const ultimos = new Map([['2026-10-13', { confiavel: true, nome: 'F' }]])
    expect(penalidadesSetimaVaga(porDia, ultimos).size).toBe(0)
    expect(VAGAS_DIA).toBe(6)
  })

  it('ordem NÃO confiável não penaliza ninguém (melhor não cobrar que cobrar errado)', () => {
    const porDia = new Map([['2026-10-13', [...seis, 'G']]])
    expect(penalidadesSetimaVaga(porDia, new Map([['2026-10-13', { confiavel: false }]])).size).toBe(0)
    expect(penalidadesSetimaVaga(porDia, new Map()).size).toBe(0)
  })

  it('acumula vários dias da mesma pessoa', () => {
    const porDia = new Map([
      ['2026-10-13', [...seis, 'X']],
      ['2026-11-10', [...seis, 'X']],
    ])
    const ultimos = new Map([
      ['2026-10-13', { confiavel: true, nome: 'X' }],
      ['2026-11-10', { confiavel: true, nome: 'X' }],
    ])
    const out = penalidadesSetimaVaga(porDia, ultimos)
    expect(out.get('X')).toHaveLength(2)
    expect(out.get('X').reduce((a, p) => a + p.diasExtras, 0)).toBe(4)
  })
})

describe('penalidadesSetimaVaga — regras novas (18/11/2026, V-10)', () => {
  it('quem marcou acima das 6 DEPOIS das regras novas é candidato: sem débito automático', () => {
    const porDia = new Map([['2026-12-10', [...seis, 'NOVO CANDIDATO']]])
    const ultimos = new Map([['2026-12-10', { confiavel: true, nome: 'NOVO CANDIDATO', vistoEm: '2026-11-18' }]])
    expect(penalidadesSetimaVaga(porDia, ultimos).size).toBe(0)
  })

  it('o que foi marcado ANTES segue com a penalidade antiga (dado de 2026 preservado)', () => {
    const porDia = new Map([['2026-10-13', [...seis, 'RAQUEL SCHNEIDER']]])
    const ultimos = new Map([['2026-10-13', { confiavel: true, nome: 'RAQUEL SCHNEIDER', vistoEm: '2026-07-22' }]])
    expect(penalidadesSetimaVaga(porDia, ultimos).get('RAQUEL SCHNEIDER')).toEqual([{ data: '2026-10-13', diasExtras: 2 }])
  })
})
