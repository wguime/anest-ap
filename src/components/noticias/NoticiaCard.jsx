import { Newspaper, ExternalLink } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

/**
 * NoticiaCard — card reutilizável para exibir notícia.
 *
 * @param {object} noticia    - { id, titulo, resumo, fonte, categoria, publicadoEm, fontesExtras }
 * @param {string} variant    - 'carousel' (slide full-width) | 'list' (item compacto)
 * @param {() => void} onClick
 */

const CATEGORIA_COLOR = {
  pesquisa: 'category-blue',
  sociedade: 'category-teal',
  clinica: 'category-purple',
  noticia: 'category-orange',
}

function getCategoryClasses(categoria) {
  const token = CATEGORIA_COLOR[categoria] || 'category-blue'
  return {
    bg: `bg-${token}-bg`,
    fg: `text-${token}-fg`,
    border: `border-${token}/30`,
  }
}

function formatRelative(dateIso) {
  if (!dateIso) return ''
  const d = new Date(dateIso)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function NoticiaCard({ noticia, variant = 'list', onClick, className }) {
  if (!noticia) return null
  const cats = getCategoryClasses(noticia.categoria)
  const tituloId = `noticia-${noticia.id}-titulo`

  if (variant === 'carousel') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-labelledby={tituloId}
        className={cn(
          'flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left',
          'shadow-[0_2px_12px_rgba(0,66,37,0.06)] transition-all',
          'hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99]',
          'dark:shadow-none min-h-[140px]',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cats.bg, cats.fg)}>
            <Newspaper className="h-3 w-3" aria-hidden="true" />
            {noticia.fonte}
          </span>
          {noticia.categoria && (
            <span className="text-[11px] font-medium text-muted-foreground capitalize">
              {noticia.categoria}
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatRelative(noticia.publicadoEm)}
          </span>
        </div>
        <h3
          id={tituloId}
          className="text-[15px] font-bold leading-snug text-foreground line-clamp-2"
        >
          {noticia.titulo}
        </h3>
        {noticia.resumo && (
          <p className="text-[13px] leading-snug text-muted-foreground line-clamp-2">
            {noticia.resumo}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
          Ler mais
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>
    )
  }

  // variant === 'list'
  const fontesExtras = Array.isArray(noticia.fontesExtras) ? noticia.fontesExtras : []
  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={tituloId}
      className={cn(
        'flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left',
        'transition-all hover:bg-accent/40 hover:border-border-strong active:scale-[0.99]',
        'min-h-[44px]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cats.bg, cats.fg)}>
          <Newspaper className="h-3 w-3" aria-hidden="true" />
          {noticia.fonte}
        </span>
        {noticia.categoria && (
          <span className="text-[11px] font-medium text-muted-foreground capitalize">
            {noticia.categoria}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatRelative(noticia.publicadoEm)}
        </span>
      </div>
      <h4 id={tituloId} className="text-[15px] font-bold leading-snug text-foreground line-clamp-2">
        {noticia.titulo}
      </h4>
      {noticia.resumo && (
        <p className="text-[13px] leading-snug text-muted-foreground line-clamp-2">
          {noticia.resumo}
        </p>
      )}
      {fontesExtras.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          também em: {fontesExtras.map((f) => f.fonte).join(', ')}
        </p>
      )}
    </button>
  )
}

export default NoticiaCard
