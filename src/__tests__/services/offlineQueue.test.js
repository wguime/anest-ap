// Sprint 10 / F6.2 — testa offlineQueue + offlineQueueProcessor.
// Roda sob jsdom + fake-indexeddb (devDep). Substitui o smoke
// scripts/smoke-pwa-offline.mjs para o trecho de queue (cache-hit do SW
// é validado manualmente — exige browser real, fora do escopo unit).
//
// Sprint 14a — estende cobertura para integration de comunicado.completarAcao
// e comunicado.desfazerAcao no service supabaseComunicadosService.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

// Sprint 14a — Mock híbrido do Supabase para testar integração F6.2:
//   - `comunicado_acoes_completadas`: chain detalhada
//       upsert(...).select().single() OU delete().eq().eq().eq()
//     (configurado via `mockSupabaseState.upsertResult` / `.deleteResult`)
//   - `documento_distribuicao`: upsert direto via `upsertMock` (vi.fn)
//   - `rpc(...)`: `rpcMock` (vi.fn) — usado por logAction (rpc_log_document_action)
//
// vi.mock é hoisted para o topo do arquivo, então variáveis referenciadas
// dentro do factory precisam ser hoisted também via vi.hoisted().
const { mockSupabaseState, upsertMock, rpcMock } = vi.hoisted(() => ({
  mockSupabaseState: {
    upsertResult: { data: null, error: null },
    deleteResult: { error: null },
    upsertCalls: [],
    deleteCalls: [],
  },
  upsertMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'documento_distribuicao') {
        // Caminho Agent B: upsert direto sem .select().single().
        return { upsert: upsertMock }
      }
      // Caminho Agent A: chain detalhada para comunicado_acoes_completadas.
      const upsertChain = {
        select: vi.fn(() => upsertChain),
        single: vi.fn(() => Promise.resolve(mockSupabaseState.upsertResult)),
      }
      const deleteEqChain = {}
      deleteEqChain.eq = vi.fn(() => deleteEqChain)
      deleteEqChain.then = (onFulfilled) =>
        Promise.resolve(mockSupabaseState.deleteResult).then(onFulfilled)
      return {
        upsert: vi.fn((payload, opts) => {
          mockSupabaseState.upsertCalls.push({ table, payload, opts })
          return upsertChain
        }),
        delete: vi.fn(() => {
          mockSupabaseState.deleteCalls.push({ table })
          return deleteEqChain
        }),
      }
    }),
    rpc: rpcMock,
  },
}))

import { setIDBFactory, enqueue, peekAll, remove, markFailed, clearAll, _resetForTests as _resetQueue } from '@/utils/offlineQueue'

import { registerHandler, flush, setConflictHandler, isConflictError, isConflictResult, _resetForTests as _resetProcessor } from '@/services/offlineQueueProcessor'

// Service sob teste — importado depois do vi.mock acima (hoisted).
import supabaseComunicadosService from '@/services/supabaseComunicadosService'

beforeEach(() => {
  // Cada teste recebe IDB fresca + handlers limpos.
  setIDBFactory(new IDBFactory())
  _resetQueue()
  _resetProcessor()
  upsertMock.mockReset()
  rpcMock.mockReset()
  // Default behavior: sucesso.
  upsertMock.mockResolvedValue({ error: null })
  rpcMock.mockResolvedValue({ error: null })
})

