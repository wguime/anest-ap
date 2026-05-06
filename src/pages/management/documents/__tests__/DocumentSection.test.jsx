/**
 * DocumentSection — parametrized smoke tests.
 *
 * Wave 3 / W3-1 — verifies the consolidated section renders without error
 * for every categoryId in SECTION_CONFIG, and shows the expected label/empty state.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentSection from '../DocumentSection'
import { SECTION_CONFIG } from '../sectionConfig'

// ──────────────────────────────────────────────────────────────────────────────
// Mock useDocuments — although DocumentSection receives docs via props, the
// hook may be referenced transitively by child components. Returning a stub
// list keeps tests deterministic.
// ──────────────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: () => ({
    documents: {},
    counts: {},
    isLoading: false,
    isInitialized: true,
    isReady: true,
    error: null,
    overdueDocuments: [],
    upcomingReviews: [],
    pendingApproval: [],
    searchAllDocuments: () => [],
  }),
}))

// Mock the Documents context too (defensive — DocumentCard transitively uses it)
vi.mock('@/contexts/DocumentsContext', () => ({
  useDocumentsContext: () => ({
    documents: {},
    counts: {},
    isLoading: false,
    isInitialized: true,
    error: null,
    searchAllDocuments: () => [],
    overdueDocuments: [],
    upcomingReviews: [],
    pendingApproval: [],
  }),
}))

// ──────────────────────────────────────────────────────────────────────────────
// Stub list — empty triggers the empty state, which is the most reliable
// signal that the section rendered through to the configured copy.
// ──────────────────────────────────────────────────────────────────────────────
const STUB_DOCS = []

describe('DocumentSection (parametrized)', () => {
  it.each(Object.keys(SECTION_CONFIG))(
    'renders without error for categoryId="%s"',
    (categoryId) => {
      const { container } = render(
        <DocumentSection
          categoryId={categoryId}
          activeSubTab="documentos"
          docs={STUB_DOCS}
          isLoading={false}
        />
      )

      // Must produce DOM
      expect(container.firstChild).toBeTruthy()

      // Empty-state title from config should appear (or the "search" placeholder
      // text from FilterBar). Either confirms the section reached its render path.
      const config = SECTION_CONFIG[categoryId]
      expect(config).toBeDefined()
      // Empty-state title is the strongest signal with empty docs
      expect(screen.getByText(config.emptyTitle)).toBeInTheDocument()
    }
  )

  it.each(Object.keys(SECTION_CONFIG))(
    'renders categorias sub-tab for categoryId="%s"',
    (categoryId) => {
      render(
        <DocumentSection
          categoryId={categoryId}
          activeSubTab="categorias"
          docs={STUB_DOCS}
          isLoading={false}
        />
      )
      // The categorias tab always renders a "Categorias de Documentos" heading
      expect(screen.getByText('Categorias de Documentos')).toBeInTheDocument()
    }
  )

  it('renders nothing for unknown categoryId', () => {
    const { container } = render(
      <DocumentSection categoryId="nonexistent" activeSubTab="documentos" docs={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders SectionLoading skeleton when isLoading=true', () => {
    const { container } = render(
      <DocumentSection categoryId="etica" activeSubTab="documentos" docs={[]} isLoading={true} />
    )
    // SectionLoading sets aria-busy=true on its root
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })
})
