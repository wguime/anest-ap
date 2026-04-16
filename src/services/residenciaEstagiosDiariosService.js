/**
 * Residencia Estágios Diários Service
 * CRUD do doc Firestore residenciaEstagiosDiarios/{slotKey}
 * onde slotKey = "YYYY-MM-DD-{manha|tarde}".
 *
 * Guarda cirurgiões e overrides de estágio por (data, turno).
 * Estágios base vêm da tabela estática em src/data/residencia2026.js.
 *
 * Usa coleção top-level (e não subcoleção de residencia/estagios) para
 * evitar conflitos de state no listener do Firestore com o doc legado.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

const COLLECTION = 'residenciaEstagiosDiarios';

function docRefFor(slotKey) {
  return doc(db, COLLECTION, slotKey);
}

export async function getEstagiosDiarios(slotKey) {
  try {
    const snap = await getDoc(docRefFor(slotKey));
    if (snap.exists()) {
      const data = snap.data();
      return {
        data: {
          cirurgiaos: data.cirurgiaos || {},
          estagiosOverride: data.estagiosOverride || {},
        },
        error: null,
      };
    }
    return { data: { cirurgiaos: {}, estagiosOverride: {} }, error: null };
  } catch (error) {
    console.error('Erro ao buscar estagios diarios:', error);
    return { data: { cirurgiaos: {}, estagiosOverride: {} }, error: error.message };
  }
}

export function subscribeEstagiosDiarios(slotKey, callback, options = {}) {
  const { cleanup } = createFirestoreSubscription(
    docRefFor(slotKey),
    {
      onData: (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          callback({
            cirurgiaos: data.cirurgiaos || {},
            estagiosOverride: data.estagiosOverride || {},
            error: null,
          });
        } else {
          callback({ cirurgiaos: {}, estagiosOverride: {}, error: null });
        }
      },
      onError: (error) => {
        console.error('Erro no listener de estagios diarios:', error);
        callback({ cirurgiaos: {}, estagiosOverride: {}, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

/**
 * Salva o doc do slot. Usa setDoc sem merge para que maps removidos sumam.
 */
export async function updateSlotDiario(slotKey, payload, userId) {
  try {
    const cirurgiaos = payload.cirurgiaos || {};
    const estagiosOverride = payload.estagiosOverride || {};
    await setDoc(docRefFor(slotKey), {
      cirurgiaos,
      estagiosOverride,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar slot diario:', error);
    return { success: false, error: error.message };
  }
}
