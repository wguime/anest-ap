/**
 * Faturamento Service
 * Serviços para comunicação com Firebase (Firestore)
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { calcularValorEvento, formatarMoeda } from '../data/cbhpmData';

// Collections
const COLLECTIONS = {
  EVENTOS: 'faturamento_eventos',
  NOTAS: 'faturamento_notas',
  LOTES: 'faturamento_lotes',
  PAGAMENTOS: 'faturamento_pagamentos',
  RECURSOS: 'faturamento_recursos',
  CONVENIOS: 'faturamento_convenios',
  HOSPITAIS: 'faturamento_hospitais',
  CIRURGIOES: 'faturamento_cirurgioes',
  ANESTESISTAS: 'faturamento_anestesistas',
};

// ============================================================================
// EVENTOS
// ============================================================================

/**
 * Buscar eventos com filtros
 */
export async function getEventos(filters = {}, pagination = { limit: 50 }) {
  try {
    let q = collection(db, COLLECTIONS.EVENTOS);
    const constraints = [];

    // Adicionar filtros
    if (filters.companyId) {
      constraints.push(where('companyId', '==', filters.companyId));
    }
    if (filters.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.healthInsuranceId && filters.healthInsuranceId !== 'all') {
      constraints.push(where('healthInsuranceId', '==', filters.healthInsuranceId));
    }
    if (filters.hospitalId && filters.hospitalId !== 'all') {
      constraints.push(where('hospitalId', '==', filters.hospitalId));
    }
    if (filters.anesthesiologistId && filters.anesthesiologistId !== 'all') {
      constraints.push(where('anesthesiologistId', '==', filters.anesthesiologistId));
    }

    // Ordenação
    constraints.push(orderBy('eventDate', 'desc'));

    // Limite
    if (pagination.limit) {
      constraints.push(limit(pagination.limit));
    }

    // Cursor para paginação
    if (pagination.startAfter) {
      constraints.push(startAfter(pagination.startAfter));
    }

    q = query(q, ...constraints);
    const snapshot = await getDocs(q);

    const eventos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      eventDate: doc.data().eventDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    }));

    return { eventos, lastDoc: snapshot.docs[snapshot.docs.length - 1], error: null };
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    return { eventos: [], lastDoc: null, error: error.message };
  }
}

/**
 * Buscar evento por ID
 */
export async function getEventoById(eventoId) {
  try {
    const docRef = doc(db, COLLECTIONS.EVENTOS, eventoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { evento: null, error: 'Evento não encontrado' };
    }

    const data = docSnap.data();
    return {
      evento: {
        id: docSnap.id,
        ...data,
        eventDate: data.eventDate?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      },
      error: null,
    };
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    return { evento: null, error: error.message };
  }
}

/**
 * Criar novo evento
 */
export async function createEvento(eventoData) {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.EVENTOS), {
      ...eventoData,
      status: eventoData.status || 'rascunho',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { id: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return { id: null, error: error.message };
  }
}

/**
 * Atualizar evento
 */
export async function updateEvento(eventoId, updates) {
  try {
    const docRef = doc(db, COLLECTIONS.EVENTOS, eventoId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar evento
 */
export async function deleteEvento(eventoId) {
  try {
    const docRef = doc(db, COLLECTIONS.EVENTOS, eventoId);
    await deleteDoc(docRef);

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// NOTAS FISCAIS
// ============================================================================

/**
 * Buscar notas fiscais
 */
export async function getNotas(filters = {}) {
  try {
    let q = collection(db, COLLECTIONS.NOTAS);
    const constraints = [];

    if (filters.companyId) {
      constraints.push(where('companyId', '==', filters.companyId));
    }
    if (filters.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.healthInsuranceId && filters.healthInsuranceId !== 'all') {
      constraints.push(where('healthInsuranceId', '==', filters.healthInsuranceId));
    }

    constraints.push(orderBy('issueDate', 'desc'));

    q = query(q, ...constraints);
    const snapshot = await getDocs(q);

    const notas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      issueDate: doc.data().issueDate?.toDate(),
      dueDate: doc.data().dueDate?.toDate(),
      paidDate: doc.data().paidDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
    }));

    return { notas, error: null };
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    return { notas: [], error: error.message };
  }
}

/**
 * Criar nota fiscal a partir de eventos
 */
export async function createNota(notaData, eventoIds = []) {
  try {
    const batch = writeBatch(db);

    // Criar nota
    const notaRef = doc(collection(db, COLLECTIONS.NOTAS));
    batch.set(notaRef, {
      ...notaData,
      events: eventoIds,
      status: 'emitida',
      createdAt: serverTimestamp(),
    });

    // Atualizar eventos com o ID da nota
    for (const eventoId of eventoIds) {
      const eventoRef = doc(db, COLLECTIONS.EVENTOS, eventoId);
      batch.update(eventoRef, {
        invoiceId: notaRef.id,
        status: 'faturado',
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    return { id: notaRef.id, error: null };
  } catch (error) {
    console.error('Erro ao criar nota:', error);
    return { id: null, error: error.message };
  }
}

// ============================================================================
// LOTES
// ============================================================================

/**
 * Buscar lotes
 */
export async function getLotes(filters = {}) {
  try {
    let q = collection(db, COLLECTIONS.LOTES);
    const constraints = [];

    if (filters.companyId) {
      constraints.push(where('companyId', '==', filters.companyId));
    }
    if (filters.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    q = query(q, ...constraints);
    const snapshot = await getDocs(q);

    const lotes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sendDate: doc.data().sendDate?.toDate(),
      processDate: doc.data().processDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
    }));

    return { lotes, error: null };
  } catch (error) {
    console.error('Erro ao buscar lotes:', error);
    return { lotes: [], error: error.message };
  }
}

/**
 * Criar lote com notas
 */
export async function createLote(loteData, notaIds = []) {
  try {
    const batch = writeBatch(db);

    // Criar lote
    const loteRef = doc(collection(db, COLLECTIONS.LOTES));
    batch.set(loteRef, {
      ...loteData,
      invoices: notaIds,
      status: 'aberto',
      createdAt: serverTimestamp(),
    });

    // Atualizar notas com o ID do lote
    for (const notaId of notaIds) {
      const notaRef = doc(db, COLLECTIONS.NOTAS, notaId);
      batch.update(notaRef, {
        batchId: loteRef.id,
      });
    }

    await batch.commit();

    return { id: loteRef.id, error: null };
  } catch (error) {
    console.error('Erro ao criar lote:', error);
    return { id: null, error: error.message };
  }
}

// ============================================================================
// CADASTROS
// ============================================================================

/**
 * Buscar convênios
 */
export async function getConvenios(companyId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.CONVENIOS),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);

    const convenios = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { convenios, error: null };
  } catch (error) {
    console.error('Erro ao buscar convênios:', error);
    return { convenios: [], error: error.message };
  }
}

