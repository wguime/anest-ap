/**
 * Feriados — a lista dos feriados do ano e, ao tocar num deles, a ordem de liberação.
 *
 * O feriado NÃO usa a grade dos dias úteis: tem escala própria, publicada como FILA ÚNICA de
 * todos os hospitais (20 nomes), manhã de cima para baixo e tarde invertida. Por isso a tela
 * mostra os dois turnos lado a lado — a tarde é a manhã de trás para frente, e ver as duas
 * juntas é o que o dono pediu.
 *
 * A fonte é `dados.feriados.dias`, que independe da vigência da grade: os feriados de fevereiro
 * a junho continuam consultáveis mesmo com a edição vigente começando em agosto.
 *
 * Férias marcam, não excluem — igual à Escala Numérica.
 */
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components'
import { RefreshCw, ChevronRight, Umbrella } from 'lucide-react'
import dadosNumerica from '@/data/escalaNumerica.json'
import { anotarFerias, LABEL_TURNO } from '@/lib/escalaNumerica'
import { filasDoFeriado } from '@/lib/trocasFeriado'
import useTrocaFeriado from '@/hooks/useTrocaFeriado'
import { LinhaOrdem } from './ListaOrdem'
import TrocasFeriado from './TrocasFeriado'
import { useFeriasDoAno, feriasNaData } from './useFeriasDoAno'
import { paraISO, listarFeriados } from './calendario'

function ColunaTurno({ rotulo, lista }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-0.5 border-b border-border-strong pb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </div>
      {lista.map((p) => (
        <LinhaOrdem key={`${p.posicao}-${p.numero}-${p.nome}`} p={p} />
      ))}
    </div>
  )
}

export default function FeriadosPage({ goBack }) {
  const [aberto, setAberto] = useState(null)
  const hojeISO = paraISO(new Date())
  const feriados = useMemo(() => listarFeriados(dadosNumerica, hojeISO), [hojeISO])
  const proximo = feriados.find((f) => !f.passado)

  const { registros, loading, erro, conferidoEm, recarregar } = useFeriasDoAno(dadosNumerica.ano)
  const ferias = useMemo(() => feriasNaData(registros, aberto?.data), [registros, aberto])

  // as trocas ACEITAS mudam a fila de qualquer feriado — por isso entram na montagem, e não
  // só na lista de pedidos. A troca aceita é o fato; não há override espelhado no banco.
  const troca = useTrocaFeriado()
  const turnos = useMemo(() => {
    if (!aberto) return null
    const filas = filasDoFeriado(dadosNumerica, aberto.data, troca.aceitas)
    if (!filas) return null
    return {
      manha: anotarFerias(filas.matutino, ferias),
      tarde: anotarFerias(filas.vespertino, ferias),
    }
  }, [aberto, ferias, troca.aceitas])

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title={aberto ? aberto.nome : 'Feriados'}
        subtitle={aberto ? `${aberto.diaSemana} · ${aberto.br}` : String(dadosNumerica.ano)}
        onBack={aberto ? () => setAberto(null) : goBack}
        actions={
          <button
            type="button"
            onClick={recarregar}
            disabled={loading}
            className="p-2 text-primary transition-opacity hover:opacity-70 disabled:opacity-50"
            aria-label="Consultar as férias de novo"
          >
            <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-3 sm:px-5">
        {!aberto && (
          <section className="rounded-[20px] border border-border bg-card p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-extrabold">Feriados {dadosNumerica.ano}</h2>
              <span className="text-[11.5px] tabular-nums text-muted-foreground">{feriados.length}</span>
            </div>
            <ul>
              {feriados.map((f) => (
                <li key={f.data}>
                  <button
                    type="button"
                    onClick={() => setAberto(f)}
                    className="flex min-h-[48px] w-full items-center gap-3 border-b border-border/50 text-left last:border-b-0"
                  >
                    <span className="flex w-[52px] flex-none flex-col leading-tight">
                      <b className={`text-[13.5px] tabular-nums ${f.passado ? 'font-medium text-muted-foreground' : ''}`}>
                        {f.br}
                      </b>
                      <small className="text-[10.5px] text-muted-foreground">{f.diaSemana}</small>
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[14px] ${
                        f.passado ? 'font-medium text-muted-foreground' : 'font-semibold'
                      }`}
                    >
                      {f.nome}
                    </span>
                    {f.data === proximo?.data && (
                      <span className="flex-none rounded-md bg-primary/12 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                        próximo
                      </span>
                    )}
                    <ChevronRight className="size-[18px] flex-none text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {aberto && turnos && (
          <section className="rounded-[20px] border border-border bg-card p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-extrabold">{aberto.nome}</h2>
              <span className="text-[11.5px] text-muted-foreground">
                {aberto.diaSemana} · {aberto.br}
              </span>
            </div>
            <p className="mb-2.5 text-[11.5px] leading-snug text-muted-foreground">
              Fila única do feriado: todos os hospitais, {turnos.manha.length} nomes. A tarde é a manhã invertida.
            </p>
            <div className="flex gap-2">
              <ColunaTurno rotulo={LABEL_TURNO.matutino} lista={turnos.manha} />
              <ColunaTurno rotulo={LABEL_TURNO.vespertino} lista={turnos.tarde} />
            </div>
          </section>
        )}

        <TrocasFeriado troca={troca} hojeISO={hojeISO} />

        <p className="flex items-start gap-1.5 px-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <Umbrella className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
          {!aberto
            ? 'A ordem de cada feriado é fila única — todos os hospitais, 20 nomes.'
            : erro
              ? `Férias NÃO conferidas: ${erro}. A lista está sem a marca de férias.`
              : loading
                ? 'Consultando as férias no Pega Plantão…'
                : ferias?.length
                  ? `Férias do Pega Plantão, consultadas ${conferidoEm ? `às ${conferidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'agora'}. Quem está de férias fica na posição, marcado.`
                  : `Férias consultadas: ninguém do grupo está de férias em ${aberto.br}.`}
        </p>
      </div>
    </div>
  )
}
