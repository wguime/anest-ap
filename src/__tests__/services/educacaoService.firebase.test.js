import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Firebase/Firestore mocks — vi.hoisted so they are available to vi.mock factory
// ---------------------------------------------------------------------------
const {
  mockAddDoc, mockUpdateDoc, mockSetDoc, mockGetDoc, mockGetDocs,
  mockGetDocsFromServer, mockBatchUpdate, mockBatchSet, _mockBatchDelete,
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

// Sprint 12: emitirCertificado importa getSupabaseToken via dynamic import.
// Mock o módulo para devolver um token fake — sem isso, o token vem null e
// solicitarAssinaturaHMAC retorna null (cert sem HMAC) antes do mock fetch.
// Wave 1.9: emitirCertificado agora também usa supabase.storage.from('certificados').upload
// (cutover Firebase→Supabase). Mockar a cadeia storage.from().upload() para sucesso.
const { mockSupabaseUpload, mockSupabaseRpc } = vi.hoisted(() => ({
  mockSupabaseUpload: vi.fn(() => Promise.resolve({ data: { path: 'mock/path.pdf' }, error: null })),
  // Sprint 1 Wave 1.1 T1.1.2: streak é server-authoritative via RPC
  // record_user_activity_day. Default: indisponível — testes de streak
  // configuram o retorno explicitamente.
  mockSupabaseRpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'rpc not mocked' } })),
}));
vi.mock('../../config/supabase.js', () => ({
  getSupabaseToken: vi.fn(() => Promise.resolve('fake-jwt-token')),
  _authReady: Promise.resolve(),
  supabase: {
    rpc: mockSupabaseRpc,
    storage: {
      from: vi.fn(() => ({ upload: mockSupabaseUpload })),
    },
  },
  default: {},
}));
// Wave 1.9: emitirCertificado faz `await import('../pages/educacao/utils/certificateGenerator')`
// para gerar o PDF antes de subir para o Supabase. Mockar para retornar um pdfDoc fake.
vi.mock('../../pages/educacao/utils/certificateGenerator', () => ({
  generateCertificatePDF: vi.fn(() => Promise.resolve({
    output: vi.fn(() => new Blob(['fake-pdf'], { type: 'application/pdf' })),
  })),
}));

