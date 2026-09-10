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
 * - grade 2×2 com os POSTOS do contrato, um card por posto;
 * - sala fora do contrato = card PRÓPRIO de largura inteira com rótulo EXTRA
 *   ("não está claro" foi a crítica da 2ª rodada — o excedente não pode se
 *   confundir com os postos pagos);
 * - fila em uma linha, sem "Sala · convênio" (segue no detalhe, a um toque);
 * - cores: as receitas que a tela já ensina — tinta de iniciada
 *   bg-success/[0.14] dark:/20, vermelho SÓ no excedente (verde sobre fundo
 *   vermelho foi vetado como "vitral" na 2ª rodada);
 * - toque em card com caso abre o CasoDetalheSheet — a MESMA superfície onde
 *   se marca Iniciada/Terminada: quem precisa do dado facilita produzi-lo.
 *
 * REVISÃO 09/09 — modelo B, escolhido pelo dono entre três a 430px nos dois
 * temas (.tmp/urgencias-cards-modelos.html) depois de "as informações nesses
 * cards não ficam muito claras". O card passou a ter TRÊS linhas de papel fixo
 * (papel · quem · onde+carga), o dedicado ganhou barra cinza à esquerda para
 * dizer "fora da conta", e o cabeçalho trocou as DUAS contagens que se
 * contradiziam ("0 de 2 salas" ao lado de "2 livres") pelo turno do contrato
 * mais uma pastilha por vaga. Detalhe de cada decisão nos blocos abaixo.
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
import { useState } from 'react'
import { ChevronRight, Settings2 } from 'lucide-react'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { GRAVIDADE_LABEL } from '@/lib/escalaCirurgicaUrgencias'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import useEstadoUrgencias from './useEstadoUrgencias'
import { nomeAnestesistaExibicao, salaLiberacao } from './utils'
import { podeEditarEscalaCirurgica } from './gate'
import CasoDetalheSheet from './CasoDetalheSheet'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import SalasUrgenciaSheet from './SalasUrgenciaSheet'
import AddCasoSheet from './AddCasoSheet'

const PAPEL_LABEL = { plantonista: 'Plantão', sobreaviso: 'Sobreaviso' }
/** Papel do dedicado por EXTENSO — ele virou o TÍTULO do card (dono 09/09), e
 *  "CO" abreviado no canto direito era lido como estado, não como quem cobre. */
const DEDICADO_TITULO = { orto: 'Ortopedia', co: 'Centro obstétrico' }
const SEM_NOME = 'sem anestesista'

