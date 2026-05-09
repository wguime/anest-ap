/**
 * textDiff — comparação de versões de texto (Sprint 8 / O2-8).
 *
 * Usa lib `diff` v8 (já dep via shadcn). Trabalha com texto puro extraído
 * de PDFs (ou ocr_text para versões escaneadas).
 *
 * Modelo:
 *   - diffLines: granularidade linha-a-linha (mais útil para PDFs onde
 *     parágrafos quebram em linhas)
 *   - diffWords: granularidade palavra (segundo nível de detalhe — opcional)
 *
 * Output: array de hunks `{ value, added, removed, count }` que o caller
 * (modal de comparação) renderiza com cores.
 */

import { diffLines, diffWordsWithSpace, createPatch } from 'diff'

/**
 * @typedef {Object} DiffHunk
 * @property {string}  value
 * @property {boolean} added     — linha presente em B mas não em A
 * @property {boolean} removed   — linha presente em A mas não em B
 * @property {number}  count     — quantas linhas
 */

/**
 * @typedef {Object} DiffSummary
 * @property {number} addedLines
 * @property {number} removedLines
 * @property {number} unchangedLines
 * @property {number} totalChunks
 * @property {boolean} hasChanges
 */

const DEFAULT_OPTS = {
  ignoreWhitespace: true,
  newlineIsToken: false,
}

/**
 * Diff linha-a-linha entre duas strings de texto.
 *
 * @param {string} textA — versão antiga
 * @param {string} textB — versão nova
 * @param {object} [opts]
 * @returns {{ hunks: DiffHunk[], summary: DiffSummary }}
 */
export function diffTextLines(textA, textB, opts = {}) {
  const a = typeof textA === 'string' ? textA : ''
  const b = typeof textB === 'string' ? textB : ''
  const merged = { ...DEFAULT_OPTS, ...opts }
  const raw = diffLines(a, b, merged)

  let addedLines = 0
  let removedLines = 0
  let unchangedLines = 0
  for (const part of raw) {
    if (part.added) addedLines += part.count ?? 0
    else if (part.removed) removedLines += part.count ?? 0
    else unchangedLines += part.count ?? 0
  }

  return {
    hunks: raw.map((p) => ({
      value: p.value,
      added: !!p.added,
      removed: !!p.removed,
      count: p.count ?? 0,
    })),
    summary: {
      addedLines,
      removedLines,
      unchangedLines,
      totalChunks: raw.length,
      hasChanges: addedLines > 0 || removedLines > 0,
    },
  }
}

/**
 * Diff palavra-a-palavra (granular) entre duas strings.
 * Útil para destacar mudanças finas dentro de uma linha alterada.
 */
export function diffTextWords(textA, textB) {
  const a = typeof textA === 'string' ? textA : ''
  const b = typeof textB === 'string' ? textB : ''
  return diffWordsWithSpace(a, b).map((p) => ({
    value: p.value,
    added: !!p.added,
    removed: !!p.removed,
    count: p.count ?? 0,
  }))
}

/**
 * Gera patch unified (string) — útil para download/auditoria.
 *
 * @param {string} fileName    — nome lógico para header do patch (ex: 'protocolo.pdf')
 * @param {string} textA
 * @param {string} textB
 * @param {string} [labelA]
 * @param {string} [labelB]
 */
export function buildUnifiedPatch(fileName, textA, textB, labelA = 'v_anterior', labelB = 'v_nova') {
  return createPatch(fileName, textA || '', textB || '', labelA, labelB)
}

/**
 * Trunca cada hunk preservando lados das mudanças (context).
 * Útil para previews compactos: mostra ±contextLines linhas de contexto
 * em torno de cada bloco added/removed e omite o resto.
 */
export function compactHunks(hunks, contextLines = 3) {
  if (!Array.isArray(hunks)) return []
  const out = []
  for (let i = 0; i < hunks.length; i++) {
    const h = hunks[i]
    if (h.added || h.removed) {
      out.push(h)
      continue
    }
    const lines = h.value.split('\n')
    const prevWasChange = i > 0 && (hunks[i - 1].added || hunks[i - 1].removed)
    const nextWillChange = i < hunks.length - 1 && (hunks[i + 1].added || hunks[i + 1].removed)
    if (prevWasChange && nextWillChange && lines.length > contextLines * 2) {
      const head = lines.slice(0, contextLines).join('\n')
      const tail = lines.slice(-contextLines).join('\n')
      out.push({ value: head + '\n...\n' + tail, added: false, removed: false, count: contextLines * 2 + 1 })
    } else if (prevWasChange && lines.length > contextLines) {
      out.push({ value: lines.slice(0, contextLines).join('\n') + '\n...', added: false, removed: false, count: contextLines + 1 })
    } else if (nextWillChange && lines.length > contextLines) {
      out.push({ value: '...\n' + lines.slice(-contextLines).join('\n'), added: false, removed: false, count: contextLines + 1 })
    } else {
      out.push(h)
    }
  }
  return out
}
