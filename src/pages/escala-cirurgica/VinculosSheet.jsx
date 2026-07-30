/**
 * VinculosSheet — vincula os NOMES DE ESCALA (apelidos do rodapé/coluna ANEST,
 * ex.: GARIM, PED EDUARDO) ao login de cada anestesista. É o que habilita
 * identificação ("Minhas escalas"), troca de sala e NOTIFICAÇÕES por usuário.
 *
 * - Usuário comum: vê e edita apenas os PRÓPRIOS nomes (self-claim; RLS garante).
 * - Secretária/admin: gerencia os nomes de todo o roster + "Sugerir vínculos"
 *   (primeiro nome quando é único no roster — os ambíguos ficam manuais).
 */
import { useMemo, useState } from 'react'
import { Link2, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { Badge, Button, Input, Sheet, SheetContent, SheetHeader, SheetTitle, useToast } from '@/design-system'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { normApelido } from '@/services/supabaseEscalaAnestesistaService'

function LinhaUsuario({ r, aliases, canEdit, meu, onAdd, onRemove }) {
  const [novo, setNovo] = useState('')
  const meus = aliases.filter((a) => a.userId === r.uid)
  const add = async () => {
    const ap = normApelido(novo)
    if (!ap) return
    await onAdd(r.uid, ap)
    setNovo('')
  }
  return (
    <div className={['rounded-xl border p-2.5', meu ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'].join(' ')}>
      <p className="text-sm font-semibold">
        {r.nome}
        {meu && <Badge variant="secondary" badgeStyle="subtle" className="ml-1.5">você</Badge>}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {meus.length === 0 && (
          <span className="text-xs text-muted-foreground">sem nome vinculado — "Minhas escalas" não encontra os casos</span>
        )}
        {meus.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs font-medium">
            {a.apelido}
            {canEdit && (
              <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remover ${a.apelido}`}
                className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {canEdit && (
        <div className="mt-2 flex items-center gap-1.5">
          <Input value={novo} onChange={(e) => setNovo(e.target.value)}
            placeholder="ex.: GARIM ou PED EDUARDO"
            onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
          <Button size="sm" variant="outline" onClick={add} disabled={!novo.trim()} aria-label={`Adicionar nome para ${r.nome}`}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default function VinculosSheet({ meuUid, podeGerenciar, onClose }) {
  const { toast } = useToast()
  const { roster, aliases, loading, upsertAlias, removeAlias } = useRosterAnestesistas()
  const [busca, setBusca] = useState('')
  const [sugerindo, setSugerindo] = useState(false)

  const visiveis = useMemo(() => {
    const base = podeGerenciar ? roster : roster.filter((r) => r.uid === meuUid)
    const q = normApelido(busca)
    return q ? base.filter((r) => normApelido(r.nome).includes(q)) : base
  }, [roster, podeGerenciar, meuUid, busca])

  const onAdd = async (uid, apelido) => {
    try { await upsertAlias({ apelido, userId: uid, createdBy: meuUid }) }
    catch (e) { toast({ variant: 'error', title: 'Erro ao vincular', description: e.message }) }
  }
  const onRemove = async (id) => {
    try { await removeAlias(id) }
    catch (e) { toast({ variant: 'error', title: 'Erro ao remover', description: e.message }) }
  }

  // Sugestão automática: primeiro nome vira apelido quando é ÚNICO no roster e
  // o usuário ainda não tem nenhum vínculo. Ambíguos (2 Guilhermes) ficam manuais.
  const sugerir = async () => {
    setSugerindo(true)
    try {
      const contagem = new Map()
      for (const r of roster) {
        const pn = normApelido(r.nome.split(/\s+/)[0])
        contagem.set(pn, (contagem.get(pn) || 0) + 1)
      }
      const usados = new Set(aliases.map((a) => normApelido(a.apelido)))
      let criados = 0
      for (const r of roster) {
        if (aliases.some((a) => a.userId === r.uid)) continue
        const pn = normApelido(r.nome.split(/\s+/)[0])
        if (!pn || contagem.get(pn) !== 1 || usados.has(pn)) continue
        await upsertAlias({ apelido: pn, userId: r.uid, createdBy: meuUid })
        usados.add(pn); criados += 1
      }
      toast({ variant: 'success', title: `${criados} vínculo(s) sugerido(s)`, description: 'Nomes ambíguos ou compostos ficam manuais.' })
    } catch (e) {
      toast({ variant: 'error', title: 'Erro na sugestão', description: e.message })
    } finally { setSugerindo(false) }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="max-h-[90vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" /> {podeGerenciar ? 'Vínculos de nomes da escala' : 'Meus nomes na escala'}
          </SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-4 space-y-2.5">
          <p className="text-xs text-muted-foreground">
            O nome que aparece na escala (coluna ANEST/rodapé) precisa estar vinculado ao usuário
            para "Minhas escalas" e a fila de liberação reconhecerem a pessoa.
          </p>
          {podeGerenciar && (
            <div className="flex items-center gap-2">
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar anestesista…" />
              <Button size="sm" variant="outline" onClick={sugerir} disabled={sugerindo} className="shrink-0">
                {sugerindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Sugerir
              </Button>
            </div>
          )}
          {/* roster vem de provider deferred (2s) — lista vazia = ainda carregando */}
          {(loading || roster.length === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando anestesistas…</p>
          )}
          {!loading && roster.length > 0 && visiveis.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {podeGerenciar ? 'Nenhum anestesista encontrado.' : 'Seu usuário não está no roster de anestesistas.'}
            </p>
          )}
          {visiveis.map((r) => (
            <LinhaUsuario key={r.uid} r={r} aliases={aliases} meu={r.uid === meuUid}
              canEdit={podeGerenciar || r.uid === meuUid} onAdd={onAdd} onRemove={onRemove} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
