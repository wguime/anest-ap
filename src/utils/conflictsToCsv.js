/**
 * conflictsToCsv — helper canônico para exportar a fila de conflitos offline
 * (`documento_conflict_queue`) em CSV consumível por Excel/Sheets.
 *
 * Sprint 15a / F6.3 closeout (A2.b). Substitui o helper inline anterior em
 * `ConflictsTab.jsx`; agora compartilhado e testável.
 *
 * RFC 4180 highlights:
 *   - separator = `,` (US/Excel default; pt-BR Excel também aceita)
 *   - escape de aspas: `"` → `""` dentro de campo
 *   - campo é envolvido em aspas se contiver `,`, `"`, `\n` ou `\r`
 *   - linha encerrada por `\n` (LF) — Excel/Sheets aceitam ambos
 *
 * BOM (`﻿`): Excel pt-BR detecta UTF-8 corretamente só com BOM no início.
 * Sem BOM, acentos quebram (Ã£, Ã©, etc.). Por isso `downloadConflictsCsv`
 * prepende `﻿` antes do CSV.
 *
 * `payload` e `server_state` são incluídos no CSV (admin tool — não LGPD-bound;
 * apenas a notificação ao user é que não pode conter esses campos).
 */

const HEADERS = [
  'id',
  'op_id',
  'op_string',
  'user_name',
  'user_id',
  'status',
  'created_at',
  'resolved_by',
  'resolved_at',
  'resolution_notes',
  'payload_json',
  'server_state_json',
]

function escapeField(val) {
  if (val === null || val === undefined) return ''
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Serializa array de conflitos (camelCase) para string CSV.
 *
 * @param {Array<Object>} conflicts - Rows em camelCase (output do service).
 * @returns {string} CSV completo (header + linhas), separador `\n`.
 */
export function conflictsToCsv(conflicts) {
  const rows = (conflicts || []).map((c) =>
    [
      c.id,
      c.opId,
      c.opString,
      c.userName,
      c.userId,
      c.status,
      c.createdAt,
      c.resolvedBy,
      c.resolvedAt,
      c.resolutionNotes,
      c.payload,
      c.serverState,
    ]
      .map(escapeField)
      .join(',')
  )
  return [HEADERS.join(','), ...rows].join('\n')
}

/**
 * Dispara o download do CSV via `<a>` + `URL.createObjectURL`. Prepende BOM
 * UTF-8 para Excel pt-BR detectar charset corretamente.
 *
 * @param {Array<Object>} conflicts - Rows filtradas que o admin quer exportar.
 * @param {string} [filename] - Default: `conflitos-YYYY-MM-DD.csv`.
 */
export function downloadConflictsCsv(conflicts, filename) {
  const csv = conflictsToCsv(conflicts)
  // ﻿ = BOM UTF-8 (3 bytes EF BB BF). Excel pt-BR exige.
  const blob = new Blob(['﻿' + csv], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename || `conflitos-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Export default agregado para conveniência.
export default {
  conflictsToCsv,
  downloadConflictsCsv,
}