/**
 * Criar convênio
 */
export async function createConvenio(convenioData) {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.CONVENIOS), {
      ...convenioData,
      active: true,
      createdAt: serverTimestamp(),
    });

    return { id: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao criar convênio:', error);
    return { id: null, error: error.message };
  }
}

/**
 * Atualizar convênio
 */
export async function updateConvenio(convenioId, updates) {
  try {
    const docRef = doc(db, COLLECTIONS.CONVENIOS, convenioId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar convênio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar hospitais
 */
export async function getHospitais(companyId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.HOSPITAIS),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);

    const hospitais = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { hospitais, error: null };
  } catch (error) {
    console.error('Erro ao buscar hospitais:', error);
    return { hospitais: [], error: error.message };
  }
}

/**
 * Buscar cirurgiões
 */
export async function getCirurgioes(companyId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.CIRURGIOES),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);

    const cirurgioes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { cirurgioes, error: null };
  } catch (error) {
    console.error('Erro ao buscar cirurgiões:', error);
    return { cirurgioes: [], error: error.message };
  }
}

/**
 * Buscar anestesistas
 */
export async function getAnestesistas(companyId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.ANESTESISTAS),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);

    const anestesistas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { anestesistas, error: null };
  } catch (error) {
    console.error('Erro ao buscar anestesistas:', error);
    return { anestesistas: [], error: error.message };
  }
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Calcular estatísticas de faturamento
 */
export async function getStats(companyId, periodo = 'mes') {
  try {
    // Calcular datas do período
    const now = new Date();
    let startDate;

    if (periodo === 'mes') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodo === 'ano') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Buscar eventos do período
    const eventosQuery = query(
      collection(db, COLLECTIONS.EVENTOS),
      where('companyId', '==', companyId),
      where('eventDate', '>=', startDate)
    );
    const eventosSnapshot = await getDocs(eventosQuery);

    let produzido = 0;
    let recebido = 0;
    let glosado = 0;
    let eventosAbertos = 0;

    eventosSnapshot.forEach(doc => {
      const data = doc.data();
      produzido += data.finalValue || 0;

      if (data.status === 'pago') {
        recebido += data.paidValue || data.finalValue || 0;
      }
      if (data.status === 'glosado') {
        glosado += data.glosaValue || 0;
      }
      if (['rascunho', 'pendente', 'aprovado'].includes(data.status)) {
        eventosAbertos++;
      }
    });

    // Contar notas e lotes pendentes
    const notasQuery = query(
      collection(db, COLLECTIONS.NOTAS),
      where('companyId', '==', companyId),
      where('status', 'in', ['emitida', 'enviada'])
    );
    const notasSnapshot = await getDocs(notasQuery);

    const lotesQuery = query(
      collection(db, COLLECTIONS.LOTES),
      where('companyId', '==', companyId),
      where('status', 'in', ['aberto', 'fechado', 'enviado'])
    );
    const lotesSnapshot = await getDocs(lotesQuery);

    return {
      stats: {
        produzido: { mes: produzido },
        recebido: { mes: recebido },
        glosas: { mes: glosado, percentual: produzido > 0 ? (glosado / produzido) * 100 : 0 },
        over: { mes: produzido - recebido - glosado },
        eventosAbertos,
        notasPendentes: notasSnapshot.size,
        lotesPendentes: lotesSnapshot.size,
      },
      error: null,
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    return { stats: null, error: error.message };
  }
}

export default {
  // Eventos
  getEventos,
  getEventoById,
  createEvento,
  updateEvento,
  deleteEvento,

  // Notas
  getNotas,
  createNota,

  // Lotes
  getLotes,
  createLote,

  // Cadastros
  getConvenios,
  createConvenio,
  updateConvenio,
  getHospitais,
  getCirurgioes,
  getAnestesistas,

  // Estatísticas
  getStats,

  // Collections
  COLLECTIONS,
};
