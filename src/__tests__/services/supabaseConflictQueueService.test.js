/**
 * supabaseConflictQueueService — coverage push (Wave 1.4)
 *
 * Cobre:
 *  - enqueueConflict (happy path + validações de obrigatórios)
 *  - fetchPending / fetchAll (mapping snake→camel + filtros)
 *  - resolveLastWriteWins (status update + notify best-effort)
 *  - resolveLastWriteWinsWithReplay (replay sucesso, replay falha → ReplayFailedError,
 *    sem handler → fallback)
 *  - resolveManual (validação notes < 10 chars + sucesso)
 *  - dismiss (status='dismissed')
 *  - subscribeToConflicts (validação callback + invocação via createReliableSubscription)
 *  - audit trail: requireUserInfo obriga userInfo.uid em todas as resoluções
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Hoisted mocks — referenciados dentro de vi.mock() factory
// ============================================================================
const mocks = vi.hoisted(() => {
  const state = {
    insertResult: { data: null, error: null },
    selectResult: { data: null, error: null, count: 0 },
    updateResult: { data: null, error: null },
    fetchSingleResult: { data: null, error: null },
    lastInsertPayload: null,
    lastUpdatePayload: null,
    lastEqFilters: [],
  }

  function makeChain() {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn((payload) => {
        state.lastInsertPayload = payload
        return chain
      }),
      update: vi.fn((payload) => {
        state.lastUpdatePayload = payload
        return chain
      }),
      eq: vi.fn((col, val) => {
        state.lastEqFilters.push([col, val])
        return chain
      }),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => {
        // Aciona resolução do query builder com selectResult
        return Promise.resolve(state.selectResult)
      }),
      single: vi.fn(() => {
        // single após insert → insertResult
        // single após update → updateResult
        // single após select+eq (fetch row em resolveLWWWithReplay) → fetchSingleResult
        if (state.lastInsertPayload && !state.lastUpdatePayload) {
          return Promise.resolve(state.insertResult)
        }
        if (state.lastUpdatePayload) {
          return Promise.resolve(state.updateResult)
        }
        return Promise.resolve(state.fetchSingleResult)
      }),
      then: (resolve) => Promise.resolve(state.selectResult).then(resolve),
    }
    return chain
  }

  const fromMock = vi.fn(() => makeChain())

  return { state, fromMock, makeChain }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
  },
}))

// notifyUser mock — best-effort, validamos chamada
const notifyUserMock = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('@/services/notificationService', () => ({
  notifyUser: notifyUserMock,
}))

// createReliableSubscription mock — para subscribeToConflicts
const subscriptionState = vi.hoisted(() => ({
  lastConfig: null,
  cleanup: vi.fn(),
}))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn((cfg) => {
    subscriptionState.lastConfig = cfg
    return { cleanup: subscriptionState.cleanup }
  }),
}))

// ============================================================================
// Import APÓS mocks
// ============================================================================
import supabaseConflictQueueService, {
  enqueueConflict,
  fetchPending,
  fetchAll,
  resolveLastWriteWins,
  resolveLastWriteWinsWithReplay,
  resolveManual,
  dismiss,
  subscribeToConflicts,
} from '@/services/supabaseConflictQueueService'
import { ReplayFailedError } from '@/services/supabaseConflictQueueService'
import {
  registerReplayHandler,
  _resetReplayRegistryForTests,
} from '@/services/conflictReplayRegistry'

// ============================================================================
// Tests
// ============================================================================
describe('supabaseConflictQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.insertResult = { data: null, error: null }
    mocks.state.selectResult = { data: null, error: null, count: 0 }
    mocks.state.updateResult = { data: null, error: null }
    mocks.state.fetchSingleResult = { data: null, error: null }
    mocks.state.lastInsertPayload = null
    mocks.state.lastUpdatePayload = null
    mocks.state.lastEqFilters = []
    _resetReplayRegistryForTests()
    // suppress noisy logger nos casos de erro intencional
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  // ============================================================================
  // enqueueConflict
  // ============================================================================
  describe('enqueueConflict', () => {
    const validParams = {
      opId: 'op-123',
      opString: 'documento.recordAcknowledgement',
      userId: 'user-1',
      userName: 'Test User',
      payload: { docId: 'd-1' },
    }

    it('insere row e retorna camelCase', async () => {
      mocks.state.insertResult = {
        data: {
          id: 'conflict-1',
          op_id: 'op-123',
          op_string: 'documento.recordAcknowledgement',
          user_id: 'user-1',
          user_name: 'Test User',
          payload: { docId: 'd-1' },
          server_state: null,
          status: 'pending',
          created_at: '2026-05-12T12:00:00Z',
        },
        error: null,
      }
      const result = await enqueueConflict(validParams)
      expect(result.id).toBe('conflict-1')
      expect(result.opId).toBe('op-123')
      expect(result.opString).toBe('documento.recordAcknowledgement')
      expect(result.userId).toBe('user-1')
      expect(result.userName).toBe('Test User')
      expect(result.createdAt).toBe('2026-05-12T12:00:00Z')
    })

    it('persiste opId como string mesmo se number for passado', async () => {
      mocks.state.insertResult = { data: { id: 'x' }, error: null }
      await enqueueConflict({ ...validParams, opId: 42 })
      expect(mocks.state.lastInsertPayload.op_id).toBe('42')
    })

    it('throw sem opId', async () => {
      await expect(enqueueConflict({ ...validParams, opId: '' })).rejects.toThrow(
        /opId obrigatório/
      )
    })

    it('throw sem opString', async () => {
      await expect(enqueueConflict({ ...validParams, opString: '' })).rejects.toThrow(
        /opString obrigatório/
      )
    })

    it('throw sem userId', async () => {
      await expect(enqueueConflict({ ...validParams, userId: '' })).rejects.toThrow(
        /userId obrigatório/
      )
    })

    it('throw sem userName', async () => {
      await expect(enqueueConflict({ ...validParams, userName: '' })).rejects.toThrow(
        /userName obrigatório/
      )
    })

    it('throw sem payload', async () => {
      await expect(enqueueConflict({ ...validParams, payload: null })).rejects.toThrow(
        /payload obrigatório/
      )
    })

    it('propaga erro do Supabase', async () => {
      mocks.state.insertResult = { data: null, error: new Error('PG broke') }
      await expect(enqueueConflict(validParams)).rejects.toThrow('PG broke')
    })

    it('serverState default null', async () => {
      mocks.state.insertResult = { data: { id: 'x' }, error: null }
      await enqueueConflict(validParams)
      expect(mocks.state.lastInsertPayload.server_state).toBeNull()
    })
  })

  // ============================================================================
  // fetchPending
  // ============================================================================
  describe('fetchPending', () => {
    it('retorna rows mapeadas para camelCase + total', async () => {
      mocks.state.selectResult = {
        data: [
          {
            id: 'c1',
            op_id: 'op-1',
            op_string: 'documento.recordAcknowledgement',
            user_id: 'u1',
            user_name: 'U1',
            payload: {},
            status: 'pending',
            created_at: '2026-05-01T10:00:00Z',
          },
        ],
        error: null,
        count: 5,
      }
      const result = await fetchPending({ limit: 10, offset: 0 })
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].opString).toBe('documento.recordAcknowledgement')
      expect(result.rows[0].userId).toBe('u1')
      expect(result.total).toBe(5)
    })

    it('retorna rows=[] e total=0 quando data=null', async () => {
      mocks.state.selectResult = { data: null, error: null, count: null }
      const result = await fetchPending()
      expect(result.rows).toEqual([])
      expect(result.total).toBe(0)
    })

    it('aplica filtro opString quando informado', async () => {
      mocks.state.selectResult = { data: [], error: null, count: 0 }
      await fetchPending({ opString: 'documento.recordAcknowledgement' })
      // 1º eq = status=pending; 2º eq = op_string
      const opStrFilter = mocks.state.lastEqFilters.find(
        (f) => f[0] === 'op_string'
      )
      expect(opStrFilter).toBeDefined()
      expect(opStrFilter[1]).toBe('documento.recordAcknowledgement')
    })

    it('aplica filtro userId quando informado', async () => {
      mocks.state.selectResult = { data: [], error: null, count: 0 }
      await fetchPending({ userId: 'u-99' })
      const userFilter = mocks.state.lastEqFilters.find((f) => f[0] === 'user_id')
      expect(userFilter[1]).toBe('u-99')
    })

    it('propaga erro do Supabase', async () => {
      mocks.state.selectResult = { data: null, error: new Error('rls denied') }
      await expect(fetchPending()).rejects.toThrow('rls denied')
    })
  })

  // ============================================================================
  // fetchAll
  // ============================================================================
  describe('fetchAll', () => {
    it('retorna {rows, total} sem filtro de status', async () => {
      mocks.state.selectResult = {
        data: [{ id: 'a', status: 'resolved_manual' }],
        error: null,
        count: 1,
      }
      const result = await fetchAll({ limit: 5 })
      expect(result.rows).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('aplica filtro status quando informado', async () => {
      mocks.state.selectResult = { data: [], error: null, count: 0 }
      await fetchAll({ status: 'dismissed' })
      const statusFilter = mocks.state.lastEqFilters.find((f) => f[0] === 'status')
      expect(statusFilter[1]).toBe('dismissed')
    })

    it('propaga erro', async () => {
      mocks.state.selectResult = { data: null, error: new Error('boom') }
      await expect(fetchAll()).rejects.toThrow('boom')
    })
  })

  // ============================================================================
  // resolveLastWriteWins
  // ============================================================================
  describe('resolveLastWriteWins', () => {
    it('atualiza status, devolve row em camelCase, notifica user', async () => {
      mocks.state.updateResult = {
        data: {
          id: 'c1',
          status: 'resolved_last_write_wins',
          resolved_by: 'admin-1',
          resolved_at: '2026-05-12T12:00:00Z',
          user_id: 'u1',
          op_string: 'documento.recordAcknowledgement',
          resolution_notes: 'Aplicado last-write-wins via botão rápido',
        },
        error: null,
      }
      const row = await resolveLastWriteWins('c1', {
        uid: 'admin-1',
        displayName: 'Admin',
      })
      expect(row.status).toBe('resolved_last_write_wins')
      expect(row.resolvedBy).toBe('admin-1')
      expect(row.userId).toBe('u1')
      expect(mocks.state.lastUpdatePayload.resolved_by).toBe('admin-1')
      expect(notifyUserMock).toHaveBeenCalledTimes(1)
      const [targetUid, notif] = notifyUserMock.mock.calls[0]
      expect(targetUid).toBe('u1')
      expect(notif.category).toBe('sistema')
      expect(notif.relatedEntityType).toBe('conflict_queue')
      // LGPD: não vaza payload nem server_state
      expect(notif.content).not.toContain('payload')
    })

    it('throw sem userInfo (audit trail)', async () => {
      await expect(resolveLastWriteWins('c1', null)).rejects.toThrow(
        /userInfo.uid é obrigatório/
      )
    })

    it('throw sem conflictId', async () => {
      await expect(
        resolveLastWriteWins('', { uid: 'admin-1' })
      ).rejects.toThrow(/conflictId obrigatório/)
    })

    it('notify falha → não trava resolução (best-effort)', async () => {
      mocks.state.updateResult = {
        data: { id: 'c1', user_id: 'u1', status: 'resolved_last_write_wins' },
        error: null,
      }
      notifyUserMock.mockRejectedValueOnce(new Error('FCM down'))
      const row = await resolveLastWriteWins('c1', { uid: 'admin-1' })
      expect(row.id).toBe('c1')
      // Warn registrado (notify non-blocking)
      expect(console.warn).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // resolveManual
  // ============================================================================
  describe('resolveManual', () => {
    it('throw com notes < 10 chars', async () => {
      await expect(
        resolveManual('c1', 'curto', { uid: 'admin' })
      ).rejects.toThrow(/>= 10 caracteres/)
    })

    it('throw com notes não-string', async () => {
      await expect(
        resolveManual('c1', null, { uid: 'admin' })
      ).rejects.toThrow(/>= 10 caracteres/)
    })

    it('sucesso → status=resolved_manual + notes trimmed', async () => {
      mocks.state.updateResult = {
        data: {
          id: 'c1',
          status: 'resolved_manual',
          resolution_notes: 'Decisão tomada após análise',
          resolved_by: 'admin-1',
          user_id: 'u1',
        },
        error: null,
      }
      const row = await resolveManual(
        'c1',
        '  Decisão tomada após análise  ',
        { uid: 'admin-1', displayName: 'Admin' }
      )
      expect(row.status).toBe('resolved_manual')
      expect(mocks.state.lastUpdatePayload.resolution_notes).toBe(
        'Decisão tomada após análise'
      )
      expect(notifyUserMock).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // dismiss
  // ============================================================================
  describe('dismiss', () => {
    it('marca status=dismissed e notifica', async () => {
      mocks.state.updateResult = {
        data: {
          id: 'c1',
          status: 'dismissed',
          resolved_by: 'admin-1',
          user_id: 'u1',
        },
        error: null,
      }
      const row = await dismiss('c1', { uid: 'admin-1' })
      expect(row.status).toBe('dismissed')
      expect(mocks.state.lastUpdatePayload.status).toBe('dismissed')
      expect(mocks.state.lastUpdatePayload.resolution_notes).toBe('Descartado')
    })

    it('throw sem userInfo', async () => {
      await expect(dismiss('c1', { uid: '' })).rejects.toThrow(
        /userInfo.uid é obrigatório/
      )
    })
  })

  // ============================================================================
  // resolveLastWriteWinsWithReplay
  // ============================================================================
  describe('resolveLastWriteWinsWithReplay', () => {
    it('throw sem conflictId', async () => {
      await expect(
        resolveLastWriteWinsWithReplay('', { uid: 'admin' })
      ).rejects.toThrow(/conflictId obrigatório/)
    })

    it('throw sem userInfo', async () => {
      await expect(
        resolveLastWriteWinsWithReplay('c1', null)
      ).rejects.toThrow(/userInfo.uid é obrigatório/)
    })

    it('fetch falha → propaga erro', async () => {
      mocks.state.fetchSingleResult = {
        data: null,
        error: new Error('PG fetch fail'),
      }
      await expect(
        resolveLastWriteWinsWithReplay('c1', { uid: 'admin-1' })
      ).rejects.toThrow('PG fetch fail')
    })

    it('row não encontrada → throw específico', async () => {
      mocks.state.fetchSingleResult = { data: null, error: null }
      await expect(
        resolveLastWriteWinsWithReplay('missing-id', { uid: 'admin-1' })
      ).rejects.toThrow(/não encontrado/)
    })

    it('sem handler registrado → fallback marca status (replayed=false)', async () => {
      // 1ª chamada single() = fetch da row
      // 2ª chamada single() = update do fallback (mas precisamos resetar a flag)
      // Como nosso mock decide single() pela presença de lastUpdatePayload,
      // basta garantir que fetch é fetchSingleResult e update é updateResult.
      mocks.state.fetchSingleResult = {
        data: {
          id: 'c1',
          op_string: 'op.sem.handler',
          user_id: 'u1',
          payload: { foo: 'bar' },
        },
        error: null,
      }
      mocks.state.updateResult = {
        data: {
          id: 'c1',
          op_string: 'op.sem.handler',
          status: 'resolved_last_write_wins',
          resolved_by: 'admin-1',
          user_id: 'u1',
        },
        error: null,
      }
      const result = await resolveLastWriteWinsWithReplay('c1', {
        uid: 'admin-1',
      })
      expect(result.success).toBe(true)
      expect(result.replayed).toBe(false)
      expect(result.fallback).toBe(true)
      expect(result.row.status).toBe('resolved_last_write_wins')
    })

    it('handler registrado + sucesso → replay executado, replayed=true', async () => {
      const handler = vi.fn(async () => 'replay-ok')
      registerReplayHandler('op.com.handler', handler)

      mocks.state.fetchSingleResult = {
        data: {
          id: 'c1',
          op_string: 'op.com.handler',
          user_id: 'u1',
          payload: { docId: 'd-99' },
        },
        error: null,
      }
      mocks.state.updateResult = {
        data: {
          id: 'c1',
          op_string: 'op.com.handler',
          status: 'resolved_last_write_wins',
          resolved_by: 'admin-1',
          user_id: 'u1',
        },
        error: null,
      }

      const result = await resolveLastWriteWinsWithReplay('c1', {
        uid: 'admin-1',
        displayName: 'Admin',
      })

      expect(result.success).toBe(true)
      expect(result.replayed).toBe(true)
      expect(result.fallback).toBeUndefined()
      expect(handler).toHaveBeenCalledWith(
        { docId: 'd-99' },
        { uid: 'admin-1', displayName: 'Admin' }
      )
    })

    it('handler joga erro → ReplayFailedError, status NÃO atualizado', async () => {
      registerReplayHandler('op.broken', async () => {
        throw new Error('upsert broke')
      })

      mocks.state.fetchSingleResult = {
        data: {
          id: 'c1',
          op_string: 'op.broken',
          user_id: 'u1',
          payload: {},
        },
        error: null,
      }

      await expect(
        resolveLastWriteWinsWithReplay('c1', { uid: 'admin-1' })
      ).rejects.toThrow(ReplayFailedError)

      // Não tentou update após erro
      expect(mocks.state.lastUpdatePayload).toBeNull()
      // Notify não foi chamada (conflito não resolvido)
      expect(notifyUserMock).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // ReplayFailedError
  // ============================================================================
  describe('ReplayFailedError', () => {
    it('preserva originalError e opString', () => {
      const orig = new Error('original')
      const err = new ReplayFailedError(orig, 'op.x')
      expect(err.name).toBe('ReplayFailedError')
      expect(err.originalError).toBe(orig)
      expect(err.opString).toBe('op.x')
      expect(err.message).toContain('op.x')
      expect(err.message).toContain('original')
    })

    it('aceita não-Error como originalError', () => {
      const err = new ReplayFailedError('string-error', 'op.y')
      expect(err.message).toContain('string-error')
    })
  })

  // ============================================================================
  // subscribeToConflicts
  // ============================================================================
  describe('subscribeToConflicts', () => {
    it('throw quando callback não é função', () => {
      expect(() => subscribeToConflicts(null)).toThrow(/callback obrigatório/)
      expect(() => subscribeToConflicts('not-a-fn')).toThrow(/callback obrigatório/)
    })

    it('chama createReliableSubscription com config correta', () => {
      const cb = vi.fn()
      const cleanup = subscribeToConflicts(cb)
      expect(typeof cleanup).toBe('function')
      expect(subscriptionState.lastConfig).toBeDefined()
      expect(subscriptionState.lastConfig.channelName).toBe(
        'documento-conflict-queue-changes'
      )
      expect(subscriptionState.lastConfig.table).toBe('documento_conflict_queue')
      expect(subscriptionState.lastConfig.event).toBe('*')
    })

    it('callback recebe rows em camelCase', () => {
      const cb = vi.fn()
      subscribeToConflicts(cb)
      // Aciona o callback interno (que mapeia snake → camel)
      subscriptionState.lastConfig.callback({
        eventType: 'INSERT',
        new: { id: 'x', op_string: 'op.foo', user_id: 'u1' },
        old: null,
      })
      expect(cb).toHaveBeenCalledWith({
        eventType: 'INSERT',
        new: { id: 'x', opString: 'op.foo', userId: 'u1' },
        old: null,
      })
    })

    it('callback com new=null/old=null não quebra mapping', () => {
      const cb = vi.fn()
      subscribeToConflicts(cb)
      subscriptionState.lastConfig.callback({
        eventType: 'DELETE',
        new: null,
        old: { id: 'gone' },
      })
      expect(cb).toHaveBeenCalledWith({
        eventType: 'DELETE',
        new: null,
        old: { id: 'gone' },
      })
    })
  })

  // ============================================================================
  // default export
  // ============================================================================
  describe('default export', () => {
    it('expõe todas as 8 operações públicas', () => {
      const expectedKeys = [
        'enqueueConflict',
        'fetchPending',
        'fetchAll',
        'resolveLastWriteWins',
        'resolveLastWriteWinsWithReplay',
        'resolveManual',
        'dismiss',
        'subscribeToConflicts',
      ]
      for (const k of expectedKeys) {
        expect(typeof supabaseConflictQueueService[k]).toBe('function')
      }
    })
  })
})
