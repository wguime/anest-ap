/**
 * SegmentedSelector — botões segmentados (mesmo estilo do módulo Cateter Peridural).
 * Usado para hospital, turno, data e abas internas. Mobile-first (touch ≥44px).
 *
 * variant='outline' (padrão): pílulas separadas, selecionada = tinta + borda (hospital/data/turno).
 * variant='filled' (pedido do dono 24/07): trilho claro único + selecionada em VERDE SÓLIDO
 * (branco no texto) — diferencia as ABAS de visualização do filtro de hospital.
 */
export default function SegmentedSelector({ options, value, onChange, className = '', variant = 'outline' }) {
  const filled = variant === 'filled'
  const badge = (opt) =>
    opt.badge != null && opt.badge > 0 ? (
      <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
        value === opt.value && filled ? 'bg-white/25 text-white' : 'bg-primary text-white'
      }`}>
        {opt.badge}
      </span>
    ) : null

  return (
    <div
      className={filled
        ? `grid gap-1 rounded-[16px] bg-primary/5 p-1 dark:bg-primary/10 ${className}`
        : `grid gap-2 ${className}`}
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
            className={filled
              ? `min-h-[42px] rounded-[12px] px-3 py-2.5 text-sm font-medium transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${
                  active
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'bg-transparent text-muted-foreground'
                }`
              : `py-3 px-3 min-h-[44px] rounded-[16px] border text-sm font-medium transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${
                  active
                    ? 'border-[hsl(var(--primary-hover))] bg-primary/10 text-primary dark:border-[hsl(var(--primary))] dark:bg-primary/20'
                    : 'border-[hsl(var(--input))] bg-card text-muted-foreground'
                }`}
          >
            {opt.label}
            {badge(opt)}
          </button>
        )
      })}
    </div>
  )
}
