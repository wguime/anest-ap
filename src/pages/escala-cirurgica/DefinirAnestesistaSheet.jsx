/**
 * DefinirAnestesistaSheet — troca o RESPONSÁVEL (substitui o sistema de trocas,
 * aposentado 2026-07-23) em DOIS modos:
 *   - SALA (header da Completa): atinge SÓ os casos não terminados do
 *     responsável-BASE da sala (+ linhas herdadas "//"/vazias). Linha com
 *     anestesista PRÓPRIO fica de fora — lição 23/07: o update sala-inteira
 *     achatou o IOSC (multi-anestesista) p/ uma pessoa e dois anestesistas
 *     SUMIRAM da escala.
 *   - CASO (detalhe do caso): atinge só aquele caso — é o caminho p/ trocar
 *     uma linha específica de bloco multi (IOSC/Exames/Umanitá).
 * Completa/Liberações/Minhas derivam dos casos → atualizam juntas (realtime).
 */
import { useMemo, useState } from 'react'
import { Loader2, UserCog } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Switch } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { alvosTrocaResponsavel, anestesistaDaSala, filtrarPorTurno, salaExibicao, nomeAnestesistaExibicao, localizarSlotRodape } from './utils'

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

// Sentinela: "deixar sem anestesista" (valor impossível como uid).
const SEM_ANESTESISTA = '__sem__'

