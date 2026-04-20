/**
 * Reuniões Service — Gestão de Reuniões Qmentum
 *
 * Service layer for meeting management with full CRUD operations,
 * document uploads, status workflows, and audit tracking.
 */
import { db, storage } from '@/config/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import {
  generateCheckinCode,
  getCurrentWindowIndex,
  generateRandomSeed,
} from '@/utils/checkinCodeGenerator';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

// ============================================================================
// CONSTANTS
// ============================================================================

export const STATUS_CONFIG = {
  agendada: {
    label: 'Agendada',
    variant: 'secondary',
    nextStates: ['em_preparacao', 'cancelada'],
  },
  em_preparacao: {
    label: 'Em Preparação',
    variant: 'warning',
    nextStates: ['em_andamento', 'cancelada'],
  },
  em_andamento: {
    label: 'Em Andamento',
    variant: 'success',
    nextStates: ['concluida', 'cancelada'],
  },
  concluida: {
    label: 'Concluída',
    variant: 'info',
    nextStates: [],
  },
  cancelada: {
    label: 'Cancelada',
    variant: 'destructive',
    nextStates: [],
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[ReuniõesService] ${context}:`, error);
  throw new Error(`${context}: ${error.message}`);
}

function getUserInfo(userInfo = {}) {
  const role = (userInfo.role || '').toString().toLowerCase();
  return {
    userId: userInfo.userId || userInfo.uid || 'sistema',
    userName: userInfo.userName || userInfo.displayName || 'Sistema',
    userEmail: userInfo.userEmail || userInfo.email || null,
    isAdmin: !!(userInfo.isAdmin || userInfo.isCoordenador || role === 'administrador' || role === 'coordenador'),
  };
}

/**
 * Convert Firestore Timestamp to Date for frontend
 */
function convertTimestamps(data) {
  if (!data) return data;

  const converted = { ...data };

  // Convert common timestamp fields
  if (converted.dataReuniao?.toDate) {
    converted.dataReuniao = converted.dataReuniao.toDate();
  }
  if (converted.createdAt?.toDate) {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt?.toDate) {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.uploadedAt?.toDate) {
    converted.uploadedAt = converted.uploadedAt.toDate();
  }
  if (converted.aprovadoEm?.toDate) {
    converted.aprovadoEm = converted.aprovadoEm.toDate();
  }

  return converted;
}

// ============================================================================
// REUNIÕES - CRUD OPERATIONS
// ============================================================================

/**
 * Create a new meeting
 * @param {Object} reuniaoData - Meeting data
 * @param {Object} userInfo - User info (uid, displayName, email)
 * @returns {Promise<Object>} Created meeting with ID
 */
export async function createReuniao(reuniaoData, userInfo = {}) {
  try {
    const user = getUserInfo(userInfo);

    const reuniao = {
      ...reuniaoData,
      status: reuniaoData.status || 'agendada',

      // Convert date to Timestamp if it's a Date object or string
      dataReuniao: reuniaoData.dataReuniao instanceof Date
        ? Timestamp.fromDate(reuniaoData.dataReuniao)
        : typeof reuniaoData.dataReuniao === 'string'
        ? Timestamp.fromDate(new Date(reuniaoData.dataReuniao))
        : reuniaoData.dataReuniao,

      // Check-in
      checkinSeed: generateRandomSeed(),
      checkinAtivo: false,
      checkins: {},

      // Metadata
      createdBy: user.userId,
      createdByName: user.userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'reunioes'), reuniao);

    // Log creation
    await logStatusChange(docRef.id, null, reuniao.status, user, 'Reunião criada');

    return {
      id: docRef.id,
      ...convertTimestamps(reuniao),
    };
  } catch (error) {
    handleError(error, 'createReuniao');
  }
}

/**
 * Update a meeting
 * @param {string} reuniaoId - Meeting ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated meeting
 */
export async function updateReuniao(reuniaoId, updates) {
  try {
    const docRef = doc(db, 'reunioes', reuniaoId);

    // Remove fields that shouldn't be updated directly
    const cleanUpdates = { ...updates };
    delete cleanUpdates.id;
    delete cleanUpdates.createdBy;
    delete cleanUpdates.createdByName;
    delete cleanUpdates.createdAt;

    // Convert date to Timestamp if needed
    if (cleanUpdates.dataReuniao instanceof Date) {
      cleanUpdates.dataReuniao = Timestamp.fromDate(cleanUpdates.dataReuniao);
    } else if (typeof cleanUpdates.dataReuniao === 'string') {
      cleanUpdates.dataReuniao = Timestamp.fromDate(new Date(cleanUpdates.dataReuniao));
    }

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    });

    const updatedDoc = await getDoc(docRef);
    return {
      id: updatedDoc.id,
      ...convertTimestamps(updatedDoc.data()),
    };
  } catch (error) {
    handleError(error, 'updateReuniao');
  }
}

/**
 * Get meetings with optional filters
 * @param {Object} filters - Query filters
 * @param {string|string[]} filters.status - Status or array of statuses
 * @param {string} filters.tipoReuniao - Meeting type
 * @param {Date} filters.dataInicio - Start date filter
 * @param {Date} filters.dataFim - End date filter
 * @param {string} filters.orderBy - Field to order by (default: 'dataReuniao')
 * @param {string} filters.order - Order direction ('asc'|'desc', default: 'asc')
 * @param {number} filters.limit - Limit results
 * @returns {Promise<Array>} Array of meetings
 */
export async function getReunioes(filters = {}) {
  try {
    let q = collection(db, 'reunioes');
    const constraints = [];

    // Status filter (can be single string or array)
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }

    // Meeting type filter
    if (filters.tipoReuniao) {
      constraints.push(where('tipoReuniao', '==', filters.tipoReuniao));
    }

    // Date range filters
    if (filters.dataInicio) {
      const timestamp = Timestamp.fromDate(
        filters.dataInicio instanceof Date ? filters.dataInicio : new Date(filters.dataInicio)
      );
      constraints.push(where('dataReuniao', '>=', timestamp));
    }

    if (filters.dataFim) {
      const timestamp = Timestamp.fromDate(
        filters.dataFim instanceof Date ? filters.dataFim : new Date(filters.dataFim)
      );
      constraints.push(where('dataReuniao', '<=', timestamp));
    }

    // Order by
    const orderByField = filters.orderBy || 'dataReuniao';
    const orderDirection = filters.order || 'asc';
    constraints.push(orderBy(orderByField, orderDirection));

    // Limit
    if (filters.limit) {
      constraints.push(firestoreLimit(filters.limit));
    }

    q = query(q, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    }));
  } catch (error) {
    handleError(error, 'getReunioes');
  }
}

/**
 * Get a single meeting by ID
 * @param {string} reuniaoId - Meeting ID
 * @returns {Promise<Object>} Meeting data
 */
export async function getReuniaoById(reuniaoId) {
  try {
    const docRef = doc(db, 'reunioes', reuniaoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Reunião não encontrada');
    }

    return {
      id: docSnap.id,
      ...convertTimestamps(docSnap.data()),
    };
  } catch (error) {
    handleError(error, 'getReuniaoById');
  }
}

/**
 * Delete a meeting
 * @param {string} reuniaoId - Meeting ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteReuniao(reuniaoId) {
  try {
    const docRef = doc(db, 'reunioes', reuniaoId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleError(error, 'deleteReuniao');
  }
}

// ============================================================================
// STATUS WORKFLOW
// ============================================================================

/**
 * Update meeting status
 * @param {string} reuniaoId - Meeting ID
 * @param {string} newStatus - New status
 * @param {Object} userInfo - User info
 * @param {string} comment - Optional comment
 * @returns {Promise<Object>} Updated meeting
 */
export async function updateStatus(reuniaoId, newStatus, userInfo = {}, comment = '') {
  try {
    const user = getUserInfo(userInfo);

    // Get current meeting to validate transition
    const reuniao = await getReuniaoById(reuniaoId);
    const currentStatus = reuniao.status;

    // Validate status transition
    const currentConfig = STATUS_CONFIG[currentStatus];
    if (currentConfig && !currentConfig.nextStates.includes(newStatus)) {
      throw new Error(
        `Transição inválida: ${currentConfig.label} → ${STATUS_CONFIG[newStatus].label}`
      );
    }

    // Update status
    const docRef = doc(db, 'reunioes', reuniaoId);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    // Log status change
    await logStatusChange(reuniaoId, currentStatus, newStatus, user, comment);

    const updatedDoc = await getDoc(docRef);
    return {
      id: updatedDoc.id,
      ...convertTimestamps(updatedDoc.data()),
    };
  } catch (error) {
    handleError(error, 'updateStatus');
  }
}

/**
 * Get status change history for a meeting
 * @param {string} reuniaoId - Meeting ID
 * @returns {Promise<Array>} Status history
 */
export async function getStatusHistorico(reuniaoId) {
  try {
    const q = query(
      collection(db, 'reuniao_status_historico'),
      where('reuniaoId', '==', reuniaoId),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    }));
  } catch (error) {
    handleError(error, 'getStatusHistorico');
  }
}

/**
 * Log status change to history
 * @private
 */
async function logStatusChange(reuniaoId, oldStatus, newStatus, user, comment) {
  try {
    await addDoc(collection(db, 'reuniao_status_historico'), {
      reuniaoId,
      oldStatus,
      newStatus,
      userId: user.userId,
      userName: user.userName,
      comment,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.warn('[ReuniõesService] Failed to log status change:', error);
  }
}

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * Upload a document to a meeting
 * @param {string} reuniaoId - Meeting ID
 * @param {File} file - File to upload
 * @param {string} tipoDocumento - Document type ('subsidio'|'pauta'|'ata'|'outros')
 * @param {Object} metadata - Additional metadata (titulo, descricao)
 * @param {Object} userInfo - User info
 * @returns {Promise<Object>} Created document record
 */
export async function uploadDocumento(reuniaoId, file, tipoDocumento, metadata = {}, userInfo = {}) {
  try {
    const user = getUserInfo(userInfo);

    // Validate file type (PDF only)
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Apenas arquivos PDF são permitidos');
    }

    // Validate file size (max 15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 15MB');
    }

    // Upload to Storage
    const timestamp = Date.now();
    const fileName = `${tipoDocumento}_${timestamp}_${file.name}`;
    const storagePath = `reunioes/${reuniaoId}/${tipoDocumento}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Save metadata to Firestore
    const documento = {
      reuniaoId,
      tipoDocumento,
      titulo: metadata.titulo || file.name,
      descricao: metadata.descricao || '',
      arquivoUrl: downloadURL,
      arquivoNome: file.name,
      arquivoTamanho: file.size,
      storagePath,

      uploadedBy: user.userId,
      uploadedByName: user.userName,
      uploadedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'reuniao_documentos'), documento);

    return {
      id: docRef.id,
      ...convertTimestamps(documento),
    };
  } catch (error) {
    handleError(error, 'uploadDocumento');
  }
}

