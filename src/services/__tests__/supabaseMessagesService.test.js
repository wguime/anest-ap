/**
 * Sprint 15c — createNotificationBatch guard contra RLS pos-logout.
 *
 * Asserts:
 *   1. Quando auth.currentUser (Firebase) é null (user deslogado),
 *      createNotificationBatch retorna [] sem chamar .from().insert().
 *   2. Quando ha user autenticado, o insert prossegue normalmente.
 *
 * Contexto do bug:
 *   Apos auth.signOut() o JWT cache vira anon. Qualquer batch insert
 *   disparado em paralelo (flush de MessagesContext, distribuicao de
 *   DocumentsContext) cai em "permission denied for table notifications"
 *   porque RLS bloqueia INSERT por anon. Guard early-return cobre todos
 *   os callers (nao so o do logout).
 *
 * Drift 2026-06: o guard migrou de supabase.auth.getUser() para
 * auth.currentUser (Firebase é a fonte canônica de identidade) + check
 * adicional de getSupabaseToken() (JWT custom HS256 pronto). Mocks abaixo
 * refletem o fluxo atual.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----------------------------------------------------------------------------
// Mock Supabase client + Firebase auth
// ----------------------------------------------------------------------------
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockGetSupabaseToken = vi.fn()

function buildInsertChain(insertResult) {
  const chain = {
    select: vi.fn(() => {
      mockSelect()
      return Promise.resolve(insertResult ?? { data: [], error: null })
    }),
  }
  return chain
}

let insertResult = { data: [], error: null }

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      mockFrom(table)
      return {
        insert: vi.fn((rows) => {
          mockInsert(rows)
          return buildInsertChain(insertResult)
        }),
      }
    }),
  },
  getSupabaseToken: (...args) => mockGetSupabaseToken(...args),
}))

// Firebase auth — currentUser mutável por teste (fonte canônica de identidade)
vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
}))

import { auth } from '@/config/firebase'

vi.mock('./supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn(),
}))

// Subject under test
import supabaseMessagesService from '../supabaseMessagesService'

beforeEach(() => {
  vi.clearAllMocks()
  insertResult = { data: [], error: null }
  auth.currentUser = null
  mockGetSupabaseToken.mockResolvedValue('fake-jwt')
})

describe('createNotificationBatch — guard pos-logout', () => {
  it('retorna [] sem chamar insert quando auth.currentUser é null', async () => {
    auth.currentUser = null

    const result = await supabaseMessagesService.createNotificationBatch(
      ['user-1', 'user-2'],
      { subject: 'Teste', content: 'Body' },
    )

    expect(result).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('chama insert na tabela notifications quando ha user autenticado', async () => {
    auth.currentUser = { uid: 'firebase-uid-abc' }
    insertResult = {
      data: [
        {
          id: 'notif-1',
          recipient_id: 'user-1',
          subject: 'Teste',
          content: 'Body',
          category: 'sistema',
          priority: 'normal',
          sender_name: 'Sistema ANEST',
          dismissable: true,
        },
      ],
      error: null,
    }

    const result = await supabaseMessagesService.createNotificationBatch(
      ['user-1'],
      { subject: 'Teste', content: 'Body' },
    )

    expect(mockGetSupabaseToken).toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith('notifications')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert.mock.calls[0][0]).toHaveLength(1)
    expect(mockInsert.mock.calls[0][0][0]).toMatchObject({
      recipient_id: 'user-1',
      subject: 'Teste',
      content: 'Body',
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'notif-1', recipientId: 'user-1' })
  })

  it('retorna [] sem checar auth quando recipientIds vazio', async () => {
    const result = await supabaseMessagesService.createNotificationBatch([], {
      subject: 'X',
    })
    expect(result).toEqual([])
    expect(mockGetSupabaseToken).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
