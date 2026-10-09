/**
 * CONFERÊNCIA NO DESKTOP (dono 09/10/2026, modelo C escolhido em protótipo —
 * `.tmp/desktop-publicacao/`). Só a partir de 1280 px; no celular e no tablet a
 * conferência de sempre segue intacta.
 *
 * Duas formas de ver os MESMOS dados, alternadas com V:
 *   - **Por fila** (abre assim — escolha do dono): cada pessoa do rodapé, na ordem de
 *     liberação, com as cirurgias dela embaixo (hora · sala · procedimento · cirurgião) e
 *     as marcas na linha do nome. É o agrupamento da aba Liberações: o que se confere é o
 *     que o grupo vai ver.
 *   - **Por sala**: a planilha na ordem da foto, para conferir linha a linha.
 *
 * Toda gravação passa pelas funções da `ImportarEscalaPage` (mesmo estado, mesma
 * publicação): este arquivo é só a superfície. Teclado é acelerador por cima de uma tela
 * que funciona no mouse (NN/g); a tecla aparece escrita ao lado de cada ação.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, Check, ChevronDown, Keyboard, Pencil,
  Plus, Search, Trash2, UserPlus, Users,
} from 'lucide-react'
import { Input } from '@/design-system'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import { ehPosicaoAssistencial } from '@/lib/escalaCirurgicaItens'
import { iniciaisSeguras, INICIAIS_MAX } from '@/lib/escalaCirurgicaPaciente'
import { MOD, ALT } from './teclasPlataforma'

// ── tinta das marcas: as MESMAS da fila publicada (LiberacoesView) ────────────
const TINTA_MARCA = {
  plantonista: 'bg-primary text-primary-foreground',
  sai1: 'bg-muted text-foreground',
  ajuda: 'bg-info text-white',
  troca: 'bg-category-indigo text-white',
  equipe: 'bg-category-cyan-fg text-category-cyan-foreground',
  local: 'border border-category-orange/45 bg-category-orange-bg text-category-orange-fg',
  intencional: 'border border-border-strong bg-card text-foreground',
  cauda: 'border border-warning/60 bg-warning/10 text-foreground dark:bg-warning/15',
}

export function SeloMarca({ tipo, children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px] font-bold ${TINTA_MARCA[tipo] || TINTA_MARCA.intencional}`}
    >
      {children}
    </span>
  )
}

const Tecla = ({ children }) => (
  <kbd className="ml-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded border border-current px-1 font-mono text-[10px] font-semibold opacity-70">
    {children}
  </kbd>
)

/** Busca de pessoa do cadastro — lista própria (o Select do DS herda a largura do gatilho). */
function BuscaPessoa({ opcoes, onEscolher, placeholder = 'Nome ou apelido…', autoFocus = true, primeiro = [] }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const filtradas = useMemo(() => {
    const alvo = q.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
    const sem = (x) => String(x || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    // quem COMEÇA pelo que foi digitado vem antes de quem só contém (digitar "Henrique"
    // não pode pôr o Fernando Henrique na frente do João Henrique por acaso de ordem)
    const nota = (o) => {
      if (!alvo) return 0
      const tudo = sem(`${o.label} ${o.busca || ''}`)
      if (sem(o.label).startsWith(alvo)) return 0
      if (tudo.split(/\s+/).some((w) => w.startsWith(alvo))) return 1
      return tudo.includes(alvo) ? 2 : 9
    }
    const destaque = new Set(primeiro)
    return opcoes
      .map((o, k) => ({ o, k, n: destaque.has(o.value) ? -1 : nota(o) }))
      .filter((x) => x.n < 9)
      .sort((a, b) => a.n - b.n || a.k - b.k)
      .map((x) => x.o)
      .slice(0, 8)
  }, [q, opcoes, primeiro])
  return (
    <div>
      <div className="flex h-9 items-center gap-2 rounded-lg border-[1.5px] border-primary bg-card px-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtradas.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
            // ⌘↵ é o atalho da prévia; sem nada digitado e sem seta, Enter não escolhe ninguém
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && (q.trim() || sel > 0) && filtradas[sel]) { e.preventDefault(); onEscolher(filtradas[sel]) }
            e.stopPropagation()
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <ul className="mt-1 max-h-64 overflow-y-auto" role="listbox">
        {filtradas.map((o, k) => (
          <li key={o.value}>
            <button
              type="button"
              role="option"
              aria-selected={k === sel}
              onMouseEnter={() => setSel(k)}
              onClick={() => onEscolher(o)}
              className={`flex h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm ${k === sel ? 'bg-primary/10 font-semibold' : ''}`}
            >
              <span className="truncate">{o.label}</span>
              {o.dica && <span className="shrink-0 text-[11px] text-muted-foreground">{o.dica}</span>}
            </button>
          </li>
        ))}
        {!filtradas.length && <li className="px-2.5 py-2 text-xs text-muted-foreground">Ninguém com esse nome no cadastro.</li>}
      </ul>
    </div>
  )
}

