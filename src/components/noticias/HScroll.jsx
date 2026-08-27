/**
 * HScroll — substituto leve do <Carousel> do DS.
 *
 * CRITICAL: NÃO trocar por <Carousel> do design-system.
 * O Carousel DS aplica `snap-mandatory` sem `touch-action` controlado, o que
 * captura o pan-y do toque mobile e trava o scroll vertical da página inteira.
 *
 * Este componente:
 *  - usa apenas overflow-x-auto + touch-action: pan-x
 *  - itens shrink-0 com largura responsiva
 *  - sem snap-mandatory (snap-start opcional para alinhar)
 *
 * Props opcionais:
 *  - showDots: renderiza bolinhas indicadoras abaixo (uma por item)
 *  - loop: ao chegar no último item, próximo swipe/click volta para o primeiro
 *  - ariaLabel: descrição da região
 */
import { useEffect, useRef, useState, useCallback, Children } from 'react'
import { cn } from '@/design-system/utils/tokens'

export function HScroll({
  children,
  className,
  itemClassName,
  ariaLabel,
  showDots = false,
  loop = false,
}) {
  const containerRef = useRef(null)
  const itemRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(0)

  const items = Children.toArray(children).filter(Boolean)
  const count = items.length

  // Detecta o item mais visível usando IntersectionObserver
  useEffect(() => {
    if (!showDots && !loop) return
    if (count === 0) return
    const root = containerRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Pega o entry com maior intersectionRatio
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const idx = Number(visible.target.dataset.idx)
          if (!Number.isNaN(idx)) setActiveIndex(idx)
        }
      },
      {
        root,
        threshold: [0.5, 0.75],
      },
    )

    itemRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [count, showDots, loop])

  const scrollToIndex = useCallback((idx) => {
    const target = itemRefs.current[idx]
    const root = containerRef.current
    if (!target || !root) return
    const offsetLeft = target.offsetLeft - root.offsetLeft
    root.scrollTo({ left: offsetLeft, behavior: 'smooth' })
  }, [])

  // Loop: detecta quando user scrollou além do último item e teleporta para o primeiro
  useEffect(() => {
    if (!loop || count <= 1) return
    const root = containerRef.current
    if (!root) return

    let timeout = null
    const onScroll = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (!root) return
        const maxScroll = root.scrollWidth - root.clientWidth
        // Se está praticamente no fim e ainda há tentativa de scroll → volta pro início
        if (root.scrollLeft >= maxScroll - 4) {
          // pequena pausa para sentir que chegou no fim antes de voltar
          setTimeout(() => {
            if (root) root.scrollTo({ left: 0, behavior: 'smooth' })
          }, 600)
        }
      }, 120)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (timeout) clearTimeout(timeout)
    }
  }, [loop, count])

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        className={cn(
          'flex w-full gap-3 overflow-x-auto pb-2 deitado:pb-1',
          // Esconde a scrollbar nativa em todos os navegadores (Firefox, IE, WebKit)
          '[&::-webkit-scrollbar]:hidden',
          className,
        )}
        style={{
          touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {items.map((child, i) => (
          <div
            key={child?.key ?? i}
            ref={(el) => (itemRefs.current[i] = el)}
            data-idx={i}
            className={cn(
              'shrink-0 w-[88%] sm:w-[420px]',
              // deitado o carrossel tem a largura inteira: cabem dois artigos
              // lado a lado no lugar de um só.
              'deitado:w-[48%]',
              itemClassName
            )}
          >
            {child}
          </div>
        ))}
      </div>

      {showDots && count > 1 && (
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Navegação do carrossel">
          {items.map((_, i) => {
            const isActive = i === activeIndex
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Ir para item ${i + 1} de ${count}`}
                onClick={() => scrollToIndex(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  isActive
                    ? 'w-5 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50',
                )}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HScroll