/**
 * Get documents for a meeting
 * @param {string} reuniaoId - Meeting ID
 * @param {string} tipoDocumento - Optional document type filter
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocumentos(reuniaoId, tipoDocumento = null) {
  try {
    let q = query(
      collection(db, 'reuniao_documentos'),
      where('reuniaoId', '==', reuniaoId)
    );

    if (tipoDocumento) {
      q = query(q, where('tipoDocumento', '==', tipoDocumento));
    }

    q = query(q, orderBy('uploadedAt', 'desc'));

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    }));
  } catch (error) {
    handleError(error, 'getDocumentos');
  }
}

/**
 * Delete a document — only uploader, meeting organizer, or admin
 * @param {string} documentoId - Document ID
 * @param {Object} userInfo - Caller's auth context
 * @returns {Promise<boolean>} Success status
 */
export async function deleteDocumento(documentoId, userInfo = {}) {
  try {
    const caller = getUserInfo(userInfo);
    if (!caller.userId || caller.userId === 'sistema') {
      throw new Error('Usuário não autenticado');
    }

    const docRef = doc(db, 'reuniao_documentos', documentoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return true; // idempotent
    }

    const data = docSnap.data();

    // Authorization: uploader, meeting organizer, or admin
    let isOrganizer = false;
    if (data.reuniaoId) {
      try {
        const reuniao = await getReuniaoById(data.reuniaoId);
        isOrganizer = reuniao.createdBy === caller.userId;
      } catch {
        // meeting may have been deleted; fall through to other checks
      }
    }
    if (data.uploadedBy !== caller.userId && !isOrganizer && !caller.isAdmin) {
      throw new Error('Apenas quem enviou o documento, o organizador ou um administrador pode excluí-lo');
    }

    // Delete from Storage if path exists
    if (data.storagePath) {
      try {
        const storageRef = ref(storage, data.storagePath);
        await deleteObject(storageRef);
      } catch (storageError) {
        console.warn('Failed to delete from storage:', storageError);
      }
    }

    // Delete from Firestore
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleError(error, 'deleteDocumento');
  }
}

