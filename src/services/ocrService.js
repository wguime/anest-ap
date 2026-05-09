/**
 * ocrService — pipeline OCR client-side com Tesseract WASM (Sprint 4 / O2-2).
 *
 * Roda inteiramente no browser do usuário: PDF → render por página → canvas
 * → Tesseract worker WASM → texto + confidence agregados. Tessdata é baixada
 * do CDN oficial do tesseract.js (lang='por'), cacheada pelo browser.
 *
 * Privacy-first: nenhum byte do documento sai do device. Compatível com a
 * regra LGPD do projeto.
 *
 * Limites:
 *   - Renderização canvas precisa de OffscreenCanvas ou DOM canvas. Usamos
 *     <canvas> oculto (browser only). Em ambiente de teste (jsdom) o
 *     pipeline aceita um `renderPage` injetado para mock.
 *   - PDFs com >50 páginas devem chamar com `maxPages` para limitar custo.
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

const DEFAULT_LANG = 'por'
const DEFAULT_SCALE = 2.0 // boa precisão sem inflar memória; 3.0 dá ganho marginal e custa muito.
const ENGINE_ID = 'tesseract-wasm-v5-por'

let workerConfigured = false
function configurePdfjsWorker() {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
  workerConfigured = true
}

async function fileToArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input
  if (input instanceof Uint8Array) return input.buffer
  if (typeof Blob !== 'undefined' && input instanceof Blob) return await input.arrayBuffer()
  throw new Error('ocrService: input deve ser File, Blob, ArrayBuffer ou Uint8Array')
}

/**
 * Renderiza uma página PDF em canvas e retorna o ImageData / DataURL para OCR.
 * Pode ser substituído via opts.renderPage para testes.
 */
async function defaultRenderPage(page, scale = DEFAULT_SCALE) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  // Tesseract aceita HTMLCanvasElement diretamente — é o caminho mais rápido.
  return canvas
}

/**
 * @typedef {Object} OcrResult
 * @property {string} text                    — texto agregado (páginas separadas por \n\n)
 * @property {number} confidence              — média ponderada por página (0-1)
 * @property {number} pagesProcessed
 * @property {number} totalPages
 * @property {number} durationMs
 * @property {string} engine                  — identificador da engine
 * @property {Array<{page:number, chars:number, confidence:number}>} pagesMeta
 */

/**
 * Executa OCR em um PDF.
 *
 * @param {File|Blob|ArrayBuffer|Uint8Array} input
 * @param {Object} [opts]
 * @param {string} [opts.lang='por']
 * @param {number} [opts.scale=2]
 * @param {number} [opts.maxPages]              — limita páginas (default: todas)
 * @param {(p:{page:number,total:number,phase:string,progress?:number})=>void} [opts.onProgress]
 * @param {Function} [opts.renderPage]          — injetável p/ teste
 * @param {Function} [opts.createWorker]        — injetável p/ teste (de tesseract.js)
 * @returns {Promise<OcrResult>}
 */
export async function runOcr(input, opts = {}) {
  const {
    lang = DEFAULT_LANG,
    scale = DEFAULT_SCALE,
    maxPages,
    onProgress,
    renderPage = defaultRenderPage,
    createWorker,
    signal,
  } = opts

  const checkAborted = () => {
    if (signal?.aborted) {
      const err = new Error('OCR aborted')
      err.name = 'AbortError'
      throw err
    }
  }

  const t0 = Date.now()

  // Lazy import — tesseract.js é grande (~2-3MB) e só queremos baixar quando
  // OCR for de fato disparado.
  const tesseract =
    createWorker ??
    (await import('tesseract.js').then((m) => m.createWorker))

  configurePdfjsWorker()
  const data = await fileToArrayBuffer(input)
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const totalPages = pdf.numPages
  const pagesToProcess = maxPages ? Math.min(totalPages, maxPages) : totalPages

  onProgress?.({ page: 0, total: pagesToProcess, phase: 'init' })

  let worker
  try {
    worker = await tesseract(lang, 1, {
      logger: (m) => {
        if (m?.status === 'recognizing text' && onProgress) {
          onProgress({
            page: -1,
            total: pagesToProcess,
            phase: 'recognizing',
            progress: m.progress,
          })
        }
      },
    })

    const pagesMeta = []
    const textParts = []

    for (let i = 1; i <= pagesToProcess; i++) {
      checkAborted()
      onProgress?.({ page: i, total: pagesToProcess, phase: 'rendering' })
      const page = await pdf.getPage(i)
      const canvas = await renderPage(page, scale)

      checkAborted()
      onProgress?.({ page: i, total: pagesToProcess, phase: 'ocr' })
      const { data: ocr } = await worker.recognize(canvas)
      const text = (ocr?.text || '').trim()
      const confidence = typeof ocr?.confidence === 'number' ? ocr.confidence / 100 : 0

      pagesMeta.push({ page: i, chars: text.length, confidence })
      if (text) textParts.push(text)

      page.cleanup?.()
      // Liberar canvas grande
      if (canvas?.width) {
        canvas.width = 0
        canvas.height = 0
      }
    }

    const aggregateText = textParts.join('\n\n')
    const totalChars = pagesMeta.reduce((sum, p) => sum + p.chars, 0)
    const weightedConfidence =
      totalChars > 0
        ? pagesMeta.reduce((sum, p) => sum + p.confidence * p.chars, 0) / totalChars
        : 0

    return {
      text: aggregateText,
      confidence: Number(weightedConfidence.toFixed(4)),
      pagesProcessed: pagesToProcess,
      totalPages,
      durationMs: Date.now() - t0,
      engine: ENGINE_ID,
      pagesMeta,
    }
  } finally {
    try {
      await worker?.terminate?.()
    } catch {
      // worker pode já estar morto — ignora
    }
    try {
      await pdf?.destroy?.()
    } catch {
      // ignora
    }
  }
}

export const OCR_ENGINE = ENGINE_ID
