/**
 * FIM DE SEMANA / FERIADO NO DESKTOP (dono 09/10/2026, modelo F escolhido em protótipo):
 * "configure as escalas de final de semana para que a publicação fique padronizada".
 *
 * A mesma disposição do dia útil (coluna de controle · conferência Por fila · documento
 * ao lado), com o que é só do FDS: os 6 turnos (sáb/dom × manhã/tarde/noite) na coluna,
 * a FILA ÚNICA do turno aberto com as cirurgias de cada pessoa e o HOSPITAL de cada uma,
 * P1–P12 numa faixa no topo, e o documento/mapas na coluna da direita.
 *
 * As regras NÃO mudam (estão em `ImportarEscalaFdsPage` e nas libs): fila única por turno,
 * ordem na direção do documento (1º → último a ser liberado; a inversão é uma só, na
 * publicação), ajuda nunca automática, P7/P8 de domingo só com eletiva. Toda gravação passa
 * pelas funções da página — este arquivo é só a superfície.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, ChevronLeft, Eye, FileText, ImageIcon, Keyboard,
  Loader2, Plus, Trash2, Undo2, Upload, X,
} from 'lucide-react'
import { Button, DatePicker } from '@/design-system'
import { HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { titleCaseNome, nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { gruposAnestesista, normNome, formatData } from './utils'
import { VisorFoto } from './LoteDesktop'

const TURNO_CURTO = { matutino: 'Manhã', vespertino: 'Tarde', noturno: 'Noite' }

/** Lista curta de pessoas com busca (mesmo padrão da conferência de dia útil). */
function Busca({ opcoes, onEscolher, placeholder = 'Nome ou apelido…' }) {
  const [q, setQ] = useState('')
  const sem = (x) => String(x || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const lista = useMemo(() => {
    const a = sem(q).trim()
    return (a ? opcoes.filter((o) => sem(`${o.label} ${o.busca || ''}`).includes(a)) : opcoes).slice(0, 8)
  }, [q, opcoes])
  return (
    <div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && lista[0]) { e.preventDefault(); onEscolher(lista[0]) } e.stopPropagation() }}
        className="h-9 w-full rounded-lg border-[1.5px] border-primary bg-card px-2.5 text-sm text-foreground outline-none" />
      <ul className="mt-1 max-h-60 overflow-y-auto">
        {lista.map((o) => (
          <li key={o.value}>
            <button type="button" onClick={() => onEscolher(o)} className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-sm hover:bg-primary/10">
              <span className="truncate">{o.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Pop({ aberto, onFechar, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) onFechar() }
    const esc = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto, onFechar])
  if (!aberto) return null
  return <div ref={ref} className={`absolute z-[1400] w-[320px] rounded-[14px] border border-border-strong bg-card p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${className}`}>{children}</div>
}

const Selo = ({ cls, children }) => <span className={`inline-flex h-[22px] shrink-0 items-center rounded-md px-1.5 text-[11px] font-bold ${cls}`}>{children}</span>

export default function FdsDesktop({ ctx }) {
  const {
    feriado, sabadoISO, domingoISO, datasSelecionadas, turnosOrdem, dias, mapas, listaMapas,
    planoMapas, gradeLida, bloqueiosGerais, carregando, publicando, canEdit,
  } = ctx
  const [sel, setSel] = useState(() => ({ iso: sabadoISO, turno: 'matutino' }))
  const [ladoDireito, setLadoDireito] = useState('documento') // 'documento' | id do mapa
  const [pop, setPop] = useState(null)
  const [rascNome, setRascNome] = useState('')
  const [previa, setPrevia] = useState(false)
  const [contagem, setContagem] = useState(null)
  const entradaDoc = useRef(null)
  const entradaMapas = useRef(null)

  // o fim de semana selecionado mudou: o turno aberto acompanha
  const iso = datasSelecionadas.includes(sel.iso) ? sel.iso : datasSelecionadas[0]
  const turno = turnosOrdem.includes(sel.turno) ? sel.turno : turnosOrdem[0]
  const dia = dias[iso]
  const tokens = dia ? ctx.ordemDoDia(dia, turno) : []

  // ── as cirurgias do turno, dos três hospitais, com o anestesista resolvido ──
  const casosDoTurno = useMemo(() => {
    const out = []
    for (const item of planoMapas) {
      if (item.data !== iso || item.turno !== turno) continue
      const atribuidos = ctx.casosDoItem(item)
      const chaves = gruposAnestesista(item.casos, item.hospital)
      const grupoDe = new Map()
      for (const g of chaves) for (const i of g.indices) grupoDe.set(i, g)
      atribuidos.forEach((c, i) => out.push({ c, item, grupo: grupoDe.get(i) }))
    }
    return out
  }, [planoMapas, iso, turno, ctx])

  const pessoas = useMemo(() => tokens.map((token, i) => {
    const pn = ctx.normalizarPn(ctx.tokenParaPn(dia, token))
    const nome = ctx.nomeDoToken(dia, token) || ''
    const uid = (pn ? ctx.logins[`${iso}|${pn}`] : null) || ctx.resolver(nome) || null
    return { i, token, pn, nome, uid }
  }), [tokens, dia, iso, ctx])

  const casosDe = (p) => casosDoTurno.filter(({ c }) => {
    if (c.semAnestesista) return false
    if (p.uid && c.anestesistaUserId === p.uid) return true
    return normNome(c.anestesista) === normNome(p.nome) || (!!p.uid && ctx.resolver(c.anestesista) === p.uid)
  })
  const daFila = new Set(pessoas.flatMap((p) => casosDe(p)))
  const semAnestesista = casosDoTurno.filter((x) => x.c.semAnestesista || /^\?*$/.test(String(x.c.anestesista || '').trim()))
  const foraDaFila = casosDoTurno.filter((x) => !daFila.has(x) && !semAnestesista.includes(x))

  const estadoTurno = (d, t) => {
    if (!dias[d]) return { txt: 'sem documento', cls: 'bg-muted text-muted-foreground' }
    const b = ctx.bloqueiosDe(d, t).length
    if (b) return { txt: `${b} bloqueio${b > 1 ? 's' : ''}`, cls: 'bg-destructive/15 text-destructive' }
    const n = planoMapas.filter((x) => x.data === d && x.turno === t).reduce((s, x) => s + x.casos.length, 0)
    return { txt: t === 'noturno' ? 'fila pronta' : (n ? `pronta · ${n} cir.` : 'pronta · sem mapa'), cls: 'bg-success/15 text-success' }
  }

  const atribuirGrupo = (item, grupo, uid) => {
    const mapa = mapas[item.mapaId]
    if (!mapa || !grupo) return
    const atual = mapa.atribuicoes?.[item.turno] || {}
    ctx.salvarMapa({
      ...mapa,
      atribuicoes: { ...mapa.atribuicoes, [item.turno]: { ...atual, [grupo.chave]: uid } },
      sugeridos: { ...mapa.sugeridos, [item.turno]: { ...(mapa.sugeridos?.[item.turno] || {}), [grupo.chave]: undefined } },
    }, { silencioso: true })
  }

  // ── teclado: ⌘↵ prévia · Esc fecha ──
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && gradeLida) { e.preventDefault(); setPrevia(true) }
      if (e.key === 'Escape' && previa && !contagem) setPrevia(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gradeLida, previa, contagem])

  // ── 10 s para desfazer: nada é gravado antes ──
  const publicarRef = useRef(ctx.publicar)
  publicarRef.current = ctx.publicar
  useEffect(() => {
    if (!contagem) return undefined
    if (contagem.restante <= 0) {
      setContagem(null) // eslint-disable-line react-hooks/set-state-in-effect
      publicarRef.current()
      return undefined
    }
    const t = setTimeout(() => setContagem((c) => (c ? { ...c, restante: c.restante - 1 } : c)), 1000)
    return () => clearTimeout(t)
  }, [contagem])

  const linhaCaso = (x, k, { comAnestesista = false } = {}) => (
    <div key={`${x.item.mapaId}-${k}-${x.c._lid || k}`}
      className="grid grid-cols-[44px_64px_120px_minmax(0,1fr)_160px] items-baseline gap-2 border-t border-border/55 py-[5px] pl-[46px] pr-3 text-[12.5px]">
      <span className="font-bold tabular-nums">{x.c.hora || '—'}</span>
      <span><span className="rounded bg-muted px-1.5 py-px text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{HOSPITAL_LABEL[x.item.hospital] || x.item.hospital}</span></span>
      <span className="truncate font-semibold text-primary">{x.c.sala || 'sem sala'}</span>
      <span className="truncate">{x.c.procedimento || '—'}{comAnestesista && x.c.anestesista ? <span className="text-muted-foreground"> · {titleCaseNome(x.c.anestesista)}</span> : null}</span>
      <span className="truncate text-muted-foreground">{x.c.cirurgiao ? nomeCirurgiaoCurto(x.c.cirurgiao) : ''}</span>
    </div>
  )

  const opcoesPessoa = ctx.opcoesPessoa
  const mapaDireita = ladoDireito !== 'documento' ? mapas[ladoDireito] : null
  const nTurnos = datasSelecionadas.length * (feriado ? 2 : 3)

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-background" data-no-swipe-back="true" data-testid="fds-desktop">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 shadow-sm">
        <button type="button" onClick={ctx.cancelar} aria-label="Cancelar" className="flex min-h-[44px] items-center gap-1 pr-2 text-primary">
          <ChevronLeft className="h-5 w-5" /><span className="text-sm font-medium">Cancelar</span>
        </button>
        <h1 className="text-base font-semibold">{feriado ? 'Feriado' : 'Fim de semana'}</h1>
        <span className="text-sm text-muted-foreground">{feriado ? formatData(sabadoISO) : `${formatData(sabadoISO)} e ${formatData(domingoISO)}`}</span>
        <input ref={entradaDoc} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ctx.importarImagem(f) }} />
        <input ref={entradaMapas} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) ctx.importarMapas(fs) }} />
        <Button variant="outline" disabled={carregando || !canEdit} onClick={() => entradaDoc.current?.click()}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {gradeLida ? (feriado ? 'Trocar lista' : 'Trocar documento') : (feriado ? 'Lista do feriado' : 'Documento do FDS')}
        </Button>
        <Button variant="outline" disabled={carregando || !canEdit} onClick={() => entradaMapas.current?.click()}>
          <Upload className="h-4 w-4" /> Mapas cirúrgicos
        </Button>
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {gradeLida ? (bloqueiosGerais.length ? `${bloqueiosGerais.length} bloqueio${bloqueiosGerais.length > 1 ? 's' : ''} para publicar` : `${nTurnos} turnos prontos`) : ''}
        </span>
        {canEdit && (
          <Button disabled={!gradeLida} onClick={() => setPrevia(true)}>
            <Eye className="h-4 w-4" /> Prévia e publicar <kbd className="ml-1 rounded border border-current px-1 font-mono text-[10px] opacity-70">⌘↵</kbd>
          </Button>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)_minmax(400px,32vw)]">
        {/* ── COLUNA: fim de semana, documento, mapas, turnos ── */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto border-r border-border bg-card px-3 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-primary">{feriado ? 'Qual feriado' : 'Qual fim de semana'}</p>
          <DatePicker
            className="w-full min-w-0"
            value={(() => { const [y, m, d] = String(sabadoISO || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
            onChange={(d) => { if (d) ctx.mudarData(d) }}
            placeholder={feriado ? 'Feriado' : 'Sábado'}
          />
          <button type="button" onClick={() => setLadoDireito('documento')}
            className={`rounded-[10px] border p-2 text-left text-[12px] ${ladoDireito === 'documento' ? 'border-primary bg-primary/[0.06]' : 'border-border'}`}>
            <span className="flex items-center gap-1.5 font-semibold">
              {gradeLida ? <Check className="h-4 w-4 text-success" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              {feriado ? 'Lista do feriado' : 'Documento do FDS'}
            </span>
            <span className="mt-0.5 block text-muted-foreground">{gradeLida ? ctx.resumoDocumento : 'ainda não anexado'}</span>
            {ctx.avisoDocumento && <span className="mt-0.5 block font-semibold text-foreground">{ctx.avisoDocumento}</span>}
          </button>
          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-primary">Mapas cirúrgicos</p>
          {!listaMapas.length && <p className="px-1 text-[12px] text-muted-foreground">Nenhum mapa ainda — anexe pelo botão no topo.</p>}
          {listaMapas.map((m) => (
            <div key={m.id} className={`rounded-[10px] border p-2 text-[12px] ${ladoDireito === m.id ? 'border-primary bg-primary/[0.06]' : m.confirmar?.length ? 'border-destructive/60' : 'border-border'}`}>
              <button type="button" onClick={() => setLadoDireito(m.id)} className="block w-full text-left">
                <b className="block">{m.hospital ? (HOSPITAL_LABEL[m.hospital] || m.hospital) : 'Hospital?'} · {m.data ? formatData(m.data) : 'dia?'}</b>
                <span className="text-muted-foreground">{ctx.resumoMapaTexto(m)}</span>
                {m.confirmar?.length > 0 && <span className="block font-semibold text-destructive">falta {m.confirmar.join(' e ')}</span>}
              </button>
              <span className="mt-1 flex gap-2">
                <button type="button" onClick={() => ctx.abrirMapa(m.id)} className="text-[11.5px] font-semibold text-primary">conferir</button>
                <button type="button" onClick={() => ctx.removerMapa(m.id)} className="text-[11.5px] font-semibold text-muted-foreground">remover</button>
              </span>
            </div>
          ))}
          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-primary">Turnos</p>
          {datasSelecionadas.map((d, k) => (
            <div key={d} className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {feriado ? `Feriado ${formatData(d)}` : `${k === 0 ? 'Sábado' : 'Domingo'} ${formatData(d)}`}
              </p>
              {turnosOrdem.map((t) => {
                const e = estadoTurno(d, t)
                const ativo = d === iso && t === turno
                return (
                  <button key={t} type="button" onClick={() => setSel({ iso: d, turno: t })} aria-pressed={ativo}
                    className={`flex h-8 w-full items-center gap-2 rounded-lg border px-2 text-left text-[13px] ${ativo ? 'border-primary bg-primary/[0.06] font-bold' : 'border-transparent hover:bg-muted/60'}`}>
                    {TURNO_CURTO[t]}
                    <span className={`ml-auto rounded-full px-2 py-px text-[10.5px] font-semibold ${e.cls}`}>{e.txt}</span>
                  </button>
                )
              })}
            </div>
          ))}
          <div className="mt-auto space-y-2 pt-2">
            {canEdit && <Button className="w-full" disabled={!gradeLida} onClick={() => setPrevia(true)}><Eye className="h-4 w-4" /> Prévia e publicar</Button>}
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Keyboard className="h-3.5 w-3.5" /> <kbd className="font-mono">⌘↵</kbd> prévia</p>
          </div>
        </aside>

        {/* ── CONFERÊNCIA: fila única do turno ── */}
        <main className="min-h-0 overflow-y-auto px-5 py-3">
          {!gradeLida ? (
            <div className="rounded-xl border-[1.5px] border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-7 w-7" />
              <p className="mb-3">
                {feriado
                  ? 'Anexe a foto da lista do feriado — é ela que traz a fila de liberação.'
                  : 'Anexe a foto do documento “ESCALA DE FINAL DE SEMANA” (sábado e domingo juntos) — é ele que traz P1–P12 e a fila de cada turno.'}
              </p>
              <div className="flex justify-center gap-2">
                <Button disabled={carregando || !canEdit} onClick={() => entradaDoc.current?.click()}>
                  {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {feriado ? 'Anexar lista' : 'Anexar documento'}
                </Button>
                <Button variant="outline" disabled={carregando || !canEdit} onClick={() => entradaMapas.current?.click()}>
                  <Upload className="h-4 w-4" /> Mapas cirúrgicos
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {bloqueiosGerais.length > 0 && (
                <div className="rounded-xl border border-l-4 border-destructive bg-destructive/10 px-3 py-2 dark:bg-destructive/15">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold"><AlertTriangle className="h-4 w-4 text-destructive" /> O que impede publicar</p>
                  <ul className="mt-1 space-y-0.5">
                    {bloqueiosGerais.slice(0, 6).map((b) => <li key={b} className="text-xs">· {b}</li>)}
                    {bloqueiosGerais.length > 6 && <li className="text-xs text-muted-foreground">e mais {bloqueiosGerais.length - 6}</li>}
                  </ul>
                </div>
              )}
              {ctx.avisos.map((a) => (
                <p key={a} className="flex items-start gap-2 rounded-lg border-l-4 border-warning bg-warning/10 px-3 py-2 text-xs dark:bg-warning/15">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {a}
                </p>
              ))}

              {/* P1–P12: vale o fim de semana inteiro (domingo herda o sábado) */}
              {!feriado && dia && (
                <div>
                  <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">Posições — {formatData(iso)} · clique para corrigir nome ou login</p>
                  <div className="grid grid-cols-6 gap-1">
                    {Object.keys(dia.posicoes || {}).filter((k) => ctx.normalizarPn(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).map((pn) => {
                      const nome = dia.posicoes[pn]
                      const uid = ctx.logins[`${iso}|${pn}`] || ''
                      const amb = !uid && !ctx.resolver(nome) && ctx.ambiguo(nome)
                      const r = uid ? ctx.rosterByUid.get(uid) : null
                      return (
                        <span key={pn} className="relative">
                          <button type="button" onClick={() => { setPop(`pn:${pn}`); setRascNome(nome || '') }}
                            className={`w-full rounded-lg border bg-card px-2 py-1 text-left text-[11.5px] leading-tight ${amb ? 'border-destructive/60' : 'border-border'}`}>
                            <b className="block text-[10.5px] text-primary">{pn}</b>
                            <span className="block truncate font-semibold">{nome || '—'}</span>
                            <span className={`block truncate text-[10px] ${amb ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{r ? nomeCirurgiaoCurto(r.nome) : amb ? 'escolha o login' : (ctx.resolver(nome) ? 'pelo apelido' : 'sem login')}</span>
                          </button>
                          <Pop aberto={pop === `pn:${pn}`} onFechar={() => setPop(null)} className="left-0 top-full mt-1">
                            <form onSubmit={(e) => { e.preventDefault(); ctx.setPosicao(iso, pn, rascNome); setPop(null) }}>
                              <p className="mb-1 text-xs font-bold">{pn} — nome no documento</p>
                              <input value={rascNome} onChange={(e) => setRascNome(e.target.value)} aria-label={`Nome de ${pn}`}
                                className="mb-2 h-9 w-full rounded-lg border border-border-strong bg-card px-2.5 text-sm" />
                            </form>
                            <p className="mb-1 text-xs font-bold">Login (vence o texto)</p>
                            <Busca opcoes={opcoesPessoa} onEscolher={(o) => { ctx.setLogin(iso, pn, o.value); setPop(null) }} />
                          </Pop>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-extrabold">Fila única · {feriado ? 'Feriado' : (iso === sabadoISO ? 'Sábado' : 'Domingo')} {TURNO_CURTO[turno].toLowerCase()}</h2>
                <span className="text-xs text-muted-foreground">
                  {feriado && turno === 'vespertino' ? 'a tarde publica a lista de trás para frente' : '1º → último a ser liberado, como no documento'} · {pessoas.length} pessoas · {casosDoTurno.length} cirurgias
                </span>
              </div>

              {semAnestesista.length > 0 && (
                <div className="rounded-[10px] border-[1.5px] border-warning bg-card">
                  <div className="flex h-[34px] items-center gap-2 px-2.5">
                    <AlertTriangle className="h-4 w-4 text-warning" /><b className="text-[13.5px]">Sem anestesista</b>
                    <span className="text-xs text-muted-foreground">{semAnestesista.length} cirurgia{semAnestesista.length > 1 ? 's' : ''} — escolha quem assume (por sala)</span>
                  </div>
                  {semAnestesista.map((x, k) => (
                    <div key={`sem-${k}`} className="relative flex items-center">
                      <div className="min-w-0 flex-1">{linhaCaso(x, k)}</div>
                      <button type="button" onClick={() => setPop(`sem:${k}`)} className="mr-2 h-[26px] shrink-0 rounded-md border border-dashed border-warning px-2 text-xs font-semibold">Quem assume?</button>
                      <Pop aberto={pop === `sem:${k}`} onFechar={() => setPop(null)} className="right-2 top-8">
                        <p className="mb-1.5 text-xs font-bold">Quem assume {x.c.sala} ({HOSPITAL_LABEL[x.item.hospital]})?</p>
                        <Busca opcoes={opcoesPessoa} onEscolher={(o) => { atribuirGrupo(x.item, x.grupo, o.value); setPop(null) }} />
                      </Pop>
                    </div>
                  ))}
                </div>
              )}

              {pessoas.map((p, idx) => {
                const meus = casosDe(p)
                const r = p.uid ? ctx.rosterByUid.get(p.uid) : null
                return (
                  <div key={`${p.token}-${idx}`} data-testid="fds-fila-pessoa" className="group relative rounded-[10px] border border-border bg-card">
                    <div className="flex h-[34px] items-center gap-2 pl-2 pr-1.5">
                      <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{idx + 1}º</span>
                      {p.pn && <span className="rounded bg-primary/10 px-1.5 py-px text-[10.5px] font-extrabold text-primary">{p.pn}</span>}
                      <b className={`truncate text-[13.5px] ${p.nome ? '' : 'text-destructive'}`}>{p.nome ? String(p.nome).toUpperCase() : 'sem pessoa'}</b>
                      {r && <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">{titleCaseNome(r.nome)}</span>}
                      <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" aria-label="Subir" disabled={idx === 0} onClick={() => ctx.moverOrdem(iso, turno, idx, -1)} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label="Descer" disabled={idx === pessoas.length - 1} onClick={() => ctx.moverOrdem(iso, turno, idx, 1)} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" aria-label="Remover da fila" onClick={() => ctx.removerOrdem(iso, turno, idx)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </span>
                    </div>
                    {meus.length
                      ? meus.map((x, k) => linhaCaso(x, k))
                      : <div className="border-t border-border/55 py-[5px] pl-[46px] text-[12.5px] italic text-muted-foreground">{turno === 'noturno' ? 'plantão da noite' : 'sem cirurgia neste turno'}</div>}
                  </div>
                )
              })}

              <div className="relative">
                <button type="button" onClick={() => setPop('add')} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-primary hover:bg-muted">
                  <Plus className="h-4 w-4" /> Acrescentar no fim da fila
                </button>
                <Pop aberto={pop === 'add'} onFechar={() => setPop(null)} className="left-0 top-9">
                  <Busca opcoes={opcoesPessoa} onEscolher={(o) => { ctx.acrescentar(iso, turno, o.value); setPop(null) }} />
                </Pop>
              </div>

              {foraDaFila.length > 0 && (
                <div className="rounded-[10px] border border-warning/70 bg-card">
                  <div className="flex h-[34px] items-center gap-2 px-2.5">
                    <AlertTriangle className="h-4 w-4 text-warning" /><b className="text-[13.5px]">Com cirurgia e fora desta fila</b>
                    <span className="text-xs text-muted-foreground">o nome do mapa não está na fila do turno — confira o documento ou acrescente</span>
                  </div>
                  {foraDaFila.map((x, k) => linhaCaso(x, k, { comAnestesista: true }))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── DOCUMENTO / MAPA ── */}
        <aside className="flex min-h-0 flex-col border-l border-border px-3 py-3">
          <div className="mb-2 flex shrink-0 gap-1 overflow-x-auto rounded-[10px] bg-muted p-[3px]" role="tablist">
            <button type="button" role="tab" aria-selected={ladoDireito === 'documento'} onClick={() => setLadoDireito('documento')}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ${ladoDireito === 'documento' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
              <FileText className="h-4 w-4" /> Documento
            </button>
            {listaMapas.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={ladoDireito === m.id} onClick={() => setLadoDireito(m.id)}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ${ladoDireito === m.id ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                <ImageIcon className="h-4 w-4" /> {HOSPITAL_LABEL[m.hospital] || '?'} {m.data ? m.data.slice(8, 10) : ''}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {ladoDireito === 'documento'
              ? <VisorFoto arquivo={ctx.docArquivo} nome={ctx.docArquivo?.name || ''} hospitalLabel={feriado ? 'lista do feriado' : 'documento do FDS'} />
              : <VisorFoto arquivo={mapaDireita?.arquivo || null} nome={mapaDireita?.nome || ''} hospitalLabel={mapaDireita ? (HOSPITAL_LABEL[mapaDireita.hospital] || '') : ''} />}
          </div>
        </aside>
      </div>

      {previa && (
        <div className="absolute inset-x-0 bottom-0 top-14 z-30 flex flex-col bg-background" role="dialog" aria-label="Prévia da publicação do fim de semana">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
            <Eye className="h-5 w-5 text-primary" />
            <b className="text-[15px]">Prévia — {feriado ? `feriado ${formatData(sabadoISO)}` : `fim de semana ${formatData(sabadoISO)} e ${formatData(domingoISO)}`}</b>
            <span className="text-xs text-muted-foreground">a fila de cada turno como o grupo vai ver (1º = plantonista; o último sai primeiro)</span>
            <button type="button" disabled={!!contagem || publicando} onClick={() => setPrevia(false)}
              className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-40">
              <X className="h-4 w-4" /> Voltar à conferência
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className={`grid gap-3 ${feriado ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {datasSelecionadas.flatMap((d, k) => turnosOrdem.map((t) => {
                const lista = ctx.filaPublicada(d, t)
                return (
                  <section key={`${d}-${t}`} className="rounded-xl border border-border-strong bg-card p-3">
                    <h4 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-primary">
                      {feriado ? 'Feriado' : (k === 0 ? 'Sábado' : 'Domingo')} · {TURNO_CURTO[t]}
                    </h4>
                    <ol className="space-y-0.5 text-[12.5px]">
                      {lista.map((n, i) => (
                        <li key={`${n}-${i}`} className="flex gap-2"><span className="w-5 text-right tabular-nums text-muted-foreground">{i + 1}</span><b className="font-semibold">{titleCaseNome(n)}</b>
                          {i === 0 && <span className="rounded bg-primary px-1 text-[10px] font-bold text-primary-foreground">plantonista</span>}
                          {i === lista.length - 1 && lista.length > 1 && <span className="rounded bg-muted px-1 text-[10px] font-bold">sai 1º</span>}
                        </li>
                      ))}
                      {!lista.length && <li className="text-muted-foreground">sem fila</li>}
                    </ol>
                    {ctx.bloqueiosDe(d, t).map((b) => <p key={b} className="mt-1 text-xs font-semibold text-destructive">{b}</p>)}
                  </section>
                )
              }))}
            </div>
            <p className="mt-3 text-sm">{ctx.resumoPublicacao}</p>
          </div>
          <div className="shrink-0 border-t border-border px-6 py-3">
            <Button className="w-full" size="lg" disabled={!!bloqueiosGerais.length || !!contagem || publicando || !canEdit}
              onClick={() => setContagem({ restante: 10 })}>
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {bloqueiosGerais.length ? 'Resolva os bloqueios para publicar' : (feriado ? 'Publicar feriado' : 'Publicar fim de semana')}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">Depois do clique há 10 segundos para desfazer — nada é gravado antes disso.</p>
          </div>
          {contagem && (
            <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-[#14211b] px-4 py-3 text-[13.5px] text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] dark:bg-[#e9f3ee] dark:text-[#0d1a14]" role="status">
              <Check className="h-4 w-4" />
              <span>{feriado ? 'O feriado vai' : 'O fim de semana vai'} ao ar em <b className="tabular-nums">{contagem.restante} s</b></span>
              <button type="button" onClick={() => setContagem(null)} className="flex items-center gap-1 font-extrabold text-[#7fe0a0] dark:text-[#0a6b39]">
                <Undo2 className="h-4 w-4" /> Desfazer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
