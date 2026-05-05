/**
 * Onda1-3 — supabaseDocumentService.setLegalHold
 *
 * Verifica que:
 *   1. hold=true atualiza legal_hold + reason + setAt + setBy + cria audit
 *   2. hold=false reseta os campos para null + cria audit
 *   3. Erro do Supabase é propagado via handleError
 *   4. setLegalHold sem userId lança MissingUserIdError (audit-trail.md)
 *   5. hold=true sem reason lança erro (não silencioso)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ----------------------------------------------------------------------------
// Mock Supabase client (chain mock)
// ----------------------------------------------------------------------------
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
const mockFrom = vi.fn();

function buildChain(returnValue) {
  // chained: from('documentos').update(...).eq(...).select().single()
  const chain = {
    update: vi.fn((payload) => {
      mockUpdate(payload);
      return chain;
    }),
    eq: vi.fn((col, val) => {
      mockEq(col, val);
      return chain;
    }),
    select: vi.fn(() => {
      mockSelect();
      return chain;
    }),
    single: vi.fn(() => {
      mockSingle();
      return Promise.resolve(returnValue);
    }),
  };
  return chain;
}

let nextChainResult = { data: null, error: null };

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      mockFrom(table);
      return buildChain(nextChainResult);
    }),
    rpc: (...args) => mockRpc(...args),
  },
}));

// uploadService is imported by the service module — stub minimally
vi.mock('@/services/uploadService', () => ({
  validateFile: vi.fn(),
  ACCEPTED_DOCUMENT_TYPES: ['application/pdf'],
}));

// ----------------------------------------------------------------------------
// Subject under test
// ----------------------------------------------------------------------------
import supabaseDocumentService from '../../services/supabaseDocumentService';

const validUser = {
  userId: 'firebase-uid-abc',
  userName: 'Dra. Teste',
  userEmail: 'teste@anest.com.br',
};

beforeEach(() => {
  vi.clearAllMocks();
  nextChainResult = {
    data: {
      id: 'doc-1',
      legal_hold: true,
      legal_hold_reason: 'Investigação CRM',
      legal_hold_set_at: '2026-05-05T10:00:00.000Z',
      legal_hold_set_by: 'firebase-uid-abc',
    },
    error: null,
  };
});

describe('supabaseDocumentService.setLegalHold', () => {
  it('aplica legal hold (hold=true) com payload correto + audit', async () => {
    const result = await supabaseDocumentService.setLegalHold(
      'doc-1',
      'Investigação CRM',
      validUser,
      { hold: true }
    );

    // 1. from('documentos')
    expect(mockFrom).toHaveBeenCalledWith('documentos');

    // 2. update payload contém os campos esperados
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.legal_hold).toBe(true);
    expect(payload.legal_hold_reason).toBe('Investigação CRM');
    expect(payload.legal_hold_set_by).toBe('firebase-uid-abc');
    expect(payload.legal_hold_set_at).toBeTruthy();
    expect(payload.updated_by).toBe('firebase-uid-abc');

    // 3. WHERE id = doc-1
    expect(mockEq).toHaveBeenCalledWith('id', 'doc-1');

    // 4. Audit trail criado via rpc_log_document_action
    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_log_document_action',
      expect.objectContaining({
        p_documento_id: 'doc-1',
        p_action: 'legal_hold_set',
        p_user_id: 'firebase-uid-abc',
        p_changes: { reason: 'Investigação CRM' },
      })
    );

    // 5. Resposta convertida para camelCase
    expect(result.legalHold).toBe(true);
    expect(result.legalHoldReason).toBe('Investigação CRM');
    expect(result.legalHoldSetBy).toBe('firebase-uid-abc');
  });

  it('libera legal hold (hold=false) zerando campos + audit released', async () => {
    nextChainResult = {
      data: {
        id: 'doc-1',
        legal_hold: false,
        legal_hold_reason: null,
        legal_hold_set_at: null,
        legal_hold_set_by: null,
      },
      error: null,
    };

    const result = await supabaseDocumentService.setLegalHold(
      'doc-1',
      '',
      validUser,
      { hold: false }
    );

    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.legal_hold).toBe(false);
    expect(payload.legal_hold_reason).toBeNull();
    expect(payload.legal_hold_set_at).toBeNull();
    expect(payload.legal_hold_set_by).toBeNull();

    // Audit com action released e reason null
    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_log_document_action',
      expect.objectContaining({
        p_action: 'legal_hold_released',
        p_changes: { reason: null },
      })
    );

    expect(result.legalHold).toBe(false);
    expect(result.legalHoldReason).toBeNull();
  });

  it('propaga erro do Supabase como Error com contexto', async () => {
    nextChainResult = {
      data: null,
      error: { message: 'PGRST116: row not found' },
    };

    await expect(
      supabaseDocumentService.setLegalHold(
        'doc-missing',
        'motivo',
        validUser,
        { hold: true }
      )
    ).rejects.toThrow(/setLegalHold.*PGRST116/);

    // Não deve criar audit em caso de erro do update
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejeita quando userInfo não tem userId (regra audit-trail)', async () => {
    await expect(
      supabaseDocumentService.setLegalHold(
        'doc-1',
        'motivo',
        { userName: 'sem uid' },
        { hold: true }
      )
    ).rejects.toThrow(/User ID is required/);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejeita hold=true sem motivo (não cria audit silencioso)', async () => {
    await expect(
      supabaseDocumentService.setLegalHold(
        'doc-1',
        '   ',
        validUser,
        { hold: true }
      )
    ).rejects.toThrow(/motivo é obrigatório/);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
