import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — Firestore + Storage
// Sprint 20 Stream 1.2 — activateCheckin sad paths, selfCheckin grace, notify, getUserNotifications
// ============================================================================

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockWhere = vi.fn((...args) => ({ __where: args }));
const mockOrderBy = vi.fn((...args) => ({ __orderBy: args }));
const mockQuery = vi.fn((...args) => ({ __query: args }));

const serverTimestampSentinel = { __sentinel: 'serverTimestamp' };

const mockGenerateCheckinCode = vi.fn();
const mockGetCurrentWindowIndex = vi.fn(() => 42);
const mockGenerateRandomSeed = vi.fn(() => 'seed-rand');

vi.mock('@/config/firebase', () => ({
  db: { __db: true },
  storage: { __storage: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  doc: vi.fn((_db, _col, id) => ({ __doc: true, id })),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: vi.fn((n) => ({ __limit: n })),
  serverTimestamp: () => serverTimestampSentinel,
  Timestamp: { fromDate: (d) => ({ __ts: d.getTime() }) },
  onSnapshot: vi.fn((_ref, cb) => {
    cb({ exists: () => true, id: 'r1', data: () => ({ titulo: 'mock' }) });
    return () => {};
  }),
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
  generateCheckinCode: (...args) => mockGenerateCheckinCode(...args),
  getCurrentWindowIndex: () => mockGetCurrentWindowIndex(),
  getSecondsUntilNextWindow: vi.fn(() => 30),
  generateRandomSeed: () => mockGenerateRandomSeed(),
}));

// Helpers
function mockSnap(data, id = 'r1') {
  return { exists: () => true, id, data: () => data };
}

// SUT
const svc = await import('../../services/reunioesService');

beforeEach(() => {
  mockAddDoc.mockReset();
  mockUpdateDoc.mockClear();
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockGenerateCheckinCode.mockReset();
  mockGetCurrentWindowIndex.mockReset();
  mockGetCurrentWindowIndex.mockReturnValue(42);
  mockGenerateRandomSeed.mockReset();
  mockGenerateRandomSeed.mockReturnValue('seed-rand');
});

// ============================================================================
// activateCheckin — sad/edge paths não cobertos pelo arquivo base
// ============================================================================

describe('activateCheckin — guards extras', () => {
  it('rejeita ativação quando status NÃO é em_andamento (ex: agendada)', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      createdBy: 'organizer',
      status: 'agendada',
      checkinSeed: 'seed-existente',
    }));

    await expect(
      svc.activateCheckin('r1', { uid: 'organizer' })
    ).rejects.toThrow(/Check-in.*em andamento/);
  });

  it('gera checkinSeed sob demanda quando reunião não tinha seed', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockSnap({
        createdBy: 'organizer',
        status: 'em_andamento',
        // sem checkinSeed
      }))
      .mockResolvedValueOnce(mockSnap({ createdBy: 'organizer', checkinSeed: 'seed-rand' }));

    await svc.activateCheckin('r1', { uid: 'organizer' });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.checkinSeed).toBe('seed-rand');
    expect(payload.checkinAtivo).toBe(true);
  });

  it('NÃO regenera seed quando reunião já tem seed', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockSnap({
        createdBy: 'organizer',
        status: 'em_andamento',
        checkinSeed: 'seed-pre-existente',
      }))
      .mockResolvedValueOnce(mockSnap({ createdBy: 'organizer' }));

    await svc.activateCheckin('r1', { uid: 'organizer' });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('checkinSeed');
  });
});

// ============================================================================
// selfCheckin — grace window (previous code)
// ============================================================================

describe('selfCheckin — janela de grace', () => {
  it('aceita código da janela anterior (grace period)', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
      checkinAtivo: true,
      checkinSeed: 'seed-xyz',
      checkins: {},
    }));
    mockGetCurrentWindowIndex.mockReturnValue(42);
    mockGenerateCheckinCode
      .mockReturnValueOnce('CURRENT') // for window 42
      .mockReturnValueOnce('PREV');   // for window 41

    // user submete o código da janela anterior — deve aceitar
    await svc.selfCheckin('r1', 'my-uid', 'PREV');
    expect(mockUpdateDoc).toHaveBeenCalled();
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload['checkins.my-uid']).toMatchObject({ method: 'code' });
  });

  it('rejeita quando check-in não está ativo', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
      checkinAtivo: false,
      checkinSeed: 'seed-xyz',
    }));
    mockGenerateCheckinCode.mockReturnValue('1234');

    await expect(
      svc.selfCheckin('r1', 'my-uid', '1234')
    ).rejects.toThrow(/Check-in.*nao esta ativo/i);
  });

  it('rejeita quando reunião não está em_andamento', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      participantesIds: ['my-uid'],
      status: 'agendada',
      checkinAtivo: true,
      checkinSeed: 'seed-xyz',
    }));
    mockGenerateCheckinCode.mockReturnValue('1234');

    await expect(
      svc.selfCheckin('r1', 'my-uid', '1234')
    ).rejects.toThrow(/nao esta em andamento/i);
  });

  it('rejeita quando usuário já fez check-in', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
      checkinAtivo: true,
      checkinSeed: 'seed-xyz',
      checkins: { 'my-uid': { timestamp: 1 } },
    }));
    mockGenerateCheckinCode.mockReturnValue('1234');

    await expect(
      svc.selfCheckin('r1', 'my-uid', '1234')
    ).rejects.toThrow(/ja fez check-in/);
  });
});

