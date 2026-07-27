/**
 * Convivência manhã/tarde no mesmo dia (decisão do dono 23/07): publicar a tarde
 * NÃO pode apagar a manhã. Cobre os helpers puros do merge por turno + rodapé
 * por-turno (formato legado array E novo {matutino,vespertino}).
 */
import { describe, it, expect } from 'vitest'
import { filtrarPorTurno as _filtrarPorTurno, turnoDoCaso as _turnoDoCaso } from '../../pages/escala-cirurgica/utils'

// Turno EXPLÍCITO do caso (bug do SRPA, dono 26/07): antes, caso sem hora era
// tratado como matutino na PUBLICAÇÃO e mostrado nos DOIS turnos na EXIBIÇÃO —
// o SRPA da manhã vazava para a tarde. Agora é uma regra só.
describe('turno do caso — publicação e exibição usam a MESMA regra', () => {
  it('turno explícito vence a hora', () => {
    expect(_turnoDoCaso({ turno: 'vespertino', hora: '08:00' })).toBe('vespertino')
    expect(_turnoDoCaso({ turno: 'matutino', hora: '15:00' })).toBe('matutino')
  })
  it('sem turno explícito, deduz pela hora (legado)', () => {
    expect(_turnoDoCaso({ hora: '08:00' })).toBe('matutino')
    expect(_turnoDoCaso({ hora: '15:00' })).toBe('vespertino')
  })
  it('sem turno e sem hora cai em matutino (mesma suposição do merge)', () => {
    expect(_turnoDoCaso({ sala: 'SRPA' })).toBe('matutino')
  })
  it('SRPA sem hora publicado na MANHÃ não aparece na tarde', () => {
    const casos = [
      { sala: 'SRPA', turno: 'matutino' },
      { sala: 'CC - Sala 1', hora: '08:00', turno: 'matutino' },
      { sala: 'CC - Sala 2', hora: '14:00', turno: 'vespertino' },
    ]
    expect(_filtrarPorTurno(casos, 'vespertino').map((c) => c.sala)).toEqual(['CC - Sala 2'])
    expect(_filtrarPorTurno(casos, 'matutino').map((c) => c.sala)).toEqual(['SRPA', 'CC - Sala 1'])
  })
  it('SRPA sem hora publicado na TARDE fica na tarde (o que a coluna resolve)', () => {
    const casos = [{ sala: 'SRPA', turno: 'vespertino' }]
    expect(_filtrarPorTurno(casos, 'vespertino')).toHaveLength(1)
    expect(_filtrarPorTurno(casos, 'matutino')).toHaveLength(0)
  })
})
import { turnoDoCaso, rodapeDoTurno, mergeRodapeTurno, mergeCasosPorTurno } from '../../pages/escala-cirurgica/utils'

describe('turnoDoCaso', () => {
  it('particiona pela hora; sem hora → matutino (bloco montado de manhã)', () => {
    expect(turnoDoCaso({ hora: '07:30' })).toBe('matutino')
    expect(turnoDoCaso({ hora: '12:45' })).toBe('matutino')
    expect(turnoDoCaso({ hora: '13:00' })).toBe('vespertino')
    expect(turnoDoCaso({ hora: '18:30' })).toBe('vespertino')
    expect(turnoDoCaso({ hora: '' })).toBe('matutino')
    expect(turnoDoCaso({})).toBe('matutino')
  })
})

describe('mergeCasosPorTurno — publicar 1 turno preserva o outro', () => {
  const manha = [
    { id: 'm1', sala: 'CC - Sala 1', hora: '07:30', anestesista: 'TIAGO' },
    { id: 'm2', sala: 'SRPA', hora: '', anestesista: 'STAUB' }, // sem hora → matutino
  ]
  it('publicar VESPERTINO mantém a manhã e acrescenta a tarde', () => {
    const tarde = [{ id: 't1', sala: 'CC - Sala 1', hora: '14:00', anestesista: 'MELO' }]
    const out = mergeCasosPorTurno(manha, tarde, 'vespertino')
    expect(out.map((c) => c.id)).toEqual(['m1', 'm2', 't1']) // manhã preservada + tarde
  })
  it('publicar MATUTINO substitui só a manhã e mantém a tarde', () => {
    const dia = [...manha, { id: 't1', sala: 'CC - Sala 1', hora: '14:00', anestesista: 'MELO' }]
    const novaManha = [{ id: 'm9', sala: 'CC - Sala 2', hora: '08:00', anestesista: 'DIEGO' }]
    const out = mergeCasosPorTurno(dia, novaManha, 'matutino')
    expect(out.map((c) => c.id)).toEqual(['t1', 'm9']) // tarde preservada + nova manhã (m1/m2 fora)
  })
  it('dia vazio + nova manhã = só a manhã', () => {
    expect(mergeCasosPorTurno([], manha, 'matutino').map((c) => c.id)).toEqual(['m1', 'm2'])
  })
})

describe('rodapé por-turno', () => {
  it('rodapeDoTurno: array legado vale p/ qualquer turno; objeto seleciona o turno', () => {
    expect(rodapeDoTurno(['A', 'B'], 'vespertino')).toEqual(['A', 'B'])
    expect(rodapeDoTurno({ matutino: ['A'], vespertino: ['X', 'Y'] }, 'vespertino')).toEqual(['X', 'Y'])
    expect(rodapeDoTurno({ matutino: ['A'] }, 'vespertino')).toEqual([])
    expect(rodapeDoTurno(null, 'matutino')).toEqual([])
  })
  it('mergeRodapeTurno: grava o turno preservando o outro; array legado vira matutino', () => {
    // legado + publicar tarde → matutino preservado, vespertino gravado
    expect(mergeRodapeTurno(['A', 'B'], 'vespertino', ['X', 'Y'])).toEqual({ matutino: ['A', 'B'], vespertino: ['X', 'Y'] })
    // objeto + publicar matutino → sobrescreve só matutino
    expect(mergeRodapeTurno({ matutino: ['A'], vespertino: ['X'] }, 'matutino', ['C'])).toEqual({ matutino: ['C'], vespertino: ['X'] })
    // vazio → só o turno publicado
    expect(mergeRodapeTurno(null, 'matutino', ['C'])).toEqual({ matutino: ['C'] })
    expect(mergeRodapeTurno([], 'vespertino', ['X'])).toEqual({ vespertino: ['X'] })
  })
})

// Materno vem com manhã E tarde no mesmo anexo (regra do dono 27/07): a HORA
// decide o turno do caso; o turno publicado só vale para caso SEM hora.
describe('turno do caso publicado — a hora manda quando existe', () => {
  const turnoNaPublicacao = (caso, periodo) => _turnoDoCaso({ ...caso, turno: (caso.hora && (Number(String(caso.hora).slice(0, 2)) < 13 ? 'matutino' : 'vespertino')) || periodo })

  it('cirurgia das 14:30 publicada no lote da MANHÃ fica no vespertino', () => {
    expect(turnoNaPublicacao({ hora: '14:30' }, 'matutino')).toBe('vespertino')
  })
  it('cirurgia das 07:30 publicada no lote da TARDE fica no matutino', () => {
    expect(turnoNaPublicacao({ hora: '07:30' }, 'vespertino')).toBe('matutino')
  })
  it('bloco SEM hora segue o turno publicado (é o que segura o SRPA)', () => {
    expect(turnoNaPublicacao({ hora: '' }, 'matutino')).toBe('matutino')
    expect(turnoNaPublicacao({ hora: '' }, 'vespertino')).toBe('vespertino')
  })
})
