/**
 * TrocaSheet — o ÚNICO fluxo de troca do app (dono 07/08: "as trocas num só
 * local, fáceis de executar e intuitivas").
 *
 * ⚠️ A ORIGEM É CONFIRMADA, NUNCA ASSUMIDA (dono 09/08). A escala às vezes é
 * publicada JÁ com os nomes trocados de posição — foi o caso das escalas de
 * 10/08 pela manhã (Garim publicado no lugar do Rafael na Unimed e Rafael no
 * lugar do Garim no HRO). Ler o rodapé e supor que o nome achado marca a
 * posição de ORIGEM inverte a troca: o app devolve cada um ao hospital de onde
 * saiu. Por isso o sheet pergunta de qual posição cada um SAI — com a opção
 * "não sai daqui" para quem a escala já publicou no lugar certo — e só libera a
 * execução depois da resposta dos dois lados (responder um só produziria meio
 * swap, o defeito D4).
 *
 * Escolhido o colega, o plano roda em MODO SECO (planoExecucaoTroca é puro —
 * nada é escrito) e o tipo é INFERIDO pela geografia dos slots CONFIRMADOS:
 *   - os dois com posição em hospitais diferentes → "Troca entre hospitais"
 *   - os dois no mesmo hospital → "Troca de posições"
 *   - posições em turnos diferentes → "Troca entre turnos"
 *   - só UM com posição → "Colega de fora assume" (caso Paulo→Guilherme, que
 *     em 04/08 precisou de migration manual por falta deste caminho)
 * O tipo pré-selecionado é corrigível (é REGISTRO, não mecânica: a mecânica
 * segue o plano); o motivo é texto curto opcional. Ambos viajam DENTRO de
 * assumidaPor (jsonb — sem migration) e o trigger de eventos os audita de graça.
 *
 * "Trocar agora" executa DIRETO (assumidaPor, swap simultâneo com rollback),
 * sem passar por trocaCom. "Declarar para depois" SAIU (dono 09/08: "não
 * entendi a funcionalidade desse botão"): par declarado só nasce da conferência
 * da importação, que o executa sozinha ao publicar. ordem_liberacao NUNCA é
 * escrita — a identidade do slot muda via linha_overrides (invariante de 30/07).
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

/** valor da escolha "esta pessoa não sai de lugar nenhum" (escala já veio trocada) */
const NENHUMA = 'nenhuma'
const ladoId = (l) => `${l.escalaId}:${l.chaveSlot}`
const turnoCurto = (t) => (t === 'matutino' ? 'manhã' : t === 'vespertino' ? 'tarde' : '')
const curto = (nome) => nomeCirurgiaoCurto(titleCaseNome(nome)) || nome

/** Infere o tipo pela GEOGRAFIA dos slots do plano (taxonomia do dono 07/08). */
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

/** Chip selecionável — 44px de toque, estado visível (o par outline/plain de
 *  antes não parecia clicável: "essas informações estão muito escondidas"). */
