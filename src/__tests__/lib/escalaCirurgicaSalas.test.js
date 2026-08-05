import { describe, expect, it } from 'vitest'
import { normalizarSalaHro, salasDoHospital } from '@/pages/escala-cirurgica/utils'

describe('salas HRO na conferência', () => {
  it('normaliza blocos e locais especiais sem perder a sala', () => {
    expect(normalizarSalaHro('BLOCO A 2')).toBe('Bloco A - Sala 2')
    expect(normalizarSalaHro('BLOCO M 3')).toBe('Bloco M - Sala 3')
    expect(normalizarSalaHro('IOSC')).toBe('IOSC')
    expect(normalizarSalaHro('HO')).toBe('Hospital de Olhos')
  })

  it('oferece todas as salas HRO em ordem operacional e mantém as salas em uso', () => {
    const salas = salasDoHospital('hro', [{ sala: 'Bloco M - Sala 3' }, { sala: 'IOSC' }])
    expect(salas.indexOf('Sala 1')).toBeLessThan(salas.indexOf('Bloco M - Sala 3'))
    expect(salas.indexOf('Bloco M - Sala 3')).toBeLessThan(salas.indexOf('IOSC'))
    expect(salas).toContain('Hospital de Olhos')
    expect(salas).toContain('Bloco A - Sala 2')
  })
})
