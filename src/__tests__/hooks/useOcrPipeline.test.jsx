/**
 * Sprint 4 / O2-2 — useOcrPipeline orchestration tests
 *
 * Cobre:
 *   1. PDF text-based → markOcrNotNeeded, status=skipped, sem OCR rodando
 *   2. PDF escaneado → pending → processing → done com persistOcrResult
 *   3. force=true pula detecção
 *   4. Erro durante OCR → markOcrFailed + status=failed
 *   5. Feature flag desligada retorna disabled sem chamar serviço
 *   6. Validação: file obrigatório / docId obrigatório / userId obrigatório
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/utils/pdfTextDetection.js', () => ({
  detectIfScanned: vi.fn(),
  SCANNED_THRESHOLD: 50,
}))
vi.mock('@/services/ocrService.js', () => ({
  runOcr: vi.fn(),
  OCR_ENGINE: 'tesseract-wasm-v5-por',
}))
vi.mock('@/services/supabaseDocumentService.js', () => {
  const fns = {
    markOcrPending: vi.fn(async () => ({})),
    markOcrProcessing: vi.fn(async () => ({})),
    markOcrNotNeeded: vi.fn(async () => ({})),
    markOcrFailed: vi.fn(async () => ({})),
    persistOcrResult: vi.fn(async () => ({})),
  }
  return { default: fns, ...fns }
})
let ocrEnabled = true
vi.mock('@/utils/featureFlags.js', () => ({
  isOcrEnabled: () => ocrEnabled,
}))

import { useOcrPipeline, OCR_PIPELINE_STATUS } from '../../hooks/useOcrPipeline.js'
import { detectIfScanned } from '../../utils/pdfTextDetection.js'
import { runOcr } from '../../services/ocrService.js'
import service from '../../services/supabaseDocumentService.js'

const validUser = { userId: 'fb-uid', userName: 'Tester' }

beforeEach(() => {
  vi.clearAllMocks()
  ocrEnabled = true
})

describe('useOcrPipeline', () => {
  it('PDF text-based → marca not_needed e skip', async () => {
    detectIfScanned.mockResolvedValue({
      isScanned: false,
      totalPages: 4,
      totalChars: 2000,
      charsPerPage: 500,
      confidence: 0.9,
      pagesWithLittleText: [],
    })

    const { result } = renderHook(() => useOcrPipeline())

    let outcome
    await act(async () => {
      outcome = await result.current.startOcr({
        docId: 'd1',
        file: new ArrayBuffer(8),
        userInfo: validUser,
      })
    })

    expect(outcome.skipped).toBe(true)
    expect(outcome.reason).toBe('text_based')
    expect(service.markOcrPending).toHaveBeenCalledWith('d1', validUser)
    expect(service.markOcrNotNeeded).toHaveBeenCalled()
    expect(service.markOcrProcessing).not.toHaveBeenCalled()
    expect(runOcr).not.toHaveBeenCalled()
    expect(result.current.status).toBe(OCR_PIPELINE_STATUS.SKIPPED)
  })

  it('PDF escaneado → roda OCR e persiste resultado', async () => {
    detectIfScanned.mockResolvedValue({
      isScanned: true,
      totalPages: 3,
      totalChars: 5,
      charsPerPage: 1.7,
      confidence: 0.8,
      pagesWithLittleText: [1, 2, 3],
    })
    runOcr.mockResolvedValue({
      text: 'TEXTO OCR',
      confidence: 0.78,
      pagesProcessed: 3,
      totalPages: 3,
      durationMs: 5000,
      engine: 'tesseract-wasm-v5-por',
      pagesMeta: [],
    })

    const { result } = renderHook(() => useOcrPipeline())

    let outcome
    await act(async () => {
      outcome = await result.current.startOcr({
        docId: 'd2',
        file: new ArrayBuffer(8),
        userInfo: validUser,
      })
    })

    expect(outcome.ok).toBe(true)
    expect(service.markOcrPending).toHaveBeenCalled()
    expect(service.markOcrProcessing).toHaveBeenCalled()
    expect(runOcr).toHaveBeenCalled()
    expect(service.persistOcrResult).toHaveBeenCalledWith(
      'd2',
      expect.objectContaining({ text: 'TEXTO OCR', confidence: 0.78 }),
      validUser
    )
    expect(result.current.status).toBe(OCR_PIPELINE_STATUS.DONE)
  })

  it('force=true pula detectIfScanned', async () => {
    runOcr.mockResolvedValue({
      text: 'X',
      confidence: 0.5,
      pagesProcessed: 1,
      totalPages: 1,
      durationMs: 100,
      engine: 'tesseract-wasm-v5-por',
      pagesMeta: [],
    })

    const { result } = renderHook(() => useOcrPipeline())
    await act(async () => {
      await result.current.startOcr({
        docId: 'd3',
        file: new ArrayBuffer(4),
        userInfo: validUser,
        force: true,
      })
    })

    expect(detectIfScanned).not.toHaveBeenCalled()
    expect(runOcr).toHaveBeenCalled()
    expect(service.persistOcrResult).toHaveBeenCalled()
  })

  it('falha durante OCR → markOcrFailed + status=failed', async () => {
    detectIfScanned.mockResolvedValue({
      isScanned: true,
      totalPages: 2,
      totalChars: 0,
      charsPerPage: 0,
      confidence: 0.9,
      pagesWithLittleText: [1, 2],
    })
    runOcr.mockRejectedValue(new Error('OCR engine error'))

    const { result } = renderHook(() => useOcrPipeline())
    let outcome
    await act(async () => {
      outcome = await result.current.startOcr({
        docId: 'd4',
        file: new ArrayBuffer(4),
        userInfo: validUser,
      })
    })

    expect(outcome.ok).toBe(false)
    expect(service.markOcrFailed).toHaveBeenCalledWith(
      'd4',
      validUser,
      expect.stringContaining('OCR engine error')
    )
    expect(result.current.status).toBe(OCR_PIPELINE_STATUS.FAILED)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('feature flag desligada retorna disabled sem tocar no serviço', async () => {
    ocrEnabled = false
    const { result } = renderHook(() => useOcrPipeline())

    let outcome
    await act(async () => {
      outcome = await result.current.startOcr({
        docId: 'd5',
        file: new ArrayBuffer(4),
        userInfo: validUser,
      })
    })

    expect(outcome.skipped).toBe(true)
    expect(outcome.reason).toBe('feature_disabled')
    expect(service.markOcrPending).not.toHaveBeenCalled()
    expect(result.current.status).toBe(OCR_PIPELINE_STATUS.DISABLED)
  })

  it('valida parâmetros obrigatórios', async () => {
    const { result } = renderHook(() => useOcrPipeline())

    await expect(
      result.current.startOcr({ file: new ArrayBuffer(4), userInfo: validUser })
    ).rejects.toThrow(/docId obrigatório/)
    await expect(
      result.current.startOcr({ docId: 'x', userInfo: validUser })
    ).rejects.toThrow(/file obrigatório/)
    await expect(
      result.current.startOcr({ docId: 'x', file: new ArrayBuffer(4), userInfo: {} })
    ).rejects.toThrow(/userInfo\.userId/)
  })

  it('reset volta status para idle', async () => {
    const { result } = renderHook(() => useOcrPipeline())
    detectIfScanned.mockResolvedValue({
      isScanned: false,
      totalPages: 1,
      totalChars: 1000,
      charsPerPage: 1000,
      confidence: 1,
      pagesWithLittleText: [],
    })
    await act(async () => {
      await result.current.startOcr({
        docId: 'd6',
        file: new ArrayBuffer(4),
        userInfo: validUser,
      })
    })
    expect(result.current.status).toBe(OCR_PIPELINE_STATUS.SKIPPED)

    act(() => result.current.reset())
    await waitFor(() => expect(result.current.status).toBe(OCR_PIPELINE_STATUS.IDLE))
  })
})
