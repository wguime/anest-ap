/**
 * BoardView — visão COMPLETA da escala do hospital (todas as salas/casos).
 * Lista de cards agrupada por sala (mobile-first, sem grid). Toque no caso
 * abre um bottom-sheet com o detalhe.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock, GraduationCap, Stethoscope, Timer, UserCog, Plus } from 'lucide-react'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Badge, Button, EmptyState,
} from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { fraseClinica, titleCaseNome } from '@/lib/colunaLiberacao'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { casoConcluido, casosResolvidos, agruparPorSala, tipoBadge, normNome, filtrarPorTurno, compararSalas, parseHoraMinutos, salaExibicao, nomeAnestesistaExibicao } from './utils'
import { podeEditarEscalaCirurgica } from './gate'
import { formatFaltante } from './PainelTempo'
import useAgoraMinuto from './useAgoraMinuto'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import AddCasoSheet from './AddCasoSheet'
import CasoDetalheSheet from './CasoDetalheSheet'

// Status em DOIS eixos (decisão do dono 2026-07-21):
// PRINCIPAL (exclusivo, pinta o card): agendada → Iniciada VERDE → Terminada AZUL.
const STATUS_CIRURGIA = {
  iniciada: { label: 'Iniciada', variant: 'success', card: 'border-success bg-success/25' },
  terminada: { label: 'Terminada', variant: 'info', card: 'border-info bg-info/15 dark:bg-info/25' },
}
// EXTRA (badge que convive com agendada/iniciada; terminada limpa e bloqueia):
const STATUS_EXTRA = {
  atrasada: { label: 'Atrasada', variant: 'warning' },
  suspensa: { label: 'Suspensa', variant: 'destructive' },
  passa_tarde: { label: 'Passa para tarde', variant: 'default', badgeClass: 'border-transparent bg-category-purple text-white' },
}
// dados/demos antigos ainda podem trazer o extra no campo principal
const extraDe = (caso) => STATUS_EXTRA[caso.statusExtra] || STATUS_EXTRA[caso.statusCirurgia] || null

/** Caso "placeholder" (ex.: SRPA sem procedimentos): não renderiza card — só o cabeçalho da sala. */
export const casoVazio = (c) =>
  !String(c?.hora || '').trim() && !String(c?.pacienteIniciais || '').trim() &&
  !String(c?.procedimento || '').trim() && !String(c?.cirurgiao || '').trim()

/**
 * Exportado: a aba Minhas e o painel da linha (Liberações) usam o MESMO card
 * (pedido do dono 2026-07-21 / 29-07).
 * Grafia: nunca CAIXA ALTA — procedimento em frase (siglas preservadas), nomes em Title Case.
 *
 * `agoraMin` vem de FORA de propósito: o cronômetro precisa de um único intervalo
 * para a lista toda (ver useAgoraMinuto), não um timer por card. Sem ele, o card
 * mostra a HORA do término em vez da contagem — nunca perde a informação.
 */
