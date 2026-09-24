/**
 * AdesaoEscalaPage — relatório interativo de ADESÃO à Escala Cirúrgica (dono 23/09/2026).
 *
 * Aberto pelo card na linha dos Destaques Científicos da Home (opção A do modelo
 * `.tmp/adesao-escala-card-e-pagina.html`). Mostra, por cargo e por pessoa, quem usa a escala,
 * quem marca início/término e quem informa o tempo da cirurgia e o tempo total — janelas de 30 e
 * 60 dias, ao vivo (`public.escala_adesao_relatorio`). "Todos veem tudo" é decisão do dono.
 *
 * Regras de leitura (metas, faixas, situação, próximo passo) em `src/lib/escalaAdesao.js`.
 * O cabeçalho de cada cargo gruda sob o header fixo (`top-14`) — nada acima dele pode ter
 * overflow, senão o sticky morre (memória overflow-hidden-mata-sticky).
 */
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ChevronDown, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { useMediaQuery } from '@/design-system/hooks'
import { useAdesaoEscala, useAdesaoMes, useAdesaoEvolucao } from '@/hooks/useAdesaoEscala'
import GraficoEvolucao from './GraficoEvolucao'
import {
  META, INDICE, CARGOS, ORDEM_CARGO, SITUACOES,
  montarPessoas, ordenarPessoas, resumirCargos, indicadoresGrupo, hospital,
  faixa, formatarPct, melhores10, tamanhoTopo, proximoPasso, montarVista, rotuloMes, mesAnterior,
} from '@/lib/escalaAdesao'


/** faixa → classes com tokens do tema (claro e escuro já resolvidos pelo tripleto HSL) */
const TOM = {
  ok: 'bg-category-green-bg text-category-green-fg',
  mid: 'bg-warning/20 text-foreground',
  low: 'bg-category-orange-bg text-category-orange-fg',
  crit: 'bg-category-red-bg text-category-red-fg',
  na: 'bg-muted text-muted-foreground font-normal',
}

const ORDENS = [
  { value: 'sit', label: 'Alertas primeiro' },
  { value: 'uso', label: 'Mais uso' },
  { value: 'nome', label: 'Nome' },
]

const HOSPITAIS = [
  ['unimed', 'Unimed'],
  ['hro', 'HRO'],
  ['materno', 'Materno'],
  ['total', 'Total'],
]

function Tag({ situacao }) {
  const s = SITUACOES[situacao]
  return (
    <span className={`inline-block rounded-full px-1.5 py-px text-[10.5px] font-semibold ${TOM[s.tom]}`}>
      {s.label}
    </span>
  )
}

function Celula({ valor, meta, texto }) {
  return (
    <span className={`flex h-7 items-center justify-center rounded-md text-[12px] font-bold tabular-nums ${TOM[faixa(valor, meta)]}`}>
      {texto ?? formatarPct(valor)}
    </span>
  )
}

function Indicador({ titulo, valor, meta, detalhe }) {
  const tom = faixa(valor, meta)
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[11.5px] text-muted-foreground">{titulo}</p>
      <p className={`text-[22px] font-bold leading-tight tabular-nums ${tom === 'ok' ? 'text-category-green-fg' : tom === 'crit' ? 'text-category-red-fg' : tom === 'low' ? 'text-category-orange-fg' : 'text-foreground'}`}>
        {formatarPct(valor)}
      </p>
      <p className="text-[11px] text-muted-foreground">{detalhe} · meta {meta}%</p>
    </div>
  )
}

/**
 * Barra do comparativo da ficha: a pessoa (pelo primeiro nome — quem lê a ficha nem sempre é ela,
 * "você" confundia, dono 24/09) × meta × média top N. `linhas` = [[rótulo, valor, cor], …] antes da meta.
 */
