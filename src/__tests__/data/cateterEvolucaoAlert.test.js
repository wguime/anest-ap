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

describe('getEvolucaoAlertLevel (warning 30h / critical 42h)', () => {
  it('recém-evoluído → normal', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(2), hoursAgo(40))).toBe('normal')
  })

  it('no limite de warning (30h) → warning', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(EVOLUCAO_WARNING_HOURS), null)).toBe('warning')
  })

  it('entre 30h e 42h → warning', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(36), null)).toBe('warning')
  })

  it('no limite crítico (42h) → critical', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(EVOLUCAO_CRITICAL_HOURS), null)).toBe('critical')
  })

  // Regressão 08/08: a visita diária deriva de hora (intervalos reais medidos em
  // produção: 21,8h · 25,2h · 25,4h · 31,3h · 34,4h). Com o corte antigo de 24h,
  // um cateter evoluído TODO DIA acendia o alerta na janela entre a visita de
  // ontem e a de hoje — e sumia quando a visita do dia era registrada.
  it.each([21.8, 25.2, 25.4, 28])(
    'visita diária com deriva de %sh → normal (não é falta de evolução)',
    (h) => {
      expect(getEvolucaoAlertLevel(hoursAgo(h), hoursAgo(96))).toBe('normal')
    }
  )

  it('um dia inteiro pulado (46h) → critical', () => {
    expect(getEvolucaoAlertLevel(hoursAgo(46), hoursAgo(96))).toBe('critical')
  })

  it('nunca evoluído há muito tempo (desde inserção) → critical', () => {
    expect(getEvolucaoAlertLevel(null, hoursAgo(48))).toBe('critical')
  })

  it('evoluído recentemente apesar de inserção antiga → normal', () => {
    // cateter inserido há 3 dias, mas evoluído há 1h: não está "não evoluído"
    expect(getEvolucaoAlertLevel(hoursAgo(1), hoursAgo(72))).toBe('normal')
  })
})
