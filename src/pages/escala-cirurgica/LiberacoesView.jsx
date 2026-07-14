/**
 * LiberacoesView — coluna de liberação do hospital (gerada pelas 18 regras).
 * Ordem exibida = ordem do rodapé da imagem: o nº 1 é o PLANTONISTA (último a ir
 * embora) e a liberação corre de baixo para cima. O plantonista marca liberado,
 * reordena, e ajusta a LINHA de um anestesista (local e/ou cirurgião) pelo ✏️ —
 * override estruturado que sobrevive à re-derivação. Realtime: reflete para todos.
 */
import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, ListOrdered, Pencil } from 'lucide-react'
import {
  Badge, Button, EmptyState, Input, useToast,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'

export default function LiberacoesView({ escala, hospitalLabel, canEdit, onToggle, onReorder, onSetOverride }) {
  const { toast } = useToast()
  const [editor, setEditor] = useState(null) // linha em edição (sheet)
  const [rascLocal, setRascLocal] = useState('')
  const [rascCirurgiao, setRascCirurgiao] = useState('')

  const { linhas, semAnestesista } = useMemo(() => {
    if (!escala?.casos?.length) return { linhas: [], semAnestesista: [] }
    return gerarColunaLiberacao(escala.casos, escala.ordemLiberacao || [], { hospital: hospitalLabel })
  }, [escala, hospitalLabel])

  const liberacoes = escala?.liberacoes || {}
  // overrides estruturados { local?, cirurgioes? }; string = formato legado (demo antigo)
  const overrides = escala?.linhaOverrides || {}
  const overrideDe = (nome) => {
    const ov = overrides[nome]
    return typeof ov === 'string' ? { local: ov } : ov || null
  }

  if (!escala || !linhas.length) {
    return (
      <EmptyState
        icon={<ListOrdered className="w-6 h-6" />}
        title="Sem liberações"
        description="Importe a escala deste hospital para gerar a ordem de liberação."
      />
    )
  }

  const ordemAtual = linhas.map((l) => l.anestesista)

  const mover = (idx, dir) => {
    const alvo = idx + dir
    if (alvo < 0 || alvo >= ordemAtual.length) return
    const nova = [...ordemAtual]
    ;[nova[idx], nova[alvo]] = [nova[alvo], nova[idx]]
    onReorder?.(nova)
  }

  const toggle = async (linha, liberado) => {
    try {
      // aguarda a persistência ANTES do toast — sucesso mentiroso em falha de RPC
      // foi flagrado na auditoria F1.6 (toast aparecia e o banco ficava vazio)
      await onToggle?.(linha.anestesista)
      if (!liberado) {
        toast({
          variant: 'success',
          title: `${linha.anestesista} liberado`,
          action: { label: 'Desfazer', onClick: () => onToggle?.(linha.anestesista) },
        })
      }
    } catch { /* toast de erro já vem do context */ }
  }

  const abrirEditor = (linha) => {
    const ov = overrideDe(linha.anestesista)
    setRascLocal(ov?.local || '')
    setRascCirurgiao(ov?.cirurgioes || '')
    setEditor(linha)
  }
  const salvarEditor = () => {
    const local = rascLocal.trim()
    const cirurgioes = rascCirurgiao.trim()
    onSetOverride?.(editor.anestesista, local || cirurgioes ? { local, cirurgioes } : null)
    setEditor(null)
  }
  const restaurarEditor = () => {
    onSetOverride?.(editor.anestesista, null)
    setEditor(null)
  }

  return (
    <div className="space-y-3">
      {/* div simples de propósito: animação de layout + reload do realtime moviam a
          linha sob o dedo (mesma classe do bug da inbox, fix 956aedd) */}
      <div className="space-y-1.5">
        {linhas.map((linha, idx) => {
          const liberado = !!liberacoes[linha.anestesista]
          const ov = overrideDe(linha.anestesista)
          const cirurgioesAuto = linha.cirurgioes.length ? linha.cirurgioes.join(' · ') : '…'
          const cirurgioesExibidos = ov?.cirurgioes || cirurgioesAuto
          const salasAuto = (linha.salas || []).join('/')
          const localExibido = ov?.local || salasAuto
          return (
            <div
              key={linha.anestesista}
              className={[
                'flex items-center gap-1 rounded-xl border transition-colors',
                liberado ? 'border-success/40 bg-success/5' : 'border-border bg-card',
              ].join(' ')}
            >
              <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</span>

              {/* marcar liberado: alvo 44px, círculo visual 28px */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => toggle(linha, liberado)}
                aria-label={liberado ? `Desfazer liberação de ${linha.anestesista}` : `Marcar ${linha.anestesista} liberado`}
                className={['flex h-11 w-11 shrink-0 items-center justify-center', canEdit ? 'cursor-pointer' : 'cursor-default'].join(' ')}
              >
                <span className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border',
                  liberado ? 'border-success bg-success text-white' : 'border-border text-transparent',
                ].join(' ')}>
                  <Check className="w-4 h-4" />
                </span>
              </button>

              {/* corpo em 2 níveis: nome em destaque, cirurgião(ões) abaixo */}
              <div className="min-w-0 flex-1 py-2.5">
                <p className={['text-[15px] font-semibold leading-tight', liberado && 'line-through opacity-60'].filter(Boolean).join(' ')}>
                  {linha.anestesista}
                  {linha.isPlantonista && (
                    <Badge variant="secondary" badgeStyle="subtle" className="ml-1.5 align-middle">Plantonista</Badge>
                  )}
                </p>
                <p className={['mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground', liberado && 'opacity-60'].filter(Boolean).join(' ')}>
                  {cirurgioesExibidos}
                  {ov?.cirurgioes && <span className="ml-1 text-xs text-primary">· ajustado</span>}
                </p>
              </div>

              {/* direita: LOCAL escalado sempre visível + ✏️ editor + reordenar */}
              <div className="flex shrink-0 items-center">
                {localExibido && (
                  <span
                    className={['max-w-[84px] truncate text-right text-xs', ov?.local ? 'font-medium text-primary' : 'text-muted-foreground'].join(' ')}
                    title={ov?.local ? 'Local ajustado' : localExibido}
                  >
                    {localExibido}
                  </span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => abrirEditor(linha)}
                    aria-label={`Editar local/cirurgião de ${linha.anestesista}`}
                    className="flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canEdit && (
                  <div className="flex shrink-0 flex-col">
                    <button type="button" onClick={() => mover(idx, -1)} aria-label={`Subir ${linha.anestesista}`}
                      className="flex h-[22px] w-9 items-end justify-center pb-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => mover(idx, 1)} aria-label={`Descer ${linha.anestesista}`}
                      className="flex h-[22px] w-9 items-start justify-center pt-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === linhas.length - 1}>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {semAnestesista.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium text-warning px-1 mb-1.5">Sem anestesista (?)</p>
          <div className="space-y-1.5">
            {semAnestesista.map((i, k) => (
              <div key={k} className="rounded-xl border border-warning/40 bg-warning/5 p-2.5 text-sm">
                {i.cirurgiao} <span className="text-muted-foreground">— ({i.contexto})</span>{' '}
                <Badge variant="warning" badgeStyle="subtle">?</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* editor da linha (✏️): local e/ou cirurgião — vazio volta ao automático */}
      <Sheet open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Editar linha — {editor?.anestesista}</SheetTitle>
          </SheetHeader>
          {editor && (
            <div className="space-y-3 px-1 pb-4">
              <div>
                <label htmlFor="editor-local" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Local</label>
                <Input
                  id="editor-local"
                  autoFocus
                  value={rascLocal}
                  onChange={(e) => setRascLocal(e.target.value)}
                  placeholder={(editor.salas || []).join('/') || 'ex.: Coronel Freitas'}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
              </div>
              <div>
                <label htmlFor="editor-cirurgiao" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Cirurgião(ões)</label>
                <Input
                  id="editor-cirurgiao"
                  value={rascCirurgiao}
                  onChange={(e) => setRascCirurgiao(e.target.value)}
                  placeholder={editor.cirurgioes.length ? editor.cirurgioes.join(' · ') : 'ex.: Liana W'}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Campo vazio volta ao valor automático (derivado dos casos).</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={restaurarEditor}>Restaurar automático</Button>
                <Button className="flex-1" onClick={salvarEditor}>Salvar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