/** Popover simples (z do popover do DS: 1400) que fecha com Esc e clique fora. */
function Popover({ aberto, onFechar, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) onFechar() }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar() } }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc, true) }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div ref={ref} className={`absolute z-[1400] w-[340px] rounded-[14px] border border-border-strong bg-card p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${className}`}>
      {children}
    </div>
  )
}

/** Uma linha de cirurgia — leitura; clique abre a edição na própria linha. */
function LinhaCaso({ c, i, editando, onEditar, comAnestesista = null, compacta = false }) {
  const pos = ehPosicaoAssistencial(c)
  return (
    <button
      type="button"
      onClick={() => onEditar(i)}
      aria-label={`Editar ${c.sala || 'sem sala'} ${c.hora || ''} ${c.procedimento || ''}`.trim()}
      className={`grid w-full items-baseline gap-2 border-t border-border/55 py-[5px] pl-[46px] pr-3 text-left text-[12.5px] hover:bg-primary/[0.05]
        ${compacta ? 'grid-cols-[44px_110px_minmax(0,1fr)]' : 'grid-cols-[44px_110px_minmax(0,1fr)_170px_64px]'}
        ${editando ? 'bg-primary/[0.06]' : ''}`}
    >
      <span className="font-bold tabular-nums">{c.hora || '—'}</span>
      <span className="truncate font-semibold text-primary">{c.sala || 'sem sala'}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{pos ? 'Posição assistencial' : (c.procedimento || <span className="text-muted-foreground">sem procedimento</span>)}</span>
        {comAnestesista && <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">· {comAnestesista}</span>}
      </span>
      {!compacta && <span className="truncate text-muted-foreground">{c.cirurgiao || ''}</span>}
      {!compacta && <span className="truncate text-[11px] text-muted-foreground">{c.pacienteIniciais || ''}</span>}
    </button>
  )
}

/** A mesma linha, aberta para edição (Enter fecha · Esc fecha · Tab passa de campo). */
function EdicaoCaso({ c, i, ctx, onFechar }) {
  const pos = ehPosicaoAssistencial(c)
  const [mover, setMover] = useState(false)
  return (
    <div
      className="border-t border-border/55 bg-primary/[0.04] py-2 pl-[46px] pr-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && e.target.tagName === 'INPUT')) { e.preventDefault(); e.stopPropagation(); onFechar() }
      }}
    >
      {/* duas linhas: hora · sala · iniciais em cima, procedimento · cirurgião embaixo — numa
          linha só, a 1280 px, o procedimento ficava com 60 px */}
      <div className="grid grid-cols-[96px_minmax(0,1fr)_110px_36px] items-start gap-1.5 [--ds-input-py:8px]">
        <Input aria-label="Hora" placeholder="Hora" value={c.hora || ''} autoFocus inputMode="numeric" autoComplete="off"
          onChange={(e) => ctx.setCampo(i, 'hora', e.target.value)} />
        <div>{ctx.renderSala(c.sala, (v) => ctx.commitSala(i, v))}</div>
        {!pos ? (
          <Input aria-label="Iniciais do paciente" placeholder="Iniciais" value={c.pacienteIniciais || ''}
            maxLength={INICIAIS_MAX} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            onChange={(e) => ctx.setCampo(i, 'pacienteIniciais', e.target.value)}
            onBlur={(e) => ctx.setCampo(i, 'pacienteIniciais', iniciaisSeguras(e.target.value))} />
        ) : <span />}
        <button type="button" onClick={() => { ctx.removeLinha(i); onFechar() }}
          aria-label="Remover esta cirurgia" title="Remover esta cirurgia"
          className="flex h-11 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {!pos && (
        <div className="mt-1.5 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_36px] gap-1.5 [--ds-input-py:8px]">
          <Input aria-label="Procedimento" placeholder="Procedimento" value={c.procedimento || ''}
            onChange={(e) => ctx.setCampo(i, 'procedimento', e.target.value)} />
          <Input aria-label="Cirurgião" placeholder="Cirurgião" value={c.cirurgiao || ''}
            onChange={(e) => ctx.setCampo(i, 'cirurgiao', e.target.value)} />
          <span />
        </div>
      )}
      <div className="relative mt-1.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>Enter ou Esc fecha · Tab vai ao próximo campo · as mudanças já valem</span>
        <span className="ml-auto" />
        <button type="button" onClick={() => setMover(true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-card px-2.5 text-xs font-semibold text-foreground">
          <ArrowLeftRight className="h-3.5 w-3.5" /> Mover para outra pessoa…
        </button>
        <button type="button" onClick={onFechar}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
          <Check className="h-3.5 w-3.5" /> Pronto
        </button>
        <Popover aberto={mover} onFechar={() => setMover(false)} className="right-0 top-8">
          <p className="mb-1.5 text-xs font-bold">Quem faz esta cirurgia?</p>
          <BuscaPessoa
            opcoes={[{ value: ctx.SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...ctx.opcoesPessoa]}
            onEscolher={(o) => { ctx.definirAnestesistaCaso(i, o.value); setMover(false); onFechar() }}
          />
        </Popover>
      </div>
    </div>
  )
}

/**
 * @param {object} props.ctx — tudo o que a `ImportarEscalaPage` expõe para a superfície
 *   (estado derivado + funções de gravação). Ver a montagem lá.
 */
export default function ConferenciaDesktop({ ctx, ativa = true }) {
  const [modo, setModo] = useState('fila') // decisão do dono 09/10: abre em Por fila
  const [editando, setEditando] = useState(null) // `_lid` da linha aberta (o índice muda ao editar)
  const [selecionada, setSelecionada] = useState(0) // posição da fila com foco de teclado
  const [marcador, setMarcador] = useState(null) // chave da pessoa com o menu aberto
  const [passoMarcador, setPassoMarcador] = useState(null) // 'troca' | 'trocarPor' | 'nome'
  const [rascNome, setRascNome] = useState('')
  const raiz = useRef(null)

  const { vis, casos, casosAtrib } = ctx
  const pessoas = vis.pessoas

  const abrir = (i) => setEditando(casos[i]?._lid || null)
  const aberta = (i) => !!editando && casos[i]?._lid === editando
  // "+ Cirurgia" devolve o `_lid` da linha nova: ela nasce aberta para preencher
  const novaCirurgia = (p) => { const lid = ctx.addCirurgia(p); if (lid) setEditando(lid) }

  const fecharMarcador = () => { setMarcador(null); setPassoMarcador(null) }

  // ── TECLADO ────────────────────────────────────────────────────────────────
  // Só a aba visível escuta; nada dispara com o foco num campo de texto.
  useEffect(() => {
    if (!ativa) return undefined
    const onKey = (e) => {
      const alvo = e.target
      const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)
      if (digitando || e.metaKey || e.ctrlKey) return
      if (document.querySelector('[role="dialog"]')) return
      const p = pessoas[selecionada]
      const k = e.key.toLowerCase()
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && p) {
        e.preventDefault()
        const d = e.key === 'ArrowUp' ? -1 : 1
        ctx.moverPosicao(p.pos, d)
        setSelecionada((s) => Math.max(0, Math.min(pessoas.length - 1, s + d)))
        return
      }
      if (e.altKey) return
      if (k === 'v') { e.preventDefault(); setModo((m) => (m === 'fila' ? 'sala' : 'fila')); return }
      if (k === 'n') { e.preventDefault(); novaCirurgia(null); return }
      if (modo !== 'fila') return
      if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelecionada((s) => Math.min(pessoas.length - 1, s + 1)); return }
      if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelecionada((s) => Math.max(0, s - 1)); return }
      if (!p) return
      if (e.key === 'Enter') { e.preventDefault(); setMarcador(p.chave); return }
      if (k === 'e') { e.preventDefault(); ctx.alternarEquipe(p); return }
      if (k === 'a') { e.preventDefault(); ctx.alternarAjuda(p); return }
      if (k === 'c') { e.preventDefault(); ctx.alternarNota(p, 'CONSULT'); return }
      if (k === 's') { e.preventDefault(); ctx.alternarNota(p, 'SOBREAVISO'); return }
      if (k === 't') { e.preventDefault(); setMarcador(p.chave); setPassoMarcador('troca') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- novaCirurgia lê o ctx do render
  }, [ativa, pessoas, selecionada, modo, ctx])

  // a pessoa selecionada acompanha a rolagem
  useEffect(() => {
    if (modo !== 'fila') return
    raiz.current?.querySelector?.(`[data-pos="${selecionada}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [selecionada, modo])

  const rotuloPessoa = (p) => {
    const r = p.uid ? ctx.rosterByUid.get(p.uid) : null
    return { curto: String(p.nome || '').toUpperCase(), completo: r?.nome && r.nome.toUpperCase() !== String(p.nome).toUpperCase() ? titleCaseNome(r.nome) : '' }
  }

  const linhasDe = (indices, { comAnestesista = false } = {}) => indices.map((i) => {
    const c = casos[i]
    if (!c) return null
    if (aberta(i)) return <EdicaoCaso key={c._lid || i} c={c} i={i} ctx={ctx} onFechar={() => setEditando(null)} />
    return (
      <LinhaCaso key={c._lid || i} c={c} i={i} editando={false} onEditar={abrir}
        comAnestesista={comAnestesista ? ctx.nomeDoCaso(casosAtrib[i]) : null} />
    )
  })

  const marcadorMenu = (p) => {
    const m = ctx.marcasDe(p)
    const opcoes = [
      { k: 'E', tom: 'bg-category-cyan-fg', titulo: m.equipe ? `Tirar "Equipe até ${ctx.fimTurno}"` : `Equipe do ${ctx.hospitalLabel} até ${ctx.fimTurno}`, sub: 'veio de outro hospital — não é ajuda nem troca', on: m.equipe, fazer: () => ctx.alternarEquipe(p) },
      { k: 'T', tom: 'bg-category-indigo', titulo: m.troca ? `Troca com ${m.troca} — refazer` : 'Troca com…', sub: 'registro — a foto já saiu trocada', on: !!m.troca, fazer: () => setPassoMarcador('troca') },
      { k: 'A', tom: 'bg-info', titulo: m.ajuda ? 'Tirar ajuda' : 'Ajuda', sub: 'vai ao fim da fila e sai primeiro', on: m.ajuda, fazer: () => ctx.alternarAjuda(p) },
      { k: 'C', tom: 'bg-category-orange', titulo: m.local === 'Consultório' ? 'Tirar consultório' : 'Consultório', sub: 'ocupa a posição, não nasce liberado', on: m.local === 'Consultório', fazer: () => ctx.alternarNota(p, 'CONSULT') },
      { k: 'S', tom: 'bg-muted-foreground', titulo: m.local === 'Sobreaviso' ? 'Tirar sobreaviso' : 'Sobreaviso', sub: 'ocupa a posição, não nasce liberado', on: m.local === 'Sobreaviso', fazer: () => ctx.alternarNota(p, 'SOBREAVISO') },
    ]
    if (passoMarcador === 'troca') {
      return (
        <>
          <p className="mb-1 text-xs font-bold">{rotuloPessoa(p).curto} trocou com quem?</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Registro de troca que já aconteceu — badge nos dois lados, ninguém muda de lugar.</p>
          <BuscaPessoa opcoes={ctx.opcoesPessoa.filter((o) => o.value !== p.uid)}
            onEscolher={(o) => { ctx.registrarTroca(p, o.value); fecharMarcador() }} />
          {m.troca && (
            <button type="button" onClick={() => { ctx.desfazerTroca(p); fecharMarcador() }}
              className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-destructive hover:bg-destructive/10">
              Tirar o registro da troca
            </button>
          )}
        </>
      )
    }
    if (passoMarcador === 'trocarPor') {
      return (
        <>
          <p className="mb-1 text-xs font-bold">As cirurgias de {rotuloPessoa(p).curto} passam para…</p>
          <p className="mb-2 text-[11px] text-muted-foreground">A posição na ordem não muda — para trocar o nome da posição use “Corrigir o nome”.</p>
          <BuscaPessoa opcoes={[{ value: ctx.SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...ctx.opcoesPessoa.filter((o) => o.value !== p.uid)]}
            onEscolher={(o) => { ctx.reatribuirCasos(p.indices, o.value); fecharMarcador() }} />
        </>
      )
    }
    if (passoMarcador === 'nome') {
      return (
        <form onSubmit={(e) => { e.preventDefault(); ctx.renomearNaOrdem(p.pos, rascNome); fecharMarcador() }}>
          <p className="mb-1.5 text-xs font-bold">Nome na {p.pos + 1}ª posição</p>
          <Input autoFocus aria-label={`Nome na posição ${p.pos + 1}`} value={rascNome} onChange={(e) => setRascNome(e.target.value)} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Enter grava. Corrige o que a leitura escreveu torto no rodapé.</p>
        </form>
      )
    }
    return (
      <>
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <p className="text-xs font-bold">Marcar {rotuloPessoa(p).curto}</p>
          <span className="text-[11px] text-muted-foreground">{ctx.hospitalLabel} · {ctx.turnoLabel}</span>
        </div>
        {opcoes.map((o) => (
          <button key={o.k} type="button" onClick={() => { o.fazer(); if (o.k !== 'T') fecharMarcador() }}
            className={`grid h-11 w-full grid-cols-[24px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left hover:bg-muted ${o.on ? 'bg-primary/[0.07]' : ''}`}>
            <span className={`h-[18px] w-[18px] rounded-[5px] ${o.tom}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-4">{o.titulo}{o.on && <Check className="ml-1 inline h-3.5 w-3.5 text-primary" />}</span>
              <span className="block truncate text-[11px] leading-4 text-muted-foreground">{o.sub}</span>
            </span>
            <Tecla>{o.k}</Tecla>
          </button>
        ))}
        <div className="my-1.5 border-t border-border" />
        <div className="grid grid-cols-2 gap-1">
          <button type="button" disabled={p.pos === 0} onClick={() => ctx.moverPosicao(p.pos, -1)}
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold hover:bg-muted disabled:opacity-40">
            <ArrowUp className="h-3.5 w-3.5" /> Subir <Tecla>{ALT}↑</Tecla>
          </button>
          <button type="button" disabled={p.pos === pessoas.length - 1} onClick={() => ctx.moverPosicao(p.pos, 1)}
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold hover:bg-muted disabled:opacity-40">
            <ArrowDown className="h-3.5 w-3.5" /> Descer <Tecla>{ALT}↓</Tecla>
          </button>
          <button type="button" onClick={() => { setRascNome(ctx.nomeNaOrdem(p.pos)); setPassoMarcador('nome') }}
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Corrigir o nome
          </button>
          {p.indices.length > 0 ? (
            <button type="button" onClick={() => setPassoMarcador('trocarPor')}
              className="flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold hover:bg-muted">
              <Users className="h-3.5 w-3.5" /> Passar cirurgias…
            </button>
          ) : (
            <button type="button" onClick={() => { ctx.removerDaOrdem(p.pos); fecharMarcador() }}
              className="flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Remover da ordem
            </button>
          )}
        </div>
      </>
    )
  }

  const cartaoPessoa = (p, idx) => {
    const m = ctx.marcasDe(p)
    const nome = rotuloPessoa(p)
    const sel = selecionada === idx
    return (
      <div key={`${p.chave}-${p.pos}`} data-pos={idx}
        className={`relative mb-[5px] rounded-[10px] border bg-card
          ${sel ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary))]' : m.equipe ? 'border-category-cyan-fg/70' : 'border-border'}`}>
        <div className="group flex h-[34px] items-center gap-2 pl-2 pr-1.5">
          <button type="button" onClick={() => setSelecionada(idx)} aria-label={`Selecionar ${nome.curto}`}
            className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left">
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{p.pos + 1}</span>
            <span className="truncate text-[13.5px] font-bold">{nome.curto}</span>
            {nome.completo && <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">{nome.completo}</span>}
          </button>
          <span className="flex shrink-0 items-center gap-1">
            {p.papel === 'plantonista' && <SeloMarca tipo="plantonista">Plantonista</SeloMarca>}
            {m.local && <SeloMarca tipo="local">{m.local}{m.horaLocal ? ` ${m.horaLocal}` : ''}</SeloMarca>}
            {m.equipe && <SeloMarca tipo="equipe">Equipe até {ctx.fimTurno}</SeloMarca>}
            {m.troca && <SeloMarca tipo="troca"><ArrowLeftRight className="h-3 w-3" />{m.troca}</SeloMarca>}
            {m.ajuda && <SeloMarca tipo="ajuda">Ajuda</SeloMarca>}
            {m.intencional && <SeloMarca tipo="intencional">Nos dois hospitais</SeloMarca>}
            {p.papel === 'sai1' && <SeloMarca tipo="sai1">sai 1º</SeloMarca>}
            {m.cauda && <SeloMarca tipo="cauda" title="Sem cirurgia no fim da ordem: na fila publicada nasce liberado">nasce liberado</SeloMarca>}
            <button type="button" onClick={() => { setSelecionada(idx); setMarcador(p.chave); setPassoMarcador(null) }}
              aria-label={`Marcar ${nome.curto}`} title="Marcar (Enter)"
              className={`inline-flex h-[26px] items-center gap-1 rounded-md border border-border-strong bg-card px-2 text-xs font-semibold text-foreground
                ${sel ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}>
              Marcar <ChevronDown className="h-3 w-3" />
            </button>
          </span>
        </div>
        <Popover aberto={marcador === p.chave} onFechar={fecharMarcador} className="right-2 top-9">
          {marcadorMenu(p)}
        </Popover>
        {p.indices.length > 0 ? linhasDe(p.indices) : (
          <div className="flex items-center gap-2 border-t border-border/55 py-[5px] pl-[46px] pr-3 text-[12.5px] italic text-muted-foreground">
            sem cirurgia neste turno
            {m.perguntaSemCirurgia && (
              <button type="button" onClick={() => ctx.abrirSemCirurgia(m.perguntaSemCirurgia)}
                className="ml-auto inline-flex h-6 items-center gap-1 rounded-md border border-warning/60 px-2 text-[11.5px] font-semibold not-italic text-foreground">
                <span className="h-2 w-2 rounded-full bg-warning" /> Onde está hoje?
              </button>
            )}
          </div>
        )}
        <button type="button" onClick={() => novaCirurgia(p)}
          className="hidden w-full items-center gap-1.5 border-t border-dashed border-border py-1 pl-[46px] text-left text-xs font-semibold text-primary [div:hover>&]:flex">
          <Plus className="h-3.5 w-3.5" /> Cirurgia para {titleCaseNome(p.nome)}
        </button>
      </div>
    )
  }

  // ── POR SALA: a planilha na ordem da foto ────────────────────────────────────
  const porSala = () => (
    <div className="overflow-hidden rounded-[10px] border border-border-strong bg-card text-[12.5px]">
      <div className="grid h-7 grid-cols-[52px_130px_minmax(0,1fr)_170px_220px] items-center gap-2 bg-muted px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>Hora</span><span>Sala</span><span>Procedimento</span><span>Cirurgião</span><span>Anestesista · posição</span>
      </div>
      {ctx.grupos.map((g) => g.indices.map((i, k) => {
        const c = casos[i]
        if (!c) return null
        if (aberta(i)) return <EdicaoCaso key={c._lid || i} c={c} i={i} ctx={ctx} onFechar={() => setEditando(null)} />
        const a = casosAtrib[i]
        const nome = ctx.nomeDoCaso(a)
        const posicao = ctx.posicaoDe(a)
        const vazio = !nome
        return (
          <div key={c._lid || i} className={`grid h-[31px] grid-cols-[52px_130px_minmax(0,1fr)_170px_220px] items-center gap-2 border-t border-border/60 px-3 hover:bg-primary/[0.05] ${vazio ? 'bg-warning/[0.08]' : ''}`}>
            <button type="button" onClick={() => abrir(i)} className={`text-left font-bold tabular-nums ${c.hora === '//' || !c.hora ? 'font-medium text-muted-foreground' : ''}`}>{c.hora || '—'}</button>
            <button type="button" onClick={() => abrir(i)} className="truncate text-left font-semibold text-primary">{c.sala || 'sem sala'}</button>
            <button type="button" onClick={() => abrir(i)} className="truncate text-left">{ehPosicaoAssistencial(c) ? 'Posição assistencial' : (c.procedimento || '—')}</button>
            <button type="button" onClick={() => abrir(i)} className="truncate text-left text-muted-foreground">{c.cirurgiao || ''}</button>
            {k === 0 ? (
              <span className="relative">
                <button type="button" onClick={() => { setMarcador(`sala:${g.chave}`); setPassoMarcador(null) }}
                  className={`flex h-[25px] w-full items-center justify-between gap-1.5 rounded-md border px-2 text-left font-semibold
                    ${vazio ? 'border-dashed border-warning text-foreground' : 'border-border-strong'}`}>
                  <span className="truncate">{nome || (ctx.importadoDoGrupo(g) ? `${ctx.importadoDoGrupo(g)} — escolher` : 'Escolher…')}</span>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{posicao ? `${posicao}º` : ''}</span>
                </button>
                <Popover aberto={marcador === `sala:${g.chave}`} onFechar={fecharMarcador} className="right-0 top-7">
                  <p className="mb-1.5 text-xs font-bold">Anestesista de {g.sala || 'sem sala'}{g.indices.length > 1 ? ` (${g.indices.length} linhas)` : ''}</p>
                  <BuscaPessoa opcoes={[{ value: ctx.SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...ctx.opcoesPessoa]}
                    onEscolher={(o) => { ctx.definirAnestesistaGrupo(g, o.value); fecharMarcador() }} />
                </Popover>
              </span>
            ) : (
              <span className="truncate pl-2 text-[11.5px] text-muted-foreground">{c.anestesistaManual ? nome : '↳ mesmo do bloco'}</span>
            )}
          </div>
        )
      }))}
    </div>
  )

  const sem = vis.semAnestesista
  return (
    <div ref={raiz} data-testid="conferencia-desktop">
      <div className="mb-2 flex items-center gap-3">
        <div className="inline-flex gap-[3px] rounded-[10px] bg-muted p-[3px]" role="tablist" aria-label="Forma de ver a conferência">
          {[['fila', 'Por fila'], ['sala', 'Por sala (como a foto)']].map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={modo === v} onClick={() => setModo(v)}
              className={`h-7 rounded-lg px-3 text-[12.5px] ${modo === v ? 'bg-primary/20 font-semibold text-primary' : 'text-muted-foreground'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {pessoas.length} na ordem · {ctx.resumoTexto} {sem.length ? `· ${sem.length} sem anestesista` : ''} · <Tecla>V</Tecla> alterna
        </span>
        <button type="button" onClick={() => novaCirurgia(null)}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold hover:bg-muted">
          <Plus className="h-4 w-4" /> Cirurgia <Tecla>N</Tecla>
        </button>
      </div>

      {modo === 'sala' ? porSala() : (
        <>
          {sem.length > 0 && (
            <div className="mb-[5px] rounded-[10px] border-[1.5px] border-warning bg-card">
              <div className="flex h-[34px] items-center gap-2 px-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <span className="text-[13.5px] font-bold">Sem anestesista</span>
                <span className="text-xs text-muted-foreground">clique na cirurgia e use “Mover para outra pessoa”, ou escolha abaixo</span>
              </div>
              {sem.map((i) => {
                const c = casos[i]
                if (!c) return null
                if (aberta(i)) return <EdicaoCaso key={c._lid || i} c={c} i={i} ctx={ctx} onFechar={() => setEditando(null)} />
                return (
                  <div key={c._lid || i} className="relative flex items-center">
                    <div className="min-w-0 flex-1"><LinhaCaso c={c} i={i} onEditar={abrir} /></div>
                    <button type="button" onClick={() => setMarcador(`sem:${i}`)}
                      className="mr-2 inline-flex h-[26px] shrink-0 items-center gap-1 rounded-md border border-dashed border-warning px-2 text-xs font-semibold">
                      Quem assume? <ChevronDown className="h-3 w-3" />
                    </button>
                    <Popover aberto={marcador === `sem:${i}`} onFechar={fecharMarcador} className="right-2 top-8">
                      <p className="mb-1.5 text-xs font-bold">Quem assume {c.sala || 'esta cirurgia'}?</p>
                      <BuscaPessoa opcoes={ctx.opcoesPessoa} onEscolher={(o) => { ctx.definirAnestesistaCaso(i, o.value); fecharMarcador() }} />
                    </Popover>
                  </div>
                )
              })}
            </div>
          )}

          {pessoas.map((p, idx) => cartaoPessoa(p, idx))}
          {!pessoas.length && (
            <p className="rounded-[10px] border border-dashed border-border-strong px-3 py-4 text-sm text-muted-foreground">
              A leitura não trouxe a ordem de liberação. Use “Preencher da atribuição” abaixo ou acrescente os nomes na ordem.
            </p>
          )}

          {vis.fora.map((f) => {
            const amb = ctx.ambiguoDe(f)
            return (
              <div key={`fora-${f.chave}`} className={`relative mb-[5px] rounded-[10px] border bg-card ${amb ? 'border-destructive/70' : 'border-warning/70'}`}>
                <div className="flex h-[34px] items-center gap-2 px-2.5">
                  {amb ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> : <UserPlus className="h-4 w-4 shrink-0 text-warning" />}
                  <span className="truncate text-[13.5px] font-bold">{String(f.nome).toUpperCase()}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {amb ? `pode ser ${amb} — escolha quem é (bloqueia publicar)` : (f.ajuda ? 'ajuda — vai ao fim da fila e sai primeiro' : 'tem cirurgia e não está na ordem')}
                  </span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    {f.ajuda && <SeloMarca tipo="ajuda">Ajuda</SeloMarca>}
                    <button type="button" onClick={() => setMarcador(`fora:${f.chave}`)}
                      className="inline-flex h-[26px] items-center gap-1 rounded-md border border-border-strong px-2 text-xs font-semibold">
                      {amb ? 'Quem é?' : 'Resolver'} <ChevronDown className="h-3 w-3" />
                    </button>
                  </span>
                </div>
                <Popover aberto={marcador === `fora:${f.chave}`} onFechar={fecharMarcador} className="right-2 top-9">
                  {amb ? (
                    <>
                      <p className="mb-1.5 text-xs font-bold">Quem é “{f.nome}”?</p>
                      <BuscaPessoa opcoes={ctx.opcoesPessoa} primeiro={ctx.candidatosAmbiguo(f)} onEscolher={(o) => { ctx.reatribuirCasos(f.indices, o.value, { porBloco: true }); fecharMarcador() }} />
                    </>
                  ) : (
                    <div className="space-y-1">
                      <button type="button" onClick={() => { ctx.marcarAjudaNome(f.nome, !f.ajuda); fecharMarcador() }}
                        className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-semibold hover:bg-muted">
                        <UserPlus className="h-4 w-4 text-info" /> {f.ajuda ? 'Não é ajuda' : 'É ajuda de fora (nome azul)'}
                      </button>
                      <button type="button" onClick={() => { ctx.acrescentarNaOrdem(f.nome); fecharMarcador() }}
                        className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-semibold hover:bg-muted">
                        <Plus className="h-4 w-4 text-primary" /> Acrescentar à ordem (no fim)
                      </button>
                      <button type="button" onClick={() => setPassoMarcador('fora-trocarPor')}
                        className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-semibold hover:bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" /> As cirurgias são de outra pessoa…
                      </button>
                      {passoMarcador === 'fora-trocarPor' && (
                        <BuscaPessoa opcoes={ctx.opcoesPessoa} onEscolher={(o) => { ctx.reatribuirCasos(f.indices, o.value); fecharMarcador() }} />
                      )}
                    </div>
                  )}
                </Popover>
                {linhasDe(f.indices)}
              </div>
            )
          })}

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" />
            <span><Tecla>J</Tecla><Tecla>K</Tecla> pessoa</span>
            <span><Tecla>↵</Tecla> marcar</span>
            <span><Tecla>E</Tecla> equipe · <Tecla>T</Tecla> troca · <Tecla>A</Tecla> ajuda · <Tecla>C</Tecla> consultório · <Tecla>S</Tecla> sobreaviso</span>
            <span><Tecla>{ALT}↑</Tecla><Tecla>{ALT}↓</Tecla> mover na ordem</span>
            <span>clique numa cirurgia para editar</span>
          </p>
        </>
      )}
    </div>
  )
}
