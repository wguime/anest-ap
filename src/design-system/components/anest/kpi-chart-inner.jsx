import * as React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

// Recharts não resolve var(--*) em atributos SVG. Os hex abaixo espelham tokens:
// #6B7280 → --muted-foreground | #C8E6C9 → --border | #9CA3AF → neutro
const MUTED_FG = "#6B7280"
const BORDER = "#C8E6C9"
const NEUTRAL = "#9CA3AF"

export default function KPIChartInner({ chartData, meta, formattedMeta, unidade, statusCfg }) {
  const lineColor = statusCfg?.color || "#004225"
  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: MUTED_FG }}
            axisLine={{ stroke: BORDER }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: MUTED_FG }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              padding: "8px 12px",
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value) => [
              `${value.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}${unidade}`,
              "Valor",
            ]}
          />
          {meta !== undefined && (
            <ReferenceLine
              y={meta}
              stroke={NEUTRAL}
              strokeDasharray="5 5"
              label={{
                value: `Meta: ${formattedMeta}${unidade}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: NEUTRAL,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="valor"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
