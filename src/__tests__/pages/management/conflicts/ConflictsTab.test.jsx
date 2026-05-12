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
const mockResolveLastWriteWinsWithReplay = vi
  .fn()
  .mockResolvedValue({ success: true, replayed: true, row: {} })
const mockResolveManual = vi.fn().mockResolvedValue({})
const mockDismiss = vi.fn().mockResolvedValue({})
const mockSubscribe = vi.fn(() => () => {})

// Sprint 15a / F6.3 closeout (A4) — ReplayFailedError stub para testar
// caminho de erro em `handleApplyMine`. Declarada DENTRO da factory de mock
// porque `vi.mock` é hoisted (cannot access top-level var antes do init).
vi.mock('@/services/supabaseConflictQueueService', () => {
  class ReplayFailedError extends Error {
    constructor(originalError, opString) {
      super(`Replay falhou para op "${opString}": ${originalError?.message}`)
      this.name = 'ReplayFailedError'
      this.originalError = originalError
      this.opString = opString
    }
  }
  return {
    resolveLastWriteWins: (...args) => mockResolveLastWriteWins(...args),
    resolveLastWriteWinsWithReplay: (...args) =>
      mockResolveLastWriteWinsWithReplay(...args),
    resolveManual: (...args) => mockResolveManual(...args),
    dismiss: (...args) => mockDismiss(...args),
    subscribeToConflicts: (cb) => mockSubscribe(cb),
    fetchAll: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    ReplayFailedError,
  }
})

