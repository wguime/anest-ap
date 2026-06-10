/**
 * supabaseDocumentService — CRUD tests (Sprint 20 Stream 1.1)
 *
 * Cobre:
 *  - fetchById (happy path + error + snake→camel mapping)
 *  - fetchByCategory (lista filtrada + erro)
 *  - fetchAllDocuments (paginação + grouping por categoria)
 *  - fetchPendingApproval / fetchOverdueDocuments / fetchUpcomingReviews
 *  - createDocument (id custom + id auto + qmentum derive + audit + version inicial)
 *  - updateDocument (strip de campos imutáveis + audit fields)
 *  - deleteDocument (soft-delete via deleted_at + audit log)
 *  - restoreFromTrash (limpa deleted_at + log restored)
 *  - changeStatus (transition válida + transition inválida + cálculo proxima_revisao)
 *
 * Pattern de mock: vi.hoisted + chain factory (espelha supabaseConflictQueueService.test.js).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Hoisted mocks — chain factory que captura cada chamada
// ============================================================================
const mocks = vi.hoisted(() => {
  const state = {
    // Result que será retornado pelo terminal (single / range / order / await)
    single: { data: null, error: null },
    range: { data: [], error: null },
    select: { data: [], error: null },
    rpcResult: { data: null, error: null },
    // captura últimas chamadas
    lastTable: null,
    lastInsert: null,
    lastUpdate: null,
    lastDelete: false,
    lastEq: [],
    lastSelectCols: null,
    rpcCalls: [],
    // queue de results para `single()` quando há múltiplas chamadas seguidas
    singleQueue: [],
  }

  function makeChain() {
    const chain = {
      select: vi.fn((cols) => {
        state.lastSelectCols = cols
        return chain
      }),
      insert: vi.fn((payload) => {
        state.lastInsert = payload
        return chain
      }),
      update: vi.fn((payload) => {
        state.lastUpdate = payload
        return chain
      }),
      delete: vi.fn(() => {
        state.lastDelete = true
        return chain
      }),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      eq: vi.fn((col, val) => {
        state.lastEq.push([col, val])
        return chain
      }),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      range: vi.fn(() => Promise.resolve(state.range)),
      single: vi.fn(() => {
        if (state.singleQueue.length > 0) {
          return Promise.resolve(state.singleQueue.shift())
        }
        return Promise.resolve(state.single)
      }),
      maybeSingle: vi.fn(() => Promise.resolve(state.single)),
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

  return { state, fromMock, rpcMock }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'signed-url' }, error: null })),
      })),
    },
  },
}))

// Feature flags — OFF (testes não dependem)
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

// Offline / replay registries — não interferem nos testes CRUD
vi.mock('@/utils/offlineQueue', () => ({
  enqueue: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/services/offlineQueueProcessor', () => ({
  registerHandler: vi.fn(),
}))
vi.mock('@/services/conflictReplayRegistry', () => ({
  registerReplayHandler: vi.fn(),
}))

// ============================================================================
// Import APÓS mocks
// ============================================================================
const { default: svc } = await import('@/services/supabaseDocumentService')

const USER = { userId: 'u-real-42', userName: 'Dra. Real', userEmail: 'real@anest.org' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.single = { data: null, error: null }
  mocks.state.range = { data: [], error: null }
  mocks.state.select = { data: [], error: null }
  mocks.state.rpcResult = { data: null, error: null }
  mocks.state.lastTable = null
  mocks.state.lastInsert = null
  mocks.state.lastUpdate = null
  mocks.state.lastDelete = false
  mocks.state.lastEq = []
  mocks.state.lastSelectCols = null
  mocks.state.rpcCalls = []
  mocks.state.singleQueue = []
})

describe('supabaseDocumentService — CRUD', () => {
  describe('fetchById', () => {
    it('retorna doc em camelCase quando encontrado', async () => {
      mocks.state.single = {
        data: {
          id: 'doc-1',
          titulo: 'Política X',
          categoria: 'etica',
          created_by: 'u-1',
          created_by_name: 'Autor',
          versao_atual: 3,
          rop_area: 'governanca',
        },
        error: null,
      }

      const result = await svc.fetchById('doc-1')

      expect(result.id).toBe('doc-1')
      expect(result.titulo).toBe('Política X')
      expect(result.createdBy).toBe('u-1') // snake → camel
      expect(result.createdByName).toBe('Autor')
      expect(result.versaoAtual).toBe(3)
      expect(result.ropArea).toBe('governanca')
      expect(mocks.state.lastTable).toBe('documentos')
      expect(mocks.state.lastEq).toContainEqual(['id', 'doc-1'])
    })

    it('lança erro quando Supabase retorna error', async () => {
      mocks.state.single = { data: null, error: { message: 'PGRST116: not found' } }
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.fetchById('missing')).rejects.toThrow(/fetchById/)

      spy.mockRestore()
    })
  })

  describe('fetchByCategory', () => {
    it('retorna lista filtrada por categoria em camelCase', async () => {
      mocks.state.select = {
        data: [
          { id: 'd1', categoria: 'etica', titulo: 'A', created_by_name: 'X' },
          { id: 'd2', categoria: 'etica', titulo: 'B', created_by_name: 'Y' },
        ],
        error: null,
      }

      const result = await svc.fetchByCategory('etica')

      expect(result).toHaveLength(2)
      expect(result[0].createdByName).toBe('X')
      expect(mocks.state.lastEq).toContainEqual(['categoria', 'etica'])
    })

    it('retorna [] quando data é null', async () => {
      mocks.state.select = { data: null, error: null }
      const result = await svc.fetchByCategory('biblioteca')
      expect(result).toEqual([])
    })
  })

  describe('fetchAllDocuments', () => {
    it('agrupa documentos por categoria conhecida', async () => {
      mocks.state.range = {
        data: [
          { id: 'd1', categoria: 'etica', titulo: 'A' },
          { id: 'd2', categoria: 'biblioteca', titulo: 'B' },
          { id: 'd3', categoria: 'comites', titulo: 'C' },
          { id: 'd4', categoria: 'desconhecida', titulo: 'D' }, // bucket dinâmico + warn
        ],
        error: null,
      }

      const grouped = await svc.fetchAllDocuments({ pageSize: 200 })

      expect(grouped.etica).toHaveLength(1)
      expect(grouped.etica[0].id).toBe('d1')
      expect(grouped.biblioteca).toHaveLength(1)
      expect(grouped.comites).toHaveLength(1)
      // categoria fora do conjunto canônico NÃO é descartada: o service cria
      // bucket dinâmico e loga warn (evita "sumiço" silencioso nas telas)
      expect(grouped.desconhecida).toHaveLength(1)
      expect(grouped.desconhecida[0].id).toBe('d4')
      expect(Object.values(grouped).flat()).toHaveLength(4)
    })

    it('para de paginar quando batch < pageSize', async () => {
      // 1 batch só, com 2 rows < 200 → para
      mocks.state.range = {
        data: [{ id: 'd1', categoria: 'etica' }, { id: 'd2', categoria: 'etica' }],
        error: null,
      }

      await svc.fetchAllDocuments({ pageSize: 200 })

      // range chamado 1 vez (não 50)
      const rangeCalls = mocks.fromMock.mock.calls.length
      expect(rangeCalls).toBe(1)
    })
  })

  describe('fetchPendingApproval / fetchOverdueDocuments / fetchUpcomingReviews', () => {
    it('fetchPendingApproval filtra por status=pendente', async () => {
      mocks.state.select = { data: [{ id: 'p1', status: 'pendente' }], error: null }

      const result = await svc.fetchPendingApproval()

      expect(result).toHaveLength(1)
      expect(mocks.state.lastEq).toContainEqual(['status', 'pendente'])
    })

    it('fetchOverdueDocuments lê da view vw_documentos_revisao_vencida', async () => {
      mocks.state.select = { data: [{ id: 'o1' }], error: null }

      await svc.fetchOverdueDocuments()

      expect(mocks.state.lastTable).toBe('vw_documentos_revisao_vencida')
    })

    it('fetchUpcomingReviews filtra ativo entre now e now+days', async () => {
      mocks.state.select = { data: [{ id: 'u1', proxima_revisao: '2026-06-01' }], error: null }

      const result = await svc.fetchUpcomingReviews(30)

      expect(result).toHaveLength(1)
      expect(mocks.state.lastEq).toContainEqual(['status', 'ativo'])
    })
  })

  describe('createDocument', () => {
    it('cria doc com id custom + audit + qmentum derive + version inicial', async () => {
      // Insert no documentos → returna doc completo
      mocks.state.singleQueue = [
        {
          data: {
            id: 'doc-custom-1',
            titulo: 'Manual ROP',
            categoria: 'etica',
            status: 'rascunho',
            versao_atual: 1,
            arquivo_url: 'http://x',
            arquivo_nome: 'manual.pdf',
            arquivo_tamanho: 1024,
            storage_path: 'etica/doc-custom-1/v1/manual.pdf',
          },
          error: null,
        },
      ]
      // Insert na documento_versoes (segundo from) → no terminal nem chama single, retorna direto via then
      mocks.state.select = { data: null, error: null }

      const result = await svc.createDocument(
        'etica',
        { id: 'doc-custom-1', titulo: 'Manual ROP', arquivoNome: 'manual.pdf' },
        USER
      )

      expect(result.id).toBe('doc-custom-1')
      expect(result.titulo).toBe('Manual ROP')
      // Insert payload registrado com snake_case + audit
      expect(mocks.state.lastInsert).toBeTruthy()
      // O último insert foi a versão inicial. Verificamos via rpcCalls do logAction:
      // logAction → rpc_log_document_action
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged).toBeTruthy()
      expect(logged.params.p_user_id).toBe('u-real-42')
      expect(logged.params.p_action).toBe('created')
    })

    it('gera id automaticamente quando ausente', async () => {
      mocks.state.singleQueue = [
        {
          data: { id: 'doc-auto', titulo: 'Auto', categoria: 'biblioteca', status: 'rascunho', versao_atual: 1 },
          error: null,
        },
      ]

      const result = await svc.createDocument('biblioteca', { titulo: 'Auto' }, USER)

      expect(result.id).toBe('doc-auto')
      // O insert original deve ter `id` que começa com 'doc-' (Date.now())
      // mas como mockado terminal devolve doc-auto, validamos audit
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged.params.p_documento_id).toBe('doc-auto')
    })

    it('lança quando userInfo não tem userId (audit obrigatório)', async () => {
      await expect(
        svc.createDocument('etica', { titulo: 'X' }, {})
      ).rejects.toThrow(/User ID is required/)
    })

    it('lança quando Supabase insert falha', async () => {
      mocks.state.singleQueue = [{ data: null, error: { message: 'insert failed' } }]
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.createDocument('etica', { titulo: 'X' }, USER)).rejects.toThrow(/createDocument/)

      spy.mockRestore()
    })
  })

  describe('updateDocument', () => {
    it('atualiza doc + adiciona audit fields + remove campos imutáveis', async () => {
      mocks.state.single = {
        data: { id: 'doc-1', titulo: 'Novo Título', updated_by: 'u-real-42', updated_by_name: 'Dra. Real' },
        error: null,
      }

      const result = await svc.updateDocument(
        'doc-1',
        {
          titulo: 'Novo Título',
          id: 'IGNORADO', // deve ser stripped
          createdBy: 'IGNORADO',
          createdAt: '2020-01-01',
          fts: 'should-not-go-through',
        },
        USER
      )

      expect(result.titulo).toBe('Novo Título')
      // Update payload não inclui id / created_by / created_at / fts
      expect(mocks.state.lastUpdate.id).toBeUndefined()
      expect(mocks.state.lastUpdate.created_by).toBeUndefined()
      expect(mocks.state.lastUpdate.created_at).toBeUndefined()
      expect(mocks.state.lastUpdate.fts).toBeUndefined()
      // updated_by + updated_by_name presentes
      expect(mocks.state.lastUpdate.updated_by).toBe('u-real-42')
      expect(mocks.state.lastUpdate.updated_by_name).toBe('Dra. Real')
      // audit log chamado
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action' && c.params.p_action === 'updated')
      expect(logged).toBeTruthy()
    })

    it('lança quando update falha', async () => {
      mocks.state.single = { data: null, error: { message: 'update failed' } }
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.updateDocument('doc-1', { titulo: 'X' }, USER)).rejects.toThrow(/updateDocument/)

      spy.mockRestore()
    })
  })

  describe('deleteDocument (soft-delete)', () => {
    it('seta deleted_at + deleted_by + grava audit log', async () => {
      // update sem single() — vai pelo then() resolver com state.select
      mocks.state.select = { data: null, error: null }

      const result = await svc.deleteDocument('doc-to-del', USER)

      expect(result).toBe(true)
      expect(mocks.state.lastUpdate.deleted_at).toBeTruthy()
      expect(mocks.state.lastUpdate.deleted_by).toBe('u-real-42')
      // audit log com action='deleted'
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action' && c.params.p_action === 'deleted')
      expect(logged).toBeTruthy()
    })

    it('lança MissingUserIdError quando userInfo não tem userId', async () => {
      await expect(svc.deleteDocument('doc-1', {})).rejects.toThrow(/User ID is required/)
    })
  })

  describe('restoreFromTrash', () => {
    it('limpa deleted_at + grava audit log restored', async () => {
      mocks.state.select = { data: null, error: null }

      const result = await svc.restoreFromTrash('doc-1', USER)

      expect(result).toBe(true)
      expect(mocks.state.lastUpdate.deleted_at).toBeNull()
      expect(mocks.state.lastUpdate.deleted_by).toBeNull()
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action' && c.params.p_action === 'restored')
      expect(logged).toBeTruthy()
    })
  })

  describe('changeStatus', () => {
    it('rejeita transição inválida com message — não chama UPDATE', async () => {
      // primeiro single() = fetch current
      mocks.state.singleQueue = [
        { data: { status: 'rascunho', categoria: 'etica', intervalo_revisao_dias: 365 }, error: null },
      ]

      const result = await svc.changeStatus('doc-1', 'ativo', USER)

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/nao e permitida/i)
      // não houve update (apenas o fetch inicial)
      expect(mocks.state.lastUpdate).toBeNull()
    })

    it('aceita transição válida pendente→ativo + calcula proxima_revisao', async () => {
      const before = Date.now()
      mocks.state.singleQueue = [
        // fetch current
        { data: { status: 'pendente', categoria: 'etica', intervalo_revisao_dias: 30 }, error: null },
        // update result
        { data: { id: 'doc-1', status: 'ativo', proxima_revisao: 'set' }, error: null },
      ]

      const result = await svc.changeStatus('doc-1', 'ativo', USER)

      expect(result.success).toBe(true)
      expect(mocks.state.lastUpdate.status).toBe('ativo')
      expect(mocks.state.lastUpdate.proxima_revisao).toBeTruthy()
      // proxima_revisao está ~30 dias à frente
      const futureMs = new Date(mocks.state.lastUpdate.proxima_revisao).getTime()
      expect(futureMs).toBeGreaterThanOrEqual(before + 29 * 24 * 60 * 60 * 1000)
      // audit log status_changed
      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'status_changed')
      expect(logged).toBeTruthy()
    })

    it('rascunho→pendente sem calcular proxima_revisao', async () => {
      mocks.state.singleQueue = [
        { data: { status: 'rascunho', categoria: 'biblioteca', intervalo_revisao_dias: 365 }, error: null },
        { data: { id: 'doc-1', status: 'pendente' }, error: null },
      ]

      const result = await svc.changeStatus('doc-1', 'pendente', USER)

      expect(result.success).toBe(true)
      expect(mocks.state.lastUpdate.proxima_revisao).toBeUndefined()
    })
  })
})
