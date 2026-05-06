import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'mock-worker-url' }))

const getDocumentMock = vi.fn()
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (opts) => getDocumentMock(opts),
}))

import { runOcr, OCR_ENGINE } from '../../services/ocrService.js'

function makePdfMock(numPages) {
  return {
    numPages,
    getPage: vi.fn(async (n) => ({
      getViewport: () => ({ width: 100, height: 140 }),
      render: () => ({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
      _page: n,
    })),
    destroy: vi.fn(async () => {}),
  }
}

function makeWorkerFactory(perPageResults) {
  let i = 0
  const recognize = vi.fn(async () => {
    const result = perPageResults[i % perPageResults.length]
    i++
    return { data: { text: result.text, confidence: result.confidence } }
  })
  const terminate = vi.fn(async () => {})
  return vi.fn(async () => ({ recognize, terminate }))
}

beforeEach(() => {
  getDocumentMock.mockReset()
})

describe('runOcr', () => {
  it('agrega texto de múltiplas páginas com confidence ponderada', async () => {
    const pdf = makePdfMock(3)
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const renderPage = vi.fn(async () => ({ width: 100, height: 140 }))
    const createWorker = makeWorkerFactory([
      { text: 'Pagina 1', confidence: 80 }, // 8 chars
      { text: 'Pagina 2', confidence: 90 }, // 8 chars
      { text: 'Pagina 3', confidence: 100 }, // 8 chars
    ])

    const result = await runOcr(new ArrayBuffer(8), { renderPage, createWorker })

    expect(result.pagesProcessed).toBe(3)
    expect(result.totalPages).toBe(3)
    expect(result.text).toContain('Pagina 1')
    expect(result.text).toContain('Pagina 3')
    // Média = (80+90+100)/3 = 90 → 0.9
    expect(result.confidence).toBeCloseTo(0.9, 2)
    expect(result.engine).toBe(OCR_ENGINE)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.pagesMeta).toHaveLength(3)
    expect(result.pagesMeta[0]).toMatchObject({ page: 1, confidence: 0.8 })
  })

  it('respeita maxPages', async () => {
    const pdf = makePdfMock(10)
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const renderPage = vi.fn(async () => ({ width: 1, height: 1 }))
    const createWorker = makeWorkerFactory([{ text: 'x', confidence: 50 }])

    const result = await runOcr(new ArrayBuffer(8), {
      renderPage,
      createWorker,
      maxPages: 4,
    })

    expect(result.pagesProcessed).toBe(4)
    expect(result.totalPages).toBe(10)
    expect(renderPage).toHaveBeenCalledTimes(4)
  })

  it('chama onProgress nas fases esperadas', async () => {
    const pdf = makePdfMock(2)
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const renderPage = vi.fn(async () => ({ width: 1, height: 1 }))
    const createWorker = makeWorkerFactory([{ text: 't', confidence: 70 }])
    const onProgress = vi.fn()

    await runOcr(new ArrayBuffer(8), { renderPage, createWorker, onProgress })

    const phases = onProgress.mock.calls.map((c) => c[0].phase)
    expect(phases).toContain('init')
    expect(phases).toContain('rendering')
    expect(phases).toContain('ocr')
  })

  it('retorna texto vazio sem quebrar quando todas as páginas vazias', async () => {
    const pdf = makePdfMock(2)
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const renderPage = vi.fn(async () => ({ width: 1, height: 1 }))
    const createWorker = makeWorkerFactory([{ text: '', confidence: 0 }])

    const result = await runOcr(new ArrayBuffer(8), { renderPage, createWorker })

    expect(result.text).toBe('')
    expect(result.confidence).toBe(0)
    expect(result.pagesProcessed).toBe(2)
  })

  it('rejeita inputs inválidos', async () => {
    await expect(runOcr(123)).rejects.toThrow(/input deve ser/i)
  })

  it('termina o worker mesmo em caso de erro', async () => {
    const pdf = makePdfMock(1)
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdf) })

    const terminate = vi.fn(async () => {})
    const createWorker = vi.fn(async () => ({
      recognize: vi.fn(async () => {
        throw new Error('OCR boom')
      }),
      terminate,
    }))
    const renderPage = vi.fn(async () => ({ width: 1, height: 1 }))

    await expect(
      runOcr(new ArrayBuffer(8), { renderPage, createWorker })
    ).rejects.toThrow(/OCR boom/)
    expect(terminate).toHaveBeenCalled()
  })
})
