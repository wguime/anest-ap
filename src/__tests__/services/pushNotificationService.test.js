/**
 * pushNotificationService — unit tests
 * Sprint 21 Wave 2.2.
 *
 * Mocks firebase/messaging + firebase/firestore para isolar lógica do service.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

const mockGetToken = vi.fn()
const mockOnMessage = vi.fn()
const mockDeleteToken = vi.fn()
const mockGetMessaging = vi.fn(() => ({ __messaging: true }))

vi.mock('firebase/messaging', () => ({
  getMessaging: (...args) => mockGetMessaging(...args),
  getToken: (...args) => mockGetToken(...args),
  onMessage: (...args) => mockOnMessage(...args),
  deleteToken: (...args) => mockDeleteToken(...args),
}))

const mockUpdateDoc = vi.fn()
const mockDoc = vi.fn((db, col, id) => ({ __doc: true, col, id }))
const mockServerTimestamp = vi.fn(() => ({ __serverTimestamp: true }))

vi.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}))

vi.mock('../../config/firebase', () => ({
  auth: { currentUser: null },
  db: { __db: true },
}))

// Helpers para controlar Notification + import.meta.env
function setNotificationSupport({ permission = 'default', requestImpl } = {}) {
  global.window = global.window || {}
  global.window.PushManager = function PushManager() {}
  global.navigator = global.navigator || {}
  global.navigator.serviceWorker = {}
  global.window.Notification = function Notification() {}
  global.window.Notification.permission = permission
  global.window.Notification.requestPermission = requestImpl || vi.fn(async () => permission)
  global.Notification = global.window.Notification
}

function clearNotificationSupport() {
  if (global.window) {
    delete global.window.PushManager
    delete global.window.Notification
  }
  if (global.navigator) {
    delete global.navigator.serviceWorker
  }
  delete global.Notification
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  // VAPID key padrão para os testes.
  import.meta.env.VITE_FIREBASE_VAPID_KEY = 'test-vapid-key'
})

afterEach(() => {
  clearNotificationSupport()
  delete import.meta.env.VITE_FIREBASE_VAPID_KEY
})

// ============================================================================
// isSupported()
// ============================================================================
describe('pushNotificationService — isSupported', () => {
  it('retorna false quando ServiceWorker ausente', async () => {
    clearNotificationSupport()
    const svc = await import('../../services/pushNotificationService')
    expect(svc.isSupported()).toBe(false)
  })

  it('retorna true quando SW + Notification + PushManager disponíveis', async () => {
    setNotificationSupport()
    const svc = await import('../../services/pushNotificationService')
    expect(svc.isSupported()).toBe(true)
  })
})

// ============================================================================
// requestPermission()
// ============================================================================
describe('pushNotificationService — requestPermission', () => {
  it('retorna "denied" quando push não é suportado', async () => {
    clearNotificationSupport()
    const svc = await import('../../services/pushNotificationService')
    const result = await svc.requestPermission()
    expect(result).toBe('denied')
  })

  it('chama Notification.requestPermission quando estado é default', async () => {
    const requestImpl = vi.fn(async () => 'granted')
    setNotificationSupport({ permission: 'default', requestImpl })
    const svc = await import('../../services/pushNotificationService')
    const result = await svc.requestPermission()
    expect(requestImpl).toHaveBeenCalled()
    expect(result).toBe('granted')
  })

  it('é idempotente — não pede de novo quando já granted', async () => {
    const requestImpl = vi.fn()
    setNotificationSupport({ permission: 'granted', requestImpl })
    const svc = await import('../../services/pushNotificationService')
    const result = await svc.requestPermission()
    expect(requestImpl).not.toHaveBeenCalled()
    expect(result).toBe('granted')
  })

  it('respeita "denied" sem reabrir prompt', async () => {
    const requestImpl = vi.fn()
    setNotificationSupport({ permission: 'denied', requestImpl })
    const svc = await import('../../services/pushNotificationService')
    const result = await svc.requestPermission()
    expect(requestImpl).not.toHaveBeenCalled()
    expect(result).toBe('denied')
  })
})

// ============================================================================
// getFcmToken()
// ============================================================================
describe('pushNotificationService — getFcmToken', () => {
  it('retorna null quando permission não é granted', async () => {
    setNotificationSupport({ permission: 'default' })
    const svc = await import('../../services/pushNotificationService')
    const token = await svc.getFcmToken()
    expect(token).toBeNull()
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('retorna null sem usuário autenticado', async () => {
    setNotificationSupport({ permission: 'granted' })
    const firebase = await import('../../config/firebase')
    firebase.auth.currentUser = null
    const svc = await import('../../services/pushNotificationService')
    const token = await svc.getFcmToken()
    expect(token).toBeNull()
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('busca token e persiste em userProfiles/{uid}', async () => {
    setNotificationSupport({ permission: 'granted' })
    const firebase = await import('../../config/firebase')
    firebase.auth.currentUser = { uid: 'user-abc' }
    mockGetToken.mockResolvedValueOnce('fcm-token-123')
    mockUpdateDoc.mockResolvedValueOnce(undefined)

    const svc = await import('../../services/pushNotificationService')
    const token = await svc.getFcmToken()
    expect(token).toBe('fcm-token-123')
    expect(mockGetToken).toHaveBeenCalledWith(
      expect.anything(),
      { vapidKey: 'test-vapid-key' },
    )
    expect(mockUpdateDoc).toHaveBeenCalled()
    const updateArgs = mockUpdateDoc.mock.calls[0][1]
    expect(updateArgs.fcmToken).toBe('fcm-token-123')
    expect(updateArgs.fcmTokenUpdatedAt).toBeTruthy()
  })

  it('retorna null e não chama getToken sem VAPID key', async () => {
    delete import.meta.env.VITE_FIREBASE_VAPID_KEY
    setNotificationSupport({ permission: 'granted' })
    const firebase = await import('../../config/firebase')
    firebase.auth.currentUser = { uid: 'user-x' }

    const svc = await import('../../services/pushNotificationService')
    const token = await svc.getFcmToken()
    expect(token).toBeNull()
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('retorna o token mesmo se updateDoc falhar (não bloqueia)', async () => {
    setNotificationSupport({ permission: 'granted' })
    const firebase = await import('../../config/firebase')
    firebase.auth.currentUser = { uid: 'user-y' }
    mockGetToken.mockResolvedValueOnce('fcm-token-456')
    mockUpdateDoc.mockRejectedValueOnce(new Error('firestore offline'))

    const svc = await import('../../services/pushNotificationService')
    const token = await svc.getFcmToken()
    expect(token).toBe('fcm-token-456')
  })
})

// ============================================================================
// unsubscribe()
// ============================================================================
describe('pushNotificationService — unsubscribe', () => {
  it('chama deleteToken e limpa Firestore', async () => {
    setNotificationSupport({ permission: 'granted' })
    const firebase = await import('../../config/firebase')
    firebase.auth.currentUser = { uid: 'user-zz' }
    mockDeleteToken.mockResolvedValueOnce(true)
    mockUpdateDoc.mockResolvedValueOnce(undefined)

    const svc = await import('../../services/pushNotificationService')
    const ok = await svc.unsubscribe()
    expect(ok).toBe(true)
    expect(mockDeleteToken).toHaveBeenCalled()
    expect(mockUpdateDoc).toHaveBeenCalled()
    const cleared = mockUpdateDoc.mock.calls[0][1]
    expect(cleared.fcmToken).toBeNull()
  })

  it('retorna false quando push não é suportado', async () => {
    clearNotificationSupport()
    const svc = await import('../../services/pushNotificationService')
    const ok = await svc.unsubscribe()
    expect(ok).toBe(false)
    expect(mockDeleteToken).not.toHaveBeenCalled()
  })
})

// ============================================================================
// onForegroundMessage()
// ============================================================================
describe('pushNotificationService — onForegroundMessage', () => {
  it('registra callback via onMessage e retorna unsubscribe', async () => {
    setNotificationSupport({ permission: 'granted' })
    const unsubFn = vi.fn()
    mockOnMessage.mockReturnValueOnce(unsubFn)
    const svc = await import('../../services/pushNotificationService')
    const cb = vi.fn()
    const unsubscribe = await svc.onForegroundMessage(cb)
    expect(mockOnMessage).toHaveBeenCalledWith(expect.anything(), cb)
    expect(unsubscribe).toBe(unsubFn)
  })

  it('retorna noop quando push não é suportado', async () => {
    clearNotificationSupport()
    const svc = await import('../../services/pushNotificationService')
    const unsub = await svc.onForegroundMessage(() => {})
    expect(typeof unsub).toBe('function')
    expect(mockOnMessage).not.toHaveBeenCalled()
    // noop não deve lançar
    expect(() => unsub()).not.toThrow()
  })
})
