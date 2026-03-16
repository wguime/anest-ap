import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Firebase/Firestore mocks — vi.hoisted so they are available to vi.mock factory
// ---------------------------------------------------------------------------
const {
  mockAddDoc, mockUpdateDoc, mockSetDoc, mockGetDoc, mockGetDocs,
  mockGetDocsFromServer, mockBatchUpdate, mockBatchSet, mockBatchDelete,
  mockBatchCommit, mockWriteBatch, mockDoc, mockCollection, mockQuery,
  mockWhere, mockOrderBy, mockLimit, mockDocumentId, mockTimestampFromDate,
} = vi.hoisted(() => {
  const mockBatchUpdate = vi.fn();
  const mockBatchSet = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn(() => Promise.resolve());
  return {
    mockAddDoc: vi.fn(() => Promise.resolve({ id: 'mock-id' })),
    mockUpdateDoc: vi.fn(() => Promise.resolve()),
    mockSetDoc: vi.fn(() => Promise.resolve()),
    mockGetDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null, id: 'mock-id' })),
    mockGetDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0 })),
    mockGetDocsFromServer: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0 })),
    mockBatchUpdate,
    mockBatchSet,
    mockBatchDelete,
    mockBatchCommit,
    mockWriteBatch: vi.fn(() => ({
      update: mockBatchUpdate,
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
    mockDoc: vi.fn(),
    mockCollection: vi.fn(),
    mockQuery: vi.fn(),
    mockWhere: vi.fn(),
    mockOrderBy: vi.fn(),
    mockLimit: vi.fn(),
    mockDocumentId: vi.fn(),
    mockTimestampFromDate: vi.fn((d) => ({ seconds: d.getTime() / 1000, toDate: () => d })),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  addDoc: mockAddDoc,
  deleteDoc: vi.fn(),
  collection: mockCollection,
  getDocs: mockGetDocs,
  getDocsFromServer: mockGetDocsFromServer,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  documentId: mockDocumentId,
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  updateDoc: mockUpdateDoc,
  writeBatch: mockWriteBatch,
  increment: vi.fn((n) => ({ _type: 'increment', value: n })),
  Timestamp: { now: vi.fn(), fromDate: mockTimestampFromDate },
  deleteField: vi.fn(),
  onSnapshot: vi.fn(),
  arrayUnion: vi.fn((...args) => ({ _type: 'arrayUnion', values: args })),
}));

vi.mock('../../config/firebase', () => ({ db: {} }));

// ---------------------------------------------------------------------------
// Imports under test (AFTER mocks are registered)
// ---------------------------------------------------------------------------
import {
  logEducacaoAction,
  verificarAssinatura,
  getCertificadoById,
  emitirCertificado,
  marcarProgressoAtomico,
  salvarQuizTentativa,
  getQuizTentativas,
  getQuizConfig,
  registrarAtividadeDiaria,
  getCursosRelacionados,
  getRankingUsuarios,
  salvarProgressoAula,
} from '../../services/educacaoService';

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null, id: 'mock-id' });
  mockGetDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });
  mockGetDocsFromServer.mockResolvedValue({ docs: [], empty: true, size: 0 });
  mockAddDoc.mockResolvedValue({ id: 'mock-id' });
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
  mockBatchCommit.mockResolvedValue(undefined);
});

// ===========================================================================
// 1. logEducacaoAction
// ===========================================================================
describe('logEducacaoAction', () => {
  it('creates a log doc with correct fields (tipo, entidade, timestamp)', async () => {
    await logEducacaoAction('create', 'curso', 'c1', 'Curso A', 'u1', 'User 1');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const logEntry = mockAddDoc.mock.calls[0][1];
    expect(logEntry).toMatchObject({
      tipo: 'create',
      acao: 'create',
      entidade: 'curso',
      entidadeId: 'c1',
      entidadeTitulo: 'Curso A',
      usuarioId: 'u1',
      usuarioNome: 'User 1',
    });
    expect(logEntry.timestamp).toEqual({ _type: 'serverTimestamp' });
  });
});

// ===========================================================================
// 2–4. verificarAssinatura (also covers gerarAssinatura indirectly)
// ===========================================================================
describe('verificarAssinatura', () => {
  it('returns true for a valid certificate (gerarAssinatura round-trip)', async () => {
    // emitirCertificado internally calls gerarAssinatura, so we emit then verify
    mockSetDoc.mockResolvedValue(undefined);
    const curso = { id: 'curso-1', titulo: 'Test', duracaoMinutos: 120 };
    const { certificado } = await emitirCertificado('user-1', curso);

    // certificado now has assinaturaHMAC and dataEmissaoISO set by the real crypto code
    const valid = await verificarAssinatura(certificado);
    expect(valid).toBe(true);
  });

  it('returns false for a tampered certificate', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const curso = { id: 'curso-1', titulo: 'Test', duracaoMinutos: 60 };
    const { certificado } = await emitirCertificado('user-1', curso);

    // Tamper with the cursoId
    const tampered = { ...certificado, cursoId: 'TAMPERED' };
    const valid = await verificarAssinatura(tampered);
    expect(valid).toBe(false);
  });

  it('returns false when assinaturaHMAC is missing', async () => {
    const result = await verificarAssinatura({ id: 'x', userId: 'u', cursoId: 'c' });
    expect(result).toBe(false);
  });
});

