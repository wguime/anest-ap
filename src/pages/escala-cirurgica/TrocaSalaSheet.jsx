/**
 * TrocaSalaSheet — troca de sala DIRETA entre anestesistas (decisão do dono
 * 2026-07-22: o fluxo propor→aceitar era engessado no dia a dia). Um toque
 * aplica o swap; os DOIS envolvidos recebem notificação e a aba Minhas mostra
 * o aviso da troca aplicada. Anestesista troca a PRÓPRIA sala; coordenador
 * (secretária/admin) troca qualquer uma.
 *
 * Identidade: a escala real pode ser publicada SEM uid nos casos (secretária não
 * atribuiu logins). Aqui o uid é resolvido pelo dicionário de apelidos e gravado
 * de volta nos casos (backfill) antes do swap — a RPC casa as linhas por
 * anestesista_user_id.
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Input, Button } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { anestesistaDaSala, validarConflito, normNome } from './utils'

export default function TrocaSalaSheet({ escala, salaAtual, meuUid, podeAplicarDireto, onClose }) {
  const { trocarSala } = useEscalaCirurgicaActions()
  const { resolver } = useRosterAnestesistas()
  const [salaB, setSalaB] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const casos = useMemo(() => escala?.casos || [], [escala])

  // sala → { alias, uid }: uid direto do caso OU resolvido pelo dicionário.
  const infoDe = useMemo(() => (sala) => {
    const direto = anestesistaDaSala(casos, sala)
    const alias = direto.alias || casos.find((c) => c.sala === sala && c.anestesista)?.anestesista || ''
    const uid = direto.uid || (alias ? resolver(alias) : null)
    return { alias, uid }
  }, [casos, resolver])

  const { alias: aliasA, uid: uidA } = infoDe(salaAtual)

  const alvo = useMemo(() => {
    const vistas = new Set([salaAtual])
    const out = []
    for (const c of casos) {
      const sala = c.sala
      if (!sala || vistas.has(sala) || !String(c.anestesista || '').trim()) continue
      vistas.add(sala)
      const { alias, uid } = infoDe(sala)
      if (!alias) continue
      if (uid && uidA && uid === uidA) continue // mesma pessoa em 2 salas
      out.push({ sala, alias, uid })
    }
    return out
  }, [casos, salaAtual, uidA, infoDe])

  const opcoes = alvo.map((s) => ({ value: s.sala, label: `${s.sala} — ${s.alias}` }))
  const escolhido = alvo.find((s) => s.sala === salaB)

  // Erros em ordem de precedência (cada um explica exatamente o que falta)
  const naoVinculado = !uidA ? aliasA : escolhido && !escolhido.uid ? escolhido.alias : null
  const erro = !aliasA
    ? 'Esta sala não tem anestesista.'
    : naoVinculado
      ? `Apelido "${naoVinculado}" sem login vinculado — atribua o anestesista no importador (a atribuição ensina o dicionário).`
      : !podeAplicarDireto && uidA !== meuUid
        ? 'Você só pode trocar a sua própria sala.'
        : escolhido
          ? validarConflito(casos, salaAtual, uidA, salaB, escolhido.uid)
          : null

  // Grava o uid resolvido nos casos que ainda não têm (identidade adotada).
  const backfillUid = async (sala, alias, uid) => {
    const pendentes = casos.filter((c) =>
      c.id && c.sala === sala && !c.anestesistaUserId && normNome(c.anestesista) === normNome(alias)
    )
    await Promise.all(pendentes.map((c) => svc.updateCaso(c.id, { anestesistaUserId: uid })))
  }

  const submeter = async () => {
    if (!escolhido || erro) return
    setLoading(true)
    try {
      await backfillUid(salaAtual, aliasA, uidA)
      await backfillUid(salaB, escolhido.alias, escolhido.uid)
      const payload = { salaA: salaAtual, uidA, aliasA, salaB, uidB: escolhido.uid, aliasB: escolhido.alias, motivo }
      await trocarSala(escala, payload, { userId: meuUid }) // direta — sem etapa de aceite
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
            <span className="text-muted-foreground">Sala:</span>{' '}
            <span className="font-semibold">{salaAtual}</span> — {aliasA || '—'}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Trocar com a sala</label>
            <Select options={opcoes} value={salaB} onChange={setSalaB} placeholder="Selecionar sala/colega…" searchable />
          </div>
          {escolhido && !erro && (
            <p className="text-xs text-muted-foreground">
              Após a troca: {aliasA} cobre a <b>{salaB}</b> e {escolhido.alias} cobre a <b>{salaAtual}</b>.
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
              Trocar agora
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
