/**
 * Comparativo por ano (Mapa de Férias) — no desktop a grade é FLUIDA.
 *
 * Dono 11/09 ("ajuste para visualização em desktop"): a célula fixa de 12px
 * deixava 52 semanas em 777px, 60% de um card de 1370px. Escolheu por imagem
 * (`.tmp/ferias-comparativo-desktop.html`) a variante A: colunas iguais que
 * ocupam o card e célula quadrada. O celular não muda — 12px com rolagem.
 *
 * jsdom não aplica media query, então a trava é nas CLASSES: a linha da régua
 * e a de cada ano carregam o mesmo `desktop:grid` com `var(--semanas)` (é o que
 * mantém meses e semanas alinhados sem conta), a variável vem do dado (53
 * semanas em ano que as tem) e a célula perde a largura fixa só no desktop.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HeatmapPlurianual } from '@/pages/ferias/MapaFeriasView'

const serie = (n, media = 2) => Array.from({ length: n }, () => ({ media }))

describe('HeatmapPlurianual — grade fluida no desktop', () => {
  it('régua e linhas de ano usam a MESMA grade de colunas por semana', () => {
    const { container } = render(
      <HeatmapPlurianual seriesPorAno={{ 2025: serie(52), 2026: serie(53, 6) }} />
    )
    const linhas = [...container.querySelectorAll('.desktop\\:grid')]
    expect(linhas).toHaveLength(3) // régua + 2 anos
    for (const l of linhas) {
      expect(l.className).toContain('desktop:grid-cols-[2rem_repeat(var(--semanas),minmax(0,1fr))]')
      expect(l.className).toContain('flex') // o celular continua flex de 12px
    }
    // --semanas vem do dado: o ano de 53 semanas manda
    expect(container.firstChild.style.getPropertyValue('--semanas')).toBe('53')
  })

  it('célula: 12px fixos no celular, quadrada e fluida só no desktop', () => {
    const { container } = render(<HeatmapPlurianual seriesPorAno={{ 2026: serie(52) }} />)
    const celulas = container.querySelectorAll('span[title^="2026 semana"]')
    expect(celulas).toHaveLength(52)
    const c = celulas[0].className
    expect(c).toContain('h-3')
    expect(c).toContain('w-3')
    expect(c).toContain('desktop:w-auto')
    expect(c).toContain('desktop:h-auto')
    expect(c).toContain('desktop:aspect-square')
  })
})
