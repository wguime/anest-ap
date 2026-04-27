/**
 * CategoriasGrid — grid 4-col com 12 categorias temáticas.
 *
 * Ordena por contagem de artigos (mais comum primeiro).
 * Categorias sem artigos ficam com opacity reduzida e desabilitadas.
 *
 * Usado dentro do <Modal> de categorias da NoticiasPage.
 */
import { useMemo } from 'react'
import { cn } from '@/design-system/utils/tokens'
import { CATEGORIES } from './categoriesConfig'

export function CategoriasGrid({ noticias = [], onSelect }) {
  const counts = useMemo(() => {
    const map = new Map()
    for (const n of noticias) {
      if (!n?.category) continue
      map.set(n.category, (map.get(n.category) || 0) + 1)
    }
    return map
  }, [noticias])

  const ordered = useMemo(() => {
    return [...CATEGORIES].sort((a, b) => {
      const ca = counts.get(a.value) || 0
      const cb = counts.get(b.value) || 0
      if (cb !== ca) return cb - ca
      return a.label.localeCompare(b.label, 'pt-BR')
    })
  }, [counts])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {ordered.map((c) => {
        const Icon = c.icon
        const count = counts.get(c.value) || 0
        const empty = count === 0
        return (
          <button
            key={c.value}
            type="button"
            disabled={empty}
            onClick={() => !empty && onSelect?.(c.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-4 min-h-[100px]',
              'transition-all',
              empty
                ? 'opacity-40 cursor-not-allowed border-border'
                : 'border-border hover:border-primary hover:bg-accent/40 active:scale-[0.97]',
            )}
            aria-label={`Categoria ${c.label}${count ? `, ${count} artigos` : ' (sem artigos)'}`}
          >
            <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
            <span className="text-[13px] font-semibold leading-tight text-foreground text-center">
              {c.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default CategoriasGrid
