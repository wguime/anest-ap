import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — Firestore + Storage
// Sprint 20 Stream 1.2 — cobertura CRUD + STATUS_CONFIG + transições
// ============================================================================

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args) => ({ __query: args }));
const mockCollection = vi.fn((_db, name) => ({ __collection: name }));
const mockDoc = vi.fn((_db, _col, id) => ({ __doc: true, id }));
const mockWhere = vi.fn((...args) => ({ __where: args }));
const mockOrderBy = vi.fn((...args) => ({ __orderBy: args }));
const mockLimit = vi.fn((n) => ({ __limit: n }));

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
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (n) => mockLimit(n),
  serverTimestamp: () => serverTimestampSentinel,
  Timestamp: { fromDate: (d) => ({ __ts: d.getTime() }) },
  onSnapshot: vi.fn(),
  arrayUnion: vi.fn((v) => ({ __arrayUnion: v })),
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

// Helpers
function mockSnap(data, id = 'r1') {
  return {
    exists: () => true,
    id,
    data: () => data,
  };
}

function mockMissingSnap() {
  return { exists: () => false, data: () => undefined };
}

// SUT
const svc = await import('../../services/reunioesService');

beforeEach(() => {
  mockAddDoc.mockReset();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
});

// ============================================================================
// STATUS_CONFIG — validação estrutural (lógica pura)
// ============================================================================

describe('STATUS_CONFIG', () => {
  it('expõe os 6 status canônicos com label, variant e nextStates', () => {
    expect(Object.keys(svc.STATUS_CONFIG).sort()).toEqual(
      ['agendada', 'arquivada', 'cancelada', 'concluida', 'em_andamento', 'em_preparacao'].sort()
    );
    for (const cfg of Object.values(svc.STATUS_CONFIG)) {
      expect(cfg).toHaveProperty('label');
      expect(cfg).toHaveProperty('variant');
      expect(Array.isArray(cfg.nextStates)).toBe(true);
    }
  });

  it('agendada → em_preparacao | cancelada (sem pular etapas)', () => {
    expect(svc.STATUS_CONFIG.agendada.nextStates).toEqual(['em_preparacao', 'cancelada']);
  });

  it('em_preparacao → em_andamento | cancelada', () => {
    expect(svc.STATUS_CONFIG.em_preparacao.nextStates).toEqual(['em_andamento', 'cancelada']);
  });

  it('em_andamento → concluida | cancelada', () => {
    expect(svc.STATUS_CONFIG.em_andamento.nextStates).toEqual(['concluida', 'cancelada']);
  });

  it('estados terminais (concluida e cancelada) não têm transições', () => {
    expect(svc.STATUS_CONFIG.concluida.nextStates).toEqual([]);
    expect(svc.STATUS_CONFIG.cancelada.nextStates).toEqual([]);
  });
});

// ============================================================================
// createReuniao
// ============================================================================

describe('createReuniao', () => {
  it('cria reunião com status default "agendada", checkinSeed gerado e checkinAtivo=false', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'new-r' });

    const data = {
      titulo: 'Reunião Mensal',
      dataReuniao: new Date('2026-06-01T10:00:00Z'),
      tipoReuniao: 'comite',
    };

    const result = await svc.createReuniao(data, { uid: 'u1', displayName: 'User One' });

    expect(result.id).toBe('new-r');
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.status).toBe('agendada');
    expect(payload.checkinSeed).toBe('seed-fixed');
    expect(payload.checkinAtivo).toBe(false);
    expect(payload.checkins).toEqual({});
    expect(payload.createdBy).toBe('u1');
    expect(payload.createdByName).toBe('User One');
  });

  it('converte dataReuniao string ISO para Timestamp', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'rx' });
    await svc.createReuniao(
      { titulo: 'X', dataReuniao: '2026-07-15T14:30:00Z' },
      { uid: 'u1' }
    );
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dataReuniao).toHaveProperty('__ts');
  });

  it('preserva status custom quando fornecido', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'rx' });
    await svc.createReuniao(
      { titulo: 'X', dataReuniao: new Date(), status: 'em_andamento' },
      { uid: 'u1' }
    );
    expect(mockAddDoc.mock.calls[0][1].status).toBe('em_andamento');
  });

  it('rethrows com contexto quando addDoc falha', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('firestore-down'));
    await expect(
      svc.createReuniao({ titulo: 'X', dataReuniao: new Date() }, { uid: 'u1' })
    ).rejects.toThrow(/createReuniao.*firestore-down/);
  });
});

// ============================================================================
// updateReuniao
// ============================================================================

describe('updateReuniao', () => {
  it('remove campos imutáveis (id, createdBy, createdByName, createdAt) do payload', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({ titulo: 'Atualizada' }));
    await svc.updateReuniao('r1', {
      id: 'should-be-removed',
      createdBy: 'should-be-removed',
      createdByName: 'should-be-removed',
      createdAt: 'should-be-removed',
      titulo: 'Atualizada',
    });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('createdBy');
    expect(payload).not.toHaveProperty('createdByName');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload.titulo).toBe('Atualizada');
    expect(payload.updatedAt).toBe(serverTimestampSentinel);
  });

  it('converte dataReuniao Date → Timestamp ao atualizar', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({}));
    await svc.updateReuniao('r1', { dataReuniao: new Date('2026-08-01') });
    expect(mockUpdateDoc.mock.calls[0][1].dataReuniao).toHaveProperty('__ts');
  });

  it('converte dataReuniao string → Timestamp', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({}));
    await svc.updateReuniao('r1', { dataReuniao: '2026-09-01' });
    expect(mockUpdateDoc.mock.calls[0][1].dataReuniao).toHaveProperty('__ts');
  });
});

