import { describe, it, expect } from 'vitest'
import { curadoriaAtiva, ordenarDestaques } from '@/lib/noticiasDestaques'

const AGORA = new Date('2026-08-15T12:00:00-03:00')

const base = (over = {}) => ({
  id: over.id || 'x',
  finalScore: 0,
  publicadoEm: '2026-08-01T00:00:00Z',
  ...over,
})

describe('curadoriaAtiva', () => {
  it('ativa quando curadoriaPor setado e prazo no futuro', () => {
    const n = base({ curadoriaPor: 'Dr. Humberto Hepp', curadoriaDestaqueAte: '2026-09-14T23:59:59-03:00' })
    expect(curadoriaAtiva(n, AGORA)).toBe(true)
  })

  it('inativa com prazo vencido — depois de 30 dias o artigo volta ao ranking normal', () => {
    const n = base({ curadoriaPor: 'Dr. Humberto Hepp', curadoriaDestaqueAte: '2026-08-14T00:00:00-03:00' })
    expect(curadoriaAtiva(n, AGORA)).toBe(false)
  })

  it('inativa sem curadoriaPor, sem prazo, com data inválida ou noticia null', () => {
    expect(curadoriaAtiva(base({ curadoriaDestaqueAte: '2026-09-14T00:00:00Z' }), AGORA)).toBe(false)
    expect(curadoriaAtiva(base({ curadoriaPor: 'X' }), AGORA)).toBe(false)
    expect(curadoriaAtiva(base({ curadoriaPor: 'X', curadoriaDestaqueAte: 'lixo' }), AGORA)).toBe(false)
    expect(curadoriaAtiva(null, AGORA)).toBe(false)
  })
})

describe('ordenarDestaques', () => {
  it('curadoria ativa vem antes mesmo com finalScore menor que o top heurístico', () => {
    const curado = base({ id: 'curado', finalScore: 0.1, curadoriaPor: 'Dr. Humberto Hepp', curadoriaDestaqueAte: '2026-09-14T23:59:59-03:00' })
    const top = base({ id: 'top', finalScore: 0.95 })
    expect(ordenarDestaques([top, curado], AGORA).map((n) => n.id)).toEqual(['curado', 'top'])
  })

  it('curadoria vencida NÃO fura a fila — cai para a ordenação por score', () => {
    const vencido = base({ id: 'vencido', finalScore: 0.1, curadoriaPor: 'X', curadoriaDestaqueAte: '2026-07-01T00:00:00Z' })
    const top = base({ id: 'top', finalScore: 0.95 })
    expect(ordenarDestaques([vencido, top], AGORA).map((n) => n.id)).toEqual(['top', 'vencido'])
  })

  it('entre curados, mais recente primeiro; sem curadoria, score desc e data desc como desempate', () => {
    const c1 = base({ id: 'c1', publicadoEm: '2026-08-01T00:00:00Z', curadoriaPor: 'X', curadoriaDestaqueAte: '2026-09-14T00:00:00Z' })
    const c2 = base({ id: 'c2', publicadoEm: '2026-08-11T00:00:00Z', curadoriaPor: 'X', curadoriaDestaqueAte: '2026-09-14T00:00:00Z' })
    const a = base({ id: 'a', finalScore: 0.5, publicadoEm: '2026-08-02T00:00:00Z' })
    const b = base({ id: 'b', finalScore: 0.5, publicadoEm: '2026-08-09T00:00:00Z' })
    expect(ordenarDestaques([a, c1, b, c2], AGORA).map((n) => n.id)).toEqual(['c2', 'c1', 'b', 'a'])
  })

  it('não muta a lista original e tolera lista vazia/null', () => {
    const lista = [base({ id: '1' }), base({ id: '2', finalScore: 1 })]
    const copia = [...lista]
    ordenarDestaques(lista, AGORA)
    expect(lista).toEqual(copia)
    expect(ordenarDestaques([], AGORA)).toEqual([])
    expect(ordenarDestaques(null, AGORA)).toEqual([])
  })

  it('finalScore null é tratado como 0 (artigo recém-importado pelo cron)', () => {
    const semScore = base({ id: 'sem', finalScore: null })
    const comScore = base({ id: 'com', finalScore: 0.2 })
    expect(ordenarDestaques([semScore, comScore], AGORA).map((n) => n.id)).toEqual(['com', 'sem'])
  })
})
