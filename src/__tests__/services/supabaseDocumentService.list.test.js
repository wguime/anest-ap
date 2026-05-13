/**
 * supabaseDocumentService — Listing + Storage + Real-time tests (Sprint 20 Stream 1.1)
 *
 * Cobre:
 *  - fetchVersions / fetchChangelog (admin vs view pública) / fetchRecentActivity
 *  - search via RPC com filtros opcionais
 *  - fetchComplianceMetrics — fallback quando sem documentos
 *  - getSignedUrl + deleteFile (storage paths)
 *  - subscribeToAll → channel + on + subscribe
 *  - unsubscribe → removeChannel
 *  - addVersion via RPC com snake_case + fallback wrapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    single: { data: null, error: null },
    select: { data: [], error: null },
    rpcResult: { data: null, error: null },
    storageSignedResult: { data: { signedUrl: 'https://signed.example/x' }, error: null },
    storageRemoveResult: { data: null, error: null },
    lastTable: null,
    lastEq: [],
    lastSelectCols: null,
    rpcCalls: [],
    storageCalls: [],
    channelEvents: [],
  }

  function makeChain() {
    const chain = {
      select: vi.fn((cols) => {
        state.lastSelectCols = cols
        return chain
      }),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      eq: vi.fn((col, val) => {
        state.lastEq.push([col, val])
        return chain
      }),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(state.single)),
      then: (resolve) => Promise.resolve(state.select).then(resolve),
    }
    return chain
  }

  const fromMock = vi.fn((table) => {
    state.lastTable = table
    return makeChain()
  })

  const rpcMock = vi.fn((name, params) => {
    state.rpcCalls.push({ name, params })
    return Promise.resolve(state.rpcResult)
  })

  // Storage mock
  const storageFromMock = vi.fn((bucket) => ({
    createSignedUrl: vi.fn((path, expires) => {
      state.storageCalls.push({ op: 'sign', bucket, path, expires })
      return Promise.resolve(state.storageSignedResult)
    }),
    remove: vi.fn((paths) => {
      state.storageCalls.push({ op: 'remove', bucket, paths })
      return Promise.resolve(state.storageRemoveResult)
    }),
  }))

  // Channel mock
  function makeChannel() {
    const ch = {
      on: vi.fn((event, opts, cb) => {
        state.channelEvents.push({ event, opts, cb })
        return ch
      }),
      subscribe: vi.fn(() => ch),
      unsubscribe: vi.fn(() => Promise.resolve('ok')),
    }
    return ch
  }
  const channelMock = vi.fn(() => makeChannel())
  const removeChannelMock = vi.fn()

  return { state, fromMock, rpcMock, storageFromMock, channelMock, removeChannelMock }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
    storage: { from: mocks.storageFromMock },
    channel: mocks.channelMock,
    removeChannel: mocks.removeChannelMock,
  },
}))

vi.mock('@/utils/featureFlags', () => ({
  isOcrEnabled: () => false,
  isBulkImportEnabled: () => false,
  isPdfaEnabled: () => false,
  isHashSignatureEnabled: () => false,
  isWatermarkEnabled: () => false,
  isRetentionEnabled: () => false,
  isConfidentialityEnabled: () => false,
  isMultiStepApprovalEnabled: () => false,
}))

vi.mock('@/utils/offlineQueue', () => ({ enqueue: vi.fn() }))
vi.mock('@/services/offlineQueueProcessor', () => ({ registerHandler: vi.fn() }))
vi.mock('@/services/conflictReplayRegistry', () => ({ registerReplayHandler: vi.fn() }))

const svcMod = await import('@/services/supabaseDocumentService')
const svc = svcMod.default

const USER = { userId: 'u-77', userName: 'Editor Test' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.single = { data: null, error: null }
  mocks.state.select = { data: [], error: null }
  mocks.state.rpcResult = { data: null, error: null }
  mocks.state.storageSignedResult = { data: { signedUrl: 'https://signed.example/x' }, error: null }
  mocks.state.storageRemoveResult = { data: null, error: null }
  mocks.state.lastTable = null
  mocks.state.lastEq = []
  mocks.state.lastSelectCols = null
  mocks.state.rpcCalls = []
  mocks.state.storageCalls = []
  mocks.state.channelEvents = []
})

describe('supabaseDocumentService — Listings & Storage', () => {
  describe('fetchVersions', () => {
    it('retorna versões em camelCase ordenadas DESC', async () => {
      mocks.state.select = {
        data: [
          { id: 'v3', documento_id: 'd1', versao: 3, arquivo_nome: 'v3.pdf' },
          { id: 'v2', documento_id: 'd1', versao: 2 },
          { id: 'v1', documento_id: 'd1', versao: 1 },
        ],
        error: null,
      }

      const result = await svc.fetchVersions('d1')

      expect(result).toHaveLength(3)
      expect(result[0].documentoId).toBe('d1')
      expect(result[0].arquivoNome).toBe('v3.pdf')
      expect(mocks.state.lastTable).toBe('documento_versoes')
    })
  })

  describe('fetchChangelog', () => {
    it('lê de vw_changelog_publico quando isAdmin=false', async () => {
      mocks.state.select = { data: [{ id: 'l1', action: 'created' }], error: null }

      await svc.fetchChangelog('d1', 50, false)

      expect(mocks.state.lastTable).toBe('vw_changelog_publico')
    })

    it('lê de documento_changelog quando isAdmin=true', async () => {
      mocks.state.select = { data: [{ id: 'l1', user_email: 'a@b.c' }], error: null }

      const result = await svc.fetchChangelog('d1', 10, true)

      expect(mocks.state.lastTable).toBe('documento_changelog')
      expect(result[0].userEmail).toBe('a@b.c')
    })
  })

  describe('fetchRecentActivity', () => {
    it('retorna últimas N atividades em camelCase', async () => {
      mocks.state.select = {
        data: [
          { id: 'l1', action: 'created', user_id: 'u-1', user_name: 'A' },
          { id: 'l2', action: 'updated', user_id: 'u-2', user_name: 'B' },
        ],
        error: null,
      }

      const result = await svc.fetchRecentActivity(2)

      expect(result).toHaveLength(2)
      expect(result[0].userId).toBe('u-1')
      expect(result[0].userName).toBe('A')
      expect(mocks.state.lastTable).toBe('documento_changelog')
    })
  })

  describe('search (RPC)', () => {
    it('chama rpc_search_documentos com filtros opcionais aplicados', async () => {
      mocks.state.rpcResult = {
        data: [{ id: 'd1', titulo: 'Achado', rank: 0.8 }],
        error: null,
      }

      const result = await svc.search('protocolo', { categoria: 'etica', status: 'ativo', limit: 25 })

      expect(result).toHaveLength(1)
      expect(result[0].titulo).toBe('Achado')
      const rpcCall = mocks.state.rpcCalls.find((c) => c.name === 'rpc_search_documentos')
      expect(rpcCall.params.search_query).toBe('protocolo')
      expect(rpcCall.params.filter_categoria).toBe('etica')
      expect(rpcCall.params.filter_status).toBe('ativo')
      expect(rpcCall.params.result_limit).toBe(25)
    })

    it('passa null para filtros omitidos + limit default 50', async () => {
      mocks.state.rpcResult = { data: [], error: null }

      await svc.search('teste')

      const rpcCall = mocks.state.rpcCalls.find((c) => c.name === 'rpc_search_documentos')
      expect(rpcCall.params.filter_categoria).toBeNull()
      expect(rpcCall.params.filter_status).toBeNull()
      expect(rpcCall.params.result_limit).toBe(50)
    })
  })

  describe('fetchComplianceMetrics', () => {
    it('retorna fallback completo quando RPC devolve score=null (no documents)', async () => {
      mocks.state.rpcResult = { data: { score: null }, error: null }

      const result = await svc.fetchComplianceMetrics()

      expect(result.score).toBe(100)
      expect(result.categories).toBeInstanceOf(Array)
      expect(result.categories.length).toBeGreaterThan(0)
      // Cada categoria tem shape esperado
      expect(result.categories[0]).toMatchObject({
        score: 100,
        total: 0,
        ativos: 0,
        vencidos: 0,
        pendentes: 0,
      })
    })

    it('retorna data quando RPC devolve métricas reais', async () => {
      const fake = { score: 87.5, categories: [{ categoria: 'etica', score: 90 }] }
      mocks.state.rpcResult = { data: fake, error: null }

      const result = await svc.fetchComplianceMetrics()

      expect(result.score).toBe(87.5)
      expect(result.categories[0].categoria).toBe('etica')
    })
  })

  describe('getSignedUrl', () => {
    it('retorna signedUrl do storage', async () => {
      const url = await svc.getSignedUrl('etica/d1/v1/file.pdf', 600)

      expect(url).toBe('https://signed.example/x')
      const call = mocks.state.storageCalls.find((c) => c.op === 'sign')
      expect(call.path).toBe('etica/d1/v1/file.pdf')
      expect(call.expires).toBe(600)
      expect(call.bucket).toBe('documentos')
    })

    it('retorna null quando data.signedUrl ausente', async () => {
      mocks.state.storageSignedResult = { data: null, error: null }

      const url = await svc.getSignedUrl('x/y.pdf')

      expect(url).toBeNull()
    })
  })

  describe('deleteFile', () => {
    it('remove path do bucket documentos', async () => {
      const result = await svc.deleteFile('etica/d1/v1/file.pdf')

      expect(result).toBe(true)
      const call = mocks.state.storageCalls.find((c) => c.op === 'remove')
      expect(call.paths).toEqual(['etica/d1/v1/file.pdf'])
      expect(call.bucket).toBe('documentos')
    })

    it('lança quando storage retorna error', async () => {
      mocks.state.storageRemoveResult = { data: null, error: { message: 'storage denied' } }
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.deleteFile('x.pdf')).rejects.toThrow(/deleteFile/)

      spy.mockRestore()
    })
  })

  describe('addVersion via RPC', () => {
    it('mapeia versionData para snake_case + retorna camelCase', async () => {
      mocks.state.rpcResult = {
        data: { id: 'v2', documento_id: 'd1', versao: 2, arquivo_nome: 'v2.pdf' },
        error: null,
      }

      const result = await svc.addVersion(
        'd1',
        { arquivoUrl: 'http://x', arquivoNome: 'v2.pdf', arquivoTamanho: 2048, storagePath: 'etica/d1/v2/v2.pdf' },
        USER
      )

      expect(result.documentoId).toBe('d1')
      expect(result.arquivoNome).toBe('v2.pdf')
      const rpcCall = mocks.state.rpcCalls.find((c) => c.name === 'rpc_add_document_version')
      expect(rpcCall.params.p_doc_id).toBe('d1')
      expect(rpcCall.params.p_version_data.arquivo_nome).toBe('v2.pdf')
      expect(rpcCall.params.p_user_info.user_id).toBe('u-77')
    })

    it('unwrap data.version quando RPC retorna wrapper', async () => {
      mocks.state.rpcResult = {
        data: { version: { id: 'v3', versao: 3 } },
        error: null,
      }

      const result = await svc.addVersion('d1', { arquivoNome: 'x.pdf' }, USER)

      expect(result.id).toBe('v3')
      expect(result.versao).toBe(3)
    })
  })

  describe('subscribeToAll / unsubscribe', () => {
    it('cria channel com listener postgres_changes e subscribe', () => {
      const cb = vi.fn()

      svc.subscribeToAll(cb)

      expect(mocks.channelMock).toHaveBeenCalledWith('documentos-changes')
      expect(mocks.state.channelEvents).toHaveLength(1)
      expect(mocks.state.channelEvents[0].event).toBe('postgres_changes')
      expect(mocks.state.channelEvents[0].opts.table).toBe('documentos')
    })

    it('callback é invocado com eventType + new/old em camelCase', () => {
      const cb = vi.fn()
      svc.subscribeToAll(cb)
      const handler = mocks.state.channelEvents[0].cb

      handler({
        eventType: 'INSERT',
        new: { id: 'd1', created_by: 'u-1', titulo: 'T' },
        old: null,
      })

      expect(cb).toHaveBeenCalledWith({
        eventType: 'INSERT',
        new: expect.objectContaining({ createdBy: 'u-1', titulo: 'T' }),
        old: null,
      })
    })

    it('unsubscribe chama removeChannel', () => {
      const ch = { foo: 'bar' }
      svc.unsubscribe(ch)
      expect(mocks.removeChannelMock).toHaveBeenCalledWith(ch)
    })

    it('unsubscribe não-faz nada quando channel é falsy', () => {
      svc.unsubscribe(null)
      expect(mocks.removeChannelMock).not.toHaveBeenCalled()
    })
  })
})
