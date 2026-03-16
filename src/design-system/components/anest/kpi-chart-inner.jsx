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

export default function KPIChartInner({ chartData, meta, formattedMeta, unidade, statusCfg }) {
  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#374151", fontWeight: 600 }}
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
              stroke="#9CA3AF"
              strokeDasharray="5 5"
              label={{
                value: `Meta: ${formattedMeta}${unidade}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "#9CA3AF",
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="valor"
            stroke={statusCfg.color}
            strokeWidth={2.5}
            dot={{ r: 4, fill: statusCfg.color, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: statusCfg.color, strokeWidth: 2, stroke: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
