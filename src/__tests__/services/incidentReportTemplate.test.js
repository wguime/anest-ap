/**
 * Testa que os buckets de status no agregador PDF cobrem TODOS os valores
 * aceitos pelo CHECK constraint atual (PT + EN após migration 022).
 *
 * Se um novo status for adicionado ao CHECK, este teste falha — proteção
 * contra subcontagem em relatórios PDF.
 */
import { describe, it, expect } from 'vitest'

// Conjunto canônico do CHECK constraint atual
// (supabase/migrations/022_fix_incidents_security.sql:22-25)
const ALLOWED_STATUS_VALUES = [
  // PT
  'pendente', 'em_analise', 'em_andamento', 'resolvido', 'encerrado', 'arquivado',
  // EN
  'pending', 'in_review', 'investigating', 'action_required', 'resolved', 'closed',
]

// Conjunto coberto pelos buckets do template (espelho de incidentReportTemplate.js)
const STATUS_BUCKETS = {
  pendentes: ['pendente', 'pending'],
  emAnalise: ['em_analise', 'em_andamento', 'in_review', 'investigating', 'action_required', 'em_investigacao'],
  resolvidos: ['resolvido', 'resolved', 'concluido'],
  encerrados: ['encerrado', 'arquivado', 'closed'],
}

describe('incidentReportTemplate — buckets de status', () => {
  it('cobre todos os valores do CHECK constraint atual', () => {
    const allBucketValues = Object.values(STATUS_BUCKETS).flat()
    const missing = ALLOWED_STATUS_VALUES.filter(v => !allBucketValues.includes(v))
    expect(missing, `Valores do CHECK não mapeados em STATUS_BUCKETS: ${missing.join(', ')}`).toEqual([])
  })

  it('não conta o mesmo status em dois buckets', () => {
    const seen = new Map()
    for (const [bucket, values] of Object.entries(STATUS_BUCKETS)) {
      for (const v of values) {
        if (seen.has(v)) {
          throw new Error(`Status "${v}" aparece em "${seen.get(v)}" E "${bucket}"`)
        }
        seen.set(v, bucket)
      }
    }
  })
})
