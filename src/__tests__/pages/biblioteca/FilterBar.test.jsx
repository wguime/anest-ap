/**
 * FilterBar (Biblioteca) — Sprint 12 / F4 UI Tags
 *
 * Cobre o novo facet de Tags adicionado ao FilterBar.jsx:
 * - chip "Tags" só renderiza quando há availableTags
 * - clicar uma opção emite onTagsChange com array contendo o slug
 * - múltiplas tags selecionadas viram filtro AND no consumidor (testado
 *   indiretamente via callback array)
 * - clear all reseta tags
 *
 * Os outros facets (Tipo/Status/Vencimento) já existiam pré-Sprint 12;
 * estes testes não cobrem regressão neles (escopo cirúrgico).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '../../../pages/biblioteca/FilterBar.jsx'

const baseProps = {
  tipo: [],
  onTipoChange: vi.fn(),
  status: [],
  onStatusChange: vi.fn(),
  vencimento: [],
  onVencimentoChange: vi.fn(),
  onClearAll: vi.fn(),
}

describe('FilterBar — facet de Tags (Sprint 12 / F4)', () => {
  it('não renderiza facet Tags quando availableTags está vazio', () => {
    render(<FilterBar {...baseProps} availableTags={[]} tags={[]} onTagsChange={vi.fn()} />)
    expect(screen.queryByLabelText(/Filtrar por Tags/i)).not.toBeInTheDocument()
  })

  it('não renderiza facet Tags quando onTagsChange é undefined (compat com chamadas antigas)', () => {
    render(<FilterBar {...baseProps} availableTags={[{ value: 'compliance', label: 'Compliance (3)' }]} />)
    expect(screen.queryByLabelText(/Filtrar por Tags/i)).not.toBeInTheDocument()
  })

  it('renderiza facet Tags com availableTags + onTagsChange', () => {
    render(
      <FilterBar
        {...baseProps}
        availableTags={[
          { value: 'compliance', label: 'Compliance (3)' },
          { value: 'seguranca', label: 'Seguranca (1)' },
        ]}
        tags={[]}
        onTagsChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Filtrar por Tags/i)).toBeInTheDocument()
  })

  it('seleciona uma tag via clique no checkbox e dispara onTagsChange', () => {
    const onTagsChange = vi.fn()
    render(
      <FilterBar
        {...baseProps}
        availableTags={[
          { value: 'compliance', label: 'Compliance (3)' },
          { value: 'seguranca', label: 'Seguranca (1)' },
        ]}
        tags={[]}
        onTagsChange={onTagsChange}
      />
    )

    // Abre o popover do facet Tags
    fireEvent.click(screen.getByLabelText(/Filtrar por Tags/i))

    // Clica no checkbox "Compliance (3)"
    fireEvent.click(screen.getByText(/Compliance \(3\)/i))

    expect(onTagsChange).toHaveBeenCalledWith(['compliance'])
  })

  it('rotulo do trigger atualiza para "Tags: N" quando há tags selecionadas', () => {
    render(
      <FilterBar
        {...baseProps}
        availableTags={[
          { value: 'compliance', label: 'Compliance (3)' },
          { value: 'seguranca', label: 'Seguranca (1)' },
        ]}
        tags={['compliance', 'seguranca']}
        onTagsChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Filtrar por Tags/i).textContent).toMatch(/Tags: 2/)
  })

  it('botão "Limpar filtros" aparece quando há tag selecionada', () => {
    const onClearAll = vi.fn()
    render(
      <FilterBar
        {...baseProps}
        onClearAll={onClearAll}
        availableTags={[{ value: 'compliance', label: 'Compliance (3)' }]}
        tags={['compliance']}
        onTagsChange={vi.fn()}
      />
    )
    const clearBtn = screen.getByRole('button', { name: /Limpar todos os filtros/i })
    fireEvent.click(clearBtn)
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('toggle remove tag já selecionada', () => {
    const onTagsChange = vi.fn()
    render(
      <FilterBar
        {...baseProps}
        availableTags={[{ value: 'compliance', label: 'Compliance (3)' }]}
        tags={['compliance']}
        onTagsChange={onTagsChange}
      />
    )

    fireEvent.click(screen.getByLabelText(/Filtrar por Tags/i))
    // Com tag selecionada, texto aparece no trigger ("Tags: Compliance (3)")
    // E também no checkbox da popover. Pegamos o checkbox via role.
    const checkbox = screen.getByRole('checkbox', { name: /Compliance \(3\)/i })
    fireEvent.click(checkbox)

    expect(onTagsChange).toHaveBeenCalledWith([])
  })
})
