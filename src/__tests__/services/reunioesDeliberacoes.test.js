import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — Firestore + hashUtils
// Deliberações CRUD + voting tests for reunioesService
// ============================================================================

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args) => ({ __query: args }));
const mockCollection = vi.fn((_db, name) => ({ __collection: name }));
const mockDoc = vi.fn((_db, _col, id) => ({ __doc: true, id }));
const mockWhere = vi.fn((...args) => ({ __where: args }));
const mockOrderBy = vi.fn((...args) => ({ __orderBy: args }));
const mockLimit = vi.fn((n) => ({ __limit: n }));
const mockOnSnapshot = vi.fn();
const mockArrayUnion = vi.fn((...args) => ({ __arrayUnion: args }));

const serverTimestampSentinel = { __sentinel: 'serverTimestamp' };

vi.mock('@/config/firebase', () => ({
  db: { __db: true },
  storage: { __storage: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (n) => mockLimit(n),
  serverTimestamp: () => serverTimestampSentinel,
  Timestamp: { fromDate: (d) => ({ __ts: d.getTime() }) },
  onSnapshot: (...args) => mockOnSnapshot(...args),
  arrayUnion: (...args) => mockArrayUnion(...args),
  arrayRemove: vi.fn((v) => ({ __arrayRemove: v })),
  deleteField: vi.fn(() => ({ __deleteField: true })),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ __ref: true })),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('@/utils/checkinCodeGenerator', () => ({
  generateCheckinCode: vi.fn(() => '1234'),
  getCurrentWindowIndex: vi.fn(() => 42),
  getSecondsUntilNextWindow: vi.fn(() => 30),
  generateRandomSeed: vi.fn(() => 'seed-fixed'),
}));

vi.mock('@/utils/hashUtils', () => ({
  sha256: vi.fn(async (input) => `hash_${input}`),
}));

vi.mock('@/lib/storage', () => ({
  uploadToSupabase: vi.fn(),
  deleteAnyStorageObject: vi.fn(),
  STORAGE_BUCKETS: { reunioes: 'reunioes-docs' },
}));

// Helpers
function mockSnap(data, id = 'del-1') {
  return {
    exists: () => true,
    id,
    data: () => data,
  };
}

function mockMissingSnap() {
  return { exists: () => false, data: () => undefined };
}

function mockDocsSnapshot(docs) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((d, i) => ({
      id: d.id || `del-${i}`,
      data: () => d.data,
    })),
  };
}

// SUT
const svc = await import('../../services/reunioesService');

beforeEach(() => {
  mockAddDoc.mockReset();
  mockUpdateDoc.mockClear();
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockOnSnapshot.mockReset();
  mockArrayUnion.mockClear();
});

// ============================================================================
// generateDeliberacaoNumero (tested indirectly via createDeliberacao)
// ============================================================================

