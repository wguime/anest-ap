import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — Firestore + Storage + geradores
// ============================================================================

const mockDocRef = { id: 'r1' };
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockGetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockDeleteObject = vi.fn(() => Promise.resolve());

const serverTimestampSentinel = { __sentinel: 'serverTimestamp' };
const deleteFieldSentinel = { __sentinel: 'deleteField' };

const mockArrayUnion = vi.fn((v) => ({ __sentinel: 'arrayUnion', v }));
const mockArrayRemove = vi.fn((v) => ({ __sentinel: 'arrayRemove', v }));

vi.mock('@/config/firebase', () => ({
  db: { __db: true },
  storage: { __storage: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  doc: vi.fn((_db, _col, id) => ({ ...mockDocRef, id })),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: () => serverTimestampSentinel,
  Timestamp: { fromDate: (d) => ({ __ts: d.getTime() }) },
  onSnapshot: vi.fn(),
  arrayUnion: (v) => mockArrayUnion(v),
  arrayRemove: (v) => mockArrayRemove(v),
  deleteField: () => deleteFieldSentinel,
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ __ref: true })),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: (...args) => mockDeleteObject(...args),
}));

vi.mock('@/utils/checkinCodeGenerator', () => ({
  generateCheckinCode: vi.fn((seed, win) => String(1000 + (win % 9000)).padStart(4, '0')),
  getCurrentWindowIndex: vi.fn(() => 42),
  getSecondsUntilNextWindow: vi.fn(() => 30),
  generateRandomSeed: vi.fn(() => 'seed-xyz'),
}));

// ============================================================================
// Helpers
// ============================================================================

function mockReuniaoSnap(data) {
  return {
    exists: () => true,
    id: 'r1',
    data: () => data,
  };
}

// ============================================================================
// SUT
// ============================================================================

const svc = await import('../../services/reunioesService');

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockGetDoc.mockReset();
  mockAddDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockDeleteObject.mockClear();
  mockArrayUnion.mockClear();
  mockArrayRemove.mockClear();
});

// ============================================================================
// registerSelfPresenca — novo fluxo de justificativa
// ============================================================================

describe('registerSelfPresenca', () => {
  it('rejeita quando usuário não está em participantesIds', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['other-uid'],
      status: 'em_andamento',
    }));

    await expect(
      svc.registerSelfPresenca('r1', 'my-uid', true)
    ).rejects.toThrow(/não está na lista de participantes/);
  });

  it('rejeita quando reunião cancelada', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['my-uid'],
      status: 'cancelada',
    }));

    await expect(
      svc.registerSelfPresenca('r1', 'my-uid', true)
    ).rejects.toThrow(/cancelada/);
  });

  it('rejeita ausência sem justificativa', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
    }));

    await expect(
      svc.registerSelfPresenca('r1', 'my-uid', false, '')
    ).rejects.toThrow(/Justificativa da falta é obrigatória/);
  });

  it('rejeita ausência com justificativa curta (<3)', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
    }));

    await expect(
      svc.registerSelfPresenca('r1', 'my-uid', false, 'ab')
    ).rejects.toThrow(/mínimo 3 caracteres/);
  });

  it('aceita ausência com justificativa válida e grava map + faltantes', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        participantesIds: ['my-uid'],
        status: 'em_andamento',
      }))
      .mockResolvedValueOnce(mockReuniaoSnap({
        participantesIds: ['my-uid'],
        status: 'em_andamento',
        faltantes: ['my-uid'],
        justificativasFaltas: { 'my-uid': 'doente' },
      }));

    await svc.registerSelfPresenca('r1', 'my-uid', false, '  doente  ');

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload['justificativasFaltas.my-uid']).toBe('doente'); // trimmed
    expect(mockArrayRemove).toHaveBeenCalledWith('my-uid'); // removed from presentes
    expect(mockArrayUnion).toHaveBeenCalledWith('my-uid'); // added to faltantes
  });

  it('aceita presença e limpa justificativa anterior via deleteField', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        participantesIds: ['my-uid'],
        status: 'em_andamento',
      }))
      .mockResolvedValueOnce(mockReuniaoSnap({
        participantesIds: ['my-uid'],
        presentes: ['my-uid'],
      }));

    await svc.registerSelfPresenca('r1', 'my-uid', true);

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload['justificativasFaltas.my-uid']).toBe(deleteFieldSentinel);
    expect(mockArrayUnion).toHaveBeenCalledWith('my-uid');
    expect(mockArrayRemove).toHaveBeenCalledWith('my-uid');
  });

  it('rejeita quando userId vazio', async () => {
    await expect(svc.registerSelfPresenca('r1', '', true))
      .rejects.toThrow(/Usuário não autenticado/);
  });

  it('rejeita justificativa acima de 500 chars', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
    }));
    const longText = 'a'.repeat(501);
    await expect(svc.registerSelfPresenca('r1', 'my-uid', false, longText))
      .rejects.toThrow(/excede 500/);
  });
});