// ===========================================================================
// 5–6. getCertificadoById
// ===========================================================================
describe('getCertificadoById', () => {
  it('returns { certificado, error: null } when doc exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'cert-1',
      data: () => ({ userId: 'u1', cursoId: 'c1', status: 'valido' }),
    });

    const { certificado, error } = await getCertificadoById('cert-1');
    expect(error).toBeNull();
    expect(certificado).toMatchObject({ id: 'cert-1', userId: 'u1', cursoId: 'c1' });
  });

  it('returns { certificado: null, error } when doc not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null, id: 'x' });

    const { certificado, error } = await getCertificadoById('nonexistent');
    expect(certificado).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ===========================================================================
// 7. marcarProgressoAtomico
// ===========================================================================
describe('marcarProgressoAtomico', () => {
  it('uses writeBatch and calls commit', async () => {
    // Simulate existing progress doc
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ aulasAssistidas: [], modulosCompletos: [] }),
      id: 'prog',
    });

    const result = await marcarProgressoAtomico('u1', 'c1', 'aula-1', 100, {
      moduloId: 'mod1',
      totalModulos: 2,
      pontos: 50,
    });

    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatchUpdate).toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// 8. salvarQuizTentativa
// ===========================================================================
describe('salvarQuizTentativa', () => {
  it('saves tentativa and sets bloqueadoAte if failed', async () => {
    const tentativa = {
      nota: 40,
      aprovado: false,
      acertos: 2,
      totalPerguntas: 5,
      respostas: {},
    };

    const result = await salvarQuizTentativa('c1', 'u1', tentativa);

    expect(result.success).toBe(true);
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const saved = mockAddDoc.mock.calls[0][1];
    expect(saved.nota).toBe(40);
    expect(saved.aprovado).toBe(false);

    // Should call updateDoc with bloqueadoAte since aprovado === false
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateDoc.mock.calls[0][1];
    expect(updateArgs).toHaveProperty('quizResult.bloqueadoAte');
  });

  it('does NOT set bloqueadoAte when approved', async () => {
    const tentativa = {
      nota: 90,
      aprovado: true,
      acertos: 9,
      totalPerguntas: 10,
      respostas: {},
    };

    await salvarQuizTentativa('c1', 'u1', tentativa);
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 9. getQuizTentativas
// ===========================================================================
describe('getQuizTentativas', () => {
  it('returns array from getDocs', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 't1', data: () => ({ nota: 80, aprovado: true }) },
        { id: 't2', data: () => ({ nota: 40, aprovado: false }) },
      ],
      empty: false,
      size: 2,
    });

    const { tentativas, error } = await getQuizTentativas('c1', 'u1');
    expect(error).toBeNull();
    expect(tentativas).toHaveLength(2);
    expect(tentativas[0]).toMatchObject({ id: 't1', nota: 80 });
    expect(tentativas[1]).toMatchObject({ id: 't2', nota: 40 });
  });
});

// ===========================================================================
// 10. getQuizConfig
// ===========================================================================
describe('getQuizConfig', () => {
  it('returns config from curso doc', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ maxTentativas: 5, tempoLimiteMinutos: 30, titulo: 'Curso' }),
      id: 'c1',
    });

    const { config, error } = await getQuizConfig('c1');
    expect(error).toBeNull();
    expect(config.maxTentativas).toBe(5);
    expect(config.tempoLimiteMinutos).toBe(30);
  });

  it('returns defaults when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null, id: 'x' });

    const { config, error } = await getQuizConfig('c1');
    expect(error).toBeNull();
    expect(config).toEqual({});
  });
});

