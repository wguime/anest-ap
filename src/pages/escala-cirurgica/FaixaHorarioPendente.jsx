/**
 * HORÁRIO PENDENTE — INDIVIDUAL (dono 27/10, 3ª e 4ª rodadas de `.tmp/horarios-auditoria/`).
 *
 * Até 27/10 era o alerta PÚBLICO de 05/10 (a faixa com o nome de todos os que deviam) e, na
 * Minhas, a caixa pessoal com a equipe embaixo. O dono pediu: "mantenha uma faixa desse
 * vermelho cheio em todas as abas apenas dos usuários que têm horários a preencher, retire a
 * visualização de toda a equipe (deixe apenas individual até o usuário resolver todos os
 * horários, inclusive de dias anteriores)". Reabre 05/10 e 15/10.
 *
 *  - Na aba MINHAS: a caixa com cabeçalho vermelho cheio (a tinta da antiga pílula "Você N"),
 *    o número em destaque, os DIAS como cabeçalho e até 5 linhas; "Ver todas as N" abre a
 *    lista inteira numa folha.
 *  - Na Completa e nas Liberações: uma faixa de uma linha, a mesma tinta, que abre a lista.
 *  - Quem não deve nada — e a conta de hospital, que não opera — não vê nada.
 *  - O toque numa cirurgia abre DIRETO a folha do horário (não o detalhe): "Falta início" de
 *    uma que está aberta pede só o início; com o início marcado e ainda aberta, só o término;
 *    o resto, os dois lado a lado. Em dia passado os dois nascem vazios e o término não passa
 *    da hora em que a cirurgia foi marcada Terminada.
 *  - Na folha, a linha do anestesista com "Trocar" (dono 29/10): quem recebeu uma cirurgia que
 *    não fez a passa a quem fez (a folha "Quem responde por esta cirurgia?", modo correção).
 *
 * POP-UP NA ENTRADA (dono 28/10/2026, `.tmp/popup-horarios/`): "sempre que o usuário tiver
 * débitos, não importa a data [...] o pop-up deve aparecer todas as vezes enquanto o usuário
 * tiver débitos de horários em aberto", ao entrar na escala. É a MESMA lista desta caixa — por
 * isso mora aqui —, numa folha de baixo com o cabeçalho vermelho da caixa, o título "Você tem
 * X cirurgias sem horário" e o rodapé "Informar horários · Pular · Ver a escala" (o modelo A
 * com as mudanças do dono). Uma cirurgia fica marcada como "a da vez": "Informar horários"
 * abre a folha dela, "Pular" passa a marca para a próxima, "Ver a escala" fecha. A folha do
 * horário abre POR CIMA do pop-up e, confirmada, a cirurgia sai da lista; a última fecha o
 * pop-up ("Horários em dia"). QUANDO abre é decisão da página (a cada entrada, com as listas
 * prontas); aqui ele só se mostra e avisa que fechou.
 *
 * O que continua visível para os outros: o selo no card da cirurgia (Completa/Minhas) e no
 * card de quem saiu (fila), e o relatório de adesão. Sem push (a escala não notifica, 30/07).
 * Regras em `src/lib/escalaHorarioPendente.js`; hoje vem de `useHorarioPendente`, os dias
 * anteriores de `useMinhasPendenciasAnteriores`. As folhas ficam montadas mesmo sem
 * pendência: preencher a última com o detalhe aberto não pode fechá-lo debaixo do dedo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ChevronsRight, ClockAlert, UserCog, X } from 'lucide-react'
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, useToast } from '@/design-system'
import { HOSPITAL_LABEL, useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { casoAberto, rotuloDiaRelatorio } from '@/lib/escalaHorarioPendente'
import { nomeCurtoProcedimento } from '@/lib/escalaProcedimentoCurto'
import { ehDiaOperacionalAtual, erroHorarioReal, gravarInicioReal, gravarTerminoReal, limiteDoTermino } from '@/lib/escalaHorarioReal'
import { ConfirmarHorario, ConfirmarInicioETermino } from './BlocoHorario'
import CasoDetalheSheet from './CasoDetalheSheet'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import SeloHorarioPendente from './SeloHorarioPendente'
import { ID_MINHAS_PENDENCIAS } from './MeuPreenchimento'
import { fraseTurnoEncerrado, nomeAnestesistaExibicao, salaExibicao, turnoJaEncerrou } from './utils'

const ROTULO_TURNO = { matutino: 'Manhã', vespertino: 'Tarde' }
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
/** Até quantas linhas a caixa da Minhas mostra (com 1 ou com 15, a cirurgia de hoje fica no mesmo lugar). */
export const MAX_LINHAS_CAIXA = 5