// ============================================================================
// ATA WORKFLOW
// ============================================================================

/**
 * Upload meeting minutes (ata)
 * @param {string} reuniaoId - Meeting ID
 * @param {File} file - PDF file
 * @param {Object} metadata - Metadata (observacoes)
 * @param {Object} userInfo - User info
 * @param {boolean} markAsCompleted - Auto-complete meeting
 * @returns {Promise<Object>} Created ata document
 */
export async function uploadAta(reuniaoId, file, metadata = {}, userInfo = {}, markAsCompleted = false) {
  try {
    const user = getUserInfo(userInfo);

    // Upload as 'ata' document type
    const ata = await uploadDocumento(reuniaoId, file, 'ata', {
      titulo: metadata.titulo || 'Ata da Reunião',
      descricao: metadata.observacoes || '',
    }, userInfo);

    // Add ata-specific status
    const docRef = doc(db, 'reuniao_documentos', ata.id);
    await updateDoc(docRef, {
      statusAta: 'rascunho',
    });

    // Auto-complete meeting if requested
    if (markAsCompleted) {
      await updateStatus(reuniaoId, 'concluida', userInfo, 'Ata adicionada e reunião concluída');
    }

    return {
      ...ata,
      statusAta: 'rascunho',
    };
  } catch (error) {
    handleError(error, 'uploadAta');
  }
}

