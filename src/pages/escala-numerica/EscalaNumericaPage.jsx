/**
 * Escala Numérica — consulta da ORDEM DE LIBERAÇÃO esperada de um dia, por hospital e turno.
 *
 * Base: a escala numérica do grupo (`src/data/escalaNumerica.json` + `src/lib/escalaNumerica.js`),
 * a mesma que a conferência usa. Esta tela só LÊ: nada aqui grava `ordem_liberacao` nem qualquer
 * outra coisa — o rodapé publicado continua sendo a fonte da fila, e divergir dele é assunto da
 * conferência da escala cirúrgica.
 *
 * Diferença deliberada para a conferência (dono 03/09): férias MARCAM, não excluem. Quem está de
 * férias no Pega Plantão aparece na posição dele com "(férias)" ao lado — o grupo quer ver a fila
 * do quadro inteira. As férias são consultadas na hora, ao abrir a tela.
 *
 * Regras completas: `.claude/rules/escala-numerica.md`.
 */
import { useState, useMemo, useEffect } from 'react'
import { DatePicker } from '@/design-system'
import { PageHeader } from '@/components'
import { RefreshCw, CalendarClock, Umbrella, TriangleAlert, Info } from 'lucide-react'
import SegmentedSelector from '../escala-cirurgica/SegmentedSelector'
import dadosNumerica from '@/data/escalaNumerica.json'
import { montarOrdem, anotarFerias, HOSPITAIS_NUMERICA, LABEL_HOSPITAL, LABEL_TURNO } from '@/lib/escalaNumerica'
import { getPlantoesPorData } from '@/services/pegaPlantaoApi'
import { BlocoOrdem, BlocoConsultorio } from './ListaOrdem'
import { useFeriasDoAno, feriasNaData } from './useFeriasDoAno'
import { sabadoDoFimDeSemana, filaPn } from './plantonistasFds'
import { paraISO, paraBr, DIA_LONGO } from './calendario'

const TURNOS = [
  { value: 'matutino', label: LABEL_TURNO.matutino },
  { value: 'vespertino', label: LABEL_TURNO.vespertino },
]

/**
 * `montarOrdem` com `ferias: null` sempre acusa "férias não conferidas" — correto para a
 * conferência, errado aqui, onde as férias são consultadas à parte e viram marca. As outras
 * pendências (identidade em feriado, Louise duplicada) continuam valendo e aparecem.
 */
const pendenciasReais = (pendencias = []) => pendencias.filter((p) => !/^Férias NÃO conferidas/.test(p))

/**
 * Fim de semana: a numérica não vale, quem manda é o plantão do Pega Plantão. O Pn do setor
 * JÁ é a posição — nada é inferido aqui. O fetch é próprio (a fila é de UM fim de semana) e
 * ancorado no sábado, porque é lá que o plantão das 48h é lançado.
 */
function useFilaFds(dataISO, ativo) {
  const sabado = ativo ? sabadoDoFimDeSemana(dataISO) : null
  // o estado guarda de QUAL sábado é a resposta; "carregando" é derivado disso, e não de um
  // setState no corpo do efeito (que dispara render em cascata)
  const [resposta, setResposta] = useState(null)

  useEffect(() => {
    if (!sabado) return undefined
    let vivo = true
    getPlantoesPorData(sabado)
      .then((r) => { if (vivo) setResposta({ sabado, fila: filaPn(r.plantoes), erro: null }) })
      .catch((e) => { if (vivo) setResposta({ sabado, fila: [], erro: e?.message || 'Pega Plantão indisponível' }) })
    return () => { vivo = false }
  }, [sabado])

  const pronto = Boolean(sabado) && resposta?.sabado === sabado
  return {
    sabado,
    fila: pronto ? resposta.fila : [],
    erro: pronto ? resposta.erro : null,
    loading: Boolean(sabado) && !pronto,
  }
}

function BlocoFds({ dataISO, fila, loading, erro, sabado }) {
  const domingo = new Date(`${dataISO}T12:00:00`).getDay() === 0
  return (
    <>
      <section className="rounded-[20px] border border-border bg-card p-3">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-extrabold">Plantonistas do fim de semana</h2>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            {loading ? '…' : `${fila.length} ${fila.length === 1 ? 'posto' : 'postos'}`}
          </span>
        </div>
        <p className="mb-2.5 text-[11.5px] leading-snug text-muted-foreground">
          Ordem P1 a P12, do Pega Plantão.
          {domingo && sabado ? ` O plantão do fim de semana é lançado no sábado (${paraBr(sabado)}) e cobre os dois dias.` : ''}
        </p>
        {loading && <p className="py-2 text-[12.5px] text-muted-foreground">Consultando o Pega Plantão…</p>}
        {erro && <p className="py-2 text-[12.5px] text-destructive">Não foi possível consultar o Pega Plantão: {erro}</p>}
        {!loading && !erro && !fila.length && (
          <p className="py-2 text-[12.5px] text-muted-foreground">Nenhum plantonista lançado para este fim de semana.</p>
        )}
        {!loading && !erro && fila.map((p) => (
          <div key={p.pn} data-slot="fds-linha" className="flex min-h-[36px] items-center gap-2.5 border-b border-border/50 last:border-b-0">
            <span className="flex w-8 flex-none items-center justify-center rounded-md bg-muted py-1 text-[11px] font-bold tabular-nums text-muted-foreground">
              {p.pn}
            </span>
            <span data-slot="fds-nome" className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{p.nome}</span>
            <span className="flex-none text-[11px] tabular-nums text-muted-foreground">{p.faixa}</span>
          </div>
        ))}
      </section>
      <p className="flex items-start gap-1.5 px-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
        Esta fila NÃO faz parte da escala numérica do grupo, que só traz dia útil. Ela vem do plantão lançado no Pega Plantão.
      </p>
    </>
  )
}

