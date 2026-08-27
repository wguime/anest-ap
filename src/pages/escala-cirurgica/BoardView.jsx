/**
 * BoardView — visão COMPLETA da escala do hospital (todas as salas/casos).
 * Lista de cards agrupada por sala (mobile-first, sem grid). Toque no caso
 * abre um bottom-sheet com o detalhe.
 */
import { memo, useMemo, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, Stethoscope, Timer, UserCog, Plus } from 'lucide-react'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Badge, Button, EmptyState,
} from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { fraseClinica, titleCaseNome } from '@/lib/colunaLiberacao'
import { passaTurnoLabel } from '@/lib/escalaCirurgicaRegras'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { anestesistaDoCasoEh, casoConcluido, casosResolvidos, agruparPorSala, tipoBadge, normNome, filtrarPorTurno, casosQuePassamParaOTurno, turnoDoCaso, compararSalas, parseHoraMinutos, salaExibicao, nomeAnestesistaExibicao, convenioExibicao, idadeExibicao } from './utils'
import { podeEditarEscalaCirurgica } from './gate'
import { formatFaltante } from './PainelTempo'
import useAgoraMinuto from './useAgoraMinuto'
import useEstadoUrgencias from './useEstadoUrgencias'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import AddCasoSheet from './AddCasoSheet'
import CasoDetalheSheet from './CasoDetalheSheet'

// Grupo das cirurgias que atravessaram o turno. Valor impossível como chave de
// sala, para não colidir com nenhum grupo real do Accordion.
const CHAVE_HERDADAS = '__herdadas__'
// Rótulo do turno de origem — o mesmo vocabulário curto da barra de controles.
const rotuloTurno = (t) => (t === 'matutino' ? 'Manhã' : 'Tarde')

// Status em DOIS eixos (decisão do dono 2026-07-21):
// PRINCIPAL (exclusivo, pinta o card): agendada → Iniciada VERDE → Terminada AZUL.
// A tinta vive no CasoCard (`tinta`) desde 17/08 — aqui ficam só rótulo e variante.
const STATUS_CIRURGIA = {
  iniciada: { label: 'Iniciada', variant: 'success' },
  terminada: { label: 'Terminada', variant: 'info' },
}
// EXTRA (badge que convive com agendada/iniciada; terminada limpa e bloqueia):
const STATUS_EXTRA = {
  atrasada: { label: 'Atrasada', variant: 'warning' },
  suspensa: { label: 'Suspensa', variant: 'destructive' },
  passa_tarde: { label: 'Passa para tarde', variant: 'default', badgeClass: 'border-transparent bg-category-purple text-white' },
}
// dados/demos antigos ainda podem trazer o extra no campo principal.
// O rótulo do `passa_tarde` vem do TURNO DO CASO (dono 20/08): de manhã "Passa
// para tarde", à tarde "Passa para noite" — o valor gravado é o mesmo.
const extraDe = (caso) => {
  const chave = STATUS_EXTRA[caso.statusExtra] ? caso.statusExtra
    : STATUS_EXTRA[caso.statusCirurgia] ? caso.statusCirurgia : null
  if (!chave) return null
  const cfg = STATUS_EXTRA[chave]
  return chave === 'passa_tarde' ? { ...cfg, label: passaTurnoLabel(turnoDoCaso(caso)) } : cfg
}

/** Caso "placeholder" (ex.: SRPA sem procedimentos): não renderiza card — só o cabeçalho da sala. */
export const casoVazio = (c) =>
  !String(c?.hora || '').trim() && !String(c?.pacienteIniciais || '').trim() &&
  !String(c?.procedimento || '').trim() && !String(c?.cirurgiao || '').trim()

