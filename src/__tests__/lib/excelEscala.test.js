import { describe, it, expect } from 'vitest'
import { iniciais } from '../../lib/excelEscala'
import { normApelido, buildResolver } from '../../services/supabaseEscalaAnestesistaService'

describe('excelEscala.iniciais — LGPD (paciente só iniciais)', () => {
  it('reduz nome a iniciais, ignorando partículas', () => {
    expect(iniciais('Cleidiani de Souza Gelda Drabach')).toBe('C.S.G.D.')
    expect(iniciais('Karoline Matiello')).toBe('K.M.')
    expect(iniciais('')).toBe('')
  })
  it('limita a 4 iniciais', () => {
    expect(iniciais('Ana Beatriz Carolina Daniela Eduarda Fabiana')).toBe('A.B.C.D.')
  })
})

describe('normApelido — chave do dicionário (acento/caixa/PED-insensível)', () => {
  it('normaliza apelidos de escala', () => {
    expect(normApelido('Garim')).toBe('GARIM')
    expect(normApelido('PED EDUARDO')).toBe('EDUARDO') // PED some → mesmo login que EDUARDO
    expect(normApelido('  joão  ')).toBe('JOAO')
  })
})

describe('buildResolver — apelido → login', () => {
  const resolver = buildResolver([
    { apelido: 'GARIM', userId: 'u-garim' },
    { apelido: 'EDUARDO', userId: 'u-edu' },
  ])
  it('resolve apelido exato e variações (PED/acento/caixa)', () => {
    expect(resolver('garim')).toBe('u-garim')
    expect(resolver('PED EDUARDO')).toBe('u-edu')
    expect(resolver('Eduardo')).toBe('u-edu')
  })
  it('apelido desconhecido → null', () => {
    expect(resolver('FULANO')).toBeNull()
  })
})
