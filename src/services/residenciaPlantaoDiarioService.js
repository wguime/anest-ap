/**
 * Residencia Plantão Diário Service
 * CRUD do doc Firestore residenciaPlantaoDiario/{YYYY-MM-DD}
 *
 * Guarda overrides do residente de plantão por dia. Plantão base vem
 * da tabela estática em src/data/plantao2026.js.
 *
 * Usa coleção top-level para evitar conflito com o doc legado residencia/plantao.
 */
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

const COLLECTION = 'residenciaPlantaoDiario';

function docRefFor(dateKey) {
  return doc(db, COLLECTION, dateKey);
}

export async function getPlantaoDiario(dateKey) {
  try {
    const snap = await getDoc(docRefFor(dateKey));
    if (snap.exists()) {
      return { data: snap.data(), error: null };
    }
    return { data: null, error: null };
  } catch (error) {
    console.error('Erro ao buscar plantao diario:', error);
    return { data: null, error: error.message };
  }
}

export function subscribePlantaoDiario(dateKey, callback, options = {}) {
  const { cleanup } = createFirestoreSubscription(
    docRefFor(dateKey),
    {
      onData: (snap) => {
        if (snap.exists()) {
          callback({ data: snap.data(), error: null });
        } else {
          callback({ data: null, error: null });
        }
      },
      onError: (error) => {
        console.error('Erro no listener de plantao diario:', error);
        callback({ data: null, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

/**
 * Grava override do plantão do dia. Se residenteOverride for null/undefined,
 * deleta o doc (volta à escala estática).
 */
export async function updatePlantaoDiario(dateKey, payload, userId) {
  try {
    const { residenteOverride, origem, trocaId } = payload || {};
    if (!residenteOverride) {
      await deleteDoc(docRefFor(dateKey));
      return { success: true, error: null };
    }
    const data = {
      residenteOverride,
      origem: origem || 'manual',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    if (trocaId) data.trocaId = trocaId;
    await setDoc(docRefFor(dateKey), data);
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar plantao diario:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Escreve múltiplos overrides atomicamente (usado ao aceitar troca bidirecional).
 * entries: Array<{ dateKey, residenteOverride, origem, trocaId }>
 */
export async function batchUpdatePlantoesDiarios(entries, userId) {
  try {
    const batch = writeBatch(db);
    for (const entry of entries) {
      const { dateKey, residenteOverride, origem, trocaId } = entry;
      if (!dateKey) continue;
      if (!residenteOverride) {
        batch.delete(docRefFor(dateKey));
        continue;
      }
      const data = {
        residenteOverride,
        origem: origem || 'troca',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      };
      if (trocaId) data.trocaId = trocaId;
      batch.set(docRefFor(dateKey), data);
    }
    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro no batch de plantao diario:', error);
    return { success: false, error: error.message };
  }
}
