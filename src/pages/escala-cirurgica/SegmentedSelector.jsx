/**
 * SegmentedSelector — botões segmentados (mesmo estilo do módulo Cateter Peridural).
 * Usado para hospital, turno, data e abas internas. Mobile-first (touch ≥44px).
 *
 * variant='outline' (padrão): pílulas separadas, selecionada = tinta + borda (hospital/data/turno).
 * variant='filled' (pedido do dono 24/07): trilho claro único + selecionada em VERDE SÓLIDO
 * (branco no texto) — diferencia as ABAS de visualização do filtro de hospital.
 */
export default function SegmentedSelector({ options, value, onChange, className = '', variant = 'outline', size = 'md', strong = false, style }) {
  const filled = variant === 'filled'
  // size='sm' (dono 16/08): data + 3 turnos do fim de semana na MESMA linha a
  // 375px. Só o padding horizontal e o corpo do texto encolhem — a altura
  // mínima de toque (44px) fica intacta.
  const sm = size === 'sm'
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
        : `grid ${sm ? 'gap-1.5' : 'gap-2'} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, ...style }}
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
              : `${sm ? 'py-2 px-1.5 text-[13px] rounded-[14px]' : 'py-3 px-3 text-sm rounded-[16px]'} min-h-[44px] border font-medium transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${
                  active
                    // strong (dono 16/08): mesma família, tinta um passo mais
                    // forte — destaca a data sem virar o verde sólido das abas
                    ? strong
                      ? 'border-[hsl(var(--primary))] bg-primary/20 font-semibold text-primary dark:bg-primary/30'
                      : 'border-[hsl(var(--primary-hover))] bg-primary/10 text-primary dark:border-[hsl(var(--primary))] dark:bg-primary/20'
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
