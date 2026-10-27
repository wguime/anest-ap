/**
 * EvolucaoAdesaoCard — porta de entrada do infográfico "Evolução da adesão" (dono 27/10/2026), à
 * ESQUERDA do card "Adesão à Escala Cirúrgica" na linha dos Destaques Científicos.
 *
 * Card A do modelo `.tmp/adesao-evolucao-v2.html`, escolhido por imagem: a mesma anatomia do
 * `AdesaoEscalaCard` (2 selos, título de uma linha, 4 quadradinhos) e a mesma altura dos vizinhos
 * (120 px; 86 px deitado; 120 px no desktop), para a linha não mudar de tamanho.
 *
 * Publicação AGENDADA: o dono quer o card no ar em 28/10 às 9h, e deploy com turno em andamento
 * derruba quem está com o app aberto (chunks renomeados). Daí o código vai antes e o card só
 * aparece a partir de `EVOLUCAO_ADESAO_DESDE` — `useLiberadoDesde` acorda a Home já aberta na hora.
 *
 * Busca com cache SWR de `IDADE_INFOGRAFICO_MS` e só depois do sinal do DeferredReadyContext (a
 * Home não pode virar chamada ao banco por abertura, plano free 16/09). O cache é o mesmo da
 * página do infográfico. Sem dado ainda, o card aparece sem os números.
 */
import { memo, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/design-system/components/ui/badge'
import { cn } from '@/design-system/utils/tokens'
import { useDeferredReady } from '@/contexts/DeferredReadyContext'
import { useAdesaoSemanas } from '@/hooks/useAdesaoEscala'
import { IDADE_INFOGRAFICO_MS } from '@/services/escalaAdesaoService'
import { META, faixa } from '@/lib/escalaAdesao'
import { montarEvolucao } from '@/lib/escalaAdesaoSemanal'
import { crescimentoSemanal, pct, percentualSemana } from '@/lib/escalaAdesaoInfografico'

/** 28/10/2026 às 9h (Brasília) — o dono pediu o card publicado nessa hora. */
export const EVOLUCAO_ADESAO_DESDE = Date.parse('2026-10-28T09:00:00-03:00')

/** true a partir de `ms`; com a tela aberta antes da hora, vira sozinho quando ela chega. */
export function useLiberadoDesde(ms) {
  const [agora, setAgora] = useState(() => Date.now())
  const liberado = agora >= ms
  useEffect(() => {
    if (liberado) return undefined
    // setTimeout estoura acima de ~24,8 dias; acordar no máximo a cada 6 h e reconferir
    const espera = Math.min(Math.max(0, ms - Date.now()), 6 * 3600e3)
    const t = setTimeout(() => setAgora(Date.now()), espera + 50)
    return () => clearTimeout(t)
  }, [liberado, agora, ms])
  return liberado
}

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

/** Os 4 números do card a partir do JSON cru das semanas — null sem semanas. */
export function resumoCardEvolucao(dados) {
  const ev = montarEvolucao(dados || {})
  if (!ev?.serie?.length) return null
  const p = ev.serie[0]
  const u = ev.serie[ev.serie.length - 1]
  return {
    engAntes: p.engajadosTotal,
    engAgora: u.engajadosTotal,
    ini: pct(u.ini),
    ter: pct(u.ter),
    crescimentoIni: crescimentoSemanal(ev.serie.map((x) => x.ini)),
    // os números de início/término são da ÚLTIMA semana: ao lado do card de adesão (30 dias) os
    // dois "início" diferem, e o canto diz de qual semana é este
    ultimaSemana: u.rotulo,
  }
}

function EvolucaoAdesaoCardImpl({ onClick }) {
  const pronto = useDeferredReady()
  const { dados } = useAdesaoSemanas({ idadeMaxMs: IDADE_INFOGRAFICO_MS, ativo: pronto })
  const r = useMemo(() => resumoCardEvolucao(dados), [dados])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby="evolucao-adesao-card-titulo"
      className={cn(
        'flex w-full h-[120px] flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left',
        'deitado:h-[86px] deitado:p-2.5',
        'desktop:h-[120px] desktop:p-3',
        'shadow-sm transition-all',
        'hover:bg-accent/40 hover:border-border-strong hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98]',
        'dark:shadow-none dark:hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]',
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">Infográfico</Badge>
        <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">Evolução</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{r?.ultimaSemana ? `sem. de ${r.ultimaSemana}` : '5 semanas'}</span>
      </div>
      <h3 id="evolucao-adesao-card-titulo" className="text-[14px] font-bold leading-snug text-foreground truncate">
        Evolução da adesão à escala
      </h3>
      {r ? (
        <div className="mt-auto flex gap-1.5 deitado:hidden desktop:flex">
          <Mini tom={r.engAgora > r.engAntes ? 'ok' : 'mid'} valor={`${r.engAntes}→${r.engAgora}`} rotulo="engajados" />
          <Mini tom={faixa(r.ini, META.ini)} valor={r.ini == null ? '—' : `${r.ini}%`} rotulo="início" />
          <Mini tom={faixa(r.ter, META.ter)} valor={r.ter == null ? '—' : `${r.ter}%`} rotulo="término" />
          <Mini tom={r.crescimentoIni > 0 ? 'ok' : 'na'} valor={percentualSemana(r.crescimentoIni)} rotulo="início/semana" />
        </div>
      ) : (
        <p className="text-[12px] leading-snug text-muted-foreground line-clamp-1 deitado:hidden desktop:line-clamp-1">
          Engajados, início e término semana a semana
        </p>
      )}
    </button>
  )
}

export const EvolucaoAdesaoCard = memo(EvolucaoAdesaoCardImpl)
export default EvolucaoAdesaoCard
