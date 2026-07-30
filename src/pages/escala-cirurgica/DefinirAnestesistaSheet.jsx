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
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { alvosTrocaResponsavel, anestesistaDaSala, salaExibicao, nomeAnestesistaExibicao } from './utils'

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

// Sentinela: "deixar sem anestesista" (valor impossível como uid).
const SEM_ANESTESISTA = '__sem__'

export default function DefinirAnestesistaSheet({ escala, sala, casosAlvo = null, onClose }) {
  const { setAnestesistaCasos } = useEscalaCirurgicaActions()
  const { options: rosterOpcoes, rosterByUid, resolver, loading: rosterLoading } = useRosterAnestesistas()
  const [uidEscolhido, setUidEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [trocando, setTrocando] = useState(false) // passou pela pergunta "trocar?"

  // casosAlvo explícito (grupo por anestesista / caso do detalhe) → alvos são
  // exatamente eles (não-terminados); senão modo SALA = TODOS os casos não-terminados
  // da sala (pedido do dono 24/07 — terminados mantêm quem os fez).
  const { alvos } = useMemo(() => {
    if (casosAlvo?.length) {
      return { alvos: casosAlvo.filter((c) => (c.statusCirurgia || 'agendada') !== 'terminada') }
    }
    return alvosTrocaResponsavel(escala?.casos, sala)
  }, [escala, sala, casosAlvo])

  const atual = useMemo(() => {
    const ref = casosAlvo?.[0]
    if (ref) {
      const alias = String(ref.anestesista || '').trim()
      return { alias, uid: ref.anestesistaUserId || (alias ? resolver(alias) : null) }
    }
    const direto = anestesistaDaSala(escala?.casos, sala)
    const alias = direto.alias || (escala?.casos || []).find((c) => c.sala === sala && c.anestesista)?.anestesista || ''
    return { alias, uid: direto.uid || (alias ? resolver(alias) : null) }
  }, [escala, sala, casosAlvo, resolver])

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
  // PERGUNTA ANTES DE TROCAR (dono 29/07): o sheet abria direto no seletor já
  // preenchido com quem está lá e o botão desabilitado — parecia que não fazia
  // nada. Agora confirma a intenção primeiro. Quando NÃO há responsável ainda
  // não há o que "trocar": é atribuição, e o seletor aparece direto.
  const precisaConfirmar = !!atual.alias && !trocando
  // com `trocando`, o seletor nasce VAZIO: repetir o nome de quem já está lá,
  // com Confirmar desabilitado, é o botão morto que o dono viu no print
  const escolhido = uidEscolhido || (trocando ? '' : (atual.uid || (jaSemAnestesista ? SEM_ANESTESISTA : '')))
  const casoUnico = casosAlvo?.length === 1 ? casosAlvo[0] : null
  const titulo = casosAlvo?.length
    ? (casoUnico ? 'Anestesista deste caso' : 'Anestesista do grupo')
    : 'Anestesista da sala'
  const rotulo = casoUnico
    ? `${salaExibicao(sala)}${casoUnico.cirurgiao ? ` · ${nomeCirurgiaoCurto(casoUnico.cirurgiao)}` : ''}`
    : `${salaExibicao(sala)}${casosAlvo?.length && atual.alias ? ` — ${nomeAtual}` : ''} (${alvos.length} caso${alvos.length === 1 ? '' : 's'})`

  const confirmar = async () => {
    const semAnest = escolhido === SEM_ANESTESISTA
    const r = semAnest ? null : rosterByUid.get(escolhido)
    if (!semAnest && !r) return
    setSalvando(true)
    try {
      await setAnestesistaCasos(
        escala,
        alvos.map((c) => c.id),
        semAnest ? { uid: null, apelido: '?' } : { uid: r.uid, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) },
        { rotulo }
      )
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
          {precisaConfirmar ? (
            <>
              <p className="text-sm text-foreground">
                Trocar o anestesista {casoUnico ? 'deste caso' : `desta sala (${alvos.length} caso${alvos.length === 1 ? '' : 's'})`}?
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onClose?.()}>Não</Button>
                <Button className="flex-1" disabled={!alvos.length} onClick={() => setTrocando(true)}>
                  Sim, trocar
                </Button>
              </div>
              {!alvos.length && (
                <p className="text-xs text-muted-foreground">
                  Nada a trocar aqui: as cirurgias já terminaram e mantêm quem as fez.
                </p>
              )}
            </>
          ) : (
            <>
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
              <Button
                className="w-full"
                disabled={salvando || !escolhido || escolhido === atual.uid || !alvos.length}
                onClick={confirmar}
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : (escolhido === SEM_ANESTESISTA ? 'Deixar sem anestesista' : 'Confirmar responsável')}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
