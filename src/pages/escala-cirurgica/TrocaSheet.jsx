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
 * O tipo é INFERIDO pela geografia dos slots do par (entre_hospitais /
 * posicoes / entre_turnos / assuncao) e é corrigível — é REGISTRO, não
 * mecânica. Tipo e motivo viajam DENTRO do jsonb (sem migration; o trigger de
 * eventos audita de graça). ordem_liberacao NUNCA é escrita — a identidade do
 * slot muda via linha_overrides (invariante de 30/07).
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Input } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica, useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { planoExecucaoTroca } from './utils'

export const MOTIVO_MAX = 80

export const TIPO_LABEL = {
  entre_hospitais: 'Troca entre hospitais',
  posicoes: 'Troca de posições',
  entre_turnos: 'Troca entre turnos',
  assuncao: 'Colega de fora assume',
}
const TIPO_OPCOES = Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))

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

export default function TrocaSheet({ linha, escala, turno, onClose }) {
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

  const [uidColega, setUidColega] = useState('')
  const [tipo, setTipo] = useState(null) // null = usa o inferido
  const [escolha, setEscolha] = useState({}) // ladoId → 'fica' | 'assume'
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const b = useMemo(() => {
    const r = uidColega ? rosterByUid.get(uidColega) : null
    if (!r) return null
    return { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || String(r.nome).trim().split(/\s+/)[0]?.toUpperCase() || '' }
  }, [uidColega, rosterByUid])

  // PLANO EM MODO SECO — nada é escrito aqui; cada lado é uma POSIÇÃO em jogo
  const plan = useMemo(
    () => (b ? planoExecucaoTroca({ escalas, resolverUid: resolver, a, b, turno }) : null),
    [escalas, resolver, a, b, turno],
  )
  const slots = plan?.lados || []
  const faltaConfirmar = slots.some((l) => !escolha[ladoId(l)])
  const ladosEfetivos = slots.filter((l) => escolha[ladoId(l)] === 'assume')
  const temMovimento = ladosEfetivos.length > 0
  const semSlot = (plan?.pendencias || []).filter((p) => p.motivo === 'sem_slot')
  const semVinculo = (plan?.pendencias || []).filter((p) => p.motivo === 'sem_uid')

  const tipoEfetivo = tipo || inferirTipoTroca(plan)
  const meta = { ...(tipoEfetivo && { tipo: tipoEfetivo }), ...(motivo.trim() && { motivo: motivo.trim().slice(0, MOTIVO_MAX) }) }
  const userInfo = { userId: user?.uid || user?.id || null, userName: user?.displayName }

  const confirmar = async () => {
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
      onClose?.()
    } catch { /* toast no context */ } finally { setSalvando(false) }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-category-indigo-fg" /> Troca de {curto(a.nome)}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trocou com quem?</p>
            <Select
              className="w-full" searchable
              options={rosterOpcoes.filter((o) => o.value !== a.uid)}
              value={uidColega}
              onChange={(v) => { setUidColega(v); setTipo(null); setEscolha({}) }}
              placeholder="Escolha o colega"
            />
          </div>

          {b && (
            <>
              {/* ── UMA DECISÃO POR POSIÇÃO (dono 09–10/08) ────────────────────
                  Nada vem pré-marcado. Escala já publicada trocada = "fica" nas
                  duas, e o botão vira "Registrar troca". */}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quem fica com cada posição?</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Se a escala já saiu com os dois no lugar certo, deixe “fica” nas duas — a troca entra só como registro.
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
                        <p className="mb-2 text-xs text-muted-foreground">Posição de {titleCaseNome(l.nomeSlot)}</p>
                        <div className="flex gap-1.5">
                          <OpcaoSlot ativo={escolha[id] === 'fica'} onClick={() => setEscolha((e) => ({ ...e, [id]: 'fica' }))}>
                            {curto(l.de.nome)} fica
                          </OpcaoSlot>
                          <OpcaoSlot ativo={escolha[id] === 'assume'} onClick={() => setEscolha((e) => ({ ...e, [id]: 'assume' }))}>
                            {curto(l.para.nome)} assume
                          </OpcaoSlot>
                        </div>
                      </div>
                    )
                  })}

                  {semSlot.map((p) => (
                    <p key={p.pessoa.uid || p.pessoa.nome} className="text-xs text-muted-foreground">
                      {curto(p.pessoa.nome)} não está no rodapé de nenhuma escala carregada — não tem posição em jogo.
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
                  {temMovimento ? 'Trocar agora' : 'Registrar troca'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {faltaConfirmar
                    ? 'Marque quem fica com cada posição para liberar o botão.'
                    : temMovimento
                      ? 'Executa de vez: posição na fila e casos em aberto, os dois lados juntos. Dá para desfazer pelo ✏️ da linha.'
                      : 'Ninguém muda de lugar: entra só o registro — badge Troca nos dois, com o nome de quem trocou.'}
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
