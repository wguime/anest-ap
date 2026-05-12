/**
 * useConflicts — coverage push (Wave 1.4)
 *
 * Cobre:
 *  - fetch inicial (loading → rows + total) e mapeamento via fetchAll mockado
 *  - filtros client-side (search q por userName/opString/opId/userId)
 *  - filtros client-side de dateRange (from/to)
 *  - refetch manual
 *  - real-time refetch via subscribeToConflicts (recebe callback e chama load)
 *  - filtros opString/userId aplicados após fetch (client-side em useConflicts)
 *  - error path (setError ao falhar fetchAll)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mocks hoisted
const mocks = vi.hoisted(() => ({
  fetchAllMock: vi.fn(),
  subscribeMock: vi.fn(),
  cleanupMock: vi.fn(),
}))

vi.mock('@/services/supabaseConflictQueueService', () => ({
  fetchAll: mocks.fetchAllMock,
  subscribeToConflicts: mocks.subscribeMock,
}))

import { useConflicts } from '../../hooks/useConflicts'

const sampleRows = [
  {
    id: 'c1',
    opId: 'op-1',
    opString: 'documento.recordAcknowledgement',
    userId: 'u-1',
    userName: 'Alice',
    payload: {},
    status: 'pending',
    createdAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'c2',
    opId: 'op-2',
    opString: 'comunicado.confirmLeitura',
    userId: 'u-2',
    userName: 'Bob',
    payload: {},
    status: 'pending',
    createdAt: '2026-05-05T10:00:00Z',
  },
  {
    id: 'c3',
    opId: 'op-3',
    opString: 'documento.recordAcknowledgement',
    userId: 'u-1',
    userName: 'Alice',
    payload: {},
    status: 'pending',
    createdAt: '2026-05-10T10:00:00Z',
  },
]

describe('useConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAllMock.mockResolvedValue({ rows: sampleRows, total: 3 })
    mocks.subscribeMock.mockImplementation((cb) => {
      // Guarda callback para os testes acionarem manualmente, e retorna cleanup.
      mocks._lastSubCallback = cb
      return mocks.cleanupMock
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('faz fetch inicial com loading=true → rows populadas + total + loading=false', async () => {
    const { result } = renderHook(() => useConflicts())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(3)
    expect(result.current.total).toBe(3)
    expect(result.current.error).toBeNull()
    expect(mocks.fetchAllMock).toHaveBeenCalledWith({
      status: 'pending',
      limit: 10,
      offset: 0,
    })
  })

  it('passa parâmetros status/limit/offset para fetchAll', async () => {
    const { result } = renderHook(() =>
      useConflicts({ status: 'resolved_manual', limit: 25, offset: 50 })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.fetchAllMock).toHaveBeenCalledWith({
      status: 'resolved_manual',
      limit: 25,
      offset: 50,
    })
  })

  it('filtra rows pelo opString (server-side via filtro client-side em useConflicts)', async () => {
    const { result } = renderHook(() =>
      useConflicts({ opString: 'documento.recordAcknowledgement' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows.every((r) => r.opString === 'documento.recordAcknowledgement')).toBe(
      true
    )
  })

  it('filtra rows pelo userId', async () => {
    const { result } = renderHook(() => useConflicts({ userId: 'u-2' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0].userId).toBe('u-2')
  })

  it('aplica search q (matching case-insensitive em userName)', async () => {
    const { result } = renderHook(() => useConflicts({ q: 'alice' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows.every((r) => r.userName === 'Alice')).toBe(true)
  })

  it('aplica search q em opString', async () => {
    const { result } = renderHook(() => useConflicts({ q: 'confirmLeitura' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0].opString).toBe('comunicado.confirmLeitura')
  })

  it('aplica search q em opId', async () => {
    const { result } = renderHook(() => useConflicts({ q: 'op-2' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0].opId).toBe('op-2')
  })

  it('aplica search q em userId', async () => {
    const { result } = renderHook(() => useConflicts({ q: 'u-2' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(1)
  })

  it('q vazia retorna todos (matchesSearch retorna true)', async () => {
    const { result } = renderHook(() => useConflicts({ q: '' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(3)
  })

  it('aplica dateRange.from (corta o que é anterior)', async () => {
    const { result } = renderHook(() =>
      useConflicts({ dateRange: { from: new Date('2026-05-04'), to: null } })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    // só c2 (2026-05-05) e c3 (2026-05-10) ficam
    expect(result.current.rows).toHaveLength(2)
  })

  it('aplica dateRange.to (corta o que é posterior)', async () => {
    const { result } = renderHook(() =>
      useConflicts({ dateRange: { from: null, to: new Date('2026-05-06') } })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    // só c1 (2026-05-01) e c2 (2026-05-05) ficam
    expect(result.current.rows).toHaveLength(2)
  })

  it('dateRange sem from nem to deixa todos passar', async () => {
    const { result } = renderHook(() =>
      useConflicts({ dateRange: { from: null, to: null } })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(3)
  })

  it('row sem createdAt fica fora quando dateRange definido', async () => {
    mocks.fetchAllMock.mockResolvedValueOnce({
      rows: [{ ...sampleRows[0], createdAt: null }],
      total: 1,
    })
    const { result } = renderHook(() =>
      useConflicts({ dateRange: { from: new Date('2026-01-01'), to: null } })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(0)
  })

  it('refetch manual chama fetchAll novamente', async () => {
    const { result } = renderHook(() => useConflicts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.fetchAllMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refetch()
    })
    expect(mocks.fetchAllMock).toHaveBeenCalledTimes(2)
  })

  it('error path: setError quando fetchAll rejeita', async () => {
    mocks.fetchAllMock.mockRejectedValueOnce(new Error('rls denied'))
    const { result } = renderHook(() => useConflicts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error.message).toBe('rls denied')
  })

  it('subscribeToConflicts é chamado e cleanup é retornado', async () => {
    const { unmount } = renderHook(() => useConflicts())
    await waitFor(() => expect(mocks.subscribeMock).toHaveBeenCalled())
    expect(mocks.subscribeMock).toHaveBeenCalledTimes(1)
    unmount()
    expect(mocks.cleanupMock).toHaveBeenCalled()
  })

  it('callback do subscribe aciona refetch (real-time)', async () => {
    const { result } = renderHook(() => useConflicts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.fetchAllMock).toHaveBeenCalledTimes(1)

    // Simula evento real-time
    await act(async () => {
      mocks._lastSubCallback({ eventType: 'INSERT', new: {}, old: null })
    })
    await waitFor(() => expect(mocks.fetchAllMock).toHaveBeenCalledTimes(2))
  })
})