function Vazio({ icone: Icone, titulo, texto }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-[20px] border border-border bg-card px-5 py-7 text-center">
      <Icone className="size-8 text-muted-foreground" aria-hidden="true" />
      <b className="text-[14.5px]">{titulo}</b>
      <span className="text-[12.5px] leading-relaxed text-muted-foreground">{texto}</span>
    </section>
  )
}

export default function EscalaNumericaPage({ goBack }) {
  const [data, setData] = useState(() => new Date())
  const [turno, setTurno] = useState('matutino')
  const dataISO = paraISO(data)

  const { registros, loading, erro, conferidoEm, recarregar } = useFeriasDoAno(dadosNumerica.ano)
  const ferias = useMemo(() => feriasNaData(registros, dataISO), [registros, dataISO])

  const vista = useMemo(() => {
    // qualquer hospital serve de sonda: fim de semana, fora da vigência e feriado (fila única)
    // respondem igual para os três
    const base = montarOrdem(dadosNumerica, { data: dataISO, hospital: 'hro', turno, ferias: null })
    if (!base.ok) return { tipo: 'vazio', motivo: base.motivo, aviso: base.aviso }
    if (base.filaUnica) {
      return {
        tipo: 'feriado',
        feriado: base.feriado,
        lista: anotarFerias(base.lista, ferias),
        pendencias: pendenciasReais(base.pendencias),
      }
    }
    const blocos = HOSPITAIS_NUMERICA.map((hospital) => {
      const r = montarOrdem(dadosNumerica, { data: dataISO, hospital, turno, ferias: null })
      return { hospital, lista: anotarFerias(r.lista, ferias), pendencias: pendenciasReais(r.pendencias) }
    })
    return {
      tipo: 'dia',
      blocos,
      consultorio: base.consultorio,
      diaSemana: base.diaSemana,
      pendencias: [...new Set(blocos.flatMap((b) => b.pendencias))],
    }
  }, [dataISO, turno, ferias])

  const ehFds = vista.tipo === 'vazio' && vista.motivo === 'fim_de_semana'
  const fds = useFilaFds(dataISO, ehFds)

  const subtitulo = `${DIA_LONGO[data.getDay()]}, ${paraBr(dataISO)}`

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala Numérica"
        subtitle={subtitulo}
        onBack={goBack}
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
        <DatePicker value={data} onChange={(d) => d && setData(d)} />
        {/* no fim de semana e fora da vigência o turno não escolhe nada — a fila do Pn tem
            faixa horária própria, e um seletor inerte só engana */}
        {vista.tipo !== 'vazio' && (
          <SegmentedSelector options={TURNOS} value={turno} onChange={setTurno} />
        )}

        {ehFds && <BlocoFds dataISO={dataISO} {...fds} />}
        {vista.tipo === 'vazio' && vista.motivo !== 'fim_de_semana' && (
          <Vazio
            icone={CalendarClock}
            titulo="Fora da edição vigente"
            texto={`A edição publicada vai de ${paraBr(dadosNumerica.vigencia.inicio)} a ${paraBr(dadosNumerica.vigencia.fim)} de ${dadosNumerica.ano}. Para outra data é preciso a escala nova.`}
          />
        )}

        {vista.tipo === 'feriado' && (
          <BlocoOrdem
            rotulo={vista.feriado}
            lista={vista.lista}
            meta={`feriado · fila única · ${vista.lista.length} nomes`}
          />
        )}

        {vista.tipo === 'dia' && (
          <>
            {vista.blocos.map((b) => (
              <BlocoOrdem key={b.hospital} rotulo={LABEL_HOSPITAL[b.hospital]} lista={b.lista} />
            ))}
            <BlocoConsultorio consultorio={vista.consultorio} />
          </>
        )}

        {Boolean(vista.pendencias?.length) && (
          <div className="flex flex-col gap-1.5 rounded-[16px] border border-warning/40 bg-warning/10 p-3">
            {vista.pendencias.map((p) => (
              <p key={p} className="flex items-start gap-2 text-[12px] leading-snug">
                <TriangleAlert className="mt-px size-3.5 flex-none text-warning" aria-hidden="true" />
                {p}
              </p>
            ))}
          </div>
        )}

        {vista.tipo !== 'vazio' && (
          <p className="flex items-start gap-1.5 px-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <Umbrella className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
            {erro
              ? `Férias NÃO conferidas: ${erro}. A lista está sem a marca de férias.`
              : loading
                ? 'Consultando as férias no Pega Plantão…'
                : `Férias do Pega Plantão, consultadas ${conferidoEm ? `às ${conferidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'agora'}. Quem está de férias fica na posição, marcado.`}
          </p>
        )}
      </div>
    </div>
  )
}