describe('offlineQueue', () => {
  it('enqueue persiste registro com attempts=0 e nextRetryAt=now', async () => {
    const before = Date.now()
    const rec = await enqueue({ op: 'test.op', payload: { x: 1 } })
    expect(rec.id).toBeDefined()
    expect(rec.op).toBe('test.op')
    expect(rec.payload).toEqual({ x: 1 })
    expect(rec.attempts).toBe(0)
    expect(rec.nextRetryAt).toBeGreaterThanOrEqual(before)
  })

  it('peekAll retorna itens em ordem FIFO de createdAt', async () => {
    await enqueue({ op: 'a', payload: 1 })
    await new Promise((r) => setTimeout(r, 5))
    await enqueue({ op: 'b', payload: 2 })
    const all = await peekAll()
    expect(all.length).toBe(2)
    expect(all[0].op).toBe('a')
    expect(all[1].op).toBe('b')
  })

  it('remove apaga item específico', async () => {
    const rec = await enqueue({ op: 'x', payload: null })
    await remove(rec.id)
    const all = await peekAll()
    expect(all.length).toBe(0)
  })

  it('markFailed incrementa attempts e calcula backoff exponencial', async () => {
    const rec = await enqueue({ op: 'fail.op', payload: null })
    const t0 = Date.now()
    const updated = await markFailed(rec.id, 'timeout')
    expect(updated.attempts).toBe(1)
    expect(updated.lastError).toBe('timeout')
    // 2^1 * 1000 = 2000ms, mas timing é loose
    expect(updated.nextRetryAt).toBeGreaterThanOrEqual(t0 + 1500)
    expect(updated.nextRetryAt).toBeLessThan(t0 + 3000)

    const updated2 = await markFailed(rec.id, 'timeout again')
    expect(updated2.attempts).toBe(2)
    // 2^2 * 1000 = 4000ms
    expect(updated2.nextRetryAt).toBeGreaterThanOrEqual(t0 + 3500)
  })

  it('clearAll limpa o store', async () => {
    await enqueue({ op: 'a' })
    await enqueue({ op: 'b' })
    await clearAll()
    const all = await peekAll()
    expect(all.length).toBe(0)
  })
})

describe('offlineQueueProcessor.flush', () => {
  it('drena fila quando handler resolve', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true })
    registerHandler('test.ok', handler)
    await enqueue({ op: 'test.ok', payload: { v: 42 } })
    await enqueue({ op: 'test.ok', payload: { v: 43 } })

    const result = await flush()
    expect(result).toEqual({ processed: 2, failed: 0, skipped: 0, conflicts: 0 })
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenCalledWith({ v: 42 })
    expect(handler).toHaveBeenCalledWith({ v: 43 })

    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('marca como failed e mantém na fila quando handler throw', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'))
    registerHandler('test.err', handler)
    await enqueue({ op: 'test.err', payload: null })

    const result = await flush()
    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0, conflicts: 0 })

    const remaining = await peekAll()
    expect(remaining.length).toBe(1)
    expect(remaining[0].attempts).toBe(1)
    expect(remaining[0].lastError).toBe('boom')
  })

  it('respeita backoff: skipped quando nextRetryAt > now', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('temp'))
    registerHandler('test.skip', handler)
    await enqueue({ op: 'test.skip' })

    // Primeira flush falha e marca backoff
    await flush()
    handler.mockClear()

    // Segunda flush imediata — backoff ativo, deve pular
    const result = await flush()
    expect(result.skipped).toBe(1)
    expect(result.failed).toBe(0)
    expect(handler).not.toHaveBeenCalled()
  })

  it('pula item sem handler registrado', async () => {
    await enqueue({ op: 'unknown.op', payload: null })
    const result = await flush()
    expect(result.skipped).toBe(1)
    const remaining = await peekAll()
    expect(remaining.length).toBe(1) // continua na fila para futuro handler
  })

  it('after backoff expira, retry processa com sucesso', async () => {
    let calls = 0
    registerHandler('test.flaky', async () => {
      calls++
      if (calls === 1) throw new Error('first fails')
    })
    await enqueue({ op: 'test.flaky' })

    await flush() // falha + backoff

    // Avança "now" pra além do backoff
    const records = await peekAll()
    const futureNow = records[0].nextRetryAt + 100

    const result = await flush({ now: futureNow })
    expect(result.processed).toBe(1)
    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
    expect(calls).toBe(2)
  })
})

// ============================================================================
// Sprint 14b / F6.3 — Conflict detection (23505 / 409)
// ============================================================================

