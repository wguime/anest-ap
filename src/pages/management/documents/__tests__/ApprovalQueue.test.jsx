/**
 * ApprovalQueue.test.jsx — Wave 3 / W3-5
 *
 * Slice tests for the behavioral additions:
 *   - notifyUser is called on approve/reject
 *   - Self-approval button is disabled when approver === document author
 *   - Self-approval is also blocked at the mutation site (changeStatus not called)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ── Mocks (must be declared before importing the component) ─────────

const mockNotifyUser = vi.fn(() => Promise.resolve(null))
const mockNotifyUsers = vi.fn(() => Promise.resolve([]))
vi.mock('@/services/notificationService', () => ({
  notifyUser: (...args) => mockNotifyUser(...args),
  notifyUsers: (...args) => mockNotifyUsers(...args),
}))

const mockChangeStatus = vi.fn(() => Promise.resolve({ success: true }))
let mockPendingApproval = []

vi.mock('@/hooks/useComplianceMetrics', () => ({
  useComplianceMetrics: () => ({
    pendingApproval: mockPendingApproval,
    isLoading: false,
  }),
}))

vi.mock('@/contexts/DocumentsContext', () => ({
  useDocuments: () => ({ changeStatus: mockChangeStatus }),
  useDocumentsContext: () => ({ changeStatus: mockChangeStatus }),
}))

let mockUser = { uid: 'approver-uid', id: 'approver-uid', isAdmin: true, displayName: 'Aprovador' }
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: mockUser }),
}))

vi.mock('@/config/supabase', () => ({
  supabase: {
    channel: () => ({
      on: function () { return this },
      subscribe: function () { return this },
    }),
    removeChannel: vi.fn(),
  },
}))

// Mock ApprovalModal to be controllable from tests — auto-confirms when opened
vi.mock('../../components/ApprovalModal', () => ({
  default: ({ open, onConfirm, onClose, action, document: doc }) => {
    if (!open) return null
    return (
      <div data-testid="approval-modal" data-action={action} data-doc-id={doc?.id}>
        <button
          type="button"
          data-testid="modal-confirm"
          onClick={() => onConfirm({ comment: 'test-comment' })}
        >
          Confirmar
        </button>
        <button
          type="button"
          data-testid="modal-close"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    )
  },
}))

// Bypass design-system internals — just render basic interactive elements
vi.mock('@/design-system', () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  Badge: ({ children, ...props }) => <span {...props}>{children}</span>,
  Button: ({ children, onClick, disabled, ...props }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Tooltip: ({ children, content }) => (
    <span data-tooltip-content={content}>{children}</span>
  ),
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock('@/types/documents', () => ({
  CATEGORY_LABELS: { etica: 'Ética' },
  DOCUMENT_STATUS: {
    PENDENTE: 'PENDENTE',
    ATIVO: 'ativo',
    REJEITADO: 'rejeitado',
  },
}))

// ── Import after mocks ──────────────────────────────────────────────
import ApprovalQueue from '../ApprovalQueue'
import { isSelfApproval } from '../approvalUtils'

// ── Helpers ─────────────────────────────────────────────────────────
function makeDoc(overrides = {}) {
  return {
    id: 'doc-1',
    titulo: 'Documento Teste',
    codigo: 'COD-001',
    category: 'etica',
    status: 'PENDENTE',
    createdBy: 'author-uid',
    createdByName: 'Autor',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockNotifyUser.mockClear()
  mockNotifyUsers.mockClear()
  mockChangeStatus.mockClear()
  mockChangeStatus.mockImplementation(() => Promise.resolve({ success: true }))
  mockPendingApproval = []
  mockUser = { uid: 'approver-uid', id: 'approver-uid', isAdmin: true, displayName: 'Aprovador' }
})

// ── Tests ───────────────────────────────────────────────────────────
describe('ApprovalQueue — isSelfApproval helper', () => {
  it('returns true when approver uid equals doc.createdBy', () => {
    expect(isSelfApproval({ createdBy: 'u1' }, { uid: 'u1' })).toBe(true)
  })
  it('returns true when approver id equals doc.created_by', () => {
    expect(isSelfApproval({ created_by: 'u1' }, { id: 'u1' })).toBe(true)
  })
  it('returns false when ids differ', () => {
    expect(isSelfApproval({ createdBy: 'u1' }, { uid: 'u2' })).toBe(false)
  })
  it('returns false when either id is missing', () => {
    expect(isSelfApproval({ createdBy: 'u1' }, {})).toBe(false)
    expect(isSelfApproval({}, { uid: 'u1' })).toBe(false)
    expect(isSelfApproval(null, { uid: 'u1' })).toBe(false)
  })
})

describe('ApprovalQueue — notifyUser is fired on approve/reject', () => {
  it('calls notifyUser with type=document_approved when approving', async () => {
    mockPendingApproval = [makeDoc({ id: 'd-approve', createdBy: 'author-uid' })]

    render(<ApprovalQueue />)

    fireEvent.click(screen.getByTestId('approve-btn-d-approve'))
    fireEvent.click(await screen.findByTestId('modal-confirm'))

    await waitFor(() => expect(mockChangeStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockNotifyUser).toHaveBeenCalledTimes(1))
    expect(mockNotifyUser).toHaveBeenCalledWith(
      'author-uid',
      expect.objectContaining({
        type: 'document_approved',
        docId: 'd-approve',
        comment: 'test-comment',
      })
    )
  })

  it('calls notifyUser with type=document_rejected when rejecting', async () => {
    mockPendingApproval = [makeDoc({ id: 'd-reject', createdBy: 'author-uid' })]

    render(<ApprovalQueue />)

    fireEvent.click(screen.getByTestId('reject-btn-d-reject'))
    fireEvent.click(await screen.findByTestId('modal-confirm'))

    await waitFor(() => expect(mockChangeStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockNotifyUser).toHaveBeenCalledTimes(1))
    expect(mockNotifyUser).toHaveBeenCalledWith(
      'author-uid',
      expect.objectContaining({
        type: 'document_rejected',
        docId: 'd-reject',
      })
    )
  })
})

describe('ApprovalQueue — self-approval block', () => {
  it('disables the approve button when approver === author', async () => {
    mockUser = { uid: 'same-uid', id: 'same-uid', isAdmin: true }
    mockPendingApproval = [makeDoc({ id: 'd-self', createdBy: 'same-uid' })]

    render(<ApprovalQueue />)

    const approveBtn = screen.getByTestId('approve-btn-d-self')
    expect(approveBtn).toBeDisabled()
    expect(approveBtn.getAttribute('data-self-approval')).toBe('true')
    expect(approveBtn.getAttribute('title')).toBe('Você não pode aprovar seus próprios documentos')
  })

  it('does NOT call changeStatus when self-approval is attempted', async () => {
    mockUser = { uid: 'same-uid', id: 'same-uid', isAdmin: true }
    mockPendingApproval = [makeDoc({ id: 'd-self', createdBy: 'same-uid' })]

    render(<ApprovalQueue />)

    // Simulate the user somehow firing the click despite being disabled
    // (defense-in-depth check at handler level)
    const approveBtn = screen.getByTestId('approve-btn-d-self')
    await act(async () => {
      fireEvent.click(approveBtn)
    })

    // No modal should open and no mutation should fire
    expect(screen.queryByTestId('approval-modal')).not.toBeInTheDocument()
    expect(mockChangeStatus).not.toHaveBeenCalled()
    expect(mockNotifyUser).not.toHaveBeenCalled()
  })

  it('enables the approve button when approver !== author', () => {
    mockUser = { uid: 'approver-uid', id: 'approver-uid', isAdmin: true }
    mockPendingApproval = [makeDoc({ id: 'd-other', createdBy: 'author-uid' })]

    render(<ApprovalQueue />)

    const approveBtn = screen.getByTestId('approve-btn-d-other')
    expect(approveBtn).not.toBeDisabled()
    expect(approveBtn.getAttribute('data-self-approval')).toBe('false')
  })
})
