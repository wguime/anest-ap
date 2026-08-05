import { describe, expect, it } from 'vitest'
import {
  parseHoraEscala,
  ehHoraSequencialEscala,
  transicaoStatusEscala,
  turnoDaHoraEscala,
  validarCasoEscala,
} from '../../lib/escalaCirurgicaRegras'

describe('regras da Escala Cirúrgica', () => {
  it('classifica horas no limite de 13:00', () => {
    expect(turnoDaHoraEscala('12:59')).toBe('matutino')
    expect(turnoDaHoraEscala('13:00')).toBe('vespertino')
    expect(parseHoraEscala('08:30').minutos).toBe(510)
  })

  it('rejeita horário inválido sem transformar silenciosamente em turno', () => {
    expect(parseHoraEscala('08:75')).toBeNull()
    expect(parseHoraEscala('04/08/2026')).toBeNull()
    expect(validarCasoEscala({ hora: '08:75', turno: 'matutino' }).map((i) => i.code)).toContain('hora_invalida')
  })

  it('exige turno explícito para item sem horário', () => {
    expect(validarCasoEscala({ sala: 'SRPA' }).map((i) => i.code)).toContain('turno_ausente')
    expect(validarCasoEscala({ sala: 'SRPA', turno: 'matutino' })).toEqual([])
  })

  it('aceita marcador operacional à seguir', () => {
    expect(ehHoraSequencialEscala('AS')).toBe(true)
    expect(validarCasoEscala({ hora: 'À seguir', turno: 'matutino' })).toEqual([])
  })

  it('avisa divergência hora/turno sem mover o caso automaticamente', () => {
    const issues = validarCasoEscala({ hora: '08:00', turno: 'vespertino' })
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'hora_turno_divergente', severity: 'warning', expectedTurno: 'matutino' }),
    ]))
  })

  it('exige motivo para reversão de status', () => {
    expect(transicaoStatusEscala('terminada', 'iniciada').ok).toBe(false)
    expect(transicaoStatusEscala('terminada', 'iniciada', { motivo: 'Correção operacional' }).ok).toBe(true)
    expect(transicaoStatusEscala('agendada', 'iniciada')).toEqual({ ok: true, reversible: false })
  })
})
