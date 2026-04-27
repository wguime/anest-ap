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
 *  - sem snap, sem listener onScroll, sem state interno
 *
 * Use para qualquer lista horizontal de cards/notícias.
 */
import { cn } from '@/design-system/utils/tokens'

export function HScroll({ children, className, itemClassName, ariaLabel }) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full gap-3 overflow-x-auto pb-2',
        'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
        className,
      )}
      style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={child?.key ?? i}
              className={cn('shrink-0 w-[88%] sm:w-[420px]', itemClassName)}
            >
              {child}
            </div>
          ))
        : children && (
            <div className={cn('shrink-0 w-[88%] sm:w-[420px]', itemClassName)}>
              {children}
            </div>
          )}
    </div>
  )
}

export default HScroll
