/**
 * FaixaUrgencias — ocupação das salas de urgência do HRO + fila de entrada,
 * no topo da aba Completa.
 *
 * PORQUÊ (dono 18/08): o contrato com o HRO paga 2 anestesistas para urgência
 * por turno (plantonista + sobreaviso); Ortopedia (sala 4) e CO têm dedicado e
 * ficam fora dessa conta. A terceira urgência simultânea só entra chamando quem
 * o hospital não paga — e essa saturação precisa ser visível ENQUANTO acontece,
 * não no relatório do mês.
 *
 * Desenho escolhido em protótipo (18/08, 3 rodadas de revisão a 430px nos dois
 * temas — .tmp/urgencias-hro-prototype.html):
 * - grade 2×2 com os POSTOS do contrato, um card de UMA linha (36px) cada:
 *   selo da sala + nome + meta à direita; conteúdo SEM negrito (14h15);
 * - sala fora do contrato = card PRÓPRIO de largura inteira com rótulo EXTRA
 *   ("não está claro" foi a crítica da 2ª rodada — o excedente não pode se
 *   confundir com os postos pagos);
 * - fila em uma linha, sem "Sala · convênio" (segue no detalhe, a um toque);
 * - cores: as receitas que a tela já ensina — selo de sala bg-primary/20,
 *   tinta de iniciada bg-success/[0.14] dark:/20, vermelho SÓ no excedente
 *   (verde sobre fundo vermelho foi vetado como "vitral" na 2ª rodada);
 * - toque em card com caso abre o CasoDetalheSheet — a MESMA superfície onde
 *   se marca Iniciada/Terminada: quem precisa do dado facilita produzi-lo.
 *
 * Fica FORA da BoardView de propósito: os EmptyStates dela matariam a faixa
 * justamente no dia sem escala publicada com urgência adicionada à mão (8 de 9
 * urgências de 18/08 nasceram pelo AddCasoSheet). E deriva do DIA inteiro, não
 * do turno exibido — ocupação é do relógio (lib estadoUrgencias).
 *
 * REVISÃO 20/08 (dono): a vaga é da CIRURGIA, mas as cirurgias do MESMO
 * anestesista são um card só, com a contagem à direita ("2 cir.") — o CO com
 * cesáreas o dia todo é uma pessoa ocupada, não duas. A urgência entra na vaga
 * livre antes de começar; sem vaga vai para a fila, e se já começou vira Extra.
 * Os cards dos dedicados vêm prontos da lib (`estado.dedicados`): derivá-los
 * aqui duplicava a regra do contrato e fazia a sala marcada como plantão
 * aparecer DUAS vezes na grade.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, Settings2 } from 'lucide-react'
import { Badge } from '@/design-system'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { GRAVIDADE_LABEL, estadoUrgencias, salasContrato } from '@/lib/escalaCirurgicaUrgencias'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import useAgoraMinuto from './useAgoraMinuto'
import { casosResolvidos, nomeAnestesistaExibicao, salaLiberacao } from './utils'
import { podeEditarEscalaCirurgica } from './gate'
import CasoDetalheSheet from './CasoDetalheSheet'
import SalasUrgenciaSheet from './SalasUrgenciaSheet'
import AddCasoSheet from './AddCasoSheet'

const PAPEL_LABEL = { plantonista: 'Plantão', sobreaviso: 'Sobreaviso' }
const DEDICADO_LABEL = { orto: 'Orto', co: 'CO' }
const DEDICADO_NOME = { orto: 'Ortopedia', co: 'CO' }

/** Espera/decorrido: "48min" · "2h10". */
export const formatEspera = (min) => {
  if (min == null) return ''
  const m = Math.max(0, Math.round(min))
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Caixa comum dos cards da faixa — o arranjo interno é de cada um. */
const CARD_BOX = 'w-full overflow-hidden rounded-[10px] border px-2 py-1 text-left'

/**
 * Card do POSTO em DUAS LINHAS (dono 21/08): sala em cima, anestesista embaixo.
 * Numa linha só, o selo da sala e o nome disputavam ~150px e os dois perdiam —
 * "BLOCO A - SALA 5 - EMERGÊNCIA" empurrou o nome para fora do card e sobrou uma
 * pastilha muda. Empilhado, a sala tem a largura inteira e o nome também.
 */
const CARD_BASE = `flex min-h-[44px] flex-col justify-center gap-0.5 ${CARD_BOX}`

/** Linha da FILA: continua em UMA linha — ali não há sala, e o que se lê de
 *  relance é gravidade → procedimento → espera, nessa ordem, lado a lado. */
const CARD_FILA = `flex min-h-[36px] items-center gap-1.5 ${CARD_BOX}`

/** Selo de sala — MESMA receita do cabeçalho de sala do quadro (primary/20). */
const SeloSala = ({ children, tom = 'primary' }) => (
  <span
    className={[
      'shrink-0 whitespace-nowrap rounded-[5px] px-1 text-[9.5px] font-extrabold uppercase leading-[14px] tracking-wide',
      tom === 'destructive' ? 'bg-destructive/15 text-destructive' : 'bg-primary/20 text-primary',
    ].join(' ')}
  >
    {children}
  </span>
)

export default function FaixaUrgencias({ escala, hospital, turno, hoje }) {
  const agoraMin = useAgoraMinuto()
  const { user } = useUser()
  const { rosterByUid } = useRosterAnestesistas()
  const { setStatusCirurgia } = useEscalaCirurgicaActions()
  const [detalhe, setDetalhe] = useState(null)
  const [todas, setTodas] = useState(false)
  const [configurar, setConfigurar] = useState(false)
  // Toque num posto SEM caso abre o "Adicionar caso" já apontando o posto
  // (dono 19/08) — { posto, sala } pré-preenchidos; ocupado segue abrindo o detalhe.
  const [addCaso, setAddCaso] = useState(null)

  // Ocupação é do relógio → dia INTEIRO; o turno só escolhe a linha do contrato.
  const casos = useMemo(() => casosResolvidos(escala), [escala])
  // Salas dos papéis NO DIA (dono 18/08): urgencias_meta do cabeçalho vence o
  // "normalmente Sala 4/Sala 7" quando marcado; ausente = automático.
  const salas = useMemo(() => salasContrato(escala?.urgenciasMeta, turno), [escala?.urgenciasMeta, turno])
  const estado = useMemo(
    () => estadoUrgencias(casos, {
      hospital, turno, agoraMin, dataEscala: escala?.data || null, hojeIso: hoje, salas,
    }),
    [casos, hospital, turno, agoraMin, escala?.data, hoje, salas],
  )

  if (hospital !== 'hro' || !estado.ativo) return null

  // O nome do card é o de quem responde pela SALA (a lib resolve, preferindo o
  // turno contratual vigente) — não o do caso representativo, que numa sala com
  // várias cirurgias muda conforme qual delas está em andamento.
  const nomeDe = (a) => nomeAnestesistaExibicao({ uid: a?.uid, alias: a?.alias, rosterByUid })
  /** Meta à direita do card: tempo em sala; com mais de uma cirurgia, quantas.
      A contagem é o que o dono pediu ver no CO (uma sala, várias cesáreas), e vai
      abreviada porque divide 196px com o selo da sala e o NOME — "2 cirurgias"
      por extenso comia o nome inteiro ("Gabri…"), que é o que se procura no card.
      O `title` guarda a forma longa. */
  const metaOcupacao = (it) =>
    it.qtd > 1 ? `${it.qtd} cir.` : it.desdeMin != null ? formatEspera(it.desdeMin) : ''
  const tituloOcupacao = (it) =>
    [it.qtd > 1 ? `${it.qtd} cirurgias` : null, it.desdeMin != null ? `em sala há ${formatEspera(it.desdeMin)}` : null]
      .filter(Boolean).join(' · ') || undefined

  // Postos e excedente vêm da LIB (distribuirPostos): sala marcada casa
  // primeiro, o resto por ordem de início — testável fora do React.
  const { postos, extras } = estado

  const filaVisivel = todas ? estado.fila : estado.fila.slice(0, 3)
  const acima = estado.nivel === 'acima'
  // MESMO gate do BoardView: demo não grava, e quem não edita só olha.
  const podeEditar = podeEditarEscalaCirurgica(user) && !String(escala?.id || '').startsWith('demo-')

  return (
    <>
      <section
        aria-label="Urgências do HRO"
        className={[
          '-mx-4 border-y px-4 pb-2 pt-1.5 bg-muted/40',
          acima ? 'border-destructive/40' : 'border-border',
        ].join(' ')}
      >
        {/* cabeçalho: título + situação + contador (a ação vem junto do nível) */}
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-sm font-extrabold">Urgências</span>
          <span className="text-xs text-muted-foreground">
            {acima ? 'acima do contrato' : `${estado.ocupadas} de ${estado.capacidade} salas`}
          </span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
            {estado.nivel === 'cheio' && (
              <Badge variant="destructive" badgeStyle="subtle">{estado.ocupadas} de {estado.capacidade}</Badge>
            )}
            {acima && (
              <Badge variant="destructive" badgeStyle="solid">{estado.ocupadas} de {estado.capacidade}</Badge>
            )}
            {estado.nivel !== 'cheio' && !acima && `${estado.livres} livre${estado.livres === 1 ? '' : 's'}`}
          </span>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setConfigurar(true)}
              aria-label="Configurar salas do contrato"
              className="-my-1 flex min-h-[32px] min-w-[32px] items-center justify-center text-muted-foreground active:opacity-60"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* POSTOS do contrato — grade 2 colunas, um card de UMA linha cada */}
        <div className="grid grid-cols-2 gap-1.5">
          {postos.map(({ papel, item }) => item ? (
            <button
              key={papel}
              type="button"
              onClick={() => setDetalhe(item.caso)}
              title={tituloOcupacao(item)}
              className={[
                CARD_BASE, 'border-border',
                // verde = alguém está OPERANDO ali; sala que ocupa a vaga por ser
                // estação do turno (CO à tarde, sala marcada) sem cirurgia em
                // andamento fica no cinza dos dedicados — a tinta não pode
                // afirmar "iniciada" onde ninguém marcou início.
                item.emAndamento ? 'bg-success/[0.14] dark:bg-success/20' : 'bg-muted/55',
              ].join(' ')}
            >
              <span className="flex"><SeloSala>{salaLiberacao(item.sala)}</SeloSala></span>
              <span className="flex items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {nomeDe(item.anestesista) || PAPEL_LABEL[papel] || papel}
                </span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{metaOcupacao(item)}</span>
              </span>
            </button>
          ) : (
            <button
              key={papel}
              type="button"
              disabled={!podeEditar}
              onClick={() => setAddCaso({ posto: papel === 'plantonista' ? 'plantao' : papel })}
              className={`${CARD_BASE} border-dashed border-border bg-transparent`}
            >
              {/* posto LIVRE não tem sala: uma linha só, centrada na mesma altura */}
              <span className="flex flex-1 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">{PAPEL_LABEL[papel] || papel}</span>
                <span className="shrink-0 text-[10.5px] text-muted-foreground">livre</span>
              </span>
            </button>
          ))}
          {estado.dedicados.map((d) => {
            const Comp = d.item || podeEditar ? 'button' : 'div'
            return (
              <Comp
                key={d.papel}
                {...(d.item
                  ? { type: 'button', onClick: () => setDetalhe(d.item.caso) }
                  : podeEditar
                    ? { type: 'button', onClick: () => setAddCaso({ posto: d.papel, sala: d.sala }) }
                    : {})}
                className={[
                  CARD_BASE,
                  'border-border',
                  // urgência em andamento na sala dedicada pinta como as demais
                  d.item?.emAndamento ? 'bg-success/[0.14] dark:bg-success/20' : 'bg-muted/55',
                ].join(' ')}
              >
                <span className="flex"><SeloSala>{salaLiberacao(d.sala)}</SeloSala></span>
                <span className="flex items-baseline gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {nomeDe(d.anestesista) || DEDICADO_NOME[d.papel]}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-muted-foreground">{DEDICADO_LABEL[d.papel]}</span>
                </span>
              </Comp>
            )
          })}
        </div>

        {/* EXCEDENTE — card próprio, largura inteira: não se confunde com os postos */}
        {extras.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setDetalhe(it.caso)}
            className={`${CARD_BASE} mt-1.5 border-destructive/50 bg-destructive/10 dark:bg-destructive/15`}
          >
            <span className="flex items-center gap-1.5">
              <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-destructive">Extra</span>
              <SeloSala tom="destructive">{salaLiberacao(it.sala)}</SeloSala>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[13px]">{nomeDe(it.anestesista)}</span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-destructive">
                fora do contrato{metaOcupacao(it) ? ` · ${metaOcupacao(it)}` : ''}
              </span>
            </span>
          </button>
        ))}
        {acima && (
          <p className="mt-1.5 text-[11px] text-destructive">
            O contrato cobre {estado.capacidade} salas de urgência: plantonista + sobreaviso.
          </p>
        )}

        {/* FILA — uma linha por urgência; sem sala/convênio (ficam no detalhe) */}
        {estado.fila.length > 0 && (
          <>
            <p className="mb-1 mt-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Fila — {estado.fila.length} aguardando
            </p>
            <div className="flex flex-col gap-1">
              {filaVisivel.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDetalhe(f.caso)}
                  className={`${CARD_FILA} border-border bg-card`}
                >
                  <span className="min-w-[13px] shrink-0 text-[11.5px] font-extrabold tabular-nums text-muted-foreground">
                    {f.posicao}º
                  </span>
                  <span
                    className={[
                      'shrink-0 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-[11px] font-bold',
                      f.gravidade === 'imediata' && 'bg-destructive/15 text-destructive',
                      f.gravidade === 'urgente' && 'bg-warning/[0.18] text-warning',
                      f.gravidade === 'aguarda' && 'bg-muted text-muted-foreground',
                      !f.gravidade && 'border border-dashed border-warning/60 text-warning',
                    ].filter(Boolean).join(' ')}
                  >
                    {f.gravidade ? GRAVIDADE_LABEL[f.gravidade] : 'Classificar'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {fraseClinica(f.caso?.procedimento) || 'Sem procedimento'}
                  </span>
                  {f.esperaMin != null && (
                    <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{formatEspera(f.esperaMin)}</span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            {estado.fila.length > 3 && !todas && (
              <button
                type="button"
                onClick={() => setTodas(true)}
                className="mt-1 py-1 text-[11.5px] font-semibold text-primary"
              >
                ver todas ({estado.fila.length})
              </button>
            )}
          </>
        )}

        {/* qualidade do dado: iniciada há >4h sai da conta e vira PERGUNTA */}
        {estado.aConfirmar.map((it) => (
          <div key={it.id} className="mt-1.5 flex min-h-[30px] items-center gap-2 text-[11px] text-warning">
            <span className="min-w-0 flex-1">
              {salaLiberacao(it.sala)} iniciada há {formatEspera(it.desdeMin)} — ainda em andamento?
            </span>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setStatusCirurgia(escala, it.caso, 'terminada')}
                className="shrink-0 rounded-[9px] border border-warning/50 px-2 py-1 font-bold text-warning"
              >
                Terminada
              </button>
            )}
          </div>
        ))}
        {estado.suspeitas.length > 0 && (
          <button
            type="button"
            onClick={() => setDetalhe(estado.suspeitas[0].caso)}
            className="mt-1 py-0.5 text-left text-[11px] text-warning"
          >
            {estado.suspeitas.length === 1
              ? `${salaLiberacao(estado.suspeitas[0].sala)} marcada ${estado.suspeitas[0].caso?.hora || ''} pode já ter começado`
              : `${estado.suspeitas.length} marcadas podem já ter começado`}
          </button>
        )}
      </section>

      {addCaso && (
        <AddCasoSheet
          escala={escala}
          turno={turno}
          postoInicial={addCaso.posto}
          salaInicial={addCaso.sala || ''}
          onClose={() => setAddCaso(null)}
        />
      )}

      {configurar && (
        <SalasUrgenciaSheet escala={escala} turno={turno} onClose={() => setConfigurar(false)} />
      )}

      {detalhe && (
        <CasoDetalheSheet
          escala={escala}
          caso={detalhe}
          turno={turno}
          onClose={() => setDetalhe(null)}
          podeEditar={podeEditar}
        />
      )}
    </>
  )
}
