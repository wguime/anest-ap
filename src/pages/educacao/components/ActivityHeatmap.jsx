import * as React from "react"
import { format, eachDayOfInterval, startOfWeek, subDays, getDay, isSameDay, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/design-system/utils/tokens"

/**
 * ActivityHeatmap — componente próprio (T1.5.17 / Wave 1.5)
 *
 * Substitui react-calendar-heatmap (lib abandonada ~15 meses sem commit).
 * Estilo "GitHub contributions" — grid de 7 linhas (dom-sab) × 53 colunas (semanas).
 *
 * Tailwind + date-fns (já no projeto), zero deps extras.
 *
 * Props:
 *   - activities: Array<{date: 'YYYY-MM-DD', source: string}>
 *   - daysBack: número de dias (default 365)
 *   - onCellClick: opcional, callback(date) ao clicar célula com atividade
 */
export function ActivityHeatmap({ activities = [], daysBack = 365, onCellClick, className }) {
  const today = new Date()
  const start = subDays(today, daysBack - 1)
  const gridStart = startOfWeek(start, { weekStartsOn: 0 }) // domingo

  // Set para lookup rápido
  const activitySet = React.useMemo(() => {
    const set = new Map()
    for (const a of activities) {
      const key = typeof a.date === "string" ? a.date.slice(0, 10) : format(new Date(a.date), "yyyy-MM-dd")
      set.set(key, (set.get(key) || 0) + 1)
    }
    return set
  }, [activities])

  const days = React.useMemo(
    () => eachDayOfInterval({ start: gridStart, end: today }),
    [gridStart, today]
  )

  // Agrupar por coluna (semana) e linha (dia da semana)
  const weeks = React.useMemo(() => {
    const cols = []
    let currentCol = []
    days.forEach((d, idx) => {
      currentCol.push(d)
      if (getDay(d) === 6 || idx === days.length - 1) {
        // padding até 7
        while (currentCol.length < 7) currentCol.push(null)
        cols.push(currentCol)
        currentCol = []
      }
    })
    return cols
  }, [days])

  // 4 níveis de intensidade
  const cellLevel = (date) => {
    if (!date || date > today) return -1 // futuro/empty
    if (date < start) return -1
    const key = format(date, "yyyy-MM-dd")
    const count = activitySet.get(key) || 0
    if (count === 0) return 0
    if (count === 1) return 1
    if (count === 2) return 2
    return 3
  }

  const levelClass = (lvl) => {
    if (lvl === -1) return "bg-transparent"
    if (lvl === 0) return "bg-muted dark:bg-muted/60"
    if (lvl === 1) return "bg-category-teal-bg"
    if (lvl === 2) return "bg-category-teal/60"
    return "bg-category-teal"
  }

  const totalAtivos = activitySet.size
  const streakCurrent = (() => {
    let c = 0
    for (let i = 0; i < daysBack; i++) {
      const d = subDays(today, i)
      const key = format(d, "yyyy-MM-dd")
      if (activitySet.has(key)) c++
      else if (i > 0) break
    }
    return c
  })()

  return (
    <div className={cn("space-y-3", className)} role="img" aria-label={`Mapa de atividade: ${totalAtivos} dias ativos nos últimos ${daysBack} dias`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalAtivos} dias ativos nos últimos {daysBack} dias</span>
        {streakCurrent > 0 && (
          <span className="font-semibold text-success">🔥 {streakCurrent} {streakCurrent === 1 ? "dia" : "dias"} seguidos</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-1" style={{ minWidth: "fit-content" }}>
          {weeks.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {col.map((d, di) => {
                const lvl = cellLevel(d)
                if (lvl === -1) {
                  return <div key={di} className="w-3 h-3" aria-hidden="true" />
                }
                const key = d ? format(d, "yyyy-MM-dd") : ""
                const dateLabel = d ? format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""
                const count = activitySet.get(key) || 0
                const tooltip = count > 0
                  ? `${count} ${count === 1 ? "atividade" : "atividades"} em ${dateLabel}`
                  : `Sem atividade em ${dateLabel}`
                return (
                  <button
                    key={di}
                    type="button"
                    onClick={() => count > 0 && onCellClick?.(key)}
                    disabled={count === 0}
                    className={cn(
                      "w-3 h-3 rounded-[2px] transition-transform",
                      levelClass(lvl),
                      count > 0 && "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:scale-110",
                      count === 0 && "cursor-default"
                    )}
                    title={tooltip}
                    aria-label={tooltip}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Menos</span>
        <span className={cn("w-3 h-3 rounded-[2px]", levelClass(0))} aria-hidden="true" />
        <span className={cn("w-3 h-3 rounded-[2px]", levelClass(1))} aria-hidden="true" />
        <span className={cn("w-3 h-3 rounded-[2px]", levelClass(2))} aria-hidden="true" />
        <span className={cn("w-3 h-3 rounded-[2px]", levelClass(3))} aria-hidden="true" />
        <span>Mais</span>
      </div>
    </div>
  )
}
