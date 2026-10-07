/**
 * Lista da ordem de liberação em DUAS COLUNAS (modelo B, escolhido pelo dono em 03/09).
 *
 * Lê-se de cima para baixo na coluna da esquerda e depois na da direita — por isso a posição
 * vai numerada em toda linha. São 40 nomes num dia útil (HRO + Unimed + Materno) e 20 num
 * feriado; em uma coluna só, o dia inteiro passava de 1.900px de rolagem.
 *
 * Quem está de férias FICA na posição, marcado — a exclusão é da conferência, não da consulta.
 * A marca (dono 07/10, escolhida no protótipo `.tmp/escala-numerica-marcas-impressao.html`) é
 * a LINHA PINTADA — laranja = férias, índigo = pós-plantão — com um selo escrito no fim; o
 * plantonista da noite, de manhã, trabalha: leva só o selo, sem pintar. Regra em `situacao.js`.
 */
import { cn } from '@/design-system/utils/tokens'
import { LABEL_HOSPITAL } from '@/lib/escalaNumerica'
import { nomeExibicao } from './nomeExibicao'
import { situacao, rotuloSituacao, contarTrabalhando } from './situacao'

// classes por extenso: classe Tailwind montada em runtime é purgada no build. O número da
// posição vai em `*-fg` (e não no `category-*` forte) porque o laranja forte com texto branco
// não passa AA no claro
const TINTA = {
  ferias: {
    linha: 'bg-category-orange-bg',
    posicao: 'bg-category-orange-fg text-card',
    nome: 'text-category-orange-fg',
    selo: 'border-category-orange-fg text-category-orange-fg',
  },
  pos: {
    linha: 'bg-category-indigo-bg',
    posicao: 'bg-category-indigo-fg text-card',
    nome: 'text-category-indigo-fg',
    selo: 'border-category-indigo-fg text-category-indigo-fg',
  },
  noite: {
    linha: '',
    posicao: 'text-category-indigo-fg ring-[1.5px] ring-inset ring-category-indigo-fg',
    nome: '',
    selo: 'border-category-indigo-fg text-category-indigo-fg',
  },
}

const TITULO_SELO = {
  ferias: () => 'Férias no Pega Plantão — fica na posição, não trabalha',
  pos: (p) => `Pós plantão${p.postoPlantao ? ` ${p.postoPlantao}` : ''} — fez a noite anterior, não trabalha à tarde`,
  noite: (p) => `Plantão ${p.postoPlantao} da noite anterior — sobe para a 2ª posição`,
}

export function SeloSituacao({ p, className }) {
  const s = situacao(p)
  if (!s) return null
  return (
    <span
      data-slot="ordem-selo"
      title={TITULO_SELO[s](p)}
      className={cn('flex-none rounded-[5px] border bg-card px-1 text-[10px] font-bold leading-[15px]', TINTA[s].selo, className)}
    >
      {rotuloSituacao(p, { tela: true })}
    </span>
  )
}

export function LinhaOrdem({ p }) {
  const s = situacao(p)
  const tinta = s ? TINTA[s] : null
  const pintada = Boolean(tinta?.linha)
  return (
    // a pintada estende 4px para os lados (-mx-1 px-1) para o número ficar alinhado com o das
    // outras linhas
    <div
      data-slot="ordem-linha"
      data-situacao={s || undefined}
      className={cn(
        'flex h-7 min-w-0 items-center gap-1',
        pintada ? `-mx-1 rounded-[7px] px-1 ${tinta.linha}` : 'border-b border-border/50'
      )}
    >
      <span
        className={cn(
          'flex size-[17px] flex-none items-center justify-center rounded-md text-[10px] font-bold tabular-nums',
          tinta?.posicao || 'bg-muted text-muted-foreground'
        )}
      >
        {p.posicao}
      </span>
      <span className={cn('w-4 flex-none text-[10px] font-semibold tabular-nums', pintada ? tinta.nome : 'text-muted-foreground')}>
        {p.numero || '??'}
      </span>
      {/* o nome trunca; o selo NUNCA — por isso ele fica fora do span que trunca */}
      <span
        data-slot="ordem-nome"
        data-legenda={p.nome}
        title={nomeExibicao(p.nome)}
        className={cn('min-w-0 truncate text-[12.5px] font-semibold', tinta?.nome)}
      >
        {nomeExibicao(p.nome)}
      </span>
      {(s || p.trocado || p.inserida) && (
        <span className="ml-auto flex flex-none items-center gap-0.5">
          <SeloSituacao p={p} />
          {p.trocado && (
            <span
              className="flex-none rounded-[5px] bg-primary/12 px-1 py-0.5 text-[9px] font-extrabold uppercase text-primary"
              title="Posição mudou por uma troca aceita"
            >
              troca
            </span>
          )}
          {p.inserida && (
            <span
              className="flex-none rounded-[5px] bg-info/15 px-1 py-0.5 text-[9px] font-extrabold text-info"
              title="Louise inserida pelo quadro dela"
            >
              L
            </span>
          )}
        </span>
      )}
    </div>
  )
}

