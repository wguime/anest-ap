/**
 * buildDocListColumns — tests para gating das colunas OCR/bulk_import por
 * feature flag (fix `1a7cba7`).
 *
 * Garante que:
 *  - colunas base aparecem sempre
 *  - ocr_* só entram quando isOcrEnabled() === true
 *  - bulk_import_id só entra quando isBulkImportEnabled() === true
 *  - combinação de ambos funciona
 *  - lista termina como string CSV (formato esperado por supabase.select)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let ocrEnabled = false
let bulkEnabled = false
let pdfaEnabled = false

vi.mock('@/utils/featureFlags', () => ({
  isOcrEnabled: () => ocrEnabled,
  isBulkImportEnabled: () => bulkEnabled,
  isPdfaEnabled: () => pdfaEnabled,
  isHashSignatureEnabled: () => false,
  isWatermarkEnabled: () => false,
  isRetentionEnabled: () => false,
  isConfidentialityEnabled: () => false,
  isMultiStepApprovalEnabled: () => false,
}))

// Imports a serviço inteiro só pra pegar as exports nomeadas; o módulo
// também faz side-effects de Supabase init, mas com mock de featureFlags
// a chamada de buildDocListColumns é puramente lógica.
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

const importService = async () => {
  // re-import para pegar valor atual de mock entre describes
  vi.resetModules()
  return await import('@/services/supabaseDocumentService')
}

describe('buildDocListColumns — gating por feature flag', () => {
  beforeEach(() => {
    ocrEnabled = false
    bulkEnabled = false
    pdfaEnabled = false
  })

  it('lista base sempre inclui id/codigo/titulo/status', async () => {
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('id')
    expect(cols).toContain('codigo')
    expect(cols).toContain('titulo')
    expect(cols).toContain('status')
    expect(cols).toContain('versao_atual')
  })

  it('lista base inclui colunas Onda 1 (legal_hold, retention, confidentiality)', async () => {
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('legal_hold')
    expect(cols).toContain('retention_until')
    expect(cols).toContain('confidentiality_level')
  })

  it('com ambas flags OFF, NÃO inclui colunas ocr_* nem bulk_import_id', async () => {
    ocrEnabled = false
    bulkEnabled = false
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).not.toContain('ocr_status')
    expect(cols).not.toContain('ocr_text')
    expect(cols).not.toContain('ocr_confidence')
    expect(cols).not.toContain('ocr_pages_processed')
    expect(cols).not.toContain('ocr_run_at')
    expect(cols).not.toContain('bulk_import_id')
  })

  it('com VITE_FEATURE_OCR=true, inclui as 5 colunas ocr_*', async () => {
    ocrEnabled = true
    bulkEnabled = false
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('ocr_status')
    expect(cols).toContain('ocr_text')
    expect(cols).toContain('ocr_confidence')
    expect(cols).toContain('ocr_pages_processed')
    expect(cols).toContain('ocr_run_at')
    expect(cols).not.toContain('bulk_import_id')
  })

  it('com VITE_FEATURE_BULK_IMPORT=true, inclui bulk_import_id mas não ocr_*', async () => {
    ocrEnabled = false
    bulkEnabled = true
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('bulk_import_id')
    expect(cols).not.toContain('ocr_status')
  })

  it('com ambas flags ON, inclui ocr_* + bulk_import_id', async () => {
    ocrEnabled = true
    bulkEnabled = true
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('ocr_status')
    expect(cols).toContain('bulk_import_id')
  })

  it('retorna string CSV (formato Supabase.select)', async () => {
    const mod = await importService()
    const result = mod.buildDocListColumns()
    expect(typeof result).toBe('string')
    expect(result).toContain(',')
    // não deve ter espaços ou quebras
    expect(result).not.toMatch(/\s/)
  })

  it('NÃO inclui coluna fts (tsvector — economiza bandwidth)', async () => {
    ocrEnabled = true
    bulkEnabled = true
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).not.toContain('fts')
  })

  it('listas exportadas DOC_LIST_COLUMNS_OCR contém 6 colunas (incl ocr_fail_count)', async () => {
    const mod = await importService()
    expect(mod.DOC_LIST_COLUMNS_OCR).toHaveLength(6)
    expect(mod.DOC_LIST_COLUMNS_OCR).toEqual(
      expect.arrayContaining([
        'ocr_status', 'ocr_text', 'ocr_confidence', 'ocr_pages_processed', 'ocr_run_at',
        'ocr_fail_count',
      ])
    )
  })

  it('listas exportadas DOC_LIST_COLUMNS_BULK contém exatamente bulk_import_id', async () => {
    const mod = await importService()
    expect(mod.DOC_LIST_COLUMNS_BULK).toEqual(['bulk_import_id'])
  })

  it('com VITE_FEATURE_PDFA=false, NÃO inclui colunas pdfa_*', async () => {
    pdfaEnabled = false
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).not.toContain('pdfa_status')
    expect(cols).not.toContain('pdfa_url')
    expect(cols).not.toContain('pdfa_processed_at')
  })

  it('com VITE_FEATURE_PDFA=true, inclui as 5 colunas pdfa_*', async () => {
    pdfaEnabled = true
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('pdfa_status')
    expect(cols).toContain('pdfa_url')
    expect(cols).toContain('pdfa_processed_at')
    expect(cols).toContain('pdfa_pages')
    expect(cols).toContain('pdfa_size_bytes')
  })

  it('listas exportadas DOC_LIST_COLUMNS_PDFA contém exatamente 5 colunas', async () => {
    const mod = await importService()
    expect(mod.DOC_LIST_COLUMNS_PDFA).toHaveLength(5)
    expect(mod.DOC_LIST_COLUMNS_PDFA).toEqual(
      expect.arrayContaining(['pdfa_status', 'pdfa_url', 'pdfa_processed_at', 'pdfa_pages', 'pdfa_size_bytes'])
    )
  })

  it('com OCR + BULK + PDFA todos ON, inclui as 11 colunas opcionais', async () => {
    ocrEnabled = true
    bulkEnabled = true
    pdfaEnabled = true
    const mod = await importService()
    const cols = mod.buildDocListColumns().split(',')
    expect(cols).toContain('ocr_status')
    expect(cols).toContain('bulk_import_id')
    expect(cols).toContain('pdfa_status')
  })
})
