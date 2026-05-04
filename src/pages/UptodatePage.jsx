/**
 * UptodatePage — Atualizações UpToDate (Anestesiologia).
 *
 * Estrutura espelha NoticiasPage:
 *  1. Header fixo (createPortal): chevron Voltar | "UpToDate" centralizado.
 *  2. Hero: HScroll com top 10 (is_featured) — label "Em destaque" + Sparkles.
 *  3. Lista paginada: PAGE_SIZE = 20, total ≤ 50 (limite no service).
 *
 * Click em item → onNavigate('uptodate-detalhe', { topicId }).
 *
 * CRITICAL: sem AnimatePresence na lista; sem <Carousel> DS (HScroll dedicado).
 */
import { memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, BookMarked, Sparkles } from 'lucide-react'

import { useUptodate } from '@/contexts/UptodateContext'
import { HScroll } from '@/components/noticias/HScroll'
import {
  Button,
  EmptyState,
  Skeleton,
  Badge,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

const PAGE_SIZE = 20

function formatAbsoluteDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function UptodateCarouselCardImpl({ topic, onClick }) {
  const tituloId = `uptodate-c-${topic.id}-titulo`
  const date = formatAbsoluteDate(topic.publicadoEm)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={tituloId}
      className={cn(
        'flex w-full h-[120px] flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left',
        'shadow-sm transition-all',
        'hover:bg-accent/40 hover:border-border-strong active:scale-[0.99]',
        'lg:hover:-translate-y-px lg:hover:shadow-md',
        'dark:shadow-none dark:hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]',
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">
          UpToDate
        </Badge>
        {topic.secao && (
          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
            What's New
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{date}</span>
      </div>
      <h3
        id={tituloId}
        className="text-[14px] font-bold leading-snug text-foreground line-clamp-2"
      >
        {topic.titulo}
      </h3>
      <p className="text-[12px] leading-snug text-muted-foreground line-clamp-1">
        {topic.resumoTexto || '—'}
      </p>
    </button>
  )
}
const UptodateCarouselCard = memo(UptodateCarouselCardImpl)

function UptodateListCardImpl({ topic, onClick }) {
  const tituloId = `uptodate-l-${topic.id}-titulo`
  const date = formatAbsoluteDate(topic.publicadoEm)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={tituloId}
      className={cn(
        'flex w-full min-h-[140px] flex-col rounded-xl border border-border bg-card p-4 text-left',
        'grid grid-rows-[auto_auto_1fr] gap-2',
        topic.isFeatured && 'border-l-4 border-l-primary',
        'transition-all hover:bg-accent/40 hover:border-border-strong active:scale-[0.99]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">
          UpToDate
        </Badge>
        {topic.secao && (
          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
            What's New
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{date}</span>
      </div>
      <h4
        id={tituloId}
        className="text-[15px] font-bold leading-snug text-foreground line-clamp-2"
      >
        {topic.titulo}
      </h4>
      <p className="text-[13px] leading-snug text-muted-foreground line-clamp-2">
        {topic.resumoTexto || '—'}
      </p>
    </button>
  )
}
const UptodateListCard = memo(UptodateListCardImpl)

export default function UptodatePage({ onNavigate, goBack }) {
  const { topics, featured, loading, topicsLoaded, loadFeatured, loadTopics } = useUptodate()
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadFeatured()
    loadTopics()
  }, [loadFeatured, loadTopics])

  // Hero: featured (top 10), fallback nos 10 primeiros se não houver featured ainda
  const top10 = useMemo(() => {
    const src = featured.length > 0 ? featured : topics
    return [...src]
      .sort((a, b) => (b.publicadoEm || '').localeCompare(a.publicadoEm || ''))
      .slice(0, 10)
  }, [featured, topics])

  const listSorted = useMemo(() => {
    return [...topics].sort((a, b) =>
      (b.publicadoEm || '').localeCompare(a.publicadoEm || ''),
    )
  }, [topics])

  const visible = listSorted.slice(0, pageLimit)
  const canLoadMore = pageLimit < listSorted.length

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate?.('noticias'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            UpToDate — Anestesiologia
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
        {loading && !topicsLoaded ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] w-full rounded-xl" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={<BookMarked className="w-10 h-10" />}
            title="Nenhuma atualização disponível"
            description="As atualizações UpToDate são coletadas semanalmente. Volte mais tarde."
          />
        ) : (
          <>
            {top10.length > 0 && (
              <section className="mb-5" aria-label="Em destaque">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                  <h2 className="text-[14px] font-semibold text-foreground">Em destaque</h2>
                </div>
                <HScroll ariaLabel="Destaques UpToDate" showDots loop>
                  {top10.map((t) => (
                    <UptodateCarouselCard
                      key={t.id}
                      topic={t}
                      onClick={() => onNavigate?.('uptodate-detalhe', { topicId: t.id })}
                    />
                  ))}
                </HScroll>
              </section>
            )}

            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Atualizações recentes
            </h3>
            <div className="flex flex-col gap-3">
              {visible.map((t) => (
                <UptodateListCard
                  key={t.id}
                  topic={t}
                  onClick={() => onNavigate?.('uptodate-detalhe', { topicId: t.id })}
                />
              ))}
            </div>

            {canLoadMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPageLimit((p) => p + PAGE_SIZE)}
                >
                  Carregar mais ({listSorted.length - pageLimit} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
