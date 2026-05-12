import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

/**
 * Tests para GenerateTokenModal — Sprint 16 (scopes granulares).
 *
 * Cobre:
 *  - Render default: 3 checkboxes todas marcadas + submit habilitado
 *  - Desmarcar todas: submit desabilitado + helper "Selecione ao menos 1 permissão"
 *  - Submit com subset → chama onGenerate com scopes array correto
 */

// Stub env para evitar createClient real ao puxar deps transitivas do DS
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

const mockToast = vi.fn()
vi.mock('@/design-system', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useToast: () => ({ toast: mockToast }),
  }
})

import GenerateTokenModal from '@/pages/management/api-tokens/GenerateTokenModal'

const SCOPE_NAMES = {
  'read:docs': /Documentos/,
  'read:planos-acao': /Planos de Ação/,
  'read:comunicados': /Comunicados/,
}

function findScopeCheckbox(scope) {
  // O Checkbox DS expõe o input nativo hidden com id="scope-<value>"
  return document.getElementById(`scope-${scope}`)
}

function getSubmitButton() {
  // Botão de submit do form (último "Gerar token" — o primeiro é o título)
  const buttons = screen.getAllByRole('button', { name: /Gerar token/i })
  return buttons[buttons.length - 1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GenerateTokenModal — scopes', () => {
  it('render default: 3 checkboxes presentes e todas marcadas; submit habilitado quando nome ok', async () => {
    const onGenerate = vi.fn()
    render(
      <GenerateTokenModal
        open
        onClose={() => {}}
        onGenerate={onGenerate}
        onCreated={() => {}}
      />
    )

    // 3 checkboxes
    const docs = findScopeCheckbox('read:docs')
    const planos = findScopeCheckbox('read:planos-acao')
    const comunicados = findScopeCheckbox('read:comunicados')

    expect(docs).toBeTruthy()
    expect(planos).toBeTruthy()
    expect(comunicados).toBeTruthy()

    // Todas marcadas por default
    expect(docs.checked).toBe(true)
    expect(planos.checked).toBe(true)
    expect(comunicados.checked).toBe(true)

    // Labels visíveis dentro do grupo
    const group = screen.getByTestId('scopes-group')
    for (const re of Object.values(SCOPE_NAMES)) {
      expect(within(group).getByText(re)).toBeInTheDocument()
    }

    // Preenche nome válido → submit habilita
    const nameInput = screen.getByLabelText(/Nome do token/i)
    fireEvent.change(nameInput, { target: { value: 'Token Default' } })

    const submit = getSubmitButton()
    expect(submit).not.toBeDisabled()

    // Helper de erro de scope NÃO aparece
    expect(screen.queryByTestId('scopes-helper')).not.toBeInTheDocument()
  })

  it('desmarca todas as 3 → submit desabilita + helper "Selecione ao menos 1 permissão"', async () => {
    render(
      <GenerateTokenModal
        open
        onClose={() => {}}
        onGenerate={vi.fn()}
        onCreated={() => {}}
      />
    )

    // Nome OK pra isolar a regra de scopes
    fireEvent.change(screen.getByLabelText(/Nome do token/i), {
      target: { value: 'Nome OK' },
    })

    // Desmarca as 3 (click no label, que toggle do Checkbox DS)
    fireEvent.click(findScopeCheckbox('read:docs'))
    fireEvent.click(findScopeCheckbox('read:planos-acao'))
    fireEvent.click(findScopeCheckbox('read:comunicados'))

    expect(findScopeCheckbox('read:docs').checked).toBe(false)
    expect(findScopeCheckbox('read:planos-acao').checked).toBe(false)
    expect(findScopeCheckbox('read:comunicados').checked).toBe(false)

    // Helper aparece + submit disabled
    await waitFor(() => {
      expect(screen.getByTestId('scopes-helper')).toHaveTextContent(
        /Selecione ao menos 1 permissão/i
      )
    })

    expect(getSubmitButton()).toBeDisabled()
  })

  it('submit com subset → onGenerate recebe scopes array com somente os marcados', async () => {
    const onGenerate = vi.fn().mockResolvedValue({
      token: 'PLAIN-XYZ',
      id: 'tok-1',
      name: 'Subset Token',
      scope: 'read',
      scopes: ['read:docs'],
      created_at: '2026-05-12T13:00:00Z',
    })

    render(
      <GenerateTokenModal
        open
        onClose={() => {}}
        onGenerate={onGenerate}
        onCreated={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText(/Nome do token/i), {
      target: { value: 'Subset Token' },
    })

    // Desmarca planos-acao e comunicados, mantém read:docs
    fireEvent.click(findScopeCheckbox('read:planos-acao'))
    fireEvent.click(findScopeCheckbox('read:comunicados'))

    expect(findScopeCheckbox('read:docs').checked).toBe(true)
    expect(findScopeCheckbox('read:planos-acao').checked).toBe(false)
    expect(findScopeCheckbox('read:comunicados').checked).toBe(false)

    // Submit
    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledTimes(1)
    })

    const arg = onGenerate.mock.calls[0][0]
    expect(arg.name).toBe('Subset Token')
    expect(arg.scopes).toEqual(['read:docs'])
  })
})
