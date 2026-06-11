/**
 * Tests for src/utils/audit.js
 *
 * Guards the audit-trail contract (.claude/rules/audit-trail.md):
 * changedBy SEMPRE é um Firebase UID real — nunca 'admin'/'system'/'sistema'.
 * requireUserId é a barreira em toda mutation boundary; estes testes travam
 * o comportamento de rejeição dos literais proibidos e das ausências de UID.
 */
import { describe, it, expect } from 'vitest'
import { requireUserId, tryRequireUserId, MissingUserIdError } from '../../utils/audit'

describe('audit.requireUserId — happy path', () => {
  it('returns normalized object for a valid Firebase UID', () => {
    const result = requireUserId({
      userId: 'abc123XYZfirebaseUID',
      userName: 'Guilherme',
      userEmail: 'g@anest.com.br',
    })
    expect(result).toEqual({
      userId: 'abc123XYZfirebaseUID',
      userName: 'Guilherme',
      userEmail: 'g@anest.com.br',
    })
  })

  it('accepts uid as alias for userId', () => {
    const result = requireUserId({ uid: 'uid-via-alias' })
    expect(result.userId).toBe('uid-via-alias')
  })

  it('prefers userId over uid when both are present', () => {
    const result = requireUserId({ userId: 'primary', uid: 'alias' })
    expect(result.userId).toBe('primary')
  })

  it('accepts displayName as alias for userName', () => {
    const result = requireUserId({ uid: 'u1', displayName: 'Dra. Ana' })
    expect(result.userName).toBe('Dra. Ana')
  })

  it('accepts email as alias for userEmail', () => {
    const result = requireUserId({ uid: 'u1', email: 'ana@hospital.com' })
    expect(result.userEmail).toBe('ana@hospital.com')
  })

  it('defaults userName to "Usuário" and userEmail to null when absent', () => {
    const result = requireUserId({ userId: 'u1' })
    expect(result.userName).toBe('Usuário')
    expect(result.userEmail).toBeNull()
  })
})

describe('audit.requireUserId — missing userId', () => {
  it('throws MissingUserIdError when userInfo is undefined', () => {
    expect(() => requireUserId(undefined)).toThrow(MissingUserIdError)
  })

  it('throws MissingUserIdError when userInfo is null', () => {
    expect(() => requireUserId(null)).toThrow(MissingUserIdError)
  })

  it('throws MissingUserIdError for empty object', () => {
    expect(() => requireUserId({})).toThrow(MissingUserIdError)
  })

  it('throws MissingUserIdError when userId is null', () => {
    expect(() => requireUserId({ userId: null })).toThrow(MissingUserIdError)
  })

  it('throws MissingUserIdError when userId is empty string', () => {
    expect(() => requireUserId({ userId: '' })).toThrow(MissingUserIdError)
  })

  it('throws even when userName/userEmail are present but userId is missing', () => {
    expect(() =>
      requireUserId({ userName: 'Fulano', userEmail: 'f@x.com' })
    ).toThrow(MissingUserIdError)
  })
})

describe('audit.requireUserId — forbidden literals', () => {
  it.each(['admin', 'system', 'sistema'])(
    'rejects forbidden literal "%s"',
    (literal) => {
      expect(() => requireUserId({ userId: literal })).toThrow(MissingUserIdError)
    }
  )

  it.each(['admin', 'system', 'sistema'])(
    'rejects forbidden literal "%s" via uid alias',
    (literal) => {
      expect(() => requireUserId({ uid: literal })).toThrow(MissingUserIdError)
    }
  )

  it('includes the forbidden literal in the error message', () => {
    expect(() => requireUserId({ userId: 'admin' }, 'docService')).toThrow(
      /forbidden literal "admin"/
    )
  })

  // Comportamento ATUAL: a checagem é case-sensitive. O JSDoc do módulo cita
  // 'Sistema' (capitalizado) como literal legado, mas o código só rejeita
  // minúsculas. Travamos o comportamento atual — ver relatório.
  it('does NOT reject capitalized variants (current case-sensitive behavior)', () => {
    expect(requireUserId({ userId: 'Sistema' }).userId).toBe('Sistema')
    expect(requireUserId({ userId: 'Admin' }).userId).toBe('Admin')
  })
})

describe('audit.requireUserId — error message and context', () => {
  it('uses default context "mutation" in the message', () => {
    expect(() => requireUserId({})).toThrow(/^\[mutation\]/)
  })

  it('includes custom context in the message', () => {
    expect(() => requireUserId(null, 'comunicados.publish')).toThrow(
      /^\[comunicados\.publish\]/
    )
  })

  it('mentions the audit-trail rule in the message', () => {
    expect(() => requireUserId({})).toThrow(/audit-trail\.md/)
  })

  it('error has the right name and is an Error instance', () => {
    try {
      requireUserId({})
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(MissingUserIdError)
      expect(err.name).toBe('MissingUserIdError')
    }
  })
})

describe('audit.tryRequireUserId', () => {
  it('returns the normalized object on success', () => {
    const result = tryRequireUserId({ userId: 'u1', userName: 'Ana' })
    expect(result).toEqual({ userId: 'u1', userName: 'Ana', userEmail: null })
  })

  it('returns null instead of throwing when userId is missing', () => {
    expect(tryRequireUserId(null)).toBeNull()
    expect(tryRequireUserId(undefined)).toBeNull()
    expect(tryRequireUserId({})).toBeNull()
    expect(tryRequireUserId({ userId: '' })).toBeNull()
  })

  it('returns null for forbidden literals', () => {
    expect(tryRequireUserId({ userId: 'admin' })).toBeNull()
    expect(tryRequireUserId({ userId: 'system' })).toBeNull()
    expect(tryRequireUserId({ userId: 'sistema' })).toBeNull()
  })
})
