import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock antes do import — setup global do worker via ?url não resolve em jsdom.
vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'mock-worker-url' }))

const getDocumentMock = vi.fn()
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (opts) => getDocumentMock(opts),
}))

import { detectIfScanned, SCANNED_THRESHOLD } from '../../utils/pdfTextDetection.js'

function makePdfMock(pagesText) {
  const pdf = {
    numPages: pagesText.length,
    getPage: vi.fn(async (n) => ({
      getTextContent: async () => ({
        items: pagesText[n - 1].map((str) => ({ str })),
      }),
      cleanup: vi.fn(),
    })),
    destroy: vi.fn(async () => {}),
  }
  return pdf
}

beforeEach(() => {
  getDocumentMock.mockReset()
})

describe('detectIfScanned', () => {
  it('retorna isScanned=true para PDF totalmente escaneado (sem texto)', async () => {
    const pdf = makePdfMock([[], [], []])
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const result = await detectIfScanned(new ArrayBuffer(8))

    expect(result.isScanned).toBe(true)
    expect(result.totalPages).toBe(3)
    expect(result.totalChars).toBe(0)
    expect(result.charsPerPage).toBe(0)
    expect(result.pagesWithLittleText).toEqual([1, 2, 3])
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('retorna isScanned=false para PDF text-based (texto abundante)', async () => {
    const longText = 'a'.repeat(500)
    const pdf = makePdfMock([[longText], [longText], [longText]])
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const result = await detectIfScanned(new ArrayBuffer(8))

    expect(result.isScanned).toBe(false)
    expect(result.totalChars).toBe(1500)
    expect(result.charsPerPage).toBe(500)
    expect(result.pagesWithLittleText).toEqual([])
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('detecta PDF híbrido (algumas páginas com pouco texto)', async () => {
    // 4 páginas: 2 com texto, 2 sem
    const longText = 'b'.repeat(400)
    const pdf = makePdfMock([[longText], [], [longText], []])
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const result = await detectIfScanned(new ArrayBuffer(8))

    // charsPerPage = 800/4 = 200 → text-based
    expect(result.isScanned).toBe(false)
    expect(result.pagesWithLittleText).toEqual([2, 4])
  })

  it('retorna estado neutro para PDF vazio', async () => {
    const pdf = makePdfMock([])
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const result = await detectIfScanned(new ArrayBuffer(8))

    expect(result.isScanned).toBe(false)
    expect(result.totalPages).toBe(0)
    expect(result.charsPerPage).toBe(0)
    expect(result.confidence).toBe(1)
  })

  it('usa o threshold público SCANNED_THRESHOLD', () => {
    expect(SCANNED_THRESHOLD).toBe(50)
  })

  it('aceita Uint8Array como input', async () => {
    const pdf = makePdfMock([[]])
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const result = await detectIfScanned(new Uint8Array([1, 2, 3]))
    expect(result.totalPages).toBe(1)
  })

  it('rejeita inputs inválidos', async () => {
    await expect(detectIfScanned('not-a-buffer')).rejects.toThrow(/input deve ser/i)
  })
})
