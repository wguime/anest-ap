/**
 * AdesaoEscalaCard — 1º item da linha "Destaques Científicos" (opção A, dono 23/09/2026).
 *
 * Mesma altura e largura dos cards de artigo (`NoticiaCard` variant carousel: 120px, 86px
 * deitado), para a linha não mudar de tamanho. Os 4 mini-indicadores são da janela de 30 dias.
 *
 * Busca com cache SWR de 30 min (`IDADE_CARD_MS`) e só depois do sinal do
 * DeferredReadyContext: a Home não pode virar uma chamada ao banco por abertura (plano free,
 * 16/09). Sem dado ainda, o card aparece sem os números — nunca some, porque é a porta de
 * entrada do relatório.
 */
import { memo } from 'react'
import { Badge } from '@/design-system/components/ui/badge'
import { cn } from '@/design-system/utils/tokens'
import { useDeferredReady } from '@/contexts/DeferredReadyContext'
import { useAdesaoEscala } from '@/hooks/useAdesaoEscala'
import { IDADE_CARD_MS } from '@/services/escalaAdesaoService'
import { META, faixa, formatarPct, resumoCard } from '@/lib/escalaAdesao'

const TOM = {
  ok: 'bg-category-green-bg text-category-green-fg',
  mid: 'bg-warning/20 text-foreground',
  low: 'bg-category-orange-bg text-category-orange-fg',
  crit: 'bg-category-red-bg text-category-red-fg',
  na: 'bg-muted text-muted-foreground',
}

function Mini({ tom, valor, rotulo }) {
  return (
    <span className={cn('flex-1 rounded-md py-0.5 text-center text-[11px] font-bold leading-tight tabular-nums', TOM[tom])}>
      {valor}
      <small className="block text-[9px] font-medium opacity-85">{rotulo}</small>
    </span>
  )
}

function AdesaoEscalaCardImpl({ onClick }) {
  const pronto = useDeferredReady()
  const { dados } = useAdesaoEscala(30, { idadeMaxMs: IDADE_CARD_MS, ativo: pronto })
  const r = resumoCard(dados)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby="adesao-escala-card-titulo"
      className={cn(
        'flex w-full h-[120px] flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left',
        'deitado:h-[86px] deitado:p-2.5',
        'shadow-sm transition-all',
        'hover:bg-accent/40 hover:border-border-strong hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98]',
        'dark:shadow-none dark:hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]',
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">Relatório</Badge>
        <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">Por cargo e pessoa</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">30 dias</span>
      </div>
      {/* uma linha só: com 2 linhas os mini-indicadores cobrem a 2ª (medido a 430px, 23/09) */}
      <h3 id="adesao-escala-card-titulo" className="text-[14px] font-bold leading-snug text-foreground truncate">
        Adesão à Escala Cirúrgica
      </h3>
      {r ? (
        <div className="mt-auto flex gap-1.5 deitado:hidden">
          <Mini tom={faixa(r.ini, META.ini)} valor={formatarPct(r.ini)} rotulo="início" />
          <Mini tom={faixa(r.ter, META.ter)} valor={formatarPct(r.ter)} rotulo="término" />
          <Mini tom={faixa(r.tot, META.tot)} valor={formatarPct(r.tot)} rotulo="tempo total" />
          <Mini tom={r.alertas > 0 ? 'crit' : 'ok'} valor={r.alertas} rotulo="com alerta" />
        </div>
      ) : (
        <p className="text-[12px] leading-snug text-muted-foreground line-clamp-1 deitado:hidden">
          Por cargo e por pessoa, últimos 30 e 60 dias
        </p>
      )}
    </button>
  )
}

export const AdesaoEscalaCard = memo(AdesaoEscalaCardImpl)
export default AdesaoEscalaCard
