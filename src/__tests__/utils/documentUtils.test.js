import { describe, it, expect } from 'vitest'
import {
  countDocsBySubcategoria,
  findOrphanDocs,
  buildCategoriaRows,
} from '../../utils/documentUtils.js'
import { SUBCATEGORIA_SLUGS } from '../../types/documents.js'

describe('countDocsBySubcategoria', () => {
  it('retorna 0 em todas as subcategorias quando array vazio', () => {
    const c = countDocsBySubcategoria([])
    for (const s of SUBCATEGORIA_SLUGS) expect(c[s]).toBe(0)
    expect(c.__sem_subcategoria).toBe(0)
  })

  it('soma docs ativos por subcategoria válida', () => {
    const c = countDocsBySubcategoria([
      { subcategoria: 'assistencial', status: 'ativo' },
      { subcategoria: 'ASSISTENCIAL', status: 'vigente' },
      { subcategoria: 'qualidade', status: 'ativo' },
    ])
    expect(c.assistencial).toBe(2)
    expect(c.qualidade).toBe(1)
    expect(c.__sem_subcategoria).toBe(0)
  })

  it('exclui docs arquivados', () => {
    const c = countDocsBySubcategoria([
      { subcategoria: 'assistencial', status: 'arquivado' },
      { subcategoria: 'assistencial', status: 'ativo' },
    ])
    expect(c.assistencial).toBe(1)
  })

  it('agrega NULL e subcategoria inválida em __sem_subcategoria', () => {
    const c = countDocsBySubcategoria([
      { subcategoria: null, status: 'ativo' },
      { subcategoria: undefined, status: 'ativo' },
      { subcategoria: 'biblioteca_documentos', status: 'ativo' },
      { subcategoria: '', status: 'ativo' },
    ])
    expect(c.__sem_subcategoria).toBe(4)
  })

  it('aceita inputs não-array sem crashar', () => {
    expect(countDocsBySubcategoria(null).__sem_subcategoria).toBe(0)
    expect(countDocsBySubcategoria(undefined).__sem_subcategoria).toBe(0)
  })
})

describe('findOrphanDocs', () => {
  it('retorna docs sem subcategoria válida (não-arquivados)', () => {
    const docs = [
      { id: 'a', subcategoria: null, status: 'ativo' },
      { id: 'b', subcategoria: 'assistencial', status: 'ativo' },
      { id: 'c', subcategoria: 'invalida', status: 'ativo' },
      { id: 'd', subcategoria: null, status: 'arquivado' },
    ]
    const orphans = findOrphanDocs(docs)
    expect(orphans.map((d) => d.id).sort()).toEqual(['a', 'c'])
  })
})

describe('buildCategoriaRows', () => {
  it('retorna 11 linhas mesmo com count=0', () => {
    const rows = buildCategoriaRows([])
    expect(rows.length).toBe(11)
    expect(rows.every((r) => r.count === 0)).toBe(true)
    expect(rows[0].order).toBe(1)
    expect(rows[10].order).toBe(11)
  })

  it('preserva ordem fixa por order', () => {
    const rows = buildCategoriaRows([])
    const orders = rows.map((r) => r.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('inclui linha "__sem_subcategoria" quando includeOrphans=true e há órfãos', () => {
    const docs = [{ subcategoria: null, status: 'ativo' }]
    const rows = buildCategoriaRows(docs, { includeOrphans: true })
    const orphan = rows.find((r) => r.id === '__sem_subcategoria')
    expect(orphan).toBeDefined()
    expect(orphan.count).toBe(1)
    expect(orphan.isOrphan).toBe(true)
  })

  it('não inclui linha órfã quando count=0 mesmo com includeOrphans=true', () => {
    const rows = buildCategoriaRows(
      [{ subcategoria: 'assistencial', status: 'ativo' }],
      { includeOrphans: true }
    )
    expect(rows.find((r) => r.id === '__sem_subcategoria')).toBeUndefined()
  })
})
