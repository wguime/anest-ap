import { describe, it, expect } from 'vitest'
import { hexComAlpha } from '../../lib/corAlpha'

describe('hexComAlpha — 15% da cor sem color-mix()', () => {
  it('#RRGGBB vira rgba com o alfa pedido', () => {
    expect(hexComAlpha('#6366F1', 0.15)).toBe('rgba(99, 102, 241, 0.15)')
    expect(hexComAlpha('#004225', 1)).toBe('rgba(0, 66, 37, 1)')
  })
  it('#RGB expande; alfa fora de [0,1] é limitado', () => {
    expect(hexComAlpha('#fff', 2)).toBe('rgba(255, 255, 255, 1)')
    expect(hexComAlpha('#000', -1)).toBe('rgba(0, 0, 0, 0)')
  })
  it('o que não é hex volta como veio (var, hsl, nome, nulo)', () => {
    expect(hexComAlpha('var(--x)', 0.15)).toBe('var(--x)')
    expect(hexComAlpha('hsl(1 2% 3%)', 0.15)).toBe('hsl(1 2% 3%)')
    expect(hexComAlpha(undefined, 0.15)).toBeUndefined()
  })
})
