/**
 * Troca de Plantão Hospitalar Service
 * Gerencia solicitações de troca de plantões hospitalares (FDS/feriados:
 * HRO + UNIMED + Plantão Pago) no Firestore.
 *
 * Ao aceitar uma troca, grava override em hospitaisDiario/{data}_{hospital}_{turno}
 * para que a escala reflita a nova funcionária. Suporta dois escopos:
 *   - 'slot': troca um único slot (hospital + turno + data).
 *   - 'dia':  troca todos os slots da data em que solicitante está escalada.
 *
 * Modos de troca (combinam com escopo):
 *   - Cobertura (unidirecional): só dataPlantao. Aceitadora cobre o(s) plantão(ões).
 *   - Swap bidirecional: dataPlantao + dataDesejada. Ambas trocam dias.
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
import { HOSPITAIS_2026, FUNCIONARIAS_HOSPITAIS } from '../data/hospitaisTecnicas2026';

const COLLECTION = 'trocas_plantao_hospitalar';
const OVERRIDE_COLLECTION = 'hospitaisDiario';

const HOSPITAL_KEYS = {
  hro: 'hro',
  unimed: 'unimed',
  plantao_pago: 'plantaoPago',
};

const SLOT_TURNOS = {
  hro: 'manha',
  unimed: 'manha',
  plantao_pago: 'tarde',
};

function generateTradeCode() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `PH${digits}`;
}

function overrideDocId(data, hospital, turno) {
  return `${data}_${hospital}_${turno}`;
}

function nomeFromFuncionariaId(id) {
  return FUNCIONARIAS_HOSPITAIS.find((f) => f.id === id)?.nome || null;
}

/**
 * Retorna lista de slots em que a funcionária está escalada na data informada.
 * Considera apenas o agendamento base (HOSPITAIS_2026), sem overrides.
 * @returns {Array<{hospital: 'hro'|'unimed'|'plantao_pago', turno: 'manha'|'tarde'}>}
 */
export function slotsDaFuncionariaNaData(funcionariaId, dateKey) {
  const escala = HOSPITAIS_2026[dateKey];
  if (!escala) return [];
  const nome = nomeFromFuncionariaId(funcionariaId);
  if (!nome) return [];
  const slots = [];
  for (const [hospitalKey, hospitalField] of Object.entries(HOSPITAL_KEYS)) {
    if (escala[hospitalField] === nome) {
      slots.push({ hospital: hospitalKey, turno: SLOT_TURNOS[hospitalKey] });
    }
  }
  return slots;
}

