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
import SegmentedSelector from '../escala-cirurgica/SegmentedSelector'
import { useAdesaoEscala } from '@/hooks/useAdesaoEscala'
import {
  META, CARGOS, ORDEM_CARGO, SITUACOES,
  montarPessoas, ordenarPessoas, resumirCargos, indicadoresGrupo, hospital,
  faixa, formatarPct, melhores10, proximoPasso,
} from '@/lib/escalaAdesao'

const JANELAS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
]

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

/** Barra do comparativo da ficha: pessoa × meta × melhores 10%. */
function Comparativo({ titulo, detalhe, valor, meta, topo, max = 100, sufixo = '%' }) {
  const linha = (rotulo, v, cor) => (
    <div className="grid grid-cols-[92px_1fr_44px] items-center gap-2 text-[11.5px] text-muted-foreground">
      <span>{rotulo}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, ((v ?? 0) / max) * 100)}%` }} />
      </span>
      <b className="text-right tabular-nums text-foreground">{v == null ? '—' : `${Math.round(v)}${sufixo}`}</b>
    </div>
  )
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold">{titulo} <span className="font-normal text-muted-foreground">· {detalhe}</span></p>
      {linha('Você', valor, 'bg-foreground')}
      {linha('Meta', meta, 'bg-primary')}
      {topo != null && linha('Melhores 10%', topo, 'bg-muted-foreground')}
    </div>
  )
}

function Ficha({ pessoa, pessoas, janela, onClose }) {
  const j = janela
  const passo = proximoPasso(pessoa)
  const topo = useMemo(() => ({
    d: melhores10(pessoas, `d${j}`),
    ini: melhores10(pessoas, `ini${j}`),
    ter: melhores10(pessoas, `ter${j}`),
    tp: melhores10(pessoas, `tp${j}`),
    tot: melhores10(pessoas, `tot${j}`),
  }), [pessoas, j])
  const metaUso = j === '30' ? META.uso30 : META.uso60
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="!h-auto max-h-[88vh] overflow-y-auto">
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
          <Comparativo
            titulo="Usa a escala"
            detalhe={`dias em que abriu nos últimos ${j}`}
            valor={pessoa[`d${j}`]} meta={metaUso} topo={pessoa.anest ? topo.d : null}
            max={Number(j)} sufixo=" d"
          />
          {pessoa.anest ? (
            <>
              <Comparativo titulo="Marca o início" detalhe="% das suas cirurgias" valor={pessoa[`ini${j}`]} meta={META.ini} topo={topo.ini} />
              <Comparativo titulo="Marca o término" detalhe="% das suas cirurgias" valor={pessoa[`ter${j}`]} meta={META.ter} topo={topo.ter} />
              <Comparativo titulo="Informa o tempo da cirurgia" detalhe="% das suas cirurgias" valor={pessoa[`tp${j}`]} meta={META.tp} topo={topo.tp} />
              <Comparativo titulo="Informa o tempo total" detalhe="% dos seus turnos" valor={pessoa[`tot${j}`]} meta={META.tot} topo={topo.tot} />
              <p className="text-[11.5px] text-muted-foreground">
                "Melhores 10%" é a média dos anestesistas com o maior valor em cada item. {pessoa[`casos${j}`]} cirurgias e {pessoa[`turnos${j}`]} turnos no período.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Marcou o início de <b className="text-foreground">{pessoa[`iniN${j}`]}</b> e o término de{' '}
              <b className="text-foreground">{pessoa[`terN${j}`]}</b> cirurgias (qualquer sala) nos últimos {j} dias.
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
  const cols = anest ? ['Dias', 'Início', 'Término', 'Tempo cir.', 'Tempo total'] : ['Dias', 'Inícios', 'Términos', '', '']
  return (
    <div className="sticky top-14 deitado:top-11 z-10 grid grid-cols-[1fr_repeat(5,40px)] items-end gap-1 rounded-t-xl border-b border-border bg-muted px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-muted-foreground">
      <span className="text-left text-[12px] font-extrabold uppercase tracking-wide text-primary">
        {CARGOS[cargo]} · {total}
      </span>
      {cols.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  )
}

function LinhaPessoa({ p, janela, onAbrir }) {
  const j = janela
  const metaUso = j === '30' ? META.uso30 : META.uso60
  return (
    <button
      type="button"
      onClick={() => onAbrir(p)}
      className="grid min-h-[48px] w-full grid-cols-[1fr_repeat(5,40px)] items-center gap-1 border-b border-border bg-card px-2 py-1.5 text-left last:border-b-0 active:bg-muted"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight">{p.nome}</span>
        <Tag situacao={p.situacao} />
      </span>
      <Celula valor={p[`d${j}`]} meta={metaUso} texto={p[`d${j}`]} />
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

export default function AdesaoEscalaPage({ goBack }) {
  const [janela, setJanela] = useState('30')
  const [cargo, setCargo] = useState('todos')
  const [ordem, setOrdem] = useState('sit')
  const [aberta, setAberta] = useState(null)
  const [comoLer, setComoLer] = useState(false)

  // As duas janelas sempre: a situação é da janela de 30; os números mostrados seguem o alternador.
  const r30 = useAdesaoEscala(30)
  const r60 = useAdesaoEscala(60)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const pessoas = useMemo(() => montarPessoas(r30.dados, r60.dados), [r30.dados, r60.dados])
  const cargos = useMemo(() => resumirCargos(pessoas), [pessoas])
  const rel = janela === '30' ? r30.dados : r60.dados
  const grupo = indicadoresGrupo(rel)
  const carregando = r30.carregando || r60.carregando
  const erro = r30.erro || r60.erro
  const metaUso = janela === '30' ? META.uso30 : META.uso60
  const usamMuito = pessoas.filter((p) => p[`d${janela}`] >= metaUso).length

  const recarregar = () => { r30.recarregar(); r60.recarregar() }
  const atualizado = r30.em ? new Date(r30.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  const periodo = rel ? `${new Date(`${rel.desde}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${new Date(`${rel.ate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''

  const blocos = (cargo === 'todos' ? ORDEM_CARGO : [cargo])
    .map((c) => ({ cargo: c, lista: ordenarPessoas(pessoas.filter((p) => p.cargo === c), ordem) }))
    .filter((b) => b.lista.length > 0)

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

      <div className="flex flex-col gap-3 px-4 pt-3 sm:px-5">
        <SegmentedSelector options={JANELAS} value={janela} onChange={setJanela} />

        <p className="text-[13px] leading-snug text-muted-foreground">
          Quem usa a escala, quem marca início e término e quem informa o tempo que falta.
          Mede só se o app foi informado, não a qualidade do trabalho na sala. {periodo && `Período: ${periodo}.`}
        </p>

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
          <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[12.5px] leading-snug text-muted-foreground">
            <li><b className="text-foreground">Dias:</b> em quantos dias a pessoa abriu a escala (meta: 15 em 30 dias, 30 em 60).</li>
            <li><b className="text-foreground">Início / Término:</b> das cirurgias em que era o anestesista, em quantas ela mesma tocou em "Iniciada" / "Terminada" (meta 80%).</li>
            <li><b className="text-foreground">Tempo cir.:</b> das cirurgias dela, em quantas havia o tempo que falta preenchido (meta 50%).</li>
            <li><b className="text-foreground">Tempo total:</b> dos turnos dela, em quantos informou a que horas termina (meta 80%).</li>
            <li>Enfermagem, residentes, secretaria e contas dos hospitais não têm cirurgias próprias: aparece o número de marcações que fizeram.</li>
            <li>Cores: verde na meta · amarelo metade ou mais · laranja abaixo da metade · vermelho zero.</li>
            <li>Situação (sempre 30 dias): <b className="text-foreground">Engajado</b> usa 15+ dias e marca o término em metade ou mais; <b className="text-foreground">Não marca início/término</b> abre mas marca menos de 20%; <b className="text-foreground">Baixo uso</b> menos de 8 dias; <b className="text-foreground">Sem uso na semana</b> não abriu em 7 dias.</li>
            <li>Toque numa pessoa para ver a ficha: os números dela, a meta, os colegas que mais usam e o próximo passo.</li>
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
            <div className="grid grid-cols-2 gap-2">
              <Indicador titulo="Início marcado" valor={grupo.ini} meta={META.ini} detalhe={`${grupo.n.ini} de ${grupo.casos}`} />
              <Indicador titulo="Término marcado" valor={grupo.ter} meta={META.ter} detalhe={`${grupo.n.ter} de ${grupo.casos}`} />
              <Indicador titulo="Tempo da cirurgia" valor={grupo.tp} meta={META.tp} detalhe={`${grupo.n.tp} de ${grupo.casos}`} />
              <Indicador titulo="Tempo total" valor={grupo.tot} meta={META.tot} detalhe={`${grupo.n.tot} de ${grupo.turnos} turnos`} />
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              <b className="text-foreground">{usamMuito} de {pessoas.length}</b> pessoas abriram a escala em {metaUso}+ dias no período.
            </p>

            <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Onde falta informação, por hospital">
              <div className="grid grid-cols-[1fr_repeat(4,52px)] gap-1 bg-muted px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-muted-foreground">
                <span className="text-left text-[12px] font-extrabold uppercase tracking-wide text-primary">Por hospital</span>
                <span>Início</span><span>Término</span><span>Tempo cir.</span><span>Tempo total</span>
              </div>
              {HOSPITAIS.map(([k, nome]) => {
                const h = hospital(rel, k)
                if (!h) return null
                const v = (n, d) => (d ? (n / d) * 100 : null)
                return (
                  <div key={k} className="grid grid-cols-[1fr_repeat(4,52px)] items-center gap-1 border-t border-border px-2 py-1.5">
                    <span className={`text-[13px] ${k === 'total' ? 'font-extrabold' : 'font-semibold'}`}>
                      {nome} <span className="text-[11px] font-normal text-muted-foreground">{h.casos}</span>
                    </span>
                    <Celula valor={v(h.com_ini, h.casos)} meta={META.ini} />
                    <Celula valor={v(h.com_ter, h.casos)} meta={META.ter} />
                    <Celula valor={v(h.com_tp, h.casos)} meta={META.tp} />
                    <Celula valor={v(h.com_total, h.turnos)} meta={META.tot} />
                  </div>
                )
              })}
            </section>

            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Cargo">
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
            <div className="flex gap-1.5" role="group" aria-label="Ordenar">
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

            {blocos.map((b) => (
              <section key={b.cargo} className="rounded-xl border border-border bg-card" aria-label={CARGOS[b.cargo]}>
                <CabecalhoCargo cargo={b.cargo} total={b.lista.length} />
                {b.lista.map((p) => (
                  <LinhaPessoa key={p.chave} p={p} janela={janela} onAbrir={setAberta} />
                ))}
              </section>
            ))}

            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Fonte: registros do ANEST. Ficam fora cirurgias suspensas, linhas sem anestesista e a conta de testes.
              Se uma troca não foi registrada no app, a cirurgia conta para quem estava escalado. O tempo total
              pode sair um pouco menor que o real quando outra pessoa editou a linha depois.
            </p>
          </>
        )}
      </div>

      {aberta && (
        <Ficha pessoa={aberta} pessoas={pessoas} janela={janela} onClose={() => setAberta(null)} />
      )}
    </div>
  )
}
