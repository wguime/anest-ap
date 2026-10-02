/**
 * CasoDetalheSheet — detalhe do caso COMPARTILHADO pelas abas Completa e Minhas.
 * Fonte única da UI de detalhe/status/troca (antes vivia só no BoardView e a aba
 * Minhas era um beco sem saída — pedido do dono 2026-07-21).
 *
 * Sincronizado AO VIVO: o caso exibido deriva de `escala.casos` (context) — updates
 * otimistas e realtime de outros usuários refletem com o sheet aberto.
 *
 * TIPO editável no Andamento (dono 20/08): a urgência que a importação não leu
 * como tal era um beco sem saída — só dava para escolher o tipo ao ADICIONAR o
 * caso. Reclassificar aqui coloca a cirurgia na conta do contrato do HRO.
 *
 * DESENHO "ANDAMENTO NO TOPO" (dono 17/08, escolhido em protótipo a 430px): o que
 * se toca no meio da cirurgia é o ESTADO, então ele abre o painel; a identidade do
 * caso vira cabeçalho (procedimento como título, iniciais/idade/convênio como
 * metadado) e o resto desce em três blocos de peso decrescente — Equipe, Tempo e,
 * por último, o raro (mudar de sala/local). Antes eram três botões empilhados
 * iguais, seis botões de status e três linhas de dados, tudo no mesmo peso.
 *
 * OS DADOS DO CASO SAÍRAM DAQUI (dono 01/09, modelo A escolhido em protótipo a
 * 430px): sala, cirurgião, convênio e residente tinham cada um seu editorzinho
 * neste painel, e hora, procedimento, paciente e idade não tinham nenhum. Hoje os
 * oito se corrigem no `AddCasoSheet` — o MESMO formulário do "Adicionar caso",
 * reaberto preenchido pelo botão "Editar dados da cirurgia" (`onEditarCaso`) — e
 * este painel voltou a ser só o do ESTADO, que é o que ele diz ser desde 17/08.
 * Medido no protótipo: com os mini-editores para os oito campos, o painel iria a
 * 1163px (rola, com o excluir 425px abaixo da dobra); assim ele fica em 721px e
 * cabe inteiro no teto de 88vh.
 *
 * ⚠️ O ANESTESISTA é a exceção e MANTÉM o botão: ele não é campo de texto — o
 * `DefinirAnestesistaSheet` mostra onde cada colega está, marca dupla na mesma
 * cirurgia e assume posição na fila.
 *
 * HORÁRIO DA CIRURGIA ACIMA DO ANDAMENTO (dono 02/10, modelo A escolhido em
 * protótipo `.tmp/inicio-termino-cirurgia.html`): "quero que seja possível adicionar
 * o horário de início e fim de cada procedimento [...] quero que essa informação
 * ganhe destaque e fique acima dos cards de andamento". O "Término desta cirurgia"
 * que morava no fim do Andamento SUBIU para o cartão novo, ao lado do início — dois
 * blocos grandes, cada um um botão. O horário anda junto com o status (trigger
 * `tr_escala_caso_horario_real`, ver `src/lib/escalaHorarioReal.js`).
 */
