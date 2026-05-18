/**
 * Troca de Sobreaviso Materno Service
 * Gerencia solicitacoes de troca de sobreaviso no Firestore.
 *
 * Ao aceitar uma troca, também grava override em sobreavisoMaternoDiario/{data}
 * para que a escala reflita automaticamente a nova funcionária de sobreaviso.
 *
 * Modos de troca:
 *   - Cobertura (unidirecional): só dataSobreaviso. Aceitadora cobre o sobreaviso.
 *   - Swap bidirecional: dataSobreaviso + dataDesejada. Ambas trocam dias.
 */
import { collection, addDoc, getDocs, doc, updateDoc, writeBatch, query, where, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

const COLLECTION = 'trocas_sobreaviso';
const OVERRIDE_COLLECTION = 'sobreavisoMaternoDiario';

function generateTradeCode() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `SB${digits}`;
}

/**
 * Criar solicitacao de troca de sobreaviso.
 * @param {Object} params
 * @param {string} params.solicitanteId - Firebase UID
 * @param {string} params.solicitanteNome
 * @param {string} params.solicitanteFuncionariaId - ex: 'marta'
 * @param {string} params.dataSobreaviso - YYYY-MM-DD
 * @param {string|null} [params.dataDesejada] - Data da outra funcionária (swap)
 * @param {string} params.descricao
 * @param {string|null} [params.destinatarioId] - funcionariaId do destinatário
 * @param {string|null} [params.destinatarioNome]
 */
export async function createTradeRequest({
  solicitanteId,
  solicitanteNome,
  solicitanteRole,
  solicitanteFuncionariaId,
  dataSobreaviso,
  dataDesejada = null,
  descricao,
  destinatarioId = null,
  destinatarioNome = null,
}) {
  try {
    if (!solicitanteFuncionariaId) {
      return { trade: null, error: 'Funcionária solicitante não identificada na escala' };
    }
    if (dataDesejada && !destinatarioId) {
      return { trade: null, error: 'Para trocar datas, selecione uma destinatária específica' };
    }

    const codigo = generateTradeCode();
    const tradeData = {
      codigo,
      solicitanteId,
      solicitanteNome,
      solicitanteFuncionariaId,
      solicitanteRole: solicitanteRole || null,
      dataSobreaviso,
      dataDesejada: dataDesejada || null,
      descricao,
      destinatarioId: destinatarioId || null,
      destinatarioNome: destinatarioNome || null,
      respondidoPorId: null,
      respondidoPorNome: null,
      respondidoPorFuncionariaId: null,
      status: 'pendente',
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      respostaEm: null,
    };

    const docRef = await addDoc(collection(db, COLLECTION), tradeData);
    return { trade: { id: docRef.id, ...tradeData }, error: null };
  } catch (error) {
    console.error('Erro ao criar solicitacao de troca sobreaviso:', error);
    return { trade: null, error: error.message };
  }
}

export async function acceptTrade(codigo, userId, userName, userFuncionariaId) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError, trade: null };
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade };
    if (trade.solicitanteId === userId) return { success: false, error: 'Você não pode aceitar sua própria troca', trade };
    if (!userFuncionariaId) return { success: false, error: 'Funcionária aceitadora não identificada na escala', trade };
    if (trade.destinatarioId && trade.destinatarioId !== userFuncionariaId) {
      return { success: false, error: 'Esta troca foi direcionada a outra funcionária', trade };
    }

    const tradeRef = doc(db, COLLECTION, docId);
    const batch = writeBatch(db);

    batch.update(tradeRef, {
      status: 'aceita',
      respondidoPorId: userId,
      respondidoPorNome: userName,
      respondidoPorFuncionariaId: userFuncionariaId,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    });

    batch.set(doc(db, OVERRIDE_COLLECTION, trade.dataSobreaviso), {
      funcionariaOverride: userFuncionariaId,
      origem: 'troca',
      trocaId: trade.codigo,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    if (trade.dataDesejada) {
      batch.set(doc(db, OVERRIDE_COLLECTION, trade.dataDesejada), {
        funcionariaOverride: trade.solicitanteFuncionariaId,
        origem: 'troca',
        trocaId: trade.codigo,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }

    await batch.commit();
    return { success: true, error: null, trade };
  } catch (error) {
    console.error('Erro ao aceitar troca sobreaviso:', error);
    return { success: false, error: error.message, trade: null };
  }
}

export async function rejectTrade(codigo, userId, userName) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError, trade: null };
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade };
    if (trade.solicitanteId === userId) return { success: false, error: 'Você não pode rejeitar sua própria troca', trade };

    const docRef = doc(db, COLLECTION, docId);
    await updateDoc(docRef, {
      status: 'rejeitada',
      respondidoPorId: userId,
      respondidoPorNome: userName,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    });

    return { success: true, error: null, trade };
  } catch (error) {
    console.error('Erro ao rejeitar troca sobreaviso:', error);
    return { success: false, error: error.message, trade: null };
  }
}

