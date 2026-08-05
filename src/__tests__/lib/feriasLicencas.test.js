/**
 * Licença-paternidade (dono 05/08): dia do parto e dia seguinte; caindo em
 * fim de semana/feriado, apenas o primeiro dia útil subsequente.
 */
import { describe, it, expect } from 'vitest'
import { diasLicencaPaternidade, ehDiaUtil, COTA_LICENCA_MATERNIDADE } from '../../lib/feriasLicencas'
import { getFeriados } from '../../lib/feriasFeriados'

const FERIADOS = getFeriados(2026)

describe('diasLicencaPaternidade', () => {
  it('parto em dia útil no meio da semana: o dia e o seguinte', () => {
    // 2026-03-03 é terça
    expect(diasLicencaPaternidade({ dataParto: '2026-03-03', feriados: FERIADOS }))
      .toEqual(['2026-03-03', '2026-03-04'])
  })

  it('parto na sexta: só a sexta (o dia seguinte não é útil)', () => {
    // 2026-03-06 é sexta
    expect(diasLicencaPaternidade({ dataParto: '2026-03-06', feriados: FERIADOS }))
      .toEqual(['2026-03-06'])
  })

  it('parto no sábado: apenas o primeiro dia útil subsequente (segunda)', () => {
    // 2026-03-07 sábado → 09/03 segunda
    expect(diasLicencaPaternidade({ dataParto: '2026-03-07', feriados: FERIADOS }))
      .toEqual(['2026-03-09'])
  })

  it('parto no domingo: a segunda seguinte, e só ela', () => {
    expect(diasLicencaPaternidade({ dataParto: '2026-03-08', feriados: FERIADOS }))
      .toEqual(['2026-03-09'])
  })

  it('parto em feriado que cai na sexta: pula para a segunda', () => {
    // 2026-04-03 (Sexta-feira Santa) é feriado do grupo
    expect(FERIADOS.has('2026-04-03')).toBe(true)
    expect(diasLicencaPaternidade({ dataParto: '2026-04-03', feriados: FERIADOS }))
      .toEqual(['2026-04-06'])
  })

  it('parto na véspera de feriado: o dia do parto entra, o feriado não', () => {
    // 2026-04-02 é quinta útil; 03/04 é feriado → só a quinta
    expect(diasLicencaPaternidade({ dataParto: '2026-04-02', feriados: FERIADOS }))
      .toEqual(['2026-04-02'])
  })

  it('sem feriados configurados, feriado vira dia comum', () => {
    expect(diasLicencaPaternidade({ dataParto: '2026-04-02' }))
      .toEqual(['2026-04-02', '2026-04-03'])
  })

  it('entrada inválida devolve lista vazia em vez de estourar', () => {
    expect(diasLicencaPaternidade({ dataParto: null })).toEqual([])
    expect(diasLicencaPaternidade({ dataParto: '03/03/2026' })).toEqual([])
    expect(diasLicencaPaternidade({})).toEqual([])
  })
})

describe('ehDiaUtil', () => {
  it('fim de semana e feriado não são úteis', () => {
    expect(ehDiaUtil('2026-03-07', FERIADOS)).toBe(false) // sábado
    expect(ehDiaUtil('2026-03-08', FERIADOS)).toBe(false) // domingo
    expect(ehDiaUtil('2026-04-03', FERIADOS)).toBe(false) // feriado
    expect(ehDiaUtil('2026-03-03', FERIADOS)).toBe(true)
  })
})

describe('licença-maternidade', () => {
  it('a cota do ano vigente cai para 20 dias úteis', () => {
    expect(COTA_LICENCA_MATERNIDADE).toBe(20)
  })
})
