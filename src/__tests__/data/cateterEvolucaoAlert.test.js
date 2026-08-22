import { describe, it, expect } from 'vitest'
import {
  calcHorasSemAvaliacao,
  getEvolucaoAlertLevel,
  EVOLUCAO_WARNING_HOURS,
  EVOLUCAO_CRITICAL_HOURS,
} from '../../data/cateterPeridualConfig'

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString()

describe('calcHorasSemAvaliacao', () => {
  it('conta desde a última avaliação quando presente', () => {
    expect(calcHorasSemAvaliacao(hoursAgo(10), hoursAgo(50))).toBe(10)
  })

  it('conta desde a inserção quando nunca evoluído (ultimaAvaliacaoAt null)', () => {
    expect(calcHorasSemAvaliacao(null, hoursAgo(30))).toBe(30)
  })

  it('sem nenhuma data → 0', () => {
    expect(calcHorasSemAvaliacao(null, null)).toBe(0)
  })

  it('data inválida → 0', () => {
    expect(calcHorasSemAvaliacao('not-a-date', null)).toBe(0)
  })
})

describe('getEvolucaoAlertLevel (warning 36h / critical 42h)', () => {
  it('recém-evoluído → normal', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(2), hoursAgo(40))).toBe('normal')
  })

  it('no limite de warning → warning', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(EVOLUCAO_WARNING_HOURS), null)).toBe('warning')
  })

  it('entre 36h e 42h → warning', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(38), null)).toBe('warning')
  })

  it('no limite crítico → critical', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(EVOLUCAO_CRITICAL_HOURS), null)).toBe('critical')
  })

  // Regressão 08/08 + recalibração 22/08: a visita diária deriva de hora, e a
  // deriva medida em produção (55 intervalos) chega a 34,4h — 6 deles caíam
  // entre 30h e 34h e acendiam alerta mesmo com a visita FEITA. Entre 34h e 42h
  // não existe nenhum intervalo real, então é ali que o corte tem de ficar.
  it.each([21.8, 25.2, 25.4, 28, 31.3, 32.8, 34.4])(
    'visita diária com deriva de %sh → normal (não é falta de evolução)',
    (h) => {
      expect(getEvolucaoAlertLevel(hoursAgo(h), hoursAgo(96))).toBe('normal')
    }
  )

  it('o corte cai no vale vazio: nenhuma deriva real observada é warning', () => {
    // p90 dos intervalos reais = 32,8h; máximo observado = 34,4h.
    expect(EVOLUCAO_WARNING_HOURS).toBeGreaterThan(34.4)
    expect(EVOLUCAO_WARNING_HOURS).toBeLessThan(EVOLUCAO_CRITICAL_HOURS)
  })

  it('um dia inteiro pulado (46h) → critical', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(46), hoursAgo(96))).toBe('critical')
  })

  it('nunca evoluído há muito tempo (desde inserção) → critical', () => {
    // O CARD faz esse fallback de propósito (mostra que nada foi registrado).
    // O cron NÃO notifica esse caso — quem cobra é o lembrete de PO1/PO2.
    expect(getEvolucaoAlertLevel(null, hoursAgo(48))).toBe('critical')
  })

  it('evoluído recentemente apesar de inserção antiga → normal', () => {
    // cateter inserido há 3 dias, mas evoluído há 1h: não está "não evoluído"
    expect(getEvolucaoAlertLevel(hoursAgo(1), hoursAgo(72))).toBe('normal')
  })
})
