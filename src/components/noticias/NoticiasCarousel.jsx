import { useEffect } from 'react'
import { Carousel, CarouselSlide } from '@/design-system/components/ui/carousel'
import { useNoticias } from '@/contexts/NoticiasContext'
import { NoticiaCard } from './NoticiaCard'

/**
 * NoticiasCarousel — carrossel de notícias para a HomePage.
 * Posicionado abaixo da SearchBar. Esconde-se inteiramente se não houver dados.
 */
export function NoticiasCarousel({ onNavigate }) {
  const { highlights, highlightsLoaded, loadHighlights } = useNoticias()

  useEffect(() => {
    loadHighlights()
  }, [loadHighlights])

  if (!highlightsLoaded || highlights.length === 0) {
    return null
  }

  return (
    <div className="mb-4" aria-label="Últimas notícias de anestesiologia">
      <Carousel
        autoplay
        autoplayInterval={6000}
        loop
        showIndicators
        showControls={false}
      >
        {highlights.map((noticia) => (
          <CarouselSlide key={noticia.id}>
            <NoticiaCard
              noticia={noticia}
              variant="carousel"
              onClick={() => onNavigate('noticia-detalhe', { noticiaId: noticia.id })}
            />
          </CarouselSlide>
        ))}
      </Carousel>
    </div>
  )
}

export default NoticiasCarousel
