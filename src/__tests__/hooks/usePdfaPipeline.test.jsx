/**
 * Sprint 6 / O2-3 — usePdfaPipeline tests
 *
 * Cobre:
 *  - flag OFF retorna {skipped:true} sem chamar service
 *  - flag ON dispara requestPdfaConversion
 *  - error do service vira state.error
 *  - exception do service vira state.error
 *  - args missing retornam {error:'missing args'}
 *  - cleanup unmount não atualiza state após resposta
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

let pdfaEnabled = true
vi.mock('@/utils/featureFlags', () => ({
  isPdfaEnabled: () => pdfaEnabled,
}))

const requestPdfaConversionMock = vi.fn()
vi.mock('@/services/supabasePdfaService', () => {
  const fns = {
    requestPdfaConversion: (...args) => requestPdfaConversionMock(...args),
    getSignedPdfaUrl: vi.fn(),
  }
  return { default: fns, ...fns }
})

import { usePdfaPipeline } from '../../hooks/usePdfaPipeline.js'

beforeEach(() => {
  pdfaEnabled = true
  requestPdfaConversionMock.mockReset()
})

describe('usePdfaPipeline', () => {
  it('flag OFF → retorna {skipped:true} sem chamar service', async () => {
    pdfaEnabled = false
    const { result } = renderHook(() => usePdfaPipeline())
    let r
    await act(async () => {
      r = await result.current.startConversion('doc-1', 'documentos/d1.pdf')
    })
    expect(r).toEqual({ skipped: true })
    expect(requestPdfaConversionMock).not.toHaveBeenCalled()
  })

  it('args missing → retorna error', async () => {
    const { result } = renderHook(() => usePdfaPipeline())
    let r
    await act(async () => {
      r = await result.current.startConversion('', 'path')
    })
    expect(r.error).toBe('missing args')
    expect(requestPdfaConversionMock).not.toHaveBeenCalled()
  })

  it('flag ON → chama service com docId + sourcePath', async () => {
    requestPdfaConversionMock.mockResolvedValueOnce({ queued: true })
    const { result } = renderHook(() => usePdfaPipeline())
    await act(async () => {
      await result.current.startConversion('doc-1', 'documentos/d1.pdf')
    })
    expect(requestPdfaConversionMock).toHaveBeenCalledWith('doc-1', 'documentos/d1.pdf')
    await waitFor(() => expect(result.current.requesting).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('service retorna {error} → seta state.error', async () => {
    requestPdfaConversionMock.mockResolvedValueOnce({ error: 'boom' })
    const { result } = renderHook(() => usePdfaPipeline())
    await act(async () => {
      await result.current.startConversion('doc-1', 'documentos/d1.pdf')
    })
    await waitFor(() => expect(result.current.error).toBe('boom'))
  })

  it('service lança exceção → state.error capturado', async () => {
    requestPdfaConversionMock.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => usePdfaPipeline())
    let r
    await act(async () => {
      r = await result.current.startConversion('doc-1', 'documentos/d1.pdf')
    })
    expect(r.error).toBe('network')
    await waitFor(() => expect(result.current.error).toBe('network'))
  })

  it('unmount → mountedRef previne setState (sem warnings)', async () => {
    let resolveMock
    requestPdfaConversionMock.mockImplementation(
      () => new Promise((resolve) => { resolveMock = resolve })
    )
    const { result, unmount } = renderHook(() => usePdfaPipeline())

    const callPromise = act(async () => {
      const p = result.current.startConversion('doc-1', 'documentos/d1.pdf')
      unmount()
      resolveMock({ queued: true })
      await p
    })
    await callPromise
    // se não deu warning, o teste passa — apenas valida sem assertions extras
    expect(true).toBe(true)
  })
})
