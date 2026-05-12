import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'

/**
 * Tests para ApiTokensTab — Sprint 16 (chips de scopes + legacy indicator).
 *
 * Cobre:
 *  - Row com scopes=['read:docs'] → renderiza 1 chip read:docs (sem legacy)
 *  - Row com scope='read' + scopes=null (back-compat antigo)  → 3 chips + legacy
 */

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-fake')

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (cb) => Promise.resolve({ data: [], error: null }).then(cb),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({})),
    })),
    removeChannel: vi.fn(),
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  getSupabaseToken: vi.fn(async () => 'fake-jwt'),
}))

const mockFetchTokens = vi.fn()
const mockRevokeToken = vi.fn()
const mockGenerateToken = vi.fn()

// O componente importa `VALID_SCOPES` como named export do service. Reexpomos
// pra manter contrato; o default export já é mock'ado.
vi.mock('@/services/supabaseApiTokensService', () => ({
  default: {
    fetchTokens: (...args) => mockFetchTokens(...args),
    revokeToken: (...args) => mockRevokeToken(...args),
    generateToken: (...args) => mockGenerateToken(...args),
  },
  VALID_SCOPES: ['read:docs', 'read:planos-acao', 'read:comunicados'],
}))

const mockToast = vi.fn()
vi.mock('@/design-system', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useToast: () => ({ toast: mockToast }),
  }
})

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { uid: 'admin-uid-123', isAdmin: true, displayName: 'Admin User' },
  }),
}))

import ApiTokensTab from '@/pages/management/api-tokens/ApiTokensTab'

function makeToken(overrides = {}) {
  return {
    id: 't1',
    name: 'Integração X',
    scope: 'read',
    scopes: ['read:docs', 'read:planos-acao', 'read:comunicados'],
    legacyScopes: false,
    createdBy: 'admin-uid-123',
    createdAt: '2026-05-01T10:00:00Z',
    revokedAt: null,
    lastUsedAt: '2026-05-12T11:00:00Z',
    usageCount: 5,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApiTokensTab — scope chips', () => {
  it('row com scopes=["read:docs"] renderiza 1 chip read:docs e sem legacy', async () => {
    mockFetchTokens.mockResolvedValueOnce([
      makeToken({
        id: 't-narrow',
        name: 'Narrow Token',
        scopes: ['read:docs'],
        legacyScopes: false,
      }),
    ])

    render(<ApiTokensTab />)

    await waitFor(() => {
      expect(screen.getByText('Narrow Token')).toBeInTheDocument()
    })

    const chipsContainer = screen.getByTestId('scope-chips')
    expect(chipsContainer).toHaveAttribute('data-legacy', 'false')

    // 1 chip read:docs
    expect(within(chipsContainer).getByText('read:docs')).toBeInTheDocument()
    expect(within(chipsContainer).queryByText('read:planos-acao')).not.toBeInTheDocument()
    expect(within(chipsContainer).queryByText('read:comunicados')).not.toBeInTheDocument()

    // a11y: aria-label "Permissão: read:docs"
    expect(
      within(chipsContainer).getByLabelText('Permissão: read:docs')
    ).toBeInTheDocument()

    // Sem legacy indicator
    expect(
      screen.queryByTestId('scope-legacy-indicator')
    ).not.toBeInTheDocument()
  })

  it('row legacy (scope="read", legacyScopes=true) renderiza 3 chips + indicador "legacy"', async () => {
    mockFetchTokens.mockResolvedValueOnce([
      makeToken({
        id: 't-legacy',
        name: 'Legacy Token',
        scope: 'read',
        // rowToCamel preenche scopes com os 3 quando row.scopes era null/[]
        scopes: ['read:docs', 'read:planos-acao', 'read:comunicados'],
        legacyScopes: true,
      }),
    ])

    render(<ApiTokensTab />)

    await waitFor(() => {
      expect(screen.getByText('Legacy Token')).toBeInTheDocument()
    })

    const chipsContainer = screen.getByTestId('scope-chips')
    expect(chipsContainer).toHaveAttribute('data-legacy', 'true')

    // 3 chips
    expect(within(chipsContainer).getByText('read:docs')).toBeInTheDocument()
    expect(within(chipsContainer).getByText('read:planos-acao')).toBeInTheDocument()
    expect(within(chipsContainer).getByText('read:comunicados')).toBeInTheDocument()

    // Indicador legacy presente
    const legacy = screen.getByTestId('scope-legacy-indicator')
    expect(legacy).toBeInTheDocument()
    expect(legacy).toHaveTextContent(/legacy/i)
    // Tooltip via title attr
    expect(legacy).toHaveAttribute('title')
  })
})
