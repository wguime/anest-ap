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
import { describe, it, expect } from 'vitest'
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
// paralelo. Quem pede junto divide a leitura; quem pede depois busca de novo.
describe('fetchAliases — leitura em voo compartilhada', () => {
  const leituras = () => supabase.from.mock.calls.filter(([t]) => t === 'escala_anestesista_alias').length

  it('pedidos simultâneos dividem UMA leitura, cada um com a sua lista', async () => {
    supabase.from.mockClear()
    const [a, b] = await Promise.all([svc.fetchAliases(), svc.fetchAliases()])
    expect(leituras()).toBe(1)
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })

  it('pedido depois que a resposta chegou busca de novo (refresh após gravar apelido)', async () => {
    supabase.from.mockClear()
    await svc.fetchAliases()
    await svc.fetchAliases()
    expect(leituras()).toBe(2)
  })
})
