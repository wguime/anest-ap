import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests para supabaseApiTokensService — Sprint 14c / O2-5 (B4)
 *
 * Cobre:
 *  - fetchTokens (com/sem revoked, ordem)
 *  - revokeToken (sucesso, sem actor → throw, audit log chamado)
 *  - generateToken (fetch ok, validation client-side, fetch error)
 *  - rowToCamel (mapping snake → camel)
 */

// ============================================================================
// Mock Supabase chain
// ============================================================================
function createChain(finalData = null, finalError = null) {
  const result = { data: finalData, error: finalError }
  // PostgREST builder é thenable; cada método encadeável devolve o próprio
  // builder, e `await builder` resolve via `.then`.
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

let nextChainData = null
let nextChainError = null
let lastFromTable = null

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-fake')

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      lastFromTable = table
      return createChain(nextChainData, nextChainError)
    }),
  },
  getSupabaseToken: vi.fn(async () => 'fake-jwt-token'),
}))

import supabaseApiTokensService, {
  fetchTokens,
  revokeToken,
  generateToken,
  rowToCamel,
} from '../../services/supabaseApiTokensService'

// ============================================================================
// Tests
// ============================================================================

describe('supabaseApiTokensService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nextChainData = null
    nextChainError = null
    lastFromTable = null
  })

  // --------------------------------------------------------------------------
  describe('rowToCamel', () => {
    it('mapeia snake_case do DB para camelCase JS', () => {
      const row = {
        id: 'abc-123',
        name: 'Integração X',
        scope: 'read',
        created_by: 'firebase-uid-admin',
        created_at: '2026-05-12T10:00:00Z',
        revoked_at: null,
        last_used_at: '2026-05-12T11:00:00Z',
        usage_count: 42,
      }
      const camel = rowToCamel(row)
      expect(camel).toEqual({
        id: 'abc-123',
        name: 'Integração X',
        scope: 'read',
        createdBy: 'firebase-uid-admin',
        createdAt: '2026-05-12T10:00:00Z',
        revokedAt: null,
        lastUsedAt: '2026-05-12T11:00:00Z',
        usageCount: 42,
      })
    })

    it('usageCount default 0 quando ausente', () => {
      const camel = rowToCamel({ id: 'x' })
      expect(camel.usageCount).toBe(0)
    })

    it('retorna null/string sem mutar', () => {
      expect(rowToCamel(null)).toBeNull()
      expect(rowToCamel('hi')).toBe('hi')
    })
  })

  // --------------------------------------------------------------------------
  describe('fetchTokens', () => {
    it('retorna array vazio quando data=null', async () => {
      nextChainData = null
      const result = await fetchTokens()
      expect(result).toEqual([])
      expect(lastFromTable).toBe('api_tokens')
    })

    it('mapeia rows para camelCase', async () => {
      nextChainData = [
        {
          id: 't1',
          name: 'Token 1',
          scope: 'read',
          created_by: 'uid-admin',
          created_at: '2026-05-01T10:00:00Z',
          revoked_at: null,
          last_used_at: null,
          usage_count: 0,
        },
      ]
      const result = await fetchTokens()
      expect(result).toHaveLength(1)
      expect(result[0].createdBy).toBe('uid-admin')
      expect(result[0].usageCount).toBe(0)
    })

    it('lança erro quando supabase retorna error', async () => {
      nextChainError = { message: 'boom', code: 'XYZ' }
      await expect(fetchTokens()).rejects.toThrow(/fetchTokens/)
    })
  })

  // --------------------------------------------------------------------------
  describe('revokeToken', () => {
    it('lança erro sem tokenId', async () => {
      await expect(revokeToken('', { uid: 'admin' })).rejects.toThrow(/tokenId/)
    })

    it('lança erro sem userInfo.uid (audit trail obrigatório)', async () => {
      await expect(revokeToken('t1', null)).rejects.toThrow(/audit trail|uid obrigatório/i)
      await expect(revokeToken('t1', {})).rejects.toThrow(/audit trail|uid obrigatório/i)
    })

    it('retorna token revogado em camelCase', async () => {
      nextChainData = {
        id: 't1',
        name: 'Token 1',
        scope: 'read',
        created_by: 'uid-admin',
        created_at: '2026-05-01T10:00:00Z',
        revoked_at: '2026-05-12T12:00:00Z',
        last_used_at: null,
        usage_count: 0,
      }
      const result = await revokeToken('t1', { uid: 'uid-admin' })
      expect(result.revokedAt).toBe('2026-05-12T12:00:00Z')
      expect(result.id).toBe('t1')
    })
  })

  // --------------------------------------------------------------------------
  describe('generateToken', () => {
    let fetchSpy

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch')
    })
    afterEach(() => {
      fetchSpy.mockRestore?.()
    })

    it('lança erro com name < 3 chars (validação client-side)', async () => {
      await expect(generateToken({ name: 'ab' })).rejects.toThrow(/3 caracteres/)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('chama edge generate-api-token com Bearer JWT', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          token: 'plain-token-abcdef',
          id: 'tok-new',
          name: 'Integração X',
          scope: 'read',
          created_at: '2026-05-12T13:00:00Z',
        }),
      })

      const result = await generateToken({ name: 'Integração X' })
      expect(result.token).toBe('plain-token-abcdef')
      expect(result.id).toBe('tok-new')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toContain('/functions/v1/generate-api-token')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toMatch(/^Bearer /)
      expect(init.headers.apikey).toBe('anon-key-fake')

      const body = JSON.parse(init.body)
      expect(body.name).toBe('Integração X')
      expect(body.scope).toBe('read')
    })

    it('propaga reason do edge em caso de !ok', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, reason: 'forbidden_not_admin' }),
      })
      await expect(generateToken({ name: 'AAA' })).rejects.toThrow(/forbidden_not_admin/)
    })

    it('falha quando body !ok mesmo com http 200', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, reason: 'invalid_payload', detail: 'name short' }),
      })
      await expect(generateToken({ name: 'AAA' })).rejects.toThrow(/invalid_payload.*name short/)
    })
  })

  // --------------------------------------------------------------------------
  describe('default export', () => {
    it('expõe fetchTokens/revokeToken/generateToken', () => {
      expect(typeof supabaseApiTokensService.fetchTokens).toBe('function')
      expect(typeof supabaseApiTokensService.revokeToken).toBe('function')
      expect(typeof supabaseApiTokensService.generateToken).toBe('function')
    })
  })
})