/**
 * Exportado: a aba Minhas e o painel da linha (Liberações) usam o MESMO card
 * (pedido do dono 2026-07-21 / 29-07).
 * Grafia: nunca CAIXA ALTA — procedimento em frase (siglas preservadas), nomes em Title Case.
 *
 * ARRANJO (dono 17/08): coluna do TEMPO à esquerda (hora, duração estimada e o
 * que falta) e três linhas à direita — 1ª: iniciais · idade · selos de estado e
 * convênio; 2ª: o PROCEDIMENTO, em linha própria; 3ª: cirurgião e residente.
 * O procedimento e o nome do cirurgião ganharam a linha inteira porque os dois
 * viviam truncados disputando espaço com os selos.
 * Os selos moram em duas caixas de largura MÍNIMA fixa: card sem status ou sem
 * convênio guarda o lugar, e a coluna não serrilha de um card para o outro.
 *
 * `moldura`: 'linha' é o quadro denso da aba Completa (full-bleed, divisória em
 * baixo); 'card' é o cartão isolado que a Minhas usa. Mesmo conteúdo, molduras
 * diferentes — as duas abas não podem divergir no que mostram.
 *
 * `agoraMin` vem de FORA de propósito: o cronômetro precisa de um único intervalo
 * para a lista toda (ver useAgoraMinuto), não um timer por card. Sem ele, o card
 * mostra a HORA do término em vez da contagem — nunca perde a informação.
 */
export function casoTemColunaTempo(caso) {
  if (String(caso?.hora || '').trim()) return true
  if (String(caso?.tempoEstimado || '').trim()) return true
  return !casoConcluido(caso) && parseHoraMinutos(caso?.terminoPrevisto) != null
}

