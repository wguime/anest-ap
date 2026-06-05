/**
 * Tests for src/utils/documentGrouping.js — Bloco 2 (unificação de taxonomia)
 *
 * Cobre:
 *   - CATEGORIA_CONFIG deriva dos 11 slugs do SSOT + catch-all "outros"
 *   - groupBySubcategoria agrupa por subcategoria conhecida
 *   - subcategoria nula/desconhecida (dilemas, trimestral) cai em "outros"
 *   - obsoletos vem do pool de arquivados
 *   - ordem fixa (00 Modelos → 10 Obsoletos → 99 Outros)
 *   - filterFn é aplicado dentro de cada bucket
 */
import { describe, it, expect } from 'vitest'
import { SUBCATEGORIA_CONFIG } from '../../types/documents'
import {
  CATEGORIA_CONFIG,
  KNOWN_SUBCATS,
  isKnownSubcat,
  groupBySubcategoria,
  bucketBySubcategoria,
} from '../../utils/documentGrouping'

const findBucket = (groups, categoria) => groups.find((g) => g.categoria === categoria)

describe('documentGrouping — CATEGORIA_CONFIG', () => {
  it('contém os 11 slugs do SSOT + catch-all "outros"', () => {
    const slugs = Object.keys(CATEGORIA_CONFIG)
    expect(slugs).toContain('outros')
    expect(slugs.length).toBe(Object.keys(SUBCATEGORIA_CONFIG).length + 1)
    for (const slug of Object.keys(SUBCATEGORIA_CONFIG)) {
      expect(CATEGORIA_CONFIG[slug]).toBeDefined()
      expect(CATEGORIA_CONFIG[slug].label).toBe(SUBCATEGORIA_CONFIG[slug].label)
    }
  })

  it('"outros" tem order 99 (sempre por último)', () => {
    expect(CATEGORIA_CONFIG.outros.order).toBe(99)
  })

  it('KNOWN_SUBCATS reflete os 11 slugs (sem "outros")', () => {
    expect(KNOWN_SUBCATS.has('modelos')).toBe(true)
    expect(KNOWN_SUBCATS.has('obsoletos')).toBe(true)
    expect(KNOWN_SUBCATS.has('outros')).toBe(false)
    expect(isKnownSubcat('dilemas')).toBe(false)
  })
})

describe('documentGrouping — groupBySubcategoria', () => {
  const activeDocs = [
    { id: 'a1', subcategoria: 'modelos', titulo: 'Modelo A' },
    { id: 'a2', subcategoria: 'governanca', titulo: 'Gov B' },
    { id: 'a3', subcategoria: 'dilemas', titulo: 'Ética dilemas' }, // desconhecida → outros
    { id: 'a4', subcategoria: 'trimestral', titulo: 'Relatório trimestral' }, // desconhecida → outros
    { id: 'a5', subcategoria: null, titulo: 'Sem subcat' }, // nula → outros
  ]
  const archivedDocs = [{ id: 'z1', subcategoria: 'obsoletos', titulo: 'Velho' }]

  it('agrupa docs ativos por subcategoria conhecida', () => {
    const groups = groupBySubcategoria({ activeDocs, archivedDocs })
    expect(findBucket(groups, 'modelos').documentos.map((d) => d.id)).toEqual(['a1'])
    expect(findBucket(groups, 'governanca').documentos.map((d) => d.id)).toEqual(['a2'])
  })

  it('joga subcategoria desconhecida (dilemas/trimestral) e nula em "outros"', () => {
    const groups = groupBySubcategoria({ activeDocs, archivedDocs })
    const outros = findBucket(groups, 'outros').documentos.map((d) => d.id)
    expect(outros).toEqual(expect.arrayContaining(['a3', 'a4', 'a5']))
    expect(outros).toHaveLength(3)
  })

  it('obsoletos vem do pool de arquivados, não dos ativos', () => {
    const groups = groupBySubcategoria({ activeDocs, archivedDocs })
    expect(findBucket(groups, 'obsoletos').documentos.map((d) => d.id)).toEqual(['z1'])
  })

  it('mantém ordem fixa: modelos primeiro, obsoletos antes de outros', () => {
    const groups = groupBySubcategoria({ activeDocs, archivedDocs })
    const orders = groups.map((g) => g.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    const idxObsoletos = groups.findIndex((g) => g.categoria === 'obsoletos')
    const idxOutros = groups.findIndex((g) => g.categoria === 'outros')
    expect(idxObsoletos).toBeLessThan(idxOutros)
    expect(groups[0].categoria).toBe('modelos')
  })

  it('aplica filterFn dentro de cada bucket', () => {
    const groups = groupBySubcategoria({
      activeDocs,
      archivedDocs,
      filterFn: (d) => d.titulo?.includes('A'),
    })
    expect(findBucket(groups, 'modelos').documentos.map((d) => d.id)).toEqual(['a1'])
    expect(findBucket(groups, 'governanca').documentos).toHaveLength(0)
  })

  it('é resiliente a entradas vazias', () => {
    const groups = groupBySubcategoria({})
    expect(groups.length).toBe(Object.keys(CATEGORIA_CONFIG).length)
    expect(groups.every((g) => g.documentos.length === 0)).toBe(true)
  })
})

describe('documentGrouping — bucketBySubcategoria (lista pré-filtrada)', () => {
  const docs = [
    { id: 'a1', subcategoria: 'modelos' },
    { id: 'a2', subcategoria: 'modelos' },
    { id: 'a3', subcategoria: 'governanca' },
    { id: 'a4', subcategoria: 'dilemas' }, // desconhecida → outros
    { id: 'a5', subcategoria: null }, // nula → outros
  ]

  it('descarta buckets vazios e preserva ordem fixa', () => {
    const groups = bucketBySubcategoria(docs)
    expect(groups.map((g) => g.categoria)).toEqual(['modelos', 'governanca', 'outros'])
  })

  it('agrupa por subcategoria e joga desconhecida/nula em outros', () => {
    const groups = bucketBySubcategoria(docs)
    const byCat = Object.fromEntries(groups.map((g) => [g.categoria, g.documentos.map((d) => d.id)]))
    expect(byCat.modelos).toEqual(['a1', 'a2'])
    expect(byCat.governanca).toEqual(['a3'])
    expect(byCat.outros).toEqual(['a4', 'a5'])
  })

  it('lista vazia → nenhum bucket', () => {
    expect(bucketBySubcategoria([])).toEqual([])
    expect(bucketBySubcategoria()).toEqual([])
  })
})
