import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

/**
 * Tests para ApiTokensTab — Sprint 14c / O2-5 (B4).
 *
 * Cobre:
 *   - Lista renderiza tokens vindos do service
 *   - Empty state quando lista vazia
 *   - Toggle "ver revogados" refaz fetch com includeRevoked=true
 *   - Click "Revogar" → ConfirmDialog → service.revokeToken chamado com user.uid
 *   - Click "Gerar token" abre modal; submit chama generateToken e mostra plain
 */

// Stub env ANTES de qualquer import que pull supabase client (showcase em
// design-system carrega contextos que chamam createClient).
vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-fake')

// Mock @/config/supabase para evitar createClient real (depende de env e
// import.meta que pode não estar disponível na hora exata do mock factory
// resolver as deps transitivas do design-system showcase).
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
    auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
  getSupabaseToken: vi.fn(async () => 'fake-jwt'),
}))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockFetchTokens = vi.fn()
const mockRevokeToken = vi.fn()
const mockGenerateToken = vi.fn()

vi.mock('@/services/supabaseApiTokensService', () => ({
  default: {
    fetchTokens: (...args) => mockFetchTokens(...args),
    revokeToken: (...args) => mockRevokeToken(...args),
    generateToken: (...args) => mockGenerateToken(...args),
  },
  // Sprint 16 — named export usado em ApiTokensTab para fallback de chips
  VALID_SCOPES: ['read:docs', 'read:planos-acao', 'read:comunicados'],
}))

const mockToast = vi.fn()
// Mock parcial do design-system — sobreescreve useToast mas mantém Card/Modal/Select
// resolvidos via actual.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeToken(overrides = {}) {
  return {
    id: 't1',
    name: 'Integração X',
    scope: 'read',
    createdBy: 'admin-uid-123',
    createdAt: '2026-05-01T10:00:00Z',
    revokedAt: null,
    lastUsedAt: '2026-05-12T11:00:00Z',
    usageCount: 5,
    ...overrides,
  }
}

// clipboard polyfill
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ApiTokensTab', () => {
  it('mostra empty state quando não há tokens', async () => {
    mockFetchTokens.mockResolvedValueOnce([])
    render(<ApiTokensTab />)

    await waitFor(() => {
      expect(screen.getByText(/Nenhum token API gerado/i)).toBeInTheDocument()
    })
    expect(mockFetchTokens).toHaveBeenCalledWith({ includeRevoked: false })
  })

  it('renderiza lista de tokens com nome e contador de usos', async () => {
    mockFetchTokens.mockResolvedValueOnce([
      makeToken({ id: 't1', name: 'Token A', usageCount: 7 }),
      makeToken({ id: 't2', name: 'Token B', usageCount: 0 }),
    ])
    render(<ApiTokensTab />)

    await waitFor(() => {
      expect(screen.getByText('Token A')).toBeInTheDocument()
    })
    expect(screen.getByText('Token B')).toBeInTheDocument()
    const list = screen.getByTestId('api-tokens-list')
    expect(within(list).getAllByText(/Ativo/i).length).toBeGreaterThanOrEqual(2)
  })

  it('toggle "Ver revogados" refaz fetch com includeRevoked=true', async () => {
    mockFetchTokens.mockResolvedValueOnce([])
    render(<ApiTokensTab />)

    await waitFor(() => {
      expect(mockFetchTokens).toHaveBeenCalledTimes(1)
    })

    mockFetchTokens.mockResolvedValueOnce([
      makeToken({ id: 't9', name: 'Old token', revokedAt: '2026-05-10T10:00:00Z' }),
    ])

    fireEvent.click(screen.getByRole('button', { name: /Ver revogados/i }))

    await waitFor(() => {
      expect(mockFetchTokens).toHaveBeenLastCalledWith({ includeRevoked: true })
    })
    await waitFor(() => {
      expect(screen.getByText('Old token')).toBeInTheDocument()
    })
  })

  it('click "Revogar" abre confirm; confirmação chama service com user.uid', async () => {
    mockFetchTokens.mockResolvedValueOnce([
      makeToken({ id: 't1', name: 'Integração Y' }),
    ])
    mockRevokeToken.mockResolvedValueOnce(makeToken({ id: 't1', revokedAt: '2026-05-12Z' }))
    // segunda chamada de load após revoke
    mockFetchTokens.mockResolvedValueOnce([])

    render(<ApiTokensTab />)
    await waitFor(() => screen.getByText('Integração Y'))

    fireEvent.click(screen.getByRole('button', { name: /Revogar token Integração Y/i }))

    // Confirmação aparece
    expect(screen.getByText(/Esta\s+ação não pode ser desfeita/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Confirmar revogação/i }))

    await waitFor(() => {
      expect(mockRevokeToken).toHaveBeenCalledTimes(1)
    })
    const [tokenIdArg, userInfoArg] = mockRevokeToken.mock.calls[0]
    expect(tokenIdArg).toBe('t1')
    expect(userInfoArg).toMatchObject({ uid: 'admin-uid-123' })
  })

  it('click "Gerar token" abre modal; submit chama service e revela plain', async () => {
    mockFetchTokens.mockResolvedValueOnce([])
    mockGenerateToken.mockResolvedValueOnce({
      token: 'PLAIN-TOKEN-XYZ-987',
      id: 'tok-new',
      name: 'ERP X',
      scope: 'read',
      created_at: '2026-05-12T13:00:00Z',
    })
    // reload após criar
    mockFetchTokens.mockResolvedValueOnce([
      makeToken({ id: 'tok-new', name: 'ERP X' }),
    ])

    render(<ApiTokensTab />)
    await waitFor(() => screen.getByText(/Nenhum token API/i))

    fireEvent.click(screen.getByRole('button', { name: /Gerar token/i }))

    // Modal abre com input nome
    const nameInput = await screen.findByLabelText(/Nome do token/i)
    fireEvent.change(nameInput, { target: { value: 'ERP X' } })

    // Submit (botão "Gerar token" dentro do form do modal)
    const submitButtons = screen.getAllByRole('button', { name: /Gerar token/i })
    // O último é o submit do form do modal
    fireEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(mockGenerateToken).toHaveBeenCalledWith({
        name: 'ERP X',
        scope: 'read',
        // Sprint 16 — default = todos os 3 scopes marcados no modal
        scopes: ['read:docs', 'read:planos-acao', 'read:comunicados'],
      })
    })

    // Plain token revelado
    await waitFor(() => {
      expect(screen.getByTestId('generated-token-value')).toHaveTextContent('PLAIN-TOKEN-XYZ-987')
    })
    expect(screen.getByText(/não será mostrado novamente/i)).toBeInTheDocument()

    // Click "Fechar e ir para a lista" chama fetchTokens de novo
    fireEvent.click(screen.getByRole('button', { name: /Fechar e ir para a lista/i }))

    await waitFor(() => {
      expect(mockFetchTokens).toHaveBeenCalledTimes(2)
    })
  })

  it('error no fetch mostra banner', async () => {
    mockFetchTokens.mockRejectedValueOnce(new Error('rede caiu'))
    render(<ApiTokensTab />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/rede caiu/i)
    })
  })
})
