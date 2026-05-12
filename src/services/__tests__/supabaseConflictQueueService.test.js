/**
 * Sprint 14b / F6.3 — supabaseConflictQueueService tests
 *
 * Cobre: enqueue, fetchPending (paginação + filtro), fetchAll (filtro status),
 * resolveLastWriteWins (valida userInfo + status correto),
 * resolveManual (valida notes >= 10 chars), dismiss.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----------------------------------------------------------------------------
// Mock Supabase client (chainable)
// ----------------------------------------------------------------------------
const { state, fromMock } = vi.hoisted(() => {
  const state = {
    // Resultado padrão das chamadas terminais.
    insertResult: { data: null, error: null },
    selectResult: { data: [], error: null, count: 0 },
    updateResult: { data: null, error: null },
    // Calls recebidos para asserções.
    calls: [],
  }
  const fromMock = vi.fn()
  return { state, fromMock }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

// supabaseSubscriptionHelper é importado pelo service; stubbamos para não
// tocar a infra real de canais.
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn(({ callback }) => {
    // Devolve a função de cleanup + expõe o callback para o teste disparar.
    return { cleanup: vi.fn(), _callback: callback }
  }),
}))

// Sprint 15a / F6.3 closeout — registry de replay handlers stub
const { replayRegistryMock } = vi.hoisted(() => ({
  replayRegistryMock: {
    getReplayHandler: vi.fn(),
    hasReplayHandler: vi.fn(),
    registerReplayHandler: vi.fn(),
    listReplayHandlers: vi.fn(() => []),
  },
}))
vi.mock('@/services/conflictReplayRegistry', () => replayRegistryMock)

// Sprint 15a / F6.3 closeout — notify user origem (A2.a)
// Stub do helper `notifyUser` em notificationService.js. Resoluções não devem
// quebrar se notify falhar (non-blocking) — testes garantem essa propriedade.
const { notifyUserMock } = vi.hoisted(() => ({
  notifyUserMock: vi.fn(async () => null),
}))
vi.mock('@/services/notificationService', () => ({
  notifyUser: notifyUserMock,
}))

// ----------------------------------------------------------------------------
// Helpers de chain mock
// ----------------------------------------------------------------------------
function buildInsertChain() {
  const chain = {
    insert: vi.fn((row) => {
      state.calls.push({ method: 'insert', row })
      return chain
    }),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(state.insertResult)),
  }
  return chain
}

function buildSelectChain() {
  const chain = {
    select: vi.fn((cols, opts) => {
      state.calls.push({ method: 'select', cols, opts })
      return chain
    }),
    eq: vi.fn((col, val) => {
      state.calls.push({ method: 'eq', col, val })
      return chain
    }),
    order: vi.fn((col, opts) => {
      state.calls.push({ method: 'order', col, opts })
      return chain
    }),
    range: vi.fn((from, to) => {
      state.calls.push({ method: 'range', from, to })
      // Terminal — devolve thenable
      return Promise.resolve(state.selectResult)
    }),
    // Sprint 15a / F6.3 closeout — resolveLastWriteWinsWithReplay faz
    // .select().eq('id', x).single() para buscar a row pelo PK.
    single: vi.fn(() => {
      state.calls.push({ method: 'select.single' })
      return Promise.resolve(state.selectSingleResult)
    }),
  }
  return chain
}

function buildUpdateChain() {
  const chain = {
    update: vi.fn((patch) => {
      state.calls.push({ method: 'update', patch })
      return chain
    }),
    eq: vi.fn((col, val) => {
      state.calls.push({ method: 'eq', col, val })
      return chain
    }),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(state.updateResult)),
  }
  return chain
}

// Cada chamada `from(...)` decide qual chain devolver baseado no que o teste
// configurou (default: select chain).
beforeEach(() => {
  state.insertResult = { data: null, error: null }
  state.selectResult = { data: [], error: null, count: 0 }
  state.selectSingleResult = { data: null, error: null }
  state.updateResult = { data: null, error: null }
  state.calls = []
  replayRegistryMock.getReplayHandler.mockReset()
  replayRegistryMock.hasReplayHandler.mockReset().mockReturnValue(false)
  notifyUserMock.mockReset().mockResolvedValue(null)
  fromMock.mockReset()
  fromMock.mockImplementation(() => ({
    // Combine — qualquer um dos métodos abaixo retorna o chain certo.
    insert: (row) => {
      const c = buildInsertChain()
      return c.insert(row)
    },
    select: (cols, opts) => {
      const c = buildSelectChain()
      return c.select(cols, opts)
    },
    update: (patch) => {
      const c = buildUpdateChain()
      return c.update(patch)
    },
  }))
})

// ----------------------------------------------------------------------------
// SUT
// ----------------------------------------------------------------------------
import supabaseConflictQueueService from '@/services/supabaseConflictQueueService'

const validUser = { uid: 'firebase-uid-admin', displayName: 'Dra. Admin' }

// ============================================================================
// 1. enqueueConflict
// ============================================================================
describe('enqueueConflict', () => {
  it('insere row com status=pending e retorna camelCase', async () => {
    state.insertResult = {
      data: {
        id: 'conflict-1',
        op_id: 'idb-7',
        op_string: 'documento.recordAcknowledgement',
        user_id: 'u1',
        user_name: 'Alice',
        payload: { foo: 'bar' },
        server_state: null,
        status: 'pending',
        resolved_by: null,
        resolved_at: null,
        resolution_notes: null,
        created_at: '2026-05-12T00:00:00Z',
      },
      error: null,
    }

    const result = await supabaseConflictQueueService.enqueueConflict({
      opId: 'idb-7',
      opString: 'documento.recordAcknowledgement',
      userId: 'u1',
      userName: 'Alice',
      payload: { foo: 'bar' },
    })

    expect(result.id).toBe('conflict-1')
    expect(result.opId).toBe('idb-7')
    expect(result.opString).toBe('documento.recordAcknowledgement')
    expect(result.userId).toBe('u1')
    expect(result.userName).toBe('Alice')
    expect(result.status).toBe('pending')
    expect(result.createdAt).toBe('2026-05-12T00:00:00Z')

    // Verifica que insert recebeu snake_case + status=pending
    const insertCall = state.calls.find((c) => c.method === 'insert')
    expect(insertCall).toBeDefined()
    expect(insertCall.row.op_id).toBe('idb-7')
    expect(insertCall.row.op_string).toBe('documento.recordAcknowledgement')
    expect(insertCall.row.user_id).toBe('u1')
    expect(insertCall.row.user_name).toBe('Alice')
    expect(insertCall.row.status).toBe('pending')
    expect(insertCall.row.server_state).toBeNull()
  })

  it('throw se opId/payload faltam', async () => {
    await expect(
      supabaseConflictQueueService.enqueueConflict({
        opString: 'x',
        userId: 'u1',
        userName: 'A',
        payload: {},
      })
    ).rejects.toThrow(/opId/)

    await expect(
      supabaseConflictQueueService.enqueueConflict({
        opId: '1',
        opString: 'x',
        userId: 'u1',
        userName: 'A',
      })
    ).rejects.toThrow(/payload/)
  })
})

// ============================================================================
// 2. fetchPending
// ============================================================================
describe('fetchPending', () => {
  it('aplica paginação default (limit=20, offset=0) e filtra status=pending', async () => {
    state.selectResult = {
      data: [
        {
          id: 'c1',
          op_id: 'idb-1',
          op_string: 'documento.recordAcknowledgement',
          user_id: 'u1',
          user_name: 'A',
          payload: {},
          status: 'pending',
          created_at: '2026-05-12T00:00:00Z',
        },
      ],
      error: null,
      count: 1,
    }

    const { rows, total } = await supabaseConflictQueueService.fetchPending()

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('c1')
    expect(rows[0].opString).toBe('documento.recordAcknowledgement')
    expect(total).toBe(1)

    // Asserções de chain
    const eqStatus = state.calls.find(
      (c) => c.method === 'eq' && c.col === 'status'
    )
    expect(eqStatus.val).toBe('pending')

    const range = state.calls.find((c) => c.method === 'range')
    expect(range.from).toBe(0)
    expect(range.to).toBe(19) // offset 0 + limit 20 - 1
  })

  it('paginação custom + filtros opString/userId', async () => {
    state.selectResult = { data: [], error: null, count: 0 }

    await supabaseConflictQueueService.fetchPending({
      limit: 5,
      offset: 10,
      opString: 'comunicado.confirmLeitura',
      userId: 'u9',
    })

    const range = state.calls.find((c) => c.method === 'range')
    expect(range.from).toBe(10)
    expect(range.to).toBe(14)

    const eqs = state.calls.filter((c) => c.method === 'eq')
    expect(eqs).toEqual(
      expect.arrayContaining([
        { method: 'eq', col: 'status', val: 'pending' },
        { method: 'eq', col: 'op_string', val: 'comunicado.confirmLeitura' },
        { method: 'eq', col: 'user_id', val: 'u9' },
      ])
    )
  })
})

// ============================================================================
// 3. fetchAll (admin)
// ============================================================================
describe('fetchAll', () => {
  it('sem filtro de status traz todos; com filtro aplica eq(status)', async () => {
    state.selectResult = { data: [], error: null, count: 0 }

    // Sem filtro
    await supabaseConflictQueueService.fetchAll()
    let statusEq = state.calls.find(
      (c) => c.method === 'eq' && c.col === 'status'
    )
    expect(statusEq).toBeUndefined()

    // Com filtro
    state.calls = []
    await supabaseConflictQueueService.fetchAll({
      status: 'resolved_manual',
    })
    statusEq = state.calls.find(
      (c) => c.method === 'eq' && c.col === 'status'
    )
    expect(statusEq.val).toBe('resolved_manual')
  })
})

// ============================================================================
// 4. resolveLastWriteWins
// ============================================================================
describe('resolveLastWriteWins', () => {
  it('valida userInfo.uid e seta status + resolution_notes + resolved_by', async () => {
    state.updateResult = {
      data: {
        id: 'c1',
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolved_at: '2026-05-12T00:00:00Z',
        resolution_notes: 'Aplicado last-write-wins via botão rápido',
      },
      error: null,
    }

    const result = await supabaseConflictQueueService.resolveLastWriteWins(
      'c1',
      validUser
    )

    expect(result.status).toBe('resolved_last_write_wins')
    expect(result.resolvedBy).toBe(validUser.uid)

    const updateCall = state.calls.find((c) => c.method === 'update')
    expect(updateCall.patch.status).toBe('resolved_last_write_wins')
    expect(updateCall.patch.resolved_by).toBe(validUser.uid)
    expect(updateCall.patch.resolution_notes).toBe(
      'Aplicado last-write-wins via botão rápido'
    )
    expect(updateCall.patch.resolved_at).toBeDefined()

    const eqId = state.calls.find(
      (c) => c.method === 'eq' && c.col === 'id'
    )
    expect(eqId.val).toBe('c1')
  })

  it('throw se userInfo ausente ou sem uid', async () => {
    await expect(
      supabaseConflictQueueService.resolveLastWriteWins('c1', null)
    ).rejects.toThrow(/userInfo\.uid/)

    await expect(
      supabaseConflictQueueService.resolveLastWriteWins('c1', { displayName: 'X' })
    ).rejects.toThrow(/userInfo\.uid/)
  })
})

// ============================================================================
// 5. resolveManual — valida notes >= 10 chars
// ============================================================================
describe('resolveManual', () => {
  it('throw se resolutionNotes < 10 chars (não chama supabase)', async () => {
    await expect(
      supabaseConflictQueueService.resolveManual('c1', 'curto', validUser)
    ).rejects.toThrow(/10 caracteres/)

    // Garante que o supabase NÃO foi invocado
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('aceita notes >= 10 chars e seta status=resolved_manual', async () => {
    state.updateResult = {
      data: {
        id: 'c2',
        status: 'resolved_manual',
        resolved_by: validUser.uid,
        resolution_notes: 'aplicado patch manual após validação clínica',
      },
      error: null,
    }

    const notes = 'aplicado patch manual após validação clínica'
    const result = await supabaseConflictQueueService.resolveManual(
      'c2',
      notes,
      validUser
    )

    expect(result.status).toBe('resolved_manual')
    const updateCall = state.calls.find((c) => c.method === 'update')
    expect(updateCall.patch.resolution_notes).toBe(notes)
    expect(updateCall.patch.resolved_by).toBe(validUser.uid)
  })
})

// ============================================================================
// 6. dismiss
// ============================================================================
describe('dismiss', () => {
  it('seta status=dismissed + resolved_by audit', async () => {
    state.updateResult = {
      data: {
        id: 'c3',
        status: 'dismissed',
        resolved_by: validUser.uid,
        resolution_notes: 'Descartado',
      },
      error: null,
    }

    const result = await supabaseConflictQueueService.dismiss('c3', validUser)
    expect(result.status).toBe('dismissed')

    const updateCall = state.calls.find((c) => c.method === 'update')
    expect(updateCall.patch.status).toBe('dismissed')
    expect(updateCall.patch.resolution_notes).toBe('Descartado')
    expect(updateCall.patch.resolved_by).toBe(validUser.uid)
  })

  it('throw se userInfo ausente', async () => {
    await expect(
      supabaseConflictQueueService.dismiss('c3', null)
    ).rejects.toThrow(/userInfo\.uid/)
  })
})

// ============================================================================
// 7. resolveLastWriteWinsWithReplay — Sprint 15a / F6.3 closeout
// ============================================================================
import { ReplayFailedError } from '@/services/supabaseConflictQueueService'

describe('resolveLastWriteWinsWithReplay', () => {
  const conflictRow = {
    id: 'cf-1',
    op_id: 'idb-42',
    op_string: 'documento.recordAcknowledgement',
    user_id: 'u-original',
    user_name: 'Alice',
    payload: { docId: 'd1', userId: 'u-original', userName: 'Alice' },
    server_state: null,
    status: 'pending',
    resolved_by: null,
    resolved_at: null,
    resolution_notes: null,
    created_at: '2026-05-12T00:00:00Z',
  }

  it('handler succeeds → status atualizado + retorna { replayed: true }', async () => {
    state.selectSingleResult = { data: conflictRow, error: null }
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolved_at: '2026-05-12T01:00:00Z',
        resolution_notes: 'Replay executado com sucesso',
      },
      error: null,
    }
    const handler = vi.fn(async () => undefined)
    replayRegistryMock.hasReplayHandler.mockReturnValue(true)
    replayRegistryMock.getReplayHandler.mockReturnValue(handler)

    const result =
      await supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
        'cf-1',
        validUser
      )

    expect(result.success).toBe(true)
    expect(result.replayed).toBe(true)
    expect(result.fallback).toBeUndefined()
    expect(result.row.status).toBe('resolved_last_write_wins')

    // Handler foi chamado com (payload, userInfo)
    expect(handler).toHaveBeenCalledWith(conflictRow.payload, validUser)

    // Update patch correto
    const updateCall = state.calls.find((c) => c.method === 'update')
    expect(updateCall.patch.status).toBe('resolved_last_write_wins')
    expect(updateCall.patch.resolved_by).toBe(validUser.uid)
    expect(updateCall.patch.resolution_notes).toBe(
      'Replay executado com sucesso'
    )

    // hasReplayHandler foi consultado para op_string correta
    expect(replayRegistryMock.hasReplayHandler).toHaveBeenCalledWith(
      'documento.recordAcknowledgement'
    )
  })

  it('handler throws → ReplayFailedError + row NÃO atualizada', async () => {
    state.selectSingleResult = { data: conflictRow, error: null }
    const dbErr = Object.assign(new Error('unique violation'), {
      code: '23505',
    })
    const handler = vi.fn(async () => {
      throw dbErr
    })
    replayRegistryMock.hasReplayHandler.mockReturnValue(true)
    replayRegistryMock.getReplayHandler.mockReturnValue(handler)

    await expect(
      supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
        'cf-1',
        validUser
      )
    ).rejects.toBeInstanceOf(ReplayFailedError)

    // Captura o erro para inspecionar originalError
    try {
      await supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
        'cf-1',
        validUser
      )
    } catch (err) {
      expect(err).toBeInstanceOf(ReplayFailedError)
      expect(err.originalError).toBe(dbErr)
      expect(err.opString).toBe('documento.recordAcknowledgement')
    }

    // Nenhum update foi chamado (apenas selects para fetch).
    const updateCall = state.calls.find((c) => c.method === 'update')
    expect(updateCall).toBeUndefined()
  })

  it('sem handler → fallback marca status e retorna { replayed: false, fallback: true }', async () => {
    state.selectSingleResult = { data: conflictRow, error: null }
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolved_at: '2026-05-12T01:00:00Z',
        resolution_notes:
          'Sem replay handler para "documento.recordAcknowledgement" — apenas marcação de status',
      },
      error: null,
    }
    replayRegistryMock.hasReplayHandler.mockReturnValue(false)

    const result =
      await supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
        'cf-1',
        validUser
      )

    expect(result.success).toBe(true)
    expect(result.replayed).toBe(false)
    expect(result.fallback).toBe(true)
    expect(result.row.status).toBe('resolved_last_write_wins')

    // getReplayHandler NÃO deve ter sido chamado quando hasReplayHandler=false
    expect(replayRegistryMock.getReplayHandler).not.toHaveBeenCalled()

    // Update foi chamado com notes de fallback
    const updateCall = state.calls.find((c) => c.method === 'update')
    expect(updateCall.patch.status).toBe('resolved_last_write_wins')
    expect(updateCall.patch.resolved_by).toBe(validUser.uid)
    expect(updateCall.patch.resolution_notes).toMatch(/Sem replay handler/)
  })

  it('throw se userInfo ausente (não toca supabase)', async () => {
    await expect(
      supabaseConflictQueueService.resolveLastWriteWinsWithReplay('cf-1', null)
    ).rejects.toThrow(/userInfo\.uid/)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throw se conflictId ausente', async () => {
    await expect(
      supabaseConflictQueueService.resolveLastWriteWinsWithReplay(null, validUser)
    ).rejects.toThrow(/conflictId/)
  })

  it('throw se conflito não existe (selectSingleResult.data=null)', async () => {
    state.selectSingleResult = { data: null, error: null }

    await expect(
      supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
        'cf-missing',
        validUser
      )
    ).rejects.toThrow(/não encontrado/)
  })
})

// ============================================================================
// 8. Notify user origem — Sprint 15a / F6.3 closeout (A2.a)
//
// Confirma que cada caminho de resolução dispara `notifyUser` com:
//  - recipient = conflict.userId (user original)
//  - subject + content humano-legível
//  - content SEM payload/server_state (LGPD)
//  - resolução do conflito não trava se notify falhar (non-blocking)
// ============================================================================
describe('notify user origem (A2.a)', () => {
  const conflictRow = {
    id: 'cf-9',
    op_id: 'idb-99',
    op_string: 'comunicado.confirmLeitura',
    user_id: 'u-original',
    user_name: 'Alice',
    payload: { secret: 'NUNCA-VAZAR', comunicadoId: 'com-1' },
    server_state: { secret: 'SERVER-NUNCA-VAZAR', status: 'lida' },
    status: 'pending',
    resolved_by: null,
    resolved_at: null,
    resolution_notes: null,
    created_at: '2026-05-12T00:00:00Z',
  }

  function assertLgpdSafe(notifPayload) {
    const content = String(notifPayload.content || '')
    // Garante que o content NÃO contém valores raw de payload/server_state.
    expect(content).not.toContain('NUNCA-VAZAR')
    expect(content).not.toContain('SERVER-NUNCA-VAZAR')
  }

  it('resolveLastWriteWins → notifyUser(userId, { category, subject, content }) após update', async () => {
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolution_notes: 'Aplicado last-write-wins via botão rápido',
      },
      error: null,
    }

    await supabaseConflictQueueService.resolveLastWriteWins(
      'cf-9',
      validUser
    )

    expect(notifyUserMock).toHaveBeenCalledTimes(1)
    const [userId, payload] = notifyUserMock.mock.calls[0]
    expect(userId).toBe('u-original')
    expect(payload.subject).toMatch(/Conflito.*resolvido/i)
    expect(payload.content).toMatch(/comunicado\.confirmLeitura/)
    expect(payload.content).toMatch(/Dra. Admin/)
    assertLgpdSafe(payload)
  })

  it('resolveLastWriteWinsWithReplay (replay sucesso) → notifyUser com "resolvido com replay"', async () => {
    state.selectSingleResult = { data: conflictRow, error: null }
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolution_notes: 'Replay executado com sucesso',
      },
      error: null,
    }
    const handler = vi.fn(async () => undefined)
    replayRegistryMock.hasReplayHandler.mockReturnValue(true)
    replayRegistryMock.getReplayHandler.mockReturnValue(handler)

    await supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
      'cf-9',
      validUser
    )

    expect(notifyUserMock).toHaveBeenCalledTimes(1)
    const [userId, payload] = notifyUserMock.mock.calls[0]
    expect(userId).toBe('u-original')
    expect(payload.content).toMatch(/resolvido com replay/i)
    assertLgpdSafe(payload)
  })

  it('resolveLastWriteWinsWithReplay (fallback sem handler) → notifyUser com "apenas marcação"', async () => {
    state.selectSingleResult = { data: conflictRow, error: null }
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolution_notes: 'Sem replay handler — apenas marcação de status',
      },
      error: null,
    }
    replayRegistryMock.hasReplayHandler.mockReturnValue(false)

    await supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
      'cf-9',
      validUser
    )

    expect(notifyUserMock).toHaveBeenCalledTimes(1)
    const [userId, payload] = notifyUserMock.mock.calls[0]
    expect(userId).toBe('u-original')
    expect(payload.content).toMatch(/apenas marcação, sem replay/i)
    assertLgpdSafe(payload)
  })

  it('resolveLastWriteWinsWithReplay (ReplayFailedError) → notifyUser NÃO é chamado', async () => {
    state.selectSingleResult = { data: conflictRow, error: null }
    const handler = vi.fn(async () => {
      throw new Error('replay falhou')
    })
    replayRegistryMock.hasReplayHandler.mockReturnValue(true)
    replayRegistryMock.getReplayHandler.mockReturnValue(handler)

    await expect(
      supabaseConflictQueueService.resolveLastWriteWinsWithReplay(
        'cf-9',
        validUser
      )
    ).rejects.toBeInstanceOf(ReplayFailedError)

    // Conflito NÃO foi resolvido → notify NÃO foi disparado.
    expect(notifyUserMock).not.toHaveBeenCalled()
  })

  it('resolveManual → notifyUser com "resolvido manualmente"', async () => {
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_manual',
        resolved_by: validUser.uid,
        resolution_notes: 'aplicado patch manual após validação clínica',
      },
      error: null,
    }

    await supabaseConflictQueueService.resolveManual(
      'cf-9',
      'aplicado patch manual após validação clínica',
      validUser
    )

    expect(notifyUserMock).toHaveBeenCalledTimes(1)
    const [userId, payload] = notifyUserMock.mock.calls[0]
    expect(userId).toBe('u-original')
    expect(payload.content).toMatch(/resolvido manualmente/i)
    assertLgpdSafe(payload)
  })

  it('dismiss → notifyUser com "descartado"', async () => {
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'dismissed',
        resolved_by: validUser.uid,
        resolution_notes: 'Descartado',
      },
      error: null,
    }

    await supabaseConflictQueueService.dismiss('cf-9', validUser)

    expect(notifyUserMock).toHaveBeenCalledTimes(1)
    const [userId, payload] = notifyUserMock.mock.calls[0]
    expect(userId).toBe('u-original')
    expect(payload.content).toMatch(/descartado/i)
    assertLgpdSafe(payload)
  })

  it('notify falha → resolução não é afetada (non-blocking warn)', async () => {
    state.updateResult = {
      data: {
        ...conflictRow,
        status: 'resolved_last_write_wins',
        resolved_by: validUser.uid,
        resolution_notes: 'Aplicado last-write-wins via botão rápido',
      },
      error: null,
    }
    notifyUserMock.mockRejectedValueOnce(new Error('notify backend down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Não deve jogar — resolução tem sucesso mesmo com notify quebrado.
    const result = await supabaseConflictQueueService.resolveLastWriteWins(
      'cf-9',
      validUser
    )
    expect(result.status).toBe('resolved_last_write_wins')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('notify failed'),
      expect.anything()
    )
    warnSpy.mockRestore()
  })
})
