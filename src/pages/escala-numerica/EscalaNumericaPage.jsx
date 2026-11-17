/**
 * Escala Numérica — consulta da ORDEM DE LIBERAÇÃO esperada de um dia, por hospital e turno.
 *
 * Base: a escala numérica do grupo (`src/data/escalaNumerica.json` + `src/lib/escalaNumerica.js`),
 * a mesma que a conferência usa. A FILA aqui só é lida: nada grava `ordem_liberacao` — o rodapé
 * publicado continua sendo a fonte da fila, e divergir dele é assunto da conferência da escala
 * cirúrgica. A única escrita da tela é a observação no pé de cada card (dono 08/10), em tabela
 * própria (`escala_numerica_observacao`).
 *
 * Diferença deliberada para a conferência (dono 03/09): férias MARCAM, não excluem. Quem está de
 * férias no Pega Plantão aparece na posição dele com "(férias)" ao lado — o grupo quer ver a fila
 * do quadro inteira. As férias são consultadas na hora, ao abrir a tela.
 *
 * Regras completas: `.claude/rules/escala-numerica.md`.
 */
import { useState, useMemo, useEffect } from 'react'
import { DatePicker, DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel } from '@/design-system'
import { PageHeader } from '@/components'
import { RefreshCw, CalendarClock, Umbrella, TriangleAlert, Info, Printer, Clock, CalendarDays } from 'lucide-react'
import SegmentedSelector from '../escala-cirurgica/SegmentedSelector'
import dadosNumerica from '@/data/escalaNumerica.json'
import { acentuarNome } from '@/lib/nomeAcentos'
import { LABEL_HOSPITAL, LABEL_TURNO } from '@/lib/escalaNumerica'
import { montarVistaNumerica } from '@/lib/escalaNumericaVista'
import { getPlantoesPorData } from '@/services/pegaPlantaoApi'
import { BlocoOrdem, BlocoConsultorio } from './ListaOrdem'
import FolhaImpressao from './FolhaImpressao'
import { useFeriasDoAno, feriasNaData } from './useFeriasDoAno'
import { sabadoDoFimDeSemana, filaPn } from './plantonistasFds'
import { usePosPlantao } from './usePosPlantao'
import ObservacaoCard from './ObservacaoCard'
import { useObservacoes, chaveObservacao } from './useObservacoes'
import { useUser } from '@/contexts/UserContext'
import { podeEditarEscalaCirurgica } from '../escala-cirurgica/gate'
import { paraISO, paraBr, DIA_LONGO } from './calendario'

const TURNOS = [
  { value: 'matutino', label: LABEL_TURNO.matutino },
  { value: 'vespertino', label: LABEL_TURNO.vespertino },
]

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
          Postos do Pega Plantão, do P1 ao P12.
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
            <span data-slot="fds-nome" className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{acentuarNome(p.nome)}</span>
            <span className="flex-none text-[11px] tabular-nums text-muted-foreground">{p.faixa}</span>
          </div>
        ))}
      </section>
      {/* Regra do dono (03/09), depois de eu cruzar os FDS de 15/08 e 22/08 com a API:
          **de P5 a P12 a ordem do Pega Plantão é a ordem real**; **em P1–P4 o Pega Plantão
          NÃO está em ordem** — os quatro nomes estão certos, mas a ordem deles só sai junto
          com a escala do fim de semana, na tabela de liberações. O dono mandou manter a lista
          como está; o que a tela deve fazer é dizer isso, em vez de deixar o leitor supor que
          os quatro primeiros já estão na ordem de liberação. */}
      <p className="flex items-start gap-1.5 px-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
        Esta fila NÃO faz parte da escala numérica do grupo, que só traz dia útil. De P5 em diante a ordem é
        exatamente a do Pega Plantão. Em P1 a P4 os nomes estão certos, mas a ordem não: a ordem real desses
        quatro sai junto com a escala do fim de semana, na tabela de liberações.
      </p>
    </>
  )
}

