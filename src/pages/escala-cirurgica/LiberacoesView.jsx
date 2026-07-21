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
  Badge, Button, EmptyState, Input, Select, useToast,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'
import { casosResolvidos, estimativaTerminoSala, formatRestante, normNome, parseHoraMinutos } from './utils'

// Cores do card por estado (pedido do dono): verde = escalado (em sala),
// amarelo = PRÓXIMO a ser liberado (último não-liberado — a liberação corre de
// baixo para cima), vermelho = já liberado.
// Opções do Select de hora exata (padrão DS): dia inteiro em passos de 15min.
const HORARIOS_OPCOES = Array.from({ length: 96 }, (_, i) => {
  const v = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`
  return { value: v, label: v }
})

/** Próximo quarto de hora (sugestão inicial do Select — dropdown já abre perto de agora). */
function proximoQuartoDeHora() {
  const d = new Date(Date.now() + 15 * 60000)
  const m = Math.floor(d.getMinutes() / 15) * 15
  return `${String(d.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// No dark a tinta /10 some no fundo escuro — tinta e borda mais fortes só lá.
// escalado = MESMO verde dos pills do seletor Unimed/HRO (pedido do dono 2026-07-21).
const CARD_ESTADO = {
  escalado: 'border-[hsl(var(--primary-hover))] bg-primary/10 dark:border-[hsl(var(--primary))] dark:bg-primary/20',
  proximo: 'border-warning/60 bg-warning/10 dark:border-warning/70 dark:bg-warning/20',
  liberado: 'border-destructive/40 bg-destructive/10 dark:border-destructive/70 dark:bg-destructive/20',
}

export default function LiberacoesView({ escala, hospitalLabel, canEdit, onToggle, onToggleEscalado, onReorder, onSetOverride }) {
  const { toast } = useToast()
  const [editor, setEditor] = useState(null) // linha em edição (sheet)
  const [rascLocal, setRascLocal] = useState('')
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [rascTermino, setRascTermino] = useState('') // término manual "HH:MM"
  const [alvoTempo, setAlvoTempo] = useState(null) // linha do sheet "Tempo faltante"
  const [horaExata, setHoraExata] = useState('') // hora exata de término (HH:MM, Select DS)

  // Cronômetro em tempo real: UM intervalo para a lista toda (30s — granularidade
  // de minuto); o texto é derivado puro de `agoraMin`. Padrão recomendado p/ listas
  // de countdown em React (intervalo único + estado compartilhado, não 1 timer/card).
  const [agoraMin, setAgoraMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })
  useEffect(() => {
    const id = setInterval(() => { const d = new Date(); setAgoraMin(d.getHours() * 60 + d.getMinutes()) }, 30_000)
    return () => clearInterval(id)
  }, [])

  // Anestesistas com caso reagendado p/ a tarde (status passa_tarde no board) —
  // compara por nome normalizado: a linha usa titleCase, o caso o texto importado.
  const nomesPassaTarde = useMemo(() => {
    const s = new Set()
    for (const c of casosResolvidos(escala)) {
      // extra no campo novo; aceita o legado no principal (demo/dados antigos)
      if ((c.statusExtra === 'passa_tarde' || c.statusCirurgia === 'passa_tarde') && c.anestesista) s.add(normNome(c.anestesista))
    }
    return s
  }, [escala])
  const temPassaTarde = (nome) => nomesPassaTarde.has(normNome(nome))

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

  // "Tempo faltante": grava override.termino (agora + duração, ou hora exata),
  // PRESERVANDO local/cirurgiões já ajustados.
  const definirTempo = (linha, terminoHHMM) => {
    const ov = overrideDe(linha.anestesista) || {}
    onSetOverride?.(linha.anestesista, {
      local: ov.local || '',
      cirurgioes: ov.cirurgioes || '',
      termino: terminoHHMM || '',
    })
    setAlvoTempo(null)
    setHoraExata('')
  }
  const emMinutos = (min) => {
    const d = new Date(Date.now() + min * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const DURACOES = [
    { label: '15min', min: 15 }, { label: '30min', min: 30 }, { label: '1h', min: 60 },
    { label: '1h30', min: 90 }, { label: '2h', min: 120 }, { label: '2h30', min: 150 },
    { label: '3h', min: 180 },
  ]

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
            const m = liberacoes[linhas[i].anestesista]
            const emSala = m?.escalado === true || !naoEscalado(linhas[i])
            if (!(m && !m.escalado) && emSala) { idxProximo = i; break }
          }
          return linhas.map((linha, idx) => {
          const semEscala = naoEscalado(linha)
          const marcacao = liberacoes[linha.anestesista]
          const forcadoEscalado = marcacao?.escalado === true // entrou na escala no meio do dia
          const liberadoReal = !!marcacao && !forcadoEscalado
          const liberado = liberadoReal || (semEscala && !forcadoEscalado)
          const estado = liberado ? 'liberado' : idx === idxProximo ? 'proximo' : 'escalado'
          const ov = overrideDe(linha.anestesista)
          // linha RENOVADA (voltou de liberação): infos da manhã não valem mais —
          // derivado suprimido; só o que for preenchido manualmente aparece.
          const renovado = !!ov?.renovado
          // >1 cirurgião = lista (1 por linha); override manual = 1 linha como digitado
          const listaCirurgioes = ov?.cirurgioes
            ? [ov.cirurgioes]
            : (renovado || semEscala) ? [] : linha.cirurgioes.length ? linha.cirurgioes : ['…']
          const salasAuto = renovado ? '' : (linha.salas || []).join('/')
          const localExibido = ov?.local || salasAuto
          // término da(s) sala(s): TÉRMINO MANUAL do editor (✏️, qualquer usuário)
          // tem prioridade; senão estimativa automática (hora + tempoEstimado)
          const cronometro = (() => {
            if (liberado) return null
            const compacto = (fimMin) => {
              const diff = fimMin - agoraMin
              const abs = Math.abs(diff)
              const fmt = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs}min`
              return {
                texto: diff >= 0 ? `~${fmt}` : `+${fmt}`,           // curto p/ a coluna
                titulo: formatRestante(fimMin, agoraMin),           // frase completa no title
                atrasada: diff < 0,
                encerrada: false,
              }
            }
            const manual = parseHoraMinutos(ov?.termino)
            if (manual != null) return compacto(manual)
            if (renovado) return null // sem estimativa herdada — botão "Tempo faltante" p/ preencher
            if (!linha.salas?.length) return null
            let fimMax = null
            let encerrada = false
            for (const s of linha.salas) {
              const est = estimativaTerminoSala(escala?.casos, s)
              if (!est) continue
              if (est.estado === 'encerrada') { encerrada = true; continue }
              if (fimMax == null || est.fimMin > fimMax) fimMax = est.fimMin
            }
            if (fimMax != null) return compacto(fimMax)
            if (encerrada) return { texto: 'encerrada', titulo: 'sala encerrada', atrasada: false, encerrada: true }
            return null
          })()
          return (
            <div
              key={linha.anestesista}
              className={['flex min-h-[68px] items-center rounded-xl border transition-colors', CARD_ESTADO[estado]].join(' ')}
            >
              <span className="w-5 shrink-0 pl-1 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</span>

              {/* reordenar ao lado do número (pedido do dono) */}
              {canEdit && (
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => mover(idx, -1)} aria-label={`Subir ${linha.anestesista}`}
                    className="flex h-[22px] w-6 items-end justify-center pb-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => mover(idx, 1)} aria-label={`Descer ${linha.anestesista}`}
                    className="flex h-[22px] w-6 items-start justify-center pt-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === linhas.length - 1}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* marcar liberado: alvo 44px, círculo visual 28px (não escalado já nasce liberado) */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => (semEscala ? onToggleEscalado?.(linha.anestesista) : toggle(linha, liberadoReal))}
                aria-label={semEscala
                  ? (forcadoEscalado ? `Voltar ${linha.anestesista} para não escalado` : `Marcar ${linha.anestesista} como escalado`)
                  : liberadoReal ? `Desfazer liberação de ${linha.anestesista}` : `Marcar ${linha.anestesista} liberado`}
                className={['flex h-11 w-9 shrink-0 items-center justify-center', canEdit ? 'cursor-pointer' : 'cursor-default'].join(' ')}
              >
                <span className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border-2',
                  // vazio precisa de presença: border-border sumia sobre os cards tintados no dark
                  liberado
                    ? 'border-destructive bg-destructive text-white'
                    : 'border-muted-foreground/50 bg-background/40 text-transparent dark:border-muted-foreground/80',
                ].join(' ')}>
                  <Check className="w-4 h-4" />
                </span>
              </button>

              {/* corpo em 2 níveis: nome em destaque, cirurgião(ões) abaixo */}
              <div className="min-w-0 flex-1 py-2.5 pl-1">
                {/* flex + truncate: badge SEMPRE ao lado do nome (sem quebrar p/ baixo) */}
                <p className={['flex items-center gap-1.5 text-[15px] font-semibold leading-tight', liberadoReal && 'line-through opacity-60'].filter(Boolean).join(' ')}>
                  <span className="min-w-0 truncate">{linha.anestesista}</span>
                  {/* liberado = card enxuto (pedido do dono): só nome + badge Liberado + lápis */}
                  {!liberadoReal && linha.isPlantonista && (
                    <Badge variant="secondary" badgeStyle="subtle"
                      className="shrink-0 dark:bg-[hsl(var(--badge-success))] dark:text-[hsl(var(--badge-success-foreground))]">
                      Plantonista
                    </Badge>
                  )}
                  {!liberadoReal && linha.isAjuda && (
                    <Badge variant="info" badgeStyle="subtle" className="shrink-0">Ajuda</Badge>
                  )}
                  {/* caso reagendado p/ a tarde (status no board) — o plantonista precisa saber ao
                      liberar. Linha RENOVADA não herda: o passa-tarde era da escala de antes. */}
                  {!liberadoReal && !renovado && temPassaTarde(linha.anestesista) && (
                    <Badge className="shrink-0 border-transparent bg-category-purple text-white">
                      Passa para tarde
                    </Badge>
                  )}
                </p>
                {/* 2ª linha: infos à esquerda; cronômetro + lápis à direita (o nome acima
                    fica com a LARGURA TODA — badge ao lado sem truncar o nome) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* card vermelho = badge "Liberado", sempre em linha própria
                        (vale p/ liberado de fato E p/ não escalado, que já nasce liberado) */}
                    {liberado && (
                      <div className="mt-1">
                        <Badge variant="destructive" badgeStyle="subtle" className="dark:bg-destructive/25">Liberado</Badge>
                      </div>
                    )}
                    {/* cirurgiões: 1 por linha quando há mais de um (lista); some quando liberado */}
                    {!liberadoReal && listaCirurgioes.length > 0 && (
                      <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {listaCirurgioes.map((c, i) => (
                          <p key={i} className="truncate">
                            {listaCirurgioes.length > 1 && <span className="mr-1 text-muted-foreground/60">•</span>}
                            {c}
                            {i === 0 && ov?.cirurgioes && <span className="ml-1 text-xs text-primary">· ajustado</span>}
                          </p>
                        ))}
                      </div>
                    )}
                    {/* sala/local abaixo do cirurgião (pedido do dono 2026-07-20) */}
                    {!liberadoReal && localExibido && (
                      <p
                        className={['mt-0.5 truncate text-xs font-semibold', ov?.local ? 'text-primary' : 'text-foreground/80'].join(' ')}
                        title={ov?.local ? 'Local ajustado' : localExibido}
                      >
                        {localExibido}
                      </p>
                    )}
                    {/* card amarelo: deixa explícito o PORQUÊ da cor */}
                    {estado === 'proximo' && (
                      <div className="mt-1">
                        <Badge variant="warning" badgeStyle="subtle" className="dark:bg-warning/25">Próximo a ser liberado</Badge>
                      </div>
                    )}
                  </div>

                  {/* direita: cronômetro OU "Tempo faltante"; liberado = card enxuto (só lápis) */}
                  <div className="flex shrink-0 items-center">
                    {!liberadoReal && (cronometro ? (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => canEdit && setAlvoTempo(linha)}
                        title={`${cronometro.titulo} — toque para ajustar`}
                        className="flex min-h-[26px] items-center gap-1 whitespace-nowrap rounded-full
                                   bg-primary px-2.5 text-sm font-semibold text-primary-foreground"
                      >
                        <Timer className="h-3.5 w-3.5 shrink-0" /> {cronometro.texto}
                      </button>
                    ) : (canEdit && (
                      <button
                        type="button"
                        onClick={() => setAlvoTempo(linha)}
                        aria-label={`Definir tempo faltante de ${linha.anestesista}`}
                        className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-primary active:bg-muted"
                      >
                        <Timer className="mr-0.5 inline h-3 w-3" /> Tempo faltante
                      </button>
                    )))}
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
                  </div>
                </div>
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
              <div key={k} className="rounded-xl border border-warning/40 bg-warning/5 p-2.5 text-sm dark:border-warning/60 dark:bg-warning/15">
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

      {/* Tempo faltante — 1 toque define o término e liga o cronômetro do card */}
      <Sheet open={!!alvoTempo} onOpenChange={(o) => { if (!o) { setAlvoTempo(null); setHoraExata('') } }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Timer className="w-4 h-4 shrink-0" /> Tempo faltante
            </SheetTitle>
            {alvoTempo?.anestesista && (
              <p className="text-lg font-bold leading-tight text-foreground">{alvoTempo.anestesista}</p>
            )}
          </SheetHeader>
          {alvoTempo && (
            <div className="space-y-5 px-1 pb-6 pt-2">
              <p className="text-xs text-muted-foreground">
                Quanto falta para o término da sala/procedimento? O cronômetro aparece no card e conta em tempo real.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {DURACOES.map((d) => (
                  <Button key={d.min} size="sm" variant="outline"
                    onClick={() => definirTempo(alvoTempo, emMinutos(d.min))}>
                    {d.label}
                  </Button>
                ))}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ou hora exata de término
                </p>
                {/* Selects do DS (dropdown estilizado light/dark) — input time nativo abria o picker cru do browser */}
                <div className="flex items-stretch gap-2">
                  <Select className="w-40" options={HORARIOS_OPCOES}
                    value={horaExata || proximoQuartoDeHora()} onChange={setHoraExata} placeholder="Horário" />
                  <Button className="h-auto self-stretch px-4"
                    onClick={() => definirTempo(alvoTempo, horaExata || proximoQuartoDeHora())}>
                    Definir
                  </Button>
                </div>
              </div>
              {overrideDe(alvoTempo.anestesista)?.termino && (
                <Button variant="ghost" className="w-full" onClick={() => definirTempo(alvoTempo, '')}>
                  Limpar cronômetro
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
