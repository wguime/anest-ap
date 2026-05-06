/**
 * ReviewCalendar.test.jsx — Wave 3 / W3-5
 *
 * Slice tests for the row actions:
 *   - "Marcar como revisado" → addVersion(category, id, payload, userInfo)
 *   - "Adiar revisão"        → updateDocument with proximaRevisao
 *   - "Delegar responsável"  → updateDocument with responsavelId
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ── Mocks ───────────────────────────────────────────────────────────
const mockAddVersion = vi.fn(() => Promise.resolve({ versao: 2 }))
const mockUpdateDocument = vi.fn(() => Promise.resolve({}))

let mockOverdue = []
let mockUpcoming = []

vi.mock('@/hooks/useComplianceMetrics', () => ({
  useComplianceMetrics: () => ({
    overdueDocuments: mockOverdue,
    upcomingReviews: mockUpcoming,
  }),
}))

vi.mock('@/contexts/DocumentsContext', () => ({
  useDocuments: () => ({
    addVersion: mockAddVersion,
    updateDocument: mockUpdateDocument,
  }),
  useDocumentsContext: () => ({
    addVersion: mockAddVersion,
    updateDocument: mockUpdateDocument,
  }),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { uid: 'tester-uid', id: 'tester-uid', displayName: 'Tester' },
  }),
}))

// supabaseUsersService — admins for the delegate popover
vi.mock('@/services/supabaseUsersService', () => ({
  default: {
    fetchAllUsers: vi.fn(() =>
      Promise.resolve([
        { id: 'admin-1', isAdmin: true, nome: 'Admin Um', email: 'a1@x.com' },
        { id: 'admin-2', isAdmin: true, nome: 'Admin Dois', email: 'a2@x.com' },
        { id: 'user-3', isAdmin: false, nome: 'Comum' },
      ])
    ),
  },
}))

// Stub out heavy DS components — keep behavior simple and observable
vi.mock('@/design-system', () => ({
  Card: ({ children, ...p }) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }) => <div {...p}>{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, onClick, disabled, ...p }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...p}>
      {children}
    </button>
  ),
  // DatePicker — lets tests fire onChange with a chosen date
  DatePicker: ({ value, onChange, label }) => (
    <div data-testid="date-picker" data-label={label}>
      <button
        type="button"
        data-testid="date-picker-set"
        onClick={() => onChange(new Date('2026-09-01T00:00:00Z'))}
      >
        set-date
      </button>
      <span data-testid="date-picker-value">
        {value ? value.toISOString() : ''}
      </span>
    </div>
  ),
  // Popover stubs — render trigger + content unconditionally so tests can click items
  Popover: ({ children }) => <div data-testid="popover-root">{children}</div>,
  PopoverTrigger: ({ children, asChild }) => (asChild ? children : <span>{children}</span>),
  PopoverContent: ({ children, ...p }) => <div data-testid="popover-content" {...p}>{children}</div>,
}))

vi.mock('@/types/documents', () => ({
  CATEGORY_LABELS: { etica: 'Ética' },
  diasAteRevisao: (iso) => {
    if (!iso) return null
    const ms = new Date(iso).getTime() - Date.now()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  },
}))

// ── Import after mocks ──────────────────────────────────────────────
import ReviewCalendar from '../ReviewCalendar'

// ── Helpers ─────────────────────────────────────────────────────────
function makeDoc(overrides = {}) {
  // 15 days from now → upcoming
  const futureIso = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: 'doc-1',
    titulo: 'Documento Teste',
    codigo: 'COD-001',
    category: 'etica',
    proximaRevisao: futureIso,
    versaoAtual: 1,
    ...overrides,
  }
}

beforeEach(() => {
  mockAddVersion.mockClear()
  mockUpdateDocument.mockClear()
  mockOverdue = []
  mockUpcoming = []
})

// ── Tests ───────────────────────────────────────────────────────────
describe('ReviewCalendar — row actions exist', () => {
  it('renders the three action buttons for each upcoming review', async () => {
    mockUpcoming = [makeDoc({ id: 'doc-actions' })]
    render(<ReviewCalendar />)

    expect(screen.getByTestId('mark-reviewed-doc-actions')).toBeInTheDocument()
    expect(screen.getByTestId('postpone-btn-doc-actions')).toBeInTheDocument()
    expect(screen.getByTestId('delegate-btn-doc-actions')).toBeInTheDocument()
  })

  it('renders the three action buttons for each overdue review', async () => {
    mockOverdue = [
      makeDoc({
        id: 'overdue-1',
        proximaRevisao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ]
    render(<ReviewCalendar />)

    expect(screen.getByTestId('mark-reviewed-overdue-1')).toBeInTheDocument()
    expect(screen.getByTestId('postpone-btn-overdue-1')).toBeInTheDocument()
    expect(screen.getByTestId('delegate-btn-overdue-1')).toBeInTheDocument()
  })
})

describe('ReviewCalendar — Marcar como revisado', () => {
  it('dispatches addVersion(category, id, payload, userInfo) when clicked', async () => {
    mockUpcoming = [makeDoc({ id: 'doc-mark', versaoAtual: 3 })]
    render(<ReviewCalendar />)

    fireEvent.click(screen.getByTestId('mark-reviewed-doc-mark'))

    await waitFor(() => expect(mockAddVersion).toHaveBeenCalledTimes(1))
    expect(mockAddVersion).toHaveBeenCalledWith(
      'etica',
      'doc-mark',
      expect.objectContaining({ versao: 4 }),
      expect.objectContaining({ userId: 'tester-uid' })
    )
  })
})

describe('ReviewCalendar — Adiar revisão', () => {
  it('opens the date picker and calls updateDocument on confirm', async () => {
    mockUpcoming = [makeDoc({ id: 'doc-postpone' })]
    render(<ReviewCalendar />)

    // Picker hidden initially
    expect(screen.queryByTestId('postpone-picker-doc-postpone')).not.toBeInTheDocument()

    // Open picker
    fireEvent.click(screen.getByTestId('postpone-btn-doc-postpone'))
    expect(await screen.findByTestId('postpone-picker-doc-postpone')).toBeInTheDocument()

    // Pick a date via the stubbed DatePicker
    fireEvent.click(screen.getByTestId('date-picker-set'))

    // Confirm
    fireEvent.click(screen.getByTestId('postpone-confirm-doc-postpone'))

    await waitFor(() => expect(mockUpdateDocument).toHaveBeenCalledTimes(1))
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      'etica',
      'doc-postpone',
      expect.objectContaining({ proximaRevisao: '2026-09-01T00:00:00.000Z' }),
      expect.any(Object)
    )
  })
})

describe('ReviewCalendar — Delegar responsável', () => {
  it('shows admin list and calls updateDocument(responsavelId) on selection', async () => {
    mockUpcoming = [makeDoc({ id: 'doc-delegate' })]

    await act(async () => {
      render(<ReviewCalendar />)
    })

    // Wait for admins to load via the mocked service
    await waitFor(() =>
      expect(screen.getByTestId('delegate-option-doc-delegate-admin-1')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId('delegate-option-doc-delegate-admin-1'))

    await waitFor(() => expect(mockUpdateDocument).toHaveBeenCalledTimes(1))
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      'etica',
      'doc-delegate',
      expect.objectContaining({
        responsavelId: 'admin-1',
        responsavelRevisao: 'Admin Um',
      }),
      expect.any(Object)
    )
  })

  it('only lists administrators (filters out non-admins)', async () => {
    mockUpcoming = [makeDoc({ id: 'doc-delegate-2' })]

    await act(async () => {
      render(<ReviewCalendar />)
    })

    await waitFor(() =>
      expect(screen.getByTestId('delegate-option-doc-delegate-2-admin-1')).toBeInTheDocument()
    )

    expect(screen.queryByTestId('delegate-option-doc-delegate-2-user-3')).not.toBeInTheDocument()
  })
})
