import { cn } from '@/design-system/utils/tokens'

/**
 * SectionCardSelector — seletor de cards compacto para sub-navegação de seções
 * do Centro de Gestão (Incidentes, Comunicados). Linha de cards baixos (≥44px
 * touch), card ativo destacado. Tokens DS, acessível.
 *
 * Props:
 * - items: [{ id, label, icon, badge? }]  (icon = componente lucide; badge opcional)
 * - active: id do card ativo
 * - onChange: (id) => void
 */
const cap = (n) => (n > 99 ? '99+' : n)

export default function SectionCardSelector({ items = [], active, onChange, className }) {
  if (!items.length) return null

  const cols =
    items.length >= 3 ? 'grid-cols-3' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <div className={cn('grid gap-2', cols, className)}>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.id === active
        const hasBadge = item.badge != null && item.badge !== '' && Number(item.badge) > 0
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange?.(item.id)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1.5',
              'min-h-[64px] px-3 py-2.5 rounded-2xl border text-center',
              'transition-all duration-200 active:scale-[0.98]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-primary bg-muted text-primary shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40'
            )}
          >
            {Icon && <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />}
            <span className="text-xs font-semibold leading-tight">{item.label}</span>
            {hasBadge && (
              <span className="absolute top-1.5 right-1.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold bg-destructive text-white ring-2 ring-card">
                {cap(Number(item.badge))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
