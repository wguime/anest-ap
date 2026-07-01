/**
 * TrocaSalaSheet — propor (ou aplicar) troca de sala entre anestesistas.
 * Aberto na aba "Completa" a partir de uma sala. Coordenador (secretária/admin)
 * aplica direto; anestesista propõe e o colega aceita depois.
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Input, Button } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { anestesistaDaSala, salasComAnestesista, validarConflito } from './utils'

export default function TrocaSalaSheet({ escala, salaAtual, meuUid, podeAplicarDireto, onClose }) {
  const { propoTroca, aceitarTroca } = useEscalaCirurgicaActions()
  const [salaB, setSalaB] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const casos = useMemo(() => escala?.casos || [], [escala])
  const { uid: uidA, alias: aliasA } = anestesistaDaSala(casos, salaAtual)
  const alvo = useMemo(
    () => salasComAnestesista(casos).filter((s) => s.sala !== salaAtual && s.uid !== uidA),
    [casos, salaAtual, uidA]
  )
  const opcoes = alvo.map((s) => ({ value: s.sala, label: `${s.sala} — ${s.alias}` }))
  const escolhido = alvo.find((s) => s.sala === salaB)
  const erro = escolhido ? validarConflito(casos, salaAtual, uidA, salaB, escolhido.uid) : null

  const submeter = async () => {
    if (!escolhido || erro) return
    setLoading(true)
    try {
      const payload = { salaA: salaAtual, uidA, aliasA, salaB, uidB: escolhido.uid, aliasB: escolhido.alias, motivo }
      const troca = await propoTroca(escala, payload, { userId: meuUid })
      if (podeAplicarDireto && troca) await aceitarTroca(troca, { userId: meuUid })
      onClose?.()
    } catch { /* toast no context */ }
    finally { setLoading(false) }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Trocar sala
          </SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-4 space-y-3">
          <div className="rounded-lg bg-muted/40 p-2.5 text-sm">
            <span className="text-muted-foreground">Sua sala:</span>{' '}
            <span className="font-semibold">{salaAtual}</span> — {aliasA || '—'}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Trocar com a sala</label>
            <Select options={opcoes} value={salaB} onChange={setSalaB} placeholder="Selecionar sala/colega…" searchable />
          </div>
          {escolhido && !erro && (
            <p className="text-xs text-muted-foreground">
              Após a troca: você cobre a <b>{salaB}</b> e {escolhido.alias} cobre a <b>{salaAtual}</b>.
            </p>
          )}
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: compromisso pessoal" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={submeter} disabled={!escolhido || !!erro || loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              {podeAplicarDireto ? 'Aplicar troca' : 'Propor troca'}
            </Button>
          </div>
          {!uidA && <p className="text-xs text-warning">Esta sala não tem anestesista atribuído.</p>}
        </div>
      </SheetContent>
    </Sheet>
  )
}
