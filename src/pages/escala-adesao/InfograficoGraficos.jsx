/**
 * Gráficos do infográfico "Evolução da adesão" (dono 27/10/2026, exemplo 3 "Impacto").
 *
 * SVG próprio, como o `GraficoEvolucao`: a largura acompanha o contêiner (viewBox fixo de 380) e a
 * cor vem do tripleto HSL do tema (`hsl(var(--token))`), que troca sozinho no `.dark`. Marcas finas,
 * rótulo direto no ponto que conta a história, e a reta de tendência (mínimos quadrados) como faixa
 * clara atrás da linha — é ela que mostra a inclinação que o dono pediu em destaque.
 */
import { pct } from '@/lib/escalaAdesaoInfografico'

const W = 380
const tk = (nome, alfa) => (alfa == null ? `hsl(var(--${nome}))` : `hsl(var(--${nome}) / ${alfa})`)

export const COR_LINHA = {
  ini: tk('category-blue'),
  ter: tk('primary'),
  terProprio: tk('category-purple'),
  tot: tk('category-orange'),
}

/** Reta de mínimos quadrados: { a (por semana), b } — null com menos de 2 pontos. */
function reta(valores) {
  const pts = valores.map((y, x) => ({ x, y })).filter((p) => p.y != null)
  if (pts.length < 2) return null
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  const a = sxx ? pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0
  return { a, b: my - a * mx }
}

/** Coluna com só o topo arredondado (a base fica reta, presa ao eixo). */
function topo(x, y, w, h, r = 4) {
  if (h <= 0) return ''
  const k = Math.min(r, h, w / 2)
  return `M${x},${y + h}V${y + k}Q${x},${y} ${x + k},${y}H${x + w - k}Q${x + w},${y} ${x + w},${y + k}V${y + h}Z`
}

const ancora = (i, n) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle')

