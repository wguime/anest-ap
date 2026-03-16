/**
 * AuditTrailModal Component
 *
 * Portal-based modal that displays the full change history (audit trail) of a
 * document. Renders the ChangeLogTimeline inside a centered overlay.
 *
 * @module management/components/AuditTrailModal
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/design-system/utils/tokens'
import { useToast } from '@/design-system'
import { X, History, Download } from 'lucide-react'
import ChangeLogTimeline from './ChangeLogTimeline'

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'criacao', label: 'Criacao' },
  { value: 'edicao', label: 'Edicao' },
  { value: 'aprovacao', label: 'Aprovacao' },
  { value: 'arquivamento', label: 'Arquivamento' }
]

const DATE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' }
]

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncates a string to a maximum length, appending ellipsis when necessary.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function truncate(text, max = 48) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AuditTrailModal Component
 *
 * Displays a document's complete change log in a portal-rendered modal overlay.
 *
 * @param {Object} props
 * @param {boolean} props.open - Controls visibility of the modal
 * @param {Function} props.onClose - Callback invoked to close the modal
 * @param {Object} props.document - Document object containing `titulo` (string) and `changeLog` (array)
 */
function AuditTrailModal({ open, onClose, document: doc }) {
  const { toast } = useToast()
  const [filterAction, setFilterAction] = useState('all')
  const [filterDateRange, setFilterDateRange] = useState('all')

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll while modal is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const changeLog = doc?.changeLog || []
  const hasEntries = changeLog.length > 0
  const entryCount = changeLog.length

  const handleExport = () => {
    toast({ title: 'Em breve', description: 'Exportação do histórico será disponibilizada em breve.' })
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Historico de Alteracoes"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg',
          'bg-white dark:bg-[#1A2420]',
          'rounded-2xl shadow-xl',
          'border border-[#C8E6C9] dark:border-[#2A3F36]',
          'flex flex-col',
          'max-h-[calc(100vh-32px)]'
        )}
      >
        {/* ---- Header ---- */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-[#C8E6C9] dark:border-[#2A3F36]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'w-10 h-10 rounded-xl shrink-0',
                'bg-[#006837]/10 dark:bg-[#2ECC71]/20',
                'flex items-center justify-center'
              )}
            >
              <History className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  Historico de Alteracoes
                </h2>
                {hasEntries && (
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      'bg-[#006837]/10 text-[#006837]',
                      'dark:bg-[#2ECC71]/15 dark:text-[#2ECC71]'
                    )}
                  >
                    {entryCount} {entryCount === 1 ? 'registro' : 'registros'}
                  </span>
                )}
              </div>
              {doc?.titulo && (
                <p
                  className="text-sm text-[#6B7280] dark:text-[#A3B8B0] truncate mt-0.5"
                  title={doc.titulo}
                >
                  {truncate(doc.titulo)}
                </p>
              )}
            </div>
          </div>

          {/* Export + Close buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              className={cn(
                'w-9 h-9 rounded-xl',
                'flex items-center justify-center',
                'text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white',
                'hover:bg-[#F3F4F6] dark:hover:bg-[#2A3F36]',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ECC71]/50'
              )}
              aria-label="Exportar"
              title="Exportar historico"
            >
              <Download className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'w-9 h-9 rounded-xl',
                'flex items-center justify-center',
                'text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white',
                'hover:bg-[#F3F4F6] dark:hover:bg-[#2A3F36]',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ECC71]/50'
              )}
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ---- Body ---- */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 overscroll-contain">
          {hasEntries ? (
            <>
              {/* Filter pills */}
              <div className="space-y-3 mb-5">
                {/* Action filter pills */}
                <div className="flex flex-wrap gap-1.5">
                  {ACTION_FILTERS.map(filter => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setFilterAction(filter.value)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ECC71]/50',
                        filterAction === filter.value
                          ? 'bg-[#006837] text-white dark:bg-[#2ECC71] dark:text-[#0D1512]'
                          : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] dark:bg-[#2A3F36] dark:text-[#A3B8B0] dark:hover:bg-[#354A42]'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Date range pills */}
                <div className="flex flex-wrap gap-1.5">
                  {DATE_FILTERS.map(filter => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setFilterDateRange(filter.value)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ECC71]/50',
                        filterDateRange === filter.value
                          ? 'bg-[#1565C0] text-white dark:bg-[#42A5F5] dark:text-[#0D1512]'
                          : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] dark:bg-[#2A3F36] dark:text-[#A3B8B0] dark:hover:bg-[#354A42]'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <ChangeLogTimeline
                entries={changeLog}
                filterAction={filterAction !== 'all' ? filterAction : undefined}
                filterDateRange={filterDateRange}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl mb-4',
                  'bg-[#F3F4F6] dark:bg-[#2A3F36]',
                  'flex items-center justify-center'
                )}
              >
                <History className="w-7 h-7 text-[#9CA3AF] dark:text-[#6B8178]" />
              </div>
              <p className="text-sm font-medium text-[#6B7280] dark:text-[#A3B8B0]">
                Nenhum historico disponivel
              </p>
              <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mt-1">
                As alteracoes deste documento serao exibidas aqui.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default AuditTrailModal
