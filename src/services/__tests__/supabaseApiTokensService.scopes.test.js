/**
 * Sprint 16 — supabaseApiTokensService scopes granular
 *
 * Asserts:
 *   1. validateScopes aceita cada scope conhecido isoladamente.
 *   2. validateScopes aceita os 3 scopes juntos (≡ legacy 'read').
 *   3. validateScopes rejeita scope desconhecido (e.g. 'write:docs').
 *   4. validateScopes rejeita non-array (string, object, null, undefined).
 *   5. validateScopes rejeita array vazio.
 *   6. VALID_SCOPES é exatamente os 3 scopes documentados, e congelado.
 *
 * Mock do client Supabase é minimal — validateScopes não toca DB, mas o
 * import do service force-load `@/config/supabase`, então mockamos por
 * paridade com os outros testes do projeto.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => ({ is: vi.fn() })) })),
      insert: vi.fn(() => ({ select: vi.fn() })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
        })),
      })),
    })),
  },
  getSupabaseToken: vi.fn(async () => 'mock-jwt'),
}))

import { validateScopes, VALID_SCOPES } from '../supabaseApiTokensService'

describe('VALID_SCOPES', () => {
  it('contém os 6 scopes documentados (3 read + 3 write, Sprint 19)', () => {
    expect([...VALID_SCOPES].sort()).toEqual(
      [
        'read:comunicados', 'read:docs', 'read:planos-acao',
        'write:comunicados', 'write:docs', 'write:planos-acao',
      ].sort()
    )
  })

  it('é congelado (Object.freeze)', () => {
    expect(Object.isFrozen(VALID_SCOPES)).toBe(true)
  })
})

describe('validateScopes — aceita scopes válidos', () => {
  it.each([
    ['read:docs'],
    ['read:planos-acao'],
    ['read:comunicados'],
    // Sprint 19 — write scopes
    ['write:docs'],
    ['write:planos-acao'],
    ['write:comunicados'],
  ])('aceita scope isolado: %s', (scope) => {
    expect(() => validateScopes([scope])).not.toThrow()
    expect(validateScopes([scope])).toEqual([scope])
  })

  it('aceita os 3 scopes read juntos (≡ legacy read)', () => {
    const all = ['read:docs', 'read:planos-acao', 'read:comunicados']
    expect(() => validateScopes(all)).not.toThrow()
    expect(validateScopes(all)).toEqual(all)
  })

  it('aceita os 6 scopes juntos (full access — Sprint 19)', () => {
    const all = [
      'read:docs', 'read:planos-acao', 'read:comunicados',
      'write:docs', 'write:planos-acao', 'write:comunicados',
    ]
    expect(() => validateScopes(all)).not.toThrow()
    expect(validateScopes(all)).toEqual(all)
  })

  it('aceita 2 scopes (subset arbitrário)', () => {
    const subset = ['read:docs', 'read:comunicados']
    expect(() => validateScopes(subset)).not.toThrow()
  })

  it('aceita mix read+write (Sprint 19)', () => {
    const mix = ['read:docs', 'write:docs']
    expect(() => validateScopes(mix)).not.toThrow()
  })
})

describe('validateScopes — rejeita inválidos', () => {
  it('rejeita scope desconhecido', () => {
    // Sprint 19 — write:docs agora é válido. Continua rejeitando legacy/unknown.
    expect(() => validateScopes(['admin'])).toThrow(/scope desconhecido/i)
    expect(() => validateScopes(['read'])).toThrow(/scope desconhecido/i)
    expect(() => validateScopes(['write:lixo'])).toThrow(/scope desconhecido/i)
  })

  it('rejeita mistura de scope válido + inválido', () => {
    expect(() => validateScopes(['read:docs', 'lixo'])).toThrow(
      /scope desconhecido/i
    )
  })

  it('rejeita non-array — string', () => {
    expect(() => validateScopes('read:docs')).toThrow(/deve ser um array/i)
  })

  it('rejeita non-array — object', () => {
    expect(() => validateScopes({ scope: 'read:docs' })).toThrow(
      /deve ser um array/i
    )
  })

  it('rejeita non-array — null', () => {
    expect(() => validateScopes(null)).toThrow(/deve ser um array/i)
  })

  it('rejeita non-array — undefined', () => {
    expect(() => validateScopes(undefined)).toThrow(/deve ser um array/i)
  })

  it('rejeita array vazio', () => {
    expect(() => validateScopes([])).toThrow(/não pode ser vazio/i)
  })

  it('rejeita array com elementos não-string', () => {
    expect(() => validateScopes([123])).toThrow(/scope desconhecido/i)
    expect(() => validateScopes([null])).toThrow(/scope desconhecido/i)
  })
})
