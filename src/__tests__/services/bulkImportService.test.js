/**
 * Sprint 5 / O2-4 — bulkImportService tests
 *
 * Cobre:
 *   1. createJob registra started_by e total_files
 *   2. validateBulkRow detecta MIME inválido, size > 50MB, dedupe, missing
 *   3. findExistingCodigos consulta documentos.codigo
 *   4. processFile success path (upload + createDocument + retorno ok)
 *   5. processFile com OCR fire-and-forget
 *   6. processFile partial failure (validateFile lança → ok=false)
 *   7. processBulkImport processa em chunks, status final 'partial' / 'done' / 'failed'
 *   8. processBulkImport vazio rejeita
 *   9. requireUserId enforced
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockIs = vi.fn()
const mockIn = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockRpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
const mockFrom = vi.fn()

let nextResult = { data: null, error: null }
let nextSelectInResult = { data: [], error: null }

function buildChain() {
  // Thenable chain: every filter method returns chain. await chain → resolves
  // with nextSelectInResult. .single() short-circuits with nextResult.
  const chain = {
    insert: vi.fn((payload) => {
      mockInsert(payload)
      return chain
    }),
    update: vi.fn((payload) => {
      mockUpdate(payload)
      return chain
    }),
    select: vi.fn((cols) => {
      mockSelect(cols)
      return chain
    }),
    eq: vi.fn((col, val) => {
      mockEq(col, val)
      return chain
    }),
    is: vi.fn((col, val) => {
      mockIs(col, val)
      return chain
    }),
    in: vi.fn((col, vals) => {
      mockIn(col, vals)
      return chain
    }),
    single: vi.fn(async () => {
      mockSingle()
      return nextResult
    }),
    order: vi.fn(() => {
      mockOrder()
      return chain
    }),
    limit: vi.fn(() => {
      mockLimit()
      return chain
    }),
    then: (resolve) => resolve(nextSelectInResult),
  }
  return chain
}

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((t) => {
      mockFrom(t)
      return buildChain()
    }),
    rpc: (...args) => mockRpc(...args),
  },
}))

const validateFileMock = vi.fn()
vi.mock('@/services/uploadService', () => ({
  validateFile: (...args) => validateFileMock(...args),
  ACCEPTED_DOCUMENT_TYPES: ['application/pdf'],
}))

const uploadFileMock = vi.fn(async (file, cat, docId) => ({ path: `${cat}/${docId}/v1/${file.name}` }))
const createDocumentMock = vi.fn(async (cat, data) => ({ ...data }))
const logActionMock = vi.fn(async () => {})
const deleteFileMock = vi.fn(async () => {})
vi.mock('@/services/supabaseDocumentService', () => {
  const fns = {
    uploadFile: (...args) => uploadFileMock(...args),
    createDocument: (...args) => createDocumentMock(...args),
    logAction: (...args) => logActionMock(...args),
    deleteFile: (...args) => deleteFileMock(...args),
  }
  return { default: fns, ...fns }
})

let ocrEnabled = false
vi.mock('@/utils/featureFlags', () => ({
  isOcrEnabled: () => ocrEnabled,
}))

// ----------------------------------------------------------------------------
// Subject
// ----------------------------------------------------------------------------
import bulkImport, {
  createJob,
  validateBulkRow,
  findExistingCodigos,
  processFile,
  processBulkImport,
} from '../../services/bulkImportService.js'

const validUser = { userId: 'fb-uid-bulk', userName: 'Admin Bulk', userEmail: 'a@a.com' }

function fakeFile(name = 'doc.pdf', size = 1024, type = 'application/pdf') {
  return { name, size, type }
}

beforeEach(() => {
  vi.clearAllMocks()
  ocrEnabled = false
  nextResult = { data: { id: 'job-uuid-1' }, error: null }
  nextSelectInResult = { data: [], error: null }
  validateFileMock.mockReset()
})

describe('createJob', () => {
  it('grava started_by e total_files', async () => {
    const { id } = await createJob({ totalFiles: 7, source: 'manual_upload' }, validUser)
    expect(id).toBe('job-uuid-1')
    expect(mockFrom).toHaveBeenCalledWith('bulk_import_jobs')
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      started_by: 'fb-uid-bulk',
      total_files: 7,
      status: 'pending',
      source: 'manual_upload',
    })
  })

  it('exige userInfo.userId', async () => {
    await expect(createJob({ totalFiles: 1 }, {})).rejects.toThrow(/User ID/)
  })
})

describe('validateBulkRow', () => {
  it('detecta MIME não-PDF', () => {
    const issues = validateBulkRow(fakeFile('a.docx', 1024, 'application/vnd...'), { titulo: 't', categoria: 'biblioteca' }, new Set())
    expect(issues.some((i) => i.includes('Tipo inválido'))).toBe(true)
  })

  it('detecta arquivo >50MB', () => {
    const big = fakeFile('big.pdf', 60 * 1024 * 1024)
    const issues = validateBulkRow(big, { titulo: 't', categoria: 'biblioteca' }, new Set())
    expect(issues.some((i) => i.includes('> 50 MB'))).toBe(true)
  })

  it('exige titulo e categoria', () => {
    const issues = validateBulkRow(fakeFile(), {}, new Set())
    expect(issues).toContain('Título obrigatório')
    expect(issues).toContain('Categoria obrigatória')
  })

  it('detecta codigo duplicado dentro do batch', () => {
    const seen = new Set()
    const meta = { titulo: 't', categoria: 'biblioteca', codigo: 'DOC-001' }
    expect(validateBulkRow(fakeFile(), meta, seen)).toEqual([])
    const issues = validateBulkRow(fakeFile('b.pdf'), meta, seen)
    expect(issues.some((i) => i.includes('duplicado'))).toBe(true)
  })

  it('aceita linha válida', () => {
    const issues = validateBulkRow(
      fakeFile(),
      { titulo: 'OK', categoria: 'biblioteca', codigo: 'POL-1' },
      new Set()
    )
    expect(issues).toEqual([])
  })
})

describe('findExistingCodigos', () => {
  it('retorna Set vazio para input vazio', async () => {
    expect((await findExistingCodigos([])).size).toBe(0)
  })

  it('consulta documentos.codigo com .in()', async () => {
    nextSelectInResult = { data: [{ codigo: 'POL-1' }], error: null }
    const set = await findExistingCodigos(['POL-1', 'POL-2'])
    expect(set.has('POL-1')).toBe(true)
    expect(set.has('POL-2')).toBe(false)
    expect(mockIn).toHaveBeenCalledWith('codigo', ['POL-1', 'POL-2'])
    expect(mockIs).toHaveBeenCalledWith('deleted_at', null)
  })
})

describe('processFile', () => {
  it('success: chama uploadFile + createDocument com bulkImportId', async () => {
    const file = fakeFile('proto.pdf', 4096)
    const result = await processFile({
      jobId: 'job-X',
      file,
      meta: { titulo: 'Protocolo', categoria: 'biblioteca', codigo: 'POL-9' },
      userInfo: validUser,
    })

    expect(result.ok).toBe(true)
    expect(uploadFileMock).toHaveBeenCalled()
    expect(createDocumentMock).toHaveBeenCalled()
    const docArg = createDocumentMock.mock.calls[0][1]
    expect(docArg.bulkImportId).toBe('job-X')
    expect(docArg.titulo).toBe('Protocolo')
  })

  it('falha em validateFile retorna ok=false sem chamar upload', async () => {
    validateFileMock.mockImplementationOnce(() => {
      throw new Error('invalid mime')
    })
    const result = await processFile({
      jobId: 'job-X',
      file: fakeFile('bad.txt', 1, 'text/plain'),
      meta: { titulo: 'X', categoria: 'biblioteca' },
      userInfo: validUser,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid mime/)
    expect(uploadFileMock).not.toHaveBeenCalled()
  })

  it('OCR é disparado quando flag ON e starter passado', async () => {
    ocrEnabled = true
    const ocrStarter = vi.fn(async () => {})
    await processFile({
      jobId: 'job-X',
      file: fakeFile(),
      meta: { titulo: 'T', categoria: 'biblioteca' },
      userInfo: validUser,
      ocrPipelineStarter: ocrStarter,
    })
    // OCR é fire-and-forget — esperar microtask
    await Promise.resolve()
    await Promise.resolve()
    expect(ocrStarter).toHaveBeenCalled()
  })

  it('OCR NÃO dispara quando flag OFF', async () => {
    ocrEnabled = false
    const ocrStarter = vi.fn(async () => {})
    await processFile({
      jobId: 'job-X',
      file: fakeFile(),
      meta: { titulo: 'T', categoria: 'biblioteca' },
      userInfo: validUser,
      ocrPipelineStarter: ocrStarter,
    })
    await Promise.resolve()
    expect(ocrStarter).not.toHaveBeenCalled()
  })
})

describe('processBulkImport', () => {
  it('rejeita batch vazio', async () => {
    await expect(
      processBulkImport({ entries: [], userInfo: validUser })
    ).rejects.toThrow(/entries vazio/)
  })

  it('todos os arquivos OK → status done', async () => {
    const entries = [
      { file: fakeFile('a.pdf'), meta: { titulo: 'A', categoria: 'biblioteca' } },
      { file: fakeFile('b.pdf'), meta: { titulo: 'B', categoria: 'biblioteca' } },
    ]
    const onProgress = vi.fn()
    const result = await processBulkImport({
      entries,
      userInfo: validUser,
      onProgress,
      chunkSize: 2,
    })

    expect(result.processed).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.status).toBe('done')
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'starting' }))
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'done', status: 'done' }))
  })

  it('alguns falham → status partial', async () => {
    let call = 0
    validateFileMock.mockImplementation(() => {
      call += 1
      if (call === 2) throw new Error('boom')
    })
    const entries = [
      { file: fakeFile('a.pdf'), meta: { titulo: 'A', categoria: 'biblioteca' } },
      { file: fakeFile('b.pdf'), meta: { titulo: 'B', categoria: 'biblioteca' } },
    ]
    const result = await processBulkImport({ entries, userInfo: validUser, chunkSize: 2 })
    expect(result.processed).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.status).toBe('partial')
    expect(result.errors[0]).toMatchObject({ ok: false, error: expect.stringMatching(/boom/) })
  })

  it('todos falham → status failed', async () => {
    validateFileMock.mockImplementation(() => {
      throw new Error('always fails')
    })
    const entries = [
      { file: fakeFile('a.pdf'), meta: { titulo: 'A', categoria: 'biblioteca' } },
    ]
    const result = await processBulkImport({ entries, userInfo: validUser })
    expect(result.status).toBe('failed')
    expect(result.processed).toBe(0)
  })
})

describe('default export', () => {
  it('expõe API completa', () => {
    expect(bulkImport.MAX_FILE_SIZE).toBe(50 * 1024 * 1024)
    expect(bulkImport.MAX_FILES_PER_JOB).toBe(200)
    expect(typeof bulkImport.processBulkImport).toBe('function')
  })
})

describe('audit v3.72.1 fixes', () => {
  it('processFile sucesso registra logAction com action=bulk_imported', async () => {
    await processFile({
      jobId: 'job-AUDIT',
      file: fakeFile('audit.pdf'),
      meta: { titulo: 'Audit', categoria: 'biblioteca' },
      userInfo: validUser,
    })
    expect(logActionMock).toHaveBeenCalled()
    const [docId, action, , changes] = logActionMock.mock.calls[0]
    expect(action).toBe('bulk_imported')
    expect(typeof docId).toBe('string')
    expect(changes).toMatchObject({ bulk_import_job_id: 'job-AUDIT', file_name: 'audit.pdf' })
  })

  it('processFile chama deleteFile quando createDocument falha após upload', async () => {
    createDocumentMock.mockImplementationOnce(() => { throw new Error('db down') })
    const result = await processFile({
      jobId: 'job-X',
      file: fakeFile('p.pdf'),
      meta: { titulo: 'X', categoria: 'biblioteca' },
      userInfo: validUser,
    })
    expect(result.ok).toBe(false)
    expect(deleteFileMock).toHaveBeenCalled()
  })

  it('processBulkImport rejeita > MAX_FILES_PER_JOB', async () => {
    const entries = Array.from({ length: 201 }, (_, i) => ({
      file: fakeFile(`f${i}.pdf`),
      meta: { titulo: `F${i}`, categoria: 'biblioteca' },
    }))
    await expect(
      processBulkImport({ entries, userInfo: validUser })
    ).rejects.toThrow(/máximo 200 arquivos/)
  })

  it('validateBulkRow rejeita arquivo com MIME vazio', () => {
    const file = fakeFile('a.pdf', 1024, '')
    const issues = validateBulkRow(file, { titulo: 't', categoria: 'biblioteca' }, new Set())
    expect(issues.some((i) => i.includes('Tipo inválido'))).toBe(true)
  })
})