describe('offlineQueueProcessor — conflict detection (F6.3)', () => {
  it('handler que joga 23505 → conflictHandler chamado, item removido da fila', async () => {
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('duplicate'), { code: '23505' })
    registerHandler('test.conflict', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.conflict', payload: { x: 1 } })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(result.failed).toBe(0)
    expect(conflict).toHaveBeenCalledTimes(1)
    // Recebe (item, err)
    const [item, receivedErr] = conflict.mock.calls[0]
    expect(item.op).toBe('test.conflict')
    expect(item.payload).toEqual({ x: 1 })
    expect(receivedErr.code).toBe('23505')

    // Item removido da fila local
    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('handler que joga status=409 → conflictHandler chamado, item removido', async () => {
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('conflict'), { status: 409 })
    registerHandler('test.http409', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.http409', payload: null })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(conflict).toHaveBeenCalledTimes(1)

    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('handler que joga status=412 (Precondition Failed / If-Match etag) → conflictHandler chamado', async () => {
    // Sprint 16 / F6.3 polish — optimistic lock via If-Match header.
    // Quando o servidor rejeita mutation porque o etag enviado não bate com
    // o estado atual do recurso, retorna 412. Tratamos como conflito.
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('precondition failed'), { status: 412 })
    registerHandler('test.http412', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.http412', payload: { docId: 'd-1' } })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(result.failed).toBe(0)
    expect(conflict).toHaveBeenCalledTimes(1)
    const [item, receivedErr] = conflict.mock.calls[0]
    expect(item.op).toBe('test.http412')
    expect(item.payload).toEqual({ docId: 'd-1' })
    expect(receivedErr.status).toBe(412)

    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('handler que joga statusCode=412 → conflictHandler chamado (alias statusCode)', async () => {
    // Alguns SDKs expõem o código HTTP como statusCode em vez de status.
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('precondition failed'), {
      statusCode: 412,
    })
    registerHandler('test.http412.alias', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.http412.alias' })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('isConflictError reconhece 412 (cobertura direta da função)', async () => {
    const { isConflictError } = await import(
      '@/services/offlineQueueProcessor'
    )
    expect(isConflictError({ status: 412 })).toBe(true)
    expect(isConflictError({ statusCode: 412 })).toBe(true)
    // Sanity check regression — status conhecidos continuam reconhecidos
    expect(isConflictError({ code: '23505' })).toBe(true)
    expect(isConflictError({ status: 409 })).toBe(true)
    // Outros status não-conflict não cruzam
    expect(isConflictError({ status: 500 })).toBe(false)
    expect(isConflictError({ status: 404 })).toBe(false)
    expect(isConflictError(null)).toBe(false)
  })

  it('network error genérico (sem code/status) → markFailed (comportamento legado)', async () => {
    const conflict = vi.fn()
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    registerHandler(
      'test.network',
      vi.fn().mockRejectedValue(new Error('fetch failed'))
    )
    await enqueue({ op: 'test.network' })

    const result = await flush()
    expect(result.conflicts).toBe(0)
    expect(result.failed).toBe(1)
    // conflictHandler NÃO foi chamado pra erro não-409
    expect(conflict).not.toHaveBeenCalled()

    // Item permanece na fila (com backoff)
    const remaining = await peekAll()
    expect(remaining.length).toBe(1)
    expect(remaining[0].attempts).toBe(1)
  })

  it('conflict sem conflictHandler registrado → fallback markFailed', async () => {
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(null)

    const err = Object.assign(new Error('dup'), { code: '23505' })
    registerHandler('test.noconflict', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.noconflict' })

    const result = await flush()
    expect(result.conflicts).toBe(0)
    expect(result.failed).toBe(1)
    const remaining = await peekAll()
    expect(remaining.length).toBe(1)
  })

  it('conflictHandler falha → fallback markFailed (não perde a entry)', async () => {
    const conflict = vi
      .fn()
      .mockRejectedValue(new Error('supabase RLS denied'))
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('dup'), { code: '23505' })
    registerHandler('test.cfail', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.cfail' })

    const result = await flush()
    expect(result.conflicts).toBe(0)
    expect(result.failed).toBe(1)
    const remaining = await peekAll()
    expect(remaining.length).toBe(1)
  })
})

// ============================================================================
// Sprint 15a / F6.3 closeout (A3) — opt-in conflict result shape
//
// Handler pode retornar { conflict: true, server_state? } em vez de jogar.
// Útil para RPCs que comparam updated_at e devolvem snapshot do server,
// ou para business stale-state detection. Pattern 100% opcional —
// handlers existentes (que jogam 23505/409) continuam funcionando.
// ============================================================================
describe('offlineQueueProcessor — opt-in conflict shape (A3)', () => {
  it('handler retorna { conflict: true, server_state } → conflict queue com server_state preservado', async () => {
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler, isConflictResult } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    // Sanity check do detector (export público)
    expect(isConflictResult({ conflict: true })).toBe(true)
    expect(isConflictResult({ conflict: false })).toBe(false)
    expect(isConflictResult({ ok: true })).toBe(false)
    expect(isConflictResult(null)).toBe(false)
    expect(isConflictResult(undefined)).toBe(false)

    const serverSnapshot = { id: 'doc-1', updated_at: '2026-05-12T01:00:00Z' }
    registerHandler(
      'test.optin',
      vi.fn().mockResolvedValue({ conflict: true, server_state: serverSnapshot })
    )
    await enqueue({ op: 'test.optin', payload: { docId: 'doc-1' } })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(result.processed).toBe(0)
    expect(result.failed).toBe(0)
    expect(conflict).toHaveBeenCalledTimes(1)

    // conflictHandler recebe (item enriquecido, err sintético)
    const [item, err] = conflict.mock.calls[0]
    expect(item.op).toBe('test.optin')
    expect(item.payload).toEqual({ docId: 'doc-1' })
    expect(item.server_state).toEqual(serverSnapshot)
    expect(err.optInResult).toBe(true)
    expect(err.server_state).toEqual(serverSnapshot)

    // Item removido da fila local (sucesso)
    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('handler retorna { conflict: true } (sem server_state) → server_state=null', async () => {
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    registerHandler(
      'test.optin.bare',
      vi.fn().mockResolvedValue({ conflict: true })
    )
    await enqueue({ op: 'test.optin.bare', payload: { x: 1 } })

    const result = await flush()
    expect(result.conflicts).toBe(1)

    const [item, err] = conflict.mock.calls[0]
    expect(item.server_state).toBeNull()
    expect(err.server_state).toBeNull()
  })

  it('handler retorna { ok: true } (valor normal) → drena fila, NÃO enfileira conflito', async () => {
    const conflict = vi.fn()
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    registerHandler('test.ok', vi.fn().mockResolvedValue({ ok: true }))
    await enqueue({ op: 'test.ok', payload: null })

    const result = await flush()
    expect(result.processed).toBe(1)
    expect(result.conflicts).toBe(0)
    expect(conflict).not.toHaveBeenCalled()

    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('handler retorna { conflict: false } → tratado como sucesso normal', async () => {
    const conflict = vi.fn()
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    registerHandler(
      'test.notconflict',
      vi.fn().mockResolvedValue({ conflict: false, data: 'whatever' })
    )
    await enqueue({ op: 'test.notconflict' })

    const result = await flush()
    expect(result.processed).toBe(1)
    expect(result.conflicts).toBe(0)
    expect(conflict).not.toHaveBeenCalled()
  })

  it('regressão pattern 1 (throw 23505) continua funcionando após mudança', async () => {
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('dup'), { code: '23505' })
    registerHandler('test.regression23505', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.regression23505', payload: { x: 'v' } })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(result.failed).toBe(0)
    expect(conflict).toHaveBeenCalledTimes(1)
    const [item, receivedErr] = conflict.mock.calls[0]
    expect(item.payload).toEqual({ x: 'v' })
    expect(receivedErr.code).toBe('23505')
    // optInResult NÃO presente neste caminho — confirma diferenciação
    expect(receivedErr.optInResult).toBeUndefined()
  })

  it('regressão pattern 1 (throw 409) continua funcionando após mudança', async () => {
    const conflict = vi.fn().mockResolvedValue(undefined)
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    const err = Object.assign(new Error('conflict'), { status: 409 })
    registerHandler('test.regression409', vi.fn().mockRejectedValue(err))
    await enqueue({ op: 'test.regression409' })

    const result = await flush()
    expect(result.conflicts).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('handler joga erro genérico (não-conflict) → markFailed (regressão)', async () => {
    const conflict = vi.fn()
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    registerHandler(
      'test.generic.err',
      vi.fn().mockRejectedValue(new Error('boom'))
    )
    await enqueue({ op: 'test.generic.err' })

    const result = await flush()
    expect(result.failed).toBe(1)
    expect(result.conflicts).toBe(0)
    expect(conflict).not.toHaveBeenCalled()

    // Item permanece na fila com backoff
    const remaining = await peekAll()
    expect(remaining.length).toBe(1)
    expect(remaining[0].attempts).toBe(1)
  })

  it('opt-in conflict sem conflictHandler registrado → drena fila (sucesso, não trava)', async () => {
    // Comportamento defensivo: sem conflictHandler, o opt-in result não tem
    // pra onde ir. Como handler resolveu (não jogou), tratamos como sucesso
    // normal — simétrico ao comportamento do caminho 1 quando conflictHandler
    // está null (que cai em markFailed para o item ter chance de retry futuro,
    // mas aqui não há erro pra reportar).
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(null)

    registerHandler(
      'test.optin.nohandler',
      vi.fn().mockResolvedValue({ conflict: true })
    )
    await enqueue({ op: 'test.optin.nohandler' })

    const result = await flush()
    // Sem conflictHandler, opt-in cai para o caminho "sucesso normal".
    expect(result.processed).toBe(1)
    expect(result.conflicts).toBe(0)
    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })

  it('opt-in conflict + conflictHandler falha → markFailed (não perde entry)', async () => {
    const conflict = vi
      .fn()
      .mockRejectedValue(new Error('supabase down'))
    const { setConflictHandler } = await import(
      '@/services/offlineQueueProcessor'
    )
    setConflictHandler(conflict)

    registerHandler(
      'test.optin.cfail',
      vi.fn().mockResolvedValue({ conflict: true, server_state: { x: 1 } })
    )
    await enqueue({ op: 'test.optin.cfail' })

    const result = await flush()
    expect(result.failed).toBe(1)
    expect(result.conflicts).toBe(0)
    const remaining = await peekAll()
    expect(remaining.length).toBe(1)
    expect(remaining[0].attempts).toBe(1)
  })
})

// ============================================================================
// Sprint 14a — Integração offline queue em comunicado.completarAcao
// ============================================================================

describe('comunicado.completarAcao integration', () => {
  // Helper: força navigator.onLine para o valor desejado pelo teste.
  function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => value,
    })
  }

  beforeEach(() => {
    mockSupabaseState.upsertResult = { data: null, error: null }
    mockSupabaseState.upsertCalls = []
    setOnline(true)
  })

  it('com navigator.onLine=false enfileira e devolve resposta otimista (não chama Supabase)', async () => {
    setOnline(false)

    const result = await supabaseComunicadosService.completarAcao(
      'com-1',
      'acao-7',
      'user-42',
      'Alice'
    )

    // Shape otimista esperado.
    expect(result).toEqual({
      acaoId: 'acao-7',
      userId: 'user-42',
      userName: 'Alice',
      completedAt: expect.any(String),
    })

    // Supabase NÃO foi chamado.
    expect(mockSupabaseState.upsertCalls.length).toBe(0)

    // Fila tem 1 item com op correta e payload completo.
    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('comunicado.completarAcao')
    expect(queued[0].payload).toEqual({
      comunicadoId: 'com-1',
      acaoId: 'acao-7',
      userId: 'user-42',
      userName: 'Alice',
      completedAt: expect.any(String),
    })
  })

  it('com network error (não-RLS) cai no fallback enqueue e retorna otimista', async () => {
    // Online, mas Supabase devolve erro "tipo network" (sem code, msg matches /fetch|network|failed/i).
    mockSupabaseState.upsertResult = {
      data: null,
      error: { message: 'network failure' },
    }

    const result = await supabaseComunicadosService.completarAcao(
      'com-2',
      'acao-8',
      'user-43',
      'Bob'
    )

    expect(result).toEqual({
      acaoId: 'acao-8',
      userId: 'user-43',
      userName: 'Bob',
      completedAt: expect.any(String),
    })

    // Tentativa direta de upsert ocorreu (uma chamada).
    expect(mockSupabaseState.upsertCalls.length).toBe(1)

    // Fallback enfileirou.
    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('comunicado.completarAcao')
    expect(queued[0].payload.comunicadoId).toBe('com-2')
    expect(queued[0].payload.acaoId).toBe('acao-8')
  })

  it('flush executa o handler registrado e drena a fila quando online', async () => {
    // Enfileira offline.
    setOnline(false)
    await supabaseComunicadosService.completarAcao('com-3', 'acao-9', 'user-44', 'Carol')

    let queued = await peekAll()
    expect(queued.length).toBe(1)

    // Volta online + supabase devolve sucesso.
    setOnline(true)
    mockSupabaseState.upsertResult = {
      data: {
        comunicado_id: 'com-3',
        acao_id: 'acao-9',
        user_id: 'user-44',
        user_name: 'Carol',
        completed_at: '2026-05-11T10:00:00.000Z',
      },
      error: null,
    }

    // O service registra o handler no import-time; o beforeEach global chama
    // _resetProcessor() que limpa o map. Re-registramos manualmente um proxy
    // equivalente que invoca o mock do supabase (mesma chain do service).
    const { supabase } = await import('@/config/supabase')
    registerHandler('comunicado.completarAcao', async (payload) => {
      const { data, error } = await supabase
        .from('comunicado_acoes_completadas')
        .upsert(payload, { onConflict: 'comunicado_id,acao_id,user_id' })
        .select()
        .single()
      if (error) throw error
      return data
    })

    const flushResult = await flush()
    expect(flushResult.processed).toBe(1)
    expect(flushResult.failed).toBe(0)
    expect(mockSupabaseState.upsertCalls.length).toBe(1)

    queued = await peekAll()
    expect(queued.length).toBe(0)
  })
})

// ============================================================================
// Sprint 14a — Integração offline queue em comunicado.desfazerAcao
// ============================================================================

describe('comunicado.desfazerAcao integration', () => {
  function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => value,
    })
  }

  beforeEach(() => {
    mockSupabaseState.deleteResult = { error: null }
    mockSupabaseState.deleteCalls = []
    setOnline(true)
  })

  it('com navigator.onLine=false enfileira e retorna void (não chama Supabase)', async () => {
    setOnline(false)

    const result = await supabaseComunicadosService.desfazerAcao(
      'com-1',
      'acao-7',
      'user-42'
    )

    // Função é void.
    expect(result).toBeUndefined()

    // Supabase NÃO foi chamado.
    expect(mockSupabaseState.deleteCalls.length).toBe(0)

    // Fila tem 1 item com op + payload corretos.
    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('comunicado.desfazerAcao')
    expect(queued[0].payload).toEqual({
      comunicadoId: 'com-1',
      acaoId: 'acao-7',
      userId: 'user-42',
    })
  })

  it('com network error (não-RLS) cai no fallback enqueue e retorna void', async () => {
    mockSupabaseState.deleteResult = {
      error: { message: 'fetch failed' },
    }

    const result = await supabaseComunicadosService.desfazerAcao(
      'com-2',
      'acao-8',
      'user-43'
    )

    expect(result).toBeUndefined()

    // Tentativa direta de delete ocorreu.
    expect(mockSupabaseState.deleteCalls.length).toBe(1)

    // Fallback enfileirou.
    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('comunicado.desfazerAcao')
    expect(queued[0].payload).toEqual({
      comunicadoId: 'com-2',
      acaoId: 'acao-8',
      userId: 'user-43',
    })
  })

  it('flush executa o handler registrado e drena a fila quando online (idempotente)', async () => {
    // Enfileira offline.
    setOnline(false)
    await supabaseComunicadosService.desfazerAcao('com-3', 'acao-9', 'user-44')

    let queued = await peekAll()
    expect(queued.length).toBe(1)

    // Volta online; delete é idempotente, retorna error: null.
    setOnline(true)
    mockSupabaseState.deleteResult = { error: null }

    // Re-registra handler equivalente (vide nota no bloco anterior).
    const { supabase } = await import('@/config/supabase')
    registerHandler('comunicado.desfazerAcao', async (payload) => {
      const { error } = await supabase
        .from('comunicado_acoes_completadas')
        .delete()
        .eq('comunicado_id', payload.comunicadoId)
        .eq('acao_id', payload.acaoId)
        .eq('user_id', payload.userId)
      if (error) throw error
    })

    const flushResult = await flush()
    expect(flushResult.processed).toBe(1)
    expect(flushResult.failed).toBe(0)
    expect(mockSupabaseState.deleteCalls.length).toBe(1)

    queued = await peekAll()
    expect(queued.length).toBe(0)
  })
})

// ============================================================================
// Sprint 14a / F6.2 — integração com documento.recordAcknowledgement
// ============================================================================

describe('documento.recordAcknowledgement integration', () => {
  const docId = 'doc-123'
  const userInfo = {
    userId: 'user-abc',
    userName: 'Dr. Teste',
    userEmail: 'teste@anest.app',
  }

  // navigator.onLine é mutável (override via defineProperty). Sempre restore
  // depois pra não vazar entre testes.
  function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  }

  beforeEach(() => {
    setOnline(true)
  })

  it('quando offline (navigator.onLine=false), enfileira e retorna void sem chamar Supabase', async () => {
    setOnline(false)
    const { default: docService } = await import('@/services/supabaseDocumentService')

    const result = await docService.recordAcknowledgement(docId, userInfo)

    expect(result).toBeUndefined()
    expect(upsertMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()

    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('documento.recordAcknowledgement')
    expect(queued[0].payload).toMatchObject({
      docId,
      userId: userInfo.userId,
      userName: userInfo.userName,
      userEmail: userInfo.userEmail,
    })
    expect(queued[0].payload.timestamp).toBeDefined()
  })

  it('quando online + network error sem code, faz fallback enqueue', async () => {
    setOnline(true)
    upsertMock.mockResolvedValueOnce({ error: new Error('network failure') })
    const { default: docService } = await import('@/services/supabaseDocumentService')

    const result = await docService.recordAcknowledgement(docId, userInfo)

    expect(result).toBeUndefined()
    expect(upsertMock).toHaveBeenCalledTimes(1)
    // RPC nunca chega a rodar porque o upsert falhou antes.
    expect(rpcMock).not.toHaveBeenCalled()

    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('documento.recordAcknowledgement')
    expect(queued[0].payload.docId).toBe(docId)
  })

  it('quando online + sucesso, chama upsert e logAction (rpc) normalmente', async () => {
    setOnline(true)
    const { default: docService } = await import('@/services/supabaseDocumentService')

    await docService.recordAcknowledgement(docId, userInfo)

    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [row, opts] = upsertMock.mock.calls[0]
    expect(row).toMatchObject({
      documento_id: docId,
      user_id: userInfo.userId,
      user_name: userInfo.userName,
    })
    expect(row.reconhecido_em).toBeDefined()
    expect(row.visualizado_em).toBeDefined()
    expect(opts).toEqual({ onConflict: 'documento_id,user_id' })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith(
      'rpc_log_document_action',
      expect.objectContaining({
        p_documento_id: docId,
        p_action: 'acknowledged',
        p_user_id: userInfo.userId,
      })
    )

    const queued = await peekAll()
    expect(queued.length).toBe(0)
  })

  it('flush executa o handler registrado para documento.recordAcknowledgement', async () => {
    setOnline(false)
    const { supabase } = await import('@/config/supabase')
    const { default: docService } = await import('@/services/supabaseDocumentService')

    // Enfileira via path offline.
    await docService.recordAcknowledgement(docId, userInfo)
    const queued = await peekAll()
    expect(queued.length).toBe(1)
    expect(queued[0].op).toBe('documento.recordAcknowledgement')

    // beforeEach() limpa a Map do processor; em prod o registro persiste
    // pelo lifetime do módulo. Para testar flush real, re-registra um handler
    // que espelha `_doRecordAcknowledgement` (upsert + rpc_log_document_action).
    registerHandler('documento.recordAcknowledgement', async (payload) => {
      const { error } = await supabase
        .from('documento_distribuicao')
        .upsert(
          {
            documento_id: payload.docId,
            user_id: payload.userId,
            user_name: payload.userName,
            reconhecido_em: payload.timestamp,
            visualizado_em: payload.timestamp,
          },
          { onConflict: 'documento_id,user_id' }
        )
      if (error) throw error
      await supabase.rpc('rpc_log_document_action', {
        p_documento_id: payload.docId,
        p_action: 'acknowledged',
        p_user_id: payload.userId,
        p_user_name: payload.userName,
        p_user_email: payload.userEmail,
        p_changes: {},
        p_comment: '',
      })
    })

    // Volta online + flush.
    setOnline(true)
    upsertMock.mockResolvedValue({ error: null })
    rpcMock.mockResolvedValue({ error: null })

    const result = await flush()
    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledTimes(1)

    const remaining = await peekAll()
    expect(remaining.length).toBe(0)
  })
})