// ============================================================================
// getReunioes — query builders
// ============================================================================

describe('getReunioes', () => {
  beforeEach(() => {
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('retorna array vazio quando não há reuniões', async () => {
    const result = await svc.getReunioes();
    expect(result).toEqual([]);
  });

  it('aplica filtro status string single', async () => {
    await svc.getReunioes({ status: 'agendada' });
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'agendada');
  });

  it('aplica filtro status array com "in"', async () => {
    await svc.getReunioes({ status: ['agendada', 'em_andamento'] });
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['agendada', 'em_andamento']);
  });

  it('aplica filtros de data e tipoReuniao + orderBy default + limit', async () => {
    await svc.getReunioes({
      tipoReuniao: 'comite',
      dataInicio: new Date('2026-01-01'),
      dataFim: '2026-12-31',
      limit: 10,
    });
    expect(mockWhere).toHaveBeenCalledWith('tipoReuniao', '==', 'comite');
    expect(mockOrderBy).toHaveBeenCalledWith('dataReuniao', 'asc');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('respeita orderBy + order custom', async () => {
    await svc.getReunioes({ orderBy: 'titulo', order: 'desc' });
    expect(mockOrderBy).toHaveBeenCalledWith('titulo', 'desc');
  });

  it('mapeia docs retornando id + dados', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a', data: () => ({ titulo: 'A' }) },
        { id: 'b', data: () => ({ titulo: 'B' }) },
      ],
    });
    const result = await svc.getReunioes();
    expect(result).toEqual([
      { id: 'a', titulo: 'A' },
      { id: 'b', titulo: 'B' },
    ]);
  });
});

// ============================================================================
// getReuniaoById
// ============================================================================

describe('getReuniaoById', () => {
  it('lança erro quando reunião não existe', async () => {
    mockGetDoc.mockResolvedValueOnce(mockMissingSnap());
    await expect(svc.getReuniaoById('inexistente')).rejects.toThrow(
      /Reunião não encontrada/
    );
  });

  it('retorna reunião com id + data quando existe', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({ titulo: 'Reunião X', status: 'agendada' }, 'r1'));
    const result = await svc.getReuniaoById('r1');
    expect(result).toEqual({ id: 'r1', titulo: 'Reunião X', status: 'agendada' });
  });

  it('converte Firestore Timestamps em Date', async () => {
    const tsObj = { toDate: () => new Date('2026-05-01') };
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      dataReuniao: tsObj,
      createdAt: tsObj,
      updatedAt: tsObj,
    }));
    const result = await svc.getReuniaoById('r1');
    expect(result.dataReuniao).toBeInstanceOf(Date);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

// ============================================================================
// deleteReuniao
// ============================================================================

describe('deleteReuniao', () => {
  it('soft-delete: atualiza status para arquivada com userInfo', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'log1' });
    const result = await svc.deleteReuniao('r1', { uid: 'u1', displayName: 'Test' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.status).toBe('arquivada');
    expect(updateCall.archivedBy).toBe('u1');
    expect(result).toBe(true);
  });

  it('rejeita sem userInfo autenticado', async () => {
    await expect(svc.deleteReuniao('r1')).rejects.toThrow(/não autenticado/);
  });
});

// ============================================================================
// updateStatus — transições e validações
// ============================================================================

describe('updateStatus', () => {
  it('rejeita transição inválida (agendada → concluida pula etapas)', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({ status: 'agendada' }));
    await expect(
      svc.updateStatus('r1', 'concluida', { uid: 'u1' })
    ).rejects.toThrow(/Transição inválida/);
  });

  it('aceita transição válida agendada → em_preparacao', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockSnap({ status: 'agendada' }))   // getReuniaoById
      .mockResolvedValueOnce(mockSnap({ status: 'em_preparacao' })); // updated read
    mockAddDoc.mockResolvedValueOnce({ id: 'log1' }); // logStatusChange

    const result = await svc.updateStatus('r1', 'em_preparacao', { uid: 'u1' });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'em_preparacao' })
    );
    expect(result.status).toBe('em_preparacao');
  });

  it('aceita transição em_andamento → cancelada (cancelamento permitido)', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockSnap({ status: 'em_andamento' }))
      .mockResolvedValueOnce(mockSnap({ status: 'cancelada' }));
    mockAddDoc.mockResolvedValueOnce({ id: 'log1' });
    await svc.updateStatus('r1', 'cancelada', { uid: 'u1' }, 'reagendada');
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('cancelada');
  });

  it('continua mesmo se logStatusChange falhar (best-effort)', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockSnap({ status: 'agendada' }))
      .mockResolvedValueOnce(mockSnap({ status: 'em_preparacao' }));
    mockAddDoc.mockRejectedValueOnce(new Error('log-write-failed'));

    const result = await svc.updateStatus('r1', 'em_preparacao', { uid: 'u1' });
    expect(result.status).toBe('em_preparacao');
  });
});

// ============================================================================
// getStatusHistorico
// ============================================================================

describe('getStatusHistorico', () => {
  it('busca historico ordenado por timestamp desc e mapeia docs', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'h1', data: () => ({ oldStatus: 'agendada', newStatus: 'em_preparacao' }) },
        { id: 'h2', data: () => ({ oldStatus: null, newStatus: 'agendada' }) },
      ],
    });

    const result = await svc.getStatusHistorico('r1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('h1');
    expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
    expect(mockWhere).toHaveBeenCalledWith('reuniaoId', '==', 'r1');
  });

  it('retorna array vazio quando não há histórico', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await svc.getStatusHistorico('r-novo');
    expect(result).toEqual([]);
  });
});
