/**
 * pdfTextExtraction — extrai texto puro de um PDF para comparação de versões
 * (Sprint 8 / O2-8).
 *
 * Reusa pdfjs-dist (já dep). Diferente de `pdfTextDetection.js` que apenas
 * conta chars para detectar PDF escaneado, aqui retornamos o conteúdo
 * textual completo — para alimentar diff client-side.
 *
 * Estratégia:
 *   - getTextContent() por página, juntar items.str respeitando .hasEOL
 *   - Páginas separadas por '\n\n--- Página N ---\n'
 *   - Trim final para evitar diff espúrio em whitespace de borda
 *
 * Limites:
 *   - PDFs escaneados retornam string vazia ou quase vazia. Para esses,
 *     priorizar `documento.ocr_text` (Sprint 4) — o caller decide.
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

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
  if (typeof input === 'string') {
    // URL — fetch
    const r = await fetch(input)
    if (!r.ok) throw new Error(`extractTextFromPdf: HTTP ${r.status} ao buscar ${input.slice(0, 80)}`)
    return await r.arrayBuffer()
  }
  throw new Error('extractTextFromPdf: input deve ser URL string, File, Blob, ArrayBuffer ou Uint8Array')
}

/**
 * @typedef {Object} ExtractedText
 * @property {string} text
 * @property {number} totalPages
 * @property {string[]} pages — array de string por página (sem header)
 * @property {string|null} error
 */

/**
 * Extrai texto puro de um PDF.
 *
 * @param {File|Blob|ArrayBuffer|Uint8Array|string} input
 * @returns {Promise<ExtractedText>}
 */
export async function extractTextFromPdf(input) {
  configurePdfjsWorker()
  const data = await fileToArrayBuffer(input)

  let pdf = null
  try {
    const task = pdfjsLib.getDocument({ data })
    try {
      pdf = await task.promise
    } catch (loadErr) {
      const code = loadErr?.name === 'PasswordException' ? 'encrypted' : 'load_failed'
      return { text: '', totalPages: 0, pages: [], error: code }
    }

    const totalPages = pdf.numPages
    const pages = []
    const allParts = []

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const lineParts = []
        let currentLine = []
        for (const item of content.items) {
          if (typeof item.str !== 'string') continue
          currentLine.push(item.str)
          if (item.hasEOL) {
            lineParts.push(currentLine.join(' ').trim())
            currentLine = []
          }
        }
        if (currentLine.length) lineParts.push(currentLine.join(' ').trim())
        const pageText = lineParts.filter((l) => l.length > 0).join('\n')
        pages.push(pageText)
        if (pageText) {
          allParts.push(`--- Página ${i} ---\n${pageText}`)
        }
        page.cleanup?.()
      } catch (_pageErr) {
        pages.push('')
      }
    }

    return {
      text: allParts.join('\n\n').trim(),
      totalPages,
      pages,
      error: null,
    }
  } finally {
    try { await pdf?.destroy?.() } catch (_) { /* ignore */ }
  }
}
