/**
 * CasoDetalheSheet — detalhe do caso COMPARTILHADO pelas abas Completa e Minhas.
 * Fonte única da UI de detalhe/status/troca (antes vivia só no BoardView e a aba
 * Minhas era um beco sem saída — pedido do dono 2026-07-21).
 *
 * Sincronizado AO VIVO: o caso exibido deriva de `escala.casos` (context) — updates
 * otimistas e realtime de outros usuários refletem com o sheet aberto.
 *
 * DESENHO "ANDAMENTO NO TOPO" (dono 17/08, escolhido em protótipo a 430px): o que
 * se toca no meio da cirurgia é o ESTADO, então ele abre o painel; a identidade do
 * caso vira cabeçalho (procedimento como título, iniciais/idade/convênio como
 * metadado) e o resto desce em três blocos de peso decrescente — Equipe, Tempo e,
 * por último, o raro (mudar de sala/local). Antes eram três botões empilhados
 * iguais, seis botões de status e três linhas de dados, tudo no mesmo peso.
 */
import { useMemo, useState } from 'react'
import { GraduationCap, Loader2, MapPin, Stethoscope, Timer, UserCog } from 'lucide-react'
import { Badge, Button, Input, Select, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { HOSPITAL_LABEL, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterResidentes from '@/hooks/useRosterResidentes'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import PainelTempo, { formatFaltante } from './PainelTempo'
import useAgoraMinuto from './useAgoraMinuto'
import { espelhoTempoTotal, LOCAIS_BASE, normNome, parseHoraMinutos, rodapeDoTurno, salaExibicao, tipoBadge, turnoDoCaso } from './utils'

const SALA_OUTRO = '__outro__'
// Sentinela do seletor de residente (valor impossível como uid).
const SEM_RESIDENTE = '__sem__'
const CIRURGIAO_OUTRO = '__outro__'

// EIXO PRINCIPAL — exclusivo, é o que pinta o card no quadro.
const ANDAMENTO = [
  { valor: 'agendada', label: 'Agendada' },
  { valor: 'iniciada', label: 'Iniciada', cls: 'bg-success text-success-foreground' },
  { valor: 'terminada', label: 'Terminada', cls: 'bg-info text-info-foreground' },
]
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
  const agoraMin = useAgoraMinuto()
  const isDemo = String(escala?.id).startsWith('demo-')
  // um editor por vez: 'sala' | 'cirurgiao' | 'residente' | 'tempo' | null
  const [editor, setEditor] = useState(null)
  const [rascSala, setRascSala] = useState('')
  const [salaOutro, setSalaOutro] = useState(false)
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [cirurgiaoOutro, setCirurgiaoOutro] = useState(false)
  const [salvando, setSalvando] = useState('')
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

  // Cirurgiões JÁ NA ESCALA do dia: não existe cadastro de cirurgião no app (o
  // "Adicionar caso" pede texto livre), então a lista do dia é o que evita
  // grafias divergentes para a mesma pessoa. "Outro" segue aceitando um nome novo.
  const opcoesCirurgiao = useMemo(
    () => unicos((escala?.casos || []).map((c) => String(c.cirurgiao || '').trim()).filter(Boolean)),
    [escala]
  )

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
      setCirurgiaoOutro(!!atual && !opcoesCirurgiao.some((s) => s.toLowerCase() === atual.toLowerCase()))
    }
    setEditor((e) => (e === qual ? null : qual))
  }

  /** Grava um campo de texto do caso (sala/cirurgião) e fecha o editor. */
  const salvarTexto = async (campo, valor) => {
    const novo = String(valor || '').trim()
    if (!novo || novo === String(vivo[campo] || '')) { setEditor(null); return }
    setSalvando(campo)
    try {
      await atualizarCaso(escala, vivo.id, { [campo]: novo })
      setEditor(null)
    } catch { /* toast de erro já vem do context */ } finally { setSalvando('') }
  }

  // RESIDENTE do caso (dono 29/07): acompanha, NÃO responde pelo caso — por isso é
  // seletor próprio e não entra em nenhum caminho de anestesista. Grava uid + nome
  // de exibição, como já é feito com anestesista/anestesistaUserId: com o uid, a aba
  // "Minhas" do residente passa a mostrar os casos dele.
  const residenteNome = vivo.residente
    || (vivo.residenteUserId && residenteByUid.get(vivo.residenteUserId)?.nome)
    || ''
  const trocarResidente = async (valor) => {
    const r = valor === SEM_RESIDENTE ? null : residenteByUid.get(valor)
    if (valor !== SEM_RESIDENTE && !r) return
    setSalvando('residente')
    try {
      await atualizarCaso(escala, vivo.id, {
        residente: r ? r.nome : null,
        residenteUserId: r ? r.uid : null,
      })
      setEditor(null)
    } catch { /* toast de erro já vem do context */ } finally { setSalvando('') }
  }

  // TÉRMINO PREVISTO DESTA CIRURGIA (dono 29/07). É o tempo do CASO — o "quanto
  // falta para a pessoa sair" continua sendo o cronômetro da linha, nas Liberações.
  // Este sheet é o mesmo nas duas abas, então preencher aqui atende as duas.
  const definirTerminoCaso = async (hhmm) => {
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
    setHoraExata('')
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
  const alternarAjuda = async () => {
    setSalvando('ajuda')
    try {
      if (entradaAjuda) await removerAjuda(escala, turnoCaso, entradaAjuda)
      else await adicionarAjuda(escala, turnoCaso, nomeAnest)
    } catch { /* toast de erro já vem do context */ } finally { setSalvando('') }
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
        {/* CABEÇALHO — identidade do caso, em leitura. O procedimento é o título
            (é qual cirurgia que se procura primeiro) e QUEBRA em vez de truncar. */}
        <SheetHeader>
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
          <SheetTitle className="text-[15px] font-extrabold leading-tight [overflow-wrap:anywhere]">
            {vivo.procedimento || salaExibicao(vivo.sala)}
          </SheetTitle>
          {(vivo.pacienteIniciais || vivo.idade || vivo.tempoEstimado) && (
            <p className="text-[11.5px] text-muted-foreground">
              {[vivo.pacienteIniciais, idadeCurta(vivo.idade), vivo.tempoEstimado && `previsto ${vivo.tempoEstimado}`]
                .filter(Boolean).join(' · ')}
            </p>
          )}
        </SheetHeader>

        <div className="px-1 pb-4">
          {/* ── ANDAMENTO + AVISO: os dois eixos, rotulados e separados ────── */}
          {!isDemo && vivo.id && (
            <>
              <Rotulo>Andamento</Rotulo>
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

              <Rotulo className="mt-2.5">Aviso</Rotulo>
              <div className="flex gap-1.5">
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
            </>
          )}

          {/* ── EQUIPE: quem está nesta cirurgia ───────────────────────────── */}
          <Rotulo className="mt-3">Equipe</Rotulo>
          {/* CIRURGIÃO editável (dono 17/08): o nome vem da importação e sai
              torto com alguma frequência; era o único dado da cirurgia sem
              conserto no app — só o campo de EXIBIÇÃO da fila, que não corrige
              o caso nem o quadro. Grava em `cirurgiao`, o mesmo campo que o
              "Adicionar caso" já preenche, então Completa, Minhas e o
              automático da fila acompanham juntos. */}
          <LinhaDado
            icone={<Stethoscope className="h-3.5 w-3.5" />}
            rotulo="Cirurgião"
            valor={titleCaseNome(vivo.cirurgiao)}
            acao={podeEditarCaso && { label: 'Trocar', onClick: () => abrirEditor('cirurgiao') }}
          />
          {editor === 'cirurgiao' && (
            <EditorTexto
              titulo="Cirurgião desta cirurgia"
              opcoes={opcoesCirurgiao}
              sentinela={CIRURGIAO_OUTRO}
              outro={cirurgiaoOutro}
              setOutro={setCirurgiaoOutro}
              valor={rascCirurgiao}
              setValor={setRascCirurgiao}
              placeholderSelect="Escolha o cirurgião"
              placeholderInput="ex.: Eduardo Baldissera"
              nota="Vale só para esta cirurgia. A fila mostra o cirurgião de cada caso automaticamente."
              salvando={salvando === 'cirurgiao'}
              onCancelar={() => setEditor(null)}
              onSalvar={() => salvarTexto('cirurgiao', rascCirurgiao)}
            />
          )}

          <LinhaDado
            icone={<UserCog className="h-3.5 w-3.5" />}
            rotulo="Anestesista"
            valor={vivo.anestesista}
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
          {editor === 'residente' && (
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
              <Select
                id="caso-residente"
                className="w-full"
                searchable
                options={[{ value: SEM_RESIDENTE, label: 'Sem residente' }, ...opcoesResidente]}
                value={vivo.residenteUserId || SEM_RESIDENTE}
                onChange={trocarResidente}
                placeholder="Selecionar residente…"
              />
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                {salvando === 'residente' && <Loader2 className="h-3 w-3 animate-spin" />}
                Acompanha o caso — quem responde por ele continua sendo o anestesista.
              </p>
            </div>
          )}

          {podeMarcarAjuda && (
            <>
              <button
                type="button"
                disabled={salvando === 'ajuda'}
                onClick={alternarAjuda}
                aria-pressed={!!entradaAjuda}
                aria-label={entradaAjuda
                  ? `${titleCaseNome(nomeAnest)} não é ajuda de outro hospital`
                  : `Marcar ${titleCaseNome(nomeAnest)} como ajuda de outro hospital`}
                className="flex min-h-[48px] w-full items-center gap-2 border-b border-border py-2 text-left"
              >
                <span className="text-[15px] font-semibold">Ajuda de outro hospital</span>
                <span className="ml-auto flex items-center gap-2">
                  {salvando === 'ajuda' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Entra ao fim da fila de liberação — primeiro a ser liberado.
              </p>
            </>
          )}

          {/* ── TEMPO DESTA CIRURGIA ───────────────────────────────────────── */}
          {podeEditarCaso ? (
            <>
              <Rotulo className="mt-3"><Timer className="h-3.5 w-3.5" /> Tempo desta cirurgia</Rotulo>
              <button
                type="button"
                onClick={() => setEditor((e) => (e === 'tempo' ? null : 'tempo'))}
                className="flex min-h-[48px] w-full items-center gap-2 border-b border-border py-2 text-left"
              >
                {vivo.terminoPrevisto ? (
                  <>
                    <span className="text-[15px] font-bold tabular-nums">{vivo.terminoPrevisto}</span>
                    {faltaTermino && (
                      <span className={['text-[12.5px]', faltaTermino.atrasada ? 'font-medium text-warning' : 'text-muted-foreground'].join(' ')}>
                        {faltaTermino.atrasada
                          ? `${faltaTermino.texto.replace('+', '')} além`
                          : `faltam ${faltaTermino.texto.replace('~', '')}`}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Definir término</span>
                )}
                <span className="ml-auto text-muted-foreground">{editor === 'tempo' ? '▴' : '▾'}</span>
              </button>
              {editor === 'tempo' && (
                <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
                  <PainelTempo
                    atual={vivo.terminoPrevisto || ''}
                    horaExata={horaExata}
                    onHoraExata={setHoraExata}
                    onDefinir={definirTerminoCaso}
                  />
                  {/* TÉRMINO, não "tempo faltante": o campo guarda uma HORA, e
                      "tempo faltante" é o nome do OUTRO campo — o da pessoa, na
                      fila. Os dois disputavam a mesma palavra. */}
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    Só desta cirurgia. Na fila conta o tempo enquanto está Iniciada.
                  </p>
                </div>
              )}
            </>
          ) : vivo.terminoPrevisto && (
            <>
              <Rotulo className="mt-3"><Timer className="h-3.5 w-3.5" /> Tempo desta cirurgia</Rotulo>
              <p className="py-2 text-[15px] font-bold tabular-nums">{vivo.terminoPrevisto}</p>
            </>
          )}

          {/* ── O RARO POR ÚLTIMO: corrigir ONDE o caso acontece (dono 24/07) ─ */}
          {podeEditarCaso && (
            <div className="mt-3.5">
              <Button size="sm" variant="outline" className="w-full" onClick={() => abrirEditor('sala')}>
                <MapPin className="w-4 h-4" /> Mudar de sala/local
              </Button>
              {editor === 'sala' && (
                <EditorTexto
                  titulo="Sala / Local do procedimento"
                  opcoes={opcoesSala}
                  sentinela={SALA_OUTRO}
                  outro={salaOutro}
                  setOutro={setSalaOutro}
                  valor={rascSala}
                  setValor={setRascSala}
                  placeholderSelect="Escolha a sala/local"
                  placeholderInput="ex.: IOSC - Sala 1"
                  salvando={salvando === 'sala'}
                  onCancelar={() => setEditor(null)}
                  onSalvar={() => salvarTexto('sala', rascSala)}
                />
              )}
            </div>
          )}
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
    <div className="flex min-h-[48px] items-center gap-2.5 border-b border-border py-2">
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
 * Editor inline de um campo de texto com lista de sugestões + "Outro… (digitar)".
 * Mesmo padrão nos dois campos que o usam (sala e cirurgião) — os dois vêm da
 * importação e são corrigidos do mesmo jeito.
 */
function EditorTexto({
  titulo, opcoes, sentinela, outro, setOutro, valor, setValor,
  placeholderSelect, placeholderInput, nota, salvando, onCancelar, onSalvar,
}) {
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <Select
        className="w-full"
        searchable
        options={[...opcoes.map((s) => ({ value: s, label: s })), { value: sentinela, label: 'Outro… (digitar)' }]}
        value={outro ? sentinela : valor}
        onChange={(v) => {
          if (v === sentinela) { setOutro(true); setValor('') }
          else { setOutro(false); setValor(v) }
        }}
        placeholder={placeholderSelect}
      />
      {outro && (
        <Input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={placeholderInput}
          onKeyDown={(e) => { if (e.key === 'Enter') onSalvar() }}
        />
      )}
      {nota && <p className="text-[11.5px] text-muted-foreground">{nota}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" className="flex-1" disabled={salvando || !String(valor || '').trim()} onClick={onSalvar}>
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
