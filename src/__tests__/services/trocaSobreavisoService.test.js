/**
 * trocaSobreavisoService — simulação das 5 funcionárias trocando sobreavisos.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const {
  mockAddDoc, mockUpdateDoc, mockSetDoc, mockGetDoc, mockGetDocs,
  mockBatchUpdate, mockBatchSet, _mockBatchDelete, mockBatchCommit,
  mockWriteBatch, mockDoc, mockCollection, mockQuery, mockWhere,
  mockOrderBy, mockOnSnapshot, mockTimestampNow,
} = vi.hoisted(() => {
  const mockBatchUpdate = vi.fn();
  const mockBatchSet = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn(() => Promise.resolve());
  return {
    mockAddDoc: vi.fn((_col, data) => Promise.resolve({ id: 'mock-sobreaviso-id', ...data })),
    mockUpdateDoc: vi.fn(() => Promise.resolve()),
    mockSetDoc: vi.fn(() => Promise.resolve()),
    mockGetDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
    mockGetDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
    mockBatchUpdate, mockBatchSet, mockBatchDelete, mockBatchCommit,
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
vi.mock('../../services/firestoreSubscriptionHelper', () => ({
  createFirestoreSubscription: vi.fn((_q, handlers) => {
    mockOnSnapshot(_q, handlers.onData, handlers.onError);
    return { cleanup: vi.fn() };
  }),
}));

import { createTradeRequest, acceptTrade, rejectTrade, cancelTrade, subscribeTrades } from '../../services/trocaSobreavisoService';

const F = {
  marta:    { uid: 'uid-marta',    funcionariaId: 'marta',    nome: 'Marta' },
  renata:   { uid: 'uid-renata',   funcionariaId: 'renata',   nome: 'Renata' },
  luciana:  { uid: 'uid-luciana',  funcionariaId: 'luciana',  nome: 'Luciana' },
  elisete:  { uid: 'uid-elisete',  funcionariaId: 'elisete',  nome: 'Elisete' },
  saionara: { uid: 'uid-saionara', funcionariaId: 'saionara', nome: 'Saionara' },
};

function seedTradeSnapshot(trade) {
  mockGetDocs.mockResolvedValueOnce({
    empty: false,
    docs: [{ id: trade.id || 'sobreaviso-doc-id', data: () => trade }],
  });
}

function makeTrade(overrides = {}) {
  return {
    codigo: 'SB100001',
    solicitanteId: F.marta.uid,
    solicitanteNome: 'Marta',
    solicitanteFuncionariaId: F.marta.funcionariaId,
    solicitanteRole: 'colaborador-materno',
    dataSobreaviso: '2026-04-15',
    dataDesejada: null,
    descricao: 'Compromisso pessoal',
    destinatarioId: null,
    destinatarioNome: null,
    respondidoPorId: null,
    respondidoPorNome: null,
    respondidoPorFuncionariaId: null,
    status: 'pendente',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('trocaSobreavisoService — funcionárias trocando sobreavisos', () => {
  describe('A. Cobertura unidirecional', () => {
    it('A1 createTradeRequest — cria cobertura aberta', async () => {
      const { trade, error } = await createTradeRequest({
        solicitanteId: F.marta.uid,
        solicitanteNome: 'Marta',
        solicitanteFuncionariaId: F.marta.funcionariaId,
        dataSobreaviso: '2026-04-15',
        descricao: 'Cobertura',
      });
      expect(error).toBeNull();
      expect(trade.codigo).toMatch(/^SB\d+$/);
      expect(trade.status).toBe('pendente');
      expect(trade.dataDesejada).toBeNull();
    });

    it('A2 sem solicitanteFuncionariaId — retorna erro', async () => {
      const { trade, error } = await createTradeRequest({
        solicitanteId: F.marta.uid,
        solicitanteNome: 'Marta',
        solicitanteFuncionariaId: null,
        dataSobreaviso: '2026-04-15',
        descricao: 'x',
      });
      expect(trade).toBeNull();
      expect(error).toContain('solicitante');
    });

    it('A3 aceitar cobertura — escreve override + atualiza trade', async () => {
      const trade = makeTrade();
      seedTradeSnapshot(trade);
      const result = await acceptTrade(trade.codigo, F.saionara.uid, 'Saionara', F.saionara.funcionariaId);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockBatchSet).toHaveBeenCalledTimes(1); // só 1 override (cobertura)
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('A4 solicitante não pode aceitar a própria', async () => {
      const trade = makeTrade();
      seedTradeSnapshot(trade);
      const result = await acceptTrade(trade.codigo, F.marta.uid, 'Marta', F.marta.funcionariaId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('própria');
    });

    it('A5 cobertura direcionada bloqueia aceitar por outra', async () => {
      const trade = makeTrade({ destinatarioId: F.elisete.funcionariaId });
      seedTradeSnapshot(trade);
      const result = await acceptTrade(trade.codigo, F.saionara.uid, 'Saionara', F.saionara.funcionariaId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('direcionada');
    });
  });

  describe('B. Swap bidirecional', () => {
    it('B1 createTradeRequest — swap requer destinatário', async () => {
      const { trade, error } = await createTradeRequest({
        solicitanteId: F.marta.uid,
        solicitanteNome: 'Marta',
        solicitanteFuncionariaId: F.marta.funcionariaId,
        dataSobreaviso: '2026-04-15',
        dataDesejada: '2026-05-10',
        descricao: 'Quero trocar',
        destinatarioId: null,
      });
      expect(trade).toBeNull();
      expect(error).toContain('destinatária');
    });

    it('B2 aceitar swap — escreve 2 overrides atomicamente', async () => {
      const trade = makeTrade({
        dataSobreaviso: '2026-04-15',
        dataDesejada: '2026-05-10',
        destinatarioId: F.elisete.funcionariaId,
        destinatarioNome: 'Elisete',
      });
      seedTradeSnapshot(trade);
      const result = await acceptTrade(trade.codigo, F.elisete.uid, 'Elisete', F.elisete.funcionariaId);
      expect(result.success).toBe(true);
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
    });

    it('B3 aceitar swap direcionado com funcionariaId errado — falha', async () => {
      const trade = makeTrade({
        dataSobreaviso: '2026-04-15',
        dataDesejada: '2026-05-10',
        destinatarioId: F.elisete.funcionariaId,
        destinatarioNome: 'Elisete',
      });
      seedTradeSnapshot(trade);
      const result = await acceptTrade(trade.codigo, F.luciana.uid, 'Luciana', F.luciana.funcionariaId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('direcionada');
      expect(mockBatchSet).not.toHaveBeenCalled();
    });
  });

  describe('C. Rejeição e cancelamento', () => {
    it('C1 rejeitar — atualiza status', async () => {
      const trade = makeTrade();
      seedTradeSnapshot(trade);
      const result = await rejectTrade(trade.codigo, F.saionara.uid, 'Saionara');
      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    it('C2 cancelar — só solicitante pode', async () => {
      const trade = makeTrade();
      seedTradeSnapshot(trade);
      const wrong = await cancelTrade(trade.codigo, F.saionara.uid);
      expect(wrong.success).toBe(false);

      seedTradeSnapshot(trade);
      const right = await cancelTrade(trade.codigo, F.marta.uid);
      expect(right.success).toBe(true);
    });
  });

  describe('D. Retornos do trade', () => {
    it('D1 aceitar retorna trade', async () => {
      const trade = makeTrade();
      seedTradeSnapshot(trade);
      const result = await acceptTrade(trade.codigo, F.saionara.uid, 'Saionara', F.saionara.funcionariaId);
      expect(result.trade).toBeTruthy();
      expect(result.trade.codigo).toBe(trade.codigo);
    });
  });

  describe('E. Filtros de subscribeTrades', () => {
    // subscribeTrades usa createFirestoreSubscription que dispara onData
    // com o snapshot. Simulamos chamando manualmente o callback passado ao mock.

    function seedSubscription(allTrades) {
      const snapshot = {
        docs: allTrades.map((t, i) => ({ id: `doc-${i}`, data: () => t })),
      };
      // captura o handler onData passado por subscribeTrades → createFirestoreSubscription
      mockOnSnapshot.mockImplementation((_q, onData) => {
        onData(snapshot);
      });
    }

    it('E1 myTrades — criadas por mim + aceitas por mim + direcionadas ao meu funcionariaId', async () => {
      const myCriada  = makeTrade({ codigo: 'SB001', solicitanteId: F.marta.uid,    solicitanteFuncionariaId: F.marta.funcionariaId });
      const outraAbertaParaMim = makeTrade({
        codigo: 'SB002', solicitanteId: F.renata.uid, solicitanteFuncionariaId: F.renata.funcionariaId,
        destinatarioId: F.marta.funcionariaId,
      });
      const aceitaPorMim = makeTrade({
        codigo: 'SB003', solicitanteId: F.elisete.uid, solicitanteFuncionariaId: F.elisete.funcionariaId,
        respondidoPorId: F.marta.uid, respondidoPorFuncionariaId: F.marta.funcionariaId, status: 'aceita',
      });
      const naoMinha = makeTrade({
        codigo: 'SB004', solicitanteId: F.saionara.uid, solicitanteFuncionariaId: F.saionara.funcionariaId,
        destinatarioId: F.luciana.funcionariaId,
      });

      seedSubscription([myCriada, outraAbertaParaMim, aceitaPorMim, naoMinha]);

      const callback = vi.fn();
      subscribeTrades(F.marta.uid, () => F.marta.funcionariaId, callback);

      expect(callback).toHaveBeenCalled();
      const { myTrades } = callback.mock.calls[0][0];
      const codigos = myTrades.map((t) => t.codigo).sort();
      expect(codigos).toEqual(['SB001', 'SB002', 'SB003']);
      expect(codigos).not.toContain('SB004');
    });

    it('E2 pendingForMe — exclui minhas e direcionadas a outras', async () => {
      const minha = makeTrade({
        codigo: 'SB101', solicitanteId: F.marta.uid, solicitanteFuncionariaId: F.marta.funcionariaId, status: 'pendente',
      });
      const abertaTerceiros = makeTrade({
        codigo: 'SB102', solicitanteId: F.renata.uid, solicitanteFuncionariaId: F.renata.funcionariaId, status: 'pendente', destinatarioId: null,
      });
      const paraMim = makeTrade({
        codigo: 'SB103', solicitanteId: F.elisete.uid, solicitanteFuncionariaId: F.elisete.funcionariaId, status: 'pendente',
        destinatarioId: F.marta.funcionariaId,
      });
      const paraOutra = makeTrade({
        codigo: 'SB104', solicitanteId: F.saionara.uid, solicitanteFuncionariaId: F.saionara.funcionariaId, status: 'pendente',
        destinatarioId: F.luciana.funcionariaId,
      });
      const aceitaJa = makeTrade({
        codigo: 'SB105', solicitanteId: F.luciana.uid, solicitanteFuncionariaId: F.luciana.funcionariaId, status: 'aceita', destinatarioId: null,
      });

      seedSubscription([minha, abertaTerceiros, paraMim, paraOutra, aceitaJa]);

      const callback = vi.fn();
      subscribeTrades(F.marta.uid, () => F.marta.funcionariaId, callback);

      const { pendingForMe } = callback.mock.calls[0][0];
      const codigos = pendingForMe.map((t) => t.codigo).sort();
      expect(codigos).toEqual(['SB102', 'SB103']);
      expect(codigos).not.toContain('SB101'); // minha
      expect(codigos).not.toContain('SB104'); // direcionada a Luciana
      expect(codigos).not.toContain('SB105'); // já aceita
    });
  });
});
