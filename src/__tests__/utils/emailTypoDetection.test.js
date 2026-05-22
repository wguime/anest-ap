/**
 * Tests for src/utils/emailTypoDetection.js
 *
 * Cobre os dois exports:
 *   - levenshtein(a, b): distância clássica, O(m*n)
 *   - detectEmailTypo(email, existingEmails): validação + sugestão de typo
 *
 * Incidente que motivou o módulo (2026-05-21 — caso Erlei): admin digitou
 * "clinicacastelo" em vez de "clinicastelo" e criou um orphan account. Os
 * testes incluem esse caso real (distance = 2 no domain).
 */
import { describe, it, expect } from 'vitest'
import { levenshtein, detectEmailTypo } from '../../utils/emailTypoDetection'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
    expect(levenshtein('', '')).toBe(0)
    expect(levenshtein('clinicastelo', 'clinicastelo')).toBe(0)
  })

  it('returns length of the other string when one is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('hello', '')).toBe(5)
  })

  it('counts a single substitution as distance 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
    expect(levenshtein('abc', 'abd')).toBe(1)
  })

  it('counts a single insertion as distance 1', () => {
    expect(levenshtein('cat', 'cats')).toBe(1)
    expect(levenshtein('abc', 'aXbc')).toBe(1)
  })

  it('counts a single deletion as distance 1', () => {
    expect(levenshtein('cats', 'cat')).toBe(1)
    expect(levenshtein('aXbc', 'abc')).toBe(1)
  })

  it('returns 2 for the real Erlei case (clinicastelo vs clinicacastelo)', () => {
    // Inserção de 2 chars ("ca") entre "clinica" e "stelo".
    expect(levenshtein('clinicastelo', 'clinicacastelo')).toBe(2)
    // Simétrico (a função deve ser comutativa).
    expect(levenshtein('clinicacastelo', 'clinicastelo')).toBe(2)
  })

  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'))
    expect(levenshtein('sunday', 'saturday')).toBe(levenshtein('saturday', 'sunday'))
  })

  it('matches known textbook distances', () => {
    // Wikipedia canonical examples.
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('sunday', 'saturday')).toBe(3)
  })
})

describe('detectEmailTypo — validation', () => {
  it('rejects empty email with "Email obrigatório"', () => {
    expect(detectEmailTypo('')).toEqual({ valid: false, error: 'Email obrigatório' })
    expect(detectEmailTypo(null)).toEqual({ valid: false, error: 'Email obrigatório' })
    expect(detectEmailTypo(undefined)).toEqual({ valid: false, error: 'Email obrigatório' })
    expect(detectEmailTypo('   ')).toEqual({ valid: false, error: 'Email obrigatório' })
  })

  it('rejects malformed email (no @) with "Formato de email inválido"', () => {
    expect(detectEmailTypo('nao-tem-arroba')).toEqual({
      valid: false,
      error: 'Formato de email inválido',
    })
  })

  it('rejects email missing TLD or domain parts', () => {
    expect(detectEmailTypo('foo@bar').valid).toBe(false)
    expect(detectEmailTypo('foo@').valid).toBe(false)
    expect(detectEmailTypo('@bar.com').valid).toBe(false)
  })

  it('accepts a valid email when existing list is empty', () => {
    expect(detectEmailTypo('novo@clinicastelo.com.br', [])).toEqual({ valid: true })
  })

  it('never suggests anything when existingEmails is []', () => {
    const result = detectEmailTypo('qualquer@dominio.com', [])
    expect(result.valid).toBe(true)
    expect(result.suggestion).toBeUndefined()
    expect(result.suggestionType).toBeUndefined()
  })

  it('treats existingEmails default ([]) the same as explicit []', () => {
    expect(detectEmailTypo('foo@bar.com.br')).toEqual({ valid: true })
  })
})

describe('detectEmailTypo — exact duplicate', () => {
  it('flags an exact duplicate (case-insensitive)', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    expect(detectEmailTypo('erlei@clinicastelo.com.br', existing)).toEqual({
      valid: false,
      error: 'Email já está autorizado',
    })
    expect(detectEmailTypo('ERLEI@ClinicaStelo.com.br', existing)).toEqual({
      valid: false,
      error: 'Email já está autorizado',
    })
  })

  it('trims whitespace before comparing', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    expect(detectEmailTypo('  erlei@clinicastelo.com.br  ', existing).error).toBe(
      'Email já está autorizado',
    )
  })
})

describe('detectEmailTypo — domain typo (suggestionType: "domain")', () => {
  it('suggests the correct domain when 1-char away (real Erlei case)', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    const result = detectEmailTypo('novo@clinicacastelo.com.br', existing)
    expect(result).toEqual({
      valid: true,
      suggestion: 'novo@clinicastelo.com.br',
      suggestionType: 'domain',
    })
  })

  it('suggests when domain has a single substitution', () => {
    const existing = [{ email: 'admin@clinicastelo.com.br' }]
    const result = detectEmailTypo('user@clinicastelo.com.bc', existing)
    expect(result.valid).toBe(true)
    expect(result.suggestionType).toBe('domain')
    expect(result.suggestion).toBe('user@clinicastelo.com.br')
  })

  it('preserves the local-part of the new email in the suggestion', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    const result = detectEmailTypo('outropaciente@clinicacastelo.com.br', existing)
    expect(result.suggestion).toBe('outropaciente@clinicastelo.com.br')
    expect(result.suggestionType).toBe('domain')
  })
})

describe('detectEmailTypo — full-email typo (suggestionType: "full")', () => {
  it('suggests the closest full email when only 1 char differs in local-part', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    const result = detectEmailTypo('erleii@clinicastelo.com.br', existing)
    expect(result).toEqual({
      valid: true,
      suggestion: 'erlei@clinicastelo.com.br',
      suggestionType: 'full',
    })
  })

  it('suggests for 2-char typo in the full email', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    const result = detectEmailTypo('erleix@clinicastelo.com.bx', existing)
    expect(result.valid).toBe(true)
    expect(result.suggestionType).toBe('full')
    expect(result.suggestion).toBe('erlei@clinicastelo.com.br')
  })
})

describe('detectEmailTypo — legitimate distinct emails', () => {
  it('does not suggest anything for a completely different domain', () => {
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    const result = detectEmailTypo('novo@hospitalsaolucas.com.br', existing)
    expect(result).toEqual({ valid: true })
  })

  it('does not suggest when local-part is very different on same-ish domain (>2 dist on full)', () => {
    // Domain idêntico, local-part totalmente diferente: NÃO deve sugerir,
    // pois é caso legítimo de novo usuário na mesma clínica.
    const existing = [{ email: 'erlei@clinicastelo.com.br' }]
    const result = detectEmailTypo('mariadasdores@clinicastelo.com.br', existing)
    expect(result.valid).toBe(true)
    expect(result.suggestion).toBeUndefined()
    expect(result.suggestionType).toBeUndefined()
  })

  it('skips entries with empty/invalid emails in existingEmails without throwing', () => {
    const existing = [
      { email: '' },
      { email: null },
      { email: 'sem-arroba' },
      { email: 'erlei@clinicastelo.com.br' },
    ]
    const result = detectEmailTypo('novo@clinicacastelo.com.br', existing)
    expect(result.suggestionType).toBe('domain')
    expect(result.suggestion).toBe('novo@clinicastelo.com.br')
  })
})
