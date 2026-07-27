/**
 * Residencia Roster Service
 * CRUD do doc Firestore `residencia/roster` — o cadastro de residentes.
 *
 * Até 2026-07 a lista de residentes era só a tabela estática RESIDENTES_2026,
 * então "Adicionar Residente" no Centro de Gestão não tinha onde gravar: o
 * residente novo sumia no próximo render. Este doc passa a ser a lista efetiva
 * quando existe; sem ele (ou vazio) o app cai de volta em RESIDENTES_2026.
 *
 * Escopo: apenas a lista de ESTÁGIOS. As tabelas de plantão (PLANTOES_2026,
 * trocas, lembretes) seguem presas aos ids estáticos — residente cadastrado
 * aqui não entra na escala de plantão nem na rotação por quinzena, e recebe
 * estágio pelo override do slot (por dia e turno).
 *
 * Regra Firestore: `match /residencia/{docId}` — leitura autenticada, escrita
 * por hasResidenciaEditPermission().
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

const COLLECTION = 'residencia';
const DOC_ID = 'roster';

function rosterRef() {
  return doc(db, COLLECTION, DOC_ID);
}

/** Mantém só os campos do cadastro e descarta linha sem id ou sem nome. */
function sanitizeResidentes(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((r) => r && r.id && (r.nome || '').trim())
    .map((r) => ({
      id: String(r.id),
      nome: (r.nome || '').trim(),
      ano: r.ano || 'R1',
      email: (r.email || '').trim() || null,
    }));
}

export async function getRoster() {
  try {
    const snap = await getDoc(rosterRef());
    if (snap.exists()) {
      return { residentes: sanitizeResidentes(snap.data().residentes), error: null };
    }
    return { residentes: [], error: null };
  } catch (error) {
    console.error('Erro ao buscar roster da residencia:', error);
    return { residentes: [], error: error.message };
  }
}

/**
 * Grava o cadastro completo (o array É a lista efetiva, não um patch).
 * @param {Array} residentes - [{id, nome, ano, email}]
 * @param {string} userId - uid de quem alterou (audit trail)
 */
export async function updateRoster(residentes, userId) {
  try {
    const limpos = sanitizeResidentes(residentes);
    if (limpos.length === 0) {
      // Guarda contra apagar o cadastro inteiro por engano: sem residente o app
      // cairia no fallback estático e a edição pareceria ter sido revertida.
      return { success: false, error: 'O cadastro precisa de pelo menos um residente.' };
    }
    await setDoc(rosterRef(), {
      residentes: limpos,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar roster da residencia:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Listener em tempo real do cadastro.
 * @param {Function} callback - recebe {residentes: Array, error: string|null}
 */
export function subscribeRoster(callback, options = {}) {
  const { cleanup } = createFirestoreSubscription(
    rosterRef(),
    {
      onData: (snap) => {
        if (snap.exists()) {
          callback({ residentes: sanitizeResidentes(snap.data().residentes), error: null });
        } else {
          callback({ residentes: [], error: null });
        }
      },
      onError: (error) => {
        console.error('Erro no listener do roster:', error);
        callback({ residentes: [], error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}