function Chip({ ativo, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={[
        'min-h-11 rounded-full border px-3 text-xs font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ativo
          ? 'border-transparent bg-category-indigo text-white'
          : 'border-border-strong bg-card text-foreground active:opacity-70',
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

export default function TrocaSheet({ linha, turno, onClose }) {
  const { user } = useUser()
  const { escalas } = useEscalaCirurgica()
  const { executarSubstituicao } = useEscalaCirurgicaActions()
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
  const [origem, setOrigem] = useState({}) // 'a' | 'b' → ladoId | NENHUMA
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const b = useMemo(() => {
    const r = uidColega ? rosterByUid.get(uidColega) : null
    if (!r) return null
    return { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || String(r.nome).trim().split(/\s+/)[0]?.toUpperCase() || '' }
  }, [uidColega, rosterByUid])

  // PLANO EM MODO SECO — nada é escrito aqui; é o CARDÁPIO de posições possíveis
  const plan = useMemo(
    () => (b ? planoExecucaoTroca({ escalas, resolverUid: resolver, a, b, turno }) : null),
    [escalas, resolver, a, b, turno],
  )

  // posições de cada um, para a CONFIRMAÇÃO da origem (o app propõe, quem está
  // na escala decide — a escala pode já ter vindo trocada)
  const pessoas = useMemo(() => {
    const ehDe = (l, p) => (p.uid ? l.de.uid === p.uid : !l.de.uid && l.de.nome === p.nome)
    return [['a', a], ['b', b]]
      .filter(([, p]) => p)
      .map(([id, pessoa]) => ({ id, pessoa, lados: (plan?.lados || []).filter((l) => ehDe(l, pessoa)) }))
  }, [plan, a, b])

  const ladosEfetivos = pessoas
    .map(({ id, lados }) => lados.find((l) => ladoId(l) === origem[id]) || null)
    .filter(Boolean)
  // responder por um lado só e executar = meio swap em silêncio (defeito D4)
  const faltaConfirmar = pessoas.some(({ id, lados }) => lados.length > 0 && !origem[id])
  const podeExecutar = ladosEfetivos.length > 0 && !faltaConfirmar

  const tipoInferido = inferirTipoTroca({ lados: ladosEfetivos })
  const tipoEfetivo = tipo || tipoInferido

  const meta = { ...(tipoEfetivo && { tipo: tipoEfetivo }), ...(motivo.trim() && { motivo: motivo.trim().slice(0, MOTIVO_MAX) }) }
  const userInfo = { userId: user?.uid || user?.id || null, userName: user?.displayName }

  const trocarAgora = async () => {
    if (!podeExecutar || salvando) return
    setSalvando(true)
    try {
      await executarSubstituicao({
        lados: ladosEfetivos.map((l) => ({ ...l, ...meta })),
        limparTroca: plan?.limparTroca || [],
      }, userInfo)
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
              onChange={(v) => { setUidColega(v); setTipo(null); setOrigem({}) }}
              placeholder="Escolha o colega"
            />
          </div>

          {b && (
            <>
              {/* ── ORIGEM CONFIRMADA (dono 09/08) — a posição escolhida é a que
                  MUDA DE DONO. Sem pré-seleção de propósito: a escala pode ter
                  sido publicada já com os nomes trocados e aí não há o que fazer. */}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">De onde cada um sai?</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  A escala pode ter sido publicada já com os nomes trocados. Marque a posição que cada um DEIXA —
                  quem a escala já publicou no lugar certo fica com “não sai daqui”.
                </p>
                <div className="space-y-2.5">
                  {pessoas.map(({ id, pessoa, lados }) => (
                    <div key={id}>
                      <p className="mb-1 text-sm font-semibold">{curto(pessoa.nome)}</p>
                      {lados.length === 0 ? (
                        <p className="text-xs text-warning">Não está no rodapé de nenhuma escala carregada — não tem posição a deixar.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {lados.map((l) => (
                            <Chip key={ladoId(l)} ativo={origem[id] === ladoId(l)} onClick={() => setOrigem((o) => ({ ...o, [id]: ladoId(l) }))}>
                              {HOSPITAL_LABEL[l.hospital] || l.hospital}
                              {l.turno ? ` · ${turnoCurto(l.turno)}` : ''}
                            </Chip>
                          ))}
                          <Chip ativo={origem[id] === NENHUMA} onClick={() => setOrigem((o) => ({ ...o, [id]: NENHUMA }))}>
                            Não sai daqui
                          </Chip>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* tipo INFERIDO pela geografia dos slots confirmados — pré-selecionado,
                  corrigível. É registro (auditoria/card); a mecânica segue o plano. */}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo da troca</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                    <button
                      key={valor} type="button"
                      onClick={() => setTipo(valor)}
                      aria-pressed={tipoEfetivo === valor}
                      className={[
                        'flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-medium leading-tight',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        tipoEfetivo === valor
                          ? 'border-transparent bg-category-indigo text-white'
                          : 'border-border-strong bg-card text-foreground active:opacity-70',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Sugerido pelas posições marcadas; corrija se não for esse. Serve de registro — quem manda no efeito é o resumo abaixo.</p>
              </div>

              {/* resumo do EFEITO, derivado das posições CONFIRMADAS */}
              {podeExecutar ? (
                <ul className="space-y-1 rounded-xl border border-category-indigo/40 bg-category-indigo/10 p-2.5 text-sm">
                  {ladosEfetivos.map((l) => (
                    <li key={ladoId(l)}>
                      <b>{curto(l.para.nome)}</b> assume a posição de {titleCaseNome(l.nomeSlot)} —{' '}
                      {HOSPITAL_LABEL[l.hospital] || l.hospital}
                      {l.turno ? ` (${turnoCurto(l.turno)})` : ''}
                      {l.casoIds.length ? ` · herda ${l.casoIds.length} caso${l.casoIds.length === 1 ? '' : 's'}` : ''}
                    </li>
                  ))}
                </ul>
              ) : faltaConfirmar ? (
                <p className="rounded-xl bg-muted p-2.5 text-sm text-muted-foreground">
                  Marque de onde cada um sai para ver o que a troca vai fazer.
                </p>
              ) : plan.lados.length ? (
                <p className="rounded-xl bg-muted p-2.5 text-sm text-muted-foreground">
                  Nada a executar: a escala já está com cada um na posição certa.
                </p>
              ) : (
                <p className="rounded-xl bg-warning/10 p-2.5 text-sm text-warning">
                  Nenhum dos dois tem posição publicada — não há o que trocar na fila.
                  Para repassar casos, use o Definir anestesista da sala.
                </p>
              )}
              {/* pendência de vínculo: a posição troca, os casos não — aparece
                  ANTES de executar, nunca meio swap calado (defeito D4) */}
              {plan.pendencias.filter((p) => p.motivo === 'sem_uid').map((p) => (
                <p key={p.pessoa.uid || p.pessoa.nome} className="text-xs text-warning">
                  {curto(p.pessoa.nome)} está sem vínculo de login — a posição troca, mas os casos não (vincule pelo 🔗).
                </p>
              ))}

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo (opcional)</p>
                <Input
                  value={motivo} maxLength={MOTIVO_MAX}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="ex.: plantão trocado, compromisso pessoal"
                />
              </div>

              <div className="space-y-1.5">
                <Button className="w-full" disabled={!podeExecutar || salvando} onClick={trocarAgora}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                  Trocar agora
                </Button>
                <p className="text-xs text-muted-foreground">
                  Executa de vez: posição na fila e casos em aberto, os dois lados juntos.
                  Dá para desfazer pelo ✏️ da linha.
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
