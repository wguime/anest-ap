/**
 * Sprint 4 / O2-2 — supabaseDocumentService OCR helpers
 *
 * Verifica:
 *   1. markOcrPending / markOcrProcessing atualizam status + audit (quando aplicável)
 *   2. markOcrNotNeeded grava ocr_pages_processed + audit 'ocr_skipped'
 *   3. markOcrFailed trunca mensagem de erro + audit 'ocr_failed'
 *   4. persistOcrResult grava texto, confidence, engine + audit 'ocr_completed'
 *   5. Helpers exigem userId (audit-trail.md)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockRpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
const mockFrom = vi.fn()

let nextChainResult = { data: null, error: null }

function buildChain() {
  const chain = {
    update: vi.fn((payload) => {
      mockUpdate(payload)
      return chain
    }),
    eq: vi.fn((col, val) => {
      mockEq(col, val)
      return chain
    }),
    select: vi.fn(() => {
      mockSelect()
      return chain
    }),
    single: vi.fn(() => {
      mockSingle()
      return Promise.resolve(nextChainResult)
    }),
  }
  return chain
}

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      mockFrom(table)
      return buildChain()
    }),
    rpc: (...args) => mockRpc(...args),
  },
}))

vi.mock('@/services/uploadService', () => ({
  validateFile: vi.fn(),
  ACCEPTED_DOCUMENT_TYPES: ['application/pdf'],
}))

import service from '../../services/supabaseDocumentService'

const validUser = {
  userId: 'fb-uid-9',
  userName: 'Dra. Anest',
  userEmail: 'a@anest.com.br',
}

beforeEach(() => {
  vi.clearAllMocks()
  nextChainResult = { data: { id: 'doc-77' }, error: null }
})

describe('OCR helpers — supabaseDocumentService', () => {
  it('markOcrPending atualiza status e ocr_run_at, sem audit', async () => {
    await service.markOcrPending('doc-77', validUser)

    expect(mockFrom).toHaveBeenCalledWith('documentos')
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.ocr_status).toBe('pending')
    expect(payload.ocr_run_at).toBeTruthy()
    expect(mockEq).toHaveBeenCalledWith('id', 'doc-77')
    // Não cria audit (apenas estado intermediário)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('markOcrProcessing cria audit ocr_started', async () => {
    await service.markOcrProcessing('doc-77', validUser)
    expect(mockUpdate.mock.calls[0][0].ocr_status).toBe('processing')
    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_log_document_action',
      expect.objectContaining({ p_action: 'ocr_started' })
    )
  })

  it('markOcrNotNeeded grava pages e cria audit ocr_skipped', async () => {
    await service.markOcrNotNeeded('doc-77', validUser, {
      totalPages: 12,
      charsPerPage: 800,
      totalChars: 9600,
    })

    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.ocr_status).toBe('not_needed')
    expect(payload.ocr_pages_processed).toBe(12)

    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_log_document_action',
      expect.objectContaining({
        p_action: 'ocr_skipped',
        p_changes: expect.objectContaining({
          reason: 'text_based',
          chars_per_page: 800,
        }),
      })
    )
  })

  it('markOcrFailed trunca mensagem longa e cria audit', async () => {
    const longErr = 'Falha boom: ' + 'x'.repeat(500) + '\nstack trace second line'
    await service.markOcrFailed('doc-77', validUser, longErr)

    expect(mockUpdate.mock.calls[0][0].ocr_status).toBe('failed')

    const auditChanges = mockRpc.mock.calls[0][1].p_changes
    expect(auditChanges.error).not.toContain('stack trace')
    expect(auditChanges.error.length).toBeLessThanOrEqual(200)
    expect(auditChanges.error).toMatch(/^Falha boom/)
  })

  it('persistOcrResult grava texto, confidence, engine + audit ocr_completed', async () => {
    await service.persistOcrResult(
      'doc-77',
      {
        text: 'Lorem ipsum extraído por OCR',
        confidence: 0.87,
        pagesProcessed: 5,
        engine: 'tesseract-wasm-v5-por',
        durationMs: 12450,
      },
      validUser
    )

    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.ocr_status).toBe('done')
    expect(payload.ocr_text).toContain('Lorem ipsum')
    expect(payload.ocr_confidence).toBe(0.87)
    expect(payload.ocr_engine).toBe('tesseract-wasm-v5-por')
    expect(payload.ocr_pages_processed).toBe(5)

    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_log_document_action',
      expect.objectContaining({
        p_action: 'ocr_completed',
        p_changes: expect.objectContaining({
          chars: expect.any(Number),
          pages: 5,
          confidence: 0.87,
          duration_ms: 12450,
          engine: 'tesseract-wasm-v5-por',
        }),
      })
    )
  })

  it('persistOcrResult exige campo text', async () => {
    await expect(
      service.persistOcrResult('doc-77', { confidence: 0.9 }, validUser)
    ).rejects.toThrow(/text obrigatório/)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('helpers OCR rejeitam userInfo sem userId', async () => {
    const noUid = { userName: 'sem uid' }
    await expect(service.markOcrPending('doc-77', noUid)).rejects.toThrow(/User ID/)
    await expect(service.markOcrProcessing('doc-77', noUid)).rejects.toThrow(/User ID/)
    await expect(service.markOcrFailed('doc-77', noUid, 'x')).rejects.toThrow(/User ID/)
    await expect(
      service.persistOcrResult('doc-77', { text: 'x' }, noUid)
    ).rejects.toThrow(/User ID/)
  })
})
