import * as React from "react"
import { LineChart, Line, ResponsiveContainer } from "recharts"

/**
 * SparklineChart - Mini gráfico de linha para cards
 * 
 * @param {number[]} data - Array de valores numéricos
 * @param {string} color - Cor da linha (default: #006837)
 * @param {number} height - Altura do gráfico (default: 32)
 * @param {number} strokeWidth - Espessura da linha (default: 2)
 */
function SparklineChart({
  data = [],
  color = "#006837",
  height = 32,
  strokeWidth = 2,
}) {
  // Convert array of numbers to chart data format
  const chartData = React.useMemo(() => {
    return data.map((value, index) => ({
      index,
      value,
    }))
  }, [data])

  if (chartData.length === 0) {
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={strokeWidth}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export { SparklineChart }

