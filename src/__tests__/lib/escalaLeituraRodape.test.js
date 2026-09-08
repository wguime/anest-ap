/**
 * Releitura automática quando a ordem de liberação vem vazia (08/09/2026).
 *
 * A foto do HRO lida sem a dica do hospital devolveu 15 casos e rodapé vazio,
 * e a escala foi publicada com a aba Liberações sem ninguém. A mesma foto lida
 * com as regras do HRO trouxe os 26 casos e os 17 nomes. O predicado aqui é o
 * que decide reler UMA vez com a dica do hospital que a própria leitura
 * detectou — e o que NÃO deve reler: leitura cortada (tratamento próprio),
 * leitura que já foi com dica, Materno (não tem rodapé).
 */
import { describe, it, expect } from 'vitest'
import { precisaRelerComHint, rodapeAusente } from '@/lib/escalaLeituraRodape'

describe('rodapeAusente', () => {
  it('só HRO e Unimed, e só sem nenhum nome', () => {
    expect(rodapeAusente('hro', [])).toBe(true)
    expect(rodapeAusente('unimed', undefined)).toBe(true)
    expect(rodapeAusente('hro', ['ALINE'])).toBe(false)
    expect(rodapeAusente('materno', [])).toBe(false)
    expect(rodapeAusente('', [])).toBe(false)
  })
})

describe('precisaRelerComHint', () => {
  it('HRO detectado, sem dica, sem rodapé, sem corte → relê', () => {
    expect(precisaRelerComHint({ hospitalDetectado: 'hro', ordemLiberacao: [], truncado: false, hint: '' })).toBe(true)
  })

  it('já veio com dica: não relê (a releitura é o próprio caminho da dica)', () => {
    expect(precisaRelerComHint({ hospitalDetectado: 'hro', ordemLiberacao: [], truncado: false, hint: 'hro' })).toBe(false)
  })

  it('leitura cortada não relê — o corte tem aviso e tratamento próprios', () => {
    expect(precisaRelerComHint({ hospitalDetectado: 'hro', ordemLiberacao: [], truncado: true, hint: '' })).toBe(false)
  })

  it('com rodapé, ou Materno, ou hospital não detectado: não relê', () => {
    expect(precisaRelerComHint({ hospitalDetectado: 'unimed', ordemLiberacao: ['CURY'], truncado: false, hint: '' })).toBe(false)
    expect(precisaRelerComHint({ hospitalDetectado: 'materno', ordemLiberacao: [], truncado: false, hint: '' })).toBe(false)
    expect(precisaRelerComHint({ hospitalDetectado: '', ordemLiberacao: [], truncado: false, hint: '' })).toBe(false)
    expect(precisaRelerComHint()).toBe(false)
  })
})
