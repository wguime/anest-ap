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
 *
 * O que continua visível para os outros: o selo no card da cirurgia (Completa/Minhas) e no
 * card de quem saiu (fila), e o relatório de adesão. Sem push (a escala não notifica, 30/07).
 * Regras em `src/lib/escalaHorarioPendente.js`; hoje vem de `useHorarioPendente`, os dias
 * anteriores de `useMinhasPendenciasAnteriores`. As folhas ficam montadas mesmo sem
 * pendência: preencher a última com o detalhe aberto não pode fechá-lo debaixo do dedo.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, ClockAlert } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/design-system'
import { HOSPITAL_LABEL, useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { casoAberto, rotuloDiaRelatorio } from '@/lib/escalaHorarioPendente'
import { ehDiaOperacionalAtual, erroHorarioReal, gravarInicioReal, gravarTerminoReal, limiteDoTermino } from '@/lib/escalaHorarioReal'
import { ConfirmarHorario, ConfirmarInicioETermino } from './BlocoHorario'
import CasoDetalheSheet from './CasoDetalheSheet'
import SeloHorarioPendente from './SeloHorarioPendente'
import { ID_MINHAS_PENDENCIAS } from './MeuPreenchimento'
import { salaExibicao } from './utils'

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

function LinhaPendente({ item, onAbrir, primeira }) {
  const { caso } = item
  const onde = [ROTULO_TURNO[item.turno], HOSPITAL_LABEL[item.hospital], salaExibicao(caso.sala)].filter(Boolean).join(' · ')
  const procedimento = fraseClinica(caso.procedimento)
  return (
    <button
      type="button"
      onClick={() => onAbrir(item)}
      aria-label={`Informar o horário de ${caso.hora || ''} ${procedimento}, ${onde}`}
      className={['flex min-h-[56px] w-full items-center gap-2 py-1.5 text-left active:bg-muted/60', primeira ? '' : 'border-t border-border/70'].join(' ')}
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

function ListaPorDia({ itens, hoje, onAbrir, max = Infinity }) {
  const total = new Map()
  for (const i of itens) total.set(i.data || hoje, (total.get(i.data || hoje) || 0) + 1)
  return porDia(itens.slice(0, max), hoje).map((g, gi) => (
    <section key={g.dia} aria-label={`${rotuloDia(g.dia, hoje)}: ${plural(total.get(g.dia), 'cirurgia', 'cirurgias')}`}>
      <p className={['flex items-center pb-0.5 pt-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-muted-foreground', gi ? 'border-t border-border/70' : ''].join(' ')}>
        {rotuloDia(g.dia, hoje)}
        <span className="ml-auto font-bold normal-case tracking-normal">{total.get(g.dia)}</span>
      </p>
      {g.itens.map((item, i) => (
        <LinhaPendente key={item.caso.id || `${item.hospital}-${item.caso.sala}-${item.caso.ordem}`} item={item} onAbrir={onAbrir} primeira={i === 0} />
      ))}
    </section>
  ))
}

/**
 * @param {Array}   props.minhas      as pendências de HOJE de quem está logado
 * @param {object}  props.anteriores  `useMinhasPendenciasAnteriores()` — itens, informar, naoAconteceu
 * @param {object?} props.eu          `{ uid, alias, resolverUid }`; nulo = conta de hospital (nada aparece)
 * @param {boolean} props.abaMinhas   na aba Minhas, a caixa; nas outras, a faixa de uma linha
 */
export default function FaixaHorarioPendente({ minhas = null, anteriores = null, eu = null, abaMinhas = false, podeEditar = false }) {
  const { escalas, hoje, setStatusCirurgia, atualizarCaso } = useEscalaCirurgica()
  const { user } = useUser()
  const [lista, setLista] = useState(false)
  const [folha, setFolha] = useState(null) // o item cujo horário se informa
  const [detalhe, setDetalhe] = useState(null) // { hospital, caso, turno } — "Ver a cirurgia"

  const itens = useMemo(
    () => (eu ? [...(minhas || []), ...(anteriores?.itens || [])] : []),
    [eu, minhas, anteriores?.itens],
  )
  const deDiasAnteriores = eu ? anteriores?.itens?.length || 0 : 0
  const userId = user?.uid || user?.id
  const abrir = (item) => { setLista(false); setFolha(item) }

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
    const titulo = [vivo.hora, fraseClinica(vivo.procedimento)].filter(Boolean).join(' ')
    const onde = [
      !deHoje && rotuloDia(folha.data, hoje),
      ROTULO_TURNO[folha.turno], HOSPITAL_LABEL[folha.hospital], salaExibicao(vivo.sala),
    ].filter(Boolean).join(' · ')
    // só o início: "Falta início" de uma cirurgia de hoje ainda aberta (pode estar correndo)
    if (deHoje && escala && aberta && !vivo.inicioReal && folha.falta === 'ini') {
      return {
        titulo: `Início · ${titulo}`,
        nota: <>{onde}. Confirme o horário em que a cirurgia começou.</>,
        corpo: (
          <ConfirmarHorario
            key={`${vivo.id}-inicio`}
            campo="inicio"
            validar={(hhmm) => erroHorarioReal({ campo: 'inicio', hhmm, dataEscala })}
            onConfirmar={(hhmm) => { fechar(); gravarInicioReal({ escala, caso: vivo, hhmm, userId, setStatusCirurgia, atualizarCaso }).catch(() => {}) }}
          />
        ),
      }
    }
    // só o término: hoje, com o início marcado e ainda aberta (o "agora" vale)
    if (deHoje && escala && aberta && vivo.inicioReal) {
      return {
        titulo: `Término · ${titulo}`,
        nota: <>{onde}. Confirme o horário em que a cirurgia terminou.</>,
        corpo: (
          <ConfirmarHorario
            key={`${vivo.id}-termino`}
            campo="termino"
            inicioReal={vivo.inicioReal}
            validar={(hhmm) => erroHorarioReal({ campo: 'termino', hhmm, inicioReal: vivo.inicioReal, dataEscala })}
            onConfirmar={(hhmm) => { fechar(); gravarTerminoReal({ escala, caso: vivo, hhmm, userId, setStatusCirurgia, atualizarCaso }).catch(() => {}) }}
          />
        ),
      }
    }
    // os dois, lado a lado (dono 27/10, 7ª rodada)
    return {
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
    setFolha(null)
    if (!item.data) {
      const escala = escalas?.[item.hospital]
      const vivo = (escala?.casos || []).find((c) => c.id === item.caso.id) || item.caso
      if (escala) setStatusCirurgia(escala, vivo, 'suspensa', { userId }).catch(() => {})
    } else {
      anteriores?.naoAconteceu(item)
    }
  }

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
          <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-[17px] leading-tight">{conteudo.titulo}</SheetTitle>
              <SheetDescription className="mt-1 text-[12.5px] leading-snug">{conteudo.nota}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-5 pt-1">
              {conteudo.corpo}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5">
                {!folha.data && escalas?.[folha.hospital] && (
                  <button
                    type="button"
                    className="flex min-h-[44px] items-center text-[13px] font-semibold text-primary active:opacity-70"
                    onClick={() => { const f = folha; setFolha(null); setDetalhe({ hospital: f.hospital, caso: f.caso, turno: f.turno }) }}
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
        />
      )}
    </>
  )
}
