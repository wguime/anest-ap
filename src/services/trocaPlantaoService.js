/**
 * Troca de Plantao Service
 * Funcoes para gerenciar solicitacoes de troca de plantao no Firestore
 */
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'trocas_plantao';

/**
 * Gerar codigo unico para troca de plantao
 * Formato: "TR" + 6 digitos aleatorios (ex: "TR847291")
 * @returns {string}
 */
function generateTradeCode() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `TR${digits}`;
}

/**
 * Criar solicitacao de troca de plantao
 * @param {Object} params
 * @param {string} params.solicitanteId - Firebase UID do solicitante
 * @param {string} params.solicitanteNome - Nome do solicitante
 * @param {string} params.dataPlantao - Data do plantao (ISO date)
 * @param {string} params.descricao - Descricao da solicitacao
 * @param {string|null} [params.destinatarioId] - Firebase UID do destinatario (opcional)
 * @param {string|null} [params.destinatarioNome] - Nome do destinatario (opcional)
 * @returns {Promise<{trade: Object|null, error: string|null}>}
 */
export async function createTradeRequest({ solicitanteId, solicitanteNome, solicitanteRole, solicitanteAno, dataPlantao, descricao, destinatarioId = null, destinatarioNome = null }) {
  try {
    const codigo = generateTradeCode();
    const tradeData = {
      codigo,
      solicitanteId,
      solicitanteNome,
      solicitanteRole: solicitanteRole || null,
      solicitanteAno: solicitanteAno || null,
      dataPlantao,
      descricao,
      destinatarioId: destinatarioId || null,
      destinatarioNome: destinatarioNome || null,
      respondidoPorId: null,
      respondidoPorNome: null,
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
 * Aceitar uma troca de plantao
 * @param {string} codigo - Codigo da troca (ex: "TR847291")
 * @param {string} userId - Firebase UID do usuario que aceita
 * @param {string} userName - Nome do usuario que aceita
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function acceptTrade(codigo, userId, userName) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError };
    if (!trade) return { success: false, error: 'Troca não encontrada' };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente' };
    if (trade.solicitanteId === userId) return { success: false, error: 'Você não pode aceitar sua própria troca' };

    const docRef = doc(db, COLLECTION, docId);
    await updateDoc(docRef, {
      status: 'aceita',
      respondidoPorId: userId,
      respondidoPorNome: userName,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao aceitar troca:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rejeitar uma troca de plantao
 * @param {string} codigo - Codigo da troca
 * @param {string} userId - Firebase UID do usuario que rejeita
 * @param {string} userName - Nome do usuario que rejeita
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function rejectTrade(codigo, userId, userName) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError };
    if (!trade) return { success: false, error: 'Troca não encontrada' };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente' };
    if (trade.solicitanteId === userId) return { success: false, error: 'Você não pode rejeitar sua própria troca' };

    const docRef = doc(db, COLLECTION, docId);
    await updateDoc(docRef, {
      status: 'rejeitada',
      respondidoPorId: userId,
      respondidoPorNome: userName,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao rejeitar troca:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancelar uma troca de plantao (somente pelo solicitante)
 * @param {string} codigo - Codigo da troca
 * @param {string} userId - Firebase UID do solicitante
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function cancelTrade(codigo, userId) {
  try {
    const { trade, docId, error: findError } = await findTradeByCodeInternal(codigo);
    if (findError) return { success: false, error: findError };
    if (!trade) return { success: false, error: 'Troca não encontrada' };
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente' };
    if (trade.solicitanteId !== userId) return { success: false, error: 'Somente o solicitante pode cancelar a troca' };

    const docRef = doc(db, COLLECTION, docId);
    await updateDoc(docRef, {
      status: 'cancelada',
      atualizadoEm: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao cancelar troca:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar trocas criadas pelo usuario
 * @param {string} userId - Firebase UID do solicitante
 * @returns {Promise<{trades: Array, error: string|null}>}
 */
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
 * Buscar trocas pendentes disponiveis para o usuario
 * Inclui trocas abertas (sem destinatario) e trocas direcionadas ao usuario.
 * Exclui trocas criadas pelo proprio usuario.
 * @param {string} userId - Firebase UID do usuario
 * @returns {Promise<{trades: Array, error: string|null}>}
 */
export async function getPendingTradesForUser(userId) {
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
        (t.destinatarioId === null || t.destinatarioId === userId)
      );
    return { trades, error: null };
  } catch (error) {
    console.error('Erro ao buscar trocas pendentes:', error);
    return { trades: [], error: error.message };
  }
}

/**
 * Buscar troca pelo codigo (uso publico)
 * @param {string} codigo - Codigo da troca (ex: "TR847291")
 * @returns {Promise<{trade: Object|null, error: string|null}>}
 */
export async function findTradeByCode(codigo) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('codigo', '==', codigo)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return { trade: null, error: null };
    }
    const d = snapshot.docs[0];
    return { trade: { id: d.id, ...d.data() }, error: null };
  } catch (error) {
    console.error('Erro ao buscar troca por codigo:', error);
    return { trade: null, error: error.message };
  }
}

/**
 * Buscar troca pelo codigo (uso interno - retorna docId separado)
 * @param {string} codigo
 * @returns {Promise<{trade: Object|null, docId: string|null, error: string|null}>}
 */
async function findTradeByCodeInternal(codigo) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('codigo', '==', codigo)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return { trade: null, docId: null, error: null };
    }
    const d = snapshot.docs[0];
    return { trade: d.data(), docId: d.id, error: null };
  } catch (error) {
    console.error('Erro ao buscar troca por codigo:', error);
    return { trade: null, docId: null, error: error.message };
  }
}

/**
 * Inscrever-se para atualizacoes em tempo real das trocas envolvendo o usuario
 * @param {string} userId - Firebase UID do usuario
 * @param {function} callback - Funcao chamada com { myTrades, pendingForMe }
 * @returns {function} Funcao para cancelar a inscricao (unsubscribe)
 */
export function subscribeTrades(userId, callback) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('criadoEm', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const allTrades = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const myTrades = allTrades.filter(t =>
      t.solicitanteId === userId ||
      t.destinatarioId === userId ||
      t.respondidoPorId === userId
    );
    const pendingForMe = allTrades.filter(t =>
      t.status === 'pendente' &&
      t.solicitanteId !== userId &&
      (t.destinatarioId === null || t.destinatarioId === userId)
    );
    callback({ myTrades, pendingForMe });
  }, (error) => {
    console.error('Erro no listener de trocas:', error);
    callback({ myTrades: [], pendingForMe: [] });
  });

  return unsubscribe;
}
