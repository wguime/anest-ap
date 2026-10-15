/**
 * "SEU PREENCHIMENTO" no topo da aba Minhas (dono 14/10, modelo A de
 * `.tmp/melhorias-preenchimento.html`): a % das SUAS cirurgias com início e término nos
 * últimos 7 dias encerrados, a marca da média dos 5 melhores da equipe na barra e, quando
 * há, a ação do dia ("N cirurgias de hoje sem horário · Preencher" → desce até a caixa
 * "Você tem N cirurgias sem horário", que já existe).
 *
 * Só a própria pessoa vê o próprio número (a função do banco não devolve o de ninguém mais);
 * o ranking com nomes continua só no relatório de adesão. Regras em `resumoMeuPreenchimento`.
 */
import { Button } from '@/design-system'
import { useMeuPreenchimento } from '@/hooks/useAdesaoEscala'
import { IDADE_CARD_MS } from '@/services/escalaAdesaoService'
import { resumoMeuPreenchimento } from '@/lib/escalaAdesao'

/** faixa → cor da barra (as mesmas faixas do relatório, contra a meta de 80%) */
const BARRA = {
  ok: 'bg-success',
  mid: 'bg-warning',
  low: 'bg-category-orange-fg',
  crit: 'bg-destructive',
}

export const ID_MINHAS_PENDENCIAS = 'minhas-pendencias'

export default function MeuPreenchimento({ uid, pendentesHoje = 0 }) {
  const { dados } = useMeuPreenchimento(uid, { idadeMaxMs: IDADE_CARD_MS })
  const r = resumoMeuPreenchimento(dados, pendentesHoje)
  if (!r) return null
  const irParaPendencias = () => {
    document.getElementById(ID_MINHAS_PENDENCIAS)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <section aria-label="Seu preenchimento" className="rounded-2xl border border-border-strong bg-card px-3.5 py-3">
      <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
        Seu preenchimento
        <span className="ml-auto text-[12px] font-medium normal-case tracking-normal">últimos 7 dias</span>
      </h3>
      <p className="mt-1.5 flex items-baseline gap-2">
        <b className="text-[34px] font-extrabold leading-none tabular-nums">{r.pct}%</b>
        <span className="text-[13px] text-muted-foreground">das suas cirurgias com início e término</span>
      </p>
      <div
        className="relative mt-2.5 h-2.5 rounded-full bg-muted"
        role="img"
        aria-label={`${r.completos} de ${r.casos} cirurgias completas${r.top != null ? `; média dos ${r.topN} melhores ${r.top}%` : ''}`}
      >
        <i className={`absolute inset-y-0 left-0 rounded-full ${BARRA[r.tom]}`} style={{ width: `${r.pct}%` }} />
        {r.top != null && (
          <em className="absolute -inset-y-1 w-0.5 bg-primary" style={{ left: `calc(${Math.min(r.top, 99.5)}% - 1px)` }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-muted-foreground">
        <span>{r.completos} de {r.casos}</span>
        {r.top != null && (
          <span>média dos {r.topN} melhores <b className="font-bold text-primary">{r.top}%</b></span>
        )}
      </div>
      {r.pendentes > 0 && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5 text-[13px]">
          <span className="font-semibold">
            {r.pendentes === 1 ? '1 cirurgia de hoje sem horário' : `${r.pendentes} cirurgias de hoje sem horário`}
          </span>
          <Button size="sm" className="ml-auto" onClick={irParaPendencias}>Preencher</Button>
        </div>
      )}
    </section>
  )
}
