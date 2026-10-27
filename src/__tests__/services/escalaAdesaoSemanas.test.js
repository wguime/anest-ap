import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('@/config/supabase', () => ({ supabase: { rpc: (...a) => mockRpc(...a) } }))

const { buscarAdesaoSemanas, lerCacheAdesao } = await import('@/services/escalaAdesaoService')

describe('buscarAdesaoSemanas', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    localStorage.clear()
  })

  it('pede as 5 semanas completas + as janelas antes/depois e devolve na ordem do gráfico', async () => {
    mockRpc.mockImplementation(async (fn, args) => (fn === 'escala_adesao_evolucao'
      ? { data: { gravado_ate: '2026-10-27' }, error: null }
      : { data: { desde: args.p_desde, ate: args.p_ate }, error: null }))
    const r = await buscarAdesaoSemanas(5)
    const periodos = mockRpc.mock.calls.filter(([fn]) => fn === 'escala_adesao_periodo').map(([, a]) => `${a.p_desde}..${a.p_ate}`)
    expect(periodos).toEqual([
      '2026-08-24..2026-09-20', // antes
      '2026-09-28..2026-10-25', // depois
      '2026-09-21..2026-09-27', '2026-09-28..2026-10-04', '2026-10-05..2026-10-11',
      '2026-10-12..2026-10-18', '2026-10-19..2026-10-25',
    ])
    expect(r.semanas.map((s) => s.desde)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'])
    expect(r.antes.desde).toBe('2026-08-24')
    expect(r.depois.ate).toBe('2026-10-25')
    expect(r.gravadoAte).toBe('2026-10-27')
    expect(lerCacheAdesao('semanas').dados).toEqual(r)
  })

  it('sem dia gravado: nada a buscar além da evolução', async () => {
    mockRpc.mockResolvedValue({ data: { gravado_ate: null }, error: null })
    expect(await buscarAdesaoSemanas()).toEqual({ semanas: [], antes: null, depois: null, gravadoAte: null })
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('erro numa semana derruba a busca (o hook mantém o cache e mostra o erro)', async () => {
    mockRpc.mockImplementation(async (fn) => (fn === 'escala_adesao_evolucao'
      ? { data: { gravado_ate: '2026-10-27' }, error: null }
      : { data: null, error: { message: 'período inválido' } }))
    await expect(buscarAdesaoSemanas()).rejects.toThrow('período inválido')
  })
})
