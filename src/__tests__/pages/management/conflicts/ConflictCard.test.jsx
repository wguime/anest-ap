/**
 * Sprint 14b / F6.3 — ConflictCard tests
 *
 * Cobre:
 *  - render básico com status pending mostra 4 botões
 *  - render com status resolved mostra "Ver historico" e esconde ações primárias
 *  - click em "Aplicar minha versao" dispara onApplyMine
 *  - click em "Manter do servidor" dispara onKeepServer
 *  - click em "Descartar" dispara onDismiss
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock DS para evitar transitive supabase import via showcase exports
vi.mock('@/design-system', async () => {
  const React = await import('react')
  return {
    Card: ({ children, className }) =>
      React.createElement('div', { className, 'data-testid': 'card' }, children),
    CardContent: ({ children, className }) =>
      React.createElement('div', { className }, children),
    Badge: ({ children, variant, className }) =>
      React.createElement(
        'span',
        { 'data-variant': variant, className },
        children
      ),
  }
})

import ConflictCard from '../../../../pages/management/conflicts/ConflictCard.jsx'

const baseConflict = {
  id: 'c-1',
  opId: 'op-abc-123',
  opString: 'documento.recordAcknowledgement',
  userId: 'firebase-uid-xyz',
  userName: 'Joao Silva',
  payload: { foo: 'bar', count: 2 },
  serverState: { foo: 'baz', count: 3 },
  status: 'pending',
  resolvedBy: null,
  resolvedAt: null,
  resolutionNotes: null,
  createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min atras
}

describe('ConflictCard', () => {
  it('renderiza 4 acoes quando status=pending', () => {
    const handlers = {
      onApplyMine: vi.fn(),
      onKeepServer: vi.fn(),
      onResolveOpen: vi.fn(),
      onDismiss: vi.fn(),
    }
    render(<ConflictCard conflict={baseConflict} {...handlers} />)

    expect(screen.getByRole('button', { name: /Aplicar minha vers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manter do servidor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resolver/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descartar conflito/i })).toBeInTheDocument()
  })

  it('mostra payload e server_state no preview', () => {
    render(
      <ConflictCard
        conflict={baseConflict}
        onApplyMine={vi.fn()}
        onKeepServer={vi.fn()}
        onResolveOpen={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    // payload key:value
    expect(screen.getAllByText(/foo: bar/).length).toBeGreaterThan(0)
    // server key:value
    expect(screen.getAllByText(/foo: baz/).length).toBeGreaterThan(0)
  })

  it('click em "Aplicar minha versao" dispara onApplyMine', () => {
    const onApplyMine = vi.fn()
    render(
      <ConflictCard
        conflict={baseConflict}
        onApplyMine={onApplyMine}
        onKeepServer={vi.fn()}
        onResolveOpen={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Aplicar minha vers/i }))
    expect(onApplyMine).toHaveBeenCalledTimes(1)
  })

  it('click em "Manter do servidor" dispara onKeepServer', () => {
    const onKeepServer = vi.fn()
    render(
      <ConflictCard
        conflict={baseConflict}
        onApplyMine={vi.fn()}
        onKeepServer={onKeepServer}
        onResolveOpen={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Manter do servidor/i }))
    expect(onKeepServer).toHaveBeenCalledTimes(1)
  })

  it('click em "Descartar" dispara onDismiss', () => {
    const onDismiss = vi.fn()
    render(
      <ConflictCard
        conflict={baseConflict}
        onApplyMine={vi.fn()}
        onKeepServer={vi.fn()}
        onResolveOpen={vi.fn()}
        onDismiss={onDismiss}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Descartar conflito/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('click em "Resolver" dispara onResolveOpen', () => {
    const onResolveOpen = vi.fn()
    render(
      <ConflictCard
        conflict={baseConflict}
        onApplyMine={vi.fn()}
        onKeepServer={vi.fn()}
        onResolveOpen={onResolveOpen}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Resolver/i }))
    expect(onResolveOpen).toHaveBeenCalledTimes(1)
  })

  it('renderiza "Ver historico" e esconde acoes primarias quando status=resolved_manual', () => {
    const resolvedConflict = {
      ...baseConflict,
      status: 'resolved_manual',
      resolvedBy: 'admin-uid',
      resolvedAt: new Date().toISOString(),
      resolutionNotes: 'Resolvido pelo admin',
    }
    const onViewHistory = vi.fn()
    render(
      <ConflictCard
        conflict={resolvedConflict}
        onApplyMine={vi.fn()}
        onKeepServer={vi.fn()}
        onResolveOpen={vi.fn()}
        onDismiss={vi.fn()}
        onViewHistory={onViewHistory}
      />
    )
    expect(screen.getByRole('button', { name: /Ver historico/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aplicar minha vers/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Descartar conflito/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver historico/i }))
    expect(onViewHistory).toHaveBeenCalledTimes(1)
  })

  it('mostra "(sem snapshot do servidor)" quando serverState eh null', () => {
    const noServer = { ...baseConflict, serverState: null }
    render(
      <ConflictCard
        conflict={noServer}
        onApplyMine={vi.fn()}
        onKeepServer={vi.fn()}
        onResolveOpen={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText(/sem snapshot do servidor/i)).toBeInTheDocument()
  })
})
