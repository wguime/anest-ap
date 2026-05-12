/**
 * Sprint 16 / F6.3 polish — ResolveModal + DiffViewer integration
 *
 * Cobre:
 *  - Accordion "Ver diff" visível por default (fechado)
 *  - Click no summary expande e mostra rows do DiffViewer
 *  - server_state=null (rota legacy) → renderiza sem crash + header
 *    "Servidor não disponível"
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock DS Modal para evitar transitive supabase imports via showcase
vi.mock('@/design-system', async () => {
  const React = await import('react')
  return {
    Modal: ({ open, children, title, description, footer }) =>
      open
        ? React.createElement(
            'div',
            { role: 'dialog', 'aria-label': title },
            [
              React.createElement('h2', { key: 'title' }, title),
              description &&
                React.createElement('p', { key: 'desc' }, description),
              React.createElement('div', { key: 'body' }, children),
              footer && React.createElement('div', { key: 'footer' }, footer),
            ]
          )
        : null,
  }
})

import ResolveModal from '../../../pages/management/conflicts/ResolveModal.jsx'

const baseConflict = {
  id: 'c-1',
  opId: 'op-abc-123',
  opString: 'comunicado.completarAcao',
  userId: 'u-1',
  userName: 'Maria Souza',
  payload: { acaoId: 'acao-1', status: 'completed' },
  serverState: { acaoId: 'acao-1', status: 'pending', revisao: 2 },
  status: 'pending',
  createdAt: new Date().toISOString(),
}

describe('ResolveModal + DiffViewer integration', () => {
  it('renderiza summary "Ver diff" visível (accordion fechado por default)', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={baseConflict}
        onSubmit={vi.fn()}
      />
    )
    // Summary visível
    expect(screen.getByText(/ver diff/i)).toBeInTheDocument()
  })

  it('expande accordion ao clicar no summary; mostra rows do DiffViewer', () => {
    const { container } = render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={baseConflict}
        onSubmit={vi.fn()}
      />
    )

    const details = container.querySelector('details')
    expect(details).toBeTruthy()
    expect(details.hasAttribute('open')).toBe(false)

    // Simula click no summary expandindo o details
    const summary = details.querySelector('summary')
    fireEvent.click(summary)
    // jsdom não toggla automaticamente; setamos manualmente para validar conteúdo
    details.open = true

    // A região do diff existe
    expect(
      screen.getByRole('region', {
        name: /comparação entre sua versão e versão do servidor/i,
      })
    ).toBeInTheDocument()

    // Rows com estados esperados
    // 'acaoId' same (acao-1 == acao-1)
    expect(container.querySelector('[data-diff-state="same"]')).toBeTruthy()
    // 'status' diff (completed vs pending)
    expect(container.querySelector('[data-diff-state="diff"]')).toBeTruthy()
    // 'revisao' only-right (apenas no servidor)
    expect(container.querySelector('[data-diff-state="only-right"]')).toBeTruthy()
  })

  it('renderiza sem crash quando serverState === null + mostra "Servidor não disponível"', () => {
    const conflictNullServer = { ...baseConflict, serverState: null }
    const { container } = render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflictNullServer}
        onSubmit={vi.fn()}
      />
    )

    // Não crashou — modal segue renderizado
    expect(screen.getAllByText(/Resolver conflito/i).length).toBeGreaterThan(0)

    // Expande accordion p/ verificar conteúdo
    const details = container.querySelector('details')
    expect(details).toBeTruthy()
    details.open = true

    // Header "Servidor não disponível" presente
    expect(
      screen.getAllByText(/servidor não disponível/i).length
    ).toBeGreaterThan(0)

    // Sem only-right / diff / same — todas as chaves devem ser only-left
    expect(
      container.querySelector('[data-diff-state="only-right"]')
    ).toBeNull()
    const onlyLeftRows = container.querySelectorAll('[data-diff-state="only-left"]')
    expect(onlyLeftRows.length).toBe(Object.keys(baseConflict.payload).length)
  })
})
