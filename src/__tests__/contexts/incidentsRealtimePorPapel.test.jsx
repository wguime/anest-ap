/**
 * IncidentsContext — assinatura realtime conforme o papel (Broadcast, 16/09/2026).
 *
 * O canal t:incidentes só aceita RESPONSÁVEL (a policy de realtime.messages
 * espelha a RLS da tabela: existência e status de um relato/denúncia não chegam
 * a quem não pode lê-lo). Quem não é responsável entraria em CHANNEL_ERROR e
 * ficaria 20 tentativas retentando — então o contexto só assina o canal geral
 * quando `incidentSettings.isResponsible`. O autor de um relato identificado
 * acompanha o seu pelo tópico pessoal (filter user_id=eq.<uid>), sempre.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { subs, userMock } = vi.hoisted(() => ({
  subs: [],
  userMock: { current: null },
}))

vi.mock('@/services/supabaseIncidentsService', () => ({
  default: {
    fetchIncidentes: vi.fn(async () => []),
    fetchDenuncias: vi.fn(async () => []),
  },
  incidentsToCamelCase: (r) => r,
}))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: (opts) => {
    subs.push(opts)
    return { cleanup: () => {} }
  },
}))
vi.mock('@/contexts/DeferredReadyContext', () => ({ useDeferredReady: () => true }))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: userMock.current }) }))

import { IncidentsProvider } from '@/contexts/IncidentsContext'

const montar = async () => {
  render(
    <ThemeProvider><ToastProvider>
      <IncidentsProvider><div /></IncidentsProvider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(subs.length).toBeGreaterThan(0))
}

beforeEach(() => { subs.length = 0 })

describe('IncidentsContext — realtime por papel', () => {
  it('responsável assina o canal geral E o próprio tópico', async () => {
    userMock.current = { uid: 'u-resp', incidentSettings: { isResponsible: true } }
    await montar()
    const tabelas = subs.map((s) => ({ table: s.table, filter: s.filter || null }))
    expect(tabelas).toEqual([
      { table: 'incidentes', filter: null },
      { table: 'incidentes', filter: 'user_id=eq.u-resp' },
    ])
  })

  it('quem não é responsável assina SÓ o próprio tópico (nunca t:incidentes)', async () => {
    userMock.current = { uid: 'u-comum', incidentSettings: { isResponsible: false } }
    await montar()
    expect(subs).toHaveLength(1)
    expect(subs[0].table).toBe('incidentes')
    expect(subs[0].filter).toBe('user_id=eq.u-comum')
    expect(typeof subs[0].onRefetch).toBe('function') // única assinatura recarrega na reconexão
  })
})
