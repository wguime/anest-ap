/**
 * GraficoEvolucao — evolução SEMANAL da adesão à Escala (dono 23/09: "gráfico evolutivo para
 * acompanhamento e direcionar melhorias").
 *
 * Dados: `escala_adesao_evolucao().semanas` (histórico diário gravado pelo cron). Duas leituras:
 *  1. linhas em % contra a meta de 80% — início, término (qualquer pessoa), término pelo próprio
 *     anestesista, tempo total e tempo da cirurgia; toque na legenda liga/desliga cada linha;
 *  2. barras de quantas pessoas abriram a escala na semana, empilhadas por cargo.
 * Embaixo, a leitura em frase: última semana COMPLETA contra 4 semanas antes, e qual indicador
 * está mais longe da meta — é o "onde agir".
 *
 * SVG próprio (sem Recharts): o Recharts não resolve `hsl(var(--token))` em atributo; aqui a cor
 * vem de classes `stroke-*`/`fill-*` do Tailwind, que seguem o tema claro/escuro.
 */
import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { serieEvolucao, tendencia, formatarPct, META } from '@/lib/escalaAdesao'

const LINHAS = [
  { campo: 'ter', rotulo: 'Término marcado', traco: 'stroke-primary', ponto: 'fill-primary', meta: META.ter },
  { campo: 'ini', rotulo: 'Início marcado', traco: 'stroke-category-blue', ponto: 'fill-category-blue', meta: META.ini },
  { campo: 'terAnest', rotulo: 'Término pelo próprio anestesista', traco: 'stroke-category-purple', ponto: 'fill-category-purple', meta: META.ter },
  { campo: 'tot', rotulo: 'Tempo total informado', traco: 'stroke-category-orange', ponto: 'fill-category-orange', meta: META.tot },
  { campo: 'tp', rotulo: 'Tempo da cirurgia', traco: 'stroke-category-teal', ponto: 'fill-category-teal', meta: META.tp },
]

