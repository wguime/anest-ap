/**
 * TrocaSheet — o ÚNICO fluxo de troca do app (dono 07/08: "as trocas num só
 * local, fáceis de executar e intuitivas").
 *
 * A pessoa A vem da linha de origem; escolhido o colega B, o sheet roda o
 * plano em MODO SECO (planoExecucaoTroca é puro — nada é escrito) e INFERE o
 * tipo da troca pela taxonomia do dono:
 *   - os dois com posição em hospitais diferentes → "Troca entre hospitais"
 *   - os dois no mesmo hospital → "Troca de posições"
 *   - posições em turnos diferentes → "Troca entre turnos"
 *   - só UM com posição → "Colega de fora assume" (caso Paulo→Guilherme, que
 *     em 04/08 precisou de migration manual por falta deste caminho)
 * O tipo pré-selecionado é corrigível (é REGISTRO, não mecânica: a mecânica
 * segue o plano); o motivo é texto curto opcional. Ambos viajam DENTRO de
 * trocaCom/assumidaPor (jsonb — sem migration) e o trigger de eventos os
 * audita de graça.
 *
 * "Trocar agora" executa DIRETO (assumidaPor, swap simultâneo com rollback),
 * sem passar por trocaCom — declarar+executar no mesmo ato geraria o ruído
 * troca_declarada+troca_desfeita+posicao_assumida no log. "Declarar para
 * depois" grava só o par (badge nos dois lados; executa-se pelo ✏️).
 * ordem_liberacao NUNCA é escrita — a identidade do slot muda via
 * linha_overrides (invariante de 30/07).
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Input, Badge } from '@/design-system'
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
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const b = useMemo(() => {
    const r = uidColega ? rosterByUid.get(uidColega) : null
    if (!r) return null
    return { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || String(r.nome).trim().split(/\s+/)[0]?.toUpperCase() || '' }
  }, [uidColega, rosterByUid])

  // PLANO EM MODO SECO — é a inferência e o preview; nada é escrito aqui
  const plan = useMemo(
    () => (b ? planoExecucaoTroca({ escalas, resolverUid: resolver, a, b, turno }) : null),
    [escalas, resolver, a, b, turno],
  )
  const tipoInferido = inferirTipoTroca(plan)
  const tipoEfetivo = tipo || tipoInferido
  const podeExecutar = !!plan?.lados?.length

  const meta = { ...(tipoEfetivo && { tipo: tipoEfetivo }), ...(motivo.trim() && { motivo: motivo.trim().slice(0, MOTIVO_MAX) }) }
  const userInfo = { userId: user?.uid || user?.id || null, userName: user?.displayName }

  const trocarAgora = async () => {
    if (!plan?.lados?.length || salvando) return
    setSalvando(true)
    try {
      await executarSubstituicao({
        lados: plan.lados.map((l) => ({ ...l, ...meta })),
        limparTroca: plan.limparTroca,
      }, userInfo)
      onClose?.()
    } catch { /* toast no context */ } finally { setSalvando(false) }
  }

  const declarar = async () => {
    if (!b || salvando) return
    setSalvando(true)
    try {
      await marcarTroca(escala, linha, { uid: b.uid, nome: b.nome, ...meta }, userInfo, turno)
      onClose?.()
    } catch { /* toast no context */ } finally { setSalvando(false) }
  }

  const nomeA = nomeCirurgiaoCurto(titleCaseNome(a.nome)) || a.nome

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-category-indigo-fg" /> Troca de {nomeA}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 pb-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trocou com quem?</p>
            <Select
              className="w-full" searchable
              options={rosterOpcoes.filter((o) => o.value !== a.uid)}
              value={uidColega} onChange={(v) => { setUidColega(v); setTipo(null) }}
              placeholder="Escolha o colega"
            />
          </div>

          {b && (
            <>
              {/* tipo INFERIDO pela geografia dos slots — pré-selecionado, corrigível.
                  É registro (auditoria/card); a mecânica segue o plano. */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                  <button
                    key={valor} type="button"
                    onClick={() => setTipo(valor)}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge
                      variant={tipoEfetivo === valor ? 'default' : 'outline'}
                      className={tipoEfetivo === valor ? 'border-transparent bg-category-indigo text-white' : ''}
                    >
                      {label}
                    </Badge>
                  </button>
                ))}
              </div>

              {/* preview do EFEITO, derivado do plano — mesmo texto em qualquer entrada */}
              {podeExecutar ? (
                <ul className="space-y-1 rounded-xl border border-category-indigo/40 bg-category-indigo/10 p-2.5 text-sm">
                  {plan.lados.map((l) => (
                    <li key={`${l.escalaId}-${l.chaveSlot}`}>
                      <b>{nomeCirurgiaoCurto(titleCaseNome(l.para.nome))}</b> assume a posição de{' '}
                      {titleCaseNome(l.nomeSlot)} — {HOSPITAL_LABEL[l.hospital] || l.hospital}
                      {l.turno ? ` (${l.turno === 'matutino' ? 'manhã' : 'tarde'})` : ''}
                      {l.casoIds.length ? ` · herda ${l.casoIds.length} caso${l.casoIds.length === 1 ? '' : 's'}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-warning/10 p-2.5 text-sm text-warning">
                  Nenhum dos dois tem posição publicada — não há o que trocar na fila.
                  Para repassar casos, use o Definir anestesista da sala.
                </p>
              )}
              {/* pendências do plano: o que falta aparece ANTES de executar —
                  nunca meio swap calado (defeito D4) */}
              {plan.pendencias.map((p) => (
                <p key={p.pessoa.uid || p.pessoa.nome} className="text-xs text-warning">
                  {p.motivo === 'sem_slot'
                    ? `${nomeCirurgiaoCurto(titleCaseNome(p.pessoa.nome))} não tem posição publicada — este lado vale só para o outro.`
                    : `${nomeCirurgiaoCurto(titleCaseNome(p.pessoa.nome))} está sem vínculo de login — a posição troca, mas os casos não (vincule pelo 🔗).`}
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
                <Button variant="outline" className="w-full" disabled={salvando} onClick={declarar}>
                  Declarar para depois
                </Button>
                <p className="text-xs text-muted-foreground">
                  Trocar agora executa de vez: posição na fila e casos em aberto, os dois lados juntos.
                  Declarar só marca o par (badge nos dois lados) — executa-se pelo ✏️ quando valer.
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