describe('createDeliberacao', () => {
  const userInfo = { uid: 'u1', displayName: 'User One' };

  it('creates deliberação with correct structure when meeting is em_andamento', async () => {
    // getReuniaoById → em_andamento
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({ status: 'em_andamento', titulo: 'Reunião X' }, 'reu-1')
    );
    // generateDeliberacaoNumero → empty snapshot (first deliberation)
    mockGetDocs.mockResolvedValueOnce(mockDocsSnapshot([]));
    // addDoc
    mockAddDoc.mockResolvedValueOnce({ id: 'new-del-1' });

    const result = await svc.createDeliberacao('reu-1', {
      titulo: 'Aprovar protocolo',
      descricao: 'Descrição',
      tipo: 'aprovacao',
      isAnonima: false,
    }, userInfo);

    expect(result.id).toBe('new-del-1');
    expect(mockAddDoc).toHaveBeenCalledOnce();

    const docArg = mockAddDoc.mock.calls[0][1];
    expect(docArg.reuniaoId).toBe('reu-1');
    expect(docArg.titulo).toBe('Aprovar protocolo');
    expect(docArg.status).toBe('aberta');
    expect(docArg.isAnonima).toBe(false);
    expect(docArg.votos).toEqual({});
    expect(docArg.votosAnonimos).toEqual([]);
    expect(docArg.votantesHash).toEqual([]);
    expect(docArg.createdBy).toBe('u1');
  });

  it('generates DEL-YYYY-0001 for first deliberation', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({ status: 'em_andamento' }, 'reu-1')
    );
    mockGetDocs.mockResolvedValueOnce(mockDocsSnapshot([]));
    mockAddDoc.mockResolvedValueOnce({ id: 'new-del' });

    await svc.createDeliberacao('reu-1', { titulo: 'T' }, userInfo);

    const docArg = mockAddDoc.mock.calls[0][1];
    const year = new Date().getFullYear();
    expect(docArg.numero).toBe(`DEL-${year}-0001`);
  });

  it('increments sequence from last deliberation', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({ status: 'em_andamento' }, 'reu-1')
    );
    // Last deliberation has numero DEL-2026-0005
    mockGetDocs.mockResolvedValueOnce(
      mockDocsSnapshot([{ id: 'del-5', data: { numero: 'DEL-2026-0005' } }])
    );
    mockAddDoc.mockResolvedValueOnce({ id: 'new-del' });

    await svc.createDeliberacao('reu-1', { titulo: 'T' }, userInfo);

    const docArg = mockAddDoc.mock.calls[0][1];
    expect(docArg.numero).toBe('DEL-2026-0006');
  });

  it('rejects when meeting status is not em_andamento', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({ status: 'agendada', titulo: 'Reunião Y' }, 'reu-2')
    );

    await expect(
      svc.createDeliberacao('reu-2', { titulo: 'T' }, userInfo)
    ).rejects.toThrow(/em andamento/i);
  });

  it('rejects unauthenticated user', async () => {
    await expect(
      svc.createDeliberacao('reu-1', { titulo: 'T' }, {})
    ).rejects.toThrow(/não autenticado/i);
  });
});

// ============================================================================
// votarIdentificado
// ============================================================================

describe('votarIdentificado', () => {
  it('adds vote to votos map and recalculates resultado', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: false,
        votos: {},
      }, 'del-1')
    );

    const resultado = await svc.votarIdentificado('del-1', 'u1', 'favor', 'User One');

    expect(resultado).toEqual({ favor: 1, contra: 0, abstencao: 0, total: 1 });
    expect(mockUpdateDoc).toHaveBeenCalledOnce();

    const updateArg = mockUpdateDoc.mock.calls[0][1];
    expect(updateArg.votos.u1.voto).toBe('favor');
    expect(updateArg.votos.u1.nome).toBe('User One');
  });

  it('prevents double voting', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: false,
        votos: { u1: { voto: 'favor', nome: 'User One' } },
      }, 'del-1')
    );

    await expect(
      svc.votarIdentificado('del-1', 'u1', 'contra', 'User One')
    ).rejects.toThrow(/já votou/i);
  });

  it('rejects voting on closed deliberação', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aprovada',
        isAnonima: false,
        votos: {},
      }, 'del-1')
    );

    await expect(
      svc.votarIdentificado('del-1', 'u1', 'favor', 'User One')
    ).rejects.toThrow(/encerrada/i);
  });

  it('rejects voting on anonymous deliberação', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: true,
        votos: {},
      }, 'del-1')
    );

    await expect(
      svc.votarIdentificado('del-1', 'u1', 'favor', 'User One')
    ).rejects.toThrow(/anônima/i);
  });

  it('rejects unauthenticated voter', async () => {
    await expect(
      svc.votarIdentificado('del-1', '', 'favor', 'No one')
    ).rejects.toThrow(/não autenticado/i);
  });

  it('recalculates resultado with multiple voters', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: false,
        votos: {
          u1: { voto: 'favor', nome: 'User 1' },
          u2: { voto: 'contra', nome: 'User 2' },
        },
      }, 'del-1')
    );

    const resultado = await svc.votarIdentificado('del-1', 'u3', 'abstencao', 'User 3');

    expect(resultado).toEqual({ favor: 1, contra: 1, abstencao: 1, total: 3 });
  });
});

// ============================================================================
// votarAnonimo
// ============================================================================

