/**
 * supabaseDocumentService — OCR state machine tests (Sprint 20 Stream 1.1)
 *
 * Cobre o submódulo OCR (Sprint 4 / Onda 2):
 *  - markOcrPending → grava ocr_status='pending', sem changelog (silent)
 *  - markOcrProcessing → grava 'processing' + audit 'ocr_started'
 *  - markOcrNotNeeded → grava 'not_needed' + audit 'ocr_skipped' (reason=text_based)
 *  - markOcrFailed → grava 'failed' + audit 'ocr_failed' (truncated msg) + rpc increment
 *  - persistOcrResult → grava 'done' + texto + audit 'ocr_completed' + reset fail_count
 *  - persistOcrResult valida ocr.text obrigatório (throw sync)
 *  - getOcrFailCount → retorna count quando data, 0 quando error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    single: { data: null, error: null },
    select: { data: [], error: null },
    rpcResult: { data: null, error: null },
    lastTable: null,
    lastUpdate: null,
    lastEq: [],
    rpcCalls: [],
  }

  function makeChain() {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn((payload) => {
        state.lastUpdate = payload
        return chain
      }),
      delete: vi.fn(() => chain),
      eq: vi.fn((col, val) => {
        state.lastEq.push([col, val])
        return chain
      }),
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

  return { state, fromMock, rpcMock }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
    storage: {
      from: vi.fn(() => ({})),
    },
  },
}))

vi.mock('@/utils/featureFlags', () => ({
  isOcrEnabled: () => true, // OCR ON para esses testes
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

const { default: svc } = await import('@/services/supabaseDocumentService')

const USER = { userId: 'u-99', userName: 'Ana OCR' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.single = { data: null, error: null }
  mocks.state.select = { data: [], error: null }
  mocks.state.rpcResult = { data: null, error: null }
  mocks.state.lastTable = null
  mocks.state.lastUpdate = null
  mocks.state.lastEq = []
  mocks.state.rpcCalls = []
})

describe('supabaseDocumentService — OCR state machine', () => {
  describe('markOcrPending', () => {
    it('grava ocr_status=pending sem disparar audit log', async () => {
      mocks.state.single = { data: { id: 'd1', ocr_status: 'pending' }, error: null }

      const result = await svc.markOcrPending('d1', USER)

      expect(result.ocrStatus).toBe('pending')
      expect(mocks.state.lastUpdate.ocr_status).toBe('pending')
      expect(mocks.state.lastUpdate.ocr_run_at).toBeTruthy()
      // sem audit log (action=null)
      expect(mocks.state.rpcCalls).toHaveLength(0)
    })
  })

  describe('markOcrProcessing', () => {
    it('grava processing + audit ocr_started', async () => {
      mocks.state.single = { data: { id: 'd1', ocr_status: 'processing' }, error: null }

      await svc.markOcrProcessing('d1', USER)

      expect(mocks.state.lastUpdate.ocr_status).toBe('processing')
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged.params.p_action).toBe('ocr_started')
    })
  })

  describe('markOcrNotNeeded', () => {
    it('grava not_needed + grava pages + audit ocr_skipped com reason=text_based', async () => {
      mocks.state.single = { data: { id: 'd1', ocr_status: 'not_needed' }, error: null }

      await svc.markOcrNotNeeded('d1', USER, {
        totalPages: 10,
        charsPerPage: 1500,
        totalChars: 15000,
      })

      expect(mocks.state.lastUpdate.ocr_status).toBe('not_needed')
      expect(mocks.state.lastUpdate.ocr_pages_processed).toBe(10)
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged.params.p_action).toBe('ocr_skipped')
      expect(logged.params.p_changes.reason).toBe('text_based')
      expect(logged.params.p_changes.chars_per_page).toBe(1500)
    })
  })

  describe('markOcrFailed', () => {
    it('grava failed + audit ocr_failed com msg truncada + incrementa fail_count via rpc', async () => {
      mocks.state.single = { data: { id: 'd1', ocr_status: 'failed' }, error: null }

      const longMsg = 'Erro grave\nlinha 2 com detalhes\n'.padEnd(500, 'x')
      await svc.markOcrFailed('d1', USER, longMsg)

      expect(mocks.state.lastUpdate.ocr_status).toBe('failed')
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged.params.p_action).toBe('ocr_failed')
      // truncado em 200 chars + só primeira linha
      expect(logged.params.p_changes.error.length).toBeLessThanOrEqual(200)
      expect(logged.params.p_changes.error).toBe('Erro grave')
      // rpc increment chamado
      const inc = mocks.state.rpcCalls.find((c) => c.name === 'rpc_increment_ocr_fail_count')
      expect(inc).toBeTruthy()
      expect(inc.params.p_documento_id).toBe('d1')
    })

    it('tolera errorMessage vazio sem crashar', async () => {
      mocks.state.single = { data: { id: 'd1' }, error: null }

      await svc.markOcrFailed('d1', USER) // sem msg

      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged.params.p_changes.error).toBe('')
    })
  })

  describe('persistOcrResult', () => {
    it('grava texto + done + reset fail_count + audit completed', async () => {
      mocks.state.single = {
        data: { id: 'd1', ocr_status: 'done', ocr_text: 'hello world' },
        error: null,
      }

      const result = await svc.persistOcrResult(
        'd1',
        { text: 'hello world', engine: 'tesseract', confidence: 0.92, pagesProcessed: 3, durationMs: 5000 },
        USER
      )

      expect(result.ocrStatus).toBe('done')
      expect(mocks.state.lastUpdate.ocr_status).toBe('done')
      expect(mocks.state.lastUpdate.ocr_text).toBe('hello world')
      expect(mocks.state.lastUpdate.ocr_engine).toBe('tesseract')
      expect(mocks.state.lastUpdate.ocr_confidence).toBe(0.92)
      expect(mocks.state.lastUpdate.ocr_pages_processed).toBe(3)
      expect(mocks.state.lastUpdate.ocr_fail_count).toBe(0) // reset
      const logged = mocks.state.rpcCalls.find((c) => c.name === 'rpc_log_document_action')
      expect(logged.params.p_action).toBe('ocr_completed')
      expect(logged.params.p_changes.chars).toBe(11)
      expect(logged.params.p_changes.duration_ms).toBe(5000)
    })

    it('lança quando ocr.text não é string', async () => {
      await expect(
        svc.persistOcrResult('d1', { text: 123, engine: 'x' }, USER)
      ).rejects.toThrow(/ocr.text obrigatório/)
    })

    it('grava confidence=null quando não numérico', async () => {
      mocks.state.single = { data: { id: 'd1' }, error: null }

      await svc.persistOcrResult('d1', { text: 't', engine: 'x', confidence: 'high' }, USER)

      expect(mocks.state.lastUpdate.ocr_confidence).toBeNull()
    })
  })

  describe('getOcrFailCount', () => {
    it('retorna count quando data existe', async () => {
      mocks.state.single = { data: { ocr_fail_count: 2 }, error: null }

      const count = await svc.getOcrFailCount('d1')

      expect(count).toBe(2)
    })

    it('retorna 0 quando data null', async () => {
      mocks.state.single = { data: null, error: null }

      const count = await svc.getOcrFailCount('d1')

      expect(count).toBe(0)
    })

    it('retorna 0 + warn quando há error', async () => {
      mocks.state.single = { data: null, error: { message: 'denied' } }
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const count = await svc.getOcrFailCount('d1')

      expect(count).toBe(0)
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })
})
