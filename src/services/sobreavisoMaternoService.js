/**
 * Sobreaviso Materno Diário Service
 * CRUD do doc Firestore sobreavisoMaternoDiario/{YYYY-MM-DD}
 *
 * Guarda overrides da funcionária de sobreaviso por dia. Escala base vem
 * da tabela estática em src/data/sobreavisoMaterno2026.js.
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

const COLLECTION = 'sobreavisoMaternoDiario';

function docRefFor(dateKey) {
  return doc(db, COLLECTION, dateKey);
}

export async function getSobreavisoDiario(dateKey) {
  try {
    const snap = await getDoc(docRefFor(dateKey));
    if (snap.exists()) {
      return { data: snap.data(), error: null };
    }
    return { data: null, error: null };
  } catch (error) {
    console.error('Erro ao buscar sobreaviso diario:', error);
    return { data: null, error: error.message };
  }
}

export function subscribeSobreavisoDiario(dateKey, callback, options = {}) {
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
        console.error('Erro no listener de sobreaviso diario:', error);
        callback({ data: null, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

export async function updateSobreavisoDiario(dateKey, payload, userId) {
  try {
    const { funcionariaOverride, origem, trocaId } = payload || {};
    if (!funcionariaOverride) {
      await deleteDoc(docRefFor(dateKey));
      return { success: true, error: null };
    }
    const data = {
      funcionariaOverride,
      origem: origem || 'manual',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    if (trocaId) data.trocaId = trocaId;
    await setDoc(docRefFor(dateKey), data);
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar sobreaviso diario:', error);
    return { success: false, error: error.message };
  }
}

export async function batchUpdateSobreavisosDiarios(entries, userId) {
  try {
    const batch = writeBatch(db);
    for (const entry of entries) {
      const { dateKey, funcionariaOverride, origem, trocaId } = entry;
      if (!dateKey) continue;
      if (!funcionariaOverride) {
        batch.delete(docRefFor(dateKey));
        continue;
      }
      const data = {
        funcionariaOverride,
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
    console.error('Erro no batch de sobreaviso diario:', error);
    return { success: false, error: error.message };
  }
}
