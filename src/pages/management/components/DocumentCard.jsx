import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, Badge } from '@/design-system'
import { MoreVertical, Eye, Pencil, Archive, AlertTriangle, Calendar, Hash, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'
import { isRevisaoVencida, diasAteRevisao, DOCUMENT_STATUS, STATUS_LABELS } from '@/types/documents'

/**
 * DocumentCard - Generic document card with actions
 *
 * @param {Object} doc - Document object with:
 *   - id: unique identifier
 *   - titulo: document title
 *   - tipo: document type
 *   - codigo: document code
 *   - versao: version number/string
 *   - createdAt: creation date
 *   - status: optional status string
 * @param {Object} config - Type configuration with:
 *   - color: accent color (hex)
 *   - icon: Lucide icon component
 * @param {function} onView - Callback for view action
 * @param {function} onEdit - Callback for edit action
 * @param {function} onArchive - Callback for archive action
 * @param {boolean} isOverdue - Whether document is overdue
 * @param {string} className - Additional CSS classes
 */
function DocumentCard({
  doc,
  config,
  onView,
  onEdit,
  onArchive,
  isOverdue = false,
  variant = 'card',
  className
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const { id, titulo, tipo, codigo, versao, createdAt, status, proximaRevisao } = doc
  const { color = '#006837', icon: TypeIcon } = config || {}

  // Compute review status
  const reviewOverdue = proximaRevisao && status === DOCUMENT_STATUS.ATIVO && isRevisaoVencida(proximaRevisao)
  const reviewDays = proximaRevisao && status === DOCUMENT_STATUS.ATIVO ? diasAteRevisao(proximaRevisao) : null
  const reviewUpcoming = reviewDays !== null && reviewDays > 0 && reviewDays <= 30
  const isPending = status === DOCUMENT_STATUS.PENDENTE

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAction = (action) => {
    setMenuOpen(false)
    action?.(doc)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusVariant = (statusValue) => {
    const statusLower = statusValue?.toLowerCase()
    if (statusLower === 'ativo' || statusLower === 'active' || statusLower === 'aprovado') {
      return 'success'
    }
    if (statusLower === 'pendente' || statusLower === 'pending' || statusLower === 'revisao') {
      return 'warning'
    }
    if (statusLower === 'arquivado' || statusLower === 'archived' || statusLower === 'inativo') {
      return 'secondary'
    }
    return 'default'
  }

  // Handle click on the card itself (opens document)
  const handleCardClick = (e) => {
    // Don't trigger if clicking on the menu button
    if (e.target.closest('button')) return
    onView?.(doc)
  }

  // List variant - compact horizontal row
  if (variant === 'list') {
    return (
      <Card
        className={cn(
          'relative bg-white dark:bg-[#1A2420]',
          'border border-[#C8E6C9] dark:border-[#2A3F36]',
          'rounded-xl shadow-sm',
          'hover:shadow-md transition-all duration-200',
          'group cursor-pointer',
          className
        )}
        style={{
          borderLeftWidth: '4px',
          borderLeftColor: color
        }}
        onClick={handleCardClick}
      >
        <CardContent className="px-3 py-2.5 flex items-center gap-3">
          {/* Type Icon */}
          {TypeIcon && (
            <div
              className="flex-shrink-0 p-2 rounded-lg"
              style={{ backgroundColor: `${color}15`, color }}
            >
              <TypeIcon className="w-4 h-4" />
            </div>
          )}

          {/* Title + Type */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'text-sm font-semibold truncate',
              'text-gray-900 dark:text-white',
              'group-hover:text-[#006837] dark:group-hover:text-[#2ECC71]',
              'transition-colors duration-200'
            )}>
              {titulo}
            </h3>
            {tipo && (
              <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0] truncate">{tipo}</p>
            )}
          </div>

          {/* Badges */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {(isOverdue || reviewOverdue) && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-medium">Vencido</span>
              </div>
            )}
            {codigo && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-[#0D1512] text-xs font-mono text-[#6B7280] dark:text-[#A3B8B0]">
                <Hash className="w-3 h-3" />
                <span>{codigo}</span>
              </div>
            )}
            {status && (
              <Badge variant={getStatusVariant(status)} className="text-[10px]">
                {status}
              </Badge>
            )}
          </div>

          {/* Date */}
          {createdAt && (
            <div className="hidden md:flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#A3B8B0] flex-shrink-0">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(createdAt)}</span>
            </div>
          )}

          {/* Actions Menu */}
          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                'p-1 rounded-lg',
                'text-[#6B7280] dark:text-[#A3B8B0]',
                'hover:bg-gray-100 dark:hover:bg-[#0D1512]',
                'transition-colors duration-150'
              )}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className={cn(
                'absolute right-0 top-full mt-1 z-50',
                'w-44 bg-white dark:bg-[#1A2420] rounded-xl shadow-lg',
                'border border-[#C8E6C9] dark:border-[#2A3F36]',
                'py-1 overflow-hidden',
                'animate-in fade-in-0 zoom-in-95 duration-200'
              )}>
                {onView && (
                  <button onClick={() => handleAction(onView)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#0D1512] transition-colors duration-150">
                    <Eye className="w-4 h-4" /><span>Visualizar</span>
                  </button>
                )}
                {onEdit && (
                  <button onClick={() => handleAction(onEdit)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#0D1512] transition-colors duration-150">
                    <Pencil className="w-4 h-4" /><span>Editar</span>
                  </button>
                )}
                {onArchive && (
                  <>
                    <div className="border-t border-[#C8E6C9] dark:border-[#2A3F36] my-1" />
                    <button onClick={() => handleAction(onArchive)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors duration-150">
                      <Archive className="w-4 h-4" /><span>Arquivar</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Card variant - default grid card
  return (
    <Card
      className={cn(
        'relative bg-white dark:bg-[#1A2420]',
        'border border-[#C8E6C9] dark:border-[#2A3F36]',
        'rounded-2xl shadow-sm',
        'hover:shadow-md transition-all duration-200',
        'group cursor-pointer',
        'h-full flex flex-col',
        className
      )}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: color
      }}
      onClick={handleCardClick}
    >
      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-4 flex-1">
          {/* Type Icon */}
          {TypeIcon && (
            <div
              className={cn(
                'flex-shrink-0 p-3 rounded-xl',
                'transition-transform duration-200 group-hover:scale-105'
              )}
              style={{
                backgroundColor: `${color}15`,
                color: color
              }}
            >
              <TypeIcon className="w-5 h-5" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Header Row */}
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h3 className={cn(
                  'text-base font-semibold line-clamp-2 lg:line-clamp-3 leading-tight mb-1',
                  'text-gray-900 dark:text-white',
                  'group-hover:text-[#006837] dark:group-hover:text-[#2ECC71]',
                  'transition-colors duration-200'
                )}>
                  {titulo}
                </h3>

                {/* Type */}
                {tipo && (
                  <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0]">
                    {tipo}
                  </p>
                )}
              </div>

              {/* Actions Menu */}
              <div ref={menuRef} className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={cn(
                    'p-1.5 rounded-lg',
                    'text-[#6B7280] dark:text-[#A3B8B0]',
                    'hover:bg-gray-100 dark:hover:bg-[#0D1512]',
                    'hover:text-gray-900 dark:hover:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-[#2ECC71]/50',
                    'transition-colors duration-150'
                  )}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                  <div className={cn(
                    'absolute right-0 top-full mt-1 z-50',
                    'w-44 bg-white dark:bg-[#1A2420] rounded-xl shadow-lg',
                    'border border-[#C8E6C9] dark:border-[#2A3F36]',
                    'py-1 overflow-hidden',
                    'animate-in fade-in-0 zoom-in-95 duration-200'
                  )}>
                    {onView && (
                      <button
                        onClick={() => handleAction(onView)}
                        className={cn(
                          'w-full flex items-center gap-2 px-4 py-2 text-sm',
                          'text-gray-700 dark:text-gray-300',
                          'hover:bg-gray-50 dark:hover:bg-[#0D1512]',
                          'transition-colors duration-150'
                        )}
                      >
                        <Eye className="w-4 h-4" />
                        <span>Visualizar</span>
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => handleAction(onEdit)}
                        className={cn(
                          'w-full flex items-center gap-2 px-4 py-2 text-sm',
                          'text-gray-700 dark:text-gray-300',
                          'hover:bg-gray-50 dark:hover:bg-[#0D1512]',
                          'transition-colors duration-150'
                        )}
                      >
                        <Pencil className="w-4 h-4" />
                        <span>Editar</span>
                      </button>
                    )}
                    {onArchive && (
                      <>
                        <div className="border-t border-[#C8E6C9] dark:border-[#2A3F36] my-1" />
                        <button
                          onClick={() => handleAction(onArchive)}
                          className={cn(
                            'w-full flex items-center gap-2 px-4 py-2 text-sm',
                            'text-amber-600 dark:text-amber-400',
                            'hover:bg-amber-50 dark:hover:bg-amber-900/20',
                            'transition-colors duration-150'
                          )}
                        >
                          <Archive className="w-4 h-4" />
                          <span>Arquivar</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Review / Status Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(isOverdue || reviewOverdue) && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg',
                  'bg-red-100 dark:bg-red-900/30',
                  'text-red-700 dark:text-red-400'
                )}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-medium whitespace-nowrap">Vencido</span>
                </div>
              )}
              {!isOverdue && !reviewOverdue && reviewUpcoming && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg',
                  'bg-amber-100 dark:bg-amber-900/30',
                  'text-amber-700 dark:text-amber-400'
                )}>
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-medium whitespace-nowrap">{reviewDays}d</span>
                </div>
              )}
              {isPending && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg',
                  'bg-amber-100 dark:bg-amber-900/30',
                  'text-amber-700 dark:text-amber-400'
                )}>
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-medium whitespace-nowrap">Pendente</span>
                </div>
              )}
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-2 mt-auto">
              {/* Code */}
              {codigo && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg',
                  'bg-gray-100 dark:bg-[#0D1512]',
                  'text-xs font-mono text-[#6B7280] dark:text-[#A3B8B0]'
                )}>
                  <Hash className="w-3 h-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">{codigo}</span>
                </div>
              )}

              {/* Version Badge */}
              {versao && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    'border-[#006837] text-[#006837]',
                    'dark:border-[#2ECC71] dark:text-[#2ECC71]'
                  )}
                >
                  v{versao}
                </Badge>
              )}

              {/* Status Badge */}
              {status && (
                <Badge
                  variant={getStatusVariant(status)}
                  className="text-xs whitespace-nowrap"
                >
                  {status}
                </Badge>
              )}

              {/* Date */}
              {createdAt && (
                <div className={cn(
                  'flex items-center gap-1',
                  'text-xs text-[#6B7280] dark:text-[#A3B8B0]',
                  'w-full sm:w-auto sm:ml-auto'
                )}>
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">{formatDate(createdAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DocumentCard