export async function createTradeRequest({
  solicitanteId,
  solicitanteNome,
  solicitanteRole,
  solicitanteFuncionariaId,
  escopo,
  dataPlantao,
  hospital = null,
  turno = null,
  dataDesejada = null,
  hospitalDesejado = null,
  turnoDesejado = null,
  descricao,
  destinatarioId = null,
  destinatarioNome = null,
}) {
  try {
    if (!solicitanteFuncionariaId) {
      return { trade: null, error: 'Funcionária solicitante não identificada na escala' };
    }
    if (!escopo || !['slot', 'dia'].includes(escopo)) {
      return { trade: null, error: 'Escopo inválido' };
    }
    if (!dataPlantao) {
      return { trade: null, error: 'Selecione a data do plantão' };
    }
    if (escopo === 'slot' && (!hospital || !turno)) {
      return { trade: null, error: 'Selecione hospital e turno do slot' };
    }
    if (dataDesejada && !destinatarioId) {
      return { trade: null, error: 'Para trocar datas, selecione uma destinatária específica' };
    }
    if (escopo === 'slot' && dataDesejada && (!hospitalDesejado || !turnoDesejado)) {
      return { trade: null, error: 'Selecione hospital e turno do slot desejado' };
    }

    // Solicitante deve estar escalada no(s) slot(s)
    const slotsSolicitante = slotsDaFuncionariaNaData(solicitanteFuncionariaId, dataPlantao);
    if (slotsSolicitante.length === 0) {
      return { trade: null, error: 'Você não está escalada nessa data' };
    }
    if (escopo === 'slot') {
      const ok = slotsSolicitante.some((s) => s.hospital === hospital && s.turno === turno);
      if (!ok) return { trade: null, error: 'Você não está escalada neste slot (hospital/turno)' };
    }

    const codigo = generateTradeCode();
    const tradeData = {
      codigo,
      solicitanteId,
      solicitanteNome,
      solicitanteFuncionariaId,
      solicitanteRole: solicitanteRole || null,
      escopo,
      dataPlantao,
      hospital: escopo === 'slot' ? hospital : null,
      turno: escopo === 'slot' ? turno : null,
      dataDesejada: dataDesejada || null,
      hospitalDesejado: dataDesejada ? hospitalDesejado : null,
      turnoDesejado: dataDesejada ? turnoDesejado : null,
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
    console.error('Erro ao criar solicitação de troca de plantão hospitalar:', error);
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

    // Aceitadora não pode estar escalada em conflito com slot a assumir
    if (trade.escopo === 'slot') {
      const slotsAceitadoraNaData = slotsDaFuncionariaNaData(userFuncionariaId, trade.dataPlantao);
      const conflito = slotsAceitadoraNaData.some((s) => s.hospital === trade.hospital && s.turno === trade.turno);
      if (conflito) {
        return { success: false, error: 'Você já está escalada neste slot', trade };
      }
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

    // Aplica overrides do plantão da solicitante → aceitadora
    const slotsParaTransferir = trade.escopo === 'slot'
      ? [{ hospital: trade.hospital, turno: trade.turno }]
      : slotsDaFuncionariaNaData(trade.solicitanteFuncionariaId, trade.dataPlantao);

    slotsParaTransferir.forEach(({ hospital, turno }) => {
      batch.set(doc(db, OVERRIDE_COLLECTION, overrideDocId(trade.dataPlantao, hospital, turno)), {
        funcionariaOverride: userFuncionariaId,
        origem: 'troca',
        trocaId: trade.codigo,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    });

    // Swap bidirecional: slots da aceitadora → solicitante
    if (trade.dataDesejada) {
      const slotsRetorno = trade.escopo === 'slot'
        ? [{ hospital: trade.hospitalDesejado, turno: trade.turnoDesejado }]
        : slotsDaFuncionariaNaData(userFuncionariaId, trade.dataDesejada);

      slotsRetorno.forEach(({ hospital, turno }) => {
        batch.set(doc(db, OVERRIDE_COLLECTION, overrideDocId(trade.dataDesejada, hospital, turno)), {
          funcionariaOverride: trade.solicitanteFuncionariaId,
          origem: 'troca',
          trocaId: trade.codigo,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
      });
    }

    await batch.commit();
    return { success: true, error: null, trade };
  } catch (error) {
    console.error('Erro ao aceitar troca de plantão hospitalar:', error);
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
    console.error('Erro ao rejeitar troca de plantão hospitalar:', error);
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
    console.error('Erro ao cancelar troca de plantão hospitalar:', error);
    return { success: false, error: error.message, trade: null };
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
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) =>
        t.solicitanteId !== userId &&
        (t.destinatarioId === null || (userFuncionariaId && t.destinatarioId === userFuncionariaId))
      );
    return { trades, error: null };
  } catch (error) {
    console.error('Erro ao buscar trocas pendentes de plantão hospitalar:', error);
    return { trades: [], error: error.message };
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
    console.error('Erro ao buscar troca de plantão hospitalar por código:', error);
    return { trade: null, docId: null, error: error.message };
  }
}

export function subscribeTrades(userId, getFuncionariaId, callback) {
  const q = query(collection(db, COLLECTION), orderBy('criadoEm', 'desc'));

  const { cleanup } = createFirestoreSubscription(q, {
    onData: (snapshot) => {
      const allTrades = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const userFuncionariaId = typeof getFuncionariaId === 'function' ? getFuncionariaId() : getFuncionariaId;
      const myTrades = allTrades.filter((t) =>
        t.solicitanteId === userId ||
        t.respondidoPorId === userId ||
        (userFuncionariaId && (t.destinatarioId === userFuncionariaId || t.respondidoPorFuncionariaId === userFuncionariaId))
      );
      const pendingForMe = allTrades.filter((t) =>
        t.status === 'pendente' &&
        t.solicitanteId !== userId &&
        (t.destinatarioId === null || (userFuncionariaId && t.destinatarioId === userFuncionariaId))
      );
      callback({ myTrades, pendingForMe });
    },
    onError: (error) => {
      console.error('Erro no listener de trocas de plantão hospitalar:', error);
      callback({ myTrades: [], pendingForMe: [] });
    },
  });

  return cleanup;
}