/** Os itens por dia, na ordem em que chegam (hoje primeiro, depois do mais recente ao mais antigo). */
function porDia(itens, hoje) {
  const grupos = []
  for (const item of itens) {
    const dia = item.data || hoje
    let g = grupos.find((x) => x.dia === dia)
    if (!g) { g = { dia, itens: [] }; grupos.push(g) }
    g.itens.push(item)
  }
  return grupos
}
const rotuloDia = (dia, hoje) => {
  if (dia === hoje) return 'Hoje'
  const r = rotuloDiaRelatorio(dia, hoje)
  return r === 'ontem' ? `Ontem · ${rotuloDiaRelatorio(dia, null)}` : r
}

function LinhaPendente({ item, onAbrir, primeira, atual = false, refAtual = null }) {
  const { caso } = item
  const onde = [ROTULO_TURNO[item.turno], HOSPITAL_LABEL[item.hospital], salaExibicao(caso.sala)].filter(Boolean).join(' · ')
  const procedimento = fraseClinica(caso.procedimento)
  return (
    <button
      type="button"
      ref={atual ? refAtual : undefined}
      onClick={() => onAbrir(item)}
      aria-current={atual ? 'true' : undefined}
      aria-label={`Informar o horário de ${caso.hora || ''} ${procedimento}, ${onde}`}
      className={[
        'flex min-h-[56px] items-center gap-2 py-1.5 text-left active:bg-muted/60',
        primeira ? '' : 'border-t border-border/70',
        // "a da vez" do pop-up (dono 28/10): a faixa verde à esquerda, de borda a borda
        atual
          ? '-mx-4 w-[calc(100%+2rem)] border-l-[3px] border-l-primary bg-primary/[0.07] pl-[13px] pr-4 dark:bg-primary/[0.12]'
          : 'w-full',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] text-muted-foreground">{onde}</span>
        <span className="mt-0.5 flex gap-1.5 text-sm">
          {caso.hora && <b className="shrink-0 font-bold tabular-nums">{caso.hora}</b>}
          <span className="truncate">{procedimento}</span>
        </span>
      </span>
      <SeloHorarioPendente falta={item.falta} />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

function ListaPorDia({ itens, hoje, onAbrir, max = Infinity, atual = null, refAtual = null }) {
  const total = new Map()
  for (const i of itens) total.set(i.data || hoje, (total.get(i.data || hoje) || 0) + 1)
  return porDia(itens.slice(0, max), hoje).map((g, gi) => (
    <section key={g.dia} aria-label={`${rotuloDia(g.dia, hoje)}: ${plural(total.get(g.dia), 'cirurgia', 'cirurgias')}`}>
      <p className={['flex items-center pb-0.5 pt-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-muted-foreground', gi ? 'border-t border-border/70' : ''].join(' ')}>
        {rotuloDia(g.dia, hoje)}
        <span className="ml-auto font-bold normal-case tracking-normal">{total.get(g.dia)}</span>
      </p>
      {g.itens.map((item, i) => (
        <LinhaPendente
          key={item.caso.id || `${item.hospital}-${item.caso.sala}-${item.caso.ordem}`}
          item={item}
          onAbrir={onAbrir}
          primeira={i === 0}
          atual={item === atual}
          refAtual={refAtual}
        />
      ))}
    </section>
  ))
}

/**
 * QUEM ESTÁ NA CIRURGIA, com "Trocar" (dono 29/10, modelo B de `.tmp/popup-horarios/trocar-responsavel.html`):
 * "adicionar a possibilidade de trocar o responsável pelo procedimento. Ao clicar para adicionar o
 * horário deve conter essa possibilidade." É a linha "Anestesista · Trocar" do detalhe, logo abaixo
 * do subtítulo da folha: quem recebeu uma cirurgia que não fez a passa a quem fez em vez de ser
 * cobrado por ela a cada entrada. O roster vem do cache (`inerte`): abrir a folha não vai ao banco.
 */
function LinhaAnestesista({ caso, podeTrocar, onTrocar }) {
  const { rosterByUid } = useRosterAnestesistas({ inerte: true })
  const nome = nomeAnestesistaExibicao({ uid: caso.anestesistaUserId, alias: caso.anestesista, rosterByUid })
  return (
    <div className="mb-2 flex min-h-[48px] items-center gap-2.5 border-b border-border py-1">
      <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
        Anestesista
      </span>
      {/* nome de pessoa não abrevia: a linha quebra */}
      <span className="min-w-0 text-[15px] font-bold [overflow-wrap:anywhere]">{nome || '—'}</span>
      {podeTrocar && (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-11 min-h-[44px] shrink-0 px-4"
          aria-label="Trocar anestesista"
          onClick={onTrocar}
        >
          Trocar
        </Button>
      )}
    </div>
  )
}

/**
 * O POP-UP (dono 28/10, v2 do modelo A): cabeçalho vermelho da caixa com "Você tem X
 * cirurgias sem horário", a lista por dia com "a da vez" marcada e o rodapé da janela
 * central — "Informar horários" (a folha da marcada), "Pular" (a marca vai para a próxima) e
 * "Ver a escala" (fecha). Cabeçalho e rodapé ficam presos nas bordas: com 22 cirurgias (o pior
 * caso real de outubro) a lista rola por dentro e os botões continuam à mão.
 */
function PopupHorarios({ itens, hoje, onAbrir, onFechar }) {
  const [vez, setVez] = useState(0)
  const refAtual = useRef(null)
  const n = itens.length
  // confirmada, a cirurgia sai da lista e o MESMO índice já aponta a seguinte
  const idx = Math.min(vez, Math.max(0, n - 1))
  const atual = itens[idx] || null
  useEffect(() => { refAtual.current?.scrollIntoView?.({ block: 'nearest' }) }, [idx])
  if (!atual) return null
  const titulo = `Você tem ${plural(n, 'cirurgia', 'cirurgias')} sem horário`
  return (
    <Sheet open onOpenChange={(o) => !o && onFechar()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-labelledby="popup-horarios-titulo"
        className="!h-auto max-h-[88vh]"
        data-popup-horarios
      >
        <div className="sticky top-0 z-10 bg-destructive px-4 pb-2.5 pt-3 text-white">
          <h2 id="popup-horarios-titulo" className="flex items-center gap-2 pr-10 text-[16px] font-extrabold leading-tight">
            <ClockAlert className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
            {titulo}
          </h2>
          <p className="ml-[27px] mt-0.5 text-[12px] leading-snug text-white/90">
            Ficam aqui até você preencher início e término.
          </p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="absolute right-1.5 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-white active:bg-white/15"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-4">
          <ListaPorDia
            itens={itens}
            hoje={hoje}
            atual={atual}
            refAtual={refAtual}
            onAbrir={(item) => { setVez(itens.indexOf(item)); onAbrir(item) }}
          />
        </div>
        <div className="sticky bottom-0 z-10 border-t border-border/70 bg-card px-4 pb-3 pt-2">
          <p className="mb-2 truncate text-[12.5px] text-muted-foreground">
            {idx + 1} de {n} · <b className="font-bold text-foreground">{[atual.caso.hora, fraseClinica(atual.caso.procedimento)].filter(Boolean).join(' ')}</b>
          </p>
          <Button className="min-h-[48px] w-full text-[15px] font-bold" onClick={() => onAbrir(atual)}>
            Informar horários
          </Button>
          <div className="mt-0.5 flex justify-center gap-6">
            {n > 1 && (
              <button
                type="button"
                onClick={() => setVez((i) => (Math.min(i, n - 1) + 1) % n)}
                className="flex min-h-[44px] items-center gap-1 text-[13.5px] font-bold text-primary active:opacity-70"
              >
                Pular
                <ChevronsRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              className="flex min-h-[44px] items-center text-[13.5px] font-semibold text-muted-foreground active:opacity-70"
            >
              Ver a escala
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * @param {Array}   props.minhas        as pendências de HOJE de quem está logado
 * @param {object}  props.anteriores    `useMinhasPendenciasAnteriores()` — itens, informar, naoAconteceu
 * @param {object?} props.eu            `{ uid, alias, resolverUid }`; nulo = conta de hospital (nada aparece)
 * @param {boolean} props.abaMinhas     na aba Minhas, a caixa; nas outras, a faixa de uma linha
 * @param {boolean} props.popupAberto   o pop-up da entrada (a página decide quando)
 * @param {Function} props.onFecharPopup
 * @param {string?} props.turnoEmCurso  o turno do relógio: a cirurgia de hoje de um turno já
 *                                      encerrado abre o detalhe no modo "só horário e quem fez"
 */
export default function FaixaHorarioPendente({ minhas = null, anteriores = null, eu = null, abaMinhas = false, podeEditar = false, popupAberto = false, onFecharPopup = null, turnoEmCurso = null }) {
  const { escalas, hoje, setStatusCirurgia, atualizarCaso } = useEscalaCirurgica()
  const { user } = useUser()
  const { toast } = useToast()
  const [lista, setLista] = useState(false)
  const [folha, setFolha] = useState(null) // o item cujo horário se informa
  const [detalhe, setDetalhe] = useState(null) // { hospital, caso, turno } — "Ver a cirurgia"
  const [definir, setDefinir] = useState(null) // "Trocar" no detalhe de um turno encerrado
  const [trocar, setTrocar] = useState(null) // "Trocar" na folha do horário (29/10): o item da folha
  const trocou = useRef(false) // confirmada a troca, a folha do horário não volta
  // a última do pop-up foi resolvida AQUI: ao esvaziar, ele some com "Horários em dia"
  const resolveuNoPopup = useRef(false)

  const itens = useMemo(
    () => (eu ? [...(minhas || []), ...(anteriores?.itens || [])] : []),
    [eu, minhas, anteriores?.itens],
  )
  const deDiasAnteriores = eu ? anteriores?.itens?.length || 0 : 0
  const userId = user?.uid || user?.id
  const abrir = (item) => { setLista(false); setFolha(item) }
  // do pop-up a folha abre POR CIMA dele: confirmada, a lista volta com a seguinte marcada
  const abrirDoPopup = (item) => { setFolha(item) }
  const marcarResolucao = () => { if (popupAberto) resolveuNoPopup.current = true }

  useEffect(() => {
    if (!popupAberto || itens.length) return
    onFecharPopup?.()
    if (resolveuNoPopup.current) toast({ variant: 'success', title: 'Horários em dia' })
    resolveuNoPopup.current = false
  }, [popupAberto, itens.length]) // eslint-disable-line react-hooks/exhaustive-deps -- fecha ao esvaziar, uma vez

  // ── a folha do horário de UMA cirurgia ──────────────────────────────────────
  const conteudoDaFolha = () => {
    if (!folha) return null
    const deHoje = !folha.data
    const escala = deHoje ? escalas?.[folha.hospital] : null
    const vivo = (escala?.casos || []).find((c) => c.id === folha.caso.id) || folha.caso
    const aberta = casoAberto(vivo)
    const limite = limiteDoTermino(vivo)
    const dataEscala = deHoje ? escala?.data : folha.data
    const fechar = () => setFolha(null)
    // o nome curto, como na folha Antes de liberar: o texto inteiro do mapa quebrava o título
    const titulo = [vivo.hora, nomeCurtoProcedimento(vivo.procedimento)].filter(Boolean).join(' ')
    const onde = [
      !deHoje && rotuloDia(folha.data, hoje),
      ROTULO_TURNO[folha.turno], HOSPITAL_LABEL[folha.hospital], salaExibicao(vivo.sala),
    ].filter(Boolean).join(' · ')
    // só o início: "Falta início" de uma cirurgia de hoje ainda aberta (pode estar correndo)
    if (deHoje && escala && aberta && !vivo.inicioReal && folha.falta === 'ini') {
      return {
        caso: vivo,
        titulo: `Início · ${titulo}`,
        nota: <>{onde}. Confirme o horário em que a cirurgia começou.</>,
        corpo: (
          <ConfirmarHorario
            key={`${vivo.id}-inicio`}
            campo="inicio"
            validar={(hhmm) => erroHorarioReal({ campo: 'inicio', hhmm, dataEscala })}
            onConfirmar={(hhmm) => { marcarResolucao(); fechar(); gravarInicioReal({ escala, caso: vivo, hhmm, userId, setStatusCirurgia, atualizarCaso }).catch(() => {}) }}
          />
        ),
      }
    }
    // só o término: hoje, com o início marcado e ainda aberta (o "agora" vale)
    if (deHoje && escala && aberta && vivo.inicioReal) {
      return {
        caso: vivo,
        titulo: `Término · ${titulo}`,
        nota: <>{onde}. Confirme o horário em que a cirurgia terminou.</>,
        corpo: (
          <ConfirmarHorario
            key={`${vivo.id}-termino`}
            campo="termino"
            inicioReal={vivo.inicioReal}
            validar={(hhmm) => erroHorarioReal({ campo: 'termino', hhmm, inicioReal: vivo.inicioReal, dataEscala })}
            onConfirmar={(hhmm) => { marcarResolucao(); fechar(); gravarTerminoReal({ escala, caso: vivo, hhmm, userId, setStatusCirurgia, atualizarCaso }).catch(() => {}) }}
          />
        ),
      }
    }
    // os dois, lado a lado (dono 27/10, 7ª rodada)
    return {
      caso: vivo,
      titulo: `Início e término · ${titulo}`,
      nota: <>{onde}{limite ? <> · <b className="font-semibold text-foreground">terminou antes de {limite}</b></> : null}</>,
      corpo: (
        <ConfirmarInicioETermino
          key={`${vivo.id}-ambos`}
          inicio={vivo.inicioReal || ''}
          termino={vivo.terminoReal || ''}
          terminoAgora={deHoje && aberta && ehDiaOperacionalAtual(dataEscala)}
          aviso={deHoje && (vivo.statusCirurgia || 'agendada') === 'agendada'}
          validar={({ inicio, termino }) => erroHorarioReal({ campo: 'inicio', hhmm: inicio, dataEscala, limite })
            || erroHorarioReal({ campo: 'termino', hhmm: termino, inicioReal: inicio, dataEscala, limite }) || ''}
          onConfirmar={({ inicio, termino }) => {
            const item = folha
            marcarResolucao()
            fechar()
            if (deHoje && escala) {
              gravarTerminoReal({ escala, caso: vivo, hhmm: termino, inicioReal: inicio, userId, setStatusCirurgia, atualizarCaso }).catch(() => {})
            } else {
              anteriores?.informar(item, { inicio, termino })
            }
          }}
        />
      ),
    }
  }
  const conteudo = conteudoDaFolha()
  const naoAconteceu = () => {
    const item = folha
    marcarResolucao()
    setFolha(null)
    if (!item.data) {
      const escala = escalas?.[item.hospital]
      const vivo = (escala?.casos || []).find((c) => c.id === item.caso.id) || item.caso
      if (escala) setStatusCirurgia(escala, vivo, 'suspensa', { userId }).catch(() => {})
    } else {
      anteriores?.naoAconteceu(item)
    }
  }
  // a cirurgia de HOJE de um turno que já acabou abre no modo "só horário e quem fez" (28/10)
  const encerradoDe = (turno) => (turnoJaEncerrou({ turno, emCurso: turnoEmCurso, ehHoje: true }) ? fraseTurnoEncerrado(turno) : null)

  // "Trocar" na folha do horário (29/10): a folha dá lugar à de troca — empilhar as duas deixaria
  // a do horário clara e tocável por cima do fundo escuro da outra. Cancelada, ela volta.
  const abrirTroca = () => { const f = folha; trocou.current = false; setFolha(null); setTrocar(f) }
  const propsDaTroca = () => {
    if (!trocar) return null
    const deHoje = !trocar.data
    const escalaDeHoje = deHoje ? escalas?.[trocar.hospital] : null
    if (deHoje && !escalaDeHoje) return null
    const vivo = (escalaDeHoje?.casos || []).find((c) => c.id === trocar.caso.id) || trocar.caso
    return {
      // de dia anterior a escala não está carregada: só o que a folha de troca lê, e grava pelo id
      escala: escalaDeHoje || { id: vivo.escalaId || null, data: trocar.data, hospital: trocar.hospital, casos: [vivo] },
      sala: vivo.sala,
      casosAlvo: [vivo],
      turno: trocar.turno,
      // dia anterior e turno encerrado: só o nome; turno em curso: os cuidados de sempre na fila
      encerrado: !deHoje || !!encerradoDe(trocar.turno),
      dia: deHoje ? null : rotuloDia(trocar.data, hoje),
      gravar: deHoje ? null : (_ids, payload, opcoes) => anteriores?.trocarResponsavel(trocar, payload, opcoes),
    }
  }
  const troca = propsDaTroca()

  return (
    <>
      {itens.length > 0 && (abaMinhas ? (
        <section
          id={ID_MINHAS_PENDENCIAS}
          aria-label={`Você tem ${plural(itens.length, 'cirurgia', 'cirurgias')} sem horário`}
          className="scroll-mt-16 overflow-hidden rounded-xl border-[1.5px] border-destructive bg-card"
        >
          {/* VERMELHO CHEIO (dono 27/10, 3ª rodada: "mais vermelho e mais chamativo"), a
              tinta da antiga pílula "Você N"; sem os espaços vazios em cima e embaixo */}
          <div className="bg-destructive px-3 pb-2 pt-[9px] text-white">
            <h3 className="flex items-center gap-2 text-[15.5px] font-extrabold leading-tight">
              <ClockAlert className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
              {itens.length === 1 ? 'Cirurgia sem horário' : 'Cirurgias sem horário'}
              <span className="ml-auto inline-flex h-[22px] min-w-[24px] items-center justify-center rounded-full bg-white px-[7px] text-[12.5px] font-extrabold tabular-nums text-destructive">
                {itens.length}
              </span>
            </h3>
            <p className="ml-[27px] mt-0.5 text-[12px] leading-snug text-white/90">
              {itens.length === 1 ? 'Fica' : 'Ficam'} aqui até você preencher início e término.
            </p>
          </div>
          <div className="px-3">
            <ListaPorDia itens={itens} hoje={hoje} onAbrir={abrir} max={MAX_LINHAS_CAIXA} />
          </div>
          {itens.length > MAX_LINHAS_CAIXA && (
            <button
              type="button"
              onClick={() => setLista(true)}
              className="flex min-h-[44px] w-full items-center justify-center gap-1 border-t border-border/70 text-[13.5px] font-bold text-primary active:bg-muted/60"
            >
              Ver todas as {itens.length}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setLista(true)}
          aria-label={`Você tem ${plural(itens.length, 'cirurgia', 'cirurgias')} sem horário. Ver a lista`}
          className="flex min-h-[48px] w-full items-center gap-2 rounded-xl bg-destructive py-1.5 pl-3 pr-2.5 text-left text-white transition-opacity active:opacity-85"
        >
          <ClockAlert className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[15px] font-extrabold">Você tem {plural(itens.length, 'cirurgia', 'cirurgias')} sem horário</span>
            <span className="block text-[11.5px] font-medium text-white/90">
              {deDiasAnteriores ? `${deDiasAnteriores} de ${deDiasAnteriores === 1 ? 'dia anterior' : 'dias anteriores'} · ` : ''}toque para ver
            </span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        </button>
      ))}

      {popupAberto && itens.length > 0 && (
        <PopupHorarios itens={itens} hoje={hoje} onAbrir={abrirDoPopup} onFechar={() => onFecharPopup?.()} />
      )}

      {lista && (
        <Sheet open onOpenChange={(o) => !o && setLista(false)}>
          <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
            <SheetHeader className="pb-1">
              <SheetTitle className="flex items-center gap-2 text-[17px] font-bold">
                <ClockAlert className="h-[19px] w-[19px] shrink-0 text-category-red-fg" aria-hidden="true" />
                Suas cirurgias sem horário
              </SheetTitle>
              <SheetDescription className="mt-1 text-[12.5px] leading-snug">
                {plural(itens.length, 'cirurgia', 'cirurgias')}. Cada uma sai daqui quando início e término forem preenchidos; o aviso some quando acabar a última.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {itens.length
                ? <ListaPorDia itens={itens} hoje={hoje} onAbrir={abrir} />
                : <p className="py-6 text-center text-[13px] text-muted-foreground">Nenhum horário pendente.</p>}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {folha && conteudo && (
        <Sheet open onOpenChange={(o) => !o && setFolha(null)}>
          {/* z acima do pop-up (z-submodal do DS = 1200): do pop-up, a folha abre por cima
              dele e, ao fechar, a lista está lá com a seguinte marcada */}
          <SheetContent side="bottom" className="!h-auto max-h-[88vh] z-[1200]">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-[17px] leading-tight">{conteudo.titulo}</SheetTitle>
              <SheetDescription className="mt-1 text-[12.5px] leading-snug">{conteudo.nota}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-5 pt-1">
              <LinhaAnestesista caso={conteudo.caso} podeTrocar={podeEditar} onTrocar={abrirTroca} />
              {conteudo.corpo}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5">
                {!folha.data && escalas?.[folha.hospital] && (
                  <button
                    type="button"
                    className="flex min-h-[44px] items-center text-[13px] font-semibold text-primary active:opacity-70"
                    onClick={() => {
                      const f = folha
                      setFolha(null)
                      // o detalhe é outra superfície: o pop-up dá lugar a ele (volta na próxima entrada)
                      if (popupAberto) onFecharPopup?.()
                      setDetalhe({ hospital: f.hospital, caso: f.caso, turno: f.turno })
                    }}
                  >
                    Ver a cirurgia
                  </button>
                )}
                {casoAberto(folha.caso) && (
                  <button
                    type="button"
                    className="flex min-h-[44px] items-center text-[13px] font-semibold text-muted-foreground active:opacity-70"
                    onClick={naoAconteceu}
                  >
                    Não aconteceu (suspensa)
                  </button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {detalhe && escalas?.[detalhe.hospital] && (
        <CasoDetalheSheet
          escala={escalas[detalhe.hospital]}
          caso={detalhe.caso}
          turno={detalhe.turno}
          onClose={() => setDetalhe(null)}
          podeEditar={podeEditar}
          encerrado={encerradoDe(detalhe.turno)}
          // "Trocar" quem fez — só no turno encerrado (dono 28/10, modelo A+): é a saída da
          // cirurgia que ficou no nome errado e que o pop-up cobraria a cada entrada
          podeDefinirAnestesista={() => podeEditar && !!encerradoDe(detalhe.turno)}
          onDefinirAnestesista={(sala, casoAlvo) => setDefinir({ hospital: detalhe.hospital, sala, caso: casoAlvo, turno: detalhe.turno })}
        />
      )}

      {definir && escalas?.[definir.hospital] && (
        <DefinirAnestesistaSheet
          escala={escalas[definir.hospital]}
          sala={definir.sala}
          casosAlvo={definir.caso ? [definir.caso] : null}
          turno={definir.turno}
          encerrado
          onClose={() => setDefinir(null)}
        />
      )}

      {troca && (
        <DefinirAnestesistaSheet
          {...troca}
          corrigirQuemFez
          onConfirmado={() => { trocou.current = true }}
          onClose={() => {
            const item = trocar
            setTrocar(null)
            // "Cancelar" (ou fechar) volta à folha do horário; confirmada, a cirurgia já saiu da lista
            if (!trocou.current) setFolha(item)
          }}
        />
      )}
    </>
  )
}
