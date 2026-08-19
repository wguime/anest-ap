/**
 * ESCALADO PRESERVADO NO REPASSE (dono 19/08 — "a pessoa acaba os casos e
 * aparece liberado no meio da escala de liberações"): quem é do RODAPÉ e perde
 * o último caso do turno num repasse ficava idêntico a "nunca escalado" e a
 * fila o mostrava Liberado sozinho. O helper devolve as linhas que precisam do
 * marcador { escalado: true } (o mesmo do toggle manual) para seguirem ativas
 * na posição, aguardando a liberação NA ORDEM.
 */
import { describe, it, expect } from 'vitest'
import { escaladosPreservadosNoRepasse } from '../../pages/escala-cirurgica/utils'

const caso = (id, anestesista, extra = {}) => ({
  id, sala: 'SALA 4', ordem: 0, hora: '13:30', anestesista,
  semAnestesista: false, ...extra,
})

const escalaBase = {
  hospital: 'unimed',
  ordemLiberacao: { vespertino: ['DIEGO', 'GUILHERME MELO', 'RAUL'] },
  ajudaExterna: { vespertino: [] },
  liberacoes: {},
}

const repassa = (antes, ids, novoDono = { anestesista: 'MELO', anestesistaUserId: 'uid-gui' }) => {
  const idSet = new Set(ids)
  return antes.map((c) => (idSet.has(c.id) ? { ...c, ...novoDono } : c))
}

describe('escaladosPreservadosNoRepasse', () => {
  it('gente do rodapé que perdeu o ÚLTIMO caso do turno ganha o marcador escalado', () => {
    const antes = [caso('c1', 'DIEGO', { anestesistaUserId: 'uid-die' })]
    const depois = repassa(antes, ['c1'])
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1'], escalaBase))
      .toEqual([{ chave: 'uid-die', turno: 'vespertino' }])
  })

  it('quem ainda tem OUTRO caso no turno não precisa (a linha segue com o caso)', () => {
    const antes = [
      caso('c1', 'DIEGO', { anestesistaUserId: 'uid-die' }),
      caso('c2', 'DIEGO', { anestesistaUserId: 'uid-die', sala: 'CC - Sala 7' }),
    ]
    const depois = repassa(antes, ['c1'])
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1'], escalaBase)).toEqual([])
  })

  it('fora do rodapé fica de fora (é o caso do helper de ajuda, não deste)', () => {
    const antes = [caso('c1', 'STAUB', { anestesistaUserId: 'uid-sta' })]
    const depois = repassa(antes, ['c1'])
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1'], escalaBase)).toEqual([])
  })

  it('quem já tem marcação (liberado de verdade ou escalado) fica como está', () => {
    const antes = [caso('c1', 'DIEGO', { anestesistaUserId: 'uid-die' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, liberacoes: { 'vespertino:uid-die': { liberadoEm: '2026-08-19T15:00:00Z' } } }
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1'], escala)).toEqual([])
  })

  it('grafia torta do caso ainda casa com o rodapé, e a CHAVE sai da convenção das marcações', () => {
    // caso "GUILHERME M ELO" (Vision) × rodapé "GUILHERME MELO": sem resolver, a
    // chave é o nome normalizado DO RODAPÉ (é a chave que a linha lê)
    const antes = [caso('c1', 'GUILHERME M ELO')]
    const depois = repassa(antes, ['c1'], { anestesista: 'DIEGO', anestesistaUserId: 'uid-die' })
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1'], escalaBase))
      .toEqual([{ chave: 'GUILHERME MELO', turno: 'vespertino' }])
  })

  it('com resolver, a chave é o uid do vínculo (a mesma da linha na fila)', () => {
    const antes = [caso('c1', 'GUILHERME M ELO')]
    const depois = repassa(antes, ['c1'], { anestesista: 'DIEGO', anestesistaUserId: 'uid-die' })
    const resolverUid = (n) => (/MELO/.test(String(n)) ? 'uid-gui' : null)
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1'], escalaBase, { resolverUid }))
      .toEqual([{ chave: 'uid-gui', turno: 'vespertino' }])
  })

  it('sala compartilhada "A + B" e caso "?" ficam de fora', () => {
    const antes = [caso('c1', 'DIEGO + RAUL'), caso('c2', '?', { semAnestesista: true })]
    const depois = repassa(antes, ['c1', 'c2'])
    expect(escaladosPreservadosNoRepasse(antes, depois, ['c1', 'c2'], escalaBase)).toEqual([])
  })
})