describe('votarAnonimo', () => {
  it('uses sha256 hash and stores in votosAnonimos without userId', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: true,
        votosAnonimos: [],
        votantesHash: [],
      }, 'del-2')
    );

    const resultado = await svc.votarAnonimo('del-2', 'u1', 'favor');

    expect(resultado).toEqual({ favor: 1, contra: 0, abstencao: 0, total: 1 });
    expect(mockUpdateDoc).toHaveBeenCalledOnce();

    // votantesHash should use arrayUnion with the sha256 hash
    expect(mockArrayUnion).toHaveBeenCalled();
    // votosAnonimos should use arrayUnion with { voto } only (no userId)
    const arrayUnionCalls = mockArrayUnion.mock.calls;
    // First call: hash, Second call: { voto }
    expect(arrayUnionCalls[0][0]).toBe('hash_del-2_u1');
    expect(arrayUnionCalls[1][0]).toEqual({ voto: 'favor' });
  });

  it('prevents double voting via hash dedup', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: true,
        votosAnonimos: [{ voto: 'favor' }],
        votantesHash: ['hash_del-2_u1'],
      }, 'del-2')
    );

    await expect(
      svc.votarAnonimo('del-2', 'u1', 'contra')
    ).rejects.toThrow(/já votou/i);
  });

  it('rejects voting on non-anonymous deliberação', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'aberta',
        isAnonima: false,
        votosAnonimos: [],
        votantesHash: [],
      }, 'del-2')
    );

    await expect(
      svc.votarAnonimo('del-2', 'u1', 'favor')
    ).rejects.toThrow(/não é anônima/i);
  });

  it('rejects voting on closed deliberação', async () => {
    mockGetDoc.mockResolvedValueOnce(
      mockSnap({
        status: 'adiada',
        isAnonima: true,
        votosAnonimos: [],
        votantesHash: [],
      }, 'del-2')
    );

    await expect(
      svc.votarAnonimo('del-2', 'u1', 'favor')
    ).rejects.toThrow(/encerrada/i);
  });

  it('rejects unauthenticated voter', async () => {
    await expect(
      svc.votarAnonimo('del-2', '', 'favor')
    ).rejects.toThrow(/não autenticado/i);
  });
});

// ============================================================================
// fecharDeliberacao
// ============================================================================

describe('fecharDeliberacao', () => {
  const adminInfo = { uid: 'admin-1', displayName: 'Admin', isAdmin: true };

  it('sets status + closedAt + closedBy', async () => {
    // getDoc for deliberacao
    mockGetDoc
      .mockResolvedValueOnce(
        mockSnap({ reuniaoId: 'reu-1', status: 'aberta' }, 'del-1')
      )
      // getReuniaoById
      .mockResolvedValueOnce(
        mockSnap({ createdBy: 'admin-1', titulo: 'Reunião' }, 'reu-1')
      )
      // getDoc after update (returned)
      .mockResolvedValueOnce(
        mockSnap({
          reuniaoId: 'reu-1',
          status: 'aprovada',
          closedBy: 'admin-1',
        }, 'del-1')
      );

    const result = await svc.fecharDeliberacao('del-1', 'aprovada', adminInfo);

    expect(result.id).toBe('del-1');
    expect(mockUpdateDoc).toHaveBeenCalledOnce();

    const updateArg = mockUpdateDoc.mock.calls[0][1];
    expect(updateArg.status).toBe('aprovada');
    expect(updateArg.closedBy).toBe('admin-1');
    expect(updateArg.closedAt).toEqual(serverTimestampSentinel);
  });

  it('rejects non-organizer non-admin', async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        mockSnap({ reuniaoId: 'reu-1', status: 'aberta' }, 'del-1')
      )
      .mockResolvedValueOnce(
        mockSnap({ createdBy: 'other-user', titulo: 'Reunião' }, 'reu-1')
      );

    await expect(
      svc.fecharDeliberacao('del-1', 'aprovada', { uid: 'u2', displayName: 'U2' })
    ).rejects.toThrow(/organizador|administrador/i);
  });

  it('rejects for missing deliberação', async () => {
    mockGetDoc.mockResolvedValueOnce(mockMissingSnap());

    await expect(
      svc.fecharDeliberacao('del-999', 'aprovada', adminInfo)
    ).rejects.toThrow(/não encontrada/i);
  });
});

// ============================================================================
// hasVoted
// ============================================================================

