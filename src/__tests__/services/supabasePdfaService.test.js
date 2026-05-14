/**
 * Sprint 6 / O2-3 — supabasePdfaService tests
 *
 * Cobre:
 *  - requestPdfaConversion happy path (passa Bearer)
 *  - requestPdfaConversion sem JWT → throw
 *  - requestPdfaConversion args missing → throw
 *  - getSignedPdfaUrl strip do prefix bucket
 *  - getSignedPdfaUrl error → null
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
const getSupabaseTokenMock = vi.fn()
const createSignedUrlMock = vi.fn()

vi.mock('@/config/supabase', () => ({
  supabase: {
    functions: { invoke: (...a) => invokeMock(...a) },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: (...a) => createSignedUrlMock(...a),
      })),
    },
  },
  getSupabaseToken: (...a) => getSupabaseTokenMock(...a),
}))

import { requestPdfaConversion, getSignedPdfaUrl } from '../../services/supabasePdfaService.js'

beforeEach(() => {
  invokeMock.mockReset()
  getSupabaseTokenMock.mockReset()
  createSignedUrlMock.mockReset()
})

describe('requestPdfaConversion', () => {
  it('args missing → throw', async () => {
    await expect(requestPdfaConversion('', '')).rejects.toThrow(/obrigatórios/)
    await expect(requestPdfaConversion('doc-1', '')).rejects.toThrow(/obrigatórios/)
  })

  it('sem JWT → throw', async () => {
    getSupabaseTokenMock.mockResolvedValue(null)
    await expect(requestPdfaConversion('doc-1', 'documentos/d1.pdf'))
      .rejects.toThrow(/sem JWT/)
  })

  it('happy path: invoca pdfa-convert com Bearer', async () => {
    getSupabaseTokenMock.mockResolvedValue('abc-jwt')
    invokeMock.mockResolvedValue({ data: { queued: true }, error: null })

    const r = await requestPdfaConversion('doc-1', 'documentos/d1.pdf')

    expect(invokeMock).toHaveBeenCalledWith('pdfa-convert', {
      body: { documentoId: 'doc-1', sourceStoragePath: 'documentos/d1.pdf' },
      headers: { Authorization: 'Bearer abc-jwt' },
    })
    expect(r).toEqual({ queued: true })
  })

  it('error retornado → propaga {error}', async () => {
    getSupabaseTokenMock.mockResolvedValue('jwt')
    invokeMock.mockResolvedValue({ data: null, error: { message: 'service down' } })

    const r = await requestPdfaConversion('doc-1', 'documentos/d1.pdf')
    expect(r.error).toBe('service down')
  })
})

describe('getSignedPdfaUrl', () => {
  it('null in → null out', async () => {
    const url = await getSignedPdfaUrl(null)
    expect(url).toBeNull()
  })

  it('strip do prefix documentos-pdfa/', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://signed.url/x' },
      error: null,
    })
    const url = await getSignedPdfaUrl('documentos-pdfa/doc-1/file.pdf')
    expect(createSignedUrlMock).toHaveBeenCalledWith('doc-1/file.pdf', 300)
    expect(url).toBe('https://signed.url/x')
  })

  it('error → retorna null', async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: { message: 'denied' } })
    const url = await getSignedPdfaUrl('documentos-pdfa/x.pdf')
    expect(url).toBeNull()
  })
})
