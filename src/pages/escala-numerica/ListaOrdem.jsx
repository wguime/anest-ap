/**
 * Lista da ordem de liberação em DUAS COLUNAS (modelo B, escolhido pelo dono em 03/09).
 *
 * Lê-se de cima para baixo na coluna da esquerda e depois na da direita — por isso a posição
 * vai numerada em toda linha. São 40 nomes num dia útil (HRO + Unimed + Materno) e 20 num
 * feriado; em uma coluna só, o dia inteiro passava de 1.900px de rolagem.
 *
 * Quem está de férias FICA na posição, marcado — a exclusão é da conferência, não da consulta.
 */
import { LABEL_HOSPITAL } from '@/lib/escalaNumerica'

export function LinhaOrdem({ p }) {
  const deFerias = Boolean(p.ferias?.length)
  const apagado = deFerias || p.posPlantao
  return (
    <div data-slot="ordem-linha" className="flex h-7 min-w-0 items-center gap-1 border-b border-border/50">
      <span
        className={`flex size-[17px] flex-none items-center justify-center rounded-md text-[10px] font-bold tabular-nums text-muted-foreground ${
          apagado ? 'border border-dashed border-border-strong' : 'bg-muted'
        }`}
      >
        {p.posicao}
      </span>
      <span className="w-4 flex-none text-[10px] font-semibold tabular-nums text-muted-foreground">
        {p.numero || '??'}
      </span>
      {/* o nome trunca; a marca de férias NUNCA — por isso ela fica fora do span que trunca */}
      <span data-slot="ordem-nome" title={p.nome} className={`min-w-0 truncate text-[12.5px] ${apagado ? 'font-medium text-muted-foreground' : 'font-semibold'}`}>
        {p.nome}
      </span>
      {deFerias && <span className="flex-none text-[10.5px] font-semibold text-warning">(férias)</span>}
      {/* pós-plantão: quem fez a noite da véspera. À tarde não é escalado, mas fica na
          posição da numérica com a marca (dono 03/09) — mesma escolha das férias. */}
      {p.posPlantao && !deFerias && (
        // abaixo de 400px o rótulo inteiro rouba ~14px do nome e "ROMULO" virava "ROM…";
        // o nome é o que importa, então nas telas estreitas fica só "(pós)" — o title diz o resto
        <span className="flex-none text-[10.5px] font-semibold text-info" title="Pós plantão">
          (pós<span className="hidden min-[400px]:inline"> plantão</span>)
        </span>
      )}
      {p.trocado && (
        <span
          className="ml-auto flex-none rounded-[5px] bg-primary/12 px-1 py-0.5 text-[9px] font-extrabold uppercase text-primary"
          title="Posição mudou por uma troca aceita"
        >
          troca
        </span>
      )}
      {p.inserida && (
        <span
          className="ml-auto flex-none rounded-[5px] bg-info/15 px-1 py-0.5 text-[9px] font-extrabold text-info"
          title="Louise inserida pelo quadro dela"
        >
          L
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

/** Card de um hospital (ou da fila única do feriado) com o cabeçalho e a lista. */
export function BlocoOrdem({ rotulo, lista, meta }) {
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
          const deFerias = Boolean(c.ferias?.length)
          const apagadoC = deFerias || c.posPlantao
          return (
            <span
              key={c.numero}
              data-slot="consultorio-chip"
              className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-[12.5px] ${
                apagadoC ? 'border border-dashed border-border-strong font-medium text-muted-foreground' : 'bg-muted font-semibold'
              }`}
            >
              <span className="text-[11px] tabular-nums text-muted-foreground">{c.numero}</span>
              {c.nome}
              {deFerias && <span className="text-[10.5px] font-semibold text-warning">(férias)</span>}
              {c.posPlantao && !deFerias && (
                <span className="text-[10.5px] font-semibold text-info" title="Pós plantão">(pós plantão)</span>
              )}
            </span>
          )
        })}
      </div>
    </section>
  )
}
