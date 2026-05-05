/**
 * Tests for src/utils/confidentiality.js — Onda1-4
 *
 * Cobre:
 *   - Mapeamento ENUM ↔ rótulo legível
 *   - Cor de badge por nível
 *   - Comparação de clearance
 *   - Fallback para nível inválido
 */
import { describe, it, expect } from 'vitest'
import {
  CONFIDENTIALITY_LEVELS,
  CONFIDENTIALITY_OPTIONS,
  getConfidentialityColor,
  getConfidentialityLabel,
  canAccessConfidentiality,
} from '../../utils/confidentiality'

describe('confidentiality — níveis', () => {
  it('expõe os 4 níveis em ordem crescente de sigilo', () => {
    expect(CONFIDENTIALITY_LEVELS).toEqual([
      'publico',
      'interno',
      'restrito',
      'sigiloso',
    ])
  })

  it('CONFIDENTIALITY_OPTIONS tem label pt-BR para cada valor', () => {
    expect(CONFIDENTIALITY_OPTIONS).toEqual([
      { value: 'publico', label: 'Público' },
      { value: 'interno', label: 'Interno' },
      { value: 'restrito', label: 'Restrito' },
      { value: 'sigiloso', label: 'Sigiloso' },
    ])
  })
})

describe('getConfidentialityColor', () => {
  it('mapeia cada nível para a variant DS correta', () => {
    expect(getConfidentialityColor('publico')).toBe('success')
    expect(getConfidentialityColor('interno')).toBe('info')
    expect(getConfidentialityColor('restrito')).toBe('warning')
    expect(getConfidentialityColor('sigiloso')).toBe('destructive')
  })

  it('faz fallback para "info" (interno) em valor inválido', () => {
    expect(getConfidentialityColor('invalido')).toBe('info')
    expect(getConfidentialityColor(undefined)).toBe('info')
    expect(getConfidentialityColor(null)).toBe('info')
  })
})

describe('getConfidentialityLabel', () => {
  it('retorna o rótulo pt-BR', () => {
    expect(getConfidentialityLabel('publico')).toBe('Público')
    expect(getConfidentialityLabel('sigiloso')).toBe('Sigiloso')
  })

  it('faz fallback para "Interno" em valor inválido', () => {
    expect(getConfidentialityLabel('foo')).toBe('Interno')
  })
})

describe('canAccessConfidentiality', () => {
  it('permite quando clearance é igual ao nível do doc', () => {
    expect(canAccessConfidentiality('restrito', 'restrito')).toBe(true)
  })

  it('permite quando clearance é maior que o nível do doc', () => {
    expect(canAccessConfidentiality('sigiloso', 'restrito')).toBe(true)
    expect(canAccessConfidentiality('interno', 'publico')).toBe(true)
  })

  it('bloqueia quando clearance é menor que o nível do doc', () => {
    expect(canAccessConfidentiality('publico', 'interno')).toBe(false)
    expect(canAccessConfidentiality('interno', 'sigiloso')).toBe(false)
  })

  it('trata níveis inválidos como "interno" (default)', () => {
    // user inválido → tratado como interno (1) ; doc publico (0) → permite
    expect(canAccessConfidentiality(undefined, 'publico')).toBe(true)
    // doc inválido → tratado como interno (1) ; user publico (0) → bloqueia
    expect(canAccessConfidentiality('publico', undefined)).toBe(false)
  })
})
