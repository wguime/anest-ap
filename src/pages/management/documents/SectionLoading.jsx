import { Skeleton } from '@/design-system/components/ui/skeleton'

/**
 * SectionLoading — esqueleto visual exibido enquanto documentos carregam
 * em uma *Section.jsx do Centro de Gestão.
 *
 * Mantém o layout coerente com FilterBar + grid de DocumentCard:
 *  - 1 linha de filtros (skeleton button-like)
 *  - 6 cards skeleton em grid responsivo (1/2/3 colunas)
 *
 * Usa apenas tokens DS via Skeleton (sem hex hardcoded).
 */
export function SectionLoading({ count = 6 }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {/* Filter bar skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton variant="custom" height={40} className="flex-1 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton variant="custom" width={120} height={40} className="rounded-xl" />
          <Skeleton variant="custom" width={120} height={40} className="rounded-xl" />
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, idx) => (
           
          <Skeleton key={idx} variant="card" />
        ))}
      </div>

      <span className="sr-only">Carregando documentos…</span>
    </div>
  )
}

export default SectionLoading