// ============================================================================
// notifyReuniaoParticipantes
// ============================================================================

describe('notifyReuniaoParticipantes', () => {
  it('não faz nada quando não há participantes', async () => {
    await svc.notifyReuniaoParticipantes('r1', { titulo: 'X', dataReuniao: new Date() }, [], { userName: 'Admin' });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('cria 3 notifs por participante quando reunião está no futuro (convocacao + lembrete_1d + lembrete_1h)', async () => {
    // 7 dias no futuro garante ambos lembretes futuros
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockAddDoc.mockResolvedValue({ id: 'notif-x' });

    await svc.notifyReuniaoParticipantes(
      'r1',
      { titulo: 'Mensal', dataReuniao: future, horario: '10:00', local: 'Sala A' },
      [{ id: 'u1', nome: 'User 1' }],
      { userId: 'organizer', userName: 'Organizer' }
    );

    expect(mockAddDoc).toHaveBeenCalledTimes(3);
    const types = mockAddDoc.mock.calls.map(c => c[1].type);
    expect(types).toEqual(expect.arrayContaining(['convocacao', 'lembrete_1d', 'lembrete_1h']));
  });

  it('cria apenas convocacao quando reunião já passou (lembretes filtrados)', async () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    mockAddDoc.mockResolvedValue({ id: 'notif-x' });

    await svc.notifyReuniaoParticipantes(
      'r1',
      { titulo: 'X', dataReuniao: past, horario: '09:00', local: 'Y' },
      [{ id: 'u1', nome: 'User 1' }],
      { userName: 'Admin' }
    );

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc.mock.calls[0][1].type).toBe('convocacao');
  });

  it('multiplica notifs por número de participantes', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockAddDoc.mockResolvedValue({ id: 'notif-x' });

    await svc.notifyReuniaoParticipantes(
      'r1',
      { titulo: 'X', dataReuniao: future, horario: '10:00', local: 'A' },
      [
        { id: 'u1', nome: 'User 1' },
        { id: 'u2', nome: 'User 2' },
        { id: 'u3', nome: 'User 3' },
      ],
      { userName: 'Admin' }
    );

    expect(mockAddDoc).toHaveBeenCalledTimes(9); // 3 participants × 3 notifs
  });
});

// ============================================================================
// getUserNotifications + markNotificationRead
// ============================================================================

describe('getUserNotifications', () => {
  it('filtra notificações cujo scheduledFor ainda está no futuro', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    const futureDate = new Date(Date.now() + 60_000);

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'n1', data: () => ({ scheduledFor: pastDate, type: 'convocacao' }) },
        { id: 'n2', data: () => ({ scheduledFor: futureDate, type: 'lembrete_1d' }) },
      ],
    });

    const result = await svc.getUserNotifications('u1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('retorna array vazio quando Firestore erra (não rethrow)', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('boom'));
    const result = await svc.getUserNotifications('u1');
    expect(result).toEqual([]);
  });
});

describe('markNotificationRead', () => {
  it('chama updateDoc com readAt: serverTimestamp', async () => {
    await svc.markNotificationRead('notif-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readAt: serverTimestampSentinel })
    );
  });

  it('engole erro silenciosamente (best-effort)', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('write-fail'));
    // não deve rethrow
    await expect(svc.markNotificationRead('notif-1')).resolves.toBeUndefined();
  });
});

// ============================================================================
// subscribeToReuniao — basic wiring
// ============================================================================

describe('subscribeToReuniao', () => {
  it('chama callback com dados convertidos quando snapshot existe', async () => {
    const callback = vi.fn();
    const unsub = svc.subscribeToReuniao('r1', callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1', titulo: 'mock' })
    );
    expect(typeof unsub).toBe('function');
  });
});
