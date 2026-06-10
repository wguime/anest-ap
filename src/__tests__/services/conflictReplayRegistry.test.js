/**
 * conflictReplayRegistry — coverage push (Wave 1.4)
 *
 * Registry simples (Map em escopo de módulo) com 5 exports públicos:
 *   registerReplayHandler, getReplayHandler, hasReplayHandler,
 *   listReplayHandlers, unregisterReplayHandler, _resetReplayRegistryForTests.
 *
 * Importante: o estado é compartilhado entre testes do mesmo módulo. Cada
 * teste chama `_resetReplayRegistryForTests` em beforeEach para isolar.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { registerReplayHandler, getReplayHandler, hasReplayHandler, listReplayHandlers, unregisterReplayHandler, _resetReplayRegistryForTests } from '@/services/conflictReplayRegistry'

describe('conflictReplayRegistry', () => {
  beforeEach(() => {
    _resetReplayRegistryForTests()
  })

  // --------------------------------------------------------------------------
  describe('registerReplayHandler', () => {
    it('registra handler válido sem throw', () => {
      const handler = async () => ({ ok: true })
      expect(() => registerReplayHandler('foo.bar', handler)).not.toThrow()
      expect(hasReplayHandler('foo.bar')).toBe(true)
    })

    it('sobrescreve handler quando registrado novamente para mesma op', () => {
      const h1 = async () => 'v1'
      const h2 = async () => 'v2'
      registerReplayHandler('op.x', h1)
      registerReplayHandler('op.x', h2)
      expect(getReplayHandler('op.x')).toBe(h2)
    })

    it('throw em opString não-string', () => {
      const handler = async () => {}
      expect(() => registerReplayHandler(null, handler)).toThrow(/string não-vazia/)
      expect(() => registerReplayHandler(123, handler)).toThrow(/string não-vazia/)
      expect(() => registerReplayHandler({}, handler)).toThrow(/string não-vazia/)
    })

    it('throw em opString vazia ou só espaços', () => {
      const handler = async () => {}
      expect(() => registerReplayHandler('', handler)).toThrow(/string não-vazia/)
      expect(() => registerReplayHandler('   ', handler)).toThrow(/string não-vazia/)
    })

    it('throw quando handler não é função', () => {
      expect(() => registerReplayHandler('op.y', null)).toThrow(/precisa ser função/)
      expect(() => registerReplayHandler('op.y', 'not-a-function')).toThrow(
        /precisa ser função/
      )
      expect(() => registerReplayHandler('op.y', {})).toThrow(/precisa ser função/)
    })
  })

  // --------------------------------------------------------------------------
  describe('getReplayHandler', () => {
    it('retorna handler registrado', () => {
      const handler = async () => 'result'
      registerReplayHandler('doc.ack', handler)
      expect(getReplayHandler('doc.ack')).toBe(handler)
    })

    it('retorna undefined para op não registrada', () => {
      expect(getReplayHandler('nope')).toBeUndefined()
    })
  })

  // --------------------------------------------------------------------------
  describe('hasReplayHandler', () => {
    it('retorna true para op registrada', () => {
      registerReplayHandler('a.b', async () => {})
      expect(hasReplayHandler('a.b')).toBe(true)
    })

    it('retorna false para op não registrada', () => {
      expect(hasReplayHandler('xyz')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  describe('listReplayHandlers', () => {
    it('retorna array vazio quando nada registrado', () => {
      expect(listReplayHandlers()).toEqual([])
    })

    it('retorna todos os op_strings registrados', () => {
      registerReplayHandler('a', async () => {})
      registerReplayHandler('b', async () => {})
      registerReplayHandler('c', async () => {})
      const list = listReplayHandlers()
      expect(list).toHaveLength(3)
      expect(list).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    })

    it('retorna nova array (não referência interna)', () => {
      registerReplayHandler('x', async () => {})
      const list = listReplayHandlers()
      list.push('mutation-externa')
      // Mutação externa não deve afetar o registry
      expect(listReplayHandlers()).toEqual(['x'])
    })
  })

  // --------------------------------------------------------------------------
  describe('unregisterReplayHandler', () => {
    it('remove handler e retorna true', () => {
      registerReplayHandler('to-remove', async () => {})
      expect(unregisterReplayHandler('to-remove')).toBe(true)
      expect(hasReplayHandler('to-remove')).toBe(false)
    })

    it('retorna false quando op não estava registrada', () => {
      expect(unregisterReplayHandler('never-existed')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  describe('_resetReplayRegistryForTests', () => {
    it('limpa todo o estado', () => {
      registerReplayHandler('a', async () => {})
      registerReplayHandler('b', async () => {})
      expect(listReplayHandlers()).toHaveLength(2)
      _resetReplayRegistryForTests()
      expect(listReplayHandlers()).toEqual([])
      expect(hasReplayHandler('a')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  describe('integração — handler invocável', () => {
    it('handler registrado é invocável com payload + userInfo', async () => {
      let invoked = null
      const handler = async (payload, userInfo) => {
        invoked = { payload, userInfo }
        return 'ok'
      }
      registerReplayHandler('test.op', handler)

      const result = await getReplayHandler('test.op')(
        { foo: 'bar' },
        { uid: 'u-1', displayName: 'Test' }
      )

      expect(result).toBe('ok')
      expect(invoked).toEqual({
        payload: { foo: 'bar' },
        userInfo: { uid: 'u-1', displayName: 'Test' },
      })
    })

    it('handler que joga erro propaga para o caller', async () => {
      registerReplayHandler('fails.op', async () => {
        throw new Error('boom')
      })
      await expect(getReplayHandler('fails.op')()).rejects.toThrow('boom')
    })
  })
})