const CARGOS_BARRA = [
  { campo: 'anest', rotulo: 'Anestesiologistas', cor: 'fill-primary' },
  { campo: 'enf', rotulo: 'Enfermagem', cor: 'fill-category-teal' },
  { campo: 'res', rotulo: 'Residentes', cor: 'fill-category-blue' },
  { campo: 'outros', rotulo: 'Secretaria e hospitais', cor: 'fill-category-orange' },
]

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Tendencia({ linha, t }) {
  if (!t) return null
  const sobe = t.delta >= 1
  const desce = t.delta <= -1
  const Icone = sobe ? TrendingUp : desce ? TrendingDown : Minus
  const cor = sobe ? 'text-category-green-fg' : desce ? 'text-category-red-fg' : 'text-muted-foreground'
  return (
    <li className="flex items-start gap-2 text-[12.5px] leading-snug">
      <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${cor}`} aria-hidden="true" />
      <span>
        <b>{linha.rotulo}:</b> {formatarPct(t.atual)} na última semana completa
        {' '}({sobe ? 'subiu' : desce ? 'caiu' : 'estável'}{sobe || desce ? ` ${Math.abs(Math.round(t.delta))} pontos` : ''} desde {ddmm(t.desde)}) · meta {linha.meta}%
      </span>
    </li>
  )
}

export default function GraficoEvolucao({ semanas, compacto = false }) {
  const serie = useMemo(() => serieEvolucao(semanas), [semanas])
  // todas as linhas visíveis ao abrir (dono 24/09: "deixe as informações completas"); o toque na
  // legenda continua ocultando/mostrando
  const [ligadas, setLigadas] = useState(() => new Set(LINHAS.map((l) => l.campo)))

  if (serie.length < 2) {
    return (
      <p className="rounded-xl border border-border bg-card px-3 py-4 text-[13px] text-muted-foreground">
        A evolução aparece quando houver pelo menos duas semanas gravadas.
      </p>
    )
  }

  // geometria em unidades do viewBox; a largura real acompanha o contêiner
  // celular (compacto): viewBox estreito para os rótulos não virarem 5px ao encolher
  const W = compacto ? 380 : 720, H = compacto ? 230 : 220, L = compacto ? 32 : 34, R = compacto ? 12 : 10, T = 12, B = 26
  const fs = compacto ? 11 : 10
  const iw = W - L - R, ih = H - T - B
  const x = (i) => L + (serie.length === 1 ? iw / 2 : (i * iw) / (serie.length - 1))
  const y = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih
  const passoRotulo = Math.max(1, Math.ceil(serie.length / (compacto ? 4 : 8)))
  // 1º e último rótulo presos às bordas (centrados, saíam cortados pela metade)
  const ancora = (i) => (i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle')

  const maxPessoas = Math.max(10, ...serie.map((s) => s.pessoas || 0))
  const HB = compacto ? 140 : 120, TB = 14, BB = 22, ihb = HB - TB - BB
  const larguraBarra = Math.max(6, Math.min(34, (iw / serie.length) * 0.62))
  const yb = (v) => TB + ihb - (v / maxPessoas) * ihb

  const tendencias = LINHAS.map((l) => ({ linha: l, t: tendencia(serie, l.campo) })).filter((x2) => x2.t)
  const pior = tendencias
    .map(({ linha, t }) => ({ linha, falta: linha.meta - t.atual }))
    .filter((p) => p.falta > 0)
    .sort((a, b) => b.falta - a.falta)[0]

  const alternar = (campo) => setLigadas((s) => {
    const n = new Set(s)
    if (n.has(campo)) n.delete(campo)
    else n.add(campo)
    return n
  })

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:p-4" aria-label="Evolução semanal">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between">
        <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-primary">Evolução semana a semana</h2>
        <p className="text-[11.5px] text-muted-foreground">
          % das cirurgias (tempo total: % dos turnos) · linha tracejada = meta 80% · última semana pode estar incompleta
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Linhas do gráfico">
        {LINHAS.map((l) => (
          <button
            key={l.campo}
            type="button"
            onClick={() => alternar(l.campo)}
            aria-pressed={ligadas.has(l.campo)}
            className={`flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium ${ligadas.has(l.campo) ? 'border-border bg-card text-foreground' : 'border-transparent bg-muted text-muted-foreground line-through'}`}
          >
            <svg width="14" height="6" aria-hidden="true"><line x1="0" y1="3" x2="14" y2="3" className={l.traco} strokeWidth="3" /></svg>
            {l.rotulo}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Evolução semanal dos indicadores em porcentagem">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="fill-muted-foreground" fontSize={fs}>{v}%</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(80)} y2={y(80)} className="stroke-foreground" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.6" />
        {serie.map((s, i) => (i % passoRotulo === 0 || i === serie.length - 1) && (
          <text key={s.semana} x={x(i)} y={H - 8} textAnchor={ancora(i)} className="fill-muted-foreground" fontSize={fs}>{ddmm(s.semana)}</text>
        ))}
        {LINHAS.filter((l) => ligadas.has(l.campo)).map((l) => {
          const pts = serie.map((s, i) => (s[l.campo] == null ? null : [x(i), y(s[l.campo])])).filter(Boolean)
          return (
            <g key={l.campo}>
              <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" className={l.traco} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {serie.map((s, i) => s[l.campo] != null && (
                <circle key={i} cx={x(i)} cy={y(s[l.campo])} r={i === serie.length - 1 ? 4 : 2.5} className={l.ponto} opacity={s.completa ? 1 : 0.55}>
                  <title>{`${l.rotulo} · semana de ${ddmm(s.semana)}: ${formatarPct(s[l.campo])}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>

      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-semibold">Pessoas que abriram a escala na semana</p>
        <svg viewBox={`0 0 ${W} ${HB}`} className="h-auto w-full" role="img" aria-label="Pessoas que abriram a escala por semana, por cargo">
          <line x1={L} x2={W - R} y1={yb(0)} y2={yb(0)} className="stroke-border" strokeWidth="1" />
          {serie.map((s, i) => {
            let base = 0
            return (
              <g key={s.semana} opacity={s.completa ? 1 : 0.55}>
                {CARGOS_BARRA.map((c) => {
                  const v = s.porCargo[c.campo] || 0
                  if (!v) return null
                  const y0 = yb(base + v)
                  const h = yb(base) - y0
                  base += v
                  return <rect key={c.campo} x={x(i) - larguraBarra / 2} y={y0} width={larguraBarra} height={h} className={c.cor} />
                })}
                {(!compacto || i % passoRotulo === 0 || i === serie.length - 1) && (
                  <text x={x(i)} y={yb(s.pessoas) - 4} textAnchor="middle" className="fill-foreground" fontSize={fs} fontWeight="700">{s.pessoas}</text>
                )}
                {(i % passoRotulo === 0 || i === serie.length - 1) && (
                  <text x={x(i)} y={HB - 6} textAnchor={ancora(i)} className="fill-muted-foreground" fontSize={fs}>{ddmm(s.semana)}</text>
                )}
              </g>
            )
          })}
        </svg>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {CARGOS_BARRA.map((c) => (
            <span key={c.campo} className="inline-flex items-center gap-1">
              <svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2" className={c.cor} /></svg>{c.rotulo}
            </span>
          ))}
        </div>
      </div>

      {tendencias.length > 0 && (
        <div className="rounded-lg bg-muted px-3 py-2.5">
          <p className="mb-1.5 text-[12.5px] font-semibold">Leitura</p>
          <ul className="flex flex-col gap-1">
            {tendencias.map(({ linha, t }) => <Tendencia key={linha.campo} linha={linha} t={t} />)}
          </ul>
          {pior && (
            <p className="mt-2 text-[12.5px] leading-snug">
              <strong className="text-primary">Onde agir primeiro:</strong> {pior.linha.rotulo.toLowerCase()} — está {Math.round(pior.falta)} pontos abaixo da meta.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