// ---------------------------------------------------------------------------
// Imports under test (AFTER mocks are registered)
// ---------------------------------------------------------------------------
import { logEducacaoAction, verificarAssinatura, getCertificadoById, emitirCertificado, marcarProgressoAtomico, salvarQuizTentativa, getQuizTentativas, getQuizConfig, registrarAtividadeDiaria, getCursosRelacionados, getRankingUsuarios, salvarProgressoAula } from '../../services/educacaoService';

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
  // Function `logEducacaoAction` was removed from educacaoService.js.
  // Audit logging is now handled by the global audit pipeline.
  it.skip('creates a log doc with correct fields (tipo, entidade, timestamp)', async () => {
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
// 2–4. verificarAssinatura (Sprint 11: edge function-backed)
// ===========================================================================
describe('verificarAssinatura', () => {
  const BASE_CERT = {
    id: 'cert-1',
    userId: 'user-1',
    cursoId: 'curso-1',
    dataEmissaoISO: '2026-01-01T00:00:00Z',
    assinaturaHMAC: 'a'.repeat(64),
  };

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    globalThis.fetch = vi.fn();
  });

  it('returns false when assinaturaHMAC is missing (no fetch)', async () => {
    const result = await verificarAssinatura({ id: 'x', userId: 'u', cursoId: 'c' });
    expect(result).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns false when userId or cursoId is missing (no fetch)', async () => {
    expect(await verificarAssinatura({ assinaturaHMAC: 'a'.repeat(64), cursoId: 'c' })).toBe(false);
    expect(await verificarAssinatura({ assinaturaHMAC: 'a'.repeat(64), userId: 'u' })).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns true when edge function reports valid', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, valid: true }),
    });
    const result = await verificarAssinatura(BASE_CERT);
    expect(result).toBe(true);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/functions/v1/verify-cert-public');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      userId: 'user-1',
      cursoId: 'curso-1',
      dataEmissaoISO: '2026-01-01T00:00:00Z',
      assinaturaHMAC: 'a'.repeat(64),
      signatureVersion: 2,
    });
  });

  it('sends signatureVersion=2 when cert has signatureVersion: 2 (Sprint 12)', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, valid: true, signatureVersion: 2 }),
    });
    await verificarAssinatura({ ...BASE_CERT, signatureVersion: 2 });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.signatureVersion).toBe(2);
  });

  it('defaults signatureVersion to 2 when field absent (Sprint 13 — V1 fallback removed)', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, valid: true }),
    });
    await verificarAssinatura(BASE_CERT); // sem campo
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.signatureVersion).toBe(2);
  });

  it('returns false when edge function reports invalid', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, valid: false }),
    });
    const result = await verificarAssinatura(BASE_CERT);
    expect(result).toBe(false);
  });

  it('returns false on network error (fail-closed)', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('network down'));
    const result = await verificarAssinatura(BASE_CERT);
    expect(result).toBe(false);
  });

  it('returns false on rate-limit (429)', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ ok: false, reason: 'rate_limited' }),
    });
    const result = await verificarAssinatura(BASE_CERT);
    expect(result).toBe(false);
  });

  it('returns false when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const result = await verificarAssinatura(BASE_CERT);
    expect(result).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sends empty string when dataEmissaoISO is missing', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, valid: true }),
    });
    await verificarAssinatura({ ...BASE_CERT, dataEmissaoISO: undefined });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.dataEmissaoISO).toBe('');
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
  // Function `marcarProgressoAtomico` was removed from educacaoService.js.
  // Progress is now tracked via salvarProgressoAula. Skipping pending
  // re-introduction of an atomic batch operation.
  it.skip('uses writeBatch and calls commit', async () => {
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
  // Aligned with current implementation (educacaoService.js:2266) which
  // only calls addDoc — bloqueadoAte feature was removed/moved to a
  // separate `quizCooldown` service.
  it('saves tentativa via addDoc when failed', async () => {
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
    expect(saved.userId).toBe('u1');
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

  // =========================================================================
  // Sprint 14d: offline-first via persistência nativa do Firestore SDK
  // =========================================================================
  describe('Sprint 14d — offline behavior', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis.navigator,
      'onLine'
    );

    const setOnLine = (value) => {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        configurable: true,
        writable: true,
        value,
      });
    };

    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(globalThis.navigator, 'onLine', originalDescriptor);
      } else {
        setOnLine(true);
      }
    });

    it('navigator.onLine = true: chama addDoc e retorna ref id (sanity)', async () => {
      setOnLine(true);
      mockAddDoc.mockResolvedValueOnce({ id: 'tent-online-1' });

      const result = await salvarQuizTentativa('c1', 'u1', {
        nota: 80,
        aprovado: true,
        acertos: 8,
        totalPerguntas: 10,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.id).toBe('tent-online-1');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('navigator.onLine = false: AINDA chama addDoc, retorna ref local, NÃO joga', async () => {
      setOnLine(false);
      // SDK retorna ref local imediatamente quando offline + persistência habilitada
      mockAddDoc.mockResolvedValueOnce({ id: 'tent-offline-pending' });

      const result = await salvarQuizTentativa('c1', 'u1', {
        nota: 60,
        aprovado: false,
        acertos: 6,
        totalPerguntas: 10,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.id).toBe('tent-offline-pending');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      // Confirma que NÃO há guard tipo "if (!navigator.onLine) return early"
      const savedPayload = mockAddDoc.mock.calls[0][1];
      expect(savedPayload.userId).toBe('u1');
      expect(savedPayload.nota).toBe(60);
    });

    it('addDoc rejeita com erro: retorna estrutura graceful { success: false, error }', async () => {
      setOnLine(true);
      const err = new Error('permission-denied');
      mockAddDoc.mockRejectedValueOnce(err);

      const result = await salvarQuizTentativa('c1', 'u1', {
        nota: 50,
        aprovado: false,
        acertos: 5,
        totalPerguntas: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('permission-denied');
      // Não deve lançar — chamador recebe objeto descritivo
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('reconexão simulada: tentativa offline depois online, ambas via addDoc', async () => {
      // 1) offline
      setOnLine(false);
      mockAddDoc.mockResolvedValueOnce({ id: 'tent-pending' });
      const offlineResult = await salvarQuizTentativa('c1', 'u1', {
        nota: 70,
        aprovado: true,
      });
      expect(offlineResult.success).toBe(true);
      expect(offlineResult.id).toBe('tent-pending');

      // 2) online (reconectou)
      setOnLine(true);
      mockAddDoc.mockResolvedValueOnce({ id: 'tent-synced' });
      const onlineResult = await salvarQuizTentativa('c1', 'u1', {
        nota: 95,
        aprovado: true,
      });
      expect(onlineResult.success).toBe(true);
      expect(onlineResult.id).toBe('tent-synced');

      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });

    // C2 — reforço: sequência completa [offline → tentativa1 → online → tentativa2]
    // valida que NÃO há fila paralela em app-space (cada chamada chama addDoc
    // exatamente 1x; SDK é o único responsável por queue/replay) e que os
    // payloads carregam os dados corretos da tentativa (não há merge/state leak
    // entre chamadas sequenciais).
    it('sequência offline→online: addDoc 1×/chamada, payloads preservados, sem fila app-side', async () => {
      // Tentativa 1 — offline
      setOnLine(false);
      mockAddDoc.mockResolvedValueOnce({ id: 'tent-1-offline' });
      const r1 = await salvarQuizTentativa('curso-x', 'user-a', {
        nota: 55,
        aprovado: false,
        acertos: 5,
        totalPerguntas: 10,
        respostas: { q1: 'a', q2: 'b' },
      });

      expect(r1.success).toBe(true);
      expect(r1.id).toBe('tent-1-offline');
      // Crítico: 1 chamada addDoc por tentativa. Se houvesse fila app-side,
      // veríamos chamadas extras (replay manual).
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const payload1 = mockAddDoc.mock.calls[0][1];
      expect(payload1.nota).toBe(55);
      expect(payload1.aprovado).toBe(false);
      expect(payload1.userId).toBe('user-a');
      expect(payload1.respostas).toEqual({ q1: 'a', q2: 'b' });

      // Tentativa 2 — online (reconectou). Nova tentativa real do user.
      setOnLine(true);
      mockAddDoc.mockResolvedValueOnce({ id: 'tent-2-online' });
      const r2 = await salvarQuizTentativa('curso-x', 'user-a', {
        nota: 85,
        aprovado: true,
        acertos: 9,
        totalPerguntas: 10,
        respostas: { q1: 'c', q2: 'd' },
      });

      expect(r2.success).toBe(true);
      expect(r2.id).toBe('tent-2-online');
      // Total acumulado: 2 chamadas (1 por tentativa), nada de replay extra.
      expect(mockAddDoc).toHaveBeenCalledTimes(2);
      const payload2 = mockAddDoc.mock.calls[1][1];
      expect(payload2.nota).toBe(85);
      expect(payload2.aprovado).toBe(true);
      expect(payload2.userId).toBe('user-a');
      expect(payload2.respostas).toEqual({ q1: 'c', q2: 'd' });
      // Payload da 2ª tentativa não vazou da 1ª (state isolation).
      expect(payload2.nota).not.toBe(payload1.nota);
    });

    // C2 — contrato de retorno: id devolvido === id da DocumentReference do SDK,
    // tanto online quanto offline. Garante que callers podem confiar no id pra
    // navegação/links mesmo quando a tentativa ainda está pendente no IndexedDB.
    it('retorna id idêntico ao ref.id do SDK (online e offline)', async () => {
      // Online
      setOnLine(true);
      mockAddDoc.mockResolvedValueOnce({ id: 'ref-id-online-xyz' });
      const online = await salvarQuizTentativa('c1', 'u1', { nota: 70 });
      expect(online.id).toBe('ref-id-online-xyz');
      expect(online.id).not.toBeNull();
      expect(online.id).not.toBeUndefined();

      // Offline (SDK gera ref local mesmo offline com persistência habilitada)
      setOnLine(false);
      mockAddDoc.mockResolvedValueOnce({ id: 'ref-id-offline-abc' });
      const offline = await salvarQuizTentativa('c1', 'u1', { nota: 50 });
      expect(offline.id).toBe('ref-id-offline-abc');
      expect(offline.id).not.toBeNull();
      expect(offline.id).not.toBeUndefined();
    });
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
  // Sprint 1 Wave 1.1 T1.1.2: streak migrou para server-authoritative
  // (RPC Supabase record_user_activity_day é a fonte de verdade; Firestore
  // vira dual-write de cache legado e SEMPRE recebe setDoc). Os testes
  // antigos assumiam cálculo client-side via getDoc — drift de arquitetura.
  it('increments streak on new day (consecutive)', async () => {
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { streak: 4, longest_streak: 5, recorded_today: true, today_utc: '2026-06-10' },
      error: null,
    });

    const { streak, error } = await registrarAtividadeDiaria('u1');
    expect(error).toBeNull();
    expect(streak).toBe(4); // 3 + 1 calculado no servidor
    expect(mockSupabaseRpc).toHaveBeenCalledWith(
      'record_user_activity_day',
      expect.objectContaining({ p_source: expect.any(String) })
    );
    // Dual-write Firestore com o valor do servidor
    expect(mockSetDoc).toHaveBeenCalledWith(
      undefined, // ref (mockDoc retorna undefined)
      expect.objectContaining({ streak: 4, melhorStreak: 5 }),
      { merge: true }
    );
  });

  it('returns existing streak if same day', async () => {
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { streak: 5, longest_streak: 10, recorded_today: false, today_utc: '2026-06-10' },
      error: null,
    });

    const { streak, error } = await registrarAtividadeDiaria('u1');
    expect(error).toBeNull();
    expect(streak).toBe(5); // servidor devolve o streak corrente sem incrementar
    // Dual-write de cache acontece mesmo no mesmo dia (setDoc com merge)
    expect(mockSetDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ streak: 5, melhorStreak: 10 }),
      { merge: true }
    );
  });

  it('returns error when server-side RPC is unavailable', async () => {
    mockSupabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } });

    const { streak, error } = await registrarAtividadeDiaria('u1');
    expect(streak).toBe(0);
    expect(error).toBe('server-side unavailable');
  });
});

