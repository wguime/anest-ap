import { describe, it, expect } from 'vitest'
import { detectarConflitos, parseHoraMinutos } from '@/pages/escala-cirurgica/utils'

const caso = (sala, hora, uid, extra = {}) => ({ sala, hora, anestesistaUserId: uid, anestesista: uid, ...extra })

describe('parseHoraMinutos', () => {
  it('converte HH:MM em minutos; inválido → null', () => {
    expect(parseHoraMinutos('08:00')).toBe(480)
    expect(parseHoraMinutos('13:30')).toBe(810)
    expect(parseHoraMinutos('')).toBeNull()
    expect(parseHoraMinutos('99:99')).toBeNull()
  })
})

describe('detectarConflitos — mesmo login em 2 salas sobrepostas', () => {
  it('1) médicos distintos, mesma hora → sem conflito', () => {
    expect(detectarConflitos([caso('S1', '08:00', 'A'), caso('S2', '08:00', 'B')])).toEqual([])
  })
  it('2) mesmo médico, mesma hora, salas distintas → 1 conflito', () => {
    const r = detectarConflitos([caso('S1', '08:00', 'A'), caso('S2', '08:00', 'A')])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ userId: 'A', sala1: 'S1', sala2: 'S2' })
  })
  it('3) 30 min de diferença (< 90) → conflito', () => {
    expect(detectarConflitos([caso('S1', '08:00', 'A'), caso('S2', '08:30', 'A')])).toHaveLength(1)
  })
  it('4) exatamente 90 min → sem conflito', () => {
    expect(detectarConflitos([caso('S1', '08:00', 'A'), caso('S2', '09:30', 'A')])).toEqual([])
  })
  it('5) caso sem hora → ignorado', () => {
    expect(detectarConflitos([caso('S1', '', 'A'), caso('S2', '08:30', 'A')])).toEqual([])
  })
  it('6) semAnestesista → ignorado', () => {
    expect(detectarConflitos([caso('S1', '08:00', 'A', { semAnestesista: true }), caso('S2', '08:00', 'A')])).toEqual([])
  })
  it('7) sem login → ignorado', () => {
    expect(detectarConflitos([caso('S1', '08:00', null), caso('S2', '08:00', null)])).toEqual([])
  })
  it('8) mesmo médico em 3 salas sobrepostas → 3 conflitos, sem duplicata', () => {
    const r = detectarConflitos([caso('S1', '08:00', 'A'), caso('S2', '08:00', 'A'), caso('S3', '08:00', 'A')])
    expect(r).toHaveLength(3)
  })
  it('9) dedup por par de salas (não por par de casos)', () => {
    const r = detectarConflitos([caso('S1', '08:00', 'A'), caso('S1', '10:00', 'A'), caso('S2', '08:30', 'A')])
    // S1×S2 cruza (08:00–08:30), mas reporta 1 conflito por par de salas
    expect(r).toHaveLength(1)
  })
  it('mesmo médico, mesma sala → não é conflito', () => {
    expect(detectarConflitos([caso('S1', '08:00', 'A'), caso('S1', '08:30', 'A')])).toEqual([])
  })
})