/** Engajados por semana sobre o bloco verde: semanas anteriores apagadas, as do período em branco. */
export function ColunasEngajados({ colunas }) {
  const H = 170, T = 22, B = 20, ih = H - T - B, base = T + ih
  const max = Math.max(1, ...colunas.map((c) => c.valor))
  const slot = W / colunas.length
  const bw = Math.min(30, slot * 0.56)
  const Y = (v) => base - (v / max) * ih
  const n = colunas.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Pessoas engajadas por semana">
      {colunas.map((c, i) => {
        const x = i * slot + (slot - bw) / 2
        const ultima = i === n - 1
        return (
          <g key={`${c.rotulo}-${i}`}>
            <title>{`Semana de ${c.rotulo}: ${c.valor} engajados`}</title>
            <path d={topo(x, Y(c.valor), bw, base - Y(c.valor))} style={{ fill: tk('primary-foreground', c.anterior ? 0.3 : 1) }} />
            <text x={x + bw / 2} y={Y(c.valor) - 6} textAnchor="middle" fontSize={ultima ? 14 : 11.5} fontWeight="800" style={{ fill: tk('primary-foreground') }}>
              {c.valor}
            </text>
            {(n <= 6 || i % 2 === 0 || ultima) && (
              <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="10" style={{ fill: tk('primary-foreground', 0.65) }}>{c.rotulo}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Série interrompida do início marcado: as semanas anteriores em cinza, as do período na cor, uma
 * reta para cada trecho com a inclinação escrita — o "antes × depois" do relatório.
 */
export function SerieInterrompida({ anteriores, serie, rotulos, rotuloAntes, rotuloDepois, marco, meta }) {
  const H = 220, L = 34, R = 12, T = 34, B = 24, iw = W - L - R, ih = H - T - B
  const todos = [...anteriores, ...serie]
  const n = todos.length
  const X = (i) => L + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
  const Y = (v) => T + ih - (Math.max(0, Math.min(100, v ?? 0)) / 100) * ih
  const cor = tk('primary')
  const cinza = tk('muted-foreground', 0.55)
  const r1 = reta(anteriores)
  const r2 = reta(serie)
  const k = anteriores.length
  const pontos = (vals, desde) => vals.map((v, i) => (v == null ? null : `${X(i + desde)},${Y(v)}`)).filter(Boolean).join(' ')
  const ultimo = serie[serie.length - 1]
  const meio2 = k + (serie.length - 1) / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Início marcado por semana, antes e depois">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} style={{ stroke: tk('border') }} />
          <text x={L - 6} y={Y(v) + 3.5} textAnchor="end" fontSize="10" style={{ fill: tk('muted-foreground') }}>{v}%</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={Y(meta)} y2={Y(meta)} strokeWidth="1.2" style={{ stroke: tk('foreground', 0.5) }} />
      <text x={L + 4} y={Y(meta) - 5} fontSize="10" fontWeight="700" style={{ fill: tk('muted-foreground') }}>meta {meta}%</text>
      {marco && k > 0 && (
        <g>
          <line x1={(X(k - 1) + X(k)) / 2} x2={(X(k - 1) + X(k)) / 2} y1={T - 18} y2={T + ih} style={{ stroke: tk('foreground', 0.55) }} />
          <circle cx={(X(k - 1) + X(k)) / 2} cy={T - 18} r="3" style={{ fill: tk('foreground') }} />
          <text x={(X(k - 1) + X(k)) / 2 + 6} y={T - 14} fontSize="10.5" fontWeight="800" style={{ fill: tk('foreground') }}>{marco.rotulo}</text>
        </g>
      )}
      {r1 && <line x1={X(0)} y1={Y(r1.b)} x2={X(k - 1)} y2={Y(r1.a * (k - 1) + r1.b)} strokeWidth="10" strokeLinecap="round" opacity=".35" style={{ stroke: cinza }} />}
      {r2 && <line x1={X(k)} y1={Y(r2.b)} x2={X(n - 1)} y2={Y(r2.a * (serie.length - 1) + r2.b)} strokeWidth="12" strokeLinecap="round" opacity=".22" style={{ stroke: cor }} />}
      {k > 0 && <polyline points={pontos(anteriores, 0)} fill="none" strokeWidth="2" style={{ stroke: cinza }} />}
      <polyline points={pontos(k > 0 ? [anteriores[k - 1], ...serie] : serie, k > 0 ? k - 1 : 0)} fill="none" strokeWidth="2.5" strokeLinejoin="round" style={{ stroke: cor }} />
      {todos.map((v, i) => v != null && (
        <circle key={i} cx={X(i)} cy={Y(v)} r={i === n - 1 ? 5.5 : 3.5} strokeWidth="2" style={{ fill: i >= k ? cor : cinza, stroke: tk('category-green-bg') }}>
          <title>{`Semana de ${rotulos[i]}: ${pct(v)}%`}</title>
        </circle>
      ))}
      {ultimo != null && (
        <text x={X(n - 1)} y={Y(ultimo) - 10} textAnchor="end" fontSize="13" fontWeight="800" style={{ fill: tk('foreground') }}>{pct(ultimo)}%</text>
      )}
      {r1 && rotuloAntes && (
        <text x={X((k - 1) / 2)} y={Y(r1.a * ((k - 1) / 2) + r1.b) + 22} textAnchor="middle" fontSize="11" fontWeight="700" style={{ fill: tk('muted-foreground') }}>
          {rotuloAntes}
        </text>
      )}
      {r2 && rotuloDepois && (
        <g transform={`translate(${X(meio2) - 6} ${Y(r2.a * (meio2 - k) + r2.b) + 36})`}>
          <rect x="-34" y="-12" width="80" height="20" rx="10" style={{ fill: cor }} />
          <text x="6" y="2.5" textAnchor="middle" fontSize="11.5" fontWeight="800" style={{ fill: tk('primary-foreground') }}>{rotuloDepois}</text>
        </g>
      )}
      {rotulos.map((d, i) => (n <= 6 || i % 2 === 0 || i === n - 1) && (
        <text key={`${d}-${i}`} x={X(i)} y={H - 6} textAnchor={ancora(i, n)} fontSize="10" style={{ fill: tk('muted-foreground') }}>{d}</text>
      ))}
    </svg>
  )
}

/** Evolução semana a semana: uma linha por indicador e a faixa da tendência atrás de cada uma. */
export function EvolucaoLinhas({ linhas, rotulos, meta }) {
  const H = 200, L = 36, R = 10, T = 10, B = 22, iw = W - L - R, ih = H - T - B
  const n = rotulos.length
  const X = (i) => L + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
  const Y = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Evolução semana a semana dos indicadores">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} style={{ stroke: tk('border') }} />
          <text x={L - 6} y={Y(v) + 3.5} textAnchor="end" fontSize="10" style={{ fill: tk('muted-foreground') }}>{v}%</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={Y(meta)} y2={Y(meta)} strokeWidth="1.2" style={{ stroke: tk('foreground', 0.5) }} />
      <text x={L + 4} y={Y(meta) - 5} fontSize="10" fontWeight="700" style={{ fill: tk('muted-foreground') }}>meta {meta}%</text>
      {linhas.map((l) => {
        const r = reta(l.valores)
        return r && (
          <line key={`t-${l.chave}`} x1={X(0)} y1={Y(r.b)} x2={X(n - 1)} y2={Y(r.a * (n - 1) + r.b)} strokeWidth="12" strokeLinecap="round" opacity=".16" style={{ stroke: COR_LINHA[l.chave] }} />
        )
      })}
      {linhas.map((l) => (
        <g key={l.chave}>
          <polyline
            points={l.valores.map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`)).filter(Boolean).join(' ')}
            fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: COR_LINHA[l.chave] }}
          />
          {l.valores.map((v, i) => v != null && (
            <circle key={i} cx={X(i)} cy={Y(v)} r={i === n - 1 ? 4.5 : 3} strokeWidth="2" style={{ fill: COR_LINHA[l.chave], stroke: tk('card') }}>
              <title>{`${l.nome} · semana de ${rotulos[i]}: ${pct(v)}%`}</title>
            </circle>
          ))}
        </g>
      ))}
      {rotulos.map((d, i) => (
        <text key={`${d}-${i}`} x={X(i)} y={H - 6} textAnchor={ancora(i, n)} fontSize="10.5" style={{ fill: tk('muted-foreground') }}>{d}</text>
      ))}
    </svg>
  )
}

const PARTES_QUEM = [
  { rotulo: 'o próprio', cor: tk('primary'), tinta: tk('primary-foreground') },
  { rotulo: 'colega anestesiologista', cor: tk('primary', 0.38), tinta: tk('foreground') },
  { rotulo: 'enfermagem, hospital, residente', cor: tk('muted-foreground', 0.35), tinta: tk('foreground') },
]

/** Quem marcou início e término: barra 100% por semana, com a % dentro do segmento quando cabe. */
export function BarrasQuemMarca({ barras }) {
  const w = 300, h = 28
  return (
    <div className="flex flex-col gap-1.5">
      {barras.map((b) => {
        let x = 0
        return (
          <div key={b.rotulo} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11.5px] font-bold tabular-nums text-muted-foreground">{b.rotulo}</span>
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 flex-1" role="img" aria-label={`Semana de ${b.rotulo}: ${b.partes.map((p, i) => `${PARTES_QUEM[i].rotulo} ${p}%`).join(', ')}`}>
              {b.partes.map((p, i) => {
                const pw = Math.max(0, (p / 100) * w - (i < b.partes.length - 1 ? 2 : 0))
                const x0 = x
                x += pw + 2
                return (
                  <g key={i}>
                    <rect x={x0} y="0" width={pw} height={h} rx="4" style={{ fill: PARTES_QUEM[i].cor }} />
                    {pw > 30 && (
                      <text x={x0 + pw / 2} y={h / 2 + 4.5} textAnchor="middle" fontSize="12" fontWeight="800" style={{ fill: PARTES_QUEM[i].tinta }}>{p}%</text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {PARTES_QUEM.map((p) => (
          <span key={p.rotulo} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: p.cor }} aria-hidden="true" />
            {p.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}