// Sprint 15a / F6.3 closeout (A2.b) — mocka helper de download CSV
const mockDownloadConflictsCsv = vi.fn()
vi.mock('@/utils/conflictsToCsv', () => ({
  downloadConflictsCsv: (...args) => mockDownloadConflictsCsv(...args),
  conflictsToCsv: vi.fn(() => 'csv-stub'),
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
  mockResolveLastWriteWinsWithReplay.mockClear()
  mockResolveLastWriteWinsWithReplay.mockResolvedValue({
    success: true,
    replayed: true,
    row: {},
  })
  mockResolveManual.mockClear()
  mockDismiss.mockClear()
  mockDownloadConflictsCsv.mockClear()
  toastMock.mockClear()
  conflictsState = []
  window.confirm = vi.fn(() => true)
})

// Import after mocks
import ConflictsTab from '../../../../pages/management/conflicts/ConflictsTab.jsx'
import { ReplayFailedError as MockedReplayFailedError } from '@/services/supabaseConflictQueueService'

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

  it('click em "Aplicar minha versao" chama resolveLastWriteWinsWithReplay com userInfo correto (A4)', async () => {
    conflictsState = [makeConflict('1')]
    render(<ConflictsTab />)

    const applyBtn = screen.getByRole('button', { name: /Aplicar minha vers/i })
    fireEvent.click(applyBtn)

    // Aguarda microtask para a promise resolver
    await new Promise((r) => setTimeout(r, 0))

    // Sprint 15a / F6.3 closeout (A4) — agora chama o handler com replay.
    expect(mockResolveLastWriteWinsWithReplay).toHaveBeenCalledTimes(1)
    expect(mockResolveLastWriteWins).not.toHaveBeenCalled()
    const [conflictId, userInfo] =
      mockResolveLastWriteWinsWithReplay.mock.calls[0]
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

  // ============================================================================
  // Sprint 15a / F6.3 closeout (A4) — handleApplyMine com replay + toast feedback
  // ============================================================================
  describe('handleApplyMine — replay feedback (A4)', () => {
    it('result.replayed=true → toast success com "re-aplicada"', async () => {
      conflictsState = [makeConflict('1')]
      mockResolveLastWriteWinsWithReplay.mockResolvedValueOnce({
        success: true,
        replayed: true,
        row: {},
      })
      render(<ConflictsTab />)

      fireEvent.click(screen.getByRole('button', { name: /Aplicar minha vers/i }))
      await new Promise((r) => setTimeout(r, 0))

      expect(toastMock).toHaveBeenCalled()
      const toastArg = toastMock.mock.calls[0][0]
      expect(toastArg.variant).toBe('success')
      expect(toastArg.description).toMatch(/re-aplicada/i)
    })

    it('result.fallback=true → toast info com "sem replay"', async () => {
      conflictsState = [makeConflict('1')]
      mockResolveLastWriteWinsWithReplay.mockResolvedValueOnce({
        success: true,
        replayed: false,
        fallback: true,
        row: {},
      })
      render(<ConflictsTab />)

      fireEvent.click(screen.getByRole('button', { name: /Aplicar minha vers/i }))
      await new Promise((r) => setTimeout(r, 0))

      expect(toastMock).toHaveBeenCalled()
      const toastArg = toastMock.mock.calls[0][0]
      expect(toastArg.variant).toBe('info')
      expect(toastArg.description).toMatch(/sem replay/i)
    })

    it('throw ReplayFailedError → toast error com originalError.message + sugestao', async () => {
      conflictsState = [makeConflict('1')]
      const originalErr = new Error('unique violation')
      mockResolveLastWriteWinsWithReplay.mockRejectedValueOnce(
        new MockedReplayFailedError(
          originalErr,
          'documento.recordAcknowledgement'
        )
      )
      render(<ConflictsTab />)

      fireEvent.click(screen.getByRole('button', { name: /Aplicar minha vers/i }))
      await new Promise((r) => setTimeout(r, 0))

      expect(toastMock).toHaveBeenCalled()
      const toastArg = toastMock.mock.calls[0][0]
      expect(toastArg.variant).toBe('error')
      expect(toastArg.title).toMatch(/Replay falhou/i)
      expect(toastArg.description).toMatch(/unique violation/)
      // Sugestao de alternativa para o admin
      expect(toastArg.description).toMatch(/Manter|Descartar/i)
    })

    it('throw erro generico (não ReplayFailedError) → toast error com message', async () => {
      conflictsState = [makeConflict('1')]
      mockResolveLastWriteWinsWithReplay.mockRejectedValueOnce(
        new Error('network down')
      )
      render(<ConflictsTab />)

      fireEvent.click(screen.getByRole('button', { name: /Aplicar minha vers/i }))
      await new Promise((r) => setTimeout(r, 0))

      expect(toastMock).toHaveBeenCalled()
      const toastArg = toastMock.mock.calls[0][0]
      expect(toastArg.variant).toBe('error')
      // Cai no branch genérico, NÃO no branch ReplayFailedError.
      expect(toastArg.title).toMatch(/Erro ao resolver/i)
      expect(toastArg.description).toMatch(/network down/)
    })
  })

  // ============================================================================
  // Sprint 15a / F6.3 closeout (A2.b) — Botão Exportar CSV
  // ============================================================================
  describe('Exportar CSV', () => {
    it('botão "Exportar CSV (N)" reflete tamanho do filtered set atual', () => {
      conflictsState = [makeConflict('1'), makeConflict('2'), makeConflict('3')]
      render(<ConflictsTab />)

      const btn = screen.getByTestId('conflicts-export-csv')
      // 3 conflitos pendentes, filtro default = pendentes
      expect(btn).toHaveTextContent(/\(3\)/)
    })

    it('click chama downloadConflictsCsv com o filtered set', async () => {
      conflictsState = [makeConflict('a'), makeConflict('b')]
      render(<ConflictsTab />)

      const btn = screen.getByTestId('conflicts-export-csv')
      fireEvent.click(btn)
      await new Promise((r) => setTimeout(r, 0))

      expect(mockDownloadConflictsCsv).toHaveBeenCalledTimes(1)
      const [rowsArg] = mockDownloadConflictsCsv.mock.calls[0]
      // Apenas os 2 pendentes (filtro default)
      expect(rowsArg).toHaveLength(2)
      expect(rowsArg[0].id).toBe('a')
      expect(rowsArg[1].id).toBe('b')
    })

    it('botão fica disabled quando filtered set é vazio', () => {
      conflictsState = []
      render(<ConflictsTab />)
      const btn = screen.getByTestId('conflicts-export-csv')
      expect(btn).toBeDisabled()
      expect(btn).toHaveTextContent(/\(0\)/)
    })

    it('N reflete o filtered set ao trocar de chip (Resolvidos mostra só resolvidos)', () => {
      conflictsState = [
        makeConflict('p1'),
        makeConflict('p2'),
        makeConflict('r1', { status: 'resolved_manual' }),
      ]
      render(<ConflictsTab />)

      // Default: pendentes → N=2
      let btn = screen.getByTestId('conflicts-export-csv')
      expect(btn).toHaveTextContent(/\(2\)/)

      // Clica chip "Resolvidos" → N=1
      fireEvent.click(screen.getByTestId('chip-resolved'))
      btn = screen.getByTestId('conflicts-export-csv')
      expect(btn).toHaveTextContent(/\(1\)/)
    })
  })
})
