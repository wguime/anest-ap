/**
 * Login por identificador na TELA que está no ar (dono 2026-09-08).
 *
 * O app tem dois formulários de login no fonte: `components/LoginForm.jsx`
 * (legado, sem uso) e o `LoginFormDark` dentro de `pages/LoginPage.jsx`, que é
 * o que a pessoa vê. Afrouxar a validação no arquivo errado passa em build, em
 * lint e em qualquer teste de unidade — e o `Unimed` continua sendo recusado na
 * tela. Este teste exercita a página real.
 *
 * Trava também o outro lado: o CADASTRO segue exigindo e-mail de verdade
 * (conta interna é criada à mão, nunca por auto-cadastro).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { login, register } = vi.hoisted(() => ({
  login: vi.fn(async () => ({ success: true })),
  register: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    login,
    register,
    forgotPassword: vi.fn(async () => ({ success: true })),
    error: null,
    isLoading: false,
    clearError: vi.fn(),
  }),
}))
vi.mock('../../contexts/UserContext', () => ({
  useUser: () => ({
    login,
    register,
    forgotPassword: vi.fn(async () => ({ success: true })),
    error: null,
    isLoading: false,
    clearError: vi.fn(),
  }),
}))
vi.mock('@/services/biometricService', () => ({
  isBiometricAvailable: vi.fn(async () => false),
  hasBiometricRegistered: vi.fn(() => false),
  registerBiometric: vi.fn(),
  authenticateWithBiometric: vi.fn(),
}))
vi.mock('../../services/biometricService', () => ({
  isBiometricAvailable: vi.fn(async () => false),
  hasBiometricRegistered: vi.fn(() => false),
  registerBiometric: vi.fn(),
  authenticateWithBiometric: vi.fn(),
}))
vi.mock('@/config/firebase', () => ({ auth: {}, db: {} }))
vi.mock('../../config/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  setPersistence: vi.fn(async () => {}),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
}))
vi.mock('@/config/supabase', () => ({ supabase: { rpc: vi.fn(async () => ({ data: null, error: null })) } }))
vi.mock('../../config/supabase', () => ({ supabase: { rpc: vi.fn(async () => ({ data: null, error: null })) } }))

const LoginPage = (await import('@/pages/LoginPage')).default

const wrap = (ui) => <ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider>

beforeEach(() => {
  login.mockClear()
  register.mockClear()
})

describe('login das funcionárias da Unimed — sem e-mail', () => {
  it('“Unimed” + senha entra: o formulário não barra e o identificador chega ao login', async () => {
    render(wrap(<LoginPage />))

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'Unimed' } })
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('Unimed', '123456'))
    expect(screen.queryByText('E-mail inválido')).toBeNull()
  })

  it('o campo não é type="email" — o browser barraria o submit antes do nosso código', () => {
    render(wrap(<LoginPage />))
    const campo = screen.getByLabelText(/E-mail/i)
    expect(campo.getAttribute('type')).toBe('text')
    // teclado com '@' preservado para quem entra pelo e-mail
    expect(campo.getAttribute('inputmode')).toBe('email')
  })

  it('e-mail pela metade continua sendo recusado', async () => {
    render(wrap(<LoginPage />))

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'fulano@gmail' } })
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => expect(screen.getByText('E-mail inválido')).toBeTruthy())
    expect(login).not.toHaveBeenCalled()
  })
})
