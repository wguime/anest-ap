import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';

// ============================================================================
// Mocks
// ============================================================================
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0 })),
  setDoc: vi.fn(() => Promise.resolve()),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../config/firebase', () => ({ db: {} }));

import { trackingService, TRACKING_EVENTS } from '../../services/trackingService';

// ============================================================================
// Helpers
// ============================================================================
function resetService() {
  trackingService._currentSession = null;
  trackingService._firestoreDocRef = null;
  if (trackingService._autoSaveTimer) {
    clearInterval(trackingService._autoSaveTimer);
  }
  trackingService._autoSaveTimer = null;
}

// ============================================================================
// Tests
// ============================================================================
describe('trackingService', () => {
  beforeEach(() => {
    resetService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetService();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. startSession creates session with correct data
  // -----------------------------------------------------------------------
  it('startSession creates session with correct data', () => {
    const session = trackingService.startSession('user1', 'aula1', 'curso1', 10);

    expect(session).toBeDefined();
    expect(session.userId).toBe('user1');
    expect(session.aulaId).toBe('aula1');
    expect(session.cursoId).toBe('curso1');
    expect(session.status).toBe('em_andamento');
    expect(session.progressoPorcentagem).toBe(0);
    expect(session.tempoAssistido).toBe(0);
    // duracaoTotal is converted from minutes to seconds
    expect(session.duracaoTotal).toBe(600);
    expect(session.eventos).toBeInstanceOf(Array);
    expect(session.iniciadoEm).toBeInstanceOf(Date);
  });

  // -----------------------------------------------------------------------
  // 2. startSession calls _persistSessionStart (addDoc)
  // -----------------------------------------------------------------------
  it('startSession calls _persistSessionStart which calls addDoc', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    expect(collection).toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 3. startSession starts auto-save timer (setInterval 30000ms)
  // -----------------------------------------------------------------------
  it('startSession starts auto-save timer', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, 'setInterval');

    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 30000);
    expect(trackingService._autoSaveTimer).not.toBeNull();

    spy.mockRestore();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 4. updateProgress calculates percentage correctly
  // -----------------------------------------------------------------------
  it('updateProgress calculates percentage correctly', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    const result = trackingService.updateProgress(60, 120);

    expect(result).toBeDefined();
    expect(result.progressoPorcentagem).toBe(50);
  });

  // -----------------------------------------------------------------------
  // 5. updateProgress returns undefined if no session
  // -----------------------------------------------------------------------
  it('updateProgress returns undefined if no active session', () => {
    const result = trackingService.updateProgress(60, 120);

    expect(result).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 6. updateProgress marks completed at 90% (COMPLETION_THRESHOLD)
  // -----------------------------------------------------------------------
  it('updateProgress marks session as completed at 90%', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    const result = trackingService.updateProgress(90, 100);

    expect(result.progressoPorcentagem).toBe(90);
    expect(result.status).toBe('concluido');
    expect(result.isCompleted).toBe(true);
    expect(trackingService._currentSession.concluidoEm).toBeInstanceOf(Date);
  });

  // -----------------------------------------------------------------------
  // 7. updateProgress does NOT mark completed at 89%
  // -----------------------------------------------------------------------
  it('updateProgress does NOT mark completed at 89%', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    const result = trackingService.updateProgress(89, 100);

    expect(result.progressoPorcentagem).toBe(89);
    expect(result.status).toBe('em_andamento');
    expect(result.isCompleted).toBe(false);
    expect(trackingService._currentSession.concluidoEm).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 8. updateProgress logs VIDEO_COMPLETED event when reaching threshold
  // -----------------------------------------------------------------------
  it('updateProgress logs VIDEO_COMPLETED event on completion', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);
    const eventsBefore = trackingService._currentSession.eventos.length;

    trackingService.updateProgress(95, 100);

    const completedEvents = trackingService._currentSession.eventos.filter(
      (e) => e.type === TRACKING_EVENTS.VIDEO_COMPLETED
    );
    expect(completedEvents.length).toBe(1);
    expect(trackingService._currentSession.eventos.length).toBeGreaterThan(eventsBefore);
  });

  // -----------------------------------------------------------------------
  // 9. pause logs VIDEO_PAUSED event
  // -----------------------------------------------------------------------
  it('pause logs VIDEO_PAUSED event', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    trackingService.pause();

    const pausedEvents = trackingService._currentSession.eventos.filter(
      (e) => e.type === TRACKING_EVENTS.VIDEO_PAUSED
    );
    expect(pausedEvents.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 10. resume logs VIDEO_RESUMED event
  // -----------------------------------------------------------------------
  it('resume logs VIDEO_RESUMED event', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    trackingService.resume();

    const resumedEvents = trackingService._currentSession.eventos.filter(
      (e) => e.type === TRACKING_EVENTS.VIDEO_RESUMED
    );
    expect(resumedEvents.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 11. endSession stops timer and returns session
  // -----------------------------------------------------------------------
  it('endSession stops timer and returns session copy', () => {
    vi.useFakeTimers();
    trackingService.startSession('user1', 'aula1', 'curso1', 10);
    expect(trackingService._autoSaveTimer).not.toBeNull();

    const session = trackingService.endSession();

    expect(session).toBeDefined();
    expect(session.userId).toBe('user1');
    expect(trackingService._currentSession).toBeNull();
    expect(trackingService._autoSaveTimer).toBeNull();

    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 12. endSession returns null without active session
  // -----------------------------------------------------------------------
  it('endSession returns null if no active session', () => {
    const result = trackingService.endSession();

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 13. endSession marks correct status based on progress
  // -----------------------------------------------------------------------
  it('endSession preserves status based on progress', () => {
    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    // Not completed yet
    trackingService.updateProgress(50, 100);
    const sessionInProgress = trackingService.endSession();
    expect(sessionInProgress.status).toBe('em_andamento');

    // Start new session and complete it
    trackingService.startSession('user1', 'aula1', 'curso1', 10);
    trackingService.updateProgress(95, 100);
    const sessionCompleted = trackingService.endSession();
    expect(sessionCompleted.status).toBe('concluido');
  });

  // -----------------------------------------------------------------------
  // 14. _persistSessionEnd serializes events correctly
  // -----------------------------------------------------------------------
  it('_persistSessionEnd serializes Date objects to ISO strings', async () => {
    const { updateDoc } = await import('firebase/firestore');
    const fakeDate = new Date('2025-01-15T10:30:00.000Z');
    const mockSession = {
      status: 'concluido',
      progressoPorcentagem: 95,
      tempoAssistido: 570,
      concluidoEm: fakeDate,
      eventos: [
        { type: 'video_started', timestamp: fakeDate },
        { type: 'video_completed', timestamp: 'already-a-string' },
      ],
    };

    // Set a mock doc ref so _persistSessionEnd proceeds
    trackingService._firestoreDocRef = { id: 'mock-ref' };

    await trackingService._persistSessionEnd(mockSession);

    expect(updateDoc).toHaveBeenCalled();
    const updateArg = updateDoc.mock.calls[0][1];
    expect(updateArg.eventos[0].timestamp).toBe('2025-01-15T10:30:00.000Z');
    expect(updateArg.eventos[1].timestamp).toBe('already-a-string');
  });

  // -----------------------------------------------------------------------
  // 15. getVisualizacao queries Firestore
  // -----------------------------------------------------------------------
  it('getVisualizacao queries Firestore with correct params', async () => {
    const result = await trackingService.getVisualizacao('user1', 'aula1');

    expect(collection).toHaveBeenCalled();
    expect(query).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith('aulaId', '==', 'aula1');
    expect(orderBy).toHaveBeenCalledWith('iniciadoEm', 'desc');
    expect(limit).toHaveBeenCalledWith(1);
    // With empty mock, returns null
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 16. getDeviceInfo returns valid object (tested via startSession)
  // -----------------------------------------------------------------------
  it('startSession populates device info from navigator', () => {
    const session = trackingService.startSession('user1', 'aula1', 'curso1', 10);

    expect(session.dispositivo).toBeDefined();
    expect(typeof session.dispositivo).toBe('string');
    expect(session.navegador).toBeDefined();
    expect(typeof session.navegador).toBe('string');
  });

  // -----------------------------------------------------------------------
  // 17. startSession replaces previous active session
  // -----------------------------------------------------------------------
  it('startSession replaces a previously active session', () => {
    vi.useFakeTimers({ now: 1000 });

    const session1 = trackingService.startSession('user1', 'aula1', 'curso1', 10);
    const id1 = session1.id;

    // Advance time so Date.now() produces a different id
    vi.advanceTimersByTime(1);

    const session2 = trackingService.startSession('user2', 'aula2', 'curso2', 20);
    const id2 = session2.id;

    expect(id2).not.toBe(id1);
    expect(trackingService._currentSession.userId).toBe('user2');
    expect(trackingService._currentSession.aulaId).toBe('aula2');

    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 18. Auto-save calls _autoSaveProgress periodically
  // -----------------------------------------------------------------------
  it('auto-save timer calls _autoSaveProgress after interval', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(trackingService, '_autoSaveProgress');

    trackingService.startSession('user1', 'aula1', 'curso1', 10);

    // Not called immediately
    expect(spy).not.toHaveBeenCalled();

    // Advance 30 seconds
    vi.advanceTimersByTime(30000);
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance another 30 seconds
    vi.advanceTimersByTime(30000);
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 19. TRACKING_EVENTS exports all 11 event types
  // -----------------------------------------------------------------------
  it('TRACKING_EVENTS contains all 11 event types', () => {
    const expectedKeys = [
      'VIDEO_STARTED',
      'VIDEO_PAUSED',
      'VIDEO_RESUMED',
      'VIDEO_COMPLETED',
      'VIDEO_PROGRESS',
      'VIDEO_SEEKED',
      'AUDIO_STARTED',
      'AUDIO_PAUSED',
      'AUDIO_RESUMED',
      'AUDIO_COMPLETED',
      'AUDIO_PROGRESS',
    ];

    expect(Object.keys(TRACKING_EVENTS)).toHaveLength(11);

    for (const key of expectedKeys) {
      expect(TRACKING_EVENTS).toHaveProperty(key);
      expect(typeof TRACKING_EVENTS[key]).toBe('string');
    }
  });
});
