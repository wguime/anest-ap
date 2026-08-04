/**
 * Calendário mensal de ocupação — substrato compartilhado do Mapa (leitura)
 * e da aba Marcar (seleção). Padrão mobile de apps de reserva: tira de
 * meses tingida pela média + mês em células ≥44px com o NÚMERO de
 * marcações (a grade anual de 52 colunas não funciona a 375px).
 *
 * `modo`:
 *  - 'detalhe' (default): tocar abre o detalhe do dia — comportamento do Mapa;
 *  - 'selecao': tocar marca/desmarca o dia; dias que já são meus ganham
 *    contorno próprio e dias fora de prazo ficam esmaecidos (o toque explica
 *    a regra em vez de agir).
 *
 * Escala em tokens DS: verde (folga) → laranja (cheio) → vermelho (7+).
 */
import { useMemo, useRef } from 'react'
import { VAGAS_DIA } from '@/lib/feriasAnalise'

// 0 folga total → 7+ acima do teto
export const ESCALA = [
  { min: 7, classe: 'bg-destructive', texto: 'text-white', rotulo: '7+' },
  { min: 6, classe: 'bg-category-orange', texto: 'text-white', rotulo: '6' },
  { min: 5, classe: 'bg-warning', texto: 'text-white', rotulo: '5' },
  { min: 3, classe: 'bg-success/60', texto: 'text-foreground', rotulo: '3–4' },
  { min: 1, classe: 'bg-success/25', texto: 'text-foreground', rotulo: '1–2' },
  { min: 0, classe: 'bg-muted', texto: 'text-muted-foreground', rotulo: '0' },
]
export const nivelOcupacao = (n) => ESCALA.find((e) => n >= e.min)
export const classeOcupacao = (n) => nivelOcupacao(n).classe

export const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const fmtBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Legenda com o valor de cada cor (cor nunca é o único código). */
export function Legenda({ mostrarMeusDias = false }) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {[...ESCALA].reverse().map((e) => (
          <span key={e.rotulo} className="inline-flex items-center gap-1">
            <span className={`h-3 w-3 rounded-[3px] ${e.classe}`} aria-hidden="true" />
            {e.rotulo}
          </span>
        ))}
        <span className="ml-auto font-medium">pessoas de férias · teto {VAGAS_DIA}/dia</span>
      </div>
      {mostrarMeusDias && (
        // Linha própria: no meio dos números da escala a marca do "meu dia"
        // passava batida (dono 04/08)
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <span
            className="h-4 w-4 shrink-0 rounded-[4px] border-2 border-primary bg-success/25"
            aria-hidden="true"
          />
          Contorno verde = dias em que VOCÊ está de férias
        </p>
      )}
    </div>
  )
}

export function CalendarioOcupacao({
  ano, porDia, mes, onSelectMes,
  // modo detalhe
  onSelectDia, diaSelecionado,
  // modo seleção
  modo = 'detalhe',
  meusDias = new Map(),
  selecionados = { marcar: new Set(), desmarcar: new Set() },
  onToggleDia,
  motivoBloqueio,
}) {
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
    for (let guard = 0; guard < 7; guard++) {
      const dias = []
      for (let i = 0; i < 5; i++) {
        const dia = new Date(d)
        dia.setUTCDate(d.getUTCDate() + i)
        dias.push(dia.toISOString().slice(0, 10))
      }
      const primeiro = new Date(`${dias[0]}T12:00:00Z`)
      if (primeiro.getUTCMonth() > mes && primeiro.getUTCFullYear() >= ano) break
      if (dias.every((x) => new Date(`${x}T12:00:00Z`).getUTCFullYear() > ano)) break
      out.push(dias)
      d.setUTCDate(d.getUTCDate() + 7)
    }
    return out.filter((dias) =>
      dias.some((x) => Number(x.slice(5, 7)) - 1 === mes && x.slice(0, 4) === String(ano))
    )
  }, [ano, mes])

  const selecao = modo === 'selecao'

  // Swipe horizontal troca o mês (dono 04/08). touch nativo em vez de lib:
  // o gesto é simples e o calendário não rola horizontalmente.
  const toque = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    toque.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!toque.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - toque.current.x
    const dy = t.clientY - toque.current.y
    toque.current = null
    // horizontal de verdade (evita roubar o scroll vertical da página)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const proximo = dx < 0 ? mes + 1 : mes - 1
    if (proximo >= 0 && proximo <= 11) onSelectMes(proximo)
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Tira de meses (média do mês dá a cor; toque navega). Ordem LINEAR
          por linha — Jan→Jun em cima, Jul→Dez embaixo (dono 04/08: por
          coluna vale só p/ o card "Por mês" do Individual) */}
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

      <p className="mb-1 text-center text-[11px] text-muted-foreground/70">
        {MES_LABEL[mes]} · arraste para trocar de mês
      </p>
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
              const meu = selecao && meusDias.has(dia)
              const paraMarcar = selecao && selecionados.marcar.has(dia)
              const paraDesmarcar = selecao && selecionados.desmarcar.has(dia)
              const bloqueio = selecao ? motivoBloqueio?.(dia) : null

              const anel = paraMarcar
                ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                : paraDesmarcar
                  ? 'ring-2 ring-destructive ring-offset-1 ring-offset-background'
                  : diaSelecionado === dia
                    ? 'ring-2 ring-primary'
                    : ''

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() =>
                    selecao ? onToggleDia?.(dia) : onSelectDia?.(diaSelecionado === dia ? null : dia)
                  }
                  aria-label={`${fmtBr(dia)}: ${n} marcaç${n === 1 ? 'ão' : 'ões'}${meu ? ', você está de férias' : ''}${bloqueio ? `, indisponível: ${bloqueio}` : ''}`}
                  aria-pressed={selecao ? paraMarcar || paraDesmarcar : diaSelecionado === dia}
                  className={`relative h-11 rounded-xl flex flex-col items-center justify-center transition-transform active:scale-95 ${nivel.classe} ${anel} ${
                    meu ? 'border-2 border-primary' : ''
                  } ${bloqueio ? 'opacity-40' : ''}`}
                >
                  <span className={`text-[11px] leading-none ${nivel.texto} opacity-80`}>
                    {Number(dia.slice(8, 10))}
                  </span>
                  <span className={`text-[14px] font-bold leading-tight tabular-nums ${nivel.texto}`}>
                    {n || '·'}
                  </span>
                  {(paraMarcar || paraDesmarcar) && (
                    <span
                      aria-hidden="true"
                      className={`absolute -top-1 -right-1 h-4 w-4 rounded-full text-[11px] font-bold leading-4 text-white ${
                        paraMarcar ? 'bg-primary' : 'bg-destructive'
                      }`}
                    >
                      {paraMarcar ? '+' : '−'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
