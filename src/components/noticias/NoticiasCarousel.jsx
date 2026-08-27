/**
 * NoticiasCarousel — "Destaques Científicos" na HomePage.
 *
 * CRITICAL: NÃO usar <Carousel> do design-system aqui — ele causa scroll
 * vertical travado em mobile (snap-mandatory + falta de touch-action).
 * Usar HScroll próprio.
 *
 * Lê do contexto (cache stale-while-revalidate). Não dispara fetch novo.
 * Esconde-se inteiramente se highlights estiver vazio.
 */
import { useEffect, useMemo } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useNoticias } from '@/contexts/NoticiasContext'
import { ordenarDestaques } from '@/lib/noticiasDestaques'
import { NoticiaCard } from './NoticiaCard'
import { HScroll } from './HScroll'

export function NoticiasCarousel({ onNavigate }) {
  const { highlights, highlightsLoaded, loadHighlights } = useNoticias()

  useEffect(() => {
    loadHighlights()
  }, [loadHighlights])

  const top10 = useMemo(
    () => ordenarDestaques(highlights).slice(0, 10),
    [highlights],
  )

  if (!highlightsLoaded || top10.length === 0) {
    return null
  }

  return (
    <section className="mb-4 deitado:mb-2" aria-label="Destaques Científicos">
      <div className="flex items-center justify-between mb-2 deitado:mb-1 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-foreground">
            Destaques Científicos
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('noticias')}
          className="inline-flex items-center gap-0.5 text-[12px] font-medium text-primary hover:opacity-70 transition-opacity"
        >
          Ver todos
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      <HScroll ariaLabel="Lista horizontal de destaques" showDots loop>
        {top10.map((noticia) => (
          <NoticiaCard
            key={noticia.id}
            noticia={noticia}
            variant="carousel"
            onClick={() => onNavigate?.('noticia-detalhe', { noticiaId: noticia.id })}
          />
        ))}
      </HScroll>
    </section>
  )
}

export default NoticiasCarousel
