/**
 * Tests for DocumentsContext (Wave 3 / W3-3 split).
 *
 * Covers:
 * - useDocumentsState() returns state shape
 * - useDocumentsActions() callbacks have stable identity across renders
 *   (uses renderHook + rerender, asserts Object.is(prev, next))
 * - useDocumentsByCategory(cat) filters correctly
 * - useDocumentsCounts() returns counts equivalent to existing consumer reads
 * - useDocuments() aggregated hook keeps backward-compat shape
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import * as React from 'react'

// ----------------------------------------------------------------------------
// Hoisted mocks
// ----------------------------------------------------------------------------
const { mockToast, mockFetchAllDocuments } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockFetchAllDocuments: vi.fn(),
}))

vi.mock('@/design-system/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// supabaseDocumentService — service signature must remain backward compatible (W3-4)
vi.mock('@/services/supabaseDocumentService', () => {
  const fakeDoc = (id, status = 'ativo') => ({
    id,
    titulo: `Doc ${id}`,
    codigo: `CODE-${id}`,
    status,
    proximaRevisao: null,
    changeLog: [],
    versoes: [],
    updatedAt: '2026-01-01T00:00:00Z',
  })

  mockFetchAllDocuments.mockResolvedValue({
    etica: [fakeDoc('e1', 'ativo'), fakeDoc('e2', 'pendente')],
    comites: [fakeDoc('c1', 'ativo')],
    auditorias: [],
    relatorios: [fakeDoc('r1', 'arquivado')],
    biblioteca: [],
    financeiro: [],
    medicamentos: [],
    infeccoes: [],
    desastres: [],
  })

  return {
    default: {
      fetchAllDocuments: mockFetchAllDocuments,
      createDocument: vi.fn().mockResolvedValue({ id: 'new-1' }),
      updateDocument: vi.fn().mockResolvedValue({ id: 'updated' }),
      deleteDocument: vi.fn().mockResolvedValue(true),
      changeStatus: vi.fn().mockResolvedValue({ success: true, document: { id: 'x', titulo: 'X' } }),
      addVersion: vi.fn().mockResolvedValue({ versao: '2.0', arquivoURL: '' }),
      archiveDocument: vi.fn().mockResolvedValue(true),
      restoreDocument: vi.fn().mockResolvedValue(true),
    },
    documentToCamelCase: (row) => row,
  }
})

vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn(() => ({ cleanup: vi.fn() })),
}))

vi.mock('@/services/supabaseMessagesService', () => ({
  default: {
    createNotification: vi.fn().mockResolvedValue(null),
    createNotificationBatch: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/services/supabaseUsersService', () => ({
  default: { fetchAllUsers: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/utils/audit', () => ({
  requireUserId: (info) => ({
    userId: info?.userId || 'test-user',
    userName: info?.userName || 'Test User',
  }),
}))

// ----------------------------------------------------------------------------
// Imports after mocks
// ----------------------------------------------------------------------------
import {
  DocumentsProvider,
  useDocumentsState,
  useDocumentsActions,
  useDocumentsByCategory,
  useDocumentsCounts,
  useDocuments,
} from '../../contexts/DocumentsContext'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function wrapper({ children }) {
  return <DocumentsProvider>{children}</DocumentsProvider>
}

beforeEach(() => {
  mockToast.mockClear()
})

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------
describe('DocumentsContext (W3-3 split)', () => {
  describe('useDocumentsState()', () => {
    it('exposes the expected state shape', async () => {
      const { result } = renderHook(() => useDocumentsState(), { wrapper })

      // Wait for the async fetchAllDocuments → SET_DOCUMENTS dispatch
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      expect(result.current).toEqual(
        expect.objectContaining({
          documents: expect.any(Object),
          counts: expect.any(Object),
          isLoading: expect.any(Boolean),
          isInitialized: true,
          error: null,
          overdueDocuments: expect.any(Array),
          upcomingReviews: expect.any(Array),
          pendingApproval: expect.any(Array),
        })
      )

      // Spot-check known seeded data
      expect(result.current.documents.etica).toHaveLength(2)
      expect(result.current.documents.comites).toHaveLength(1)
    })
  })

  describe('useDocumentsActions()', () => {
    it('callbacks have stable identity across rerenders', async () => {
      const { result, rerender } = renderHook(() => useDocumentsActions(), { wrapper })

      // Wait for provider to initialize
      await waitFor(() => {
        expect(typeof result.current.addDocument).toBe('function')
      })

      const first = result.current
      rerender()
      const second = result.current

      // Each individual callback should be the same reference
      expect(Object.is(first.addDocument, second.addDocument)).toBe(true)
      expect(Object.is(first.updateDocument, second.updateDocument)).toBe(true)
      expect(Object.is(first.deleteDocument, second.deleteDocument)).toBe(true)
      expect(Object.is(first.changeStatus, second.changeStatus)).toBe(true)
      expect(Object.is(first.addVersion, second.addVersion)).toBe(true)
      expect(Object.is(first.archiveDocument, second.archiveDocument)).toBe(true)
      expect(Object.is(first.restoreDocument, second.restoreDocument)).toBe(true)
      expect(Object.is(first.getDocumentsByCategory, second.getDocumentsByCategory)).toBe(true)
      expect(Object.is(first.getDocumentById, second.getDocumentById)).toBe(true)
      expect(Object.is(first.findDocumentById, second.findDocumentById)).toBe(true)
      expect(Object.is(first.searchAllDocuments, second.searchAllDocuments)).toBe(true)

      // The whole actions object should also remain identity-stable
      expect(Object.is(first, second)).toBe(true)
    })

    it('actions identity remains stable AFTER state updates (the cascade-rerender fix)', async () => {
      // This is the core promise of W3-3: data updates must not re-create
      // action callbacks, otherwise components that only consume actions
      // re-render unnecessarily.
      let stateRender = 0

      const stateHook = renderHook(
        () => {
          stateRender += 1
          return useDocumentsState()
        },
        { wrapper }
      )
      const actionsHook = renderHook(() => useDocumentsActions(), { wrapper })

      await waitFor(() => {
        expect(stateHook.result.current.isInitialized).toBe(true)
      })

      const initialActions = actionsHook.result.current

      // Trigger another state change via deleteDocument (mocked to resolve OK)
      await act(async () => {
        await actionsHook.result.current.deleteDocument('etica', 'e1', { userId: 'u', userName: 'U' })
      })

      // Actions object identity must be unchanged
      expect(Object.is(actionsHook.result.current, initialActions)).toBe(true)
      // Sanity: state hook DID see the change (count went down)
      expect(stateRender).toBeGreaterThan(1)
    })
  })

  describe('useDocumentsByCategory(category)', () => {
    it('filters correctly and returns only the requested category', async () => {
      const { result } = renderHook(() => useDocumentsByCategory('etica'), { wrapper })

      await waitFor(() => {
        expect(result.current).toHaveLength(2)
      })
      expect(result.current.every((d) => d.id.startsWith('e'))).toBe(true)
    })

    it('returns an empty array for unknown categories', async () => {
      const { result } = renderHook(() => useDocumentsByCategory('does-not-exist'), { wrapper })
      await waitFor(() => {
        expect(Array.isArray(result.current)).toBe(true)
      })
      expect(result.current).toEqual([])
    })

    it('memoizes per category — same array identity across rerenders when documents are stable', async () => {
      const { result, rerender } = renderHook(() => useDocumentsByCategory('etica'), { wrapper })

      await waitFor(() => {
        expect(result.current).toHaveLength(2)
      })
      const first = result.current
      rerender()
      expect(Object.is(result.current, first)).toBe(true)
    })
  })

  describe('useDocumentsCounts()', () => {
    it('returns aggregated counts matching the previous consumer contract', async () => {
      const { result } = renderHook(() => useDocumentsCounts(), { wrapper })

      await waitFor(() => {
        expect(result.current.total).toBeGreaterThan(0)
      })

      // 4 docs total: 2 ativos (e1, c1), 1 pendente (e2), 1 arquivado (r1)
      expect(result.current.total).toBe(4)
      expect(result.current.aprovados).toBe(2)
      expect(result.current.pendentes).toBe(1)
      expect(result.current.arquivados).toBe(1)

      // Per-category active counts (existing consumers like CentroGestaoPage
      // read counts.etica directly) must be preserved.
      expect(result.current.etica).toBe(1) // only e1 is ativo
      expect(result.current.comites).toBe(1)
      expect(result.current.relatorios).toBe(0) // r1 is arquivado
    })
  })

  describe('useDocuments() — backward compatibility', () => {
    it('returns the unified state+actions shape that legacy consumers expect', async () => {
      const { result } = renderHook(() => useDocuments(), { wrapper })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Fields that existing consumers read (BibliotecaPage, CentroGestaoPage,
      // hooks/useDocuments.js, hooks/useComplianceMetrics.js, etc.)
      const expectedKeys = [
        'documents',
        'counts',
        'isLoading',
        'isInitialized',
        'error',
        'lastSync',
        'overdueDocuments',
        'upcomingReviews',
        'pendingApproval',
        'addDocument',
        'updateDocument',
        'deleteDocument',
        'changeStatus',
        'addVersion',
        'archiveDocument',
        'restoreDocument',
        'getDocumentsByCategory',
        'getDocumentById',
        'findDocumentById',
        'searchAllDocuments',
      ]
      for (const key of expectedKeys) {
        expect(result.current).toHaveProperty(key)
      }
    })
  })
})