// ===========================================================================
// 11–12. registrarAtividadeDiaria
// ===========================================================================
describe('registrarAtividadeDiaria', () => {
  it('increments streak on new day (consecutive)', async () => {
    const ontem = new Date();
    ontem.setHours(0, 0, 0, 0);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ streak: 3, melhorStreak: 5, ultimaAtividadeDia: ontemStr }),
      id: 'stats',
    });

    const { streak, error } = await registrarAtividadeDiaria('u1');
    expect(error).toBeNull();
    expect(streak).toBe(4); // 3 + 1
    expect(mockSetDoc).toHaveBeenCalled();
    const setDocData = mockSetDoc.mock.calls[0][1];
    expect(setDocData.streak).toBe(4);
  });

  it('returns existing streak if same day', async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().slice(0, 10);

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ streak: 5, melhorStreak: 10, ultimaAtividadeDia: hojeStr }),
      id: 'stats',
    });

    const { streak, error } = await registrarAtividadeDiaria('u1');
    expect(error).toBeNull();
    expect(streak).toBe(5);
    // Should NOT call setDoc since it's the same day
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 13. emitirCertificado
// ===========================================================================
describe('emitirCertificado', () => {
  it('generates UUID + HMAC and calls setDoc', async () => {
    const curso = { id: 'curso-1', titulo: 'Seguranca', duracaoMinutos: 90, _userNome: 'Dr. A' };

    const { certificado, error } = await emitirCertificado('u1', curso, 'trilha-1');

    expect(error).toBeNull();
    expect(certificado).toBeTruthy();
    // UUID format check
    expect(certificado.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    // HMAC is a hex string of 64 chars (SHA-256 = 32 bytes = 64 hex)
    expect(certificado.assinaturaHMAC).toMatch(/^[0-9a-f]{64}$/);
    expect(certificado.cursoTitulo).toBe('Seguranca');
    expect(certificado.trilhaId).toBe('trilha-1');
    expect(certificado.userNome).toBe('Dr. A');
    expect(certificado.cargaHoraria).toBe('2h'); // ceil(90/60) = 2

    // setDoc called twice: once for cert, once for stats
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// 14. getCursosRelacionados
// ===========================================================================
describe('getCursosRelacionados', () => {
  it('queries with array-contains and returns cursos', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'c1', data: () => ({ titulo: 'Seguranca Anestesica', incidentesRelacionados: ['queda'] }) },
        { id: 'c2', data: () => ({ titulo: 'Via Aerea', incidentesRelacionados: ['queda', 'obito'] }) },
      ],
      empty: false,
      size: 2,
    });

    const { cursos, error } = await getCursosRelacionados('queda');
    expect(error).toBeNull();
    expect(cursos).toHaveLength(2);
    expect(cursos[0].id).toBe('c1');
    expect(mockWhere).toHaveBeenCalledWith('incidentesRelacionados', 'array-contains', 'queda');
  });
});

// ===========================================================================
// 15. getRankingUsuarios
// ===========================================================================
describe('getRankingUsuarios', () => {
  it('returns ranking sorted by pontos desc', async () => {
    // First call: getDocsFromServer for progresso top-level docs (userIds)
    mockGetDocsFromServer.mockResolvedValue({
      docs: [{ id: 'u1' }, { id: 'u2' }],
      empty: false,
      size: 2,
    });

    // getDoc calls for each user's stats
    let getDocCallCount = 0;
    mockGetDoc.mockImplementation(() => {
      getDocCallCount++;
      if (getDocCallCount === 1) {
        return Promise.resolve({
          exists: () => true,
          data: () => ({ totalPontos: 100, totalCursosCompletos: 2, streak: 3 }),
          id: 'u1-stats',
        });
      }
      return Promise.resolve({
        exists: () => true,
        data: () => ({ totalPontos: 250, totalCursosCompletos: 5, streak: 7 }),
        id: 'u2-stats',
      });
    });

    // getDocs for userProfiles (names lookup)
    // The source builds name as `${firstName} ${lastName}` when displayName or firstName is truthy
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'u1', data: () => ({ firstName: 'Alice', lastName: 'A' }) },
        { id: 'u2', data: () => ({ firstName: 'Bob', lastName: 'B' }) },
      ],
      empty: false,
      size: 2,
    });

    const { ranking, error } = await getRankingUsuarios(null, 10);
    expect(error).toBeNull();
    expect(ranking).toHaveLength(2);
    // u2 has more points so should be first
    expect(ranking[0].score).toBe(250);
    expect(ranking[0].name).toBe('Bob B');
    expect(ranking[1].score).toBe(100);
    expect(ranking[1].name).toBe('Alice A');
  });
});

// ===========================================================================
// 16. salvarProgressoAula
// ===========================================================================
describe('salvarProgressoAula', () => {
  it('calls updateDoc with progress data (existing doc)', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    const { success, error } = await salvarProgressoAula('u1', 'c1', 'aula-5', 120.5, 75);

    expect(error).toBeNull();
    expect(success).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

    const updatePayload = mockUpdateDoc.mock.calls[0][1];
    expect(updatePayload['progressoAulas.aula-5']).toMatchObject({
      currentTime: 120.5,
      percentual: 75,
    });
    expect(updatePayload.ultimoAcesso).toEqual({ _type: 'serverTimestamp' });
  });

  it('falls back to setDoc when doc does not exist (not-found)', async () => {
    const notFoundError = new Error('Document not found');
    notFoundError.code = 'not-found';
    mockUpdateDoc.mockRejectedValue(notFoundError);
    mockSetDoc.mockResolvedValue(undefined);

    const { success, error } = await salvarProgressoAula('u1', 'c1', 'aula-1', 0, 0);

    expect(error).toBeNull();
    expect(success).toBe(true);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setPayload = mockSetDoc.mock.calls[0][1];
    expect(setPayload.cursoId).toBe('c1');
    expect(setPayload.status).toBe('em_andamento');
    expect(setPayload.progressoAulas['aula-1']).toMatchObject({
      currentTime: 0,
      percentual: 0,
    });
  });
});
