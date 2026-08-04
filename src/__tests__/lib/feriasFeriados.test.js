/**
 * Tripwire deliberado: em 01/01 este teste QUEBRA se os feriados (e os
 * sócios) do ano corrente ainda não foram configurados — força a
 * manutenção anual dos data files do Extrato de Férias em vez de deixar
 * o extrato contar feriado como dia comum em silêncio.
 */
import { describe, it, expect } from 'vitest'
import { FERIADOS_UTEIS, getFeriados, getRecesso } from '../../lib/feriasFeriados'
import { SOCIOS_FERIAS, getSocios } from '../../lib/feriasSocios'

const ANO_CORRENTE = new Date().getFullYear()

describe('manutenção anual dos data files de férias', () => {
  it(`FERIADOS_UTEIS[${ANO_CORRENTE}] existe (atualizar férias/FERIADOS <ano>.pdf → feriasFeriados.js)`, () => {
    expect(FERIADOS_UTEIS[ANO_CORRENTE]).toBeDefined()
    expect(FERIADOS_UTEIS[ANO_CORRENTE].length).toBeGreaterThan(0)
  })

  it(`SOCIOS_FERIAS[${ANO_CORRENTE}] existe`, () => {
    expect(SOCIOS_FERIAS[ANO_CORRENTE]).toBeDefined()
    expect(SOCIOS_FERIAS[ANO_CORRENTE].length).toBeGreaterThan(0)
  })
})

describe('conteúdo 2026 (fonte: férias/FERIADOS 2026.pdf)', () => {
  it('tem os 10 feriados da escala do grupo, com Carnaval e SEM 01/01 e 25/12 (recesso)', () => {
    const f = getFeriados(2026)
    expect(f.size).toBe(10)
    expect(f.has('2026-02-17')).toBe(true) // Carnaval está na escala do grupo
    expect(f.has('2026-01-01')).toBe(false) // recesso, não escala de feriados
    expect(f.has('2026-12-25')).toBe(false)
  })

  it('todas as datas são ISO válidas e do ano', () => {
    for (const d of FERIADOS_UTEIS[2026]) {
      expect(d).toMatch(/^2026-\d{2}-\d{2}$/)
    }
  })

  it('ano não configurado → Set vazio (extrato degrada sem quebrar)', () => {
    expect(getFeriados(1999).size).toBe(0)
    expect(getRecesso(1999)).toBeNull()
  })

  it('são 46 sócios com anoEntrada plausível; fallback de ano usa o mais recente', () => {
    const socios = getSocios(2026)
    expect(socios).toHaveLength(46)
    for (const s of socios) {
      expect(s.anoEntrada).toBeGreaterThanOrEqual(1988)
      expect(s.anoEntrada).toBeLessThanOrEqual(2026)
    }
    expect(getSocios(2030)).toEqual(socios)
  })
})