describe('hasVoted', () => {
  it('returns true for identified voter present in votos map', async () => {
    const deliberacao = {
      id: 'del-1',
      isAnonima: false,
      votos: { u1: { voto: 'favor', nome: 'User 1' } },
      votantesHash: [],
    };

    const result = await svc.hasVoted(deliberacao, 'u1');
    expect(result).toBe(true);
  });

  it('returns false for identified voter NOT in votos map', async () => {
    const deliberacao = {
      id: 'del-1',
      isAnonima: false,
      votos: { u1: { voto: 'favor', nome: 'User 1' } },
      votantesHash: [],
    };

    const result = await svc.hasVoted(deliberacao, 'u2');
    expect(result).toBe(false);
  });

  it('returns true for anonymous voter matching hash', async () => {
    const deliberacao = {
      id: 'del-2',
      isAnonima: true,
      votos: {},
      votantesHash: ['hash_del-2_u1'],
    };

    const result = await svc.hasVoted(deliberacao, 'u1');
    expect(result).toBe(true);
  });

  it('returns false for anonymous voter with no matching hash', async () => {
    const deliberacao = {
      id: 'del-2',
      isAnonima: true,
      votos: {},
      votantesHash: ['hash_del-2_u1'],
    };

    const result = await svc.hasVoted(deliberacao, 'u3');
    expect(result).toBe(false);
  });

  it('returns false for null deliberacao or userId', async () => {
    expect(await svc.hasVoted(null, 'u1')).toBe(false);
    expect(await svc.hasVoted({ id: 'x' }, null)).toBe(false);
    expect(await svc.hasVoted(null, null)).toBe(false);
  });
});

// ============================================================================
// calculateQuorum
// ============================================================================

describe('calculateQuorum', () => {
  it('calculates correct percentages with normal values', () => {
    const result = svc.calculateQuorum(5, 10, 20);
    expect(result.percentPresentes).toBe(50);
    expect(result.percentVotaram).toBe(50);
    expect(result.quorumAtingido).toBe(true);
  });

  it('quorum not reached when less than 50% present', () => {
    const result = svc.calculateQuorum(3, 4, 10);
    expect(result.percentPresentes).toBe(40);
    expect(result.quorumAtingido).toBe(false);
  });

  it('handles zero total participants', () => {
    const result = svc.calculateQuorum(0, 0, 0);
    expect(result.percentPresentes).toBe(0);
    expect(result.percentVotaram).toBe(0);
    expect(result.quorumAtingido).toBe(false);
  });

  it('handles zero presentes with positive participants', () => {
    const result = svc.calculateQuorum(0, 0, 10);
    expect(result.percentPresentes).toBe(0);
    expect(result.percentVotaram).toBe(0);
    expect(result.quorumAtingido).toBe(false);
  });

  it('rounds to one decimal place', () => {
    // 3/7 = 42.857...% → 42.9
    const result = svc.calculateQuorum(3, 7, 10);
    expect(result.percentPresentes).toBe(70);
    expect(result.percentVotaram).toBe(42.9);
  });

  it('100% quorum and voting', () => {
    const result = svc.calculateQuorum(10, 10, 10);
    expect(result.percentPresentes).toBe(100);
    expect(result.percentVotaram).toBe(100);
    expect(result.quorumAtingido).toBe(true);
  });
});

// ============================================================================
// autoCloseDeliberacoes
// ============================================================================

describe('autoCloseDeliberacoes', () => {
  const userInfo = { uid: 'u1', displayName: 'Admin' };

  it('closes all open deliberações with status adiada', async () => {
    mockGetDocs.mockResolvedValueOnce(
      mockDocsSnapshot([
        { id: 'del-1', data: { status: 'aberta', reuniaoId: 'reu-1' } },
        { id: 'del-2', data: { status: 'aberta', reuniaoId: 'reu-1' } },
      ])
    );
    mockUpdateDoc.mockResolvedValue(undefined);

    const count = await svc.autoCloseDeliberacoes('reu-1', userInfo);

    expect(count).toBe(2);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);

    // Both should be set to 'adiada'
    for (const call of mockUpdateDoc.mock.calls) {
      expect(call[1].status).toBe('adiada');
      expect(call[1].closedBy).toBe('u1');
      expect(call[1].closedAt).toEqual(serverTimestampSentinel);
    }
  });

  it('returns 0 when no open deliberações exist', async () => {
    mockGetDocs.mockResolvedValueOnce(mockDocsSnapshot([]));

    const count = await svc.autoCloseDeliberacoes('reu-1', userInfo);
    expect(count).toBe(0);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('returns 0 on error (non-throwing)', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const count = await svc.autoCloseDeliberacoes('reu-1', userInfo);
    expect(count).toBe(0);
  });
});
