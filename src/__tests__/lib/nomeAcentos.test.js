import { describe, it, expect } from 'vitest'
import { acentuarNome } from '@/lib/nomeAcentos'
import { nomeCirurgiaoCurto, titleCaseNome, primeiroNome } from '@/lib/colunaLiberacao'

describe('acentuarNome — acento só na tela (dono 27/09)', () => {
  it('acentua mantendo a caixa de cada palavra', () => {
    expect(acentuarNome('Joao Henrique Salvao Vanni')).toBe('João Henrique Salvão Vanni')
    expect(acentuarNome('MAURICIO MAHALEM BASTOS')).toBe('MAURÍCIO MAHALEM BASTOS')
    expect(acentuarNome('romulo')).toBe('rômulo')
  })
  it('nome de grafia dupla ou fora do dicionário fica como veio — nunca adivinhar', () => {
    expect(acentuarNome('Thayna Santos')).toBe('Thayna Santos')
    expect(acentuarNome('Luis Nathalia Andreia')).toBe('Luis Nathalia Andreia')
    expect(acentuarNome('Janaína')).toBe('Janaína')
    expect(acentuarNome(null)).toBe(null)
  })
  it('as funções de nome da escala já saem acentuadas', () => {
    expect(nomeCirurgiaoCurto('MARILIO JOSE FLACH')).toBe('Marílio Flach')
    expect(titleCaseNome('JOAO RICARDO')).toBe('João Ricardo')
    expect(primeiroNome('MAURICIO BASTOS')).toBe('Maurício')
  })
})
