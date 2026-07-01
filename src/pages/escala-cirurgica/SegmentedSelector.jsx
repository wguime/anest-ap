/**
 * SegmentedSelector — botões segmentados (mesmo estilo do módulo Cateter Peridural).
 * Usado para hospital, turno e abas internas. Mobile-first (touch ≥44px).
 */
export default function SegmentedSelector({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`py-3 px-3 min-h-[44px] rounded-[16px] border text-sm font-medium transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${
              active
                ? 'border-[hsl(var(--primary-hover))] bg-primary/10 text-primary dark:border-[hsl(var(--primary))] dark:bg-primary/20'
                : 'border-[hsl(var(--input))] bg-card text-muted-foreground'
            }`}
          >
            {opt.label}
            {opt.badge != null && opt.badge > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none bg-primary text-white">
                {opt.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
