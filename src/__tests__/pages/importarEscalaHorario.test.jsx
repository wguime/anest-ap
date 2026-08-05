import { describe, expect, it } from 'vitest'
import { validarHorarioImportacao } from '../../pages/escala-cirurgica/ImportarEscalaPage'

describe('publicação da importação — contexto e horários', () => {
  it('preserva a escolha matutina mesmo quando o relógio já passou das 13h', () => {
    const resultado = validarHorarioImportacao([{ sala: 'CC 1', hora: '08:00' }], 'matutino')
    expect(resultado.invalidos).toHaveLength(0)
    expect(resultado.incompatíveis).toHaveLength(0)
  })

  it('resume explicitamente hospital, data e turno para confirmação', () => {
    const resultado = validarHorarioImportacao([
      { sala: 'CC 1', hora: '' },
      { sala: 'CC 2', hora: '09:00' },
    ], 'matutino')
    expect(resultado.semHora).toBe(1)
    expect(resultado.invalidos).toHaveLength(0)
  })

  it('separa itens sem hora sem tratá-los como horário inválido', () => {
    const resultado = validarHorarioImportacao([{ sala: 'SRPA', hora: '' }], 'vespertino')
    expect(resultado.semHora).toBe(1)
    expect(resultado.invalidos).toHaveLength(0)
  })

  it('permite AS/À seguir como horário sequencial', () => {
    const resultado = validarHorarioImportacao([
      { sala: 'CC 1', hora: '08:00' },
      { sala: 'CC 1', hora: 'AS' },
      { sala: 'CC 1', hora: 'À seguir' },
    ], 'matutino')
    expect(resultado.invalidos).toHaveLength(0)
    expect(resultado.semHora).toBe(2)
  })

  it('detecta hora inválida e horário incompatível com o turno escolhido', () => {
    const resultado = validarHorarioImportacao([
      { sala: 'CC 1', hora: '25:00' },
      { sala: 'CC 2', hora: '14:00' },
    ], 'matutino')
    expect(resultado.invalidos).toHaveLength(1)
    expect(resultado.incompatíveis).toHaveLength(1)
    expect(resultado.incompatíveis[0].turnoHora).toBe('vespertino')
  })
})
