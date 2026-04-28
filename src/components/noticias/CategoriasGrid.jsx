/**
 * CategoriasGrid — grid 2-col com 12 categorias temáticas.
 *
 * Cada card mostra ícone e label. Categorias sem artigos seguem visíveis mas
 * desabilitadas. Ordena por contagem desc (mais artigos primeiro) — a contagem
 * é usada apenas para sort, não exibida na UI.
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-2">
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
              'group relative flex flex-col items-center justify-center gap-2 rounded-xl border bg-card px-3 py-4 min-h-[112px]',
              'transition-all',
              empty
                ? 'opacity-40 cursor-not-allowed border-border'
                : 'border-border hover:bg-accent/40 hover:border-border-strong active:scale-[0.97]',
            )}
            aria-label={`Categoria ${c.label}${count ? `, ${count} artigos` : ' (sem artigos)'}`}
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                empty
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary group-hover:bg-primary/15',
              )}
            >
              <Icon className="w-5 h-5" />
            </span>
            <span className="text-[13px] font-semibold leading-tight text-foreground text-center line-clamp-2">
              {c.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default CategoriasGrid