export default function DefinirAnestesistaSheet({ escala, sala, casosAlvo = null, turno = null, onClose }) {
  const { user } = useUser()
  const { setAnestesistaCasos, executarSubstituicao } = useEscalaCirurgicaActions()
  const { options: rosterOpcoes, rosterByUid, resolver, loading: rosterLoading } = useRosterAnestesistas()
  const [uidEscolhido, setUidEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [assumirPosicao, setAssumirPosicao] = useState(false)

  // MODO SALA opera SÓ no turno exibido (bug 31/07): a sala existe nos dois
  // turnos e o sheet consultava os casos do DIA INTEIRO — "Responsável atual"
  // mostrava o dono da MANHÃ com o board na tarde (CC-Sala 3: header
  // "Paulo + Guilherme", sheet "Aline"), e o repasse alcançaria caso
  // não-terminado do outro turno. Sem turno (chamada legada) = dia inteiro.
  const casosTurno = useMemo(() => filtrarPorTurno(escala?.casos || [], turno), [escala, turno])

  // casosAlvo explícito (grupo por anestesista / caso do detalhe) → alvos são
  // exatamente eles (não-terminados); senão modo SALA = TODOS os casos não-terminados
  // da sala NO TURNO (pedido do dono 24/07 — terminados mantêm quem os fez).
  const { alvos } = useMemo(() => {
    if (casosAlvo?.length) {
      return { alvos: casosAlvo.filter((c) => (c.statusCirurgia || 'agendada') !== 'terminada') }
    }
    return alvosTrocaResponsavel(casosTurno, sala)
  }, [casosTurno, sala, casosAlvo])

  const atual = useMemo(() => {
    const ref = casosAlvo?.[0]
    if (ref) {
      const alias = String(ref.anestesista || '').trim()
      return { alias, uid: ref.anestesistaUserId || (alias ? resolver(alias) : null) }
    }
    const direto = anestesistaDaSala(casosTurno, sala)
    const alias = direto.alias || casosTurno.find((c) => c.sala === sala && c.anestesista)?.anestesista || ''
    return { alias, uid: direto.uid || (alias ? resolver(alias) : null) }
  }, [casosTurno, sala, casosAlvo, resolver])

  // Nome mostrado = MESMA função do cabeçalho da sala na Completa (bug 29/07: o
  // cabeçalho vinha do cadastro e este texto vinha do alias importado, então
  // "Guilherme Staub" no cabeçalho e "Staub" aqui — o dono leu como duas pessoas).
  const nomeAtual = useMemo(
    () => nomeAnestesistaExibicao({ uid: atual.uid, alias: atual.alias, rosterByUid }),
    [atual, rosterByUid]
  )

  // "Sem anestesista" (pedido do dono 26/07): deixar a sala/caso descoberto de
  // propósito — vira "?" e volta ao alerta das Liberações, onde alguém assume.
  const opcoes = useMemo(
    () => [{ value: SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...(rosterOpcoes || [])],
    [rosterOpcoes]
  )
  const jaSemAnestesista = !!alvos.length && alvos.every((c) => c.semAnestesista)
  // SEM PERGUNTA PRÉVIA (dono 29/07, revisão da noite): o sheet vai DIRETO ao
  // seletor, com rótulo afirmativo em vez de "trocar? sim/não" — um passo a menos
  // no meio do plantão.
  // O seletor nasce VAZIO quando já existe responsável: repetir o nome de quem
  // está lá, com "Confirmar" desabilitado, era o botão morto do print de 29/07.
  const escolhido = uidEscolhido || (jaSemAnestesista ? SEM_ANESTESISTA : '')
  const casoUnico = casosAlvo?.length === 1 ? casosAlvo[0] : null
  // afirmação, não pergunta — e nomeia o alvo (sala ou caso)
  const rotuloAcao = casoUnico
    ? 'Trocar anestesista deste caso:'
    : `Trocar anestesista da ${salaExibicao(sala)}:`
  const titulo = casosAlvo?.length
    ? (casoUnico ? 'Anestesista deste caso' : 'Anestesista do grupo')
    : 'Anestesista da sala'
  const rotulo = casoUnico
    ? `${salaExibicao(sala)}${casoUnico.cirurgiao ? ` · ${nomeCirurgiaoCurto(casoUnico.cirurgiao)}` : ''}`
    : `${salaExibicao(sala)}${casosAlvo?.length && atual.alias ? ` — ${nomeAtual}` : ''} (${alvos.length} caso${alvos.length === 1 ? '' : 's'})`

  // POSIÇÃO NA FILA (dono 30/07): quando o responsável ANTERIOR ocupa posição no
  // rodapé, definir um novo responsável pode herdar também a posição — foi o
  // buraco do caso Giovana↔Maurício (ela assumiu os casos e virou linha extra
  // "primeira a ser liberada" em vez de ocupar a posição dele). O toggle escreve
  // `assumidaPor` no slot (a ordem_liberacao NUNCA é escrita) JUNTO da troca de
  // casos — os dois efeitos ou nenhum (executarSubstituicao compensa falha).
  const slotAnterior = useMemo(() => {
    if (!atual.uid && !atual.alias) return null
    const r = atual.uid ? rosterByUid.get(atual.uid) : null
    return localizarSlotRodape(escala, { uid: atual.uid, nome: r?.nome || atual.alias }, resolver)
  }, [escala, atual, rosterByUid, resolver])
  const ofereceAssumir = !!slotAnterior && !!escolhido && escolhido !== SEM_ANESTESISTA && escolhido !== atual.uid

  const confirmar = async () => {
    const semAnest = escolhido === SEM_ANESTESISTA
    const r = semAnest ? null : rosterByUid.get(escolhido)
    if (!semAnest && !r) return
    setSalvando(true)
    try {
      if (!semAnest && assumirPosicao && ofereceAssumir) {
        const rAtual = atual.uid ? rosterByUid.get(atual.uid) : null
        await executarSubstituicao({
          lados: [{
            hospital: escala.hospital, escalaId: escala.id,
            chaveSlot: slotAnterior.chave, nomeSlot: slotAnterior.nome,
            de: { uid: atual.uid || null, nome: rAtual?.nome || atual.alias, apelido: atual.alias || slotAnterior.nome },
            para: { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) },
            casoIds: alvos.map((c) => c.id).filter(Boolean),
          }],
          limparTroca: [],
        }, { userId: user?.uid || user?.id || null })
      } else {
        await setAnestesistaCasos(
          escala,
          alvos.map((c) => c.id),
          semAnest ? { uid: null, apelido: '?' } : { uid: r.uid, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) },
          { rotulo }
        )
      }
      onClose?.()
    } catch { /* toast de erro já vem do context */ } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCog className="w-4 h-4 shrink-0" /> {titulo}
          </SheetTitle>
          <p className="text-lg font-bold leading-tight text-foreground">{rotulo}</p>
        </SheetHeader>
        <div className="space-y-4 px-1 pb-6 pt-2">
          {atual.alias && (
            <p className="text-sm text-muted-foreground">
              Responsável atual: <b className="text-foreground">{nomeAtual}</b>
            </p>
          )}
          {/* AFIRMAÇÃO + SELETOR, sem passo de confirmação (dono 29/07, revisão da
              noite): "trocar? Não/Sim" custava um toque a mais no meio do plantão
              e não protegia de nada — a troca só acontece no "Confirmar" abaixo. */}
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">{rotuloAcao}</p>
            {rosterLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando roster…
              </p>
            ) : (
              <Select
                className="w-full"
                searchable
                options={opcoes}
                value={escolhido}
                onChange={setUidEscolhido}
                placeholder="Escolha o anestesista"
              />
            )}
          </div>
          {/* Posição na fila junto com os casos (dono 30/07): sem isto quem assume
              vira linha EXTRA no fim da fila — o caso Giovana↔Maurício. */}
          {ofereceAssumir && (
            <Switch
              checked={assumirPosicao}
              onChange={setAssumirPosicao}
              label={`Assumir também a posição de ${nomeAtual} na ordem de liberação`}
              size="sm"
            />
          )}
          <Button
            className="w-full"
            disabled={salvando || !escolhido || escolhido === atual.uid || !alvos.length}
            onClick={confirmar}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : (escolhido === SEM_ANESTESISTA ? 'Deixar sem anestesista' : 'Confirmar responsável')}
          </Button>
          {!alvos.length && (
            <p className="text-xs text-muted-foreground">
              Nada a trocar aqui: as cirurgias já terminaram e mantêm quem as fez.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
