/**
 * CategoriaNoticiasPage — listagem por categoria temática.
 *
 *  - Header < Voltar + nome da categoria.
 *  - Sub-header: ícone Lucide grande + descrição.
 *  - Hero: top 10 da categoria via HScroll (por finalScore).
 *  - Lista paginada de 20 mais relevantes.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Newspaper, Sparkles } from 'lucide-react'
import { useNoticias } from '@/contexts/NoticiasContext'
import { NoticiaCard } from '@/components/noticias/NoticiaCard'
import { HScroll } from '@/components/noticias/HScroll'
import { getCategoryConfig } from '@/components/noticias/categoriesConfig'
import { Button, Skeleton, EmptyState } from '@/design-system'

const PAGE_SIZE = 20

export default function CategoriaNoticiasPage({ category, onNavigate, goBack }) {
  const { noticias, loading, noticiasLoaded, loadNoticias } = useNoticias()
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadNoticias()
  }, [loadNoticias])

  useEffect(() => {
    setPageLimit(PAGE_SIZE)
  }, [category])

  const config = getCategoryConfig(category)
  const Icon = config?.icon || Newspaper
  const label = config?.label || category || 'Categoria'

  const filtered = useMemo(() => {
    return noticias.filter((n) => n.category === category)
  }, [noticias, category])

  const top10 = useMemo(() => {
    return [...filtered]
      .sort((a, b) => {
        const sa = a.finalScore ?? 0
        const sb = b.finalScore ?? 0
        if (sb !== sa) return sb - sa
        return (b.publicadoEm || '').localeCompare(a.publicadoEm || '')
      })
      .slice(0, 10)
  }, [filtered])

  const sortedRest = useMemo(() => {
    return [...filtered].sort((a, b) =>
      (b.publicadoEm || '').localeCompare(a.publicadoEm || ''),
    )
  }, [filtered])

  const visible = sortedRest.slice(0, pageLimit)
  const canLoadMore = pageLimit < sortedRest.length

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('noticias'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {label}
          </h1>
          <div className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 pt-4 max-w-3xl mx-auto">
        {/* Sub-header com ícone + descrição */}
        <div className="mb-4 flex items-start gap-3">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{label}</h2>
            {config?.description && (
              <p className="text-[13px] text-muted-foreground leading-snug">
                {config.description}
              </p>
            )}
          </div>
        </div>

        {/* Loading / Empty / Lista */}
        {loading && !noticiasLoaded ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title="Nenhuma notícia nesta categoria"
            description="Volte mais tarde — atualizamos semanalmente."
          />
        ) : (
          <>
            {top10.length > 0 && (
              <section className="mb-5" aria-label="Em destaque">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                  <h3 className="text-[14px] font-semibold text-foreground">Em destaque</h3>
                </div>
                <HScroll ariaLabel="Destaques desta categoria">
                  {top10.map((n) => (
                    <NoticiaCard
                      key={n.id}
                      noticia={n}
                      variant="carousel"
                      onClick={() => onNavigate?.('noticia-detalhe', { noticiaId: n.id })}
                    />
                  ))}
                </HScroll>
              </section>
            )}

            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Mais notícias
            </h3>
            <div className="flex flex-col gap-3">
              {visible.map((n) => (
                <NoticiaCard
                  key={n.id}
                  noticia={n}
                  variant="list"
                  onClick={() => onNavigate?.('noticia-detalhe', { noticiaId: n.id })}
                />
              ))}
            </div>

            {canLoadMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPageLimit((p) => p + PAGE_SIZE)}
                >
                  Carregar mais ({sortedRest.length - pageLimit} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