// ============================================================================
// P0-1 selfCheckin — validação de participantesIds
// ============================================================================

describe('selfCheckin — guard P0-1', () => {
  it('rejeita quando userId não está em participantesIds', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['other'],
      status: 'em_andamento',
      checkinAtivo: true,
      checkinSeed: 'seed-xyz',
    }));

    await expect(svc.selfCheckin('r1', 'stranger', '1042'))
      .rejects.toThrow(/não está na lista de participantes/);
  });

  it('rejeita quando userId vazio', async () => {
    await expect(svc.selfCheckin('r1', '', '1042'))
      .rejects.toThrow(/Usuário não autenticado/);
  });

  it('aceita participante legítimo com código válido', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        participantesIds: ['my-uid'],
        status: 'em_andamento',
        checkinAtivo: true,
        checkinSeed: 'seed-xyz',
        checkins: {},
      }));

    // generateCheckinCode mock returns '1042' for window 42
    await svc.selfCheckin('r1', 'my-uid', '1042');
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('rejeita código inválido', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      participantesIds: ['my-uid'],
      status: 'em_andamento',
      checkinAtivo: true,
      checkinSeed: 'seed-xyz',
      checkins: {},
    }));

    await expect(svc.selfCheckin('r1', 'my-uid', '9999'))
      .rejects.toThrow(/Codigo invalido/);
  });
});

// ============================================================================
// P0-2 activateCheckin / deactivateCheckin — guards de autor/admin
// ============================================================================

describe('activateCheckin — guard P0-2', () => {
  it('rejeita quando não autenticado', async () => {
    await expect(svc.activateCheckin('r1', {}))
      .rejects.toThrow(/não autenticado/);
  });

  it('rejeita quando usuário não é criador nem admin', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      createdBy: 'organizer',
      status: 'em_andamento',
    }));

    await expect(svc.activateCheckin('r1', { uid: 'attacker', role: 'anestesiologista' }))
      .rejects.toThrow(/organizador ou um administrador/);
  });

  it('aceita quando usuário é o organizador', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        createdBy: 'organizer',
        status: 'em_andamento',
        checkinSeed: 'seed-xyz',
      }))
      .mockResolvedValueOnce(mockReuniaoSnap({ createdBy: 'organizer' }));

    await svc.activateCheckin('r1', { uid: 'organizer' });
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('aceita quando admin chama', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        createdBy: 'someone',
        status: 'em_andamento',
        checkinSeed: 'seed-xyz',
      }))
      .mockResolvedValueOnce(mockReuniaoSnap({ createdBy: 'someone' }));

    await svc.activateCheckin('r1', { uid: 'admin-u', isAdmin: true });
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('aceita role coordenador', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        createdBy: 'someone',
        status: 'em_andamento',
        checkinSeed: 'seed-xyz',
      }))
      .mockResolvedValueOnce(mockReuniaoSnap({ createdBy: 'someone' }));

    await svc.activateCheckin('r1', { uid: 'coord-u', role: 'coordenador' });
    expect(mockUpdateDoc).toHaveBeenCalled();
  });
});

