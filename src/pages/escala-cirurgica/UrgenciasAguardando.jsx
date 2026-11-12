/**
 * URGÊNCIAS AGUARDANDO (dono 11/11/2026, opção A de `.tmp/analise-escala-2026-11/modelos-6/
 * 2-urgencias-aguardando.html`) — o MESMO bloco, com o mesmo nome e desenho, na Completa (abaixo
 * da faixa de urgências) e nas Liberações (no topo). Só HRO.
 *
 * Uma linha por urgência que ainda não começou: selo da gravidade · procedimento · sala (ou
 * "Sala a definir") · quem faz (ou "sem anestesista") · "lançada há 48min" · "Definir" quando
 * falta o anestesista. Antes a mesma urgência aparecia com dois nomes e dois desenhos — "Fila — N
 * aguardando" dentro da faixa, na Completa, e um cartão "Procedimentos sem anestesista" nas
 * Liberações (que continua existindo para as ELETIVAS).
 *
 * A lista vem pronta de `estadoUrgencias().fila` — este bloco só desenha; QUAL urgência ocupa
 * qual vaga do contrato continua decidido na lib (`escalaCirurgicaUrgencias.js`).
 */
import { GRAVIDADE_LABEL } from '@/lib/escalaCirurgicaUrgencias'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { salaExibicao } from './utils'

const espera = (min) => {
  if (min == null) return ''
  const m = Math.max(0, Math.round(min))
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

const semDono = (caso) => {
  const n = String(caso?.anestesista || '').trim()
  return !!caso?.semAnestesista || !n || n === '//' || /^\?+$/.test(n)
}

/**
 * @param {Array} itens      `estado.fila` — { id, caso, gravidade, esperaMin }
 * @param {Function} nomeDe  (caso) => nome de exibição do anestesista
 * @param {Function?} onAbrir   toque na linha (abre a cirurgia)
 * @param {Function?} onDefinir toque em "Definir" (escolher o anestesista) — só para quem edita
 */
export default function UrgenciasAguardando({ itens = [], nomeDe, onAbrir = null, onDefinir = null, className = '' }) {
  if (!itens.length) return null
  return (
    <section data-urgencias-aguardando aria-label="Urgências aguardando" className={className}>
      <p className="mb-1 px-1 text-xs font-bold text-foreground">Urgências aguardando ({itens.length})</p>
      <div className="overflow-hidden rounded-xl border border-border-strong bg-card">
        {itens.map((f) => {
          const caso = f.caso || {}
          const orfa = semDono(caso)
          const Linha = onAbrir ? 'button' : 'div'
          return (
            <div key={f.id} className="flex items-stretch border-t border-border first:border-t-0">
              <Linha
                {...(onAbrir ? { type: 'button', onClick: () => onAbrir(caso), 'aria-label': `Abrir a urgência ${fraseClinica(caso.procedimento) || 'sem procedimento'}` } : {})}
                className={['min-h-[48px] min-w-0 flex-1 px-2.5 py-1.5 text-left', onAbrir ? 'active:opacity-70' : ''].join(' ')}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={[
                      'shrink-0 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-[11px] font-bold',
                      f.gravidade === 'imediata' && 'bg-destructive/15 text-destructive',
                      f.gravidade === 'urgente' && 'bg-warning/[0.18] text-warning',
                      f.gravidade === 'aguarda' && 'bg-muted text-muted-foreground',
                      !f.gravidade && 'border border-dashed border-warning/60 text-category-orange-fg',
                    ].filter(Boolean).join(' ')}
                  >
                    {f.gravidade ? GRAVIDADE_LABEL[f.gravidade] : 'Classificar'}
                  </span>
                  <span className="min-w-0 text-[14px] font-semibold leading-tight [overflow-wrap:anywhere]">
                    {fraseClinica(caso.procedimento) || 'Sem procedimento'}
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  {salaExibicao(caso.sala) || 'Sala a definir'}
                  {' · '}
                  <span className={orfa ? 'font-semibold text-category-orange-fg' : ''}>{orfa ? 'sem anestesista' : (nomeDe?.(caso) || caso.anestesista)}</span>
                  {f.esperaMin != null && ` · lançada há ${espera(f.esperaMin)}`}
                </span>
              </Linha>
              {orfa && onDefinir && (
                <button
                  type="button"
                  onClick={() => onDefinir(caso)}
                  aria-label={`Definir anestesista de ${fraseClinica(caso.procedimento) || 'urgência'}`}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center px-2.5 active:opacity-70"
                >
                  <span className="flex h-6 shrink-0 items-center rounded-full border border-primary px-2.5 text-[12px] font-semibold text-primary">Definir</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
