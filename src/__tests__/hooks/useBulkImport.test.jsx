/**
 * Sprint 5 / O2-4 — useBulkImport tests
 *
 * Cobre:
 *   1. Flag OFF → status disabled
 *   2. entries vazio → erro
 *   3. userInfo sem userId → erro
 *   4. Caminho feliz → status done, progress final
 *   5. Caminho parcial → status partial
 *   6. Reset volta ao idle
 *   7. ocrPipelineStarter é passado adiante quando flag OCR ON
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let bulkEnabled = true
let ocrEnabled = false
vi.mock('@/utils/featureFlags', () => ({
  isBulkImportEnabled: () => bulkEnabled,
  isOcrEnabled: () => ocrEnabled,
}))

const startOcrMock = vi.fn(async () => {})
vi.mock('@/hooks/useOcrPipeline', () => ({
  useOcrPipeline: () => ({ startOcr: startOcrMock }),
  OCR_PIPELINE_STATUS: {},
}))

const processBulkImportMock = vi.fn()
vi.mock('@/services/bulkImportService', () => {
  const fns = {
    processBulkImport: (...args) => processBulkImportMock(...args),
  }
  return { default: fns, ...fns }
})

import { useBulkImport, BULK_IMPORT_STATUS } from '../../hooks/useBulkImport.js'

const validUser = { userId: 'fb-uid', userName: 'Admin' }

beforeEach(() => {
  vi.clearAllMocks()
  bulkEnabled = true
  ocrEnabled = false
  processBulkImportMock.mockReset()
})

describe('useBulkImport', () => {
  it('flag off retorna disabled e não chama service', async () => {
    bulkEnabled = false
    const { result } = renderHook(() => useBulkImport())
    let outcome
    await act(async () => {
      outcome = await result.current.startImport(
        [{ file: { type: 'application/pdf' }, meta: { titulo: 'X', categoria: 'biblioteca' } }],
        { userInfo: validUser }
      )
    })
    expect(outcome.skipped).toBe(true)
    expect(outcome.reason).toBe('feature_disabled')
    expect(result.current.status).toBe(BULK_IMPORT_STATUS.DISABLED)
    expect(processBulkImportMock).not.toHaveBeenCalled()
  })

  it('valida entries vazio', async () => {
    const { result } = renderHook(() => useBulkImport())
    await expect(
      result.current.startImport([], { userInfo: validUser })
    ).rejects.toThrow(/entries vazio/)
  })

  it('exige userInfo.userId', async () => {
    const { result } = renderHook(() => useBulkImport())
    await expect(
      result.current.startImport([{ file: {}, meta: {} }], { userInfo: {} })
    ).rejects.toThrow(/userInfo\.userId/)
  })

  it('caminho feliz → status done e jobId armazenado', async () => {
    processBulkImportMock.mockImplementation(async ({ onProgress }) => {
      onProgress?.({ processed: 0, failed: 0, total: 2, phase: 'starting' })
      onProgress?.({ processed: 2, failed: 0, total: 2, phase: 'processing' })
      onProgress?.({ processed: 2, failed: 0, total: 2, phase: 'done', status: 'done' })
      return { jobId: 'job-1', total: 2, processed: 2, failed: 0, status: 'done', errors: [] }
    })

    const { result } = renderHook(() => useBulkImport())
    await act(async () => {
      await result.current.startImport(
        [
          { file: {}, meta: { titulo: 'A', categoria: 'biblioteca' } },
          { file: {}, meta: { titulo: 'B', categoria: 'biblioteca' } },
        ],
        { userInfo: validUser }
      )
    })

    expect(result.current.status).toBe(BULK_IMPORT_STATUS.DONE)
    expect(result.current.jobId).toBe('job-1')
    expect(result.current.errors).toEqual([])
    expect(result.current.summary?.total).toBe(2)
  })

  it('falhas parciais → status partial', async () => {
    processBulkImportMock.mockResolvedValue({
      jobId: 'job-2',
      total: 3,
      processed: 2,
      failed: 1,
      status: 'partial',
      errors: [{ ok: false, file: 'b.pdf', error: 'boom' }],
    })
    const { result } = renderHook(() => useBulkImport())
    await act(async () => {
      await result.current.startImport(
        [
          { file: {}, meta: { titulo: 'A', categoria: 'biblioteca' } },
          { file: {}, meta: { titulo: 'B', categoria: 'biblioteca' } },
          { file: {}, meta: { titulo: 'C', categoria: 'biblioteca' } },
        ],
        { userInfo: validUser }
      )
    })
    expect(result.current.status).toBe(BULK_IMPORT_STATUS.PARTIAL)
    expect(result.current.errors).toHaveLength(1)
  })

  it('reset volta status para idle', async () => {
    processBulkImportMock.mockResolvedValue({
      jobId: 'job-x',
      total: 1,
      processed: 1,
      failed: 0,
      status: 'done',
      errors: [],
    })
    const { result } = renderHook(() => useBulkImport())
    await act(async () => {
      await result.current.startImport(
        [{ file: {}, meta: { titulo: 'A', categoria: 'biblioteca' } }],
        { userInfo: validUser }
      )
    })
    expect(result.current.status).toBe(BULK_IMPORT_STATUS.DONE)
    act(() => result.current.reset())
    expect(result.current.status).toBe(BULK_IMPORT_STATUS.IDLE)
    expect(result.current.jobId).toBeNull()
  })

  it('passa ocrPipelineStarter para o service', async () => {
    let capturedStarter
    processBulkImportMock.mockImplementation(async ({ ocrPipelineStarter }) => {
      capturedStarter = ocrPipelineStarter
      return { jobId: 'j', total: 1, processed: 1, failed: 0, status: 'done', errors: [] }
    })

    const { result } = renderHook(() => useBulkImport())
    await act(async () => {
      await result.current.startImport(
        [{ file: {}, meta: { titulo: 'X', categoria: 'biblioteca' } }],
        { userInfo: validUser }
      )
    })

    expect(typeof capturedStarter).toBe('function')
    // Quando chamado, repassa para startOcr do useOcrPipeline
    await capturedStarter('doc-1', { type: 'application/pdf' }, validUser)
    expect(startOcrMock).toHaveBeenCalledWith({
      docId: 'doc-1',
      file: { type: 'application/pdf' },
      userInfo: validUser,
    })
  })
})
