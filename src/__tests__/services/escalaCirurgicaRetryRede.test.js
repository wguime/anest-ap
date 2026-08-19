/**
 * Retry de REDE do updateAnestesistaCasos (dono 19/08).
 *
 * Em produção o "Definir anestesista" falhou com "TypeError: Load failed"
 * (Safari/5G do hospital): a requisição nem alcançou o Postgres — o
 * postgrest-js devolve a queda de fetch como { error } SEM code. Como o update
 * é idempotente (mesmos valores nos mesmos ids), o service repete UMA vez
 * antes de subir o erro. Recusa REAL do servidor (RLS, constraint) tem code e
 * NUNCA repete — o erro sobe na primeira para o rollback otimista do context.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { inMock } = vi.hoisted(() => ({ inMock: vi.fn() }))
vi.mock('@/config/supabase', () => ({
  supabase: { from: vi.fn(() => ({ update: vi.fn(() => ({ in: inMock })) })) },
}))

import svc from '@/services/supabaseEscalaCirurgicaService'

const erroRede = { message: 'TypeError: Load failed', code: '' }

beforeEach(() => {
  inMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('updateAnestesistaCasos — blip de rede repete uma vez', () => {
  it('rede caiu na 1ª tentativa: repete e conclui sem erro', async () => {
    inMock.mockResolvedValueOnce({ error: erroRede }).mockResolvedValueOnce({ error: null })
    await svc.updateAnestesistaCasos(['c1'], { uid: 'u1', apelido: 'GIOVANA' })
    expect(inMock).toHaveBeenCalledTimes(2)
  })

  it('recusa do Postgres (com code) NÃO repete — o erro sobe na primeira', async () => {
    inMock.mockResolvedValueOnce({ error: { message: 'permission denied', code: '42501' } })
    await expect(svc.updateAnestesistaCasos(['c1'], { uid: 'u1', apelido: 'GIOVANA' }))
      .rejects.toThrow('permission denied')
    expect(inMock).toHaveBeenCalledTimes(1)
  })

  it('rede caiu nas DUAS tentativas: o erro sobe (context reverte + toasta)', async () => {
    inMock.mockResolvedValue({ error: erroRede })
    await expect(svc.updateAnestesistaCasos(['c1'], { uid: 'u1', apelido: 'GIOVANA' }))
      .rejects.toThrow('Load failed')
    expect(inMock).toHaveBeenCalledTimes(2)
  })
})