function Comparativo({ titulo, detalhe, linhas, meta, topo, rotuloTopo, max = 100, sufixo = '%' }) {
  const linha = (rotulo, v, cor) => (
    <div key={rotulo} className="grid grid-cols-[112px_1fr_44px] items-center gap-2 text-[11.5px] text-muted-foreground">
      <span className="truncate">{rotulo}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, ((v ?? 0) / max) * 100)}%` }} />
      </span>
      <b className="text-right tabular-nums text-foreground">{v == null ? '—' : `${Math.round(v)}${sufixo}`}</b>
    </div>
  )
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold">{titulo} <span className="font-normal text-muted-foreground">· {detalhe}</span></p>
      {linhas.map(([rotulo, v, cor]) => linha(rotulo, v, cor))}
      {linha('Meta', meta, 'bg-primary')}
      {topo != null && linha(rotuloTopo, topo, 'bg-muted-foreground')}
    </div>
  )
}

function Ficha({ pessoa, pessoas, vista, lado = 'bottom', onClose }) {
  // os campos "30" são sempre o período principal da vista (ver `montarVista`)
  const j = '30'
  const passo = proximoPasso(pessoa)
  const topo = useMemo(() => ({
    uso: melhores10(pessoas, `uso${j}`),
    abre: melhores10(pessoas, `abre${j}`),
    ini: melhores10(pessoas, `ini${j}`),
    ter: melhores10(pessoas, `ter${j}`),
    tp: melhores10(pessoas, `tp${j}`),
    tot: melhores10(pessoas, `tot${j}`),
  }), [pessoas, j])
  const n = tamanhoTopo(pessoas)
  const rotuloTopo = `Média top ${n}`
  const quem = pessoa.primeiro
  const eu = (v) => [[quem, v, 'bg-foreground']]
  // início/término: conta o que a pessoa tocou; a sala marcada por qualquer um vem embaixo
  const marcado = (proprio, sala) => [[`Por ${quem}`, proprio, 'bg-foreground'], ['Por qualquer um', sala, 'bg-foreground/45']]
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={lado} className={lado === 'bottom' ? '!h-auto max-h-[88vh] overflow-y-auto' : 'overflow-y-auto'}>
        <SheetHeader className="pb-2">
          <SheetTitle className="text-[16px] font-extrabold leading-tight">{pessoa.nome}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>{CARGOS[pessoa.cargo]}{pessoa.sub ? ` · ${pessoa.sub}` : ''}</span>
            <Tag situacao={pessoa.situacao} />
          </div>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <p className="rounded-xl bg-muted px-3 py-2.5 text-[14px] leading-snug">
            {passo.texto} <strong className="text-primary">Próximo passo:</strong> {passo.passo}
          </p>
          {pessoa.anest && (
            <Comparativo
              titulo="Índice de uso"
              detalhe={`os 5 itens abaixo, cada um contra a meta · ${vista.rotA}`}
              linhas={eu(pessoa[`uso${j}`])} meta={INDICE.ok} topo={topo.uso} rotuloTopo={rotuloTopo}
            />
          )}
          <Comparativo
            titulo="Abre a escala"
            detalhe={`abriu em ${pessoa[`d${j}`]} de ${pessoa[`base${j}`]} dias trabalhados${pessoa.anest ? '' : ` · ${vista.rotA}`}`}
            linhas={eu(pessoa[`abre${j}`])} meta={META.uso} topo={pessoa.anest ? topo.abre : null} rotuloTopo={rotuloTopo}
          />
          {pessoa.anest ? (
            <>
              <Comparativo titulo="Início marcado" detalhe={`% das cirurgias de ${quem}`} linhas={marcado(pessoa[`ini${j}`], pessoa[`iniSala${j}`])} meta={META.ini} topo={topo.ini} rotuloTopo={rotuloTopo} />
              <Comparativo titulo="Término marcado" detalhe={`% das cirurgias de ${quem}`} linhas={marcado(pessoa[`ter${j}`], pessoa[`terSala${j}`])} meta={META.ter} topo={topo.ter} rotuloTopo={rotuloTopo} />
              <Comparativo titulo="Tempo da cirurgia informado" detalhe={`% das cirurgias de ${quem}`} linhas={eu(pessoa[`tp${j}`])} meta={META.tp} topo={topo.tp} rotuloTopo={rotuloTopo} />
              <Comparativo titulo="Tempo total informado" detalhe={`% dos turnos de ${quem}`} linhas={eu(pessoa[`tot${j}`])} meta={META.tot} topo={topo.tot} rotuloTopo={rotuloTopo} />
              <p className="text-[11.5px] text-muted-foreground">
                {rotuloTopo}: média dos {n} anestesistas com o valor mais alto em cada item. {pessoa[`casos${j}`]} cirurgias e {pessoa[`turnos${j}`]} turnos no período.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Marcou o início de <b className="text-foreground">{pessoa[`iniN${j}`]}</b> e o término de{' '}
              <b className="text-foreground">{pessoa[`terN${j}`]}</b> cirurgias (qualquer sala) · {vista.rotA}.
            </p>
          )}
          <p className="text-[12px] text-muted-foreground">
            Trocas registradas: {pessoa[`trocas${j}`]} · Ações na escala: {pessoa[`acoes${j}`]}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CabecalhoCargo({ cargo, total }) {
  const anest = cargo === 'anest'
  const cols = anest ? ['Uso', 'Início', 'Término', 'Tempo cir.', 'Tempo total'] : ['Uso', 'Inícios', 'Términos', '', '']
  return (
    <div className="sticky top-14 deitado:top-11 z-10 grid grid-cols-[1fr_repeat(5,40px)] items-end gap-1 rounded-t-xl border-b border-border bg-muted px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-muted-foreground">
      <span className="text-left text-[12px] font-extrabold uppercase tracking-wide text-primary">
        {CARGOS[cargo]} · {total}
      </span>
      {cols.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  )
}

function LinhaPessoa({ p, vista, onAbrir }) {
  const j = '30'
  const metaUso = vista.metaUso
  return (
    <button
      type="button"
      onClick={() => onAbrir(p)}
      className="grid min-h-[48px] w-full grid-cols-[1fr_repeat(5,40px)] items-center gap-1 border-b border-border bg-card px-2 py-1.5 text-left last:border-b-0 active:bg-muted"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight">{p.nomeCurto}</span>
        <Tag situacao={p.situacao} />
      </span>
      <Celula valor={p[`uso${j}`]} meta={metaUso} />
      {p.anest ? (
        <>
          <Celula valor={p[`ini${j}`]} meta={META.ini} />
          <Celula valor={p[`ter${j}`]} meta={META.ter} />
          <Celula valor={p[`tp${j}`]} meta={META.tp} />
          <Celula valor={p[`tot${j}`]} meta={META.tot} />
        </>
      ) : (
        <>
          <Celula valor={p.nunca ? 0 : p[`iniN${j}`]} meta={10} texto={p[`iniN${j}`]} />
          <Celula valor={p.nunca ? 0 : p[`terN${j}`]} meta={10} texto={p[`terN${j}`]} />
          <Celula valor={null} meta={1} texto="—" />
          <Celula valor={null} meta={1} texto="—" />
        </>
      )}
    </button>
  )
}

/**
 * Tablet/desktop (lg+, dono 23/09: "informações muito longe e dispersas; mais completo que no
 * celular"): uma TABELA por cargo, com largura limitada (os números ficam junto do nome) e mais
 * colunas que o celular — dias na semana/janela/outra janela, aberturas por dia, início, término,
 * tempo da cirurgia, tempo total (com "n de N" e a outra janela embaixo), trocas e ações.
 * O `thead` gruda sob o header (top-14; deitado/desktop o header tem 44px → top-11). Nenhum
 * ancestral pode ter overflow (sticky morre) — por isso a tabela não fica numa caixa rolável.
 */
function CelulaLarga({ valor, meta, texto, sub, sub2 }) {
  return (
    <td className="p-1 lg:px-1.5 xl:px-1">
      <span className={`flex min-h-[44px] flex-col items-center justify-center rounded-md px-1 py-0.5 leading-tight tabular-nums ${TOM[faixa(valor, meta)]}`}>
        <b className="whitespace-nowrap text-[13px]">{texto ?? formatarPct(valor)}</b>
        {sub && <small className="hidden text-[10px] font-normal opacity-85 xl:block">{sub}</small>}
        {sub2 && <small className="whitespace-nowrap text-[10px] font-normal opacity-85">{sub2}</small>}
      </span>
    </td>
  )
}

function TabelaCargo({ cargo, lista, vista, onAbrir }) {
  const j = '30'
  const o = '60'
  const metaUso = vista.metaUso
  const anest = cargo === 'anest'
  const th = 'sticky top-14 deitado:top-11 z-10 bg-muted px-1 py-1.5 text-center align-bottom text-[10.5px] font-semibold leading-tight text-muted-foreground'
  const n = (a, b) => `${a ?? 0} de ${b ?? 0}`
  return (
    <table className="w-full border-separate border-spacing-0 rounded-xl border border-border bg-card">
      <thead>
        <tr>
          <th className={`${th} rounded-tl-xl pl-3 text-left`}>
            <span className="block text-[12.5px] font-extrabold uppercase tracking-wide text-primary">{CARGOS[cargo]} · {lista.length}</span>
            <span className="font-normal">{vista.rotA} · embaixo, {vista.rotB}</span>
          </th>
          <th className={`${th} hidden xl:table-cell`}>Situação</th>
          <th className={th}>Uso<span className="hidden font-normal xl:block">{anest ? `índice · engajado ${INDICE.ok}+` : '% dos dias trabalhados'}</span></th>
          <th className={th}>{anest ? 'Início marcado' : 'Inícios'}</th>
          <th className={th}>{anest ? 'Término marcado' : 'Términos'}</th>
          <th className={th}>Tempo da cirurgia</th>
          <th className={`${th} rounded-tr-xl xl:rounded-tr-none`}>Tempo total</th>
          <th className={`${th} hidden rounded-tr-xl xl:table-cell`}>Ações<span className="hidden font-normal xl:block">na escala</span></th>
        </tr>
      </thead>
      <tbody>
        {lista.map((p) => (
          <tr key={p.chave} onClick={() => onAbrir(p)} className="cursor-pointer border-t border-border hover:bg-muted/60">
            <td className="border-t border-border py-2 pl-3 pr-2 xl:py-1.5">
              <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(p) }} className="text-left text-[13.5px] font-semibold leading-tight hover:underline">
                {p.nomeCurto}
              </button>
              {p.sub && <span className="block text-[11px] text-muted-foreground">{p.sub}</span>}
              {/* tablet em pé: a situação vai para baixo do nome (a coluna própria só a partir de xl) */}
              <span className="mt-1 block xl:hidden"><Tag situacao={p.situacao} /></span>
            </td>
            <td className="hidden whitespace-nowrap border-t border-border px-1 text-center xl:table-cell"><Tag situacao={p.situacao} /></td>
            <CelulaLarga valor={p[`uso${j}`]} meta={metaUso} sub={`abriu ${p[`d${j}`]} de ${p[`base${j}`]} dias`} sub2={`${vista.curtoB}: ${formatarPct(p[`uso${o}`])}`} />
            {p.anest ? (
              <>
                <CelulaLarga valor={p[`ini${j}`]} meta={META.ini} sub={`sala: ${formatarPct(p[`iniSala${j}`])}`} sub2={`${vista.curtoB}: ${formatarPct(p[`ini${o}`])}`} />
                <CelulaLarga valor={p[`ter${j}`]} meta={META.ter} sub={`sala: ${formatarPct(p[`terSala${j}`])}`} sub2={`${vista.curtoB}: ${formatarPct(p[`ter${o}`])}`} />
                <CelulaLarga valor={p[`tp${j}`]} meta={META.tp} sub={n(p.tpInf30, p.casos30)} sub2={`${vista.curtoB}: ${formatarPct(p[`tp${o}`])}`} />
                <CelulaLarga valor={p[`tot${j}`]} meta={META.tot} sub={n(p.totEu30, p.turnos30)} sub2={`${vista.curtoB}: ${formatarPct(p[`tot${o}`])}`} />
              </>
            ) : (
              <>
                <CelulaLarga valor={p.nunca ? 0 : p[`iniN${j}`]} meta={10} texto={p[`iniN${j}`]} sub={`${vista.curtoB}: ${p[`iniN${o}`]}`} />
                <CelulaLarga valor={p.nunca ? 0 : p[`terN${j}`]} meta={10} texto={p[`terN${j}`]} sub={`${vista.curtoB}: ${p[`terN${o}`]}`} />
                <CelulaLarga valor={null} meta={1} texto="—" />
                <CelulaLarga valor={null} meta={1} texto="—" />
              </>
            )}
            <td className="hidden border-t border-border text-center text-[13px] tabular-nums xl:table-cell">{p[`acoes${j}`]}<span className="block text-[10px] text-muted-foreground">{vista.curtoB}: {p[`acoes${o}`]}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Resumo por cargo (tablet/desktop): o que no celular fica espalhado em chips. */
function ResumoCargos({ cargos, vista }) {
  const metaUso = vista.metaUso
  return (
    <section className="rounded-xl border border-border bg-card" aria-label="Resumo por cargo">
      <div className="grid grid-cols-[minmax(120px,1fr)_repeat(6,64px)] items-end gap-1 rounded-t-xl bg-muted px-3 py-1.5 text-center text-[10.5px] font-semibold leading-tight text-muted-foreground">
        <span className="text-left text-[12px] font-extrabold uppercase tracking-wide text-primary">Por cargo</span>
        <span>Abriram na semana</span><span>Uso (mediana)</span><span>Início</span><span>Término</span><span>Tempo total</span><span>Com alerta</span>
      </div>
      {cargos.map((c) => {
        return (
          <div key={c.cargo} className="grid grid-cols-[minmax(120px,1fr)_repeat(6,64px)] items-center gap-1 border-t border-border px-3 py-1.5">
            <span className="text-[13px] font-semibold leading-tight">{CARGOS[c.cargo]} <span className="text-[11px] font-normal text-muted-foreground">{c.total}</span></span>
            <Celula valor={(c.abriramSemana / c.total) * 100} meta={80} texto={`${c.abriramSemana}/${c.total}`} />
            <Celula valor={c.uso30} meta={metaUso} />
            <Celula valor={c.ini30} meta={META.ini} />
            <Celula valor={c.ter30} meta={META.ter} />
            <Celula valor={c.tot30} meta={META.tot} />
            <Celula valor={c.alertas ? 0 : 100} meta={80} texto={c.alertas} />
          </div>
        )
      })}
      <p className="border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">Início, término e tempo total: mediana dos anestesistas no período.</p>
    </section>
  )
}

export default function AdesaoEscalaPage({ goBack }) {
  // aba: '30' | '60' (janelas ao vivo) | 'AAAA-MM' (mês, do histórico diário)
  const [aba, setAba] = useState('30')
  const [cargo, setCargo] = useState('todos')
  const [ordem, setOrdem] = useState('sit')
  const [aberta, setAberta] = useState(null)
  const [comoLer, setComoLer] = useState(false)
  const largo = useMediaQuery('(min-width: 768px)')

  // As duas janelas ao vivo sempre (a situação de "60 dias" vem da janela de 30); o mês e o mês
  // anterior só quando uma aba de mês está aberta; a evolução traz a lista de meses (as abas).
  const r30 = useAdesaoEscala(30)
  const r60 = useAdesaoEscala(60)
  const evo = useAdesaoEvolucao()
  const ehMes = /^\d{4}-\d{2}$/.test(aba)
  const meses = evo.dados?.meses ?? []
  const temAnterior = ehMes && meses.includes(mesAnterior(aba))
  const gravadoAte = evo.dados?.gravado_ate ?? null
  const mA = useAdesaoMes(ehMes ? aba : null, gravadoAte)
  const mB = useAdesaoMes(temAnterior ? mesAnterior(aba) : null, gravadoAte)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const vista = montarVista(aba, { r30: r30.dados, r60: r60.dados, mesA: mA.dados, mesB: mB.dados, gravadoAte })
  const pessoas = useMemo(() => {
    const lista = montarPessoas(vista.relA, vista.relB)
    if (!vista.situacaoDe30) return lista
    // aba de 60 dias: a situação continua sendo a dos últimos 30 (é a régua do painel)
    const sit30 = new Map(montarPessoas(r30.dados, null).map((p) => [p.chave, p.situacao]))
    return lista.map((p) => ({ ...p, situacao: sit30.get(p.chave) ?? p.situacao }))
  }, [vista.relA, vista.relB, vista.situacaoDe30, r30.dados])
  const cargos = useMemo(() => resumirCargos(pessoas), [pessoas])
  const rel = vista.relA
  const grupo = indicadoresGrupo(rel)
  const carregando = r30.carregando || r60.carregando || evo.carregando || mA.carregando || mB.carregando
  const erro = ehMes ? mA.erro : (r30.erro || r60.erro)
  const metaUso = vista.metaUso
  const usamMuito = pessoas.filter((p) => (p.uso30 ?? 0) >= metaUso).length
  const abas = [
    { value: '30', label: '30 dias' },
    { value: '60', label: '60 dias' },
    ...meses.map((m) => ({ value: m, label: rotuloMes(m) })),
  ]

  const recarregar = () => { r30.recarregar(); r60.recarregar(); evo.recarregar(); mA.recarregar(); mB.recarregar() }
  const atualizado = r30.em ? new Date(r30.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  const periodo = rel ? `${new Date(`${rel.desde}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${new Date(`${rel.ate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''

  const blocos = (cargo === 'todos' ? ORDEM_CARGO : [cargo])
    .map((c) => ({ cargo: c, lista: ordenarPessoas(pessoas.filter((p) => p.cargo === c), ordem) }))
    .filter((b) => b.lista.length > 0)

  const hospitais = rel && (
    <section className="rounded-xl border border-border bg-card" aria-label="Onde falta informação, por hospital">
      <div className="grid grid-cols-[1fr_repeat(4,52px)] gap-1 rounded-t-xl bg-muted px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-muted-foreground lg:grid-cols-[minmax(110px,1fr)_repeat(4,64px)] lg:px-3 lg:text-[10.5px]">
        <span className="text-left text-[12px] font-extrabold uppercase tracking-wide text-primary">Por hospital</span>
        <span>Início</span><span>Término</span><span>Tempo cir.</span><span>Tempo total</span>
      </div>
      {HOSPITAIS.map(([k, nome]) => {
        const h = hospital(rel, k)
        if (!h) return null
        const v = (n, d) => (d ? (n / d) * 100 : null)
        return (
          <div key={k} className="grid grid-cols-[1fr_repeat(4,52px)] items-center gap-1 border-t border-border px-2 py-1.5 lg:grid-cols-[minmax(110px,1fr)_repeat(4,64px)] lg:px-3">
            <span className={`text-[13px] ${k === 'total' ? 'font-extrabold' : 'font-semibold'}`}>
              {nome} <span className="text-[11px] font-normal text-muted-foreground">{h.casos} cirurgias</span>
            </span>
            <Celula valor={v(h.com_ini, h.casos)} meta={META.ini} />
            <Celula valor={v(h.com_ter, h.casos)} meta={META.ter} />
            <Celula valor={v(h.com_tp, h.casos)} meta={META.tp} />
            <Celula valor={v(h.com_total, h.turnos)} meta={META.tot} />
          </div>
        )
      })}
    </section>
  )

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Adesão à Escala"
        subtitle={atualizado ? `Atualizado às ${atualizado}` : 'Escala Cirúrgica'}
        onBack={goBack}
        actions={
          <button
            type="button"
            onClick={recarregar}
            disabled={carregando}
            aria-label="Atualizar"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        }
      />

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 pt-3 sm:px-5 lg:gap-4 lg:px-6 lg:pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <p className="text-[13px] leading-snug text-muted-foreground lg:order-1 lg:max-w-[62ch]">
            Quem usa a escala, quem marca início e término e quem informa o tempo que falta.
            Mede só se o app foi informado, não a qualidade do trabalho na sala. Tudo é contado apenas nos
            dias em que a pessoa trabalhou: férias, pós-plantão, consultório e folgas ficam fora. {periodo && `Período: ${periodo}.`}
            {' '}O dia entra quando a escala do dia seguinte é publicada.
            {ehMes && ' A comparação (número pequeno) é com o mês anterior.'}
          </p>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden lg:order-2 lg:mx-0 lg:shrink-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0" role="tablist" aria-label="Período">
            {abas.map((a, i) => (
              <button
                key={a.value}
                type="button"
                role="tab"
                aria-selected={aba === a.value}
                onClick={() => setAba(a.value)}
                className={`min-h-[40px] shrink-0 rounded-xl border px-3.5 text-[13px] font-semibold ${aba === a.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'} ${i === 2 ? 'ml-2' : ''}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setComoLer((v) => !v)}
          aria-expanded={comoLer}
          className="flex min-h-[44px] items-center justify-between rounded-xl border border-border bg-card px-3 text-[13px] font-semibold"
        >
          Como ler os números
          <ChevronDown className={`h-4 w-4 transition-transform ${comoLer ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {comoLer && (
          <ul className="grid gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[12.5px] leading-snug text-muted-foreground lg:grid-cols-2 lg:gap-x-8">
            <li><b className="text-foreground">Uso (anestesistas):</b> índice de 0 a 100 que junta os 5 itens — abrir a escala, marcar início, marcar término, tempo da cirurgia e tempo total —, cada um contado contra a própria meta. Engajado a partir de {INDICE.ok}.</li>
            <li><b className="text-foreground">Abre a escala:</b> dos dias em que a pessoa trabalhou, em quantos abriu o app (meta 70%). Anestesista: dias na escala publicada. Demais cargos: dias úteis, feriados incluídos — para eles, é o próprio uso.</li>
            <li><b className="text-foreground">Início / Término:</b> das cirurgias em que era o anestesista, em quantas ele mesmo tocou em "Iniciada" / "Terminada" (meta 80%). Embaixo, a sala marcada por qualquer pessoa.</li>
            <li><b className="text-foreground">Tempo cir.:</b> das cirurgias dela, em quantas havia o tempo que falta preenchido (meta 50%).</li>
            <li><b className="text-foreground">Tempo total:</b> dos turnos dela, em quantos informou a que horas termina (meta 80%).</li>
            <li>Enfermagem, residentes, secretaria e contas dos hospitais não têm cirurgias próprias: aparece o número de marcações que fizeram.</li>
            <li>Cores: verde na meta · amarelo metade ou mais · laranja abaixo da metade · vermelho zero.</li>
            <li>Situação (sempre 30 dias): <b className="text-foreground">Engajado</b> índice {INDICE.ok}+; <b className="text-foreground">Não marca início/término</b> marcou o término de menos de 20% das próprias cirurgias; <b className="text-foreground">Baixo acesso</b> abriu a escala em menos de 40% dos dias trabalhados; <b className="text-foreground">Sem uso na semana</b> trabalhou nos últimos 7 dias e não abriu.</li>
            <li>Toque numa pessoa para ver a ficha: os números dela, a meta, a média dos colegas com os valores mais altos e o próximo passo.</li>
          </ul>
        )}

        {erro && !rel && (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-category-red-bg px-3 py-2.5 text-[13px] text-category-red-fg">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Não foi possível carregar o relatório. Toque em atualizar para tentar de novo.</span>
          </div>
        )}
        {!rel && !erro && (
          <p className="py-10 text-center text-[13px] text-muted-foreground">Carregando o relatório…</p>
        )}

        {rel && grupo && (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5">
              <Indicador titulo="Início marcado" valor={grupo.ini} meta={META.ini} detalhe={`${grupo.n.ini} de ${grupo.casos}`} />
              <Indicador titulo="Término marcado" valor={grupo.ter} meta={META.ter} detalhe={`${grupo.n.ter} de ${grupo.casos}`} />
              <Indicador titulo="Tempo da cirurgia" valor={grupo.tp} meta={META.tp} detalhe={`${grupo.n.tp} de ${grupo.casos}`} />
              <Indicador titulo="Tempo total" valor={grupo.tot} meta={META.tot} detalhe={`${grupo.n.tot} de ${grupo.turnos} turnos`} />
              <div className="hidden xl:block">
                <Indicador titulo={`Uso ${metaUso}+`} valor={(usamMuito / Math.max(1, pessoas.length)) * 100} meta={80} detalhe={`${usamMuito} de ${pessoas.length} pessoas`} />
              </div>
            </div>
            <p className="text-[12.5px] text-muted-foreground xl:hidden">
              <b className="text-foreground">{usamMuito} de {pessoas.length}</b> pessoas com uso {metaUso} ou mais.
            </p>

            <div className="flex flex-col gap-3 xl:grid xl:grid-cols-2 xl:items-start">
              {hospitais}
              {largo && <ResumoCargos cargos={cargos} vista={vista} />}
            </div>

            {evo.dados?.semanas && <GraficoEvolucao semanas={evo.dados.semanas} compacto={!largo} />}

            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0" role="tablist" aria-label="Cargo">
                {[{ cargo: 'todos', total: pessoas.length, alertas: cargos.reduce((s, c) => s + c.alertas, 0) }, ...cargos].map((c) => (
                  <button
                    key={c.cargo}
                    type="button"
                    role="tab"
                    aria-selected={cargo === c.cargo}
                    onClick={() => setCargo(c.cargo)}
                    className={`min-h-[36px] shrink-0 rounded-full border px-3 text-[12px] font-semibold ${cargo === c.cargo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}
                  >
                    {c.cargo === 'todos' ? 'Todos' : CARGOS[c.cargo]} · {c.total}
                    {c.alertas > 0 && <span className="ml-1 opacity-80">({c.alertas} alerta{c.alertas > 1 ? 's' : ''})</span>}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 gap-1.5" role="group" aria-label="Ordenar">
                {ORDENS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOrdem(o.value)}
                    aria-pressed={ordem === o.value}
                    className={`min-h-[32px] rounded-lg px-2.5 text-[12px] font-medium ${ordem === o.value ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {blocos.map((b) => (largo ? (
              <TabelaCargo key={b.cargo} cargo={b.cargo} lista={b.lista} vista={vista} onAbrir={setAberta} />
            ) : (
              <section key={b.cargo} className="rounded-xl border border-border bg-card" aria-label={CARGOS[b.cargo]}>
                <CabecalhoCargo cargo={b.cargo} total={b.lista.length} />
                {b.lista.map((p) => (
                  <LinhaPessoa key={p.chave} p={p} vista={vista} onAbrir={setAberta} />
                ))}
              </section>
            )))}

            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Fonte: registros do ANEST. Ficam fora cirurgias suspensas, linhas sem anestesista, a conta de testes
              e quem não trabalhou nenhum dia no período.
              Se uma troca não foi registrada no app, a cirurgia conta para quem estava escalado. Dia trabalhado:
              cirurgia no nome ou nome no rodapé do hospital — no fim de semana só com cirurgia, e rodapé anotado
              "consultório" não conta. O tempo total pode sair um pouco menor que o real quando outra pessoa editou a
              linha depois; o tempo da cirurgia conta o preenchido por qualquer pessoa (o app não guarda quem preencheu).
            </p>
          </>
        )}
      </div>

      {aberta && (
        <Ficha pessoa={aberta} pessoas={pessoas} vista={vista} lado={largo ? 'right' : 'bottom'} onClose={() => setAberta(null)} />
      )}
    </div>
  )
}
