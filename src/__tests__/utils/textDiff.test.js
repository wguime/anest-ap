import { describe, it, expect } from 'vitest'
import { diffTextLines, diffTextWords, buildUnifiedPatch, compactHunks } from '../../utils/textDiff.js'

describe('diffTextLines', () => {
  it('retorna hasChanges=false quando textos são iguais', () => {
    const { summary } = diffTextLines('linha1\nlinha2', 'linha1\nlinha2')
    expect(summary.hasChanges).toBe(false)
    expect(summary.addedLines).toBe(0)
    expect(summary.removedLines).toBe(0)
  })

  it('detecta linha adicionada', () => {
    const { hunks, summary } = diffTextLines('a\nb', 'a\nb\nc')
    expect(summary.hasChanges).toBe(true)
    expect(summary.addedLines).toBeGreaterThanOrEqual(1)
    expect(hunks.some((h) => h.added && h.value.includes('c'))).toBe(true)
  })

  it('detecta linha removida', () => {
    const { hunks, summary } = diffTextLines('a\nb\nc', 'a\nc')
    expect(summary.hasChanges).toBe(true)
    expect(summary.removedLines).toBeGreaterThanOrEqual(1)
    expect(hunks.some((h) => h.removed && h.value.includes('b'))).toBe(true)
  })

  it('lida com texto vazio em ambos os lados', () => {
    const { summary } = diffTextLines('', '')
    expect(summary.hasChanges).toBe(false)
  })

  it('lida com texto vazio em um dos lados', () => {
    const { summary } = diffTextLines('', 'novo conteúdo')
    expect(summary.hasChanges).toBe(true)
    expect(summary.addedLines).toBeGreaterThan(0)
  })

  it('aceita inputs não-string sem crashar', () => {
    const { summary } = diffTextLines(null, undefined)
    expect(summary.hasChanges).toBe(false)
  })

  it('ignoreWhitespace=true (default) trata espaços extras como iguais', () => {
    const { summary } = diffTextLines('linha1', '   linha1   ')
    expect(summary.hasChanges).toBe(false)
  })
})

describe('diffTextWords', () => {
  it('retorna array com campo added/removed por palavra', () => {
    const result = diffTextWords('o gato preto', 'o cachorro preto')
    const removed = result.filter((p) => p.removed).map((p) => p.value).join('')
    const added = result.filter((p) => p.added).map((p) => p.value).join('')
    expect(removed).toContain('gato')
    expect(added).toContain('cachorro')
  })
})

describe('buildUnifiedPatch', () => {
  it('gera patch string com header e marcadores +/-', () => {
    const patch = buildUnifiedPatch('doc.pdf', 'antiga', 'nova', 'v1', 'v2')
    expect(patch).toContain('doc.pdf')
    expect(patch).toContain('-antiga')
    expect(patch).toContain('+nova')
  })
})

describe('compactHunks', () => {
  it('mantém hunks com mudança intactos', () => {
    const hunks = [
      { value: 'a\nb\nc', added: false, removed: false, count: 3 },
      { value: 'novo', added: true, removed: false, count: 1 },
      { value: 'd\ne\nf', added: false, removed: false, count: 3 },
    ]
    const out = compactHunks(hunks, 1)
    const changed = out.find((h) => h.added)
    expect(changed).toBeDefined()
    expect(changed.value).toBe('novo')
  })

  it('comprime hunks unchanged grandes entre mudanças', () => {
    const hunks = [
      { value: 'change-a', added: true, removed: false, count: 1 },
      { value: 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8', added: false, removed: false, count: 8 },
      { value: 'change-b', added: true, removed: false, count: 1 },
    ]
    const out = compactHunks(hunks, 2)
    const middle = out[1]
    expect(middle.value).toContain('...')
    // mantém 2 linhas de cada lado
    expect(middle.value).toContain('l1')
    expect(middle.value).toContain('l8')
  })

  it('aceita input não-array', () => {
    expect(compactHunks(null)).toEqual([])
    expect(compactHunks(undefined)).toEqual([])
  })
})
