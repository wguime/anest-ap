import { describe, it, expect } from 'vitest'
import { computeRetiradaCompliance } from '../../lib/cateterIndicadores'

const ret = (insercao, retirada) => ({ status: 'retirado', dataInsercao: insercao, dataRetirada: retirada })

describe('computeRetiradaCompliance', () => {
  it('sem retirados → pct null', () => {
    expect(computeRetiradaCompliance([])).toEqual({ total: 0, within: 0, pct: null })
    expect(computeRetiradaCompliance([{ status: 'ativo', dataInsercao: '2026-06-10T08:00:00Z' }]))
      .toEqual({ total: 0, within: 0, pct: null })
  })

  it('todos retirados ≤96h → 100%', () => {
    const cs = [
      ret('2026-06-10T08:00:00Z', '2026-06-12T08:00:00Z'), // 48h
      ret('2026-06-10T08:00:00Z', '2026-06-14T07:00:00Z'), // 95h
    ]
    expect(computeRetiradaCompliance(cs)).toEqual({ total: 2, within: 2, pct: 100 })
  })

  it('exatamente 96h conta como dentro (limite inclusivo)', () => {
    const cs = [ret('2026-06-10T08:00:00Z', '2026-06-14T08:00:00Z')] // 96h
    expect(computeRetiradaCompliance(cs)).toEqual({ total: 1, within: 1, pct: 100 })
  })

  it('> 96h conta como fora', () => {
    const cs = [ret('2026-06-10T08:00:00Z', '2026-06-14T09:00:00Z')] // 97h
    expect(computeRetiradaCompliance(cs)).toEqual({ total: 1, within: 0, pct: 0 })
  })

  it('mistura → arredonda o percentual', () => {
    const cs = [
      ret('2026-06-10T08:00:00Z', '2026-06-12T08:00:00Z'), // 48h ok
      ret('2026-06-10T08:00:00Z', '2026-06-12T08:00:00Z'), // 48h ok
      ret('2026-06-10T08:00:00Z', '2026-06-16T08:00:00Z'), // 144h fora
    ]
    expect(computeRetiradaCompliance(cs)).toEqual({ total: 3, within: 2, pct: 67 })
  })

  it('ignora ativos e retirados sem datas; respeita maxHours custom', () => {
    const cs = [
      ret('2026-06-10T08:00:00Z', '2026-06-12T08:00:00Z'), // 48h
      { status: 'retirado', dataInsercao: '2026-06-10T08:00:00Z' }, // sem dataRetirada → ignorado
      { status: 'ativo', dataInsercao: '2026-06-10T08:00:00Z', dataRetirada: '2026-06-12T08:00:00Z' }, // ativo → ignorado
    ]
    expect(computeRetiradaCompliance(cs)).toEqual({ total: 1, within: 1, pct: 100 })
    // com maxHours=24, a de 48h passa a estourar
    expect(computeRetiradaCompliance(cs, 24)).toEqual({ total: 1, within: 0, pct: 0 })
  })

  it('duração negativa (data invertida) não conta como estouro', () => {
    const cs = [ret('2026-06-12T08:00:00Z', '2026-06-10T08:00:00Z')] // -48h
    expect(computeRetiradaCompliance(cs)).toEqual({ total: 1, within: 1, pct: 100 })
  })
})
