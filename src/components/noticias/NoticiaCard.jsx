/**
 * NoticiaCard — card de notícia com 3 variants.
 *
 *  - 'carousel': h-[150px] fixo, 2 linhas título + 1 resumo. Usado em HScroll.
 *  - 'list':     min-h-[140px] + grid 3 fileiras (meta / título 2-line / resumo 2-line).
 *                Layout uniforme mesmo com resumos vazios (placeholder "—").
 *  - 'featured': similar a list mas com border-l-primary marcando destaque.
 *
 * Memoizado com comparator customizado (id, variant, tituloPt, resumoPt) —
 * evita re-renders quando outros campos da notícia mudam.
 */
import { memo } from 'react'
import { Newspaper, Lock, BookOpen, Award } from 'lucide-react'
import { Badge } from '@/design-system/components/ui/badge'
import { cn } from '@/design-system/utils/tokens'
import { formatDate } from '@/utils/formatters'

function formatAbsoluteDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return formatDate(d, 'dayMonth').replace('.', '')
}

function pickTitle(n) {
  return n?.tituloPt || n?.titulo || ''
}

function pickResumo(n) {
  // Preferência: tradução PT → original EN → autores como fallback
  // (Editorials/Letters frequentemente não têm abstract no PubMed.)
  const r = n?.resumoPt || n?.resumo
  if (r && r.trim()) return r.trim()
  if (n?.autores && n.autores.trim()) return n.autores.trim()
  return ''
}

function NoticiaCardImpl({ noticia, variant = 'list', onClick, className }) {
  if (!noticia) return null
  const titulo = pickTitle(noticia)
  const resumo = pickResumo(noticia)
  const tituloId = `noticia-${noticia.id}-titulo`
  const isOA = Boolean(noticia.oaPdfUrl || noticia.pmcId)
  const date = formatAbsoluteDate(noticia.publicadoEm)

  if (variant === 'carousel') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-labelledby={tituloId}
        className={cn(
          'flex w-full h-[120px] flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left',
          'shadow-sm transition-all',
          'hover:bg-accent/40 hover:border-border-strong hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98]',
          'dark:shadow-none dark:hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">
            {noticia.fonte}
          </Badge>
          {/* No carousel (altura fixa, sem wrap) a curadoria ocupa o lugar do
              tipo de artigo — é o selo mais forte e não cabem os dois a 375px */}
          {noticia.curadoriaPor ? (
            <Badge variant="default" badgeStyle="subtle" className="text-[10px] gap-1 min-w-0">
              <Award className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Curadoria {noticia.curadoriaPor}</span>
            </Badge>
          ) : noticia.articleType ? (
            <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
              {noticia.articleType}
            </Badge>
          ) : null}
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{date}</span>
        </div>
        <h3
          id={tituloId}
          className="text-[14px] font-bold leading-snug text-foreground line-clamp-2"
        >
          {titulo}
        </h3>
        <p className="text-[12px] leading-snug text-muted-foreground line-clamp-1">
          {resumo || '—'}
        </p>
      </button>
    )
  }

  // list / featured
  const isFeaturedVariant = variant === 'featured' || noticia.isFeatured
  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={tituloId}
      className={cn(
        'flex w-full min-h-[140px] flex-col rounded-xl border border-border bg-card p-4 text-left',
        'grid grid-rows-[auto_auto_1fr] gap-2',
        isFeaturedVariant && 'border-l-4 border-l-primary',
        'transition-all hover:bg-accent/40 hover:border-border-strong hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98]',
        className,
      )}
    >
      {/* Linha 1: meta */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">
          {noticia.fonte}
        </Badge>
        {noticia.articleType && (
          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
            {noticia.articleType}
          </Badge>
        )}
        {noticia.curadoriaPor && (
          <Badge variant="default" badgeStyle="subtle" className="text-[10px] gap-1">
            <Award className="h-3 w-3" aria-hidden="true" />
            Curadoria {noticia.curadoriaPor}
          </Badge>
        )}
        {isOA ? (
          <Badge variant="success" badgeStyle="subtle" className="text-[10px] gap-1">
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            Open Access
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Paywall
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{date}</span>
      </div>

      {/* Linha 2: título */}
      <h4
        id={tituloId}
        className="text-[15px] font-bold leading-snug text-foreground line-clamp-2"
      >
        {titulo}
      </h4>

      {/* Linha 3: resumo (sempre 2 linhas, com placeholder se vazio) */}
      <p className="text-[13px] leading-snug text-muted-foreground line-clamp-2">
        {resumo || '—'}
      </p>
    </button>
  )
}

function arePropsEqual(prev, next) {
  if (prev.variant !== next.variant) return false
  if (prev.onClick !== next.onClick) return false
  if (prev.className !== next.className) return false
  const a = prev.noticia
  const b = next.noticia
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.tituloPt === b.tituloPt &&
    a.resumoPt === b.resumoPt &&
    a.titulo === b.titulo &&
    a.oaPdfUrl === b.oaPdfUrl &&
    a.pmcId === b.pmcId &&
    a.isFeatured === b.isFeatured &&
    a.articleType === b.articleType &&
    a.curadoriaPor === b.curadoriaPor
  )
}

export const NoticiaCard = memo(NoticiaCardImpl, arePropsEqual)
NoticiaCard.displayName = 'NoticiaCard'

export default NoticiaCard
