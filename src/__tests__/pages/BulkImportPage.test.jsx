/**
 * Sprint 5 / O2-4 — BulkImportPage smoke render tests
 *
 * Cobre:
 *   1. Flag OFF → mensagem "Bulk import indisponível"
 *   2. Não-admin → mensagem "Acesso restrito"
 *   3. Admin + flag ON → renderiza dropzone + título principal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let bulkEnabled = true
let ocrEnabled = false
vi.mock('@/utils/featureFlags', () => ({
  isBulkImportEnabled: () => bulkEnabled,
  isOcrEnabled: () => ocrEnabled,
}))

let isAdminMock = true
vi.mock('@/design-system/components/anest/admin-only', () => ({
  isAdministrator: () => isAdminMock,
  AdminOnly: ({ children }) => children,
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    firebaseUser: { uid: 'admin-uid', email: 'a@a.com' },
    currentUser: { isAdmin: true },
  }),
}))

vi.mock('@/services/bulkImportService', () => ({
  default: {
    MAX_FILE_SIZE: 50 * 1024 * 1024,
    validateBulkRow: () => [],
  },
  validateBulkRow: () => [],
}))

vi.mock('@/hooks/useBulkImport', () => ({
  BULK_IMPORT_STATUS: {
    IDLE: 'idle',
    PREPARING: 'preparing',
    PROCESSING: 'processing',
    DONE: 'done',
    PARTIAL: 'partial',
    FAILED: 'failed',
    DISABLED: 'disabled',
  },
  useBulkImport: () => ({
    startImport: vi.fn(),
    status: 'idle',
    progress: { processed: 0, failed: 0, total: 0, phase: 'idle' },
    errors: [],
    summary: null,
    reset: vi.fn(),
  }),
}))

vi.mock('@/design-system', () => ({
  Button: ({ children, ...rest }) => <button {...rest}>{children}</button>,
  Input: (p) => <input {...p} />,
  Select: () => <div data-testid="select" />,
  Progress: () => <div data-testid="progress" />,
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/design-system/components/ui/file-upload', () => ({
  FileUpload: ({ label }) => <div data-testid="dropzone">{label}</div>,
}))

import BulkImportPage from '../../pages/management/BulkImportPage.jsx'

beforeEach(() => {
  bulkEnabled = true
  isAdminMock = true
})

describe('BulkImportPage', () => {
  it('mostra mensagem quando feature flag está OFF', () => {
    bulkEnabled = false
    render(<BulkImportPage goBack={() => {}} />)
    expect(screen.getByText(/Bulk import indispon[íi]vel/i)).toBeInTheDocument()
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument()
  })

  it('bloqueia não-admin com mensagem de acesso restrito', () => {
    isAdminMock = false
    render(<BulkImportPage goBack={() => {}} />)
    expect(screen.getByText(/Acesso restrito/i)).toBeInTheDocument()
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument()
  })

  it('admin + flag ON renderiza dropzone e botão de iniciar', () => {
    render(<BulkImportPage goBack={() => {}} />)
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
    expect(screen.getByText(/Iniciar importa/i)).toBeInTheDocument()
  })
})
