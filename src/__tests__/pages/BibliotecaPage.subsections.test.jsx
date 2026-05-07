/**
 * SubsectionsView — testes para o fix `ded6164` (subseções clicáveis).
 *
 * Bug original (W2-1, 1a973ac → eee6d71): Accordion controlado com
 * value={defaultOpen} mas SEM onValueChange — clique no trigger virava no-op
 * e cards não apareciam fora do modo forceOpen.
 *
 * Fix: state local openSubs + onValueChange={setOpenSubs}; key estável em
 * modo manual e force:<keys> em modo busca/filtro.
 *
 * Estes testes garantem que o comportamento clicável NÃO regrida em refactors
 * futuros — substitui validação manual no browser.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SubsectionsView } from '../../pages/BibliotecaPage.jsx'

// Mocks mínimos: DocumentoCard renderiza só o título para asserção fácil
vi.mock('@/components', () => ({
  DocumentoCard: ({ documento, onClick }) => (
    <button data-testid={`card-${documento.id}`} onClick={onClick}>
      {documento.titulo}
    </button>
  ),
}))

// Tooltip + Badge não relevantes (usados pelo DocumentoCard real, que está mocado)
vi.mock('@/design-system', async () => {
  const actual = await vi.importActual('@/design-system')
  return actual
})

// Helper: monta documentos válidos para categoria 'institucional'
function makeDocs() {
  return [
    { id: 'd1', titulo: 'Política de Privacidade', tipo: 'politicas', codigo: 'POL-001', versaoAtual: 1 },
    { id: 'd2', titulo: 'Política de Segurança',   tipo: 'politicas', codigo: 'POL-002', versaoAtual: 1 },
    { id: 'd3', titulo: 'Manual do Usuário',       tipo: 'manuais',   codigo: 'MAN-001', versaoAtual: 1 },
  ]
}

describe('SubsectionsView — clicabilidade (fix ded6164)', () => {
  it('inicia com todas subseções FECHADAS (cards escondidos) em modo manual', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )
    // Triggers visíveis
    expect(screen.getByText('Políticas')).toBeInTheDocument()
    expect(screen.getByText('Manuais')).toBeInTheDocument()
    // Cards escondidos
    expect(screen.queryByTestId('card-d1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-d3')).not.toBeInTheDocument()
  })

  it('clicar trigger ABRE a subseção e mostra os cards (regression test do bug W2-1)', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )

    // Antes do clique: cards escondidos
    expect(screen.queryByTestId('card-d1')).not.toBeInTheDocument()

    // Clica no trigger "Políticas"
    fireEvent.click(screen.getByText('Políticas'))

    // Cards de políticas aparecem
    expect(screen.getByTestId('card-d1')).toBeInTheDocument()
    expect(screen.getByTestId('card-d2')).toBeInTheDocument()
    // Mas card de manuais continua escondido (subseção fechada)
    expect(screen.queryByTestId('card-d3')).not.toBeInTheDocument()
  })

  it('clicar duas subseções diferentes mantém ambas abertas (type=multiple)', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )

    fireEvent.click(screen.getByText('Políticas'))
    fireEvent.click(screen.getByText('Manuais'))

    expect(screen.getByTestId('card-d1')).toBeInTheDocument()
    expect(screen.getByTestId('card-d3')).toBeInTheDocument()
  })

  it('clicar trigger aberto FECHA a subseção (toggle via aria-expanded)', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )

    const trigger = screen.getByText('Políticas').closest('button')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Toggle: aria-expanded flips imediatamente; AnimatePresence anima saída
    // do conteúdo (exit não completa em jsdom). Estado canônico = aria-expanded.
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicar card chama onDocClick com o documento correto', () => {
    const onDocClick = vi.fn()
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={onDocClick}
        forceOpen={false}
      />
    )

    fireEvent.click(screen.getByText('Políticas'))
    fireEvent.click(screen.getByTestId('card-d1'))

    expect(onDocClick).toHaveBeenCalledTimes(1)
    expect(onDocClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', titulo: 'Política de Privacidade' })
    )
  })

  it('forceOpen=true abre TUDO automaticamente (modo filtro/busca)', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={vi.fn()}
        forceOpen={true}
      />
    )

    // Sem clicar, todos os cards já visíveis
    expect(screen.getByTestId('card-d1')).toBeInTheDocument()
    expect(screen.getByTestId('card-d2')).toBeInTheDocument()
    expect(screen.getByTestId('card-d3')).toBeInTheDocument()
  })

  it('badges de contagem refletem documentos da subseção', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={makeDocs()}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )

    // "Políticas" tem 2 docs, "Manuais" tem 1
    const politicasRow = screen.getByText('Políticas').closest('button')
    const manuaisRow = screen.getByText('Manuais').closest('button')
    expect(within(politicasRow).getByText('2')).toBeInTheDocument()
    expect(within(manuaisRow).getByText('1')).toBeInTheDocument()
  })

  it('documentos sem subseção conhecida caem no bucket "Outros"', () => {
    const docs = [
      { id: 'd1', titulo: 'Doc Conhecido', tipo: 'politicas', codigo: 'POL-001', versaoAtual: 1 },
      { id: 'd2', titulo: 'Doc Estranho',  tipo: 'tipo_inexistente', codigo: 'X-001', versaoAtual: 1 },
    ]
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={docs}
        onDocClick={vi.fn()}
        forceOpen={true}
      />
    )

    expect(screen.getByText('Outros')).toBeInTheDocument()
    expect(screen.getByTestId('card-d2')).toBeInTheDocument()
  })

  it('lista vazia mostra mensagem "Nenhum documento nesta seção"', () => {
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={[]}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )

    expect(screen.getByText(/Nenhum documento nesta seção/i)).toBeInTheDocument()
  })

  it('subseções vazias não renderizam trigger (filtro silencioso)', () => {
    const docs = [
      { id: 'd1', titulo: 'Só Política', tipo: 'politicas', codigo: 'POL-001', versaoAtual: 1 },
    ]
    render(
      <SubsectionsView
        categoria="institucional"
        documentos={docs}
        onDocClick={vi.fn()}
        forceOpen={false}
      />
    )

    expect(screen.getByText('Políticas')).toBeInTheDocument()
    // "Manuais" não aparece porque não tem doc
    expect(screen.queryByText('Manuais')).not.toBeInTheDocument()
  })
})
