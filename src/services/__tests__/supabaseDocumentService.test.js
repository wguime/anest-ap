/**
 * W3-4 — supabaseDocumentService: pagination, atomic recordView, atomic addVersion
 *
 * Asserts:
 *   1. fetchAllDocuments paginates correctly:
 *      - default call uses .range(0, 49) and a select that EXCLUDES `fts`
 *      - custom { pageSize, offset } maps to .range(offset, offset + pageSize - 1)
 *   2. recordView calls supabase.rpc('rpc_increment_view_count', { p_doc_id, p_user_id, ... })
 *      and does NOT do a read-then-write on documentos.view_count
 *   3. addVersion calls supabase.rpc('rpc_add_document_version', ...) and
 *      returns the inserted version row in camelCase
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ----------------------------------------------------------------------------
// Mock Supabase client (chain mock)
// ----------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

// Each `from(...)` returns a fresh chain. The chain methods all log calls
// and return `this`, except terminal methods that resolve to a value.
function buildChain({ selectResult, upsertResult } = {}) {
  const chain = {
    select: vi.fn((cols) => {
      mockSelect(cols);
      return chain;
    }),
    order: vi.fn((col, opts) => {
      mockOrder(col, opts);
      return chain;
    }),
    range: vi.fn((from, to) => {
      mockRange(from, to);
      // .range is terminal in fetchAllDocuments — return a thenable
      return Promise.resolve(selectResult ?? { data: [], error: null });
    }),
    upsert: vi.fn((payload, opts) => {
      mockUpsert(payload, opts);
      // .upsert in this service is awaited directly (no .select chained)
      return Promise.resolve(upsertResult ?? { data: null, error: null });
    }),
    update: vi.fn((payload) => {
      mockUpdate(payload);
      return chain;
    }),
    eq: vi.fn((col, val) => {
      mockEq(col, val);
      return chain;
    }),
    single: vi.fn(() => {
      mockSingle();
      return Promise.resolve({ data: null, error: null });
    }),
  };
  return chain;
}

let chainConfig = {};

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      mockFrom(table);
      return buildChain(chainConfig[table] || {});
    }),
    rpc: (...args) => mockRpc(...args),
  },
}));

// uploadService stubbed (imported by the service module)
vi.mock('@/services/uploadService', () => ({
  validateFile: vi.fn(),
  ACCEPTED_DOCUMENT_TYPES: ['application/pdf'],
}));

// ----------------------------------------------------------------------------
// Subject under test
// ----------------------------------------------------------------------------
import supabaseDocumentService from '../supabaseDocumentService';

const validUser = {
  userId: 'firebase-uid-abc',
  userName: 'Dra. Teste',
  userEmail: 'teste@anest.com.br',
};

beforeEach(() => {
  vi.clearAllMocks();
  chainConfig = {};
  // Default RPC: success with no payload
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

// ============================================================================
// 1. fetchAllDocuments — pagination + fts exclusion
// ============================================================================
describe('fetchAllDocuments — pagination', () => {
  it('default call paginates with pageSize=50 starting at offset=0', async () => {
    chainConfig.documentos = {
      selectResult: {
        data: [
          { id: 'd1', categoria: 'etica', titulo: 'A', updated_at: '2026-05-01' },
          { id: 'd2', categoria: 'comites', titulo: 'B', updated_at: '2026-05-02' },
        ],
        error: null,
      },
    };

    const grouped = await supabaseDocumentService.fetchAllDocuments();

    // Calls .from('documentos')
    expect(mockFrom).toHaveBeenCalledWith('documentos');

    // .range(0, 49) — first page
    expect(mockRange).toHaveBeenCalledTimes(1);
    expect(mockRange).toHaveBeenCalledWith(0, 49);

    // .select(...) was called with a string that does NOT contain 'fts'
    expect(mockSelect).toHaveBeenCalledTimes(1);
    const selectArg = mockSelect.mock.calls[0][0];
    expect(typeof selectArg).toBe('string');
    expect(selectArg).not.toMatch(/\bfts\b/);
    // Sanity: select includes a couple of expected columns
    expect(selectArg).toMatch(/\bid\b/);
    expect(selectArg).toMatch(/\bcategoria\b/);
    expect(selectArg).toMatch(/\bview_count\b/);

    // Returns same grouped shape
    expect(grouped).toHaveProperty('etica');
    expect(grouped).toHaveProperty('comites');
    expect(grouped.etica).toHaveLength(1);
    expect(grouped.etica[0].id).toBe('d1');
    expect(grouped.comites).toHaveLength(1);
  });

  it('custom pageSize/offset maps to .range(offset, offset + pageSize - 1)', async () => {
    chainConfig.documentos = { selectResult: { data: [], error: null } };

    await supabaseDocumentService.fetchAllDocuments({ pageSize: 25, offset: 100 });

    expect(mockRange).toHaveBeenCalledWith(100, 124);
  });

  it('still excludes fts column even when called with explicit options', async () => {
    chainConfig.documentos = { selectResult: { data: [], error: null } };

    await supabaseDocumentService.fetchAllDocuments({ pageSize: 10, offset: 0 });

    const selectArg = mockSelect.mock.calls[0][0];
    expect(selectArg).not.toMatch(/\bfts\b/);
  });

  it('signature stays backward-compatible — fetchAllDocuments() with no args works', async () => {
    chainConfig.documentos = { selectResult: { data: [], error: null } };

    // Must not throw — DocumentsContext calls it with no arguments
    await expect(supabaseDocumentService.fetchAllDocuments()).resolves.toBeTruthy();

    // Default page (0..49)
    expect(mockRange).toHaveBeenCalledWith(0, 49);
  });
});

// ============================================================================
// 2. recordView — atomic RPC
// ============================================================================
describe('recordView — atomic via rpc_increment_view_count', () => {
  it('calls rpc_increment_view_count with the right args', async () => {
    chainConfig.documento_distribuicao = { upsertResult: { data: null, error: null } };

    await supabaseDocumentService.recordView('doc-42', validUser);

    // Verify the RPC call (the increment + audit-row transaction)
    const rpcCall = mockRpc.mock.calls.find(
      (c) => c[0] === 'rpc_increment_view_count'
    );
    expect(rpcCall).toBeTruthy();
    expect(rpcCall[1]).toMatchObject({
      p_doc_id: 'doc-42',
      p_user_id: 'firebase-uid-abc',
    });
    // user_name and user_email are passed for audit row
    expect(rpcCall[1].p_user_name).toBe('Dra. Teste');
    expect(rpcCall[1].p_user_email).toBe('teste@anest.com.br');

    // It should NOT do a read-then-write on documentos.view_count anymore.
    // The only `from(...)` call in the new path is on documento_distribuicao.
    expect(mockFrom).not.toHaveBeenCalledWith('documentos');
  });

  it('skips silently when userInfo lacks userId (anonymous read)', async () => {
    await supabaseDocumentService.recordView('doc-42', { userName: 'no id' });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not throw when the RPC errors out (best-effort counter)', async () => {
    chainConfig.documento_distribuicao = { upsertResult: { data: null, error: null } };
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    await expect(
      supabaseDocumentService.recordView('doc-42', validUser)
    ).resolves.not.toThrow();
  });
});

// ============================================================================
// 3. addVersion — atomic RPC
// ============================================================================
describe('addVersion — atomic via rpc_add_document_version', () => {
  it('calls rpc_add_document_version with snake_case payload + user_info', async () => {
    const insertedVersion = {
      id: 'ver-uuid-1',
      documento_id: 'doc-1',
      versao: 2,
      arquivo_url: 'https://example.com/v2.pdf',
      arquivo_nome: 'doc-v2.pdf',
      status: 'ativo',
      descricao_alteracao: 'Atualização',
      created_by: 'firebase-uid-abc',
    };
    mockRpc.mockResolvedValueOnce({ data: insertedVersion, error: null });

    const result = await supabaseDocumentService.addVersion(
      'doc-1',
      {
        arquivoURL: 'https://example.com/v2.pdf',
        arquivoNome: 'doc-v2.pdf',
        descricaoAlteracao: 'Atualização',
        motivoAlteracao: 'Revisão programada',
      },
      validUser
    );

    // 1. RPC was called with the right name + args
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_add_document_version',
      expect.objectContaining({
        p_doc_id: 'doc-1',
        p_version_data: expect.objectContaining({
          arquivo_url: 'https://example.com/v2.pdf',
          arquivo_nome: 'doc-v2.pdf',
          descricao_alteracao: 'Atualização',
          motivo_alteracao: 'Revisão programada',
        }),
        p_user_info: expect.objectContaining({
          user_id: 'firebase-uid-abc',
          user_name: 'Dra. Teste',
          user_email: 'teste@anest.com.br',
        }),
      })
    );

    // 2. Old fan-out is gone — no direct table fetches/updates from this path
    expect(mockFrom).not.toHaveBeenCalledWith('documentos');
    expect(mockFrom).not.toHaveBeenCalledWith('documento_versoes');

    // 3. Returns the inserted row in camelCase
    expect(result).toMatchObject({
      id: 'ver-uuid-1',
      documentoId: 'doc-1',
      versao: 2,
      arquivoURL: 'https://example.com/v2.pdf',
      arquivoNome: 'doc-v2.pdf',
      descricaoAlteracao: 'Atualização',
      createdBy: 'firebase-uid-abc',
    });
  });

  it('handles RPC payload wrapped under `version` key', async () => {
    const inserted = {
      id: 'ver-uuid-2',
      documento_id: 'doc-2',
      versao: 3,
    };
    mockRpc.mockResolvedValueOnce({
      data: { version: inserted },
      error: null,
    });

    const result = await supabaseDocumentService.addVersion(
      'doc-2',
      { descricaoAlteracao: 'X' },
      validUser
    );

    expect(result.id).toBe('ver-uuid-2');
    expect(result.versao).toBe(3);
  });

  it('throws via handleError when the RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'PGRST116: row not found' },
    });

    await expect(
      supabaseDocumentService.addVersion('doc-missing', {}, validUser)
    ).rejects.toThrow(/addVersion.*PGRST116/);
  });

  it('rejects when userInfo lacks userId (audit-trail rule)', async () => {
    await expect(
      supabaseDocumentService.addVersion('doc-1', {}, { userName: 'no id' })
    ).rejects.toThrow(/User ID is required/);

    // RPC must not have been called
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