/**
 * Approve meeting minutes
 * @param {string} reuniaoId - Meeting ID
 * @param {string} ataId - Ata document ID
 * @param {Object} userInfo - User info
 * @returns {Promise<Object>} Updated ata
 */
export async function aprovarAta(reuniaoId, ataId, userInfo = {}) {
  try {
    const user = getUserInfo(userInfo);
    if (!user.userId || user.userId === 'sistema') {
      throw new Error('Usuário não autenticado');
    }

    // Only meeting organizer or admin/coordenador can approve
    const reuniao = await getReuniaoById(reuniaoId);
    if (reuniao.createdBy !== user.userId && !user.isAdmin) {
      throw new Error('Apenas o organizador ou um administrador pode aprovar a ata');
    }

    const docRef = doc(db, 'reuniao_documentos', ataId);
    await updateDoc(docRef, {
      statusAta: 'aprovada',
      aprovadoPor: user.userId,
      aprovadoEm: serverTimestamp(),
    });

    // Ensure meeting is marked as completed
    if (reuniao.status !== 'concluida') {
      await updateStatus(reuniaoId, 'concluida', userInfo, 'Ata aprovada');
    }

    const updatedDoc = await getDoc(docRef);
    return {
      id: updatedDoc.id,
      ...convertTimestamps(updatedDoc.data()),
    };
  } catch (error) {
    handleError(error, 'aprovarAta');
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Send in-app notifications to meeting participants
 * Creates a notification doc per recipient in Firestore.
 * Also creates scheduled reminder docs (1 day and 1 hour before).
 *
 * @param {string} reuniaoId - Meeting ID
 * @param {Object} reuniaoData - Meeting data (titulo, dataReuniao, horario, local, tipoReuniao)
 * @param {Array<{id: string, nome: string}>} participants - Array of {id, nome}
 * @param {Object} createdBy - {userId, userName}
 */
export async function notifyReuniaoParticipantes(reuniaoId, reuniaoData, participants, createdBy) {
  if (!participants || participants.length === 0) return;

  const eventDate = new Date(
    reuniaoData.dataReuniao instanceof Date
      ? reuniaoData.dataReuniao
      : reuniaoData.dataReuniao?.toDate
        ? reuniaoData.dataReuniao.toDate()
        : reuniaoData.dataReuniao
  );
  if (reuniaoData.horario) {
    const [h, m] = reuniaoData.horario.split(':').map(Number);
    eventDate.setHours(h, m, 0, 0);
  }

  const dateStr = eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const baseNotif = {
    reuniaoId,
    titulo: reuniaoData.titulo,
    local: reuniaoData.local || '',
    horario: reuniaoData.horario || '',
    createdByName: createdBy.userName || 'Sistema',
    createdAt: serverTimestamp(),
  };

  const promises = [];

  for (const participant of participants) {
    // 1. Convocação imediata
    promises.push(
      addDoc(collection(db, 'reuniao_notifications'), {
        ...baseNotif,
        userId: participant.id,
        type: 'convocacao',
        subject: `Nova reunião: ${reuniaoData.titulo}`,
        content: `Você foi convocado para "${reuniaoData.titulo}" em ${dateStr} às ${reuniaoData.horario}. Local: ${reuniaoData.local}.`,
        readAt: null,
        scheduledFor: serverTimestamp(),
      })
    );

    // 2. Lembrete 1 dia antes
    const oneDayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > new Date()) {
      promises.push(
        addDoc(collection(db, 'reuniao_notifications'), {
          ...baseNotif,
          userId: participant.id,
          type: 'lembrete_1d',
          subject: `Lembrete: ${reuniaoData.titulo} amanhã`,
          content: `Lembrete: "${reuniaoData.titulo}" acontece amanhã, ${dateStr} às ${reuniaoData.horario}. Local: ${reuniaoData.local}.`,
          readAt: null,
          scheduledFor: Timestamp.fromDate(oneDayBefore),
        })
      );
    }

    // 3. Lembrete 1 hora antes
    const oneHourBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > new Date()) {
      promises.push(
        addDoc(collection(db, 'reuniao_notifications'), {
          ...baseNotif,
          userId: participant.id,
          type: 'lembrete_1h',
          subject: `Reunião em 1 hora: ${reuniaoData.titulo}`,
          content: `"${reuniaoData.titulo}" começa em 1 hora, às ${reuniaoData.horario}. Local: ${reuniaoData.local}.`,
          readAt: null,
          scheduledFor: Timestamp.fromDate(oneHourBefore),
        })
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Get unread notifications for a user
 * Returns notifications where scheduledFor <= now and readAt is null
 * @param {string} userId - User's Firebase UID
 * @returns {Promise<Array>} Unread notifications
 */
export async function getUserNotifications(userId) {
  try {
    const q = query(
      collection(db, 'reuniao_notifications'),
      where('userId', '==', userId),
      where('readAt', '==', null),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const now = new Date();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }))
      .filter(n => {
        const scheduled = n.scheduledFor instanceof Date ? n.scheduledFor : new Date(n.scheduledFor);
        return scheduled <= now;
      });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

/**
 * Mark a notification as read
 * @param {string} notificationId
 */
export async function markNotificationRead(notificationId) {
  try {
    await updateDoc(doc(db, 'reuniao_notifications', notificationId), {
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
}

// ============================================================================
// CHECK-IN
// ============================================================================

/**
 * Activate check-in for a meeting (organizer or admin only)
 * Generates seed on demand if the meeting was created before the feature.
 * @param {string} reuniaoId
 * @param {Object} userInfo - Caller's auth context (uid, role, isAdmin)
 * @returns {Promise<Object>} Updated meeting
 */
export async function activateCheckin(reuniaoId, userInfo = {}) {
  try {
    const caller = getUserInfo(userInfo);
    if (!caller.userId || caller.userId === 'sistema') {
      throw new Error('Usuário não autenticado');
    }
    const reuniao = await getReuniaoById(reuniaoId);
    if (reuniao.createdBy !== caller.userId && !caller.isAdmin) {
      throw new Error('Apenas o organizador ou um administrador pode ativar o check-in');
    }
    if (reuniao.status !== 'em_andamento') {
      throw new Error('Check-in so pode ser ativado quando a reuniao esta em andamento');
    }
    const updates = { checkinAtivo: true, updatedAt: serverTimestamp() };
    if (!reuniao.checkinSeed) {
      updates.checkinSeed = generateRandomSeed();
    }
    const docRef = doc(db, 'reunioes', reuniaoId);
    await updateDoc(docRef, updates);
    const snap = await getDoc(docRef);
    return { id: snap.id, ...convertTimestamps(snap.data()) };
  } catch (error) {
    handleError(error, 'activateCheckin');
  }
}

/**
 * Deactivate check-in and sync checkins map → presentes/faltantes arrays
 * @param {string} reuniaoId
 * @param {Object} userInfo - Caller's auth context
 * @returns {Promise<Object>} Updated meeting
 */
export async function deactivateCheckin(reuniaoId, userInfo = {}) {
  try {
    const caller = getUserInfo(userInfo);
    if (!caller.userId || caller.userId === 'sistema') {
      throw new Error('Usuário não autenticado');
    }
    const reuniao = await getReuniaoById(reuniaoId);
    if (reuniao.createdBy !== caller.userId && !caller.isAdmin) {
      throw new Error('Apenas o organizador ou um administrador pode encerrar o check-in');
    }
    const checkins = reuniao.checkins || {};
    const checkedInIds = Object.keys(checkins);
    const allIds = reuniao.participantesIds || [];

    // Merge: keep manually-marked presentes + add code check-ins
    const existingPresentes = reuniao.presentes || [];
    const mergedPresentes = [...new Set([...existingPresentes, ...checkedInIds])];
    const faltantes = allIds.filter((id) => !mergedPresentes.includes(id));

    const docRef = doc(db, 'reunioes', reuniaoId);
    await updateDoc(docRef, {
      checkinAtivo: false,
      presentes: mergedPresentes,
      faltantes,
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(docRef);
    return { id: snap.id, ...convertTimestamps(snap.data()) };
  } catch (error) {
    handleError(error, 'deactivateCheckin');
  }
}

/**
 * Self check-in by a participant using the rotating code
 * Accepts the current window code or the previous window code (grace period).
 * @param {string} reuniaoId
 * @param {string} userId
 * @param {string} code - 4-digit code entered by participant
 * @returns {Promise<void>}
 */
export async function selfCheckin(reuniaoId, userId, code) {
  try {
    if (!userId) throw new Error('Usuário não autenticado');
    const reuniao = await getReuniaoById(reuniaoId);

    if (!reuniao.participantesIds?.includes(userId)) {
      throw new Error('Você não está na lista de participantes desta reunião');
    }
    if (!reuniao.checkinAtivo) {
      throw new Error('Check-in nao esta ativo');
    }
    if (reuniao.status !== 'em_andamento') {
      throw new Error('Reuniao nao esta em andamento');
    }
    if (reuniao.checkins?.[userId]) {
      throw new Error('Voce ja fez check-in nesta reuniao');
    }

    const seed = reuniao.checkinSeed;
    const currentWindow = getCurrentWindowIndex();
    const validCodes = [
      generateCheckinCode(seed, currentWindow),
      generateCheckinCode(seed, currentWindow - 1), // grace period
    ];

    if (!validCodes.includes(code)) {
      throw new Error('Codigo invalido. Verifique e tente novamente.');
    }

    const docRef = doc(db, 'reunioes', reuniaoId);
    await updateDoc(docRef, {
      [`checkins.${userId}`]: {
        timestamp: serverTimestamp(),
        method: 'code',
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleError(error, 'selfCheckin');
  }
}

/**
 * Self-register manual presence (participant only registers their own attendance).
 * Atomically updates presentes/faltantes arrays + justificativasFaltas map so concurrent
 * self-registrations do not overwrite each other. Only touches the caller's userId.
 *
 * @param {string} reuniaoId
 * @param {string} userId - Caller's Firebase UID
 * @param {boolean} present - true = presente, false = ausente
 * @param {string} justificativa - Texto obrigatório (min 3 chars) quando present=false
 * @returns {Promise<Object>} Updated meeting
 */
export async function registerSelfPresenca(reuniaoId, userId, present, justificativa = '') {
  try {
    if (!userId) throw new Error('Usuário não autenticado');

    const reuniao = await getReuniaoById(reuniaoId);
    if (!reuniao.participantesIds?.includes(userId)) {
      throw new Error('Você não está na lista de participantes desta reunião');
    }
    if (reuniao.status === 'cancelada') {
      throw new Error('Reunião cancelada — não é possível registrar presença');
    }

    const justificativaTrim = (justificativa || '').trim();
    if (!present && justificativaTrim.length < 3) {
      throw new Error('Justificativa da falta é obrigatória (mínimo 3 caracteres)');
    }
    if (justificativaTrim.length > 500) {
      throw new Error('Justificativa excede 500 caracteres');
    }

    const docRef = doc(db, 'reunioes', reuniaoId);
    await updateDoc(docRef, present
      ? {
          presentes: arrayUnion(userId),
          faltantes: arrayRemove(userId),
          [`justificativasFaltas.${userId}`]: deleteField(),
          updatedAt: serverTimestamp(),
        }
      : {
          presentes: arrayRemove(userId),
          faltantes: arrayUnion(userId),
          [`justificativasFaltas.${userId}`]: justificativaTrim,
          updatedAt: serverTimestamp(),
        }
    );

    const snap = await getDoc(docRef);
    return { id: snap.id, ...convertTimestamps(snap.data()) };
  } catch (error) {
    handleError(error, 'registerSelfPresenca');
  }
}

/**
 * Subscribe to real-time updates on a meeting document
 * @param {string} reuniaoId
 * @param {function} callback - Called with updated meeting data
 * @returns {function} Unsubscribe function
 */
export function subscribeToReuniao(reuniaoId, callback) {
  const docRef = doc(db, 'reunioes', reuniaoId);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...convertTimestamps(snap.data()) });
    }
  });
}

// ============================================================================
// EXPORT
// ============================================================================

const reunioesService = {
  // CRUD
  createReuniao,
  updateReuniao,
  getReunioes,
  getReuniaoById,
  deleteReuniao,

  // Status
  updateStatus,
  getStatusHistorico,
  STATUS_CONFIG,

  // Documents
  uploadDocumento,
  getDocumentos,
  deleteDocumento,

  // Ata
  uploadAta,
  aprovarAta,

  // Check-in
  activateCheckin,
  deactivateCheckin,
  selfCheckin,
  registerSelfPresenca,
  subscribeToReuniao,

  // Notifications
  notifyReuniaoParticipantes,
  getUserNotifications,
  markNotificationRead,
};

export default reunioesService;
