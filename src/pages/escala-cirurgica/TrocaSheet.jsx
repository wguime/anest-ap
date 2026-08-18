/**
 * TrocaSheet — o ÚNICO fluxo de troca do app (dono 07/08: "as trocas num só
 * local, fáceis de executar e intuitivas").
 *
 * ⚠️ A DECISÃO É POR POSIÇÃO, e o app nunca a supõe (dono 09–10/08). A escala
 * costuma ser publicada JÁ com os nomes trocados: em 10/08 o Rafael (Unimed)
 * apareceu direto no rodapé do HRO e o Garim no da Unimed. Ler o rodapé e supor
 * que o nome achado marca a posição de ORIGEM invertia a troca — o app devolvia
 * cada um ao hospital de onde tinha saído. Por isso cada POSIÇÃO envolvida vira
 * um cartão com duas saídas explícitas ("fulano fica" / "sicrano assume") e o
 * botão principal muda conforme a resposta:
 *   - alguém assume a posição de alguém → "Trocar agora" (swap de verdade:
 *     assumidaPor + casos em aberto, os dois lados juntos, com rollback);
 *   - ninguém muda de lugar → "Registrar troca" (`trocaCom.apenasRegistro`):
 *     a escala já saiu certa e o que falta é o RASTRO — badge "Troca" nos dois
 *     e "Trocado com X" no card. É o caso Rafael⇄Garim de 10/08, que antes não
 *     tinha caminho nenhum na UI ("não consigo colocar o badge nos dois").
 * Registro NÃO é declaração pendente: a convergência da importação o ignora,
 * senão a próxima publicação executaria um swap que ninguém pediu.
 *
 * MODO POSIÇÃO (dono 18/08, caso Fernanda⇄Daniela): "a Daniela assumiu o plantão
 * mas ficou apenas o badge de troca — nesses casos quero que haja troca de
 * posição". É uma OPÇÃO PRÓPRIA da linha ("Trocar de posição na escala"), não uma
 * mudança nas outras modalidades: aqui a resposta já nasce "assume" em cada
 * posição em jogo, o botão é "Trocar posição" e um pop-up mostra o que muda na
 * fila antes de gravar. As demais trocas (entre hospitais à frente de todas)
 * seguem exatamente como estavam — registro por padrão, decisão por posição.
 *
 * O tipo é INFERIDO pela geografia dos slots do par (entre_hospitais /
 * posicoes / entre_turnos / assuncao) e é corrigível — é REGISTRO, não
 * mecânica. Tipo e motivo viajam DENTRO do jsonb (sem migration; o trigger de
 * eventos audita de graça). ordem_liberacao NUNCA é escrita — a identidade do
 * slot muda via linha_overrides (invariante de 30/07).
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Input, ConfirmDialog } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica, useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { planoExecucaoTroca, normNome } from './utils'

export const MOTIVO_MAX = 80

export const TIPO_LABEL = {
  entre_hospitais: 'Troca entre hospitais',
  posicoes: 'Troca de posições',
  entre_turnos: 'Troca entre turnos',
  assuncao: 'Colega de fora assume',
}
const TIPO_OPCOES = Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))

/** Onde o colega está quando não aparece em escala nenhuma do dia (dono 13/08:
 *  "o colega pode estar no consultório, Materno, e não há essas opções"). É só
 *  o RASTRO — nada a mover — mas é o que responde "cadê o Fulano" para quem lê
 *  a fila depois. Materno entra porque a escala de lá pode ainda não ter saído. */
export const LOCAL_COLEGA_OPCOES = [
  { value: 'Consultório', label: 'Consultório' },
  { value: 'Materno', label: 'Materno' },
  { value: 'Sobreaviso', label: 'Sobreaviso' },
  { value: 'Folga', label: 'Folga' },
  { value: 'Outro local', label: 'Outro local' },
]

const ladoId = (l) => `${l.escalaId}:${l.chaveSlot}`
const turnoCurto = (t) => (t === 'matutino' ? 'manhã' : t === 'vespertino' ? 'tarde' : '')
const curto = (nome) => nomeCirurgiaoCurto(titleCaseNome(nome)) || nome

/** Infere o tipo pela GEOGRAFIA dos slots do par (taxonomia do dono 07/08).
 *  Olha as posições que EXISTEM, não quem se move: numa troca já publicada
 *  ninguém muda de lugar e ainda assim é troca entre hospitais. */