function CasoCardBase({ caso, destaque, salaLabel, onClick, agoraMin = null, moldura = 'card', reservaHora = false }) {
  const tb = tipoBadge(caso.tipo)
  const st = STATUS_CIRURGIA[caso.statusCirurgia]
  const ex = extraDe(caso)
  const procedimento = fraseClinica(caso.procedimento)
  const cirurgiao = titleCaseNome(caso.cirurgiao)
  // residente ACOMPANHA o caso (dono 29/07) — aparece abaixo do cirurgião, em peso
  // menor: quem responde pelo caso continua sendo o anestesista.
  const residente = titleCaseNome(caso.residente)
  // exibição enxuta (dono 17/08): "Unimed X" vira "Unimed"; idade só em anos
  const convenio = convenioExibicao(caso.convenio)
  const idade = idadeExibicao(caso.idade)
  // Tempo faltante DESTA CIRURGIA (dono 29/07) — informado à mão no detalhe do
  // caso. Some quando o caso encerra: contagem de cirurgia terminada é ruído.
  const alvoCaso = casoConcluido(caso) ? null : parseHoraMinutos(caso.terminoPrevisto)
  // CONTAGEM SÓ NO CASO EM ANDAMENTO (pesquisa + decisão do dono 29/07). Quadro de
  // centro cirúrgico conta o tempo restante do caso EM CURSO; os agendados mostram
  // a HORA prevista. Dois motivos:
  //  1. desambigua por construção — se só UMA cirurgia da pessoa pode contar,
  //     "~45min" nunca é confundível com o total dela (a pílula verde da fila);
  //  2. depois que a estimativa estoura, o tempo médio restante fica quase
  //     CONSTANTE em vez de convergir para zero (Dexter & Epstein, Anesth Analg,
  //     no paper sobre o que exibir em whiteboard eletrônico), então contar caso
  //     que ainda não começou é chute apresentado como número.
  const emAndamento = (caso.statusCirurgia || 'agendada') === 'iniciada'
  const faltaCaso = emAndamento && alvoCaso != null && agoraMin != null
    ? formatFaltante(alvoCaso, agoraMin)
    : null
  const rotulo = ['Detalhes do caso', salaLabel, caso.hora, caso.pacienteIniciais, procedimento]
    .filter(Boolean).join(', ')
  // SÓ o eixo principal pinta o card, e em tinta suave (dono 17/08): com os cinco
  // estados pintando, o quadro virava vitral. Atrasada/suspensa/passa-para-tarde
  // continuam existindo — no badge, sobre fundo neutro.
  const tinta = caso.statusCirurgia === 'iniciada'
    ? 'bg-success/[0.14] dark:bg-success/20'
    : caso.statusCirurgia === 'terminada'
      ? 'bg-info/[0.12] dark:bg-info/[0.22]'
      : ''
  const emLinha = moldura === 'linha'
  // Sem paciente identificado (bloco de exames, lote de FACO, posição de apoio) a
  // linha de identificação nasceria vazia — aí o procedimento sobe para ela e o
  // card fica com duas linhas (dono 17/08).
  const temIdentificacao = Boolean(salaLabel || caso.pacienteIniciais || idade)
  const temColunaHora = casoTemColunaTempo(caso)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={[
        'w-full text-left min-h-[44px] transition-colors',
        emLinha ? 'border-b border-border/70 px-3 py-2' : 'rounded-xl border p-3',
        // hover só onde hover existe de verdade — no touch o :hover "gruda" após o tap
        // e o card fica oscilando entre a tinta do status e o cinza (bug reportado no mobile)
        'active:bg-muted/60 supports-[hover:hover]:hover:bg-muted/40',
        tinta || (emLinha ? 'bg-card' : destaque ? 'border-primary/60 bg-primary/5' : 'border-border bg-card'),
        tinta && !emLinha ? (destaque ? 'border-primary/60' : 'border-border') : '',
        // convênio identifica só pelo SELO (stripe lateral removida a pedido do dono 2026-07-21)
      ].filter(Boolean).join(' ')}
    >
      <div className="flex gap-2">
        {/* COLUNA DO TEMPO (dono 17/08): hora, duração estimada e o tempo faltante
            desta cirurgia ficam juntos embaixo do horário — espalhados pelo card,
            os três eram lidos como coisas de assuntos diferentes. À direita sobram
            só status e convênio. */}
        {temColunaHora && (
          <span className="w-[46px] shrink-0">
            {caso.hora && <span className="block text-[15px] font-bold tabular-nums text-foreground">{caso.hora}</span>}
            {/* A duração SUGERIDA pela escala cede a vez assim que alguém informa o
                término (dono 17/08): mostrar as duas é ler o palpite e o combinado
                lado a lado. */}
            {caso.tempoEstimado && alvoCaso == null && (
              <span
                className="flex items-center gap-0.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground"
                title={`Duração estimada desta cirurgia: ${caso.tempoEstimado}`}
              >
                <Timer className="h-2.5 w-2.5 shrink-0" />{caso.tempoEstimado}
              </span>
            )}
            {/* CONTAGEM SÓ NO CASO EM ANDAMENTO (regra 29/07): agendada mostra a
                hora prevista de término; contar o que ainda não começou é chute
                apresentado como número. */}
            {faltaCaso ? (
              <>
                {/* A ÂNCORA VOLTA QUANDO O TEMPO ESTOURA (dono 18/08). Enquanto
                    falta, "~45min" se explica sozinho; depois que passa, o card
                    ficava só com "+50min" — e o horário que dá sentido ao número
                    era justamente o que sumia. Some a referência e o sinal vira
                    adivinhação: 50min do quê, faltando ou passados? Com o
                    previsto de volta, a coluna lê-se de cima para baixo — começou
                    08:45, previa terminar 10:01, passou 50min disso. */}
                {faltaCaso.atrasada && (
                  <span className="block whitespace-nowrap text-[10px] tabular-nums text-muted-foreground line-through">
                    →{caso.terminoPrevisto}
                  </span>
                )}
                <span
                  className={`block whitespace-nowrap text-[10px] font-semibold tabular-nums ${faltaCaso.atrasada ? 'text-warning' : 'text-foreground/70'}`}
                  title={faltaCaso.atrasada
                    ? `Esta cirurgia estava prevista para terminar às ${caso.terminoPrevisto} — passou ${faltaCaso.texto.replace('+', '')}`
                    : `Esta cirurgia (em andamento) termina às ${caso.terminoPrevisto}`}
                >
                  {faltaCaso.texto}
                </span>
              </>
            ) : alvoCaso != null ? (
              <span
                className="block text-[10px] tabular-nums text-muted-foreground"
                title={`Esta cirurgia está prevista para terminar às ${caso.terminoPrevisto}`}
              >
                →{caso.terminoPrevisto}
              </span>
            ) : null}
          </span>
        )}
        {/* CAIXA VAZIA NO LUGAR DA HORA (dono 18/08): caso sem horário começava
            colado na margem e o quadro serrilhava — a urgência encaixada parecia
            de outra lista. A reserva vale para o QUADRO inteiro, não por sala: a
            urgência acrescentada à mão cai numa sala própria, sem horário nenhum,
            e a reserva por sala deixava a sala inteira fora do prumo do resto
            (print do dono às 09h). Quadro sem NENHUM horário não paga o recuo. */}
        {!temColunaHora && reservaHora && <span aria-hidden className="w-[46px] shrink-0" />}
        {/* Três linhas próximas (dono 17/08): paciente / procedimento / cirurgião
            lêem como um bloco só, com um respiro de 3px entre elas — coladas de
            todo, o selo do convênio encostava no texto de cima. Os selos ocupam
            os DOIS cantos direitos — em cima o estado da cirurgia, embaixo o
            convênio — e cada canto guarda o lugar mesmo vazio, senão a coluna
            serrilha de um card para o outro.
            SEM paciente identificado (bloco de exames, lote de FACO, posição), o
            procedimento SOBE para a primeira linha: a linha de identificação
            ficaria vazia, com o badge sozinho e um buraco à esquerda. */}
        <span className="min-w-0 flex-1 leading-tight">
          {/* Linha 1 — de quem é (ou, sem paciente, o próprio procedimento) + o
              estado agora, no canto superior direito */}
          <span className="flex items-center gap-1.5">
            {salaLabel && <span className="shrink-0 text-sm font-bold text-foreground">{salaLabel}</span>}
            {caso.pacienteIniciais && (
              <span className="shrink-0 text-[14.5px] font-bold text-foreground" title={caso.pacienteIniciais}>
                {caso.pacienteIniciais}
              </span>
            )}
            {idade && <span className="shrink-0 text-xs text-muted-foreground">{idade}</span>}
            {!temIdentificacao && procedimento && (
              <span className="min-w-0 truncate text-[14.5px] text-foreground" title={procedimento}>
                {procedimento}
              </span>
            )}
            <span className="ml-auto flex shrink-0 items-center justify-end gap-1">
              {/* à ESQUERDA: o que a cirurgia É — urgência/emergência */}
              {tb && <Badge variant={tb.variant} badgeStyle={tb.style}>{tb.label}</Badge>}
              {/* o estado da cirurgia, sempre na mesma vertical */}
              <span className="flex min-w-[76px] items-center justify-end">
                {st && <Badge variant={st.variant}>{st.label}</Badge>}
              </span>
              {/* CANTO SUPERIOR DIREITO = a OCORRÊNCIA (dono 20/08): passa para
                  tarde/noite, atrasada, suspensa. Antes o extra vinha à esquerda
                  da caixa reservada do estado, então num caso agendado (caixa
                  vazia) ele flutuava a 76px da borda, longe do canto e sem nada
                  à direita — parecia solto no meio do card. Agora é o último
                  elemento da linha: com estado ou sem, encosta no canto. */}
              {ex && <Badge variant={ex.variant} className={ex.badgeClass}>{ex.label}</Badge>}
            </span>
          </span>
          {/* Linha 2 — QUAL cirurgia, na linha inteira */}
          {temIdentificacao && procedimento && (
            <span className="mt-[3px] block truncate text-[14.5px] text-foreground" title={procedimento}>
              {procedimento}
            </span>
          )}
          {/* Linha 3 — quem opera + o convênio no canto inferior direito */}
          <span className="mt-[3px] flex items-center gap-x-1.5">
            {cirurgiao && (
              <span className="min-w-0 truncate text-sm text-foreground/90" title={cirurgiao}>{cirurgiao}</span>
            )}
            {residente && (
              <span className="shrink-0 text-[11.5px] text-muted-foreground" title={`Residente: ${residente}`}>
                · R: {residente}
              </span>
            )}
            <span className="ml-auto flex min-w-[46px] max-w-[110px] shrink-0 justify-end">
              {/* MESMA grafia dos badges de estado (dono 17/08): o selo do convênio
                  copia a métrica do Badge do DS — 11px semibold, leading-none,
                  px-2 py-1, raio 10 — e muda só a tinta, que é tonal de propósito
                  (o convênio identifica, não é estado). Antes ele saía em 12px
                  medium e a linha ficava com dois tamanhos de letra. */}
              {convenio && (
                <span className="truncate rounded-[10px] border border-transparent bg-black/10 px-2 py-1 text-[11px] font-semibold leading-none text-foreground/80 dark:bg-white/15 dark:text-foreground/90"
                  title={caso.convenio}>
                  {convenio}
                </span>
              )}
            </span>
          </span>
        </span>
      </div>
    </button>
  )
}

