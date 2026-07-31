/**
 * Escalas Funcionárias Service
 * CRUD da coleção Firestore escalasFuncionarias/{YYYY-MM} — a base MENSAL
 * importada in-app (sobreaviso materno + hospitais), que substitui o mês
 * inteiro dos data files estáticos quando publicada.
 *
 * Doc shape:
 *   { mes, sobreaviso: {dateKey: funcionariaId}, hospitais: {dateKey: {unimed,hro,plantaoPago,label}},
 *     fonte, arquivoNome, totais, updatedAt, updatedBy }
 *
 * Write gated por hasEscalasEditPermission() nas firestore.rules.
 */
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

const COLLECTION = 'escalasFuncionarias';

/**
 * Assina a coleção inteira (1 doc por mês publicado — pequena por construção).
 * callback({ meses: { 'YYYY-MM': docData }, error })
 * @returns {Function} cleanup
 */
export function subscribeEscalasFuncionarias(callback, options = {}) {
  const { cleanup } = createFirestoreSubscription(
    collection(db, COLLECTION),
    {
      onData: (snap) => {
        const meses = {};
        snap.forEach((d) => { meses[d.id] = d.data(); });
        callback({ meses, error: null });
      },
      onError: (error) => {
        console.error('Erro no listener de escalasFuncionarias:', error);
        callback({ meses: {}, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

export async function getEscalaMes(mes) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, mes));
    return { data: snap.exists() ? snap.data() : null, error: null };
  } catch (error) {
    console.error('Erro ao buscar escala do mês:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Publica (ou substitui) o mês. setDoc SEM merge — o doc é sempre o mês
 * completo vindo da conferência. O promise é AGUARDADO de propósito:
 * permission-denied rejeita mesmo com offline persistence ligada, então o
 * toast de sucesso só sai com a escrita aceita (gotcha real do ProfilePage).
 */
export async function publicarEscalaMes(mes, { sobreaviso, hospitais, arquivoNome }, userId) {
  try {
    await setDoc(doc(db, COLLECTION, mes), {
      mes,
      sobreaviso: sobreaviso || {},
      hospitais: hospitais || {},
      fonte: 'import-docx',
      arquivoNome: arquivoNome || null,
      totais: {
        sobreaviso: Object.keys(sobreaviso || {}).length,
        hospitais: Object.keys(hospitais || {}).length,
      },
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao publicar escala do mês:', error);
    return { success: false, error: error.message };
  }
}
