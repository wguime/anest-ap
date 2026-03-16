/**
 * AuditTrailPage
 *
 * Full admin page that wraps AuditTrailViewer to display all document
 * activity across the system. Provides an additional document title/code
 * filter on top of the viewer's built-in action and date filters.
 *
 * @module pages/management/documents/AuditTrailPage
 */

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/design-system/utils/tokens'
import {
  ChevronLeft,
  History,
  Search,
  X,
} from 'lucide-react'
import AuditTrailViewer from '@/components/documents/AuditTrailViewer'

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/**
 * AuditTrailPage - Admin page for viewing all audit trail activity
 *
 * @param {function} onNavigate - Navigation callback for screen-based navigation
 * @param {function} goBack - Callback to navigate back
 */
function AuditTrailPage({ onNavigate, goBack, embedded = false }) {
  const [documentSearch, setDocumentSearch] = useState('')

  const handleBack = useCallback(() => {
    if (goBack) {
      goBack()
    } else if (onNavigate) {
      onNavigate('gestao')
    }
  }, [goBack, onNavigate])

  const handleClearSearch = useCallback(() => {
    setDocumentSearch('')
  }, [])

  // ------------------------------------------------------------------
  // Portal-based fixed header (same pattern as BibliotecaPage, etc.)
  // ------------------------------------------------------------------

  const headerElement = (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'bg-white dark:bg-[#1A2420]',
        'border-b border-[#C8E6C9] dark:border-[#2A3F36]',
        'shadow-sm'
      )}
    >
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          {/* Back button */}
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>

          {/* Page title */}
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Trilha de Auditoria
          </h1>

          {/* Spacer for symmetric layout */}
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  )

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Content block (shared between embedded and standalone modes)
  // ------------------------------------------------------------------

  const content = (
    <>
      {/* Page header with icon */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'flex items-center justify-center',
            'w-12 h-12 rounded-2xl flex-shrink-0',
            'bg-[#E8F5E9] dark:bg-[#243530]'
          )}
        >
          <History className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Historico de Atividades
          </h2>
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
            Todas as alteracoes em documentos do sistema
          </p>
        </div>
      </div>

      {/* Document search filter */}
      <div className="mb-4">
        <div
          className={cn(
            'flex items-center gap-2',
            'px-3 py-2.5 rounded-xl',
            'bg-white dark:bg-[#1A2420]',
            'border border-[#C8E6C9] dark:border-[#2A3F36]',
            'focus-within:ring-2 focus-within:ring-[#006837]/50 dark:focus-within:ring-[#2ECC71]/50',
            'transition-all duration-200'
          )}
        >
          <Search className="w-4 h-4 text-[#6B7280] dark:text-[#A3B8B0] flex-shrink-0" />
          <input
            type="text"
            value={documentSearch}
            onChange={(e) => setDocumentSearch(e.target.value)}
            placeholder="Buscar por titulo ou codigo do documento..."
            className={cn(
              'flex-1 bg-transparent text-sm outline-none',
              'text-gray-900 dark:text-white',
              'placeholder:text-[#6B7280] dark:placeholder:text-[#6B8178]'
            )}
          />
          {documentSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="flex-shrink-0 p-0.5 rounded-full hover:bg-[#E8F5E9] dark:hover:bg-[#243530] transition-colors"
            >
              <X className="w-4 h-4 text-[#6B7280] dark:text-[#A3B8B0]" />
            </button>
          )}
        </div>
        {documentSearch && (
          <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-1.5 px-1">
            Filtrando por: &quot;{documentSearch}&quot;
          </p>
        )}
      </div>

      {/* Audit trail viewer (all activity, admin mode) */}
      <AuditTrailViewer documentoId={null} isAdmin={true} searchFilter={documentSearch} />
    </>
  )

  // ------------------------------------------------------------------
  // Embedded mode: skip portal header, full-page wrapper, and spacer
  // ------------------------------------------------------------------

  if (embedded) {
    return content
  }

  // ------------------------------------------------------------------
  // Standalone mode: full page with portal header
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {content}
      </div>
    </div>
  )
}

export default AuditTrailPage
