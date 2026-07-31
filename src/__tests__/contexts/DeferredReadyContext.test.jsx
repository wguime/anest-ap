/**
 * Regressão do boot da Home (fix 2026-07-31 "a Home recarrega sozinha aos 2s").
 *
 * O DeferredProviders antigo devolvia `children` cru e depois envolvia nos
 * providers Tier 2 — a raiz do subtree mudava de tipo e o React desmontava e
 * REMONTAVA o App inteiro quando o timer de 2s disparava. O fix mantém a
 * árvore estável e adia só o fetch inicial via DeferredReadyContext.
 *
 * Estes testes travam os 3 contratos do fix:
 * 1. ready=false → provider Tier 2 NÃO busca (deferral de rede preservada)
 * 2. ready false→true → busca dispara SEM remontar os children (árvore estável)
 * 3. provider fora do gate (testes, on-demand) → busca no mount (default true)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { DeferredReadyProvider } from '@/contexts/DeferredReadyContext'
import { DocumentsProvider } from '@/contexts/DocumentsContext'

const { mockFetchAllDocuments } = vi.hoisted(() => ({
  mockFetchAllDocuments: vi.fn(),
}))

vi.mock('@/design-system/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/services/supabaseDocumentService', () => ({
  default: { fetchAllDocuments: mockFetchAllDocuments },
  documentToCamelCase: (row) => row,
}))

vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn(() => ({ cleanup: vi.fn() })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchAllDocuments.mockResolvedValue({})
})

function Probe({ onMount }) {
  React.useEffect(() => {
    onMount()
    // sem cleanup de propósito: cada chamada = um mount real
  }, [onMount])
  return <div data-testid="probe" />
}

describe('DeferredReadyContext — deferral sem remount', () => {
  it('ready=false segura o fetch inicial do provider Tier 2', async () => {
    render(
      <DeferredReadyProvider ready={false}>
        <DocumentsProvider>
          <div />
        </DocumentsProvider>
      </DeferredReadyProvider>
    )
    // margem p/ qualquer microtask disparar fetch indevido
    await new Promise((r) => setTimeout(r, 50))
    expect(mockFetchAllDocuments).not.toHaveBeenCalled()
  })

  it('ready false→true dispara o fetch UMA vez sem remontar os children', async () => {
    const mountSpy = vi.fn()
    const tree = (ready) => (
      <DeferredReadyProvider ready={ready}>
        <DocumentsProvider>
          <Probe onMount={mountSpy} />
        </DocumentsProvider>
      </DeferredReadyProvider>
    )

    const { rerender } = render(tree(false))
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(mockFetchAllDocuments).not.toHaveBeenCalled()

    rerender(tree(true))
    await waitFor(() => expect(mockFetchAllDocuments).toHaveBeenCalledTimes(1))
    // O contrato central: a virada do gate NÃO desmonta o subtree (o bug
    // antigo remontava o App inteiro e refazia todos os fetches do boot).
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  it('provider fora do gate busca no mount (default true — testes/on-demand)', async () => {
    render(
      <DocumentsProvider>
        <div />
      </DocumentsProvider>
    )
    await waitFor(() => expect(mockFetchAllDocuments).toHaveBeenCalledTimes(1))
  })
})
