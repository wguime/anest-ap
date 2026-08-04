/**
 * MapaFeriasView — aba "Mapa" do Extrato de Férias.
 *
 * Mapa de calor de ocupação das vagas diárias (aprovado pelo dono 03/08):
 *  1. Heatmap do ano corrente (colunas = semanas, linhas = seg–sex; toque
 *     num dia mostra quem marcou);
 *  2. Plurianual (linha por ano × semanas ISO — padrões recorrentes);
 *  3. Semanas mais/menos procuradas na média dos anos;
 *  4. Métricas de gestão + sugestões derivadas do histórico.
 *
 * Histórico direto da API (sondagem 03/08: serve 2023+ e o ano seguinte);
 * anos passados cacheados em localStorage (imutáveis). Escala de cor em
 * tokens DS — verde (folga) → âmbar/laranja (cheio) → vermelho (acima do
 * teto); legenda sempre visível (cor nunca é o único código: célula
 * selecionada mostra o número).
 */
import { useState, useEffect, useMemo } from 'react'
import { Lightbulb, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, Skeleton, Alert } from '@/design-system'
import { getFeriasDoAnoMin } from '@/services/pegaPlantaoApi'
import {
  VAGAS_DIA, ocupacaoPorDia, serieSemanal, rankingSemanas, metricasGestao,
  labelSemana, semanaISO,
} from '@/lib/feriasAnalise'

const ANOS_HISTORICO = 3 // além do atual: 3 p/ trás + 1 p/ frente

// Escala de ocupação (tokens DS): 0 folga total → 7+ acima do teto
const ESCALA = [
  { min: 7, classe: 'bg-destructive', texto: 'text-white', rotulo: '7+' },
  { min: 6, classe: 'bg-category-orange', texto: 'text-white', rotulo: '6' },
  { min: 5, classe: 'bg-warning', texto: 'text-white', rotulo: '5' },
  { min: 3, classe: 'bg-success/60', texto: 'text-foreground', rotulo: '3–4' },
  { min: 1, classe: 'bg-success/25', texto: 'text-foreground', rotulo: '1–2' },
  { min: 0, classe: 'bg-muted', texto: 'text-muted-foreground', rotulo: '0' },
]
const nivelOcupacao = (n) => ESCALA.find((e) => n >= e.min)
const classeOcupacao = (n) => nivelOcupacao(n).classe

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmtBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const titleCase = (n) => n.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())

function Legenda() {
  // Cada cor com o seu significado numérico (dono 04/08) — cor nunca sozinha
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {[...ESCALA].reverse().map((e) => (
          <span key={e.rotulo} className="inline-flex items-center gap-1">
            <span className={`h-3 w-3 rounded-[3px] ${e.classe}`} aria-hidden="true" />
            {e.rotulo}
          </span>
        ))}
        <span className="ml-auto font-medium">marcações · teto {VAGAS_DIA}/dia</span>
      </div>
    </div>
  )
}

/**
 * Calendário mensal tocável (padrão mobile de apps de booking — a grade
 * anual de 52 colunas não funciona a 375px): tira de meses tingida pela
 * média + mês selecionado com células grandes (≥44px) mostrando o NÚMERO
 * de marcações; toque na célula abre o detalhe do dia.
 */
