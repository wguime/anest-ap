/**
 * LiberacoesView — coluna de liberação do hospital (gerada pelas 18 regras).
 * O plantonista marca cada anestesista como liberado, reordena conforme as salas
 * vão liberando, e pode TROCAR O LOCAL exibido de um anestesista (override livre —
 * ex.: "Coronel Freitas", "Ambulatorial") sem que haja troca de sala entre eles.
 * Realtime: reflete para todos.
 */
import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, ListOrdered, MapPin, X } from 'lucide-react'
import { AnimatedList, Badge, EmptyState, Input } from '@/design-system'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'

export default function LiberacoesView({ escala, hospitalLabel, canEdit, onToggle, onReorder, onSetLocal }) {
  const [editando, setEditando] = useState(null) // nome do anestesista em edição
  const [rascunho, setRascunho] = useState('')

  const { linhas, semAnestesista } = useMemo(() => {
    if (!escala?.casos?.length) return { linhas: [], semAnestesista: [] }
    return gerarColunaLiberacao(escala.casos, escala.ordemLiberacao || [], { hospital: hospitalLabel })
  }, [escala, hospitalLabel])

  const liberacoes = escala?.liberacoes || {}
  const locais = escala?.locais || {}

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

  const abrirEdicao = (nome) => { setEditando(nome); setRascunho(locais[nome] || '') }
  const salvarLocal = (nome) => { onSetLocal?.(nome, rascunho); setEditando(null) }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">Ordem de liberação (rodapé)</p>
      <AnimatedList className="space-y-1.5">
        {linhas.map((linha, idx) => {
          const liberado = !!liberacoes[linha.anestesista]
          const override = locais[linha.anestesista]
          const local = override || (linha.cirurgioes.length ? linha.cirurgioes.join('/') : '…')
          const emEdicao = editando === linha.anestesista
          return (
            <div
              key={linha.anestesista}
              className={[
                'flex items-center gap-2 rounded-xl border p-2.5 transition-colors',
                liberado ? 'border-success/40 bg-success/5 opacity-60' : 'border-border bg-card',
              ].join(' ')}
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</span>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onToggle?.(linha.anestesista)}
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border min-h-[28px]',
                  liberado ? 'border-success bg-success text-white' : 'border-border text-transparent',
                  canEdit ? 'cursor-pointer' : 'cursor-default',
                ].join(' ')}
                aria-label={liberado ? 'Desfazer liberação' : 'Marcar liberado'}
              >
                <Check className="w-4 h-4" />
              </button>

              <div className="min-w-0 flex-1">
                {emEdicao ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold shrink-0">{linha.anestesista} —</span>
                    <Input
                      autoFocus
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      placeholder="Local (ex.: Coronel Freitas)"
                      onKeyDown={(e) => { if (e.key === 'Enter') salvarLocal(linha.anestesista) }}
                    />
                    <button type="button" aria-label="Salvar local" onClick={() => salvarLocal(linha.anestesista)} className="text-primary shrink-0">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label="Cancelar" onClick={() => setEditando(null)} className="text-muted-foreground shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className={['text-sm', liberado && 'line-through'].filter(Boolean).join(' ')}>
                    <span className="font-semibold">{linha.anestesista}</span>
                    <span className="text-muted-foreground"> — {local}</span>
                    {override && <span className="ml-1 text-[11px] text-primary">(local ajustado)</span>}
                  </p>
                )}
              </div>

              {canEdit && !emEdicao && (
                <>
                  <button type="button" onClick={() => abrirEdicao(linha.anestesista)} aria-label="Mudar local"
                    className="shrink-0 text-muted-foreground hover:text-primary">
                    <MapPin className="w-4 h-4" />
                  </button>
                  <div className="flex shrink-0 flex-col">
                    <button type="button" onClick={() => mover(idx, -1)} aria-label="Subir"
                      className="flex h-5 w-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => mover(idx, 1)} aria-label="Descer"
                      className="flex h-5 w-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === linhas.length - 1}>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </AnimatedList>

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
    </div>
  )
}
