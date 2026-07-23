/**
 * aplicarAtribuicoes — CAUSA RAIZ dos erros 23/07 (Exames 3×PAULO, IOSC 3×CURY):
 * a atribuição POR SALA sobrescrevia TODAS as linhas e apagava os anestesistas
 * POR LINHA dos blocos multi (Exames/Umanitá/IOSC). Regra nova: linha com nome
 * PRÓPRIO explícito ≠ nome-base da sala NUNCA é sobrescrita (resolve o próprio
 * uid pelo dicionário).
 */
import { describe, it, expect } from 'vitest'
import { aplicarAtribuicoes } from '../../pages/escala-cirurgica/utils'

const apelidoDe = (_sala, uid) => `APELIDO-${uid}`
const resolver = (nome) => ({ PAULO: 'uid-paulo', COSTA: 'uid-costa', MAURICIO: 'uid-mauricio' }[String(nome).trim().toUpperCase()] || null)

describe('aplicarAtribuicoes', () => {
  it('sala uniforme: atribuição sobrescreve todas as linhas (reatribuição Janaina→Cury)', () => {
    const casos = [
      { sala: 'CC - Sala 5', anestesista: 'JANAINA' },
      { sala: 'CC - Sala 5', anestesista: '//' },
      { sala: 'CC - Sala 5', anestesista: '' },
    ]
    const out = aplicarAtribuicoes(casos, { 'CC - Sala 5': 'uid-cury' }, apelidoDe, resolver)
    expect(out.every((c) => c.anestesistaUserId === 'uid-cury')).toBe(true)
    expect(out.every((c) => c.anestesista === 'APELIDO-uid-cury')).toBe(true)
  })

  it('bloco multi (Exames/IOSC): linha com nome PRÓPRIO ≠ base NÃO é sobrescrita', () => {
    const casos = [
      { sala: 'Exames', anestesista: 'PAULO', bloco: 'exames' },     // base
      { sala: 'Exames', anestesista: 'COSTA', bloco: 'exames' },     // própria
      { sala: 'Exames', anestesista: 'MAURICIO', bloco: 'exames' },  // própria
    ]
    const out = aplicarAtribuicoes(casos, { Exames: 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].anestesista).toBe('APELIDO-uid-paulo')      // base recebe a atribuição
    expect(out[0].anestesistaUserId).toBe('uid-paulo')
    expect(out[1].anestesista).toBe('COSTA')                  // própria: preservada
    expect(out[1].anestesistaUserId).toBe('uid-costa')        // uid resolvido pelo dicionário
    expect(out[2].anestesista).toBe('MAURICIO')
    expect(out[2].anestesistaUserId).toBe('uid-mauricio')
  })

  it('linha própria com uid já vindo da extração mantém o uid (não re-resolve)', () => {
    const casos = [
      { sala: 'IOSC', anestesista: 'CURY' },
      { sala: 'IOSC', anestesista: 'MELO', anestesistaUserId: 'uid-melo-extraido' },
    ]
    const out = aplicarAtribuicoes(casos, { IOSC: 'uid-cury' }, apelidoDe, resolver)
    expect(out[1].anestesista).toBe('MELO')
    expect(out[1].anestesistaUserId).toBe('uid-melo-extraido')
  })

  it('linha própria sem match no dicionário fica sem uid (nunca herda o da sala)', () => {
    const casos = [
      { sala: 'IOSC', anestesista: 'CURY' },
      { sala: 'IOSC', anestesista: 'NOME DESCONHECIDO' },
    ]
    const out = aplicarAtribuicoes(casos, { IOSC: 'uid-cury' }, apelidoDe, resolver)
    expect(out[1].anestesistaUserId).toBeNull()
    expect(out[1].anestesista).toBe('NOME DESCONHECIDO')
  })

  it('sem atribuição: preserva textos e uids como vieram', () => {
    const casos = [{ sala: 'Sala 1', anestesista: 'TIAGO', anestesistaUserId: 'uid-t' }]
    const out = aplicarAtribuicoes(casos, {}, apelidoDe, resolver)
    expect(out[0].anestesista).toBe('TIAGO')
    expect(out[0].anestesistaUserId).toBe('uid-t')
  })

  it('compat: 4º parâmetro ausente não quebra (linha própria fica sem uid)', () => {
    const casos = [
      { sala: 'Exames', anestesista: 'PAULO' },
      { sala: 'Exames', anestesista: 'COSTA' },
    ]
    const out = aplicarAtribuicoes(casos, { Exames: 'uid-paulo' }, apelidoDe)
    expect(out[1].anestesista).toBe('COSTA')
    expect(out[1].anestesistaUserId).toBeNull()
  })
})
