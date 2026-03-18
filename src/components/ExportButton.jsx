/**
 * ExportButton - Reusable PDF export button component
 *
 * Green-themed button with Download icon and Spinner during export.
 * Designed to integrate with usePdfExport hook.
 */

import { Download, Loader2 } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

/**
 * @param {Object} props
 * @param {Function} props.onExport - Called when button is clicked
 * @param {boolean} [props.loading=false] - Shows spinner when true
 * @param {string} [props.label='Exportar PDF'] - Button label
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.size='default'] - 'sm' | 'default'
 * @param {boolean} [props.disabled=false] - Disable button
 */
export default function ExportButton({
  onExport,
  loading = false,
  label = 'Exportar PDF',
  className,
  size = 'default',
  disabled = false,
}) {
  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-lg transition-all',
        'bg-primary text-white hover:bg-[#005530] active:bg-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'dark:bg-primary dark:text-primary-foreground dark:hover:bg-[#27ae60] dark:active:bg-[#219a52]',
        isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        className
      )}
    >
      {loading ? (
        <Loader2 className={cn('animate-spin', isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      ) : (
        <Download className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      )}
      {loading ? 'Gerando...' : label}
    </button>
  )
}