export async function cancelTrade(codigo, userId) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError, trade: null };
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade };
    if (trade.solicitanteId !== userId) return { success: false, error: 'Somente a solicitante pode cancelar a troca', trade };

    const docRef = doc(db, COLLECTION, docId);
    await updateDoc(docRef, {
      status: 'cancelada',
      atualizadoEm: serverTimestamp(),
    });

    return { success: true, error: null, trade };
  } catch (error) {
    console.error('Erro ao cancelar troca sobreaviso:', error);
    return { success: false, error: error.message, trade: null };
  }
}

export async function getMyTrades(userId) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('solicitanteId', '==', userId),
      orderBy('criadoEm', 'desc')
    );
    const snapshot = await getDocs(q);
    const trades = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { trades, error: null };
  } catch (error) {
    console.error('Erro ao buscar minhas trocas sobreaviso:', error);
    return { trades: [], error: error.message };
  }
}

export async function getPendingTradesForUser(userId, userFuncionariaId) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'pendente'),
      orderBy('criadoEm', 'desc')
    );
    const snapshot = await getDocs(q);
    const trades = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t =>
        t.solicitanteId !== userId &&
        (t.destinatarioId === null || (userFuncionariaId && t.destinatarioId === userFuncionariaId))
      );
    return { trades, error: null };
  } catch (error) {
    console.error('Erro ao buscar trocas pendentes sobreaviso:', error);
    return { trades: [], error: error.message };
  }
}

export async function findTradeByCode(codigo) {
  try {
    const q = query(collection(db, COLLECTION), where('codigo', '==', codigo));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { trade: null, error: null };
    const d = snapshot.docs[0];
    return { trade: { id: d.id, ...d.data() }, error: null };
  } catch (error) {
    console.error('Erro ao buscar troca sobreaviso por codigo:', error);
    return { trade: null, error: error.message };
  }
}

async function findTradeByCodeInternal(codigo) {
  try {
    const q = query(collection(db, COLLECTION), where('codigo', '==', codigo));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { trade: null, docId: null, error: null };
    const d = snapshot.docs[0];
    return { trade: d.data(), docId: d.id, error: null };
  } catch (error) {
    console.error('Erro ao buscar troca sobreaviso por codigo:', error);
    return { trade: null, docId: null, error: error.message };
  }
}

/**
 * Listener real-time SEM filtro de usuário — visão administrativa.
 * Retorna todas as trocas da coleção em ordem decrescente de criação.
 */
export function subscribeAllTrades(callback) {
  const q = query(collection(db, COLLECTION), orderBy('criadoEm', 'desc'));
  const { cleanup } = createFirestoreSubscription(q, {
    onData: (snapshot) => {
      const allTrades = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback({ trades: allTrades, error: null });
    },
    onError: (error) => {
      console.error('Erro no listener admin de trocas sobreaviso:', error);
      callback({ trades: [], error: error.message });
    },
  });
  return cleanup;
}

export function subscribeTrades(userId, getFuncionariaId, callback) {
  const q = query(collection(db, COLLECTION), orderBy('criadoEm', 'desc'));

  const { cleanup } = createFirestoreSubscription(
    q,
    {
      onData: (snapshot) => {
        const allTrades = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const userFuncionariaId = typeof getFuncionariaId === 'function' ? getFuncionariaId() : getFuncionariaId;
        const myTrades = allTrades.filter(t =>
          t.solicitanteId === userId ||
          t.respondidoPorId === userId ||
          (userFuncionariaId && (t.destinatarioId === userFuncionariaId || t.respondidoPorFuncionariaId === userFuncionariaId))
        );
        const pendingForMe = allTrades.filter(t =>
          t.status === 'pendente' &&
          t.solicitanteId !== userId &&
          (t.destinatarioId === null || (userFuncionariaId && t.destinatarioId === userFuncionariaId))
        );
        callback({ myTrades, pendingForMe });
      },
      onError: (error) => {
        console.error('Erro no listener de trocas sobreaviso:', error);
        callback({ myTrades: [], pendingForMe: [] });
      },
    }
  );

  return cleanup;
}
