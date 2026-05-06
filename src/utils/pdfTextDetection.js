/**
 * pdfTextDetection — heurística para distinguir PDFs text-based de escaneados.
 *
 * Sprint 4 / Onda 2 / O2-2.
 *
 * Estratégia:
 *   1. Carrega o PDF via pdfjs-dist (sem renderizar).
 *   2. Para cada página, soma `getTextContent().items.length` e total de chars.
 *   3. charsPerPage < SCANNED_THRESHOLD (50) → escaneado.
 *   4. Confidence é proporcional à distância do threshold (sigmoide simples).
 *
 * Escolhas:
 *   - Não depende de canvas/render → leve (~50ms para PDFs típicos).
 *   - Usa o worker entregue pelo pdfjs-dist; quem chamar precisa garantir que
 *     o caminho do worker esteja resolvido (ver `configurePdfjsWorker`).
 *   - Returns shape estável para que `useOcrPipeline` possa logar / decidir.
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

const SCANNED_THRESHOLD_CHARS_PER_PAGE = 50
let workerConfigured = false

function configurePdfjsWorker() {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
  workerConfigured = true
}

async function fileToArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input
  if (input instanceof Uint8Array) return input.buffer
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return await input.arrayBuffer()
  }
  throw new Error('pdfTextDetection: input deve ser File, Blob, ArrayBuffer ou Uint8Array')
}

/**
 * @typedef {Object} PdfTextDetectionResult
 * @property {boolean} isScanned             — true se OCR é necessário
 * @property {number}  totalPages
 * @property {number}  totalChars            — soma de chars textuais em todas as páginas
 * @property {number}  charsPerPage          — média (totalChars / totalPages)
 * @property {number}  confidence            — 0..1 (quão certo o detector está)
 * @property {number[]} pagesWithLittleText  — índices 1-based com < threshold/4 chars
 */

/**
 * Detecta se um PDF é provavelmente escaneado (sem texto extraível).
 *
 * @param {File|Blob|ArrayBuffer|Uint8Array} input
 * @returns {Promise<PdfTextDetectionResult>}
 */
export async function detectIfScanned(input) {
  configurePdfjsWorker()
  const data = await fileToArrayBuffer(input)
  const loadingTask = pdfjsLib.getDocument({ data })
  const pdf = await loadingTask.promise

  const totalPages = pdf.numPages
  if (totalPages === 0) {
    return {
      isScanned: false,
      totalPages: 0,
      totalChars: 0,
      charsPerPage: 0,
      confidence: 1,
      pagesWithLittleText: [],
    }
  }

  let totalChars = 0
  const pagesWithLittleText = []
  const lowChars = SCANNED_THRESHOLD_CHARS_PER_PAGE / 4

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let pageChars = 0
    for (const item of content.items) {
      if (typeof item.str === 'string') pageChars += item.str.length
    }
    totalChars += pageChars
    if (pageChars < lowChars) pagesWithLittleText.push(i)
    page.cleanup()
  }

  const charsPerPage = totalChars / totalPages
  const isScanned = charsPerPage < SCANNED_THRESHOLD_CHARS_PER_PAGE

  // Confidence: distância em escala log do threshold.
  // charsPerPage = 0   → confidence ~1 (escaneado certo)
  // charsPerPage = 50  → confidence ~0 (em cima da linha)
  // charsPerPage = 500 → confidence ~1 (text-based certo)
  const distance = Math.abs(charsPerPage - SCANNED_THRESHOLD_CHARS_PER_PAGE)
  const confidence = Math.min(1, Math.log10(1 + distance) / 2)

  // Liberação de recursos
  await pdf.destroy()

  return {
    isScanned,
    totalPages,
    totalChars,
    charsPerPage,
    confidence,
    pagesWithLittleText,
  }
}

export const SCANNED_THRESHOLD = SCANNED_THRESHOLD_CHARS_PER_PAGE
