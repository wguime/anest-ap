/**
 * Peças da publicação no DESKTOP (dono 09/10/2026, modelos C + P escolhidos em protótipo):
 * o visor da foto ao lado da conferência, o painel de recados do WhatsApp e a prévia
 * "como o grupo vai ver" com 10 s para desfazer. Só aparecem a partir de 1280 px.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight, Check, ClipboardPaste, Eye, FileSpreadsheet, ImageIcon, Loader2, MessageCircle,
  Moon, RefreshCw, RotateCw, Trash2, Undo2, X, ZoomIn, ZoomOut, Maximize2, Ban,
} from 'lucide-react'
import { Button } from '@/design-system'
import { stripNotaRodape, titleCaseNome, nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { filaDaPrevia } from '@/lib/escalaPreviaPublicacao'
import { SeloMarca } from './ConferenciaDesktop'
import { MOD, ALT } from './teclasPlataforma'

// ── VISOR DA FOTO ──────────────────────────────────────────────────────────────
/**
 * A foto do hospital aberto, FIXA ao lado da conferência — a tela pede "confira contra a
 * foto" em seis lugares e, no desktop, a foto não estava em lugar nenhum. Zoom (botões e
 * Ctrl/⌘ + roda), ajustar à largura, girar e arrastar para mover. A imagem fica só na
 * memória da aba: não vai para rascunho nem para o servidor.
 */
export function VisorFoto({ arquivo, nome, hospitalLabel }) {
  const [zoom, setZoom] = useState(100)
  const [giro, setGiro] = useState(0)
  const area = useRef(null)
  const arrasto = useRef(null)
  const ehImagem = !!arquivo && String(arquivo.type || '').startsWith('image/')
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!ehImagem) { setUrl(null); return undefined } // eslint-disable-line react-hooks/set-state-in-effect
    const u = URL.createObjectURL(arquivo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [arquivo, ehImagem])
  useEffect(() => { setZoom(100); setGiro(0) }, [arquivo]) // eslint-disable-line react-hooks/set-state-in-effect

  if (!arquivo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
        <ImageIcon className="h-6 w-6" />
        {hospitalLabel
          ? <p>A foto {hospitalLabel ? `do ${hospitalLabel}` : ''} não está nesta sessão (rascunho restaurado ou arquivo tirado). Anexe de novo para vê-la aqui.</p>
          : <p>A foto do hospital aberto aparece aqui.</p>}
      </div>
    )
  }
  if (!ehImagem) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-border-strong p-6 text-center text-sm text-muted-foreground">
        <FileSpreadsheet className="h-6 w-6" />
        <p><b className="text-foreground">{nome}</b> é planilha — confira pela visão “Por sala”, que segue a ordem das linhas.</p>
      </div>
    )
  }
  const mudarZoom = (d) => setZoom((z) => Math.max(40, Math.min(400, z + d)))
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border-strong bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2.5 text-[12.5px]">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold"><ImageIcon className="h-4 w-4 shrink-0" /><span className="truncate">{nome}</span></span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <button type="button" aria-label="Diminuir" onClick={() => mudarZoom(-20)} className="rounded p-1 hover:bg-muted"><ZoomOut className="h-4 w-4" /></button>
          <b className="w-11 text-center text-xs tabular-nums text-foreground">{zoom}%</b>
          <button type="button" aria-label="Aumentar" onClick={() => mudarZoom(20)} className="rounded p-1 hover:bg-muted"><ZoomIn className="h-4 w-4" /></button>
          <span className="mx-1 h-[18px] w-px bg-border" />
          <button type="button" aria-label="Ajustar à largura" onClick={() => setZoom(100)} className="rounded p-1 hover:bg-muted"><Maximize2 className="h-4 w-4" /></button>
          <button type="button" aria-label="Girar" onClick={() => setGiro((g) => (g + 90) % 360)} className="rounded p-1 hover:bg-muted"><RotateCw className="h-4 w-4" /></button>
        </span>
      </div>
      <div
        ref={area}
        className="min-h-0 flex-1 cursor-grab overflow-auto bg-[#2b2f2d] active:cursor-grabbing"
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); mudarZoom(e.deltaY < 0 ? 10 : -10) } }}
        onMouseDown={(e) => { arrasto.current = { x: e.clientX, y: e.clientY, l: area.current.scrollLeft, t: area.current.scrollTop } }}
        onMouseMove={(e) => {
          if (!arrasto.current) return
          area.current.scrollLeft = arrasto.current.l - (e.clientX - arrasto.current.x)
          area.current.scrollTop = arrasto.current.t - (e.clientY - arrasto.current.y)
        }}
        onMouseUp={() => { arrasto.current = null }}
        onMouseLeave={() => { arrasto.current = null }}
      >
        {url && (
          <img
            src={url}
            alt={`Escala ${hospitalLabel || ''}`}
            draggable={false}
            style={{ width: `${zoom}%`, maxWidth: 'none', transform: giro ? `rotate(${giro}deg)` : undefined, transformOrigin: 'center' }}
            className="select-none"
          />
        )}
      </div>
      <p className="shrink-0 border-t border-border px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
        Arraste para mover · Ctrl/⌘ + roda do mouse aproxima
      </p>
    </div>
  )
}

