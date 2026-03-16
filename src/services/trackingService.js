/**
 * trackingService.js
 * Serviço de tracking de visualização de aulas
 *
 * Persiste sessões no Firestore em:
 *   educacao_progresso/{userId}/tracking_sessions/{sessionId}
 *
 * Registra e gerencia o progresso de visualização
 * dos usuários nas aulas (vídeos/áudios)
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Eventos de tracking
export const TRACKING_EVENTS = {
  VIDEO_STARTED: 'video_started',
  VIDEO_PAUSED: 'video_paused',
  VIDEO_RESUMED: 'video_resumed',
  VIDEO_COMPLETED: 'video_completed',
  VIDEO_PROGRESS: 'video_progress',
  VIDEO_SEEKED: 'video_seeked',
  AUDIO_STARTED: 'audio_started',
  AUDIO_PAUSED: 'audio_paused',
  AUDIO_RESUMED: 'audio_resumed',
  AUDIO_COMPLETED: 'audio_completed',
  AUDIO_PROGRESS: 'audio_progress',
};

// Intervalo para salvar progresso automaticamente (ms)
const AUTO_SAVE_INTERVAL = 30000; // 30 segundos

// Porcentagem mínima para considerar como concluído
const COMPLETION_THRESHOLD = 90;

/**
 * Obter informações do dispositivo/navegador
 */
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let dispositivo = 'desktop';
  let navegador = 'Unknown';

  // Detectar dispositivo
  if (/mobile/i.test(ua)) {
    dispositivo = 'mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    dispositivo = 'tablet';
  }

  // Detectar navegador
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) {
    const match = ua.match(/Chrome\/(\d+)/);
    navegador = `Chrome ${match ? match[1] : ''}`;
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    const match = ua.match(/Version\/(\d+)/);
    navegador = `Safari ${match ? match[1] : ''}`;
  } else if (/firefox/i.test(ua)) {
    const match = ua.match(/Firefox\/(\d+)/);
    navegador = `Firefox ${match ? match[1] : ''}`;
  } else if (/edge/i.test(ua)) {
    const match = ua.match(/Edge\/(\d+)/);
    navegador = `Edge ${match ? match[1] : ''}`;
  }

  return { dispositivo, navegador };
};

/**
 * Tracking Service
 */
