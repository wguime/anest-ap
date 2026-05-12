/**
 * Sprint 14b / F6.3 — ConflictsTab tests
 *
 * Cobre:
 *  - render lista 3 conflitos quando hook retorna 3
 *  - empty state quando hook retorna 0
 *  - chips quick-filter alteram filtro (pendentes → resolvidos)
 *  - click em "Aplicar minha versao" chama resolveLastWriteWins com userInfo correto
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ==========================
// Mocks
// ==========================

const mockResolveLastWriteWins = vi.fn().mockResolvedValue({})
const mockResolveManual = vi.fn().mockResolvedValue({})
const mockDismiss = vi.fn().mockResolvedValue({})
const mockSubscribe = vi.fn(() => () => {})

vi.mock('@/services/supabaseConflictQueueService', () => ({
  resolveLastWriteWins: (...args) => mockResolveLastWriteWins(...args),
  resolveManual: (...args) => mockResolveManual(...args),
  dismiss: (...args) => mockDismiss(...args),
  subscribeToConflicts: (cb) => mockSubscribe(cb),
  fetchAll: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
}))

let conflictsState = []

vi.mock('@/hooks/useConflicts', () => {
  return {
    default: ({ status }) => {
      // Para o badge de contagem de pendentes, queremos sempre retornar todos
      // pendentes; quando o componente chama com status filtrado, retornamos
      // o subset apropriado.
      const filtered =
        status === 'pending'
          ? conflictsState.filter((c) => c.status === 'pending')
          : status
          ? conflictsState.filter((c) => c.status === status)
          : conflictsState
      return {
        rows: filtered,
        total: filtered.length,
        loading: false,
        error: null,
        refetch: vi.fn(),
      }
    },
    useConflicts: ({ status }) => {
      const filtered =
        status === 'pending'
          ? conflictsState.filter((c) => c.status === 'pending')
          : status
          ? conflictsState.filter((c) => c.status === status)
          : conflictsState
      return {
        rows: filtered,
        total: filtered.length,
        loading: false,
        error: null,
        refetch: vi.fn(),
      }
    },
  }
})

const toastMock = vi.fn()

vi.mock('@/design-system', async () => {
  const React = await import('react')
  return {
    Card: ({ children, className }) =>
      React.createElement('div', { className, 'data-testid': 'card' }, children),
    CardContent: ({ children, className }) =>
      React.createElement('div', { className }, children),
    Badge: ({ children, variant, ...rest }) =>
      React.createElement(
        'span',
        { 'data-variant': variant, 'data-testid': rest['data-testid'] },
        children
      ),
    Select: ({ value, onChange, options, placeholder }) =>
      React.createElement(
        'select',
        {
          value: value ?? '',
          onChange: (e) => onChange(e.target.value),
          'aria-label': placeholder || 'select',
        },
        options.map((o) =>
          React.createElement('option', { key: o.value, value: o.value }, o.label)
        )
      ),
    Modal: ({ open, children, title }) =>
      open
        ? React.createElement('div', { role: 'dialog', 'aria-label': title }, [
            React.createElement('h2', { key: 'h' }, title),
            children,
          ])
        : null,
    useToast: () => ({ toast: toastMock }),
  }
})

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { uid: 'admin-uid-1', displayName: 'Admin Tester' },
  }),
}))

// window.confirm sempre confirma nos testes
beforeEach(() => {
  mockResolveLastWriteWins.mockClear()
  mockResolveManual.mockClear()
  mockDismiss.mockClear()
  toastMock.mockClear()
  conflictsState = []
  window.confirm = vi.fn(() => true)
})

// Import after mocks
import ConflictsTab from '../../../../pages/management/conflicts/ConflictsTab.jsx'

const makeConflict = (id, overrides = {}) => ({
  id,
  opId: `op-${id}`,
  opString: 'documento.recordAcknowledgement',
  userId: `firebase-uid-${id}`,
  userName: `Usuario ${id}`,
  payload: { foo: 'bar' },
  serverState: { foo: 'baz' },
  status: 'pending',
  resolvedBy: null,
  resolvedAt: null,
  resolutionNotes: null,
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  ...overrides,
})

describe('ConflictsTab', () => {
  it('renderiza lista com 3 conflitos quando hook retorna 3 pendentes', () => {
    conflictsState = [makeConflict('1'), makeConflict('2'), makeConflict('3')]
    render(<ConflictsTab />)
    // Cada card tem o nome do usuário
    expect(screen.getByText(/Usuario 1/)).toBeInTheDocument()
    expect(screen.getByText(/Usuario 2/)).toBeInTheDocument()
    expect(screen.getByText(/Usuario 3/)).toBeInTheDocument()
  })

  it('mostra empty state quando nao ha conflitos pendentes', () => {
    conflictsState = []
    render(<ConflictsTab />)
    expect(screen.getByText(/Nenhum conflito pendente/i)).toBeInTheDocument()
  })

  it('chip "Resolvidos" altera o filtro e mostra resolvidos', () => {
    conflictsState = [
      makeConflict('1'),
      makeConflict('r1', { status: 'resolved_manual' }),
    ]
    render(<ConflictsTab />)
    // Default = pendentes → vê Usuario 1, não vê Usuario r1
    expect(screen.getByText(/Usuario 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Usuario r1/)).not.toBeInTheDocument()

    // Click chip Resolvidos
    fireEvent.click(screen.getByTestId('chip-resolved'))

    // Agora deve mostrar Usuario r1
    expect(screen.getByText(/Usuario r1/)).toBeInTheDocument()
  })

  it('click em "Aplicar minha versao" chama resolveLastWriteWins com userInfo correto', async () => {
    conflictsState = [makeConflict('1')]
    render(<ConflictsTab />)

    const applyBtn = screen.getByRole('button', { name: /Aplicar minha vers/i })
    fireEvent.click(applyBtn)

    // Aguarda microtask para a promise resolver
    await new Promise((r) => setTimeout(r, 0))

    expect(mockResolveLastWriteWins).toHaveBeenCalledTimes(1)
    const [conflictId, userInfo] = mockResolveLastWriteWins.mock.calls[0]
    expect(conflictId).toBe('1')
    expect(userInfo).toEqual({
      uid: 'admin-uid-1',
      displayName: 'Admin Tester',
    })
  })

  it('click em "Manter do servidor" chama resolveManual com nota padrao', async () => {
    conflictsState = [makeConflict('1')]
    render(<ConflictsTab />)

    fireEvent.click(screen.getByRole('button', { name: /Manter do servidor/i }))
    await new Promise((r) => setTimeout(r, 0))

    expect(mockResolveManual).toHaveBeenCalledTimes(1)
    const [conflictId, notes, userInfo] = mockResolveManual.mock.calls[0]
    expect(conflictId).toBe('1')
    expect(notes).toMatch(/Manter vers.o do servidor/)
    expect(userInfo.uid).toBe('admin-uid-1')
  })

  it('click em "Descartar" chama dismiss apos confirm', async () => {
    conflictsState = [makeConflict('1')]
    render(<ConflictsTab />)

    fireEvent.click(screen.getByRole('button', { name: /Descartar conflito/i }))
    await new Promise((r) => setTimeout(r, 0))

    expect(window.confirm).toHaveBeenCalled()
    expect(mockDismiss).toHaveBeenCalledTimes(1)
    const [conflictId, userInfo] = mockDismiss.mock.calls[0]
    expect(conflictId).toBe('1')
    expect(userInfo.uid).toBe('admin-uid-1')
  })

  it('badge de pendentes mostra contagem correta', () => {
    conflictsState = [
      makeConflict('1'),
      makeConflict('2'),
      makeConflict('r1', { status: 'resolved_manual' }),
    ]
    render(<ConflictsTab />)
    const badge = screen.getByTestId('conflicts-pending-badge')
    expect(badge).toHaveTextContent(/2 pendente/)
  })
})