// ── PAINEL DE RECADOS ──────────────────────────────────────────────────────────

const ROTULO_TIPO = { consultorio: 'Consultório', equipe: 'Equipe', ajuda: 'Ajuda', troca: 'Troca', noturno: 'Plantão noturno', nao_reconhecido: 'Não reconhecido' }
const COR_NUMERO = { consultorio: 'bg-category-orange', equipe: 'bg-category-cyan-fg', ajuda: 'bg-info', troca: 'bg-category-indigo', noturno: 'bg-muted-foreground', nao_reconhecido: 'bg-muted-foreground' }

function seloDaAcao(a, fimTurno) {
  if (a.tipo === 'nota') return <SeloMarca tipo="local">Consultório{a.hora ? ` ${a.hora.replace(':', 'h')}` : ''}</SeloMarca>
  if (a.tipo === 'equipe') return <SeloMarca tipo="equipe">Equipe até {a.ate ? a.ate.slice(0, 2) + 'h' : fimTurno}</SeloMarca>
  if (a.tipo === 'ajuda') return <SeloMarca tipo="ajuda">Ajuda</SeloMarca>
  if (a.tipo === 'troca') return <SeloMarca tipo="troca"><ArrowLeftRight className="h-3 w-3" />Troca</SeloMarca>
  return null
}

const nomeCurto = (n) => nomeCirurgiaoCurto(titleCaseNome(n || ''))