/**
 * memo com comparador que IGNORA `onClick` de propósito (dono 19/08, resposta
 * tátil imediata): o update otimista do context troca só a referência do caso
 * tocado (e `resolverAnestesistas` preserva as demais), então com memo um toque
 * no status re-renderiza UM card, não o quadro inteiro. Os call sites (Completa
 * e Minhas) criam `onClick` inline (`() => setDetalhe(caso)`), o que derrotaria
 * o memo por identidade; ignorá-lo é seguro enquanto o handler depender só de
 * `caso` (mesma referência ⇒ closure equivalente) e de setters estáveis do
 * React — contrato a manter em call site novo.
 */
export const CasoCard = memo(CasoCardBase, (prev, next) =>
  prev.caso === next.caso && prev.destaque === next.destaque &&
  prev.salaLabel === next.salaLabel && prev.agoraMin === next.agoraMin &&
  prev.moldura === next.moldura && prev.reservaHora === next.reservaHora
)

export default function BoardView({ escala, meuAlias, meuUid, turno, onNavigate }) {
  const { user } = useUser()
  const { rosterByUid } = useRosterAnestesistas()
  // Nome do grupo na Completa (pedido do dono 23/07): 1 anestesista = 1º nome +
  // último sobrenome (do cadastro); 2 anestesistas ("A + B") = só os primeiros nomes.
  // Delega a `nomeAnestesistaExibicao` (utils) — é a MESMA função que o sheet de
  // definir usa, senão cabeçalho e sheet divergem ("Guilherme Staub" × "Staub").
  const displayGrupo = (g) => nomeAnestesistaExibicao({
    uid: g.casos.find((c) => c.anestesistaUserId)?.anestesistaUserId,
    alias: g.anestesista,
    rosterByUid,
  })
  const [detalhe, setDetalhe] = useState(null)
  const [definir, setDefinir] = useState(null) // { sala, caso? } — sheet Definir anestesista
  const [addCaso, setAddCaso] = useState(false)
  // Accordion controlado p/ "recolher todas" (pedido 2026-07-21): null = padrão (abertas)
  const [abertas, setAbertas] = useState(null)
  // UM intervalo p/ o board inteiro (não um por card) — alimenta o tempo faltante
  // de cada cirurgia nos CasoCard.
  const agoraMin = useAgoraMinuto()
  const casos = useMemo(() => filtrarPorTurno(casosResolvidos(escala), turno), [escala, turno])
  // AINDA ABERTAS DO OUTRO TURNO (dono 21/08, o relato que abriu a revisão): a
  // faixa de urgências conta o DIA INTEIRO e o quadro só o turno — medido em
  // produção, das 5 urgências abertas do HRO às 15h, QUATRO eram da manhã e não
  // tinham card na aba Tarde. Sem card não há como marcar Terminada, e terminar
  // outra coisa não mexia na faixa: "finalizei e o mostrador não finalizou".
  // A lista vem do MESMO estado que alimenta a faixa — derivadas da mesma fonte,
  // as duas não têm como discordar. Fora do HRO vem vazia e nada muda.
  const { herdados } = useEstadoUrgencias(escala, { hospital: escala?.hospital, turno })
  const idsDoTurno = useMemo(() => new Set(casos.map((c) => c.id).filter(Boolean)), [casos])
  // "Passa para tarde" entra no MESMO grupo (dono 2026-08-22): também é cirurgia
  // que atravessou o turno, e o grupo já existe e já foi escolhido para isso. A
  // diferença é a origem — as urgências vêm do contrato do HRO e só de lá; esta
  // vale em qualquer hospital, porque a marcação é do quadro.
  const herdadasVisiveis = useMemo(() => {
    const vistos = new Set()
    const out = []
    for (const c of [...herdados, ...casosQuePassamParaOTurno(casosResolvidos(escala), turno)]) {
      const chave = c.id || `${c.sala}|${c.ordem}|${c.procedimento}`
      if (vistos.has(chave) || (c.id && idsDoTurno.has(c.id))) continue
      vistos.add(chave)
      out.push(c)
    }
    return out
  }, [herdados, idsDoTurno, escala, turno])
  const grupos = useMemo(() => agruparPorSala(casos), [casos])
  // MARGEM ÚNICA DO QUADRO (dono 18/08): quem não tem horário recua igual, em
  // qualquer sala — a urgência acrescentada à mão vira sala própria sem horário
  // nenhum e a reserva por sala a deixava fora do prumo do resto. Quadro sem
  // NENHUM horário (nada a alinhar) segue sem recuo.
  const reservaHora = useMemo(() => casos.some(casoTemColunaTempo), [casos])

  // GRUPOS DE EXIBIÇÃO (pedido do dono 23/07): sala com MAIS de um anestesista
  // (IOSC/Exames/Umanitá/…) vira UM GRUPO POR ANESTESISTA — "IOSC — Cury",
  // "IOSC — Melo" — cada um se comporta como sala separada, sem dúvidas de quem
  // cobre o quê. Sala de anestesista único segue como um grupo só.
  const gruposExibicao = useMemo(() => {
    const out = []
    const salasOrdenadas = [...grupos.keys()].sort(compararSalas(escala?.hospital))
    // Caso DESCOBERTO (flag semAnestesista ou texto vazio/"?") conta como nome "?"
    // no critério de split (bug 30/07): o filter(Boolean) descartava o texto vazio
    // da contagem e a sala mista ABSORVIA o caso no grupo do colega de cima — que
    // aparecia como responsável por ele depois da publicação (a conferência, que
    // decide pela flag, mostrava certo). Mesma regra da fila (gerarColunaLiberacao
    // testa a flag antes do nome).
    const nomeSplit = (c) => (c.semAnestesista ? '?' : normNome(c.anestesista) || '?')
    for (const sala of salasOrdenadas) {
      const lista = grupos.get(sala)
      const nomes = [...new Set(lista.map(nomeSplit))]
      if (nomes.length <= 1) {
        out.push({ chave: sala, sala, anestesista: lista.find((c) => c.anestesista)?.anestesista || '', casos: lista, split: false })
        continue
      }
      const porAnest = new Map()
      for (const c of lista) {
        const k = nomeSplit(c)
        if (!porAnest.has(k)) porAnest.set(k, { chave: `${sala}|${k}`, sala, anestesista: (k === '?' ? '?' : c.anestesista) || '', casos: [], split: true })
        porAnest.get(k).casos.push(c)
      }
      out.push(...porAnest.values())
    }
    return out
  }, [grupos, escala?.hospital])
  // dupla "A + B": o caso é das DUAS — o helper cobre (uid é null por construção)
  const ehMeu = (c) => anestesistaDoCasoEh(c, { uid: meuUid, alias: meuAlias })

  const isDemo = String(escala?.id).startsWith('demo-')
  const canEdit = podeEditarEscalaCirurgica(user)
  // Sistema de trocas APOSENTADO (2026-07-23): quem define é o RESPONSÁVEL da sala.
  // Desde 27/07 o botão é de TODA a equipe que edita a escala (mesmo conjunto da
  // RLS), não só do dono da sala/coordenador: exigir ser o dono escondia o ⚙ do
  // board inteiro para a maioria — quem chegava para cobrir um colega não tinha
  // como assumir, e a identidade não resolvida (caso sem uid, apelido fora do
  // dicionário) tirava o botão até da própria sala. Escala é colaborativa; toda
  // definição vai para `escala_cirurgica_evento` (sem notificação — decisão 30/07).
  const podeDefinir = canEdit && !isDemo

  if (!escala || !escala.casos?.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Sem escala publicada"
        description="A escala deste hospital ainda não foi importada para esta data."
      />
    )
  }
  // ⚠️ o EmptyState não pode engolir as herdadas: o turno sem caso nenhum é
  // exatamente a situação em que a urgência que atravessou precisa ser vista.
  if (!casos.length && !herdadasVisiveis.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Nenhum caso neste turno"
        description="Não há casos no turno selecionado. Troque para o outro turno."
      />
    )
  }

  const chavesGrupos = [
    ...gruposExibicao.map((g) => g.chave),
    ...(herdadasVisiveis.length ? [CHAVE_HERDADAS] : []),
  ]

  const abertasAtual = abertas ?? chavesGrupos
  const algumaAberta = abertasAtual.length > 0

  return (
    <>
      <div className="mb-2 flex gap-2">
        {canEdit && !isDemo && (
          <Button size="sm" variant="outline" onClick={() => setAddCaso(true)} className="min-w-0 flex-1">
            <Plus className="w-4 h-4" /> Adicionar caso (urgência/encaixe)
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAbertas(algumaAberta ? [] : chavesGrupos)}
          aria-label={algumaAberta ? 'Recolher todas as salas' : 'Expandir todas as salas'}
          className={canEdit && !isDemo ? 'shrink-0' : 'w-full'}
        >
          {algumaAberta ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
          {canEdit && !isDemo ? null : (algumaAberta ? 'Recolher todas' : 'Expandir todas')}
        </Button>
      </div>
      {/* QUADRO DENSO (dono 17/08): as salas viram faixas full-bleed com divisórias
          em vez de cartões soltos — cabem 6 casos na tela contra 4, e o cabeçalho
          fica sendo a única superfície com moldura. `-mx-4` desfaz o padding
          lateral da página; a sala segue colapsável (chevron do Accordion). */}
      {/* deitado: as MESMAS faixas em DUAS COLUNAS (dono 26/08). O card de cada
          cirurgia não muda — hora, iniciais, procedimento, cirurgião e a tinta de
          "iniciada" são os de hoje; o que muda é quantas salas cabem na tela: a
          linha do caso usa ~360px dos 736 disponíveis e a outra metade ficava
          vazia. Multi-coluna porque a sala é um bloco inteiro que não pode ser
          partido (`break-inside-avoid`) e a leitura continua sendo de cima para
          baixo, coluna a coluna. */}
      <Accordion type="multiple" value={abertasAtual} onValueChange={setAbertas} className="-mx-4 divide-y-0 deitado:columns-2 deitado:gap-4 [&>*]:deitado:break-inside-avoid">
        {gruposExibicao.map((g) => {
          const nomeGrupo = g.anestesista ? displayGrupo(g) : (g.split ? '?' : '')
          const nCasos = g.casos.filter((c) => !casoVazio(c)).length
          return (
            <AccordionItem key={g.chave} value={g.chave} className="border-0">
              {/* sticky no <h3> do header (no button interno é inerte — h3 tem a altura dele).
                  O fundo mora no h3: os `group-data-[state=open]` do trigger, do ⚙ e do
                  chevron são neutralizados para não pintarem faixas por cima dele. */}
              <AccordionTrigger
                /* o `dark:` também (bug visto no escuro, dono 17/08): o trigger do
                   DS pinta `dark:group-data-[state=open]:bg-card` e só a variante
                   clara estava neutralizada — no escuro o botão ficava `bg-card` e
                   o resto do cabeçalho `bg-card-elevated`, partindo a faixa em duas
                   cores na vertical, bem no meio do nome e do ⚙ */
                className="px-3 py-2 group-data-[state=open]:bg-transparent dark:group-data-[state=open]:bg-transparent"
                headerClassName="sticky top-14 z-10 border-y border-border bg-card-elevated"
                iconAfterActions
                iconClassName="group-data-[state=open]:bg-transparent dark:group-data-[state=open]:bg-transparent"
                actions={podeDefinir ? (
                  <button
                    type="button"
                    onClick={() => setDefinir({ sala: g.sala, casosAlvo: g.split ? g.casos : null })}
                    aria-label={`Definir anestesista da ${g.sala}${g.split ? ` (${nomeGrupo})` : ''}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center self-stretch
                               px-1 text-primary transition-colors active:opacity-60"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                ) : null}
              >
                {/* Tinta do cabeçalho (dono 17/08): o verde sólido pesava demais numa
                    lista de 12 salas. O badge repete a receita do seletor ATIVO da barra
                    de controles — primary/20 com texto primary — e o nome do anestesista
                    usa a MESMA cor do texto do badge, para o cabeçalho inteiro ler como
                    um bloco só. */}
                <span className="flex w-full min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-primary">
                    {salaExibicao(g.sala)}
                  </span>
                  {nomeGrupo && (
                    <span className="truncate text-[15px] font-semibold text-primary" title={nomeGrupo}>{nomeGrupo}</span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] font-normal text-muted-foreground">{nCasos}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                {/* SRPA e afins sem procedimentos: só o cabeçalho, sem card vazio */}
                {g.casos.filter((c) => !casoVazio(c)).map((caso) => (
                  <CasoCard
                    key={caso.id || `${g.chave}-${caso.ordem}`}
                    caso={caso}
                    destaque={ehMeu(caso)}
                    agoraMin={agoraMin}
                    moldura="linha"
                    reservaHora={reservaHora}
                    onClick={() => setDetalhe(caso)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          )
        })}
        {/* NO FIM, e não no meio das salas (escolha do dono 21/08): o quadro
            continua sendo do turno; o que atravessou fica separado e visível.
            A sala aparece NO CARD porque o grupo não é de uma sala só. */}
        {herdadasVisiveis.length > 0 && (
          <AccordionItem value={CHAVE_HERDADAS} className="border-0">
            <AccordionTrigger
              className="px-3 py-2 group-data-[state=open]:bg-transparent dark:group-data-[state=open]:bg-transparent"
              headerClassName="sticky top-14 z-10 border-y border-border bg-card-elevated"
              iconAfterActions
              iconClassName="group-data-[state=open]:bg-transparent dark:group-data-[state=open]:bg-transparent"
            >
              <span className="flex w-full min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-md bg-warning/20 px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-warning">
                  Ainda abertas
                </span>
                <span className="truncate text-[15px] font-semibold text-warning">
                  {rotuloTurno(turno === 'vespertino' ? 'matutino' : 'vespertino')}
                </span>
                <span className="ml-auto shrink-0 text-[11px] font-normal text-muted-foreground">
                  {herdadasVisiveis.length}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              {herdadasVisiveis.map((caso) => (
                <CasoCard
                  key={caso.id || `herdada-${caso.sala}-${caso.ordem}`}
                  caso={caso}
                  destaque={ehMeu(caso)}
                  salaLabel={salaExibicao(caso.sala)}
                  agoraMin={agoraMin}
                  moldura="linha"
                  reservaHora={reservaHora}
                  onClick={() => setDetalhe(caso)}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {detalhe && (
        <CasoDetalheSheet
          escala={escala}
          caso={detalhe}
          turno={turno}
          onClose={() => setDetalhe(null)}
          podeDefinirAnestesista={() => podeDefinir}
          onDefinirAnestesista={(sala, casoAlvo) => setDefinir({ sala, casosAlvo: casoAlvo ? [casoAlvo] : null })}
          podeEditar={podeDefinir}
        />
      )}

      {addCaso && (
        <AddCasoSheet
          escala={escala}
          turno={turno}
          onClose={() => setAddCaso(false)}
          onPreencherCobranca={(novo) => onNavigate?.('novaCirurgiaParticular', { escalaCasoId: novo.id })}
        />
      )}

      {definir && (
        <DefinirAnestesistaSheet
          escala={escala}
          sala={definir.sala}
          casosAlvo={definir.casosAlvo || null}
          turno={turno}
          onClose={() => setDefinir(null)}
        />
      )}
    </>
  )
}
