/**
 * Comitê de escalas (regras de férias 2026/27): recebe o aviso de quem entra
 * como candidato acima das 6 vagas (V-10/V-33). João Ricardo coordena.
 */
import { describe, it, expect } from 'vitest'
import { getComiteEscalas, buildCandidatoNotificationPayload, getDestinatariosFerias } from '../../utils/feriasNotificacoes'
import { EMAILS_COMITE_ESCALAS, EMAILS_ALERTAS_FERIAS } from '../../pages/ferias/gate'

describe('getComiteEscalas', () => {
  it('são os 4 membros, todos também na lista de alertas diários', () => {
    expect(EMAILS_COMITE_ESCALAS).toHaveLength(4)
    for (const e of EMAILS_COMITE_ESCALAS) expect(EMAILS_ALERTAS_FERIAS).toContain(e)
  })

  it('filtra por e-mail e ignora inativos', () => {
    const users = [
      { id: 'u1', email: 'joaormoreiraster@gmail.com' },
      { id: 'u2', email: 'ALINEANESTESIO@gmail.com ' },
      { id: 'u3', email: 'oscarmorais3@hotmail.com', active: false },
      { id: 'u4', email: 'outro@x.com' },
    ]
    expect(getComiteEscalas(users)).toEqual(['u1', 'u2'])
    expect(getDestinatariosFerias(users)).toEqual(['u1', 'u2'])
  })
})

describe('buildCandidatoNotificationPayload', () => {
  it('cita a pessoa e os dias, 1 por pessoa por dia', () => {
    const p = buildCandidatoNotificationPayload({
      nomeCompleto: 'Fulana de Tal', datas: ['2026-12-18', '2026-12-17'], ano: 2026, hojeISO: '2026-11-18', recipientIds: ['u1', null],
    })
    expect(p.content).toContain('17/12, 18/12')
    expect(p.relatedEntityId).toBe('ferias-candidato-2026-fulana-de-tal-20261118')
    expect(p.recipientIds).toEqual(['u1'])
  })
})
