/**
 * trocaPlantaoService — Bateria de testes simulando os 8 residentes
 * trocando plantões entre si.
 *
 * Grupos:
 *   A. Cobertura unidirecional (5 casos)
 *   B. Swap bidirecional (3 casos)
 *   C. Rejeição / Cancelamento (2 casos)
 *   D. Identidade do residente (1 caso)
 *   E. Filtros de subscribeTrades (2 casos)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Firebase/Firestore mocks — vi.hoisted
// ---------------------------------------------------------------------------
const {
  mockAddDoc, mockUpdateDoc, mockSetDoc, mockGetDoc, mockGetDocs,
  mockBatchUpdate, mockBatchSet, mockBatchDelete, mockBatchCommit,
  mockWriteBatch, mockDoc, mockCollection, mockQuery, mockWhere,
  mockOrderBy, mockOnSnapshot, mockTimestampNow,
} = vi.hoisted(() => {
  const mockBatchUpdate = vi.fn();
  const mockBatchSet = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn(() => Promise.resolve());
  return {
    mockAddDoc: vi.fn((_col, data) => Promise.resolve({ id: 'mock-trade-id', ...data })),
    mockUpdateDoc: vi.fn(() => Promise.resolve()),
    mockSetDoc: vi.fn(() => Promise.resolve()),
    mockGetDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
    mockGetDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
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
    mockDoc: vi.fn((_db, col, id) => ({ _col: col, _id: id, path: `${col}/${id}` })),
    mockCollection: vi.fn((_db, name) => ({ _name: name })),
    mockQuery: vi.fn((...args) => ({ _query: args })),
    mockWhere: vi.fn((field, op, value) => ({ _where: { field, op, value } })),
    mockOrderBy: vi.fn((field, dir) => ({ _orderBy: { field, dir } })),
    mockOnSnapshot: vi.fn(),
    mockTimestampNow: vi.fn(() => ({ _type: 'timestamp-now' })),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  addDoc: mockAddDoc,
  collection: mockCollection,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  updateDoc: mockUpdateDoc,
  writeBatch: mockWriteBatch,
  onSnapshot: mockOnSnapshot,
  Timestamp: { now: mockTimestampNow },
}));

vi.mock('../../config/firebase', () => ({ db: {} }));

// ---------------------------------------------------------------------------
// Imports AFTER mocks registered
// ---------------------------------------------------------------------------
import {
  createTradeRequest,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  subscribeTrades,
} from '../../services/trocaPlantaoService';
import { RESIDENTES_2026 } from '../../data/residencia2026';

// ---------------------------------------------------------------------------
// Residentes para testes (espelha RESIDENTES_2026 + uid fictício)
// ---------------------------------------------------------------------------
const R = {
  augusto:   { uid: 'uid-augusto',   residenteId: 'r1-augusto',   nome: 'Augusto',   ano: 'R1' },
  guilherme: { uid: 'uid-guilherme', residenteId: 'r1-guilherme', nome: 'Guilherme', ano: 'R1' },
  roosewelt: { uid: 'uid-roosewelt', residenteId: 'r1-roosewelt', nome: 'Roosewelt', ano: 'R1' },
  daniel:    { uid: 'uid-daniel',    residenteId: 'r2-daniel',    nome: 'Daniel',    ano: 'R2' },
  jacinta:   { uid: 'uid-jacinta',   residenteId: 'r2-jacinta',   nome: 'Jacinta',   ano: 'R2' },
  rodrigo:   { uid: 'uid-rodrigo',   residenteId: 'r2-rodrigo',   nome: 'Rodrigo',   ano: 'R2' },
  raffaela:  { uid: 'uid-raffaela',  residenteId: 'r3-raffaela',  nome: 'Raffaela',  ano: 'R3' },
  wagner:    { uid: 'uid-wagner',    residenteId: 'r3-wagner',    nome: 'Wagner',    ano: 'R3' },
};

function seedTradeSnapshot(trade) {
  mockGetDocs.mockResolvedValueOnce({
    empty: false,
    docs: [{ id: trade.id || 'trade-doc-id', data: () => trade }],
  });
}

function makeTrade(overrides = {}) {
  return {
    codigo: 'TR100001',
    solicitanteId: R.daniel.uid,
    solicitanteNome: 'Daniel',
    solicitanteResidenteId: R.daniel.residenteId,
    solicitanteRole: 'medico-residente',
    solicitanteAno: 'R2',
    dataPlantao: '2026-05-15',
    dataDesejada: null,
    descricao: 'Compromisso pessoal',
    destinatarioId: null,
    destinatarioNome: null,
    respondidoPorId: null,
    respondidoPorNome: null,
    respondidoPorResidenteId: null,
    status: 'pendente',
    criadoEm: { _type: 'timestamp' },
    atualizadoEm: null,
    respostaEm: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  mockAddDoc.mockResolvedValue({ id: 'mock-trade-id' });
  mockBatchCommit.mockResolvedValue(undefined);
});

// ===========================================================================
describe('trocaPlantaoService — residentes trocando plantões', () => {

  // =========================================================================
  describe('A. Cobertura unidirecional', () => {
    it('A1 — Coverage aberta criada por Daniel aceita por Raffaela', async () => {
      const trade = makeTrade({
        codigo: 'TR100001',
        solicitanteId: R.daniel.uid,
        solicitanteResidenteId: R.daniel.residenteId,
        dataPlantao: '2026-05-15',
        destinatarioId: null,
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR100001',
        R.raffaela.uid,
        R.raffaela.nome,
        R.raffaela.residenteId
      );

      expect(result).toEqual({ success: true, error: null });
      expect(mockWriteBatch).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);

      // Update no trade
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      const [, updatePayload] = mockBatchUpdate.mock.calls[0];
      expect(updatePayload).toMatchObject({
        status: 'aceita',
        respondidoPorId: R.raffaela.uid,
        respondidoPorNome: R.raffaela.nome,
        respondidoPorResidenteId: R.raffaela.residenteId,
      });

      // Set override — UMA escrita só (unidirecional)
      expect(mockBatchSet).toHaveBeenCalledTimes(1);
      const [overrideRef, overrideData] = mockBatchSet.mock.calls[0];
      expect(overrideRef.path).toBe('residenciaPlantaoDiario/2026-05-15');
      expect(overrideData).toMatchObject({
        residenteOverride: R.raffaela.residenteId,
        origem: 'troca',
        trocaId: 'TR100001',
      });
    });

    it('A2 — Coverage direcionada Wagner→Jacinta, Jacinta aceita', async () => {
      const trade = makeTrade({
        codigo: 'TR100002',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-06-20',
        destinatarioId: R.jacinta.residenteId,
        destinatarioNome: R.jacinta.nome,
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR100002',
        R.jacinta.uid,
        R.jacinta.nome,
        R.jacinta.residenteId
      );

      expect(result.success).toBe(true);
      expect(mockBatchSet).toHaveBeenCalledTimes(1);
      const [overrideRef, overrideData] = mockBatchSet.mock.calls[0];
      expect(overrideRef.path).toBe('residenciaPlantaoDiario/2026-06-20');
      expect(overrideData.residenteOverride).toBe(R.jacinta.residenteId);
    });

    it('A3 — Direcionada Wagner→Jacinta, Rodrigo tenta aceitar → erro', async () => {
      const trade = makeTrade({
        codigo: 'TR100003',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-06-21',
        destinatarioId: R.jacinta.residenteId,
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR100003',
        R.rodrigo.uid,
        R.rodrigo.nome,
        R.rodrigo.residenteId
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/direcionada a outro residente/i);
      expect(mockWriteBatch).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('A4 — Augusto cria e tenta aceitar própria troca → erro', async () => {
      const trade = makeTrade({
        codigo: 'TR100004',
        solicitanteId: R.augusto.uid,
        solicitanteResidenteId: R.augusto.residenteId,
        dataPlantao: '2026-07-01',
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR100004',
        R.augusto.uid,
        R.augusto.nome,
        R.augusto.residenteId
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/não pode aceitar sua própria troca/i);
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('A5 — Troca já aceita, segunda tentativa de aceitar → erro', async () => {
      const trade = makeTrade({
        codigo: 'TR100005',
        solicitanteId: R.roosewelt.uid,
        solicitanteResidenteId: R.roosewelt.residenteId,
        status: 'aceita',
        dataPlantao: '2026-07-05',
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR100005',
        R.daniel.uid,
        R.daniel.nome,
        R.daniel.residenteId
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/não está mais pendente/i);
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('B. Swap bidirecional', () => {
    it('B1 — Wagner⇄Daniel swap bidirecional, Daniel aceita', async () => {
      const trade = makeTrade({
        codigo: 'TR200001',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-05-10',
        dataDesejada: '2026-05-14',
        destinatarioId: R.daniel.residenteId,
        destinatarioNome: R.daniel.nome,
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR200001',
        R.daniel.uid,
        R.daniel.nome,
        R.daniel.residenteId
      );

      expect(result.success).toBe(true);
      expect(mockBatchSet).toHaveBeenCalledTimes(2);

      const calls = mockBatchSet.mock.calls;
      const byPath = Object.fromEntries(calls.map(([ref, data]) => [ref.path, data]));

      // Data do solicitante → aceitador
      expect(byPath['residenciaPlantaoDiario/2026-05-10']).toMatchObject({
        residenteOverride: R.daniel.residenteId,
        origem: 'troca',
        trocaId: 'TR200001',
      });
      // Data desejada → solicitante
      expect(byPath['residenciaPlantaoDiario/2026-05-14']).toMatchObject({
        residenteOverride: R.wagner.residenteId,
        origem: 'troca',
        trocaId: 'TR200001',
      });
    });

    it('B2 — Create swap sem destinatário → erro, nada gravado', async () => {
      const result = await createTradeRequest({
        solicitanteId: R.augusto.uid,
        solicitanteNome: R.augusto.nome,
        solicitanteResidenteId: R.augusto.residenteId,
        dataPlantao: '2026-08-01',
        dataDesejada: '2026-08-05',
        destinatarioId: null,
        descricao: 'Swap sem destino',
      });

      expect(result.trade).toBeNull();
      expect(result.error).toMatch(/selecione um destinat/i);
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('B3 — Swap Wagner→Daniel, Jacinta tenta aceitar → erro direcionamento', async () => {
      const trade = makeTrade({
        codigo: 'TR200003',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-05-12',
        dataDesejada: '2026-05-16',
        destinatarioId: R.daniel.residenteId,
      });
      seedTradeSnapshot(trade);

      const result = await acceptTrade(
        'TR200003',
        R.jacinta.uid,
        R.jacinta.nome,
        R.jacinta.residenteId
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/direcionada a outro residente/i);
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('C. Rejeição / Cancelamento', () => {
    it('C1 — Augusto rejeita trade de Daniel → status rejeitada, sem override', async () => {
      const trade = makeTrade({
        codigo: 'TR300001',
        solicitanteId: R.daniel.uid,
        solicitanteResidenteId: R.daniel.residenteId,
        dataPlantao: '2026-09-10',
      });
      seedTradeSnapshot(trade);

      const result = await rejectTrade('TR300001', R.augusto.uid, R.augusto.nome);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const [, payload] = mockUpdateDoc.mock.calls[0];
      expect(payload).toMatchObject({
        status: 'rejeitada',
        respondidoPorId: R.augusto.uid,
        respondidoPorNome: R.augusto.nome,
      });
      // Nenhum batch de override
      expect(mockWriteBatch).not.toHaveBeenCalled();
      expect(mockBatchSet).not.toHaveBeenCalled();
    });

    it('C2 — Solicitante cancela; outro tenta cancelar → erro', async () => {
      // Caso 1: Jacinta (solicitante) cancela sua própria trade
      const t1 = makeTrade({
        codigo: 'TR300002',
        solicitanteId: R.jacinta.uid,
        solicitanteResidenteId: R.jacinta.residenteId,
      });
      seedTradeSnapshot(t1);
      const r1 = await cancelTrade('TR300002', R.jacinta.uid);
      expect(r1.success).toBe(true);
      const [, payload] = mockUpdateDoc.mock.calls[0];
      expect(payload.status).toBe('cancelada');

      // Caso 2: Rodrigo (não solicitante) tenta cancelar
      vi.clearAllMocks();
      seedTradeSnapshot(t1);
      const r2 = await cancelTrade('TR300002', R.rodrigo.uid);
      expect(r2.success).toBe(false);
      expect(r2.error).toMatch(/somente o solicitante/i);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('D. Identidade do residente', () => {
    it('D1 — Todos os 8 nomes de RESIDENTES_2026 resolvem via firstName lowercase', () => {
      // Espelha lógica de resolveResidenteId em useTrocaPlantao.js
      const resolve = (firstName) => {
        const first = (firstName || '').toLowerCase().trim();
        if (!first) return null;
        const m = RESIDENTES_2026.find((r) => r.nome.toLowerCase() === first);
        return m?.id || null;
      };

      // Cada um dos 8 residentes deve resolver
      for (const r of RESIDENTES_2026) {
        expect(resolve(r.nome)).toBe(r.id);
        // Case insensitive
        expect(resolve(r.nome.toUpperCase())).toBe(r.id);
      }

      // Edge cases
      expect(resolve('')).toBeNull();
      expect(resolve(null)).toBeNull();
      expect(resolve(undefined)).toBeNull();
      expect(resolve('NaoExiste')).toBeNull();
    });
  });

  // =========================================================================
  describe('E. subscribeTrades — filtragem client-side', () => {
    function triggerSnapshot(trades) {
      // Captura o callback onData que createFirestoreSubscription registrou
      // via onSnapshot. mockOnSnapshot.mock.calls[0] = [query, onNext, onError]
      const [, onNext] = mockOnSnapshot.mock.calls[0];
      onNext({ docs: trades.map((t, i) => ({ id: `doc-${i}`, data: () => t })) });
    }

    beforeEach(() => {
      // onSnapshot retorna função de unsubscribe
      mockOnSnapshot.mockImplementation(() => () => {});
    });

    it('E1 — Trade direcionada a Daniel aparece em pendingForMe de Daniel, não de Jacinta', () => {
      const capturedByDaniel = vi.fn();
      const capturedByJacinta = vi.fn();

      subscribeTrades(R.daniel.uid, () => R.daniel.residenteId, capturedByDaniel);
      // 1ª chamada — Daniel
      triggerSnapshot([
        makeTrade({
          codigo: 'TR400001',
          solicitanteId: R.wagner.uid,
          solicitanteResidenteId: R.wagner.residenteId,
          destinatarioId: R.daniel.residenteId,
          dataPlantao: '2026-05-20',
        }),
      ]);

      expect(capturedByDaniel).toHaveBeenCalled();
      const danielCallback = capturedByDaniel.mock.calls[0][0];
      expect(danielCallback.pendingForMe).toHaveLength(1);
      expect(danielCallback.pendingForMe[0].codigo).toBe('TR400001');

      // Agora Jacinta assina — novo onSnapshot
      subscribeTrades(R.jacinta.uid, () => R.jacinta.residenteId, capturedByJacinta);
      // 2ª chamada — Jacinta
      const [, jacintaOnNext] = mockOnSnapshot.mock.calls[1];
      jacintaOnNext({
        docs: [{
          id: 'd0',
          data: () => makeTrade({
            codigo: 'TR400001',
            solicitanteId: R.wagner.uid,
            solicitanteResidenteId: R.wagner.residenteId,
            destinatarioId: R.daniel.residenteId,
            dataPlantao: '2026-05-20',
          }),
        }],
      });

      expect(capturedByJacinta).toHaveBeenCalled();
      const jacintaCallback = capturedByJacinta.mock.calls[0][0];
      // Não direcionada a ela → pendingForMe vazio
      expect(jacintaCallback.pendingForMe).toHaveLength(0);
    });

    it('E2 — myTrades inclui trades onde usuário é solicitante OU respondidoPorId', () => {
      const captured = vi.fn();
      subscribeTrades(R.daniel.uid, () => R.daniel.residenteId, captured);

      triggerSnapshot([
        // Solicitante = Daniel → aparece
        makeTrade({
          codigo: 'TR500001',
          solicitanteId: R.daniel.uid,
          solicitanteResidenteId: R.daniel.residenteId,
          dataPlantao: '2026-09-01',
          status: 'pendente',
        }),
        // Respondida por Daniel (aceitou) → aparece
        makeTrade({
          codigo: 'TR500002',
          solicitanteId: R.wagner.uid,
          solicitanteResidenteId: R.wagner.residenteId,
          respondidoPorId: R.daniel.uid,
          respondidoPorResidenteId: R.daniel.residenteId,
          dataPlantao: '2026-09-05',
          status: 'aceita',
        }),
        // Direcionada a Daniel (residenteId) → aparece
        makeTrade({
          codigo: 'TR500003',
          solicitanteId: R.raffaela.uid,
          solicitanteResidenteId: R.raffaela.residenteId,
          destinatarioId: R.daniel.residenteId,
          dataPlantao: '2026-09-08',
          status: 'pendente',
        }),
        // Sem relação com Daniel → NÃO aparece
        makeTrade({
          codigo: 'TR500004',
          solicitanteId: R.rodrigo.uid,
          solicitanteResidenteId: R.rodrigo.residenteId,
          destinatarioId: R.jacinta.residenteId,
          dataPlantao: '2026-09-12',
          status: 'pendente',
        }),
      ]);

      const { myTrades } = captured.mock.calls[0][0];
      const codigos = myTrades.map((t) => t.codigo).sort();
      expect(codigos).toEqual(['TR500001', 'TR500002', 'TR500003']);
    });
  });

});
