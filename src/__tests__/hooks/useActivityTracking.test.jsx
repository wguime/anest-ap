/**
 * useActivityTracking — o histórico agregado só é carregado por quem o mostra.
 *
 * Montado no App para TODO usuário, o hook baixava 30 dias de user_activity_log
 * (até 5.000 linhas, 290 ms no banco) no mount e a cada 5 min, e um setState a
 * cada 30 s repintava a árvore inteira — sendo que só o DashboardGestaoTab lê
 * loginHistory/topPages/sessionDuration. Em 16/09/2026 (plano free saturado)
 * isso era 10 % de todo o tempo de banco do projeto.
 *
 * Trava: sem `{ historico: true }` nada de select em user_activity_log; com a
 * opção, o select acontece. Presença e rastreio de eventos ficam iguais nos dois.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { supabaseMock, selectChain, fromCalls } = vi.hoisted(() => {
  const fromCalls = []
  const selectChain = {
    select: vi.fn(() => selectChain),
    gte: vi.fn(() => selectChain),
    order: vi.fn(() => selectChain),
    limit: vi.fn(async () => ({ data: [], error: null })),
    insert: vi.fn(async () => ({ error: null })),
  }
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
    track: vi.fn(async () => {}),
    untrack: vi.fn(async () => {}),
    presenceState: vi.fn(() => ({})),
  }
  const supabaseMock = {
    from: vi.fn((table) => { fromCalls.push(table); return selectChain }),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }
  return { supabaseMock, selectChain, fromCalls }
})
vi.mock('@/config/supabase', () => ({ supabase: supabaseMock, getSupabaseToken: vi.fn(async () => 'tok') }))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { uid: 'u1', displayName: 'Guilherme', role: 'admin' },
    firebaseUser: { uid: 'u1' },
    isAuthenticated: true,
  }),
}))

import { useActivityTracking } from '@/hooks/useActivityTracking'

beforeEach(() => {
  fromCalls.length = 0
  selectChain.select.mockClear()
  sessionStorage.clear()
})

describe('useActivityTracking — histórico sob demanda', () => {
  it('sem a opção não consulta user_activity_log (só grava o login)', async () => {
    const { result } = renderHook(() => useActivityTracking())
    // dá tempo aos efeitos de montagem (login, presença)
    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    expect(selectChain.select).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(typeof result.current.trackPageView).toBe('function')
  })

  it('com { historico: true } consulta os 30 dias de user_activity_log', async () => {
    const { result } = renderHook(() => useActivityTracking({ historico: true }))
    await waitFor(() => expect(selectChain.select).toHaveBeenCalled())
    expect(fromCalls).toContain('user_activity_log')
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})
