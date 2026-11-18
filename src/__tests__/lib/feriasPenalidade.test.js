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

describe('penalidadesSetimaVaga — regras de 2026 em diante (dono 18/11/2026)', () => {
  it('marcou acima das 6 depois de 18/11: também paga 3 dias', () => {
    const porDia = new Map([['2026-12-10', [...seis, 'NOVO CANDIDATO']]])
    const ultimos = new Map([['2026-12-10', { confiavel: true, nome: 'NOVO CANDIDATO', vistoEm: '2026-11-18' }]])
    expect(penalidadesSetimaVaga(porDia, ultimos).get('NOVO CANDIDATO')).toEqual([{ data: '2026-12-10', diasExtras: 2 }])
  })

  it('períodos nobres e congresso não descontam (V-33/V-21)', () => {
    for (const data of ['2026-12-21', '2027-01-08', '2026-08-18', '2027-07-27', '2026-11-27']) {
      const porDia = new Map([[data, [...seis, 'X']]])
      const ultimos = new Map([[data, { confiavel: true, nome: 'X' }]])
      expect(penalidadesSetimaVaga(porDia, ultimos).size, data).toBe(0)
    }
  })
})

describe('excesso do ano passa para o ano seguinte (dono 18/11/2026)', () => {
  it('excessoDoAno soma marcados + penalidade acima da cota', async () => {
    const { excessoDoAno } = await import('../../lib/feriasAnalise')
    const ext = { porPessoa: [
      { nome: 'A', cota: 30, diasContados: 31, diasEfetivos: 33 },
      { nome: 'B', cota: 30, diasContados: 30, diasEfetivos: 30 },
      { nome: 'C', cota: 20, diasContados: 10 },
    ] }
    expect([...excessoDoAno(ext)]).toEqual([['A', 3]])
  })

  it('aplicarExcessoAnterior reduz a cota e o saldo, guardando a cota cheia', async () => {
    const { aplicarExcessoAnterior } = await import('../../lib/feriasAnalise')
    const ext = { porPessoa: [{ nome: 'A', cota: 30, diasContados: 10, diasEfetivos: 10, saldo: 20 }, { nome: 'B', cota: 30, diasContados: 0, saldo: 30 }] }
    const out = aplicarExcessoAnterior(ext, new Map([['A', 3]]))
    expect(out.porPessoa[0]).toMatchObject({ cota: 27, cotaOriginal: 30, excessoAnterior: 3, saldo: 17 })
    expect(out.porPessoa[1]).toBe(ext.porPessoa[1])
    expect(aplicarExcessoAnterior(ext, null)).toBe(ext)
  })
})