// ===========================================================================
// 13. emitirCertificado
// ===========================================================================
describe('emitirCertificado', () => {
  // Sprint 12: emitirCertificado agora chama edge sign-cert após setDoc
  // para obter assinatura HMAC versionada. Mockamos getSupabaseToken via
  // import dinâmico de '../../config/supabase.js' (já mocado abaixo).
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    globalThis.fetch = vi.fn();
  });

  it('persists certificate with deterministic id, calls setDoc twice, updateDoc twice (Wave 1.9: HMAC + supabaseMigrated:true + arquivoUrl:null)', async () => {
    const curso = { id: 'curso-1', titulo: 'Seguranca', duracaoMinutos: 90 };

    // Mock sign-cert edge: retorna assinatura V2
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        assinaturaHMAC: 'b'.repeat(64),
        signatureVersion: 2,
      }),
    });
    // Wave 1.9: emitirCertificado faz lookup em userProfiles para userName.
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ displayName: 'Dra. Maria Silva' }),
      id: 'u1',
    });

    const { certificado, error } = await emitirCertificado('u1', curso, 'trilha-1');

    expect(error).toBeNull();
    expect(certificado).toBeTruthy();
    // Deterministic id pattern (trilha case)
    expect(certificado.id).toBe('u1_trilha_trilha-1');
    expect(certificado.cursoTitulo).toBe('Seguranca');
    expect(certificado.trilhaId).toBe('trilha-1');
    expect(certificado.cargaHoraria).toBe('2h'); // ceil(90/60) = 2
    expect(certificado.emitido).toBe(true);
    // Sprint 12: campos novos
    expect(certificado.dataEmissaoISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(certificado.assinaturaHMAC).toBe('b'.repeat(64));
    expect(certificado.signatureVersion).toBe(2);
    // Wave 1.9: cutover marcou cert como Supabase-migrated
    expect(certificado.supabaseMigrated).toBe(true);

    // setDoc called twice (cert + stats);
    // Wave 1.9: updateDoc called twice — assinaturaHMAC + supabaseMigrated:true/arquivoUrl:null
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    const assinaturaCall = mockUpdateDoc.mock.calls.find(([, payload]) => payload.assinaturaHMAC);
    expect(assinaturaCall).toBeTruthy();
    expect(assinaturaCall[1].assinaturaHMAC).toBe('b'.repeat(64));
    expect(assinaturaCall[1].signatureVersion).toBe(2);
    const migrationCall = mockUpdateDoc.mock.calls.find(([, payload]) => 'supabaseMigrated' in payload);
    expect(migrationCall).toBeTruthy();
    expect(migrationCall[1].supabaseMigrated).toBe(true);
    expect(migrationCall[1].arquivoUrl).toBeNull();
    // Wave 1.9: Supabase upload foi chamado
    expect(mockSupabaseUpload).toHaveBeenCalledTimes(1);
    const [path, blob, opts] = mockSupabaseUpload.mock.calls[0];
    expect(path).toBe('u1/u1_trilha_trilha-1.pdf');
    expect(blob).toBeInstanceOf(Blob);
    expect(opts.contentType).toBe('application/pdf');
    expect(opts.upsert).toBe(true);
  });

  it('emits cert without HMAC when sign-cert edge fails, but Supabase upload still happens (Wave 1.9: cutover obrigatório)', async () => {
    const curso = { id: 'curso-2', titulo: 'Outro', duracaoMinutos: 30 };

    globalThis.fetch.mockRejectedValueOnce(new Error('edge down'));
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ displayName: 'Dr. João Pereira' }),
      id: 'u2',
    });

    const { certificado, error } = await emitirCertificado('u2', curso);

    expect(error).toBeNull();
    expect(certificado).toBeTruthy();
    expect(certificado.id).toBe('u2_curso-2');
    // Sem HMAC nem signatureVersion (sign-cert falhou)
    expect(certificado.assinaturaHMAC).toBeUndefined();
    expect(certificado.signatureVersion).toBeUndefined();
    // Wave 1.9: mesmo sem HMAC, Supabase upload é obrigatório e cert é marked migrated
    expect(certificado.supabaseMigrated).toBe(true);
    expect(mockSupabaseUpload).toHaveBeenCalledTimes(1);
    // updateDoc chamado 1× (supabaseMigrated/arquivoUrl) — não chamou para HMAC (sig=null)
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.supabaseMigrated).toBe(true);
    expect(payload.arquivoUrl).toBeNull();
    expect(payload.assinaturaHMAC).toBeUndefined();
  });

  it('Wave 1.9: throws cert_username_missing when userProfile lookup yields no name', async () => {
    const curso = { id: 'curso-3', titulo: 'NoName', duracaoMinutos: 60 };

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        assinaturaHMAC: 'c'.repeat(64),
        signatureVersion: 2,
      }),
    });
    // userProfile não existe → userName = null → throw cert_username_missing
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
      id: 'u3',
    });

    const { certificado, error } = await emitirCertificado('u3', curso);

    expect(certificado).toBeNull();
    expect(error).toBe('cert_username_missing');
    // Supabase upload NÃO foi chamado (throw aconteceu antes)
    expect(mockSupabaseUpload).not.toHaveBeenCalled();
  });

  it('Wave 1.9: throws cert_supabase_upload_failed when Supabase storage rejects', async () => {
    const curso = { id: 'curso-4', titulo: 'FailUpload', duracaoMinutos: 60 };

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        assinaturaHMAC: 'd'.repeat(64),
        signatureVersion: 2,
      }),
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ displayName: 'Dr. Test' }),
      id: 'u4',
    });
    // Simular falha de upload Supabase
    mockSupabaseUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'bucket not configured' },
    });

    const { certificado, error } = await emitirCertificado('u4', curso);

    expect(certificado).toBeNull();
    expect(error).toMatch(/^cert_supabase_upload_failed/);
    // Cert e stats foram criados (Wave 1.9 não rollback Firestore) mas upload falhou
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// 14. getCursosRelacionados
// ===========================================================================
describe('getCursosRelacionados', () => {
  // Function `getCursosRelacionados` was removed from educacaoService.js.
  // Test kept as skip placeholder to preserve intent for future re-implementation.
  it.skip('queries with array-contains and returns cursos (removed from service)', async () => {
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
  });
});

// ===========================================================================
// 15. getRankingUsuarios
// ===========================================================================
describe('getRankingUsuarios', () => {
  // Current implementation (educacaoService.js:2535) is a placeholder that
  // returns { ranking: [], error: 'Implementação via Cloud Functions...' }.
  // Test asserts the placeholder contract to lock the API surface.
  it('returns placeholder result pending Cloud Functions implementation', async () => {
    const { ranking, error } = await getRankingUsuarios(null, 10);
    expect(Array.isArray(ranking)).toBe(true);
    expect(ranking).toHaveLength(0);
    // The implementation explicitly returns an error message indicating
    // Cloud Functions are required. Either null (when implemented) or the
    // documented placeholder string is acceptable.
    expect(error === null || typeof error === 'string').toBe(true);
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