export function inferirTipoTroca(plan) {
  const lados = plan?.lados || []
  if (!lados.length) return null
  if (lados.length === 1) return 'assuncao'
  const hospitais = new Set(lados.map((l) => l.hospital))
  if (hospitais.size > 1) return 'entre_hospitais'
  const turnos = new Set(lados.map((l) => l.turno).filter(Boolean))
  if (turnos.size > 1) return 'entre_turnos'
  return 'posicoes'
}

/** Uma das duas saídas de uma posição — 44px de toque, estado visível. */
function OpcaoSlot({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={[
        'flex min-h-11 flex-1 items-center justify-center rounded-xl border px-2 text-center text-xs font-medium leading-tight',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ativo
          ? 'border-transparent bg-category-indigo text-white'
          : 'border-border-strong bg-card text-foreground active:opacity-70',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function TrocaSheet({ linha, escala, turno, colegaInicial = null, modo = 'registro', onClose }) {
  const { user } = useUser()
  const { escalas } = useEscalaCirurgica()
  const { marcarTroca, executarSubstituicao } = useEscalaCirurgicaActions()
  const { options: rosterOpcoes, rosterByUid, resolver } = useRosterAnestesistas()

  // pessoa A = dona da linha de origem (uid do vínculo > resolução do rodapé)
  const a = useMemo(() => {
    const uid = linha?.uid || resolver(linha?.nomeOriginal || linha?.anestesista || '') || null
    const r = uid ? rosterByUid.get(uid) : null
    return {
      uid,
      nome: r?.nome || linha?.nomeOriginal || linha?.anestesista || '',
      apelido: r?.apelidos?.[0] || String(linha?.nomeOriginal || linha?.anestesista || '').trim().split(/\s+/)[0]?.toUpperCase() || '',
    }
  }, [linha, rosterByUid, resolver])

  // `colegaInicial` = reabertura a partir de uma troca JÁ registrada (o par já é
  // conhecido; o que falta decidir é a POSIÇÃO). As escolhas seguem em branco —
  // supor quem se move é o que invertia a troca em 10/08.
  const [uidColega, setUidColega] = useState(colegaInicial || '')
  const [tipo, setTipo] = useState(null) // null = usa o inferido
  const [escolha, setEscolha] = useState({}) // ladoId → 'fica' | 'assume'
  const [motivo, setMotivo] = useState('')
  const [local, setLocal] = useState('') // onde o colega está, quando não há escala dele
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false) // pop-up do swap (dono 18/08)

  const b = useMemo(() => {
    const r = uidColega ? rosterByUid.get(uidColega) : null
    if (!r) return null
    return { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || String(r.nome).trim().split(/\s+/)[0]?.toUpperCase() || '' }
  }, [uidColega, rosterByUid])

  // PLANO EM MODO SECO — nada é escrito aqui; cada lado é uma POSIÇÃO em jogo
  const plan = useMemo(
    // âncora = a escala de onde a troca foi aberta: a posição de `a` em jogo é
    // a DESTA tela (dono 13/08 — a Karine no Materno trazia junto o HRO)
    () => (b ? planoExecucaoTroca({ escalas, resolverUid: resolver, a, b, turno, escalaAncora: escala?.id || null }) : null),
    [escalas, resolver, a, b, turno, escala?.id],
  )
  const slots = plan?.lados || []
  // MODO POSIÇÃO: a resposta JÁ É "assume" — foi ela que o usuário escolheu ao
  // abrir esta opção. Derivada (não estado): sem efeito para sincronizar quando
  // o plano muda, e um toque em "fica" continua corrigindo cada posição.
  const modoPosicao = modo === 'posicao'
  const escolhaDe = (l) => escolha[ladoId(l)] || (modoPosicao ? 'assume' : null)
  const faltaConfirmar = slots.some((l) => !escolhaDe(l))
  const ladosEfetivos = slots.filter((l) => escolhaDe(l) === 'assume')
  const temMovimento = ladosEfetivos.length > 0
  const semSlot = (plan?.pendencias || []).filter((p) => p.motivo === 'sem_slot')
  const semVinculo = (plan?.pendencias || []).filter((p) => p.motivo === 'sem_uid')

  // O colega não está em lugar nenhum NO TURNO EXIBIDO (incidente 13/08: o Staub
  // fecha a manhã do HRO e passa a tarde no consultório — como ele aparecia no
  // rodapé da manhã, o campo de local sumia e não havia onde dizer para onde ele
  // tinha ido). O que interessa é o turno que está sendo registrado.
  const ehDoColega = (l) => (l.de.uid && b?.uid ? l.de.uid === b.uid : normNome(l.de.nome) === normNome(b?.nome || ''))
  const colegaSemEscala = !!b && !slots.some((l) => ehDoColega(l) && (!turno || l.turno === turno))

  // no modo posição o tipo já está respondido (é o que a opção significa)
  const tipoEfetivo = tipo || (modoPosicao ? 'posicoes' : inferirTipoTroca(plan))
  const meta = {
    ...(tipoEfetivo && { tipo: tipoEfetivo }),
    ...(motivo.trim() && { motivo: motivo.trim().slice(0, MOTIVO_MAX) }),
    ...(colegaSemEscala && local && { local }),
  }
  const userInfo = { userId: user?.uid || user?.id || null, userName: user?.displayName }

  const gravar = async () => {
    if (!b || faltaConfirmar || salvando) return
    setSalvando(true)
    try {
      if (temMovimento) {
        await executarSubstituicao({
          lados: ladosEfetivos.map((l) => ({ ...l, ...meta })),
          limparTroca: plan?.limparTroca || [],
        }, userInfo)
      } else {
        // ninguém muda de lugar: fica só o RASTRO (badge nos dois lados).
        // `apenasRegistro` impede que a convergência da importação execute
        // depois um swap que a própria escala já resolveu.
        await marcarTroca(escala, linha, { uid: b.uid, nome: b.nome, ...meta, apenasRegistro: true }, userInfo, turno)
      }
      setConfirmando(false)
      onClose?.()
    } catch { /* toast no context */ } finally { setSalvando(false) }
  }

  // POP-UP ANTES DE CONCLUIR (dono 18/08). Só quando alguém MUDA DE LUGAR: o
  // swap mexe na fila de liberação dos dois lados e leva as cirurgias em aberto
  // junto — é a hora de conferir se o app entendeu quem sai e quem entra.
  // Registro (ninguém se move) não pergunta: não há o que rever.
  const confirmar = async () => {
    if (!b || faltaConfirmar || salvando) return
    if (temMovimento) { setConfirmando(true); return }
    await gravar()
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-category-indigo-fg" />
            {modoPosicao ? `Trocar a posição de ${curto(a.nome)}` : `Troca de ${curto(a.nome)}`}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {modoPosicao ? 'Quem assume a posição?' : 'Trocou com quem?'}
            </p>
            <Select
              className="w-full" searchable
              options={rosterOpcoes.filter((o) => o.value !== a.uid)}
              value={uidColega}
              onChange={(v) => { setUidColega(v); setTipo(null); setEscolha({}); setLocal('') }}
              placeholder="Escolha o colega"
            />
          </div>

          {b && (
            <>
              {/* ── UMA DECISÃO POR POSIÇÃO (dono 09–10/08) ────────────────────
                  Nada vem pré-marcado. Escala já publicada trocada = "fica" nas
                  duas, e o botão vira "Registrar troca".
                  No MODO POSIÇÃO já nasce "assume" (é o que a opção quer dizer),
                  e os cartões seguem aqui para conferir e corrigir. */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {modoPosicao ? 'O que vai mudar na fila' : 'Quem fica com cada posição?'}
                </p>

                <div className="space-y-2">
                  {slots.map((l) => {
                    const id = ladoId(l)
                    return (
                      <div key={id} className="rounded-xl border border-border-strong bg-card p-2.5">
                        <div className="mb-0.5 flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {HOSPITAL_LABEL[l.hospital] || l.hospital}
                            {l.turno ? <span className="font-normal text-muted-foreground"> · {turnoCurto(l.turno)}</span> : null}
                          </p>
                          <p className="shrink-0 text-xs text-muted-foreground">
                            {l.casoIds.length ? `${l.casoIds.length} caso${l.casoIds.length === 1 ? '' : 's'}` : 'sem casos'}
                          </p>
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          {l.semPosicao
                            // Materno & afins: o hospital publica só as cirurgias,
                            // não há fila para herdar — quem assume leva os casos.
                            ? `Cirurgias de ${titleCaseNome(l.nomeSlot)} · sem fila de liberação`
                            : `Posição de ${titleCaseNome(l.nomeSlot)}`}
                        </p>
                        {/* o HOSPITAL vai no rótulo da opção (dono 10/08): lida
                            sozinha, "Fulano assume" não dizia assume ONDE */}
                        <div className="flex gap-1.5">
                          <OpcaoSlot ativo={escolhaDe(l) === 'fica'} onClick={() => setEscolha((e) => ({ ...e, [id]: 'fica' }))}>
                            {curto(l.de.nome)} fica {HOSPITAL_LABEL[l.hospital] || l.hospital}
                          </OpcaoSlot>
                          <OpcaoSlot ativo={escolhaDe(l) === 'assume'} onClick={() => setEscolha((e) => ({ ...e, [id]: 'assume' }))}>
                            {curto(l.para.nome)} assume {HOSPITAL_LABEL[l.hospital] || l.hospital}
                          </OpcaoSlot>
                        </div>
                      </div>
                    )
                  })}

                  {semSlot.map((p) => (
                    <p key={p.pessoa.uid || p.pessoa.nome} className="text-xs text-muted-foreground">
                      {curto(p.pessoa.nome)} não tem posição nem cirurgia nas escalas de hoje — a troca corre só
                      pelo lado de cá.
                    </p>
                  ))}
                  {semVinculo.map((p) => (
                    <p key={p.pessoa.uid || p.pessoa.nome} className="text-xs text-warning">
                      {curto(p.pessoa.nome)} está sem vínculo de login — a posição troca, mas os casos não (vincule pelo 🔗).
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                {colegaSemEscala && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Onde {curto(b.nome)} está {turno === 'matutino' ? 'de manhã' : 'à tarde'}
                    </p>
                    <Select
                      className="w-full"
                      options={LOCAL_COLEGA_OPCOES}
                      value={local}
                      onChange={setLocal}
                      placeholder="Consultório, Materno, folga…"
                    />
                  </div>
                )}
                {/* O tipo é a taxonomia do REGISTRO. No modo posição ele já está
                    respondido pela própria opção — perguntar de novo era ruído. */}
                {!modoPosicao && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo da troca</p>
                    <Select
                      className="w-full"
                      options={TIPO_OPCOES}
                      value={tipoEfetivo || ''}
                      onChange={(v) => setTipo(v)}
                      placeholder="Escolha o tipo"
                    />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo (opcional)</p>
                  <Input
                    value={motivo} maxLength={MOTIVO_MAX}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="ex.: plantão trocado, compromisso pessoal"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Button className="w-full" disabled={faltaConfirmar || salvando} onClick={confirmar}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                  {modoPosicao && temMovimento ? 'Trocar posição' : temMovimento ? 'Trocar agora' : 'Registrar troca'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {faltaConfirmar
                    ? 'Marque quem fica com cada posição para liberar o botão.'
                    : temMovimento
                      ? 'Pede confirmação antes de gravar: posição na fila e casos em aberto, os dois lados juntos. Dá para desfazer pelo ✏️ da linha.'
                      : 'Ninguém muda de lugar: entra só o registro — badge Troca nos dois, com o nome de quem trocou.'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* CONFIRMAÇÃO DO SWAP (dono 18/08). O resumo é literal — quem assume
            qual posição, onde, e quantas cirurgias vão junto — porque é a última
            tela antes de a fila de liberação mudar de dono para todo o grupo. */}
        <ConfirmDialog
          open={confirmando}
          onClose={() => { if (!salvando) setConfirmando(false) }}
          onConfirm={gravar}
          loading={salvando}
          title="Trocar as posições?"
          description="A fila de liberação passa a mostrar quem assumiu cada posição."
          confirmText="Confirmar troca"
          cancelText="Revisar"
          icon={<ArrowLeftRight className="h-11 w-11" />}
        >
          <ul className="space-y-2">
            {ladosEfetivos.map((l) => (
              <li key={ladoId(l)} className="rounded-xl border border-border-strong bg-card p-2.5">
                <p className="text-sm font-semibold leading-snug">
                  {curto(l.para.nome)} assume a posição de {curto(l.de.nome)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {HOSPITAL_LABEL[l.hospital] || l.hospital}
                  {l.turno ? ` · ${turnoCurto(l.turno)}` : ''}
                  {' · '}
                  {l.casoIds.length
                    ? `${l.casoIds.length} cirurgia${l.casoIds.length === 1 ? ' em aberto vai junto' : 's em aberto vão junto'}`
                    : 'nenhuma cirurgia muda de mãos'}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            A ordem publicada no rodapé não muda — o que muda é quem ocupa cada posição.
          </p>
        </ConfirmDialog>
      </SheetContent>
    </Sheet>
  )
}