/** Espera/decorrido: "48min" · "2h10". */
export const formatEspera = (min) => {
  if (min == null) return ''
  const m = Math.max(0, Math.round(min))
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Caixa comum dos cards da faixa — o arranjo interno é de cada um. */
const CARD_BOX = 'w-full overflow-hidden rounded-[10px] border px-2 py-1 text-left'

/**
 * Card em TRÊS LINHAS, modelo B aprovado pelo dono em 09/09 (protótipo
 * `.tmp/urgencias-cards-modelos.html`, 430px nos dois temas):
 *   1. o PAPEL — é o título fixo do card e diz o que aquela caixa é;
 *   2. QUEM está;
 *   3. ONDE e QUANTO pesa ("Sala 7 · 2 cir.").
 * Antes, sala em cima e nome embaixo com o papel espremido à direita: os quatro
 * cards pareciam irmãos sendo duas espécies (o contrato CONTA, o dedicado não),
 * o canto direito falava cinco idiomas ("livre", "Orto", "2 cir.", "48min",
 * "fora do contrato") e a vaga livre tinha silhueta diferente da ocupada.
 */
const CARD_BASE = `flex min-h-[48px] flex-col justify-center gap-px ${CARD_BOX}`

/** Linha da FILA: continua em UMA linha — ali não há sala, e o que se lê de
 *  relance é gravidade → procedimento → espera, nessa ordem, lado a lado. */
const CARD_FILA = `flex min-h-[36px] items-center gap-1.5 ${CARD_BOX}`

/** Título do card: o papel, sempre no mesmo lugar e no mesmo tamanho. */
const Papel = ({ children, tom = 'muted' }) => (
  <span
    className={[
      'truncate text-[9.5px] font-extrabold uppercase leading-[13px] tracking-[0.06em]',
      tom === 'primary' ? 'text-primary' : tom === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
    ].join(' ')}
  >
    {children}
  </span>
)

/** Nome de quem está — a linha que se procura no card. */
const Quem = ({ children, vazio = false }) => (
  <span className={`truncate text-[13.5px] leading-[17px]${vazio ? ' text-muted-foreground' : ''}`}>{children}</span>
)

/** Onde e quanto pesa. */
const Onde = ({ children, tom = 'muted' }) => (
  <span
    className={`truncate text-[10.5px] tabular-nums ${tom === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`}
  >
    {children}
  </span>
)

/**
 * Vagas do contrato: uma pastilha por vaga (cheia = usada) + uma vermelha por
 * sala ACIMA dele. Substitui as duas contagens que o cabeçalho trazia — "0 de 2
 * salas" ao lado de "2 livres", com duas salas cheias logo abaixo, era a
 * contradição que o dono apontou em 09/09.
 */
const Vagas = ({ ocupadas, capacidade }) => (
  <span
    role="img"
    aria-label={`${ocupadas} de ${capacidade} vagas de urgência ocupadas`}
    className="ml-auto flex items-center gap-[3px]"
  >
    {Array.from({ length: capacidade }, (_, i) => (
      <i
        key={i}
        className={`h-[9px] w-[9px] rounded-[3px] border-[1.5px] ${i < ocupadas ? 'border-primary bg-primary' : 'border-primary/55'}`}
      />
    ))}
    {Array.from({ length: Math.max(0, ocupadas - capacidade) }, (_, i) => (
      <i key={`x${i}`} className="h-[9px] w-[9px] rounded-[3px] border-[1.5px] border-destructive bg-destructive" />
    ))}
  </span>
)

export default function FaixaUrgencias({ escala, hospital, turno }) {
  const { user } = useUser()
  const { rosterByUid } = useRosterAnestesistas()
  const { setStatusCirurgia } = useEscalaCirurgicaActions()
  const [detalhe, setDetalhe] = useState(null)
  // Definir o anestesista a partir do detalhe aberto PELA FAIXA (dono 21/08): a
  // urgência costuma nascer sem anestesista — é o caso das cesarianas do CO —, e
  // sem estas duas props o `CasoDetalheSheet` esconde o botão da linha
  // "Anestesista", que é justamente o dado que falta preencher ali.
  const [definir, setDefinir] = useState(null)
  const [todas, setTodas] = useState(false)
  const [configurar, setConfigurar] = useState(false)
  // Toque num posto SEM caso abre o "Adicionar caso" já apontando o posto
  // (dono 19/08) — { posto, sala } pré-preenchidos; ocupado segue abrindo o detalhe.
  const [addCaso, setAddCaso] = useState(null)

  // Ocupação é do relógio → dia INTEIRO; o turno só escolhe a linha do contrato.
  // O hook é a fonte única (dono 21/08): montar os `opts` à mão aqui foi o que
  // deixou esta tela e o "Adicionar caso" aplicarem linhas de contrato diferentes.
  const { estado } = useEstadoUrgencias(escala, { hospital, turno })

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
  /** 3ª linha do card: onde está e o que carrega, na mesma frase. */
  const ondeOcupacao = (it) => [salaLiberacao(it.sala), metaOcupacao(it)].filter(Boolean).join(' · ')
  const ondeDedicado = (d) => [salaLiberacao(d.sala), d.qtd ? `${d.qtd} cir.` : ''].filter(Boolean).join(' · ')

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
        {/* cabeçalho: título + em que linha do contrato estamos + vagas.
            O turno vem junto porque é o RELÓGIO que decide a capacidade (de
            manhã o CO tem dedicado; à tarde ele vira vaga de urgência) — sem
            ele, "por que a Sala 7 agora conta?" não tinha resposta na tela. */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-extrabold">Urgências</span>
          <span className={`truncate text-xs ${acima ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
            {acima ? 'acima do contrato' : `${estado.turnoLabel} · contrato de ${estado.capacidade}`}
          </span>
          <Vagas ocupadas={estado.ocupadas} capacidade={estado.capacidade} />
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
              <Papel tom="primary">{PAPEL_LABEL[papel] || papel}</Papel>
              <Quem vazio={!nomeDe(item.anestesista)}>{nomeDe(item.anestesista) || SEM_NOME}</Quem>
              <Onde>{ondeOcupacao(item)}</Onde>
            </button>
          ) : (
            <button
              key={papel}
              type="button"
              disabled={!podeEditar}
              onClick={() => setAddCaso({ posto: papel === 'plantonista' ? 'plantao' : papel })}
              className={`${CARD_BASE} border-dashed border-border bg-transparent`}
            >
              {/* posto LIVRE: mesma silhueta da ocupada, sem a linha do "onde" —
                  o card não muda de forma quando alguém entra nele. */}
              <Papel tom="primary">{PAPEL_LABEL[papel] || papel}</Papel>
              <Quem vazio>livre</Quem>
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
                  // barra cinza à esquerda = "fora da conta". É o único sinal que
                  // separa o dedicado dos postos pagos — antes, só a palavra
                  // "Orto"/"CO" no canto, no mesmo lugar onde aparece "livre".
                  'border-border border-l-[3px] border-l-border-strong',
                  // urgência em andamento na sala dedicada pinta como as demais
                  d.item?.emAndamento ? 'bg-success/[0.14] dark:bg-success/20' : 'bg-muted/55',
                ].join(' ')}
              >
                <Papel>{DEDICADO_TITULO[d.papel] || d.papel}</Papel>
                <Quem vazio={!nomeDe(d.anestesista)}>{nomeDe(d.anestesista) || SEM_NOME}</Quem>
                <Onde>{ondeDedicado(d)}</Onde>
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
            <Papel tom="destructive">Extra — fora do contrato</Papel>
            <Quem vazio={!nomeDe(it.anestesista)}>{nomeDe(it.anestesista) || SEM_NOME}</Quem>
            <Onde tom="destructive">{ondeOcupacao(it)}</Onde>
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
                /* `.catch` obrigatório: a action dá throw depois do toast, e este
                   era o único call site sem tratamento — rejeição não tratada. */
                onClick={() => setStatusCirurgia(escala, it.caso, 'terminada', { userId: user?.uid || user?.id }).catch(() => {})}
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
          caso={addCaso.caso || null}
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
          podeDefinirAnestesista={() => podeEditar}
          onDefinirAnestesista={(sala, casoAlvo) => setDefinir({ sala, casosAlvo: casoAlvo ? [casoAlvo] : null })}
          onEditarCaso={(alvo) => { setDetalhe(null); setAddCaso({ caso: alvo }) }}
          podeEditar={podeEditar}
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
