import { describe, it, expect } from 'vitest'
import { deParaLugar } from '@/pages/escala-cirurgica/utils'

// Selo de ajuda = "Ajuda"; o sentido vai por extenso, com a concordância do lugar
// (dono 11/11: "cuide a concordância — do HRO, do Materno, da Unimed").
describe('deParaLugar', () => {
  it.each([
    ['HRO', 'Unimed', 'Do HRO para a Unimed'],
    ['Unimed', 'HRO', 'Da Unimed para o HRO'],
    ['Materno', 'Unimed', 'Do Materno para a Unimed'],
    ['Unimed', 'Materno', 'Da Unimed para o Materno'],
    ['HRO', 'Materno', 'Do HRO para o Materno'],
    ['Unimed', 'Consultório', 'Da Unimed para o Consultório'],
    ['HRO', 'Consultório', 'Do HRO para o Consultório'],
  ])('%s → %s', (de, para, esperado) => {
    expect(deParaLugar(de, para)).toBe(esperado)
  })

  it('sem um dos lados ou com os dois iguais, não há trajeto', () => {
    expect(deParaLugar('', 'HRO')).toBeNull()
    expect(deParaLugar('HRO', null)).toBeNull()
    expect(deParaLugar('HRO', 'hro')).toBeNull()
  })
})
