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
 */
import { useMemo, useState } from 'react'
import { Check, GraduationCap, MapPin, Stethoscope, Timer, UserCog } from 'lucide-react'
import { Badge, Button, Input, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { HOSPITAL_LABEL, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import useRosterResidentes from '@/hooks/useRosterResidentes'
import { fraseClinica, titleCaseNome } from '@/lib/colunaLiberacao'
import PainelTempo, { formatFaltante } from './PainelTempo'
import useAgoraMinuto from './useAgoraMinuto'
import { espelhoTempoTotal, LOCAIS_BASE, nomeAnestesistaExibicao, normalizarSalaHro, normNome, parseHoraMinutos, rodapeDoTurno, salaExibicao, tipoBadge, turnoDoCaso } from './utils'
import { GRAVIDADES, GRAVIDADE_LABEL } from '@/lib/escalaCirurgicaUrgencias'

const SALA_OUTRO = '__outro__'
// Sentinela do seletor de residente (valor impossível como uid).
const SEM_RESIDENTE = '__sem__'

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
const TIPOS = [
  { valor: 'eletiva', label: 'Eletiva' },
  { valor: 'urgencia', label: 'Urgência', cls: 'border-destructive bg-destructive/15 text-destructive' },
  { valor: 'emergencia', label: 'Emergência', cls: 'border-destructive bg-destructive text-destructive-foreground' },
]

// GRAVIDADE — só em urgência/emergência. Adaptação da NCEPOD Classification of
// Intervention, que manda quem vai operar classificar no momento da decisão de
// operar: por isso fica aqui, no Andamento (onde se AGE), e não no cabeçalho de
// identidade — a gravidade muda no tempo, um "pode aguardar" que descompensa
// vira "imediata". É ela que ordena a fila de urgências do HRO.
const GRAVIDADE_CLS = {
  imediata: 'border-destructive bg-destructive text-destructive-foreground',
  urgente: 'border-warning bg-warning text-warning-foreground',
  aguarda: 'border-border-strong bg-foreground/80 text-background',
}

// EIXO EXTRA — convive com agendada/iniciada; terminada limpa e bloqueia.
const AVISO = [
  { valor: 'atrasada', label: 'Atrasada', cls: 'border-warning bg-warning text-warning-foreground' },
  { valor: 'suspensa', label: 'Suspensa', cls: 'border-destructive bg-destructive text-destructive-foreground' },
  // por extenso, igual ao badge do quadro e da fila — abreviar aqui criaria um
  // terceiro nome para o mesmo estado (o chip quebra em duas linhas e cabe)
  { valor: 'passa_tarde', label: 'Passa para tarde', cls: 'border-category-purple bg-category-purple text-white' },
]

export default function CasoDetalheSheet({ escala, caso, turno, onClose, podeDefinirAnestesista, onDefinirAnestesista, podeEditar }) {
  const { setStatusCirurgia, atualizarCaso, adicionarAjuda, removerAjuda, setLinhaOverride } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { options: opcoesResidente, residenteByUid } = useRosterResidentes()
  const { rosterByUid } = useRosterAnestesistas()
  const agoraMin = useAgoraMinuto()
  const isDemo = String(escala?.id).startsWith('demo-')
  // um editor por vez: 'sala' | 'cirurgiao' | 'residente' | 'tempo' | null
  const [editor, setEditor] = useState(null)
  const [rascSala, setRascSala] = useState('')
  const [salaOutro, setSalaOutro] = useState(false)
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [horaExata, setHoraExata] = useState('') // hora exata de término da cirurgia

  // caso VIVO: busca a versão atual no estado (id); cai no prop p/ demo/sem id
  const vivo = useMemo(() => {
    if (!caso) return null
    return (caso.id && (escala?.casos || []).find((c) => c.id === caso.id)) || caso
  }, [escala, caso])

  // Opções de sala/local: salas usadas na escala do dia ∪ base do hospital (IOSC,
  // Umanitá, salas fixas…). "Outro" abre digitação p/ um local ainda não listado.
  const opcoesSala = useMemo(() => {
    const base = LOCAIS_BASE[String(escala?.hospital || '').toLowerCase()] || []
    const doDia = (escala?.casos || []).map((c) => String(c.sala || '').trim()).filter(Boolean)
    return unicos([...doDia, ...base])
  }, [escala])

  if (!vivo) return null

  // Um gate só para todos os ajustes do caso: quem edita a escala (canEdit), fora
  // da demo e com o caso já persistido (id) — sem id não há o que atualizar.
  const podeEditarCaso = !!podeEditar && !isDemo && !!vivo.id
  const abrirEditor = (qual) => {
    if (qual === 'sala') {
      const atual = String(vivo.sala || '')
      setRascSala(atual)
      setSalaOutro(!!atual && !opcoesSala.some((s) => s.toLowerCase() === atual.toLowerCase()))
    }
    if (qual === 'cirurgiao') {
      const atual = String(vivo.cirurgiao || '')
      setRascCirurgiao(atual)
    }
    setEditor((e) => (e === qual ? null : qual))
  }

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

  /** Grava um campo de texto do caso (sala/cirurgião) e fecha o editor.
      Fecha ANTES do servidor: o valor novo já está pintado (context otimista) e
      erro reverte com toast — a folha presa no spinner era o delay (dono 19/08). */
  const salvarTexto = (campo, valor) => {
    // sala do HRO passa pela normalização da importação — rótulo único (dono 20/08)
    const bruto = String(valor || '').trim()
    const novo = campo === 'sala' && escala?.hospital === 'hro' ? normalizarSalaHro(bruto) : bruto
    setEditor(null)
    if (!novo || novo === String(vivo[campo] || '')) return
    atualizarCaso(escala, vivo.id, { [campo]: novo }).catch(() => {})
  }

  // RESIDENTE do caso (dono 29/07): acompanha, NÃO responde pelo caso — por isso é
  // seletor próprio e não entra em nenhum caminho de anestesista. Grava uid + nome
  // de exibição, como já é feito com anestesista/anestesistaUserId: com o uid, a aba
  // "Minhas" do residente passa a mostrar os casos dele.
  const residenteNome = vivo.residente
    || (vivo.residenteUserId && residenteByUid.get(vivo.residenteUserId)?.nome)
    || ''
  const trocarResidente = (valor) => {
    const r = valor === SEM_RESIDENTE ? null : residenteByUid.get(valor)
    if (valor !== SEM_RESIDENTE && !r) return
    setEditor(null) // fecha no toque — context otimista pinta e reverte em erro
    atualizarCaso(escala, vivo.id, {
      residente: r ? r.nome : null,
      residenteUserId: r ? r.uid : null,
    }).catch(() => {})
  }

  // TÉRMINO PREVISTO DESTA CIRURGIA (dono 29/07). É o tempo do CASO — o "quanto
  // falta para a pessoa sair" continua sendo o cronômetro da linha, nas Liberações.
  // Este sheet é o mesmo nas duas abas, então preencher aqui atende as duas.
  const definirTerminoCaso = async (hhmm) => {
    setHoraExata('') // limpa no toque; o chip pinta pelo otimista do context
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
  const mudarStatus = (status) => setStatusCirurgia(escala, vivo, status).catch(() => {})

  const principal = vivo.statusCirurgia || 'agendada'
  const terminada = principal === 'terminada'
  const tb = tipoBadge(vivo.tipo)
  const alvoTermino = parseHoraMinutos(vivo.terminoPrevisto)
  const faltaTermino = alvoTermino != null && !terminada ? formatFaltante(alvoTermino, agoraMin) : null

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
        <div className="space-y-2.5 px-1 pb-4">
          <article className="rounded-2xl border border-border-strong bg-card-elevated p-3">
            {/* MESMA grafia do card no quadro (`fraseClinica`): o texto importado
                vem em CAIXA ALTA e o painel repetia assim — o mesmo procedimento
                aparecia de dois jeitos em duas telas do mesmo caso. */}
            <SheetTitle className="text-[15px] font-extrabold leading-tight [overflow-wrap:anywhere]">
              {fraseClinica(vivo.procedimento) || salaExibicao(vivo.sala)}
            </SheetTitle>
            {(vivo.pacienteIniciais || vivo.idade || vivo.tempoEstimado) && (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {[vivo.pacienteIniciais, idadeCurta(vivo.idade), vivo.tempoEstimado && `previsto ${vivo.tempoEstimado}`]
                  .filter(Boolean).join(' · ')}
              </p>
            )}
          </article>

          {/* ── ANDAMENTO: os dois eixos + o tempo desta cirurgia ─────────── */}
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
                      {s.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Marcar <b className="font-semibold text-foreground">Terminada</b> desliga os avisos.
              </p>

              {/* TIPO: fica no Andamento porque reclassificar é AÇÃO no meio do
                  turno (a urgência que entrou como eletiva no mapa), e porque é
                  daqui que sai a gravidade logo abaixo. */}
              {podeEditarCaso && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <p className="mb-1.5 text-[12.5px] text-muted-foreground">
                    Tipo <span className="text-[11.5px]">— urgência entra na conta do contrato</span>
                  </p>
                  <div className="flex gap-1.5">
                    {TIPOS.map((t) => {
                      const ativo = (vivo.tipo || 'eletiva') === t.valor
                      return (
                        <button
                          key={t.valor}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => mudarTipo(t.valor)}
                          className={[
                            'min-h-[44px] flex-1 rounded-[10px] border px-1.5 text-[12.5px] font-semibold leading-tight transition-colors',
                            ativo ? (t.cls || 'border-primary bg-primary text-primary-foreground') : 'border-border-strong bg-card text-foreground',
                          ].join(' ')}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Gravidade: só faz sentido em urgência/emergência, e é o que
                  decide quem entra primeiro quando as 2 salas do contrato do HRO
                  estão ocupadas. Sem classificação a urgência vai para o fim da
                  fila com chamada de ação — o app não chuta prioridade clínica. */}
              {tb && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <p className="mb-1.5 text-[12.5px] text-muted-foreground">
                    Gravidade <span className="text-[11.5px]">— ordena a fila de urgências</span>
                  </p>
                  <div className="flex gap-1.5">
                    {GRAVIDADES.map((g) => {
                      const ativo = vivo.gravidade === g
                      return (
                        <button
                          key={g}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => mudarGravidade(g)}
                          className={[
                            'min-h-[44px] flex-1 rounded-[10px] border px-1.5 text-[12.5px] font-semibold leading-tight transition-colors',
                            ativo ? GRAVIDADE_CLS[g] : 'border-border-strong bg-card text-foreground',
                          ].join(' ')}
                        >
                          {GRAVIDADE_LABEL[g]}
                        </button>
                      )
                    })}
                  </div>
                  {!vivo.gravidade && (
                    <p className="mt-1.5 text-[11.5px] text-warning">
                      Sem classificação — entra no fim da fila.
                    </p>
                  )}
                </div>
              )}

              {podeEditarCaso && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditor((e) => (e === 'tempo' ? null : 'tempo'))}
                    className="mt-2 flex min-h-[48px] w-full items-center gap-2 border-t border-border pt-2 text-left"
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" /> Término desta cirurgia
                    </span>
                    {vivo.terminoPrevisto ? (
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="text-[15px] font-bold tabular-nums">{vivo.terminoPrevisto}</span>
                        {faltaTermino && (
                          <span className={['text-[11.5px]', faltaTermino.atrasada ? 'font-medium text-warning' : 'text-muted-foreground'].join(' ')}>
                            {faltaTermino.atrasada
                              ? `${faltaTermino.texto.replace('+', '')} além`
                              : `faltam ${faltaTermino.texto.replace('~', '')}`}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="ml-auto text-[14px] font-semibold text-primary">Definir término</span>
                    )}
                    <span className="text-muted-foreground">{editor === 'tempo' ? '▴' : '▾'}</span>
                  </button>
                  {/* O editor abre num sheet PRÓPRIO, de baixo para cima (dono
                      17/08): expandindo aqui dentro, o card mudava de tamanho no
                      meio da leitura e a pessoa perdia o lugar. */}
                  {editor === 'tempo' && (
                    <EditorSheet
                      titulo="Término desta cirurgia"
                      nota="Só desta cirurgia. Na fila conta o tempo enquanto está Iniciada."
                      onClose={() => setEditor(null)}
                    >
                      <PainelTempo
                        atual={vivo.terminoPrevisto || ''}
                        horaExata={horaExata}
                        onHoraExata={setHoraExata}
                        onDefinir={(v) => { definirTerminoCaso(v); setEditor(null) }}
                      />
                    </EditorSheet>
                  )}
                </>
              )}
              {!podeEditarCaso && vivo.terminoPrevisto && (
                <p className="mt-2 border-t border-border pt-2 text-[12.5px] text-muted-foreground">
                  Término desta cirurgia: <b className="text-foreground tabular-nums">{vivo.terminoPrevisto}</b>
                </p>
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

            <LinhaDado
              icone={<GraduationCap className="h-3.5 w-3.5" />}
              rotulo="Residente"
              valor={titleCaseNome(residenteNome) || (podeEditarCaso ? 'Sem residente' : '')}
              acao={podeEditarCaso && { label: 'Trocar', onClick: () => abrirEditor('residente') }}
            />
            {/* A LISTA JÁ ABERTA (dono 17/08): antes o toque revelava um seletor
                fechado, e era preciso um segundo toque para ver os nomes. */}
            {editor === 'residente' && (
              <EditorSheet
                titulo="Residente que acompanha"
                nota="Acompanha o caso — quem responde por ele continua sendo o anestesista."
                onClose={() => setEditor(null)}
              >
                <ListaEscolha
                  opcoes={[{ value: SEM_RESIDENTE, label: 'Sem residente' }, ...opcoesResidente]}
                  valor={vivo.residenteUserId || SEM_RESIDENTE}
                  onEscolher={trocarResidente}
                />
              </EditorSheet>
            )}

            {/* Corrigir ONDE o caso acontece (dono 24/07) — mesma gramática das
                outras linhas do cartão, em vez de um botão solto no fim do painel. */}
            <LinhaDado
              icone={<MapPin className="h-3.5 w-3.5" />}
              rotulo="Sala/local"
              valor={salaExibicao(vivo.sala)}
              acao={podeEditarCaso && { label: 'Mudar', onClick: () => abrirEditor('sala') }}
            />
            {editor === 'sala' && (
              <EditorSheet
                titulo="Sala / Local do procedimento"
                onClose={() => setEditor(null)}
              >
                <ListaEscolha
                  opcoes={opcoesSala.map((o) => ({ value: o, label: o }))}
                  valor={salaOutro ? '' : String(vivo.sala || '')}
                  onEscolher={(v) => salvarTexto('sala', v)}
                />
                {/* local novo continua possível — digitado, entra na lista das
                    próximas vezes (regra antiga do campo) */}
                <div className="border-t border-border pt-2">
                  <Input
                    aria-label="Outra sala ou local"
                    value={rascSala}
                    onChange={(e) => { setSalaOutro(true); setRascSala(e.target.value) }}
                    placeholder="Outro local — ex.: IOSC - Sala 1"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarTexto('sala', rascSala) }}
                  />
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditor(null)}>Cancelar</Button>
                    <Button size="sm" className="flex-1" disabled={!rascSala.trim()}
                      onClick={() => salvarTexto('sala', rascSala)}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </EditorSheet>
            )}

            {/* CIRURGIÃO editável (dono 17/08): o nome vem da importação e sai
                torto com alguma frequência; era o único dado da cirurgia sem
                conserto no app — só o campo de EXIBIÇÃO da fila, que não corrige
                o caso nem o quadro. Grava em `cirurgiao`, o mesmo campo que o
                "Adicionar caso" já preenche. */}
            <LinhaDado
              icone={<Stethoscope className="h-3.5 w-3.5" />}
              rotulo="Cirurgião"
              valor={titleCaseNome(vivo.cirurgiao)}
              acao={podeEditarCaso && { label: 'Trocar', onClick: () => abrirEditor('cirurgiao') }}
            />
            {/* Só DIGITAÇÃO (dono 17/08): o nome do cirurgião vem torto da
                importação e a lista de sugestões atrapalhava mais do que ajudava
                — quem corrige aqui já sabe o nome certo. */}
            {editor === 'cirurgiao' && (
              <EditorSheet
                titulo="Cirurgião desta cirurgia"
                nota="Vale só para esta cirurgia. A fila mostra o cirurgião de cada caso automaticamente."
                onClose={() => setEditor(null)}
              >
                <Input
                  autoFocus
                  aria-label="Nome do cirurgião"
                  value={rascCirurgiao}
                  onChange={(e) => setRascCirurgiao(e.target.value)}
                  placeholder="ex.: Eduardo Baldissera"
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarTexto('cirurgiao', rascCirurgiao) }}
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditor(null)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" disabled={!rascCirurgiao.trim()}
                    onClick={() => salvarTexto('cirurgiao', rascCirurgiao)}>
                    Salvar
                  </Button>
                </div>
              </EditorSheet>
            )}

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

/** Lista sem repetição, preservando a ordem e ignorando caixa. */
function unicos(lista) {
  const vistos = new Set()
  const out = []
  for (const s of lista) {
    const k = s.toLowerCase()
    if (!vistos.has(k)) { vistos.add(k); out.push(s) }
  }
  return out
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
        <div className="space-y-2 overflow-y-auto pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Lista de escolha com as opções JÁ VISÍVEIS — um toque escolhe e grava. O
 * seletor fechado exigia dois toques para ver os nomes (dono 17/08), e numa lista
 * curta como residente ou sala isso é uma etapa a mais sem ganho nenhum.
 */
function ListaEscolha({ opcoes, valor, onEscolher }) {
  return (
    <ul className="max-h-[52vh] overflow-y-auto rounded-xl border border-border">
      {opcoes.map((o) => {
        const atual = String(o.value) === String(valor)
        return (
          <li key={o.value} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onEscolher(o.value)}
              aria-pressed={atual}
              className={[
                'flex min-h-[48px] w-full items-center gap-2 px-3 py-2 text-left text-[15px]',
                atual ? 'bg-primary/10 font-bold text-primary' : 'font-medium',
              ].join(' ')}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
              {atual && <Check className="ml-auto h-4 w-4 shrink-0" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
