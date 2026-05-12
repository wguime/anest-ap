/**
 * useOfflineQueueFlush — coverage push (Wave 1.4)
 *
 * Cobre:
 *  - Mount: chama flush() imediatamente quando navigator.onLine
 *  - Listener 'online': dispara flush ao reconectar
 *  - Cleanup remove listener
 *  - Sprint 14b: setConflictHandler é chamado com handler funcional quando user existe
 *  - setConflictHandler(null) quando user e firebaseUser são null
 *  - Conflict handler chama enqueueConflict com payload + uid + serverState
 *  - Conflict handler throw quando uid ausente
 *  - flush rejected → não quebra (warn console)
 *  - result com processed/failed/conflicts triggera log
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mocks hoisted
const mocks = vi.hoisted(() => ({
  flushMock: vi.fn(),
  setConflictHandlerMock: vi.fn(),
  enqueueConflictMock: vi.fn(),
  useUserMock: vi.fn(),
}))

vi.mock('@/services/offlineQueueProcessor', () => ({
  flush: mocks.flushMock,
  setConflictHandler: mocks.setConflictHandlerMock,
}))

vi.mock('@/services/supabaseConflictQueueService', () => ({
  enqueueConflict: mocks.enqueueConflictMock,
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: mocks.useUserMock,
}))

import { useOfflineQueueFlush } from '../../hooks/useOfflineQueueFlush'

describe('useOfflineQueueFlush', () => {
  let originalOnline

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.flushMock.mockResolvedValue({ processed: 0, failed: 0, conflicts: 0 })
    mocks.enqueueConflictMock.mockResolvedValue({ id: 'conflict-x' })
    // default: user logado, online
    mocks.useUserMock.mockReturnValue({
      user: { uid: 'fb-uid', displayName: 'Test User' },
      firebaseUser: { uid: 'fb-uid', displayName: 'Test User' },
    })
    originalOnline = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalOnline) {
      Object.defineProperty(window.navigator, 'onLine', originalOnline)
    }
  })

  it('mount com online=true chama flush imediatamente', async () => {
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      // permite microtasks da promessa rodarem
      await Promise.resolve()
    })
    expect(mocks.flushMock).toHaveBeenCalledTimes(1)
  })

  it('mount com online=false NÃO chama flush inicialmente', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    })
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.flushMock).not.toHaveBeenCalled()
  })

  it('evento online dispara flush', async () => {
    renderHook(() => useOfflineQueueFlush())
    mocks.flushMock.mockClear()

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })
    expect(mocks.flushMock).toHaveBeenCalled()
  })

  it('cleanup remove listener online', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useOfflineQueueFlush())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
  })

  it('log "[offline-queue] flush" quando result tem processed/failed/conflicts', async () => {
    mocks.flushMock.mockResolvedValueOnce({ processed: 2, failed: 0, conflicts: 0 })
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(console.log).toHaveBeenCalledWith(
      '[offline-queue] flush',
      expect.objectContaining({ processed: 2 })
    )
  })

  it('flush rejected → warn console sem throw', async () => {
    mocks.flushMock.mockRejectedValueOnce(new Error('flush boom'))
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(console.warn).toHaveBeenCalledWith(
      '[offline-queue] flush error',
      expect.stringContaining('flush boom')
    )
  })

  it('setConflictHandler chamado com handler quando user existe', async () => {
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.setConflictHandlerMock).toHaveBeenCalled()
    // 1ª call: registra; cleanup também chama com null no unmount
    const handler = mocks.setConflictHandlerMock.mock.calls[0][0]
    expect(typeof handler).toBe('function')
  })

  it('setConflictHandler(null) quando user E firebaseUser são null', async () => {
    mocks.useUserMock.mockReturnValue({ user: null, firebaseUser: null })
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.setConflictHandlerMock).toHaveBeenCalledWith(null)
  })

  it('conflict handler chama enqueueConflict com payload normalizado', async () => {
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    const handler = mocks.setConflictHandlerMock.mock.calls[0][0]

    const item = {
      id: 42,
      op: 'documento.recordAcknowledgement',
      payload: { docId: 'd-1' },
    }
    const err = { code: '23505', status: 409, message: 'conflict' }

    await handler(item, err)

    expect(mocks.enqueueConflictMock).toHaveBeenCalledWith({
      opId: '42',
      opString: 'documento.recordAcknowledgement',
      userId: 'fb-uid',
      userName: 'Test User',
      payload: { docId: 'd-1' },
      serverState: { code: '23505', status: 409, message: 'conflict' },
    })
  })

  it('conflict handler com err=null → serverState=null', async () => {
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    const handler = mocks.setConflictHandlerMock.mock.calls[0][0]
    await handler({ id: 1, op: 'x', payload: {} }, null)
    expect(mocks.enqueueConflictMock).toHaveBeenCalledWith(
      expect.objectContaining({ serverState: null })
    )
  })

  it('conflict handler throw quando uid ausente (defesa última)', async () => {
    // user sem uid em todos os slots
    mocks.useUserMock.mockReturnValue({
      user: { displayName: 'X' },
      firebaseUser: null,
    })
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    const handler = mocks.setConflictHandlerMock.mock.calls[0][0]
    await expect(handler({ id: 1, op: 'x', payload: {} })).rejects.toThrow(
      /uid ausente/
    )
  })

  it('usa user.uid quando firebaseUser não tem uid', async () => {
    mocks.useUserMock.mockReturnValue({
      user: { uid: 'fb-from-user', displayName: 'Y' },
      firebaseUser: { uid: null },
    })
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    const handler = mocks.setConflictHandlerMock.mock.calls[0][0]
    await handler({ id: 1, op: 'op.x', payload: {} })
    expect(mocks.enqueueConflictMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'fb-from-user' })
    )
  })

  it('displayName fallback para "Usuario" quando todos vazios', async () => {
    mocks.useUserMock.mockReturnValue({
      user: { uid: 'u-1' },
      firebaseUser: { uid: 'u-1' },
    })
    renderHook(() => useOfflineQueueFlush())
    await act(async () => {
      await Promise.resolve()
    })
    const handler = mocks.setConflictHandlerMock.mock.calls[0][0]
    await handler({ id: 1, op: 'op.x', payload: {} })
    expect(mocks.enqueueConflictMock).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'Usuario' })
    )
  })
})