describe('deactivateCheckin — guard P0-2', () => {
  it('rejeita usuário não autor e não admin', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      createdBy: 'organizer',
      participantesIds: ['a', 'b'],
    }));

    await expect(svc.deactivateCheckin('r1', { uid: 'attacker' }))
      .rejects.toThrow(/organizador ou um administrador/);
  });

  it('aceita organizador e mescla checkins em presentes', async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockReuniaoSnap({
        createdBy: 'organizer',
        participantesIds: ['a', 'b'],
        checkins: { a: { timestamp: 1 } },
        presentes: [],
      }))
      .mockResolvedValueOnce(mockReuniaoSnap({ createdBy: 'organizer' }));

    await svc.deactivateCheckin('r1', { uid: 'organizer' });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.presentes).toEqual(['a']);
    expect(payload.faltantes).toEqual(['b']);
    expect(payload.checkinAtivo).toBe(false);
  });
});

// ============================================================================
// P0-3 aprovarAta — guard autor/admin
// ============================================================================

describe('aprovarAta — guard P0-3', () => {
  it('rejeita quando não autenticado', async () => {
    await expect(svc.aprovarAta('r1', 'ata1', {}))
      .rejects.toThrow(/não autenticado/);
  });

  it('rejeita usuário qualquer', async () => {
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      createdBy: 'organizer',
      status: 'em_andamento',
    }));
    await expect(svc.aprovarAta('r1', 'ata1', { uid: 'random' }))
      .rejects.toThrow(/organizador ou um administrador/);
  });

  it('aceita organizador', async () => {
    // primeira chamada: getReuniaoById dentro de aprovarAta
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      createdBy: 'organizer',
      status: 'concluida',
    }));
    // segunda chamada: getDoc da ata após update
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'ata1',
      data: () => ({ statusAta: 'aprovada' }),
    });

    await svc.aprovarAta('r1', 'ata1', { uid: 'organizer' });
    expect(mockUpdateDoc).toHaveBeenCalled();
  });
});

// ============================================================================
// P0-4 deleteDocumento — guard uploader/organizer/admin
// ============================================================================

describe('deleteDocumento — guard P0-4', () => {
  it('rejeita quando não autenticado', async () => {
    await expect(svc.deleteDocumento('doc1', {}))
      .rejects.toThrow(/não autenticado/);
  });

  it('rejeita usuário qualquer (não uploader, não organizador, não admin)', async () => {
    // primeira: getDoc do documento
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'doc1',
      data: () => ({ uploadedBy: 'other', reuniaoId: 'r1', storagePath: 'x' }),
    });
    // segunda: getReuniaoById para checar organizador
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({
      createdBy: 'organizer',
    }));

    await expect(svc.deleteDocumento('doc1', { uid: 'attacker' }))
      .rejects.toThrow(/quem enviou o documento, o organizador ou um administrador/);
  });

  it('aceita uploader', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'doc1',
      data: () => ({ uploadedBy: 'me', reuniaoId: 'r1', storagePath: 'x' }),
    });
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({ createdBy: 'organizer' }));

    await svc.deleteDocumento('doc1', { uid: 'me' });
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('aceita admin', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'doc1',
      data: () => ({ uploadedBy: 'someone', reuniaoId: 'r1', storagePath: 'x' }),
    });
    mockGetDoc.mockResolvedValueOnce(mockReuniaoSnap({ createdBy: 'organizer' }));

    await svc.deleteDocumento('doc1', { uid: 'admin', isAdmin: true });
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('é idempotente se documento não existir', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await svc.deleteDocumento('doc1', { uid: 'me' });
    expect(result).toBe(true);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});
