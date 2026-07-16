/**
 * LiberacoesView — coluna de liberação do hospital (gerada pelas 18 regras).
 * Ordem exibida = ordem do rodapé da imagem: o nº 1 é o PLANTONISTA (último a ir
 * embora) e a liberação corre de baixo para cima. O plantonista marca liberado,
 * reordena, e ajusta a LINHA de um anestesista (local e/ou cirurgião) pelo ✏️ —
 * override estruturado que sobrevive à re-derivação. Realtime: reflete para todos.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, ListOrdered, Pencil, Timer } from 'lucide-react'
import {
  Badge, Button, EmptyState, Input, useToast,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'
import { estimativaTerminoSala, formatRestante, parseHoraMinutos } from './utils'

// Cores do card por estado (pedido do dono): verde = escalado (em sala),
// amarelo = PRÓXIMO a ser liberado (último não-liberado — a liberação corre de
// baixo para cima), vermelho = já liberado.
const CARD_ESTADO = {
  escalado: 'border-success/50 bg-success/10',
  proximo: 'border-warning/60 bg-warning/10',
  liberado: 'border-destructive/40 bg-destructive/10',
}

export default function LiberacoesView({ escala, hospitalLabel, canEdit, onToggle, onReorder, onSetOverride }) {
  const { toast } = useToast()
  const [editor, setEditor] = useState(null) // linha em edição (sheet)
  const [rascLocal, setRascLocal] = useState('')
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [rascTermino, setRascTermino] = useState('') // término manual "HH:MM"

  // Cronômetro em tempo real: UM intervalo para a lista toda (30s — granularidade
  // de minuto); o texto é derivado puro de `agoraMin`. Padrão recomendado p/ listas
  // de countdown em React (intervalo único + estado compartilhado, não 1 timer/card).
  const [agoraMin, setAgoraMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })
  useEffect(() => {
    const id = setInterval(() => { const d = new Date(); setAgoraMin(d.getHours() * 60 + d.getMinutes()) }, 30_000)
    return () => clearInterval(id)
  }, [])

  const { linhas, semAnestesista } = useMemo(() => {
    if (!escala?.casos?.length) return { linhas: [], semAnestesista: [] }
    return gerarColunaLiberacao(escala.casos, escala.ordemLiberacao || [], {
      hospital: hospitalLabel,
      ajudaExterna: escala.ajudaExterna || [], // nomes em AZUL → fim da lista
    })
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
    setRascTermino(ov?.termino || '')
    setEditor(linha)
  }
  const salvarEditor = () => {
    const local = rascLocal.trim()
    const cirurgioes = rascCirurgiao.trim()
    const termino = rascTermino.trim()
    onSetOverride?.(editor.anestesista, local || cirurgioes || termino ? { local, cirurgioes, termino } : null)
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
        {(() => {
          // não escalado = está no rodapé mas sem NENHUM caso/sala no dia → já
          // está liberado por definição (vermelho desde a publicação)
          const naoEscalado = (l) => !(l.salas?.length) && !(l.cirurgioes?.length)
          // próximo a ser liberado = ÚLTIMO não-liberado ainda EM SALA
          let idxProximo = -1
          for (let i = linhas.length - 1; i >= 0; i--) {
            if (!liberacoes[linhas[i].anestesista] && !naoEscalado(linhas[i])) { idxProximo = i; break }
          }
          return linhas.map((linha, idx) => {
          const semEscala = naoEscalado(linha)
          const liberadoReal = !!liberacoes[linha.anestesista]
          const liberado = liberadoReal || semEscala
          const estado = liberado ? 'liberado' : idx === idxProximo ? 'proximo' : 'escalado'
          const ov = overrideDe(linha.anestesista)
          const cirurgioesAuto = linha.cirurgioes.length ? linha.cirurgioes.join(' · ') : semEscala ? 'sem casos hoje' : '…'
          const cirurgioesExibidos = ov?.cirurgioes || cirurgioesAuto
          const salasAuto = (linha.salas || []).join('/')
          const localExibido = ov?.local || salasAuto
          // término da(s) sala(s): TÉRMINO MANUAL do editor (✏️, qualquer usuário)
          // tem prioridade; senão estimativa automática (hora + tempoEstimado)
          const cronometro = (() => {
            if (liberado) return null
            const manual = parseHoraMinutos(ov?.termino)
            if (manual != null) return { texto: formatRestante(manual, agoraMin), atrasada: manual < agoraMin, encerrada: false }
            if (!linha.salas?.length) return null
            let fimMax = null
            let encerrada = false
            for (const s of linha.salas) {
              const est = estimativaTerminoSala(escala?.casos, s)
              if (!est) continue
              if (est.estado === 'encerrada') { encerrada = true; continue }
              if (fimMax == null || est.fimMin > fimMax) fimMax = est.fimMin
            }
            if (fimMax != null) return { texto: formatRestante(fimMax, agoraMin), atrasada: fimMax < agoraMin, encerrada: false }
            if (encerrada) return { texto: 'sala encerrada', atrasada: false, encerrada: true }
            return null
          })()
          return (
            <div
              key={linha.anestesista}
              className={['flex items-center gap-1 rounded-xl border transition-colors', CARD_ESTADO[estado]].join(' ')}
            >
              <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</span>

              {/* marcar liberado: alvo 44px, círculo visual 28px (não escalado já nasce liberado) */}
              <button
                type="button"
                disabled={!canEdit || semEscala}
                onClick={() => toggle(linha, liberadoReal)}
                aria-label={semEscala ? `${linha.anestesista} não foi escalado hoje` : liberadoReal ? `Desfazer liberação de ${linha.anestesista}` : `Marcar ${linha.anestesista} liberado`}
                className={['flex h-11 w-11 shrink-0 items-center justify-center', canEdit && !semEscala ? 'cursor-pointer' : 'cursor-default'].join(' ')}
              >
                <span className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border',
                  liberado ? 'border-destructive bg-destructive text-white' : 'border-border text-transparent',
                ].join(' ')}>
                  <Check className="w-4 h-4" />
                </span>
              </button>

              {/* corpo em 2 níveis: nome em destaque, cirurgião(ões) abaixo */}
              <div className="min-w-0 flex-1 py-2.5">
                <p className={['text-[15px] font-semibold leading-tight', liberadoReal && 'line-through opacity-60'].filter(Boolean).join(' ')}>
                  {linha.anestesista}
                  {linha.isPlantonista && (
                    <Badge variant="secondary" badgeStyle="subtle" className="ml-1.5 align-middle">Plantonista</Badge>
                  )}
                  {linha.isAjuda && (
                    <Badge variant="info" badgeStyle="subtle" className="ml-1.5 align-middle">Ajuda</Badge>
                  )}
                  {semEscala && (
                    <Badge variant="destructive" badgeStyle="subtle" className="ml-1.5 align-middle">Não escalado</Badge>
                  )}
                </p>
                <p className={['mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground', liberado && 'opacity-60'].filter(Boolean).join(' ')}>
                  {cirurgioesExibidos}
                  {ov?.cirurgioes && <span className="ml-1 text-xs text-primary">· ajustado</span>}
                </p>
                {/* cronômetro em tempo real do término da(s) sala(s) do anestesista */}
                {cronometro && (
                  <p className={[
                    'mt-0.5 flex items-center gap-1 text-xs',
                    cronometro.encerrada ? 'text-success' : cronometro.atrasada ? 'font-medium text-warning' : 'text-muted-foreground',
                  ].join(' ')}>
                    <Timer className="h-3 w-3 shrink-0" /> {cronometro.texto}
                  </p>
                )}
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
          })
        })()}
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
              <div>
                <label htmlFor="editor-termino" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Término previsto (cronômetro)
                </label>
                <Input
                  id="editor-termino"
                  type="time"
                  value={rascTermino}
                  onChange={(e) => setRascTermino(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Hora prevista de término da sala — vira o cronômetro do card ("termina em ~…").
                </p>
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