import { useMemo, useState } from 'react'
import { Clock, GraduationCap, MapPin, Stethoscope, UserCog } from 'lucide-react'
import { ActionPill, Badge, Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { HOSPITAL_LABEL, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import useRosterResidentes from '@/hooks/useRosterResidentes'
import { fraseClinica, titleCaseNome } from '@/lib/colunaLiberacao'
import { passaTurnoLabel } from '@/lib/escalaCirurgicaRegras'
import { carimboDeStatus } from '@/lib/escalaCirurgicaStatus'
import { duracaoMin, ehDiaOperacionalAtual, erroHorarioReal, gravarInicioReal, gravarTerminoReal, rotuloMinutos } from '@/lib/escalaHorarioReal'
import PainelTempo, { formatFaltante } from './PainelTempo'
import { BlocoHorario, BotaoEstimado, ConfirmarHorario } from './BlocoHorario'
import useAgoraMinutoEscala from './useAgoraMinutoEscala'
import { espelhoTempoTotal, nomeAnestesistaExibicao, normNome, parseHoraMinutos, rodapeDoTurno, salaExibicao, tipoBadge, turnoDoCaso, terminoEncadeado } from './utils'
import ChipsEscolha, { GRAVIDADE_CHIPS, TIPOS_CIRURGIA } from './ChipsEscolha'

// Verbo de cada estado na linha de procedência ("Iniciada às 14:33 por Fulano").
const STATUS_VERBO = { iniciada: 'Iniciada', terminada: 'Terminada' }

// EIXO PRINCIPAL — exclusivo, é o que pinta o card no quadro.
const ANDAMENTO = [
  { valor: 'agendada', label: 'Agendada' },
  { valor: 'iniciada', label: 'Iniciada', cls: 'bg-success text-success-foreground' },
  { valor: 'terminada', label: 'Terminada', cls: 'bg-info text-info-foreground' },
]
// TIPO da cirurgia (dono 20/08): a importação lê o mapa e às vezes a urgência não
// vem marcada — "digamos que essa cirurgia era uma urgência que não foi lida ao
// ser adicionada na escala". Reclassificar aqui é o que faz a cirurgia entrar na
// conta do contrato: vaga livre do plantão → senão fila → se já iniciada, Extra.
// Os chips vêm de ChipsEscolha (fonte única com o "Adicionar caso").

// GRAVIDADE — só em urgência/emergência. Adaptação da NCEPOD Classification of
// Intervention, que manda quem vai operar classificar no momento da decisão de
// operar: por isso fica aqui, no Andamento (onde se AGE), e não no cabeçalho de
// identidade — a gravidade muda no tempo, um "pode aguardar" que descompensa
// vira "imediata". É ela que ordena a fila de urgências do HRO.
// EIXO EXTRA — convive com agendada/iniciada; terminada limpa e bloqueia.
const AVISO = [
  { valor: 'atrasada', label: 'Atrasada', cls: 'border-warning bg-warning text-warning-foreground' },
  { valor: 'suspensa', label: 'Suspensa', cls: 'border-destructive bg-destructive text-destructive-foreground' },
  // por extenso, igual ao badge do quadro e da fila — abreviar aqui criaria um
  // terceiro nome para o mesmo estado (o chip quebra em duas linhas e cabe).
  // O rótulo vem do TURNO DO CASO (dono 20/08): de manhã "Passa para tarde", à
  // tarde "Passa para noite". O valor gravado é `passa_tarde` nos dois.
  { valor: 'passa_tarde', label: null, cls: 'border-category-purple bg-category-purple text-white' },
]

export default function CasoDetalheSheet({ escala, caso, turno, onClose, podeDefinirAnestesista, onDefinirAnestesista, onEditarCaso, podeEditar }) {
  const { setStatusCirurgia, atualizarCaso, adicionarAjuda, removerAjuda, setLinhaOverride } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { residenteByUid } = useRosterResidentes()
  const { rosterByUid } = useRosterAnestesistas()
  const agoraMin = useAgoraMinutoEscala()
  const isDemo = String(escala?.id).startsWith('demo-')
  // As folhas desta tela são as do HORÁRIO: 'tempo' (o tempo ESTIMADO — a previsão de
  // término) e a CONFIRMAÇÃO do início/término (`confirmar = { campo, viaStatus }`,
  // dono 02/10 à tarde). Os de sala/cirurgião/convênio/residente foram para o
  // formulário do caso em 01/09.
  const [editor, setEditor] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [horaExata, setHoraExata] = useState('') // hora exata de término da cirurgia

  // caso VIVO: busca a versão atual no estado (id); cai no prop p/ demo/sem id
  const vivo = useMemo(() => {
    if (!caso) return null
    return (caso.id && (escala?.casos || []).find((c) => c.id === caso.id)) || caso
  }, [escala, caso])

  // PROCEDÊNCIA do estado: quando mudou e por quem. Fica no DETALHE porque é onde
  // a pergunta se responde — o card do quadro não tem espaço e não decide nada.
  const carimbo = useMemo(
    () => carimboDeStatus(vivo, { dataEscala: escala?.data || null }),
    [vivo, escala?.data],
  )
  // Sem autor reconhecido (o uid é de quem TOCOU e o roster só cobre
  // anestesiologistas) a linha sai só com o horário — nunca "por —".
  const autorCarimbo = carimbo?.porUid
    ? nomeAnestesistaExibicao({ uid: carimbo.porUid, rosterByUid }) || ''
    : ''

  if (!vivo) return null

  // Um gate só para todos os ajustes do caso: quem edita a escala (canEdit), fora
  // da demo e com o caso já persistido (id) — sem id não há o que atualizar.
  const podeEditarCaso = !!podeEditar && !isDemo && !!vivo.id
  /** Reclassifica a cirurgia (eletiva ↔ urgência/emergência).
      Emergência é IMEDIATA por definição na adaptação da NCEPOD, então já nasce
      classificada quando a gravidade está vazia — mesmo pré-preenchimento do
      "Adicionar caso"; voltar para eletiva limpa a gravidade, que só existe em
      urgência. Otimista, como o resto do sheet. */
  const mudarTipo = (novo) => {
    const atual = vivo.tipo || 'eletiva'
    if (novo === atual) return
    const patch = { tipo: novo }
    if (novo === 'eletiva') patch.gravidade = null
    else if (novo === 'emergencia' && !vivo.gravidade) patch.gravidade = 'imediata'
    atualizarCaso(escala, vivo.id, patch).catch(() => {})
  }

  /** Grava a gravidade da urgência; tocar de novo no nível ativo desmarca.
      Sem await: o context é otimista (pinta no toque, reverte + toast em erro) —
      segurar o botão desabilitado durante a ida ao servidor era o delay que o
      dono reportou em 19/08. */
  const mudarGravidade = (nivel) =>
    atualizarCaso(escala, vivo.id, { gravidade: vivo.gravidade === nivel ? null : nivel }).catch(() => {})

  // RESIDENTE do caso (dono 29/07): acompanha, NÃO responde pelo caso — por isso é
  // seletor próprio e não entra em nenhum caminho de anestesista. Grava uid + nome
  // de exibição, como já é feito com anestesista/anestesistaUserId: com o uid, a aba
  // "Minhas" do residente passa a mostrar os casos dele.
  const residenteNome = vivo.residente
    || (vivo.residenteUserId && residenteByUid.get(vivo.residenteUserId)?.nome)
    || ''
  // TÉRMINO PREVISTO DESTA CIRURGIA (dono 29/07). É o tempo do CASO — o "quanto
  // falta para a pessoa sair" continua sendo o cronômetro da linha, nas Liberações.
  // Este sheet é o mesmo nas duas abas, então preencher aqui atende as duas.
  const definirTerminoCaso = async (hhmmEscolhido, meta) => {
    setHoraExata('') // limpa no toque; o chip pinta pelo otimista do context
    // DURAÇÃO numa cirurgia que ainda não começou vale DEPOIS da anterior da mesma
    // pessoa (dono 14/09, "some os tempos"): o painel diz que foi duração (`meta.minutos`);
    // hora exata digitada passa como veio. Mesma regra do "+ término" da fila.
    const hhmm = meta?.minutos ? (terminoEncadeado(escala, vivo, meta.minutos, agoraMin) || hhmmEscolhido) : hhmmEscolhido
    try {
      await atualizarCaso(escala, vivo.id, { terminoPrevisto: hhmm || null })
      // ESPELHO (dono 30/07): com UMA só cirurgia ativa no turno, o término dela
      // é o horário de saída da pessoa — o cronômetro da linha (Liberações)
      // acompanha sozinho, senão os dois campos divergiam e ninguém sabia qual
      // valia. Com 2+ casos o total segue 100% manual (nunca é soma de estimativas).
      const esp = isDemo ? null : espelhoTempoTotal(escala, vivo, hhmm, { hospitalLabels: HOSPITAL_LABEL })
      if (esp) {
        await setLinhaOverride(escala, { chave: esp.chave, anestesista: esp.nome }, esp.override,
          { userId: user?.uid || user?.id, userName: user?.displayName }, turno)
      }
    } catch { /* toast de erro já vem do context */ }
  }

  // CONFIRMAR O HORÁRIO (dono 02/10, tarde): o card abre pelo BLOCO (início/término)
  // e pelo BOTÃO de status (Iniciada/Terminada). A diferença é o que o "Confirmar" faz:
  //  · pelo bloco — a regra de `gravarInicioReal`/`gravarTerminoReal` (mesma das
  //    Liberações): numa cirurgia que ainda não chegou lá, informar o horário a leva
  //    ao status (início → Iniciada; término → Terminada); já lá, só corrige;
  //  · pelo botão — o status do botão SEMPRE (reabrir uma terminada pelo "Iniciada" é
  //    um caso real), com o horário junto; tocar o botão do status em que ela já está
  //    só corrige o horário (a RPC recarimbaria o "Iniciada às…").
  const userId = user?.uid || user?.id
  const confirmarHorario = (hhmm) => {
    const alvo = confirmar
    setConfirmar(null)
    if (!alvo) return
    const status = alvo.campo === 'inicio' ? 'iniciada' : 'terminada'
    const campoCaso = alvo.campo === 'inicio' ? 'inicioReal' : 'terminoReal'
    const p = alvo.viaStatus && (vivo.statusCirurgia || 'agendada') !== status
      ? setStatusCirurgia(escala, vivo, status, { userId, [campoCaso]: hhmm })
      : (alvo.campo === 'inicio' ? gravarInicioReal : gravarTerminoReal)({ escala, caso: vivo, hhmm, userId, setStatusCirurgia, atualizarCaso })
    p.catch(() => {})
  }
  const limparHorario = () => {
    const alvo = confirmar
    setConfirmar(null)
    if (!alvo) return
    atualizarCaso(escala, vivo.id, { [alvo.campo === 'inicio' ? 'inicioReal' : 'terminoReal']: null }, { silencioso: true }).catch(() => {})
  }

  // AJUDA à mão pela aba Completa (dono 29/07). A ajuda é do ANESTESISTA, não do
  // caso — mas o detalhe do caso é o lugar menos intrusivo para marcá-la: o
  // cabeçalho da sala já carrega sala + nome + ⚙ + chevron numa linha de 44px a
  // 375px, e um quarto controle ali trunca o nome. Fonte única com as Liberações:
  // as duas escrevem em `ajudaExterna[turno]`, então uma reflete na outra na hora.
  // RÓTULO ÚNICO com o painel da linha (auditoria 17/08): eram dois textos
  // diferentes para a mesma marca, e só um explicava o efeito na fila.
  const turnoCaso = turnoDoCaso(vivo)
  const nomeAnest = String(vivo.anestesista || '').trim()
  const entradaAjuda = rodapeDoTurno(escala?.ajudaExterna, turnoCaso)
    .find((n) => normNome(n) === normNome(nomeAnest)) || null
  // sala compartilhada ("A + B") e caso sem dono ("?") não têm um nome só p/ marcar
  const podeMarcarAjuda = podeEditarCaso && !!nomeAnest && !nomeAnest.includes('+') && !/^\?+$/.test(nomeAnest)
  const alternarAjuda = () => {
    // sem await: o toggle vira no toque (context otimista); erro reverte + toast
    const p = entradaAjuda
      ? removerAjuda(escala, turnoCaso, entradaAjuda)
      : adicionarAjuda(escala, turnoCaso, nomeAnest)
    p.catch(() => {})
  }

  // Anestesista DESTE caso, não "o primeiro da sala": `anestesistaDaSala` procura
  // pela SALA e ignora o split por anestesista, então em bloco multi (IOSC/Exames/
  // Umanitá) devolvia o colega. Hoje nenhum chamador de podeDefinirAnestesista lê
  // este argumento, mas deixar a busca errada aqui é armadilha para o próximo.
  const aliasDet = vivo.anestesista || ''
  // Quem pode definir vem de quem renderiza (Completa = toda a equipe que edita;
  // Minhas = os casos já são meus). O caso EM ABERTO deixou de ser exceção em
  // 27/07 — ninguém mais precisa ser dono da sala para assumir.
  const definivel = !!(onDefinirAnestesista && podeDefinirAnestesista?.(vivo.sala, aliasDet))
  // otimista no context (erro reverte + toast lá) — o sheet só dispara
  // `userId` vai junto: o carimbo otimista precisa saber QUEM tocou, para o
  // detalhe poder dizer "Iniciada às 14:33 por Fulano" já no ato (dono 21/08).
  // Iniciada/Terminada passam pela CONFIRMAÇÃO do horário (dono 02/10, tarde); o
  // resto (Agendada e os avisos) grava no toque, como sempre.
  const mudarStatus = (status) => {
    if (status === 'iniciada') return setConfirmar({ campo: 'inicio', viaStatus: true })
    if (status === 'terminada') return setConfirmar({ campo: 'termino', viaStatus: true })
    setStatusCirurgia(escala, vivo, status, { userId }).catch(() => {})
  }

  const principal = vivo.statusCirurgia || 'agendada'
  const terminada = principal === 'terminada'
  const tb = tipoBadge(vivo.tipo)
  const alvoTermino = parseHoraMinutos(vivo.terminoPrevisto)
  const faltaTermino = alvoTermino != null && !terminada ? formatFaltante(alvoTermino, agoraMin) : null
  // O que dá sentido a cada número, embaixo do rótulo do bloco (dono 02/10, tarde — a
  // hora agendada ficou no cabeçalho da folha): há quanto tempo começou (só no dia
  // operacional da escala — "agora" de outro dia não diz nada), quanto falta pelo tempo
  // estimado e, terminada, quanto durou.
  const agoraHHMM = `${String(Math.floor((agoraMin % 1440) / 60)).padStart(2, '0')}:${String(agoraMin % 60).padStart(2, '0')}`
  const emSalaMin = principal === 'iniciada' && vivo.inicioReal && ehDiaOperacionalAtual(escala?.data)
    ? duracaoMin(vivo.inicioReal, agoraHHMM) : null
  const durouMin = terminada ? duracaoMin(vivo.inicioReal, vivo.terminoReal) : null
  const subTermino = durouMin != null ? `durou ${rotuloMinutos(durouMin)}`
    : faltaTermino
      ? (faltaTermino.atrasada ? `${faltaTermino.texto.replace('+', '')} além` : `faltam ${faltaTermino.texto.replace('~', '')}`)
      : ''
  // validação do card de confirmação: reabrir pelo "Iniciada" apaga o término, então
  // só o bloco (que corrige sem reabrir) compara o início com ele
  const validarConfirmacao = (hhmm) => (confirmar?.campo === 'inicio'
    ? erroHorarioReal({ campo: 'inicio', hhmm, terminoReal: terminada && !confirmar.viaStatus ? vivo.terminoReal : null, dataEscala: escala?.data })
    : erroHorarioReal({ campo: 'termino', hhmm, inicioReal: vivo.inicioReal, dataEscala: escala?.data }))

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      {/* O PAINEL ACOMPANHA O CONTEÚDO (dono 17/08): `POSITION_CLASSES.bottom` do
          DS fixa `h-[85vh]`, então todo bottom-sheet nasce com 85% da tela mesmo
          quase vazio — foi o que o dono viu como "a tela fica quase vazia". O
          `!h-auto` solta a altura AQUI (o default do DS fica como está, para não
          mexer nos outros cinco sheets do app) e o `max-h` mantém o teto; passando
          dele, o corpo do sheet volta a rolar como hoje. */}
      <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
        {/* Cabeçalho enxuto: onde e quando, mais os dois selos que classificam o
            caso. O QUE é a cirurgia mora no primeiro cartão. */}
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-primary-foreground">
              {salaExibicao(vivo.sala)}
            </span>
            {vivo.hora && <span className="text-[15px] font-bold tabular-nums">{vivo.hora}</span>}
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* o tipo é badge VERMELHO aqui também (auditoria 17/08): virava
                  linha de texto sem cor justamente no painel onde se age */}
              {tb && <Badge variant={tb.variant} badgeStyle={tb.style}>{tb.label}</Badge>}
              {vivo.convenio && (
                <span className="max-w-[140px] truncate rounded-md bg-black/10 px-1.5 py-0.5 text-xs font-medium text-foreground/80 dark:bg-white/15 dark:text-foreground/90">
                  {vivo.convenio}
                </span>
              )}
            </span>
          </div>
        </SheetHeader>

        {/* TRÊS CARTÕES POR ASSUNTO (dono 17/08, escolhido em protótipo): uma
            pergunta por cartão — que cirurgia é · como ela vai · quem está e onde.
            "Decisão ganha cartão" é a mesma regra das telas grandes; antes tudo
            vinha em uma coluna só, no mesmo peso. */}
        <div className="space-y-2.5 px-4 pb-4">
          <article className="relative rounded-2xl border border-border-strong bg-card-elevated p-3">
            {/* EDITAR OS DADOS DA CIRURGIA (dono 01/09, modelo A): procedimento,
                paciente, idade, convênio, hora, sala, cirurgião e residente se
                corrigem numa folha só, a MESMA do "Adicionar caso", preenchida.
                PÍLULA NO CANTO (dono 02/10, tarde: "deixe apenas uma pílula no canto
                superior direito com a palavra editar, mesmo modelo dos cards na
                página home") — o `ActionPill` do DS, o "Editar" do Estágios e do
                Plantão da Home. O botão de largura inteira comia uma linha do cartão.
                O alvo de toque cresce por `after:` sem mudar o desenho da pílula. */}
            {podeEditarCaso && onEditarCaso && (
              <ActionPill
                aria-label="Editar dados da cirurgia"
                className="absolute right-3 top-3 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
                onClick={() => onEditarCaso(vivo)}
              >
                Editar
              </ActionPill>
            )}
            {/* MESMA grafia do card no quadro (`fraseClinica`): o texto importado
                vem em CAIXA ALTA e o painel repetia assim — o mesmo procedimento
                aparecia de dois jeitos em duas telas do mesmo caso. */}
            <SheetTitle className={['text-[15px] font-extrabold leading-tight [overflow-wrap:anywhere]', podeEditarCaso && onEditarCaso ? 'pr-16' : ''].join(' ')}>
              {fraseClinica(vivo.procedimento) || salaExibicao(vivo.sala)}
            </SheetTitle>
            {(vivo.pacienteIniciais || vivo.idade || vivo.tempoEstimado) && (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {[vivo.pacienteIniciais, idadeCurta(vivo.idade), vivo.tempoEstimado && `previsto ${vivo.tempoEstimado}`]
                  .filter(Boolean).join(' · ')}
              </p>
            )}

          </article>

          {/* ── HORÁRIO DA CIRURGIA (dono 02/10): ACIMA do Andamento, com borda verde.
              Revisão da tarde (protótipo `.tmp/horario-compacto.html`): 35% mais baixo
              (94px contra 145px) — blocos de uma linha —, INÍCIO e TÉRMINO só com o
              horário EXATO (confirmado no card), e o TEMPO ESTIMADO (a previsão de
              término que a fila usa) como botão próprio no topo, ao lado do título. ── */}
          {!isDemo && vivo.id && (
            <article
              aria-label="Horário da cirurgia"
              className="rounded-2xl border-[1.5px] border-primary/55 bg-primary/[0.045] px-2.5 py-2 dark:bg-primary/[0.08]"
            >
              <div className="mb-[5px] flex min-h-[26px] items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="text-[15px] font-extrabold">Horário da cirurgia</h3>
                {!terminada && (
                  <span className="ml-auto">
                    <BotaoEstimado
                      valor={vivo.terminoPrevisto || ''}
                      prefixo="Estimado"
                      aviso={!!faltaTermino?.atrasada}
                      nomeAcessivel="Tempo estimado desta cirurgia"
                      onClick={podeEditarCaso ? () => setEditor('tempo') : null}
                    />
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <BlocoHorario
                  rotulo="Início"
                  nomeAcessivel="Início desta cirurgia"
                  valor={vivo.inicioReal}
                  sub={emSalaMin != null ? `há ${rotuloMinutos(emSalaMin)}` : ''}
                  faixa={principal === 'iniciada' ? 'border-l-4 border-l-success' : ''}
                  onClick={podeEditarCaso ? () => setConfirmar({ campo: 'inicio', viaStatus: false }) : null}
                />
                <BlocoHorario
                  rotulo="Término"
                  nomeAcessivel="Término desta cirurgia"
                  valor={vivo.terminoReal}
                  sub={subTermino}
                  subAviso={!terminada && !!faltaTermino?.atrasada}
                  faixa={terminada ? 'border-l-4 border-l-info' : ''}
                  onClick={podeEditarCaso ? () => setConfirmar({ campo: 'termino', viaStatus: false }) : null}
                />
              </div>
              {/* As folhas abrem de baixo para cima (dono 17/08): expandindo aqui
                  dentro, o cartão mudava de tamanho no meio da leitura. */}
              {editor === 'tempo' && (
                <EditorSheet
                  titulo="Tempo estimado desta cirurgia"
                  nota="Quando esta cirurgia deve terminar. Na fila conta enquanto está Iniciada."
                  onClose={() => setEditor(null)}
                >
                  <PainelTempo
                    atual={vivo.terminoPrevisto || ''}
                    horaExata={horaExata}
                    onHoraExata={setHoraExata}
                    onDefinir={(v, meta) => { definirTerminoCaso(v, meta); setEditor(null) }}
                  />
                </EditorSheet>
              )}
            </article>
          )}
          {confirmar && (
            <EditorSheet
              titulo={confirmar.campo === 'inicio' ? 'Início da cirurgia' : 'Término da cirurgia'}
              nota={confirmar.campo === 'inicio'
                ? 'Confirme o horário em que a cirurgia começou.'
                : 'Confirme o horário em que a cirurgia terminou.'}
              onClose={() => setConfirmar(null)}
            >
              <ConfirmarHorario
                campo={confirmar.campo}
                valor={(confirmar.campo === 'inicio' ? vivo.inicioReal : vivo.terminoReal) || ''}
                // iniciada ANTES de 02/10 (sem início gravado): propõe a hora em que
                // foi marcada iniciada — é a que o trigger gravaria se já existisse
                sugestao={confirmar.campo === 'inicio' && carimbo?.status === 'iniciada' ? { hhmm: carimbo.hora, rotulo: 'marcado' } : null}
                validar={validarConfirmacao}
                onConfirmar={confirmarHorario}
                onLimpar={confirmar.viaStatus ? null : limparHorario}
              />
            </EditorSheet>
          )}

          {/* ── ANDAMENTO: os dois eixos ─────────────────────────────────── */}
          {!isDemo && vivo.id && (
            <article className="rounded-2xl border border-border-strong p-3">
              <h3 className="mb-2 text-[15px] font-extrabold">Andamento</h3>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {ANDAMENTO.map((s) => (
                  <button
                    key={s.valor}
                    type="button"
                    aria-pressed={principal === s.valor}
                    onClick={() => mudarStatus(s.valor)}
                    className={[
                      'min-h-[44px] rounded-[10px] px-1 text-sm font-semibold leading-tight transition-colors',
                      principal === s.valor
                        ? (s.cls || 'bg-primary text-primary-foreground')
                        : 'text-muted-foreground active:bg-card/70',
                    ].join(' ')}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                {AVISO.map((s) => {
                  const ativo = vivo.statusExtra === s.valor
                  const rotulo = s.label || passaTurnoLabel(turnoCaso)
                  return (
                    <button
                      key={s.valor}
                      type="button"
                      disabled={terminada}
                      aria-pressed={ativo}
                      onClick={() => mudarStatus(s.valor)}
                      className={[
                        'min-h-[44px] flex-1 rounded-[10px] border px-1.5 text-[12.5px] font-semibold leading-tight transition-colors',
                        ativo ? s.cls : 'border-border-strong bg-card text-foreground',
                        terminada && 'opacity-40',
                      ].filter(Boolean).join(' ')}
                    >
                      {rotulo}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Marcar <b className="font-semibold text-foreground">Terminada</b> desliga os avisos.
              </p>
              {/* PROCEDÊNCIA DO ESTADO (dono 21/08). A pesquisa sobre quadros
                  cirúrgicos eletrônicos converge num ponto: o quadro em que a
                  equipe não confia AUMENTA a carga de comunicação, porque as
                  pessoas ligam para confirmar. Dizer quando e por quem custa uma
                  linha e é o que separa "o app afirma" de "alguém marcou".
                  Sem autor reconhecido, mostra só o horário — nunca "por —". */}
              {carimbo && (
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {STATUS_VERBO[carimbo.status] || carimbo.status} às{' '}
                  <b className="font-semibold text-foreground">{carimbo.hora}</b>
                  {autorCarimbo ? ` por ${autorCarimbo}` : ''}
                </p>
              )}

              {/* TIPO: fica no Andamento porque reclassificar é AÇÃO no meio do
                  turno (a urgência que entrou como eletiva no mapa), e porque é
                  daqui que sai a gravidade logo abaixo. */}
              {podeEditarCaso && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <ChipsEscolha
                    opcoes={TIPOS_CIRURGIA}
                    valor={vivo.tipo || 'eletiva'}
                    onChange={mudarTipo}
                    rotulo="Tipo"
                    nota="urgência entra na conta do contrato"
                  />
                </div>
              )}

              {/* Gravidade: só faz sentido em urgência/emergência, e é o que
                  decide quem entra primeiro quando as 2 salas do contrato do HRO
                  estão ocupadas. Sem classificação a urgência vai para o fim da
                  fila com chamada de ação — o app não chuta prioridade clínica. */}
              {tb && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <ChipsEscolha
                    opcoes={GRAVIDADE_CHIPS}
                    valor={vivo.gravidade || ''}
                    onChange={mudarGravidade}
                    rotulo="Gravidade"
                    nota="ordena a fila de urgências"
                    aviso={!vivo.gravidade ? 'Sem classificação — entra no fim da fila.' : null}
                  />
                </div>
              )}
            </article>
          )}

          {/* ── QUEM ESTÁ E ONDE ─────────────────────────────────────────── */}
          <article className="rounded-2xl border border-border-strong p-3">
            <h3 className="mb-1 text-[15px] font-extrabold">Quem está e onde</h3>

            {/* MESMA função do cabeçalho da sala e do sheet de definir (bug 29/07:
                o cabeçalho vinha do cadastro e este texto vinha do alias importado,
                então "Guilherme Staub" lá e "STAUB" aqui — o dono leu como duas
                pessoas). Também tira a CAIXA ALTA do alias. */}
            <LinhaDado
              icone={<UserCog className="h-3.5 w-3.5" />}
              rotulo="Anestesista"
              valor={nomeAnestesistaExibicao({ uid: vivo.anestesistaUserId, alias: vivo.anestesista, rosterByUid })}
              destaque
              acao={definivel && {
                label: 'Trocar',
                onClick: () => { onClose?.(); onDefinirAnestesista(vivo.sala, vivo) },
              }}
            />

            {/* Residente, sala e cirurgião são LEITURA aqui desde 01/09: os
                três se corrigem no "Editar dados da cirurgia", junto do resto do
                caso. Manter um segundo caminho para os mesmos campos deixaria
                duas telas gravando a mesma coisa com validações diferentes. O
                ANESTESISTA é a exceção e continua com botão: ele não é um campo
                de texto — o sheet próprio mostra onde cada colega está, marca
                dupla e assume posição na fila. */}
            <LinhaDado
              icone={<GraduationCap className="h-3.5 w-3.5" />}
              rotulo="Residente"
              valor={titleCaseNome(residenteNome)}
            />

            <LinhaDado
              icone={<MapPin className="h-3.5 w-3.5" />}
              rotulo="Sala/local"
              valor={salaExibicao(vivo.sala)}
            />

            <LinhaDado
              icone={<Stethoscope className="h-3.5 w-3.5" />}
              rotulo="Cirurgião"
              valor={titleCaseNome(vivo.cirurgiao)}
            />

            {/* AJUDA de outro hospital (dono 29/07). RÓTULO ÚNICO com o painel da
                linha (auditoria 17/08): eram dois textos para a mesma marca. */}
            {podeMarcarAjuda && (
              <>
                <button
                  type="button"
                  onClick={alternarAjuda}
                  aria-pressed={!!entradaAjuda}
                  aria-label={entradaAjuda
                    ? `${titleCaseNome(nomeAnest)} não é ajuda de outro hospital`
                    : `Marcar ${titleCaseNome(nomeAnest)} como ajuda de outro hospital`}
                  className="flex min-h-[48px] w-full items-center gap-2 py-2 text-left"
                >
                  <span className="text-[14.5px] font-semibold">Ajuda de outro hospital</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className={[
                      'relative h-[26px] w-11 shrink-0 rounded-full border transition-colors',
                      entradaAjuda ? 'border-primary bg-primary' : 'border-muted-foreground/25 bg-muted-foreground/30',
                    ].join(' ')}>
                      <span className={[
                        'absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-all',
                        entradaAjuda ? 'left-[22px]' : 'left-[2px]',
                      ].join(' ')} />
                    </span>
                  </span>
                </button>
                <p className="text-[11.5px] text-muted-foreground">
                  Entra ao fim da fila de liberação — primeiro a ser liberado.
                </p>
              </>
            )}
          </article>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Idade só o número + "a" ("23" e "23 anos" → "23a"). Vazio se não houver número. */
export function idadeCurta(bruta) {
  const n = String(bruta || '').match(/\d+/)
  return n ? `${n[0]}a` : ''
}

function Rotulo({ children, className = '' }) {
  return (
    <p className={`mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>
      {children}
    </p>
  )
}

/** Linha full-bleed da lista: rótulo à esquerda, valor, ação à direita. */
function LinhaDado({ icone, rotulo, valor, destaque, acao }) {
  if (!valor && !acao) return null
  return (
    <div className="flex min-h-[48px] items-center gap-2.5 border-b border-border py-2 last-of-type:border-b-0">
      <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
        {icone}{rotulo}
      </span>
      {/* nome de pessoa não abrevia: a linha quebra */}
      <span className={['min-w-0 text-[15px] [overflow-wrap:anywhere]', destaque ? 'font-bold' : 'font-semibold'].join(' ')}>
        {valor || '—'}
      </span>
      {acao && (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          /* três botões "Trocar" na mesma tela: o nome acessível diz qual */
          aria-label={`${acao.label} ${String(rotulo).toLowerCase()}`}
          onClick={acao.onClick}
        >
          {acao.label}
        </Button>
      )}
    </div>
  )
}

/**
 * Editor de UM campo, num sheet próprio de baixo para cima (dono 17/08).
 * Expandir dentro do cartão mudava a altura do painel no meio da leitura e a
 * pessoa perdia o lugar; aqui o conteúdo do caso fica parado atrás e o editor
 * chega por cima, já com a lista aberta ou o campo em foco.
 */
function EditorSheet({ titulo, nota, onClose, children }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      {/* z acima do sheet do caso (z-submodal do DS = 1200): os dois são bottom
          sheets e o de dentro precisa vencer o de fora */}
      <SheetContent side="bottom" className="!h-auto max-h-[85vh] z-[1200]">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-[17px] leading-tight">{titulo}</SheetTitle>
          {nota && <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{nota}</p>}
        </SheetHeader>
        {/* px-4 (02/10): o corpo encostava na borda — atalhos, alternador e "Limpar"
            iam de ponta a ponta, sem a margem do cabeçalho. O protótipo aprovado do
            horário (`.tmp/inicio-termino-cirurgia.html`) tem 16px, como a folha do
            tempo total nas Liberações. */}
        <div className="space-y-2 overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