function CalendarioOcupacao({ ano, porDia, onSelectDia, diaSelecionado, mes, onSelectMes }) {
  // Média de ocupação por mês (tira de navegação)
  const mediaMes = useMemo(() => {
    const soma = Array.from({ length: 12 }, () => ({ s: 0, d: 0 }))
    for (const [data, nomes] of porDia) {
      if (data.slice(0, 4) !== String(ano)) continue
      const m = Number(data.slice(5, 7)) - 1
      soma[m].s += nomes.length
      soma[m].d += 1
    }
    return soma.map(({ s, d }) => (d ? Math.round(s / d) : 0))
  }, [porDia, ano])

  // Semanas (seg–sex) do mês selecionado
  const semanas = useMemo(() => {
    const out = []
    const d = new Date(Date.UTC(ano, mes, 1))
    const dow = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() - dow) // segunda da 1ª semana
    while (true) {
      const dias = []
      for (let i = 0; i < 5; i++) {
        const dia = new Date(d)
        dia.setUTCDate(d.getUTCDate() + i)
        dias.push(dia.toISOString().slice(0, 10))
      }
      if (new Date(`${dias[0]}T12:00:00Z`).getUTCMonth() > mes && new Date(`${dias[0]}T12:00:00Z`).getUTCFullYear() >= ano) break
      if (dias.every((x) => new Date(`${x}T12:00:00Z`).getUTCFullYear() > ano)) break
      out.push(dias)
      d.setUTCDate(d.getUTCDate() + 7)
      if (out.length > 6) break
    }
    return out.filter((dias) => dias.some((x) => Number(x.slice(5, 7)) - 1 === mes && x.slice(0, 4) === String(ano)))
  }, [ano, mes])

  return (
    <div>
      {/* Tira de meses (média do mês dá a cor; toque navega) */}
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {MES_LABEL.map((rotulo, m) => {
          const nivel = nivelOcupacao(mediaMes[m])
          return (
            <button
              key={rotulo}
              type="button"
              onClick={() => onSelectMes(m)}
              aria-pressed={mes === m}
              className={`rounded-lg py-1.5 text-[11px] font-semibold transition-transform active:scale-95 ${nivel.classe} ${nivel.texto} ${
                mes === m ? 'ring-2 ring-primary' : ''
              }`}
            >
              {rotulo}
            </button>
          )
        })}
      </div>

      {/* Mês selecionado: células grandes com o nº de marcações */}
      <div className="grid grid-cols-5 gap-1.5 mb-1 text-center text-[11px] font-medium text-muted-foreground">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="space-y-1.5">
        {semanas.map((dias) => (
          <div key={dias[0]} className="grid grid-cols-5 gap-1.5">
            {dias.map((dia) => {
              const doMes = Number(dia.slice(5, 7)) - 1 === mes && dia.slice(0, 4) === String(ano)
              if (!doMes) return <span key={dia} />
              const n = porDia.get(dia)?.length || 0
              const nivel = nivelOcupacao(n)
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => onSelectDia(diaSelecionado === dia ? null : dia)}
                  aria-label={`${fmtBr(dia)}: ${n} marcações`}
                  aria-pressed={diaSelecionado === dia}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center transition-transform active:scale-95 ${nivel.classe} ${
                    diaSelecionado === dia ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <span className={`text-[11px] leading-none ${nivel.texto} opacity-80`}>{Number(dia.slice(8, 10))}</span>
                  <span className={`text-[14px] font-bold leading-tight tabular-nums ${nivel.texto}`}>{n || '·'}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Plurianual: linha por ano × semanas ISO, cor = média semanal. */
function HeatmapPlurianual({ seriesPorAno }) {
  const anos = Object.keys(seriesPorAno).map(Number).sort()
  const maxSemanas = Math.max(...anos.map((a) => seriesPorAno[a].length))
  // Régua de meses no topo (dono 04/08): rótulo na semana ISO em que o mês
  // começa, calculado no ano mais recente da série
  const anoRef = anos[anos.length - 1]
  const mesesNaSemana = useMemo(() => {
    const out = new Array(maxSemanas).fill('')
    for (let m = 0; m < 12; m++) {
      const { ano: aISO, semana } = semanaISO(`${anoRef}-${String(m + 1).padStart(2, '0')}-01`)
      if (aISO === anoRef && semana <= maxSemanas && !out[semana - 1]) out[semana - 1] = MES_LABEL[m]
    }
    return out
  }, [anoRef, maxSemanas])

  return (
    <div className="overflow-x-auto pb-1 -mx-1 px-1">
      <div className="flex items-center gap-[3px] mb-1">
        <span className="w-8 shrink-0" />
        {mesesNaSemana.map((rotulo, i) => (
          <span key={i} className="w-3 shrink-0 text-[9px] leading-none text-muted-foreground overflow-visible whitespace-nowrap">
            {rotulo}
          </span>
        ))}
      </div>
      <div className="space-y-[3px]">
        {anos.map((ano) => (
          <div key={ano} className="flex items-center gap-[3px]">
            <span className="w-8 shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">{ano}</span>
            {Array.from({ length: maxSemanas }, (_, i) => {
              const s = seriesPorAno[ano][i]
              const media = s ? Math.round(s.media) : 0
              return (
                <span
                  key={i}
                  title={`${ano} sem ${i + 1}: média ${s ? s.media.toFixed(1) : 0}`}
                  className={`h-3 w-3 shrink-0 rounded-[3px] ${s ? classeOcupacao(media) : 'bg-transparent'}`}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MapaFeriasView({ ano, registrosAtual, ultimosPorDia = new Map() }) {
  const [historico, setHistorico] = useState({}) // ano → registrosMin
  const [carregandoHist, setCarregandoHist] = useState(true)
  const [erroHist, setErroHist] = useState(false)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [mes, setMes] = useState(() => new Date().getMonth())

  // Histórico: 3 anos p/ trás + ano seguinte (sondagem 03/08: API serve
  // ambos). Pausa entre anos + 1 retry: 48 chamadas seguidas derrubaram
  // 2 anos por rate do proxy no smoke de 03/08.
  useEffect(() => {
    let vivo = true
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      const alvos = [ano - 3, ano - 2, ano - 1, ano + 1]
      for (const a of alvos) {
        let ok = false
        for (let tentativa = 0; tentativa < 2 && !ok && vivo; tentativa++) {
          try {
            const regs = await getFeriasDoAnoMin(a)
            ok = true
            if (vivo) setHistorico((h) => ({ ...h, [a]: regs }))
          } catch {
            if (tentativa === 0) await pausa(2000)
          }
        }
        if (!ok && vivo) setErroHist(true)
        await pausa(800)
      }
      if (vivo) setCarregandoHist(false)
    })()
    return () => { vivo = false }
  }, [ano])

  const porDiaAtual = useMemo(() => ocupacaoPorDia(registrosAtual), [registrosAtual])

  const registrosPorAno = useMemo(
    () => ({ ...historico, [ano]: registrosAtual }),
    [historico, ano, registrosAtual]
  )
  const seriesPorAno = useMemo(() => {
    const out = {}
    for (const [a, regs] of Object.entries(registrosPorAno)) {
      if (Number(a) > ano) continue // futuro fica fora da média histórica
      out[a] = serieSemanal(ocupacaoPorDia(regs), Number(a))
    }
    return out
  }, [registrosPorAno, ano])

  const ranking = useMemo(() => rankingSemanas(seriesPorAno), [seriesPorAno])
  const metricas = useMemo(
    () => metricasGestao({ registrosPorAno, anoAtual: ano }),
    [registrosPorAno, ano]
  )

  const nomesDoDia = diaSelecionado ? porDiaAtual.get(diaSelecionado) || [] : []

  return (
    <div className="space-y-3">
      {/* 1 — Ano corrente */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
          Ocupação diária — {ano}
        </p>
        <CalendarioOcupacao
          ano={ano}
          porDia={porDiaAtual}
          onSelectDia={setDiaSelecionado}
          diaSelecionado={diaSelecionado}
          mes={mes}
          onSelectMes={(m) => { setMes(m); setDiaSelecionado(null) }}
        />
        <Legenda />
        {diaSelecionado && (
          <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-[13px]">
            <span className="font-semibold text-foreground">
              {fmtBr(diaSelecionado)} · {nomesDoDia.length} marcaç{nomesDoDia.length === 1 ? 'ão' : 'ões'}
            </span>
            {nomesDoDia.length > 0 && (
              <span className="text-muted-foreground"> — {nomesDoDia.map(titleCase).join(', ')}</span>
            )}
            {nomesDoDia.length > VAGAS_DIA && (
              <p className="mt-1 text-destructive font-medium">
                {ultimosPorDia.get(diaSelecionado)?.confiavel
                  ? `Último a marcar: ${ultimosPorDia.get(diaSelecionado).nomeCompleto} (visto em ${fmtBr(ultimosPorDia.get(diaSelecionado).vistoEm)})`
                  : 'Ordem de marcação anterior ao acompanhamento — sem como apontar o último.'}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 2 — Plurianual */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
          Comparativo por ano (média semanal)
        </p>
        {carregandoHist && Object.keys(historico).length === 0 ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : (
          <HeatmapPlurianual seriesPorAno={{ ...seriesPorAno }} />
        )}
        {erroHist && (
          <p className="mt-2 text-[11px] text-warning">Parte do histórico não carregou — os números abaixo consideram só os anos disponíveis.</p>
        )}
      </Card>

      {/* 3 — Rankings */}
      {ranking.maisProcuradas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-2">
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> Semanas mais procuradas
            </p>
            <ul className="space-y-1">
              {ranking.maisProcuradas.map((s) => (
                <li key={s.semana} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{labelSemana(ano, s.semana)}</span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    média {s.mediaAnos.toFixed(1)}/dia
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-2">
              <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" /> Semanas com mais folga
            </p>
            <ul className="space-y-1">
              {ranking.menosProcuradas.map((s) => (
                <li key={s.semana} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{labelSemana(ano, s.semana)}</span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    média {s.mediaAnos.toFixed(1)}/dia
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* 4 — Métricas de gestão */}
      {metricas.porAno.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
            Métricas de gestão
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Ano</th>
                  <th className="py-1 pr-2 font-medium text-right">Dias-pessoa</th>
                  <th className="py-1 pr-2 font-medium text-right">Utilização</th>
                  <th className="py-1 pr-2 font-medium text-right">Dias no teto</th>
                  <th className="py-1 font-medium text-right">7+</th>
                </tr>
              </thead>
              <tbody>
                {metricas.porAno.map((m) => (
                  <tr key={m.ano} className={`border-t border-border ${m.ano === ano ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                    <td className="py-1.5 pr-2 tabular-nums">{m.ano}{m.ano > ano ? '*' : ''}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{m.diasPessoa}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{m.utilizacaoPct}%</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{m.diasNoTeto}</td>
                    <td className={`py-1.5 text-right tabular-nums ${m.diasAcimaTeto > 0 ? 'text-destructive font-semibold' : ''}`}>{m.diasAcimaTeto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Utilização = dias-pessoa ÷ (dias úteis × {VAGAS_DIA} vagas). {metricas.porAno.some((m) => m.ano > ano) ? '* ano seguinte, em marcação.' : ''}
          </p>
        </Card>
      )}

      {/* 5 — Sugestões */}
      {metricas.insights.length > 0 && (
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-2">
            <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Sugestões de gestão
          </p>
          <ul className="space-y-2">
            {metricas.insights.map((texto, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-foreground/90">
                {texto}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
