import { describe, expect, it } from 'vitest'
import { detectarDuplicidadesEscala } from '@/lib/escalaCirurgicaDuplicidades'

const resolver = (nome) => ({ 'Alexandre D': 'u-alex', Vicente: 'u-vicente' }[nome] || null)

describe('detectarDuplicidadesEscala', () => {
  it('identifica a pessoa nos dois hospitais e detalha os casos', () => {
    const result = detectarDuplicidadesEscala({
      hospitalAtual: 'hro', hospitalAtualLabel: 'HRO', periodo: 'matutino', resolver,
      casos: [{ anestesista: 'Alexandre D', anestesistaUserId: 'u-alex', sala: 'Sala 1', hora: '07:00', procedimento: 'Cirurgia A' }],
      ordemAtual: ['Alexandre D'],
      outrasEscalas: [{ hospital: 'unimed', ordemLiberacao: ['Alexandre D'], casos: [{ anestesista: 'Alexandre D', anestesistaUserId: 'u-alex', sala: 'Sala 2', hora: '08:00', procedimento: 'Cirurgia B' }] }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].nome).toBe('Alexandre D')
    expect(result[0].ocorrencias.map((o) => o.hospital)).toEqual(['hro', 'unimed'])
    expect(result[0].ocorrencias[1].casos[0]).toMatchObject({ sala: 'Sala 2', hora: '08:00' })
  })

  it('também alerta quando a outra escala só tem a pessoa no rodapé', () => {
    const result = detectarDuplicidadesEscala({
      hospitalAtual: 'materno', hospitalAtualLabel: 'Materno', periodo: 'vespertino', resolver,
      casos: [{ anestesista: 'Vicente', sala: 'Sala 1', hora: '13:00' }],
      outrasEscalas: [{ hospital: 'hro', ordemLiberacao: { vespertino: ['Vicente'] }, casos: [] }],
    })
    expect(result[0].ocorrencias[1]).toMatchObject({ noRodape: true, casos: [] })
  })

  it('não mistura turnos diferentes', () => {
    const result = detectarDuplicidadesEscala({
      hospitalAtual: 'hro', hospitalAtualLabel: 'HRO', periodo: 'matutino', resolver,
      casos: [{ anestesista: 'Alexandre D', turno: 'matutino' }],
      outrasEscalas: [{ hospital: 'unimed', casos: [{ anestesista: 'Alexandre D', turno: 'vespertino' }] }],
    })
    expect(result).toEqual([])
  })
})