/** A lista de um turno, como a tela mostra — a montagem mora em `@/lib/escalaNumericaVista`. */
const montarVista = (dataISO, turno, ferias, noturnos, ausentes = null) =>
  montarVistaNumerica(dadosNumerica, dataISO, turno, ferias, noturnos, ausentes)

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

  const { registros, licencas, loading, erro, conferidoEm, recarregar } = useFeriasDoAno(dadosNumerica.ano)
  const ferias = useMemo(() => feriasNaData(registros, dataISO), [registros, dataISO])
  const ausentes = useMemo(() => feriasNaData(licencas, dataISO), [licencas, dataISO])

  // plantão noturno da véspera: na manhã P1/P2 sobem para a 2ª do hospital em que
  // plantonaram; na tarde ficam onde a numérica os põe, marcados (dono 03/09)
  const posPlantao = usePosPlantao(dataISO)

  const vista = useMemo(
    () => montarVista(dataISO, turno, ferias, posPlantao.noturnos, ausentes),
    [dataISO, turno, ferias, posPlantao.noturnos, ausentes]
  )

  const ehFds = vista.tipo === 'vazio' && vista.motivo === 'fim_de_semana'
  const fds = useFilaFds(dataISO, ehFds)

  // observação no pé de cada card, por turno (dono 08/10): lê todo mundo, escreve quem opera a
  // escala cirúrgica (mesmo gate da RLS). Enquanto não carregou — ou se a leitura falhou — não
  // se escreve: gravar às cegas apagaria a anotação de outra pessoa
  const { user } = useUser()
  const obs = useObservacoes(dataISO)
  const podeEscrever = podeEditarEscalaCirurgica(user) && !obs.carregando && !obs.erro
  const observacao = (hospital) => (
    <ObservacaoCard
      key={`${dataISO}:${turno}:${hospital}`}
      rotulo={LABEL_HOSPITAL[hospital]}
      observacao={obs.porChave[chaveObservacao(turno, hospital)]}
      podeEscrever={podeEscrever}
      onSalvar={(texto) => obs.salvar(
        { turno, hospital, texto },
        { userId: user?.uid || user?.id, userName: user?.displayName || user?.nome }
      )}
    />
  )
  const observacoesDoTurno = (t) => Object.fromEntries(
    ['hro', 'unimed', 'materno', 'consultorio'].map((h) => [h, obs.porChave[chaveObservacao(t, h)]?.texto || ''])
  )

  const subtitulo = `${DIA_LONGO[data.getDay()]}, ${paraBr(dataISO)}`

  // Impressão (dono 25/09): 'turno' = o que está na tela · 'dia' = manhã e tarde. A folha só
  // monta enquanto a impressão está aberta; o diálogo abre no quadro seguinte, com ela no DOM.
  const [impressao, setImpressao] = useState(null)
  useEffect(() => {
    if (!impressao) return undefined
    const fim = () => setImpressao(null)
    window.addEventListener('afterprint', fim)
    const raf = requestAnimationFrame(() => window.print())
    return () => { cancelAnimationFrame(raf); window.removeEventListener('afterprint', fim) }
  }, [impressao])

  const turnosImpressos = !impressao ? [] : impressao === 'dia'
    ? TURNOS.map((t) => ({
      rotulo: t.label,
      turno: t.value,
      vista: t.value === turno ? vista : montarVista(dataISO, t.value, ferias, posPlantao.noturnos, ausentes),
      observacoes: observacoesDoTurno(t.value),
    }))
    : [{ rotulo: LABEL_TURNO[turno], turno, vista, observacoes: observacoesDoTurno(turno) }]
  const notaFerias = erro
    ? 'Férias NÃO conferidas'
    : conferidoEm
      ? `Férias do Pega Plantão conferidas às ${conferidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : ''

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala Numérica"
        subtitle={subtitulo}
        onBack={goBack}
        actions={
          <div className="flex items-center">
            {vista.tipo !== 'vazio' && (
              <DropdownMenu>
                <DropdownTrigger asChild>
                  <button
                    type="button"
                    className="p-2 text-primary transition-opacity hover:opacity-70"
                    aria-label="Imprimir a escala numérica"
                  >
                    <Printer className="size-5" />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end" className="w-[232px]">
                  <DropdownLabel>Imprimir</DropdownLabel>
                  <DropdownItem icon={<Clock className="size-5 text-primary" />} onClick={() => setImpressao('turno')}>
                    <b className="block text-[14.5px] font-semibold">Só a {LABEL_TURNO[turno].toLowerCase()}</b>
                    <span className="block text-[12px] text-muted-foreground">o turno na tela · A4 colorido</span>
                  </DropdownItem>
                  <DropdownItem icon={<CalendarDays className="size-5 text-primary" />} onClick={() => setImpressao('dia')}>
                    <b className="block text-[14.5px] font-semibold">O dia inteiro</b>
                    <span className="block text-[12px] text-muted-foreground">manhã e tarde · A4 deitado, colorido</span>
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              onClick={() => { recarregar(); obs.recarregar() }}
              disabled={loading}
              className="p-2 text-primary transition-opacity hover:opacity-70 disabled:opacity-50"
              aria-label="Consultar as férias de novo"
            >
              <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {impressao && (
        <FolhaImpressao
          // papel fica guardado: a data vai com o ano
          dia={`${DIA_LONGO[data.getDay()]}, ${paraBr(dataISO)}/${dataISO.slice(0, 4)}`}
          diaInteiro={impressao === 'dia'}
          turnos={turnosImpressos}
          notaFerias={notaFerias}
        />
      )}

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
            {/* "quantos trabalham" só no HRO e na Unimed (dono 07/10) — o Materno são duas posições */}
            {vista.blocos.map((b) => (
              <BlocoOrdem
                key={b.hospital}
                rotulo={LABEL_HOSPITAL[b.hospital]}
                lista={b.lista}
                turno={b.hospital === 'materno' ? undefined : turno}
              >
                {observacao(b.hospital)}
              </BlocoOrdem>
            ))}
            <BlocoConsultorio consultorio={vista.consultorio}>{observacao('consultorio')}</BlocoConsultorio>
            {obs.erro && (
              <p className="flex items-start gap-1.5 px-0.5 text-[11.5px] leading-relaxed text-destructive">
                <TriangleAlert className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
                Não foi possível carregar as observações. Toque em atualizar para tentar de novo.
              </p>
            )}
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
                : `Férias do Pega Plantão, consultadas ${conferidoEm ? `às ${conferidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'agora'}. Linha pintada = não trabalha no turno (férias, ausência ou pós-plantão), e fica na posição.`}
          </p>
        )}
      </div>
    </div>
  )
}
