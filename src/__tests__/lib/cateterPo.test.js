import { describe, it, expect } from 'vitest'
import { computeDiaPo, formatDiaPoLabel } from '../../lib/cateterPo'

describe('computeDiaPo', () => {
  it('avaliação no mesmo dia da inserção → PO0', () => {
    expect(computeDiaPo('2026-06-12T18:00:00', '2026-06-12T08:00:00')).toBe(0)
  })

  it('dia seguinte → 1º PO', () => {
    expect(computeDiaPo('2026-06-13T07:00:00', '2026-06-12T20:00:00')).toBe(1)
  })

  it('N dias depois → Nº PO', () => {
    expect(computeDiaPo('2026-06-15T09:00:00', '2026-06-12T23:00:00')).toBe(3)
  })

  it('duas avaliações no mesmo dia retornam o mesmo PO', () => {
    const insercao = '2026-06-12T08:00:00'
    const manha = computeDiaPo('2026-06-14T08:30:00', insercao)
    const tarde = computeDiaPo('2026-06-14T16:45:00', insercao)
    expect(manha).toBe(2)
    expect(tarde).toBe(2)
    expect(manha).toBe(tarde)
  })

  it('avaliação anterior à inserção → null', () => {
    expect(computeDiaPo('2026-06-11T23:59:00', '2026-06-12T00:01:00')).toBeNull()
  })

  it('hora do dia não muda o PO (conta dia de calendário, não 24h)', () => {
    // inserção tarde da noite, avaliação cedo no dia seguinte: < 24h, mas é 1 dia de calendário
    expect(computeDiaPo('2026-06-13T06:00:00', '2026-06-12T23:00:00')).toBe(1)
    // inserção cedo, avaliação tarde da noite no mesmo dia: ~16h, ainda PO0
    expect(computeDiaPo('2026-06-12T23:00:00', '2026-06-12T06:00:00')).toBe(0)
  })

  it('aceita Date e string indistintamente', () => {
    const ins = new Date('2026-06-12T08:00:00')
    expect(computeDiaPo(new Date('2026-06-14T08:00:00'), ins)).toBe(2)
    expect(computeDiaPo('2026-06-14T08:00:00', ins)).toBe(2)
  })

  it('atravessa virada de mês corretamente', () => {
    expect(computeDiaPo('2026-07-02T10:00:00', '2026-06-30T10:00:00')).toBe(2)
  })

  it('datas ausentes ou inválidas → null', () => {
    expect(computeDiaPo(null, '2026-06-12')).toBeNull()
    expect(computeDiaPo('2026-06-12', null)).toBeNull()
    expect(computeDiaPo(undefined, undefined)).toBeNull()
    expect(computeDiaPo('not-a-date', '2026-06-12')).toBeNull()
  })
})

describe('formatDiaPoLabel', () => {
  it('PO0 é rotulado como dia da inserção', () => {
    expect(formatDiaPoLabel(0)).toBe('Dia 0 (inserção)')
  })

  it('PO >= 1 usa "Nº PO"', () => {
    expect(formatDiaPoLabel(1)).toBe('1º PO')
    expect(formatDiaPoLabel(5)).toBe('5º PO')
  })

  it('null/NaN → traço', () => {
    expect(formatDiaPoLabel(null)).toBe('—')
    expect(formatDiaPoLabel(undefined)).toBe('—')
    expect(formatDiaPoLabel(NaN)).toBe('—')
  })

  it('valores negativos defensivos caem no rótulo de inserção', () => {
    expect(formatDiaPoLabel(-1)).toBe('Dia 0 (inserção)')
  })
})