export function CasoCard({ caso, destaque, salaLabel, onClick, agoraMin = null }) {
  const tb = tipoBadge(caso.tipo)
  const st = STATUS_CIRURGIA[caso.statusCirurgia]
  const ex = extraDe(caso)
  const procedimento = fraseClinica(caso.procedimento)
  const cirurgiao = titleCaseNome(caso.cirurgiao)
  // residente ACOMPANHA o caso (dono 29/07) — aparece abaixo do cirurgião, em peso
  // menor: quem responde pelo caso continua sendo o anestesista.
  const residente = titleCaseNome(caso.residente)
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={[
        'w-full text-left rounded-xl border p-3 min-h-[44px] transition-colors',
        // hover só onde hover existe de verdade — no touch o :hover "gruda" após o tap
        // e o card fica oscilando entre a tinta do status e o cinza (bug reportado no mobile)
        'active:bg-muted/60 supports-[hover:hover]:hover:bg-muted/40',
        st?.card ? st.card : destaque ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
        // convênio identifica só pelo SELO (stripe lateral removida a pedido do dono 2026-07-21)
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Zona 1 — quando/quem: hora fixa à esquerda, paciente+idade, badges de tipo/status */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {salaLabel && <span className="font-bold text-foreground">{salaLabel}</span>}
            {caso.hora && (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {caso.hora}
              </span>
            )}
            {caso.pacienteIniciais && (
              <span className="max-w-[8rem] truncate font-semibold text-foreground" title={caso.pacienteIniciais}>
                {caso.pacienteIniciais}
              </span>
            )}
            {caso.idade && <span className="text-muted-foreground">{caso.idade}</span>}
            {tb && <Badge variant={tb.variant} badgeStyle={tb.style}>{tb.label}</Badge>}
            {st && <Badge variant={st.variant}>{st.label}</Badge>}
            {ex && <Badge variant={ex.variant} className={ex.badgeClass}>{ex.label}</Badge>}
          </div>
          {/* Zona 2 — procedimento + tempo cirúrgico na MESMA linha (pedido 2026-07-21) */}
          {(procedimento || caso.tempoEstimado || alvoCaso != null) && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[15px] text-foreground/90" title={procedimento}>{procedimento}</p>
              <span className="flex shrink-0 items-center gap-1.5">
                {caso.tempoEstimado && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="w-3 h-3" /> {caso.tempoEstimado}
                  </span>
                )}
                {/* chip CINZA e pequeno: é o tempo de UMA cirurgia. O da PESSOA é a
                    pílula verde sólida na fila — pesos diferentes de propósito, para
                    o plantonista nunca ler um pelo outro. */}
                {alvoCaso != null && (
                  <span
                    title={emAndamento
                      ? `Esta cirurgia (em andamento) termina às ${caso.terminoPrevisto}`
                      : `Esta cirurgia está prevista para terminar às ${caso.terminoPrevisto}`}
                    className={[
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
                      faltaCaso?.atrasada
                        ? 'border-warning/50 bg-warning/10 text-warning'
                        : 'border-border bg-muted/60 text-foreground/80',
                    ].join(' ')}
                  >
                    <Timer className="w-3 h-3 shrink-0" />
                    {faltaCaso ? faltaCaso.texto : caso.terminoPrevisto}
                  </span>
                )}
              </span>
            </div>
          )}
          {/* Zona 3 — cirurgião em destaque + convênio na MESMA linha (sem rodapé:
              elimina o espaço em branco abaixo do cirurgião — pedido 2026-07-21).
              Selo TONAL; -mr-6 estende sob a coluna da seta → cola na borda direita. */}
          {(cirurgiao || caso.convenio) && (
            <div className="-mr-6 mt-1 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-foreground">
                <Stethoscope className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate" title={cirurgiao}>{cirurgiao}</span>
              </p>
              {caso.convenio && (
                <span className="max-w-[140px] shrink-0 truncate rounded-md border border-transparent bg-black/10 px-1.5 py-0.5 text-xs font-medium text-foreground/80 dark:bg-white/15 dark:text-foreground/90"
                  title={caso.convenio}>
                  {caso.convenio}
                </span>
              )}
            </div>
          )}
          {residente && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate" title={`Residente: ${residente}`}>Residente: {residente}</span>
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  )
}

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
  const grupos = useMemo(() => agruparPorSala(casos), [casos])
  const alvo = normNome(meuAlias)

  // GRUPOS DE EXIBIÇÃO (pedido do dono 23/07): sala com MAIS de um anestesista
  // (IOSC/Exames/Umanitá/…) vira UM GRUPO POR ANESTESISTA — "IOSC — Cury",
  // "IOSC — Melo" — cada um se comporta como sala separada, sem dúvidas de quem
  // cobre o quê. Sala de anestesista único segue como um grupo só.
  const gruposExibicao = useMemo(() => {
    const out = []
    const salasOrdenadas = [...grupos.keys()].sort(compararSalas(escala?.hospital))
    for (const sala of salasOrdenadas) {
      const lista = grupos.get(sala)
      const nomes = [...new Set(lista.map((c) => normNome(c.anestesista)).filter(Boolean))]
      if (nomes.length <= 1) {
        out.push({ chave: sala, sala, anestesista: lista.find((c) => c.anestesista)?.anestesista || '', casos: lista, split: false })
        continue
      }
      const porAnest = new Map()
      for (const c of lista) {
        const k = normNome(c.anestesista) || '?'
        if (!porAnest.has(k)) porAnest.set(k, { chave: `${sala}|${k}`, sala, anestesista: c.anestesista || '', casos: [], split: true })
        porAnest.get(k).casos.push(c)
      }
      out.push(...porAnest.values())
    }
    return out
  }, [grupos, escala?.hospital])
  const ehMeu = (c) => (c.anestesistaUserId ? c.anestesistaUserId === meuUid : alvo && normNome(c.anestesista) === alvo)

  const isDemo = String(escala?.id).startsWith('demo-')
  const canEdit = podeEditarEscalaCirurgica(user)
  // Sistema de trocas APOSENTADO (2026-07-23): quem define é o RESPONSÁVEL da sala.
  // Desde 27/07 o botão é de TODA a equipe que edita a escala (mesmo conjunto da
  // RLS), não só do dono da sala/coordenador: exigir ser o dono escondia o ⚙ do
  // board inteiro para a maioria — quem chegava para cobrir um colega não tinha
  // como assumir, e a identidade não resolvida (caso sem uid, apelido fora do
  // dicionário) tirava o botão até da própria sala. Escala é colaborativa; toda
  // definição notifica os dois lados e vai para `escala_cirurgica_evento`.
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
  if (!casos.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Nenhum caso neste turno"
        description="Não há casos no turno selecionado. Troque para o outro turno."
      />
    )
  }

  const chavesGrupos = gruposExibicao.map((g) => g.chave)

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
      <Accordion type="multiple" value={abertasAtual} onValueChange={setAbertas} className="space-y-2">
        {gruposExibicao.map((g) => {
          const nomeGrupo = g.anestesista ? displayGrupo(g) : (g.split ? '?' : '')
          return (
            <AccordionItem key={g.chave} value={g.chave} className="rounded-xl border border-border bg-card">
              {/* sticky no <h3> do header (no button interno é inerte — h3 tem a altura dele) */}
              <AccordionTrigger
                className="px-3"
                headerClassName="sticky top-14 z-10 bg-card rounded-t-xl"
                iconAfterActions
                iconClassName="rounded-tr-xl group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                actions={podeDefinir ? (
                  <button
                    type="button"
                    onClick={() => setDefinir({ sala: g.sala, casosAlvo: g.split ? g.casos : null })}
                    aria-label={`Definir anestesista da ${g.sala}${g.split ? ` (${nomeGrupo})` : ''}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center self-stretch
                               px-1 text-primary transition-colors active:opacity-60
                               group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                ) : null}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0">{salaExibicao(g.sala)}</span>
                  {nomeGrupo && (
                    <span className="truncate font-normal text-muted-foreground" title={nomeGrupo}>
                      — {nomeGrupo}
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {/* SRPA e afins sem procedimentos: só o cabeçalho, sem card vazio */}
                  {g.casos.filter((c) => !casoVazio(c)).map((caso) => (
                    <CasoCard
                      key={caso.id || `${g.chave}-${caso.ordem}`}
                      caso={caso}
                      destaque={ehMeu(caso)}
                      agoraMin={agoraMin}
                      onClick={() => setDetalhe(caso)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {detalhe && (
        <CasoDetalheSheet
          escala={escala}
          caso={detalhe}
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
          onClose={() => setDefinir(null)}
        />
      )}
    </>
  )
}

