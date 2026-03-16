import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/design-system/utils/tokens'

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Custom tooltip for the trend chart
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const val = payload[0]?.value
  if (val == null) return null

  return (
    <div className="bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">{label}</p>
      <p className="text-sm font-semibold text-[#004225] dark:text-[#2ECC71]">
        {typeof val === 'number' ? val.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : val}
      </p>
    </div>
  )
}

/**
 * KpiTrendChart - Trend chart for monthly KPI values
 *
 * @param {Object} props
 * @param {Object} props.indicador - Full indicator object (optional, alternative to meses/meta)
 * @param {number[]} props.meses - Array of 12 monthly values (null for missing)
 * @param {{ op: string, target: number }} props.meta - Parsed meta object with target value
 * @param {string} props.className
 */
export default function KpiTrendChart({ indicador, meses, meta, className }) {
  // Allow passing either indicador or direct meses/meta
  const monthlyValues = meses || indicador?.meses || []
  const metaParsed = meta || indicador?.meta

  const chartData = useMemo(() => {
    return MESES_LABELS.map((label, idx) => {
      const val = monthlyValues[idx]
      return {
        mes: label,
        valor: val != null ? val : null,
      }
    })
  }, [monthlyValues])

  // Filter out entries with no data for a cleaner chart
  const hasAnyData = chartData.some((d) => d.valor !== null)

  // Compute Y-axis domain
  const yDomain = useMemo(() => {
    const values = monthlyValues.filter((v) => v != null)
    if (values.length === 0) return [0, 100]

    let min = Math.min(...values)
    let max = Math.max(...values)

    // Include meta target in range if available
    if (metaParsed?.target != null && !isNaN(metaParsed.target)) {
      min = Math.min(min, metaParsed.target)
      max = Math.max(max, metaParsed.target)
    }

    // Add padding
    const padding = (max - min) * 0.15 || 5
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)]
  }, [monthlyValues, metaParsed])

  if (!hasAnyData) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-[200px] text-sm text-[#9CA3AF] dark:text-[#6B8178]',
          className
        )}
      >
        Sem dados para exibir
      </div>
    )
  }

  const metaTarget = metaParsed?.target != null && !isNaN(metaParsed.target) ? metaParsed.target : null

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-[#2A3F36]" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Meta reference line */}
          {metaTarget !== null && (
            <ReferenceLine
              y={metaTarget}
              stroke="#DC2626"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `Meta: ${metaTarget}`,
                position: 'insideTopRight',
                fill: '#DC2626',
                fontSize: 10,
              }}
            />
          )}

          {/* Values line */}
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#006837"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#006837', stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#006837', stroke: '#fff', strokeWidth: 2 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
