/**
 * Troca de Plantao Service
 * Funcoes para gerenciar solicitacoes de troca de plantao no Firestore.
 *
 * Ao aceitar uma troca, também grava override em residenciaPlantaoDiario/{data}
 * para que a escala reflita automaticamente o novo plantonista.
 *
 * Modos de troca:
 *   - Cobertura (unidirecional): só dataPlantao. Aceitador cobre o plantão.
 *   - Swap bidirecional: dataPlantao + dataDesejada. Aceitador e solicitante
 *     trocam plantões em ambas as datas.
 */
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

const COLLECTION = 'trocas_plantao';
const OVERRIDE_COLLECTION = 'residenciaPlantaoDiario';

function generateTradeCode() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `TR${digits}`;
}

/**
 * Criar solicitacao de troca de plantao.
 * @param {Object} params
 * @param {string} params.solicitanteId - Firebase UID do solicitante
 * @param {string} params.solicitanteNome
 * @param {string} params.solicitanteResidenteId - ID do residente (ex: 'r2-daniel')
 * @param {string} params.dataPlantao - Data do plantão do solicitante (YYYY-MM-DD)
 * @param {string|null} [params.dataDesejada] - Data que o solicitante pode cobrir em troca (swap)
 * @param {string} params.descricao
 * @param {string|null} [params.destinatarioId] - residenteId do destinatário (opcional)
 * @param {string|null} [params.destinatarioNome]
 */
export async function createTradeRequest({
  solicitanteId,
  solicitanteNome,
  solicitanteRole,
  solicitanteAno,
  solicitanteResidenteId,
  dataPlantao,
  dataDesejada = null,
  descricao,
  destinatarioId = null,
  destinatarioNome = null,
}) {
  try {
    if (!solicitanteResidenteId) {
      return { trade: null, error: 'Residente solicitante não identificado na escala' };
    }
    if (dataDesejada && !destinatarioId) {
      return { trade: null, error: 'Para trocar datas, selecione um destinatário específico' };
    }

    const codigo = generateTradeCode();
    const tradeData = {
      codigo,
      solicitanteId,
      solicitanteNome,
      solicitanteResidenteId,
      solicitanteRole: solicitanteRole || null,
      solicitanteAno: solicitanteAno || null,
      dataPlantao,
      dataDesejada: dataDesejada || null,
      descricao,
      destinatarioId: destinatarioId || null,
      destinatarioNome: destinatarioNome || null,
      respondidoPorId: null,
      respondidoPorNome: null,
      respondidoPorResidenteId: null,
      status: 'pendente',
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      respostaEm: null,
    };

    const docRef = await addDoc(collection(db, COLLECTION), tradeData);
    return { trade: { id: docRef.id, ...tradeData }, error: null };
  } catch (error) {
    console.error('Erro ao criar solicitacao de troca:', error);
    return { trade: null, error: error.message };
  }
}

/**
 * Aceitar uma troca. Aplica overrides atomicamente na(s) data(s) trocada(s).
 * @param {string} codigo
 * @param {string} userId - Firebase UID do aceitador
 * @param {string} userName
 * @param {string} userResidenteId - residenteId do aceitador (obrigatório)
 */
export async function acceptTrade(codigo, userId, userName, userResidenteId) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError, trade: null };
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade };
    if (trade.solicitanteId === userId) return { success: false, error: 'Você não pode aceitar sua própria troca', trade };
    if (!userResidenteId) return { success: false, error: 'Residente aceitador não identificado na escala', trade };
    if (trade.destinatarioId && trade.destinatarioId !== userResidenteId) {
      return { success: false, error: 'Esta troca foi direcionada a outro residente', trade };
    }

    const tradeRef = doc(db, COLLECTION, docId);
    const batch = writeBatch(db);

    batch.update(tradeRef, {
      status: 'aceita',
      respondidoPorId: userId,
      respondidoPorNome: userName,
      respondidoPorResidenteId: userResidenteId,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    });

    batch.set(doc(db, OVERRIDE_COLLECTION, trade.dataPlantao), {
      residenteOverride: userResidenteId,
      origem: 'troca',
      trocaId: trade.codigo,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    if (trade.dataDesejada) {
      batch.set(doc(db, OVERRIDE_COLLECTION, trade.dataDesejada), {
        residenteOverride: trade.solicitanteResidenteId,
        origem: 'troca',
        trocaId: trade.codigo,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }

    await batch.commit();
    return { success: true, error: null, trade };
  } catch (error) {
    console.error('Erro ao aceitar troca:', error);
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
    console.error('Erro ao rejeitar troca:', error);
    return { success: false, error: error.message, trade: null };
  }
}

export async function cancelTrade(codigo, userId) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError, trade: null };
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade };
    if (trade.solicitanteId !== userId) return { success: false, error: 'Somente o solicitante pode cancelar a troca', trade };

    const docRef = doc(db, COLLECTION, docId);
    await updateDoc(docRef, {
      status: 'cancelada',
      atualizadoEm: serverTimestamp(),
    });

    return { success: true, error: null, trade };
  } catch (error) {
    console.error('Erro ao cancelar troca:', error);
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
    console.error('Erro ao buscar minhas trocas:', error);
    return { trades: [], error: error.message };
  }
}

/**
 * Trocas pendentes disponíveis para o usuário (residenteId-based filter).
 */
export async function getPendingTradesForUser(userId, userResidenteId) {
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
        (t.destinatarioId === null || (userResidenteId && t.destinatarioId === userResidenteId))
      );
    return { trades, error: null };
  } catch (error) {
    console.error('Erro ao buscar trocas pendentes:', error);
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
    console.error('Erro ao buscar troca por codigo:', error);
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
    console.error('Erro ao buscar troca por codigo:', error);
    return { trade: null, docId: null, error: error.message };
  }
}

/**
 * Real-time listener com retry/reconnect.
 * `getResidenteId` é uma função para permitir residenteId mudar sem re-subscrever.
 */
export function subscribeTrades(userId, getResidenteId, callback) {
  const q = query(collection(db, COLLECTION), orderBy('criadoEm', 'desc'));

  const { cleanup } = createFirestoreSubscription(
    q,
    {
      onData: (snapshot) => {
        const allTrades = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const userResidenteId = typeof getResidenteId === 'function' ? getResidenteId() : getResidenteId;
        const myTrades = allTrades.filter(t =>
          t.solicitanteId === userId ||
          t.respondidoPorId === userId ||
          (userResidenteId && (t.destinatarioId === userResidenteId || t.respondidoPorResidenteId === userResidenteId))
        );
        const pendingForMe = allTrades.filter(t =>
          t.status === 'pendente' &&
          t.solicitanteId !== userId &&
          (t.destinatarioId === null || (userResidenteId && t.destinatarioId === userResidenteId))
        );
        callback({ myTrades, pendingForMe });
      },
      onError: (error) => {
        console.error('Erro no listener de trocas:', error);
        callback({ myTrades: [], pendingForMe: [] });
      },
    }
  );

  return cleanup;
}
