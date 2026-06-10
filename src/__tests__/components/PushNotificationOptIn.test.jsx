/**
 * PushNotificationOptIn — component tests
 * Sprint 21 Wave 2.2.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

// ----------------------------------------------------------------------------
// Mock usePushPermission — controlado por teste
// ----------------------------------------------------------------------------
const mockHookState = {
  permission: 'default',
  isSupported: true,
  token: null,
  isLoading: false,
  requestAndRegister: vi.fn(async () => 'fcm-tok-1'),
  unsubscribe: vi.fn(async () => true),
}

vi.mock('@/hooks/usePushPermission', () => ({
  usePushPermission: () => mockHookState,
  default: () => mockHookState,
}))

vi.mock('@/design-system/hooks', () => ({
  useTheme: () => ({ isDark: false }),
}))

function setupNotificationGlobal(permission = 'default') {
  global.Notification = function Notification() {}
  global.Notification.permission = permission
}

// Import dinâmico (pós-mocks) feito UMA vez, fora do orçamento de 5s dos
// testes: na run completa a transform fria do grafo (framer-motion + DS)
// passa de 5s e estourava o timeout de cada teste que importava inline.
let PushNotificationOptIn
beforeAll(async () => {
  ;({ PushNotificationOptIn } = await import('../../components/PushNotificationOptIn'))
}, 60000)

beforeEach(() => {
  vi.useFakeTimers()
  mockHookState.permission = 'default'
  mockHookState.isSupported = true
  mockHookState.token = null
  mockHookState.isLoading = false
  mockHookState.requestAndRegister = vi.fn(async () => 'fcm-tok-1')
  mockHookState.unsubscribe = vi.fn(async () => true)
  setupNotificationGlobal('default')
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('PushNotificationOptIn', () => {
  it('não renderiza nada quando push não é suportado', async () => {
    mockHookState.isSupported = false
    const { container } = render(<PushNotificationOptIn />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(container.querySelector('[role="region"]')).toBeNull()
  })

  it('não renderiza quando permissão já foi decidida (granted/denied)', async () => {
    mockHookState.permission = 'granted'
    const { container } = render(<PushNotificationOptIn />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(container.querySelector('[role="region"]')).toBeNull()
  })

  it('aparece 5s após mount quando elegível', async () => {
    render(<PushNotificationOptIn />)
    expect(screen.queryByRole('region')).toBeNull()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('region', { name: /notificações push/i })).toBeInTheDocument()
    expect(screen.getByText(/Receber alertas importantes/i)).toBeInTheDocument()
  })

  it('clicar em Ativar chama requestAndRegister', async () => {
    render(<PushNotificationOptIn />)
    act(() => { vi.advanceTimersByTime(5000) })

    const btn = screen.getByRole('button', { name: /ativar notificações push/i })
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(mockHookState.requestAndRegister).toHaveBeenCalledTimes(1)
  })

  it('dispensar persiste em localStorage e impede reaparecer', async () => {
    const { unmount } = render(<PushNotificationOptIn />)
    act(() => { vi.advanceTimersByTime(5000) })

    const close = screen.getByRole('button', { name: /fechar banner/i })
    await act(async () => {
      fireEvent.click(close)
    })

    // markDismissed roda sincronamente dentro do handler — leitura direta basta.
    const stored = window.localStorage.getItem('anest-push-banner-dismissed')
    expect(stored).toBeTruthy()
    expect(Number(stored)).toBeGreaterThan(0)

    // Remount — banner não deve voltar (dismiss persiste 7 dias)
    unmount()
    render(<PushNotificationOptIn />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByRole('region', { name: /notificações push/i })).toBeNull()
  })
})