export function PainelRecados({ recados, rotulos, fimTurno, onTexto, onPrint, ativo }) {
  const [colando, setColando] = useState(false)
  const [rasc, setRasc] = useState('')
  const entradaArquivo = useRef(null)
  const lista = [...recados.plano].reverse()

  const receberArquivos = (files) => {
    for (const f of [...(files || [])]) {
      if (!String(f.type || '').startsWith('image/')) continue
      onPrint(f)
    }
  }
  // o ⌘V da página inteira chega aqui pelo pai; este é o caminho do arrastar
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => { if (ativo) e.preventDefault() }}
      onDrop={(e) => { e.preventDefault(); receberArquivos(e.dataTransfer?.files) }}
    >
      <div className="mb-2 shrink-0 rounded-[10px] border-[1.5px] border-dashed border-border-strong px-3 py-2 text-[12.5px] text-muted-foreground">
        <p className="flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 shrink-0" />
          <span><b className="text-foreground">Cole o print ({MOD}V)</b> ou o texto copiado do WhatsApp — ou arraste aqui.</span>
        </p>
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" onClick={() => setColando((v) => !v)} className="h-7 rounded-md border border-border-strong bg-card px-2.5 text-xs font-semibold text-foreground">
            {colando ? 'Fechar' : 'Colar texto'}
          </button>
          <button type="button" onClick={() => entradaArquivo.current?.click()} className="h-7 rounded-md border border-border-strong bg-card px-2.5 text-xs font-semibold text-foreground">
            Escolher print…
          </button>
          <input ref={entradaArquivo} type="file" accept="image/*" multiple hidden
            onChange={(e) => { receberArquivos(e.target.files); e.target.value = '' }} />
        </div>
        {colando && (
          <div className="mt-2">
            <textarea
              value={rasc}
              onChange={(e) => setRasc(e.target.value)}
              rows={5}
              placeholder={'[09/10/2026, 11:25:10] Escalas Anest: Consultório 13h30 - 46 consultas: @Gabriel Anest…'}
              className="w-full rounded-lg border border-border-strong bg-card p-2 font-mono text-[11.5px] text-foreground"
              aria-label="Texto do recado"
            />
            <Button size="sm" className="mt-1" disabled={!rasc.trim()} onClick={() => { onTexto(rasc); setRasc(''); setColando(false) }}>
              Ler recado
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {!lista.length && (
          <p className="px-1 text-[12.5px] leading-5 text-muted-foreground">
            O que o recado diz vira marcação na fila: <b className="text-foreground">Consultório</b>, <b className="text-foreground">Equipe até 13h/19h</b>,{' '}
            <b className="text-foreground">Ajuda</b> e <b className="text-foreground">Troca</b> entram aplicados, com desfazer.
            O plantão noturno só é conferido. Nome com dois donos espera você escolher.
          </p>
        )}
        {lista.map((e) => (
          <section key={e.id} className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 text-[12px]">
              {e.fonte === 'print' ? <ImageIcon className="h-4 w-4 shrink-0" /> : <MessageCircle className="h-4 w-4 shrink-0" />}
              <b className="truncate">{e.fonte === 'print' ? (e.nome || 'Print colado') : 'Texto colado'}</b>
              <span className="text-muted-foreground">· {e.lendo ? 'lendo…' : `${e.mensagens.length} mensage${e.mensagens.length === 1 ? 'm' : 'ns'}`}</span>
              <span className={`ml-auto font-semibold ${e.erro ? 'text-destructive' : 'text-success'}`}>
                {e.lendo ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : e.erro ? 'não lido' : (e.fonte === 'print' ? 'lido' : 'lido na hora · sem custo')}
              </span>
              {!e.lendo && (
                <button type="button" onClick={() => recados.removerEntrada(e.id)} aria-label="Tirar este recado e desfazer as marcações dele"
                  title="Tirar este recado (desfaz as marcações dele)" className="rounded p-1 text-muted-foreground hover:bg-muted">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </header>
            {e.miniatura && (
              <img src={e.miniatura} alt="Print do recado" className="max-h-56 w-full border-b border-border bg-muted/40 object-contain" />
            )}
            {e.erro && <p className="px-2.5 py-2 text-xs text-destructive">{e.erro}</p>}
            <ol className="divide-y divide-border/70">
              {e.itens.map((m, k) => (
                <li key={m.id} className="px-2.5 py-2">
                  <div className="flex gap-2">
                    <span className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white ${COR_NUMERO[m.tipo] || 'bg-muted-foreground'}`}>{k + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-[11.5px] italic leading-4 text-muted-foreground">
                        {m.hora ? `${m.hora} · ` : ''}{m.texto}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {m.acoes.map((a) => {
                          const feita = recados.aplicadas.has(a.chave)
                          const desfeita = recados.desfeitas.has(a.chave)
                          if (a.tipo === 'noturno') {
                            return (
                              <li key={a.chave} className="flex flex-wrap items-center gap-1.5 text-xs">
                                <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                                {a.posicoes.map((p) => `${p.posicao} ${p.pessoa?.uid ? nomeCurto(p.pessoa.nome) : p.nome}`).join(' · ')}
                                <span className="text-muted-foreground">— só confere com o Pega Plantão, não muda a escala</span>
                              </li>
                            )
                          }
                          if (a.tipo === 'nao_reconhecido') {
                            return <li key={a.chave} className="text-xs text-muted-foreground">Não reconheci o que este recado pede — se mudar a escala, marque à mão na fila.</li>
                          }
                          const quem = a.pessoa?.uid ? nomeCurto(a.pessoa.nome) : a.pessoa?.mencao
                          const onde = a.hospital ? (rotulos[a.hospital] || a.hospital) : ''
                          return (
                            <li key={a.chave} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs ${a.estado === 'ambigua' ? 'flex-wrap border border-warning bg-warning/10 dark:bg-warning/15' : ''}`}>
                              {seloDaAcao(a, fimTurno)}
                              <b className="shrink-0">{quem}</b>
                              {a.tipo === 'troca' && a.parceiro && <span>com <b>{a.parceiro.uid ? nomeCurto(a.parceiro.nome) : a.parceiro.mencao}</b></span>}
                              {onde && <span className="min-w-0 truncate text-muted-foreground">· {onde}</span>}
                              {a.estado === 'pronta' && feita && (
                                <span className="ml-auto flex shrink-0 items-center gap-2">
                                  <span className="flex items-center gap-0.5 font-semibold text-success"><Check className="h-3.5 w-3.5" />aplicada</span>
                                  <button type="button" onClick={() => recados.desfazerAcao(a)} className="font-semibold text-muted-foreground underline">Desfazer</button>
                                </span>
                              )}
                              {a.estado === 'pronta' && desfeita && (
                                <span className="ml-auto flex items-center gap-2 text-muted-foreground">
                                  desfeita
                                  <button type="button" onClick={() => recados.reaplicarAcao(a)} className="font-semibold text-primary underline">Aplicar</button>
                                </span>
                              )}
                              {a.estado === 'ambigua' && (
                                <span className="flex w-full flex-wrap items-center gap-1.5 pt-0.5">
                                  <span className="text-muted-foreground">Quem é “{a.pessoa?.candidatos?.length ? a.pessoa.mencao : a.parceiro?.mencao}”?</span>
                                  {(a.pessoa?.candidatos?.length ? a.pessoa.candidatos : a.parceiro?.candidatos || []).map((c) => (
                                    <button key={c.uid} type="button"
                                      onClick={() => recados.escolherPessoa(a.pessoa?.candidatos?.length ? a.pessoa.mencao : a.parceiro.mencao, c.uid)}
                                      className="h-6 rounded-md border border-border-strong bg-card px-2 font-semibold">
                                      {nomeCurto(c.nome)}
                                    </button>
                                  ))}
                                </span>
                              )}
                              {(a.estado === 'sem_alvo' || a.estado === 'info') && (
                                <span className="ml-auto text-muted-foreground">{a.motivo || 'não está em nenhuma ordem deste lote — nada a marcar'}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}

// ── PRÉVIA E PUBLICAÇÃO ───────────────────────────────────────────────────────

export function PreviaPublicacao({
  hospitais, rotulos, resumos, resolver, trocasPorHospital, plano, publicados, resultados,
  publicandoAgora, contagem, data, turnoLabel, onPublicar, onDesfazer, onRepublicar, onFechar, onIrPara,
}) {
  const [vendo, setVendo] = useState(() => plano.publicar[0]?.hospital || hospitais[0])
  const fila = useMemo(
    () => filaDaPrevia(resumos[vendo], { resolver, trocas: trocasPorHospital[vendo] || [] }),
    [resumos, vendo, resolver, trocasPorHospital],
  )
  const nomes = (lista) => lista.map((h) => rotulos[h] || h).join(' e ')
  const vaiAoAr = plano.publicar.map((p) => p.hospital)
  return (
    <div className="absolute inset-x-0 bottom-0 top-14 z-30 flex flex-col bg-background" role="dialog" aria-label="Prévia da publicação">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
        <Eye className="h-5 w-5 text-primary" />
        <b className="text-[15px]">Prévia — {data} · {turnoLabel}</b>
        <span className="text-xs text-muted-foreground">confira como o grupo vai ver antes de publicar</span>
        <button type="button" onClick={onFechar} disabled={!!contagem || !!publicandoAgora}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-40">
          <X className="h-4 w-4" /> Voltar à conferência <kbd className="ml-1 rounded border border-current px-1 font-mono text-[10px] opacity-70">Esc</kbd>
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 overflow-hidden px-6 py-5">
        <div className="flex min-h-0 flex-col items-center">
          <div className="mb-2 flex gap-1 rounded-[10px] bg-muted p-[3px]" role="tablist">
            {hospitais.map((h) => (
              <button key={h} type="button" role="tab" aria-selected={vendo === h} onClick={() => setVendo(h)}
                className={`h-7 rounded-lg px-3 text-[12.5px] ${vendo === h ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}>
                {rotulos[h] || h}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-primary">Como o grupo vai ver no celular · Liberações</p>
          <div className="flex min-h-0 w-[390px] flex-1 flex-col overflow-hidden rounded-[30px] border-[8px] border-[#111] bg-background">
            <div className="flex h-11 shrink-0 items-center justify-center border-b border-border bg-card text-sm font-semibold">
              Liberações · {rotulos[vendo] || vendo} · {turnoLabel}
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
              {fila.map((l, k) => (
                <div key={`${l.nome}-${k}`} className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-[13.5px]">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{l.pos ?? '·'}</span>
                  <b className="min-w-0 flex-1 truncate font-semibold">{titleCaseNome(stripNotaRodape(l.nome))}</b>
                  {l.papel === 'plantonista' && <SeloMarca tipo="plantonista">Plantonista</SeloMarca>}
                  {l.local && <SeloMarca tipo="local">{l.local}</SeloMarca>}
                  {l.equipe && <SeloMarca tipo="equipe">Equipe</SeloMarca>}
                  {l.troca && <SeloMarca tipo="troca">Troca</SeloMarca>}
                  {l.ajuda && <SeloMarca tipo="ajuda">Ajuda</SeloMarca>}
                  {l.fora && <SeloMarca tipo="cauda">fora da ordem</SeloMarca>}
                  {!l.local && !l.equipe && !l.troca && !l.ajuda && l.papel !== 'plantonista' && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{l.sala || (l.casos ? '' : 'sem cirurgia')}</span>
                  )}
                </div>
              ))}
              {!fila.length && <p className="p-3 text-center text-xs text-muted-foreground">{rotulos[vendo] || vendo} sem ordem de liberação.</p>}
            </div>
          </div>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto">
          {hospitais.map((h) => {
            const r = resumos[h]
            const vai = vaiAoAr.includes(h)
            const subiu = publicados.includes(h)
            const res = resultados[h]
            const fora = plano.foraDoLote.find((f) => f.hospital === h)
            const linhas = filaDaPrevia(r, { resolver, trocas: trocasPorHospital[h] || [] })
            const conta = (pred) => linhas.filter(pred).length
            return (
              <section key={h} className={`rounded-xl border bg-card px-4 py-3 text-[13px] ${fora?.motivo === 'bloqueio' || (res && !res.ok) ? 'border-destructive/60' : 'border-border-strong'}`}>
                <h4 className="mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-primary">
                  {rotulos[h] || h}
                  <span className="font-semibold normal-case tracking-normal text-muted-foreground">
                    {publicandoAgora === h ? '· publicando…' : subiu ? `· publicada${res?.em ? ` às ${res.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}` : vai ? '· vai ao ar' : '· fica de fora'}
                  </span>
                  <button type="button" onClick={() => onIrPara(h)} className="ml-auto text-[11.5px] font-semibold normal-case tracking-normal text-primary">abrir na conferência</button>
                </h4>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" />{r?.totalCasos || 0} cirurgia{(r?.totalCasos || 0) === 1 ? '' : 's'} · {r?.ordemLiberacao?.length || 0} na ordem</li>
                  {conta((l) => l.local === 'Consultório') > 0 && <li className="flex items-center gap-2"><SeloMarca tipo="local">Consultório</SeloMarca>{conta((l) => l.local === 'Consultório')} pessoa(s)</li>}
                  {conta((l) => l.local === 'Sobreaviso') > 0 && <li className="flex items-center gap-2"><SeloMarca tipo="local">Sobreaviso</SeloMarca>{conta((l) => l.local === 'Sobreaviso')} pessoa(s)</li>}
                  {linhas.filter((l) => l.equipe).map((l) => <li key={`eq-${l.nome}`} className="flex items-center gap-2"><SeloMarca tipo="equipe">Equipe</SeloMarca>{titleCaseNome(l.nome)}</li>)}
                  {linhas.filter((l) => l.troca).map((l) => <li key={`tr-${l.nome}`} className="flex items-center gap-2"><SeloMarca tipo="troca">Troca</SeloMarca>{titleCaseNome(l.nome)} ↔ {nomeCurto(l.troca)} (registro)</li>)}
                  {linhas.filter((l) => l.ajuda).map((l) => <li key={`aj-${l.nome}`} className="flex items-center gap-2"><SeloMarca tipo="ajuda">Ajuda</SeloMarca>{titleCaseNome(l.nome)} — sai antes de todos</li>)}
                  {fora && (
                    <li className="flex items-start gap-2 text-destructive">
                      <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {fora.motivo === 'bloqueio' ? 'Tem bloqueio — resolva na conferência.' : fora.motivo === 'vazia' ? 'Sem cirurgias neste turno.' : fora.motivo === 'publicada' ? 'Já está no ar.' : fora.motivo === 'reservada' ? 'Mudou depois do rascunho — republicar é ação própria.' : 'Fica de fora.'}
                    </li>
                  )}
                  {r?.pendencias?.length > 0 && !subiu && r.pendencias.map((p) => <li key={p} className="text-xs text-muted-foreground">· {p}</li>)}
                  {res && !res.ok && res.mensagem && <li className="rounded-md border-l-[3px] border-destructive bg-destructive/10 px-2 py-1.5 text-xs text-foreground">{res.mensagem}</li>}
                </ul>
                {(subiu || fora?.motivo === 'republicar') && !publicandoAgora && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => onRepublicar(h)}>
                    <RefreshCw className="h-4 w-4" /> Republicar {rotulos[h] || h}
                  </Button>
                )}
              </section>
            )
          })}
          <div className="sticky bottom-0 space-y-2 bg-background pt-1">
            <Button className="w-full" size="lg" disabled={!vaiAoAr.length || !!contagem || !!publicandoAgora} onClick={() => onPublicar(plano.publicar)}>
              {publicandoAgora ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {vaiAoAr.length ? `Publicar ${nomes(vaiAoAr)}` : 'Nada pronto para publicar'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sem “Tem certeza?”: depois do clique há 10 segundos para desfazer, e nada é gravado antes disso.
              Cada hospital vai para a própria escala, como sempre.
            </p>
          </div>
        </div>
      </div>

      {contagem && (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-[#14211b] px-4 py-3 text-[13.5px] text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] dark:bg-[#e9f3ee] dark:text-[#0d1a14]" role="status">
          <Check className="h-4 w-4" />
          <span>{nomes(contagem.alvos.map((a) => a.hospital))} vão ao ar em <b className="tabular-nums">{contagem.restante} s</b></span>
          <span className="h-1 w-28 overflow-hidden rounded bg-white/20 dark:bg-black/15">
            <span className="block h-full bg-[#7fe0a0] transition-[width] duration-1000 ease-linear dark:bg-[#0a6b39]" style={{ width: `${(contagem.restante / 10) * 100}%` }} />
          </span>
          <button type="button" onClick={onDesfazer} className="flex items-center gap-1 font-extrabold text-[#7fe0a0] dark:text-[#0a6b39]">
            <Undo2 className="h-4 w-4" /> Desfazer
          </button>
        </div>
      )}
    </div>
  )
}