/**
 * `grid-flow-col` + linhas explícitas = a numeração desce a coluna esquerda e continua na
 * direita. A contagem de linhas vai por `style` de propósito: classe Tailwind montada em
 * runtime é purgada no build.
 */
export default function ListaOrdem({ lista }) {
  const linhas = Math.ceil(lista.length / 2)
  return (
    <div
      className="grid grid-flow-col grid-cols-2 gap-x-1.5"
      style={{ gridTemplateRows: `repeat(${linhas}, 28px)` }}
    >
      {lista.map((p) => (
        <LinhaOrdem key={`${p.posicao}-${p.numero}-${p.nome}`} p={p} />
      ))}
    </div>
  )
}

/**
 * Quantos trabalham naquele hospital naquele turno (dono 07/10): a lista menos férias e
 * pós-plantão — exatamente as linhas pintadas.
 */
function Trabalhando({ lista, turno }) {
  const c = contarTrabalhando(lista)
  const fora = [c.ferias && `${c.ferias} de férias`, c.pos && `${c.pos} pós-plantão`].filter(Boolean)
  return (
    <div data-slot="trabalhando" className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
      <span className="min-w-0 text-[12.5px] font-semibold leading-snug">
        Trabalhando {turno === 'vespertino' ? 'à tarde' : 'de manhã'}
        {/* cada parte inteira: "pós-plantão" quebrava no hífen */}
        {fora.length > 0 && (
          <span className="font-medium text-muted-foreground">
            {' · '}
            {[`${c.total} na lista`, ...fora].map((t, i) => (
              <span key={t} className="whitespace-nowrap">{i ? `, ${t}` : t}</span>
            ))}
          </span>
        )}
      </span>
      <b data-slot="trabalhando-total" className="flex-none text-[17px] font-extrabold tabular-nums">
        {c.trabalhando}
      </b>
    </div>
  )
}

/**
 * Card de um hospital (ou da fila única do feriado) com o cabeçalho e a lista. `turno` liga a
 * contagem de quem trabalha — só no HRO e na Unimed (dono 07/10).
 */
export function BlocoOrdem({ rotulo, lista, meta, turno }) {
  return (
    <section className="rounded-[20px] border border-border bg-card p-3 dark:bg-card">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">{rotulo}</h2>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">
          {meta ?? `${lista.length} ${lista.length === 1 ? 'nome' : 'nomes'}`}
        </span>
      </div>
      {lista.length ? (
        <ListaOrdem lista={lista} />
      ) : (
        <p className="py-2 text-[12.5px] text-muted-foreground">Ninguém nesta coluna hoje.</p>
      )}
      {turno && lista.length > 0 && <Trabalhando lista={lista} turno={turno} />}
    </section>
  )
}

/** Consultório fica FORA da fila de liberação — nunca numerado junto (regra do dono). */
export function BlocoConsultorio({ consultorio }) {
  if (!consultorio?.length) return null
  return (
    <section className="rounded-[20px] border border-border bg-card p-3 dark:bg-card">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">{LABEL_HOSPITAL.consultorio}</h2>
        <span className="text-[11.5px] text-muted-foreground">fora da fila</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {consultorio.map((c) => {
          const s = situacao(c)
          const tinta = s ? TINTA[s] : null
          return (
            <span
              key={c.numero}
              data-slot="consultorio-chip"
              data-legenda={c.nome}
              data-situacao={s || undefined}
              className={cn(
                'inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold',
                tinta?.linha ? `${tinta.linha} ${tinta.nome}` : 'bg-muted'
              )}
            >
              <span className={cn('text-[11px] tabular-nums', tinta?.linha ? '' : 'text-muted-foreground')}>{c.numero}</span>
              {nomeExibicao(c.nome)}
              <SeloSituacao p={c} />
            </span>
          )
        })}
      </div>
    </section>
  )
}
