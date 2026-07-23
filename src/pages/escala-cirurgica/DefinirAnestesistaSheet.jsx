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
import { titleCaseNome, nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { alvosTrocaResponsavel, anestesistaDaSala, salaExibicao } from './utils'

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

export default function DefinirAnestesistaSheet({ escala, sala, casosAlvo = null, onClose }) {
  const { setAnestesistaCasos } = useEscalaCirurgicaActions()
  const { roster, rosterByUid, resolver, loading: rosterLoading } = useRosterAnestesistas()
  const [uidEscolhido, setUidEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)

  // casosAlvo explícito (grupo por anestesista / caso do detalhe) → alvos são
  // exatamente eles (não-terminados); senão modo SALA via alvosTrocaResponsavel.
  const { alvos, proprios } = useMemo(() => {
    if (casosAlvo?.length) {
      return { alvos: casosAlvo.filter((c) => (c.statusCirurgia || 'agendada') !== 'terminada'), proprios: [] }
    }
    return alvosTrocaResponsavel(escala?.casos, sala, null, resolver)
  }, [escala, sala, casosAlvo, resolver])

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

  const opcoes = useMemo(
    () => (roster || []).map((r) => ({ value: r.uid, label: titleCaseNome(r.nome) })),
    [roster]
  )
  const escolhido = uidEscolhido || atual.uid || ''
  const casoUnico = casosAlvo?.length === 1 ? casosAlvo[0] : null
  const titulo = casosAlvo?.length
    ? (casoUnico ? 'Anestesista deste caso' : 'Anestesista do grupo')
    : 'Anestesista da sala'
  const rotulo = casoUnico
    ? `${salaExibicao(sala)}${casoUnico.cirurgiao ? ` · ${nomeCirurgiaoCurto(casoUnico.cirurgiao)}` : ''}`
    : `${salaExibicao(sala)}${casosAlvo?.length && atual.alias ? ` — ${titleCaseNome(atual.alias)}` : ''} (${alvos.length} caso${alvos.length === 1 ? '' : 's'})`

  const confirmar = async () => {
    const r = rosterByUid.get(escolhido)
    if (!r) return
    setSalvando(true)
    try {
      await setAnestesistaCasos(
        escala,
        alvos.map((c) => c.id),
        { uid: r.uid, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) },
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
              Responsável atual: <b className="text-foreground">{titleCaseNome(atual.alias)}</b>
            </p>
          )}
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
          {/* modo sala: linhas com anestesista PRÓPRIO ficam de fora — transparência total */}
          {proprios.length > 0 && (
            <p className="rounded-lg bg-info/10 px-3 py-2 text-xs text-foreground/80">
              Não mudam (anestesista próprio):{' '}
              {proprios.map((c) => `${titleCaseNome(c.anestesista)}${c.cirurgiao ? ` (${nomeCirurgiaoCurto(c.cirurgiao)})` : ''}`).join(' · ')}
              {' '}— para trocar uma dessas linhas, abra o caso e use "Anestesista deste caso".
            </p>
          )}
          <Button
            className="w-full"
            disabled={salvando || !escolhido || escolhido === atual.uid || !alvos.length}
            onClick={confirmar}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar responsável'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
