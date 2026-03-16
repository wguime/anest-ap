/**
 * Residencia Service
 * Funcoes para gerenciar dados de estagios e plantao da residencia no Firestore
 */
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

// Colecao base
const COLLECTION = 'residencia';

/**
 * Buscar dados dos estagios da residencia
 * @returns {Promise<{residentes: Array, error: string|null}>}
 */
export async function getEstagios() {
  try {
    const docRef = doc(db, COLLECTION, 'estagios');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { residentes: docSnap.data().residentes || [], error: null };
    }
    // Documento nao existe, retorna array vazio
    return { residentes: [], error: null };
  } catch (error) {
    console.error('Erro ao buscar estagios:', error);
    return { residentes: [], error: error.message };
  }
}

/**
 * Atualizar dados dos estagios da residencia
 * @param {Array} residentes - Array de residentes com {id, nome, ano, estagio, cirurgiao}
 * @param {string} userId - ID do usuario que esta atualizando
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updateEstagios(payload, userId) {
  try {
    const { residentes, cardData, cardTurno } = payload;
    const docRef = doc(db, COLLECTION, 'estagios');
    await setDoc(docRef, {
      residentes,
      cardData: cardData || null,
      cardTurno: cardTurno || null,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar estagios:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar dados do plantao da residencia
 * @returns {Promise<{plantao: Object|null, error: string|null}>}
 */
export async function getPlantao() {
  try {
    const docRef = doc(db, COLLECTION, 'plantao');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { plantao: docSnap.data(), error: null };
    }
    // Documento nao existe, retorna null
    return { plantao: null, error: null };
  } catch (error) {
    console.error('Erro ao buscar plantao:', error);
    return { plantao: null, error: error.message };
  }
}

/**
 * Atualizar dados do plantao da residencia
 * @param {Object} plantao - Dados do plantao {residente, ano, data, hora}
 * @param {string} userId - ID do usuario que esta atualizando
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updatePlantao(payload, userId) {
  try {
    const { cardData, cardTurno, ...plantao } = payload;
    const docRef = doc(db, COLLECTION, 'plantao');
    await setDoc(docRef, {
      ...plantao,
      cardData: cardData || null,
      cardTurno: cardTurno || null,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar plantao:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Subscribe to real-time updates of estagios data
 * @param {Function} callback - Callback receiving {residentes: Array, error: string|null}
 * @param {Object} [options] - Options including onStatusChange callback
 * @param {Function} [options.onStatusChange] - Called with 'connected' | 'reconnecting' | 'error'
 * @returns {Function} Unsubscribe/cleanup function
 */
export function subscribeEstagios(callback, options = {}) {
  const docRef = doc(db, COLLECTION, 'estagios');
  const { cleanup } = createFirestoreSubscription(
    docRef,
    {
      onData: (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          callback({ residentes: data.residentes || [], cardData: data.cardData || null, cardTurno: data.cardTurno || null, error: null });
        } else {
          callback({ residentes: [], cardData: null, cardTurno: null, error: null });
        }
      },
      onError: (error) => {
        console.error('Erro no listener de estagios:', error);
        callback({ residentes: [], cardData: null, cardTurno: null, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

/**
 * Subscribe to real-time updates of plantao data
 * @param {Function} callback - Callback receiving {plantao: Object|null, error: string|null}
 * @param {Object} [options] - Options including onStatusChange callback
 * @param {Function} [options.onStatusChange] - Called with 'connected' | 'reconnecting' | 'error'
 * @returns {Function} Unsubscribe/cleanup function
 */
export function subscribePlantao(callback, options = {}) {
  const docRef = doc(db, COLLECTION, 'plantao');
  const { cleanup } = createFirestoreSubscription(
    docRef,
    {
      onData: (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          callback({ plantao: data, cardData: data.cardData || null, cardTurno: data.cardTurno || null, error: null });
        } else {
          callback({ plantao: null, cardData: null, cardTurno: null, error: null });
        }
      },
      onError: (error) => {
        console.error('Erro no listener de plantao:', error);
        callback({ plantao: null, cardData: null, cardTurno: null, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

