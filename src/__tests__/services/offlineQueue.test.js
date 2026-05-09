// Sprint 10 / F6.2 — testa offlineQueue + offlineQueueProcessor.
// Roda sob jsdom + fake-indexeddb (devDep). Substitui o smoke
// scripts/smoke-pwa-offline.mjs para o trecho de queue (cache-hit do SW
// é validado manualmente — exige browser real, fora do escopo unit).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import {
  setIDBFactory,
  enqueue,
  peekAll,
  remove,
  markFailed,
  clearAll,
  _resetForTests as _resetQueue,
} from '@/utils/offlineQueue'

import {
  registerHandler,
  flush,
  _resetForTests as _resetProcessor,
} from '@/services/offlineQueueProcessor'

beforeEach(() => {
  // Cada teste recebe IDB fresca + handlers limpos.
  setIDBFactory(new IDBFactory())
  _resetQueue()
  _resetProcessor()
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
    expect(result).toEqual({ processed: 2, failed: 0, skipped: 0 })
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
    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 })

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
