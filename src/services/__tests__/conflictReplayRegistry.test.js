/**
 * Sprint 15a / F6.3 closeout — conflictReplayRegistry tests
 *
 * Cobre: register/get/has/list/unregister + comportamento de overwrite
 * e validações de input.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  registerReplayHandler,
  getReplayHandler,
  hasReplayHandler,
  listReplayHandlers,
  unregisterReplayHandler,
  _resetReplayRegistryForTests,
} from '@/services/conflictReplayRegistry'

beforeEach(() => {
  _resetReplayRegistryForTests()
})

describe('registerReplayHandler + getReplayHandler', () => {
  it('retorna o handler exato que foi registrado', () => {
    const handler = vi.fn(async (payload) => ({ ok: true, payload }))
    registerReplayHandler('documento.recordAcknowledgement', handler)

    const got = getReplayHandler('documento.recordAcknowledgement')
    expect(got).toBe(handler)
  })

  it('retorna undefined quando nenhum handler está registrado', () => {
    expect(getReplayHandler('inexistente.op')).toBeUndefined()
  })
})

describe('hasReplayHandler', () => {
  it('retorna true depois de register, false antes', () => {
    expect(hasReplayHandler('comunicado.completarAcao')).toBe(false)
    registerReplayHandler('comunicado.completarAcao', async () => {})
    expect(hasReplayHandler('comunicado.completarAcao')).toBe(true)
  })

  it('volta para false depois de unregister', () => {
    registerReplayHandler('x.y', async () => {})
    expect(hasReplayHandler('x.y')).toBe(true)
    expect(unregisterReplayHandler('x.y')).toBe(true)
    expect(hasReplayHandler('x.y')).toBe(false)
  })

  it('unregister de op não-registrada retorna false', () => {
    expect(unregisterReplayHandler('nunca-existiu')).toBe(false)
  })
})

describe('registro duplicado', () => {
  it('sobrescreve handler existente silenciosamente (último vence)', () => {
    const first = vi.fn()
    const second = vi.fn()
    registerReplayHandler('op.x', first)
    registerReplayHandler('op.x', second)
    expect(getReplayHandler('op.x')).toBe(second)
    expect(getReplayHandler('op.x')).not.toBe(first)
  })
})

describe('validações de input', () => {
  it('throw se opString não for string não-vazia', () => {
    expect(() => registerReplayHandler('', () => {})).toThrow(/opString/)
    expect(() => registerReplayHandler('   ', () => {})).toThrow(/opString/)
    expect(() => registerReplayHandler(null, () => {})).toThrow(/opString/)
    expect(() => registerReplayHandler(123, () => {})).toThrow(/opString/)
  })

  it('throw se handler não for função', () => {
    expect(() => registerReplayHandler('op.x', null)).toThrow(/função/)
    expect(() => registerReplayHandler('op.x', 'string')).toThrow(/função/)
    expect(() => registerReplayHandler('op.x', {})).toThrow(/função/)
  })
})

describe('listReplayHandlers', () => {
  it('retorna lista vazia inicialmente', () => {
    expect(listReplayHandlers()).toEqual([])
  })

  it('retorna todas as ops registradas (ordem de inserção)', () => {
    registerReplayHandler('a.1', async () => {})
    registerReplayHandler('b.2', async () => {})
    registerReplayHandler('c.3', async () => {})
    expect(listReplayHandlers()).toEqual(['a.1', 'b.2', 'c.3'])
  })
})

describe('handler signature contract', () => {
  it('handler recebe (payload, userInfo) quando chamado pelo consumidor', async () => {
    const handler = vi.fn(async (_payload, _userInfo) => 'ok')
    registerReplayHandler('test.op', handler)

    const payload = { foo: 'bar' }
    const userInfo = { uid: 'u1', displayName: 'Admin' }
    const result = await getReplayHandler('test.op')(payload, userInfo)

    expect(result).toBe('ok')
    expect(handler).toHaveBeenCalledWith(payload, userInfo)
  })
})
