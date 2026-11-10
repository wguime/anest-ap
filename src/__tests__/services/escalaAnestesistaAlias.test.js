/**
 * ehApelidoDePessoa — guardrail do incidente 02/09.
 *
 * A conferência aprende apelido→login sozinha quando o texto importado do bloco
 * é desconhecido do dicionário. Nem todo texto é apelido: "GABRIELA + ?" é uma
 * DUPLA com o segundo nome ainda por decidir. Aprendê-lo como apelido do Oscar
 * (que foi quem o dono escolheu naquela sala) rebatizou o Oscar em TODO o app —
 * `fetchAliases` ordena por apelido e o roster usa `apelidos[0]` como rótulo, e
 * "GABRIELA + ?" vem antes de "OSCAR". A partir daí toda escrita do responsável
 * gravava o texto errado e o quadro seguia mostrando a colega antiga.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import svc, { ehApelidoDePessoa, normApelido } from '@/services/supabaseEscalaAnestesistaService'
import { supabase } from '@/config/supabase'

describe('ehApelidoDePessoa', () => {
  it('aceita apelido de gente, com ou sem sobrenome e com o prefixo PED', () => {
    expect(ehApelidoDePessoa('GARIM')).toBe(true)
    expect(ehApelidoDePessoa('Guilherme Staub')).toBe(true)
    expect(ehApelidoDePessoa('PED EDUARDO')).toBe(true)
  })

  it('recusa DUPLA — os quatro que chegaram a entrar no dicionário de produção', () => {
    for (const texto of ['GABRIELA + ?', 'RAQUEL + GABRIELA', 'MARILIO + GABRIEL', 'FERNANDO + FERNANDA']) {
      expect(ehApelidoDePessoa(texto)).toBe(false)
    }
  })

  it('recusa a ausência declarada ("?") e a herança ("//")', () => {
    expect(ehApelidoDePessoa('?')).toBe(false)
    expect(ehApelidoDePessoa('//')).toBe(false)
    expect(ehApelidoDePessoa('')).toBe(false)
    expect(ehApelidoDePessoa(null)).toBe(false)
  })

  it('julga o texto NORMALIZADO — "ped gabriela + ?" não escapa pela caixa', () => {
    expect(normApelido('ped gabriela + ?')).toBe('GABRIELA + ?')
    expect(ehApelidoDePessoa('ped gabriela + ?')).toBe(false)
  })
})

// Abertura da escala (15/10/2026): cada useRosterAnestesistas busca o dicionário
// ao montar e a página monta dois ao mesmo tempo — eram leituras idênticas em
// paralelo. Desde 09/11 a resposta vale por 5 min (eram 99 mil leituras de uma
// tabela que muda poucas vezes por mês) e gravar/remover invalida na hora.
describe('fetchAliases — leitura compartilhada e cache de 5 min', () => {
  const leituras = () => supabase.from.mock.calls.filter(([t]) => t === 'escala_anestesista_alias').length
  beforeEach(() => { svc.invalidarAliases(); supabase.from.mockClear(); vi.useRealTimers() })

  it('pedidos simultâneos dividem UMA leitura', async () => {
    const [a, b] = await Promise.all([svc.fetchAliases(), svc.fetchAliases()])
    expect(leituras()).toBe(1)
    expect(a).toEqual(b)
  })

  it('pedido seguinte reaproveita a resposta — MESMA referência, sem ir ao banco', async () => {
    const a = await svc.fetchAliases()
    const b = await svc.fetchAliases()
    expect(leituras()).toBe(1)
    expect(b).toBe(a)
    expect(svc.aliasesEmCache()).toBe(a)
  })

  it('forcar busca de novo (refresh manual)', async () => {
    await svc.fetchAliases()
    await svc.fetchAliases({ forcar: true })
    expect(leituras()).toBe(2)
  })

  it('gravar ou remover apelido invalida: a leitura seguinte vai ao banco', async () => {
    await svc.fetchAliases()
    await svc.removeAlias(1)
    expect(svc.aliasesEmCache()).toBeNull()
    supabase.from.mockClear()
    await svc.fetchAliases()
    expect(leituras()).toBe(1)
  })

  it('depois de 5 min a resposta vence', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await svc.fetchAliases()
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1)
    expect(svc.aliasesEmCache()).toBeNull()
    await svc.fetchAliases()
    expect(leituras()).toBe(2)
    vi.useRealTimers()
  })
})