export const trackingService = {
  // Timer para auto-save
  _autoSaveTimer: null,
  _currentSession: null,
  _firestoreDocRef: null,

  /**
   * Iniciar sessão de visualização
   */
  startSession(userId, aulaId, cursoId, duracaoTotal) {
    const { dispositivo, navegador } = getDeviceInfo();

    this._currentSession = {
      id: `view-${Date.now()}`,
      userId,
      aulaId,
      cursoId,
      status: 'em_andamento',
      progressoPorcentagem: 0,
      tempoAssistido: 0,
      duracaoTotal: duracaoTotal * 60, // converter minutos para segundos
      iniciadoEm: new Date(),
      ultimoAcesso: new Date(),
      concluidoEm: null,
      dispositivo,
      navegador,
      eventos: [],
    };

    // Persist to Firestore
    this._persistSessionStart(userId);

    // Log evento
    this.logEvent(TRACKING_EVENTS.VIDEO_STARTED, {
      timestamp: new Date(),
    });

    // Iniciar auto-save
    this._startAutoSave();

    return this._currentSession;
  },

  /**
   * Persist session start to Firestore
   */
  async _persistSessionStart(userId) {
    try {
      const sessionsRef = collection(
        db,
        'educacao_progresso',
        userId,
        'tracking_sessions'
      );
      const docRef = await addDoc(sessionsRef, {
        userId: this._currentSession.userId,
        aulaId: this._currentSession.aulaId,
        cursoId: this._currentSession.cursoId,
        status: 'em_andamento',
        progressoPorcentagem: 0,
        tempoAssistido: 0,
        duracaoTotal: this._currentSession.duracaoTotal,
        dispositivo: this._currentSession.dispositivo,
        navegador: this._currentSession.navegador,
        iniciadoEm: serverTimestamp(),
        ultimoAcesso: serverTimestamp(),
        concluidoEm: null,
        eventos: [],
      });
      this._firestoreDocRef = docRef;
    } catch (error) {
      console.error('[trackingService] Erro ao persistir sessão:', error);
    }
  },

  /**
   * Atualizar progresso
   */
  updateProgress(currentTime, duration) {
    if (!this._currentSession) return;

    const progressoPorcentagem = Math.round((currentTime / duration) * 100);

    this._currentSession.tempoAssistido = Math.round(currentTime);
    this._currentSession.progressoPorcentagem = progressoPorcentagem;
    this._currentSession.ultimoAcesso = new Date();

    // Verificar se completou
    if (progressoPorcentagem >= COMPLETION_THRESHOLD && this._currentSession.status !== 'concluido') {
      this._currentSession.status = 'concluido';
      this._currentSession.concluidoEm = new Date();
      this.logEvent(TRACKING_EVENTS.VIDEO_COMPLETED, {
        timestamp: new Date(),
        progressoPorcentagem,
      });
    }

    return {
      progressoPorcentagem,
      status: this._currentSession.status,
      isCompleted: this._currentSession.status === 'concluido',
    };
  },

  /**
   * Registrar evento
   */
  logEvent(eventType, data = {}) {
    if (!this._currentSession) return;

    this._currentSession.eventos.push({
      type: eventType,
      timestamp: new Date(),
      ...data,
    });
  },

  /**
   * Pausar visualização
   */
  pause() {
    if (!this._currentSession) return;

    this.logEvent(TRACKING_EVENTS.VIDEO_PAUSED, {
      timestamp: new Date(),
      tempoAssistido: this._currentSession.tempoAssistido,
    });

    this._stopAutoSave();
  },

  /**
   * Retomar visualização
   */
  resume() {
    if (!this._currentSession) return;

    this.logEvent(TRACKING_EVENTS.VIDEO_RESUMED, {
      timestamp: new Date(),
    });

    this._startAutoSave();
  },

  /**
   * Seek (pular para posição)
   */
  seek(fromTime, toTime) {
    if (!this._currentSession) return;

    this.logEvent(TRACKING_EVENTS.VIDEO_SEEKED, {
      timestamp: new Date(),
      from: fromTime,
      to: toTime,
    });
  },

  /**
   * Finalizar sessão e persistir no Firestore
   */
  endSession() {
    if (!this._currentSession) return null;

    this._stopAutoSave();

    const session = { ...this._currentSession };

    // Persist final state to Firestore
    this._persistSessionEnd(session);

    this._currentSession = null;

    return session;
  },

  /**
   * Persist final session state to Firestore
   */
  async _persistSessionEnd(session) {
    if (!this._firestoreDocRef) return;

    try {
      // Serialize events: convert Date objects to ISO strings for Firestore
      const serializedEventos = (session.eventos || []).map(e => ({
        ...e,
        timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
      }));

      await updateDoc(this._firestoreDocRef, {
        status: session.status,
        progressoPorcentagem: session.progressoPorcentagem,
        tempoAssistido: session.tempoAssistido,
        ultimoAcesso: serverTimestamp(),
        concluidoEm: session.concluidoEm ? serverTimestamp() : null,
        eventos: serializedEventos,
      });
    } catch (error) {
      console.error('[trackingService] Erro ao persistir fim da sessão:', error);
    }
    this._firestoreDocRef = null;
  },

  /**
   * Obter sessão atual
   */
  getCurrentSession() {
    return this._currentSession;
  },

  /**
   * Obter visualização por usuário e aula (do Firestore)
   */
  async getVisualizacao(userId, aulaId) {
    try {
      const sessionsRef = collection(
        db,
        'educacao_progresso',
        userId,
        'tracking_sessions'
      );
      const q = query(
        sessionsRef,
        where('aulaId', '==', aulaId),
        orderBy('iniciadoEm', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (error) {
      console.error('[trackingService] Erro ao buscar visualização:', error);
      return null;
    }
  },

  /**
   * Obter todas as visualizações de um usuário (do Firestore)
   */
  async getVisualizacoesByUser(userId) {
    try {
      const sessionsRef = collection(
        db,
        'educacao_progresso',
        userId,
        'tracking_sessions'
      );
      const q = query(sessionsRef, orderBy('iniciadoEm', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('[trackingService] Erro ao buscar visualizações do usuário:', error);
      return [];
    }
  },

  /**
   * Obter estatísticas de uma aula (do Firestore)
   * Note: This requires querying across all users' tracking_sessions,
   * which is not efficient with subcollections. For production stats,
   * use a Cloud Function or collectionGroup query.
   */
  getAulaStats(aulaId) {
    // Stats across users require collectionGroup — return placeholder
    // A Cloud Function should aggregate this periodically
    return {
      total: 0,
      concluidos: 0,
      emAndamento: 0,
      naoIniciados: 0,
      taxaConclusao: 0,
      tempoMedio: 0,
    };
  },

  // Métodos privados

  _startAutoSave() {
    this._stopAutoSave();
    this._autoSaveTimer = setInterval(() => {
      this._autoSaveProgress();
    }, AUTO_SAVE_INTERVAL);
  },

  _stopAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  },

  async _autoSaveProgress() {
    if (!this._currentSession) return;

    this.logEvent(TRACKING_EVENTS.VIDEO_PROGRESS, {
      timestamp: new Date(),
      progressoPorcentagem: this._currentSession.progressoPorcentagem,
      tempoAssistido: this._currentSession.tempoAssistido,
    });

    // Persist intermediate progress to Firestore
    if (this._firestoreDocRef) {
      try {
        await updateDoc(this._firestoreDocRef, {
          progressoPorcentagem: this._currentSession.progressoPorcentagem,
          tempoAssistido: this._currentSession.tempoAssistido,
          ultimoAcesso: serverTimestamp(),
        });
      } catch (error) {
        console.error('[trackingService] Erro ao salvar progresso automático:', error);
      }
    }
  },
};

export default trackingService;
