/**
 * DefinirAnestesistaSheet — define o RESPONSÁVEL pela sala (decisão do dono
 * 2026-07-23: o sistema de trocas foi APOSENTADO — "muito complexo e difícil").
 * Um Select do roster + confirmar: todos os casos NÃO terminados da sala passam
 * para o escolhido (apelido de exibição + uid). A Completa e as Liberações
 * DERIVAM dos casos — mudou aqui, as duas atualizam juntas, em todos os
 * aparelhos (realtime). Anestesista redefine a própria sala; coordenador
 * (secretária/admin) qualquer uma.
 */
import { useMemo, useState } from 'react'
import { Loader2, UserCog } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import { anestesistaDaSala, salaExibicao } from './utils'

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

export default function DefinirAnestesistaSheet({ escala, sala, onClose }) {
  const { setAnestesistaSala } = useEscalaCirurgicaActions()
  const { roster, rosterByUid, resolver, loading: rosterLoading } = useRosterAnestesistas()
  const [uidEscolhido, setUidEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)

  const atual = useMemo(() => {
    const direto = anestesistaDaSala(escala?.casos, sala)
    const alias = direto.alias || (escala?.casos || []).find((c) => c.sala === sala && c.anestesista)?.anestesista || ''
    return { alias, uid: direto.uid || (alias ? resolver(alias) : null) }
  }, [escala, sala, resolver])

  const opcoes = useMemo(
    () => (roster || []).map((r) => ({ value: r.uid, label: titleCaseNome(r.nome) })),
    [roster]
  )
  const escolhido = uidEscolhido || atual.uid || ''

  const confirmar = async () => {
    const r = rosterByUid.get(escolhido)
    if (!r) return
    setSalvando(true)
    try {
      await setAnestesistaSala(escala, sala, {
        uid: r.uid,
        apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome),
      })
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
            <UserCog className="w-4 h-4 shrink-0" /> Anestesista da sala
          </SheetTitle>
          <p className="text-lg font-bold leading-tight text-foreground">{salaExibicao(sala)}</p>
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
          <p className="text-xs text-muted-foreground">
            Os casos ainda não terminados desta sala passam para o escolhido — a
            Completa e as Liberações atualizam juntas, para todos.
          </p>
          <Button
            className="w-full"
            disabled={salvando || !escolhido || escolhido === atual.uid}
            onClick={confirmar}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar responsável'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
