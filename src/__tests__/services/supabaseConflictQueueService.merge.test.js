/**
 * Sprint 16 / F6.3 Wave 2 — resolveMerge service tests
 *
 * Cobre o fluxo de resolução por 3-way merge manual:
 *  1. Update da row com status='resolved_merge_manual' +
 *     resolution_strategy='merge_manual' + changedBy = userInfo.uid.
 *  2. Handler do replay registry chamado com `mergedPayload` (NÃO o payload
 *     original). Validação de "shape" — função pura JS, sem side-effects
 *     reais no Supabase (tudo mockado).
 *  3. LGPD sentinel — `notifyUser.content` NÃO contém payload nem
 *     serverState raw. Apenas metadata (opString, nome admin).
 *  4. Fallback sem handler — fecha o conflito mas NÃO aplica payload.
 *  5. Validação de inputs (conflictId, mergedPayload, userInfo).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mocks — supabase client + notifyUser + replay registry
// ============================================================================

const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

// Estado controlado de retornos: alternamos entre fetch (1ª call) e update (2ª).
let chainResultsQueue = []

function buildChain() {
  const chain = {
    select: vi.fn(() => {
      mockSelect()
      return chain
    }),
    update: vi.fn((payload) => {
      mockUpdate(payload)
      return chain
    }),
    eq: vi.fn((col, val) => {
      mockEq(col, val)
      return chain
    }),
    single: vi.fn(() => {
      mockSingle()
      const next = chainResultsQueue.shift() || { data: null, error: null }
      return Promise.resolve(next)
    }),
  }
  return chain
}

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      mockFrom(table)
      return buildChain()
    }),
  },
}))

// Mock createReliableSubscription (importado no service mas não usado aqui).
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn(() => ({ cleanup: vi.fn() })),
}))

// Mock notifyUser — capturamos para asserção LGPD.
const mockNotifyUser = vi.fn().mockResolvedValue(null)
vi.mock('@/services/notificationService', () => ({
  notifyUser: (...args) => mockNotifyUser(...args),
}))

// Mock replay registry — controlamos handler por op_string.
const mockHandler = vi.fn().mockResolvedValue({ ok: true })
let registeredHandlers = new Set()
vi.mock('@/services/conflictReplayRegistry', () => ({
  hasReplayHandler: vi.fn((opString) => registeredHandlers.has(opString)),
  getReplayHandler: vi.fn(() => mockHandler),
}))

// ============================================================================
// Subject under test
// ============================================================================

import { resolveMerge, dismiss, ReplayFailedError } from '../../services/supabaseConflictQueueService'

const validUser = {
  uid: 'firebase-uid-admin-1',
  displayName: 'Dra. Admin',
  email: 'admin@anest.com.br',
}

const sampleConflictRow = {
  id: 'conflict-1',
  op_id: 'op-merge-001',
  op_string: 'comunicado.completarAcao',
  user_id: 'origin-user-uid',
  user_name: 'Maria Souza',
  payload: { titulo: 'Versao usuario', prioridade: 'alta' },
  server_state: { titulo: 'Versao servidor', prioridade: 'normal' },
  status: 'pending',
  created_at: '2026-05-12T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  chainResultsQueue = []
  registeredHandlers = new Set()
  mockHandler.mockResolvedValue({ ok: true })
})

describe('resolveMerge — happy path com handler registrado', () => {
  it('atualiza row com status=resolved_merge_manual + strategy=merge_manual + changedBy=admin uid', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    // 1ª single: fetch row. 2ª single: update returning.
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({
      data: {
        ...sampleConflictRow,
        status: 'resolved_merge_manual',
        resolution_strategy: 'merge_manual',
        resolution_notes: 'Merge manual por Dra. Admin',
        resolved_by: validUser.uid,
        resolved_at: '2026-05-12T11:00:00.000Z',
      },
      error: null,
    })

    const mergedPayload = { titulo: 'Versao servidor', prioridade: 'alta' }
    const result = await resolveMerge('conflict-1', mergedPayload, validUser)

    // 1. Tabela correta
    expect(mockFrom).toHaveBeenCalledWith('documento_conflict_queue')

    // 2. Update foi chamado com os campos certos
    const updateCall = mockUpdate.mock.calls.find(
      ([arg]) => arg && arg.status === 'resolved_merge_manual'
    )
    expect(updateCall).toBeDefined()
    expect(updateCall[0]).toMatchObject({
      status: 'resolved_merge_manual',
      resolution_strategy: 'merge_manual',
      resolved_by: validUser.uid, // AUDIT — admin real, nunca 'admin' string
    })
    expect(typeof updateCall[0].resolved_at).toBe('string')

    // 3. Resultado tem shape esperado
    expect(result).toMatchObject({
      resolved: true,
      strategy: 'merge_manual',
      replayed: true,
    })
    expect(result.row).toBeDefined()
    expect(result.fallback).toBeUndefined()
  })

  it('chama o handler do replay registry com mergedPayload (NÃO payload original)', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({
      data: { ...sampleConflictRow, status: 'resolved_merge_manual' },
      error: null,
    })

    const mergedPayload = {
      titulo: 'Versao servidor', // veio do server
      prioridade: 'alta', // veio do user
    }
    await resolveMerge('conflict-1', mergedPayload, validUser)

    expect(mockHandler).toHaveBeenCalledTimes(1)
    const [payloadArg, userInfoArg] = mockHandler.mock.calls[0]
    // Deve ser o mergedPayload, não o payload original
    expect(payloadArg).toEqual(mergedPayload)
    expect(payloadArg).not.toEqual(sampleConflictRow.payload)
    expect(userInfoArg).toMatchObject({ uid: validUser.uid })
  })

  it('usa userInfo.resolutionNotes quando fornecido (substitui nota padrão)', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({ data: sampleConflictRow, error: null })

    const customNote = 'merge manual: priorizei titulo do server e mantive prioridade do user'
    await resolveMerge(
      'conflict-1',
      { titulo: 'X' },
      { ...validUser, resolutionNotes: customNote }
    )

    const updateCall = mockUpdate.mock.calls.find(
      ([arg]) => arg && arg.status === 'resolved_merge_manual'
    )
    expect(updateCall[0].resolution_notes).toBe(customNote)
  })
})

describe('resolveMerge — LGPD sentinel (notifyUser content)', () => {
  it('notifyUser.content NÃO contém payload nem serverState raw', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({
      data: {
        ...sampleConflictRow,
        status: 'resolved_merge_manual',
        resolution_strategy: 'merge_manual',
        resolution_notes: 'Merge manual por Dra. Admin',
        resolved_by: validUser.uid,
      },
      error: null,
    })

    const mergedPayload = {
      titulo: 'titulo-SECRETO-server',
      prioridade: 'alta',
    }
    await resolveMerge('conflict-1', mergedPayload, validUser)

    expect(mockNotifyUser).toHaveBeenCalledTimes(1)
    const [targetUid, payload] = mockNotifyUser.mock.calls[0]
    expect(targetUid).toBe(sampleConflictRow.user_id)

    // Content existe + é string
    expect(typeof payload.content).toBe('string')

    // LGPD: não vaza valores do mergedPayload, do payload original, ou do
    // serverState. Comparamos string contains com cada value escalar.
    const sensitiveValues = [
      'titulo-SECRETO-server',
      'Versao usuario',
      'Versao servidor',
      'normal', // server prioridade
    ]
    for (const v of sensitiveValues) {
      expect(payload.content).not.toContain(v)
    }

    // Mas deve conter metadata segura: opString + admin name.
    expect(payload.content).toContain('comunicado.completarAcao')
    expect(payload.content).toContain(validUser.displayName)
  })

  it('notifyUser.relatedEntityType=conflict_queue e relatedEntityId=conflict.id', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({
      data: { ...sampleConflictRow, id: 'conflict-1' },
      error: null,
    })

    await resolveMerge('conflict-1', { titulo: 'X' }, validUser)

    const [, payload] = mockNotifyUser.mock.calls[0]
    expect(payload.relatedEntityType).toBe('conflict_queue')
    expect(payload.relatedEntityId).toBe('conflict-1')
  })
})

describe('resolveMerge — fallback sem handler', () => {
  it('sem handler registrado: marca status mas NÃO chama handler', async () => {
    // registeredHandlers vazio → hasReplayHandler retorna false.
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({
      data: {
        ...sampleConflictRow,
        status: 'resolved_merge_manual',
        resolution_strategy: 'merge_manual',
      },
      error: null,
    })

    const result = await resolveMerge(
      'conflict-1',
      { titulo: 'X' },
      validUser
    )

    expect(mockHandler).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      resolved: true,
      strategy: 'merge_manual',
      replayed: false,
      fallback: true,
    })

    // Update foi chamado mesmo no fallback (audit-only).
    const updateCall = mockUpdate.mock.calls.find(
      ([arg]) => arg && arg.status === 'resolved_merge_manual'
    )
    expect(updateCall).toBeDefined()
    expect(updateCall[0].resolution_notes).toContain('sem replay handler')
  })
})

describe('resolveMerge — replay handler error', () => {
  it('handler joga erro → ReplayFailedError e row NÃO é atualizada', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    chainResultsQueue.push({ data: sampleConflictRow, error: null })

    const originalErr = new Error('PostgrestError: 409 conflict')
    mockHandler.mockRejectedValueOnce(originalErr)

    await expect(
      resolveMerge('conflict-1', { titulo: 'X' }, validUser)
    ).rejects.toThrow(ReplayFailedError)

    // Update com status NÃO foi chamado (só o select inicial)
    const statusUpdateCall = mockUpdate.mock.calls.find(
      ([arg]) => arg && arg.status === 'resolved_merge_manual'
    )
    expect(statusUpdateCall).toBeUndefined()

    // Notify também não disparou (conflito não resolvido).
    expect(mockNotifyUser).not.toHaveBeenCalled()
  })
})

describe('resolveMerge — validação de inputs', () => {
  it('throw se conflictId ausente', async () => {
    await expect(
      resolveMerge(null, { x: 1 }, validUser)
    ).rejects.toThrow(/conflictId obrigat/i)
  })

  it('throw se mergedPayload não-objeto', async () => {
    await expect(
      resolveMerge('c-1', null, validUser)
    ).rejects.toThrow(/mergedPayload obrigat/i)
    await expect(
      resolveMerge('c-1', 'string', validUser)
    ).rejects.toThrow(/mergedPayload obrigat/i)
  })

  it('throw se userInfo.uid ausente (audit trail)', async () => {
    await expect(
      resolveMerge('c-1', { x: 1 }, { displayName: 'Sem uid' })
    ).rejects.toThrow(/userInfo\.uid/i)
  })
})

// ============================================================================
// Sentinel — category='conflict_resolution' (não mais 'sistema')
// ============================================================================
// Wave 5 / ops(notifications): a categoria das notificações de resolução de
// conflito passou de 'sistema' (default seguro pré-catálogo) para
// 'conflict_resolution' (entrada nova em NOTIFICATION_CATEGORIES). DB não
// tem CHECK constraint (removida em 20260424120000); validação é app-side.

describe('notifyConflictResolution — category sentinel', () => {
  it('resolveMerge: notifyUser.category === "conflict_resolution"', async () => {
    registeredHandlers.add('comunicado.completarAcao')
    chainResultsQueue.push({ data: sampleConflictRow, error: null })
    chainResultsQueue.push({
      data: { ...sampleConflictRow, status: 'resolved_merge_manual' },
      error: null,
    })

    await resolveMerge('conflict-1', { titulo: 'X' }, validUser)

    expect(mockNotifyUser).toHaveBeenCalledTimes(1)
    const [, payload] = mockNotifyUser.mock.calls[0]
    expect(payload.category).toBe('conflict_resolution')
    // Guarda contra regressão para o valor antigo.
    expect(payload.category).not.toBe('sistema')
  })

  it('dismiss: notifyUser.category === "conflict_resolution"', async () => {
    // dismiss faz 1 update e depois notifica — basta 1 entry no queue.
    chainResultsQueue.push({
      data: {
        ...sampleConflictRow,
        status: 'dismissed',
        resolution_notes: 'Descartado',
        resolved_by: validUser.uid,
      },
      error: null,
    })

    await dismiss('conflict-1', validUser)

    expect(mockNotifyUser).toHaveBeenCalledTimes(1)
    const [targetUid, payload] = mockNotifyUser.mock.calls[0]
    expect(targetUid).toBe(sampleConflictRow.user_id)
    expect(payload.category).toBe('conflict_resolution')
    expect(payload.category).not.toBe('sistema')
    // LGPD reiterado: content é metadata, sem payload/serverState.
    expect(typeof payload.content).toBe('string')
    expect(payload.content).toContain('descartado')
  })
})
