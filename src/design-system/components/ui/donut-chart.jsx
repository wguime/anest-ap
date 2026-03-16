import * as React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts"
import { cn } from "@/design-system/utils/tokens"

const COLOR_PALETTE = [
  "#006837",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#F97316",
  "#78716C",
]

const SIZE_MAP = { sm: 160, md: 200, lg: 240 }

function renderActiveShape(props) {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle, fill,
  } = props
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  )
}

function DonutChart({
  data = [],
  labelKey = "label",
  valueKey = "value",
  title,
  totalLabel = "Total",
  size = "md",
  showLegend = true,
  showTotal = true,
  maxCategories = 5,
  othersLabel = "Outros",
  formatValue,
  onItemClick,
  className,
  ...props
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState(-1)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)

  const activeIndex = hoveredIndex >= 0 ? hoveredIndex : selectedIndex
  const chartSize = SIZE_MAP[size] || SIZE_MAP.md

  const formatVal = (val) => {
    if (formatValue) return formatValue(val)
    const n = Number(val)
    if (!Number.isFinite(n)) return "0"
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
    if (n >= 1000) return (n / 1000).toFixed(1) + "K"
    return n.toLocaleString("pt-BR")
  }

  const processedData = React.useMemo(() => {
    const items = Array.isArray(data) ? data : []
    const filtered = items
      .filter((item) => {
        const v = Number(item[valueKey])
        return Number.isFinite(v) && v > 0
      })
      .sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0))

    if (filtered.length > maxCategories) {
      const main = filtered.slice(0, maxCategories - 1)
      const others = filtered.slice(maxCategories - 1)
      const othersValue = others.reduce(
        (sum, item) => sum + (Number(item[valueKey]) || 0),
        0
      )
      main.push({
        [labelKey]: othersLabel,
        [valueKey]: othersValue,
        color: "#78716C",
        isOthers: true,
      })
      return main
    }

    return filtered
  }, [data, labelKey, valueKey, maxCategories, othersLabel])

  const total = React.useMemo(() => {
    return processedData.reduce(
      (sum, item) => sum + (Number(item[valueKey]) || 0),
      0
    )
  }, [processedData, valueKey])

  const chartData = React.useMemo(() => {
    return processedData.map((item, index) => ({
      name: item[labelKey],
      value: Number(item[valueKey]) || 0,
      color: item.color || COLOR_PALETTE[index % COLOR_PALETTE.length],
      percentage: total > 0 ? Math.round((Number(item[valueKey]) || 0) / total * 100) : 0,
      originalItem: item,
    }))
  }, [processedData, labelKey, valueKey, total])

  const contrastTextFor = (hex) => {
    if (typeof hex !== "string") return "#FFFFFF"
    const cleaned = hex.replace("#", "").trim()
    const full =
      cleaned.length === 3
        ? cleaned.split("").map((c) => c + c).join("")
        : cleaned
    if (full.length !== 6) return "#FFFFFF"
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 160 ? "#111827" : "#FFFFFF"
  }

  const centerData = activeIndex >= 0 ? chartData[activeIndex] : null

  // Legend click: only visual highlight (no callback)
  const handleLegendClick = React.useCallback(
    (index) => {
      setSelectedIndex((prev) => (prev === index ? -1 : index))
    },
    []
  )

  const handleDeselect = React.useCallback(() => {
    setHoveredIndex(-1)
    setSelectedIndex(-1)
  }, [])

  const onPieEnter = React.useCallback((_, index) => {
    setHoveredIndex(index)
  }, [])

  const onPieLeave = React.useCallback(() => {
    setHoveredIndex(-1)
  }, [])

  // Pie segment click: highlight + fire onItemClick callback
  const onPieClick = React.useCallback((_, index) => {
    const newIndex = selectedIndex === index ? -1 : index
    setSelectedIndex(newIndex)
    if (newIndex >= 0 && onItemClick) {
      onItemClick(chartData[newIndex]?.originalItem, newIndex)
    }
  }, [selectedIndex, onItemClick, chartData])

  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-6",
          "text-[#9CA3AF] dark:text-[#6B8178]",
          className
        )}
        style={{ minWidth: chartSize }}
        {...props}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" strokeDasharray="3 3" opacity="0.5" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
        <span className="text-[12px]">Sem dados</span>
      </div>
    )
  }

  return (
    <div
      data-slot="donut-chart"
      role="img"
      aria-label={title ? `Gráfico: ${title}` : "Gráfico de rosca"}
      className={cn("flex flex-col items-center w-full max-w-[320px]", className)}
      {...props}
    >
      {/* Recharts Donut */}
      <div className="relative" style={{ width: chartSize, height: chartSize }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={chartData.length > 1 ? 2 : 0}
              dataKey="value"
              activeIndex={activeIndex >= 0 ? activeIndex : undefined}
              activeShape={renderActiveShape}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              onClick={onPieClick}
              style={{ cursor: "pointer", outline: "none" }}
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={activeIndex >= 0 && activeIndex !== index ? 0.35 : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          {centerData ? (
            <>
              <span className="text-[13px] leading-tight text-[#71717A] dark:text-[#A1A1AA] max-w-[90px] text-center truncate">
                {centerData.name}
              </span>
              <span className="text-[28px] font-bold leading-tight" style={{ color: centerData.color }}>
                {formatVal(centerData.value)}
              </span>
            </>
          ) : showTotal ? (
            <>
              <span className="text-[13px] leading-tight text-[#71717A] dark:text-[#A1A1AA]">
                {totalLabel}
              </span>
              <span className="text-[28px] font-bold leading-tight text-[#18181B] dark:text-white">
                {formatVal(total)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="w-full mt-6" role="list" aria-label="Legenda">
          <button
            type="button"
            role="listitem"
            onClick={handleDeselect}
            className={cn(
              "w-full flex items-center gap-3 py-3 px-1 text-left",
              "border-b-2 border-[#E5E7EB] dark:border-[#374151] mb-1",
              "transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              "cursor-pointer hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A]",
              activeIndex < 0 && "bg-[#FAFAFA] dark:bg-[#1A1A1A]"
            )}
          >
            <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-lg text-[13px] font-semibold tabular-nums bg-[#6B7280] text-white">
              100%
            </span>
            <span className="flex-1 text-[15px] font-semibold text-[#18181B] dark:text-white">
              Total
            </span>
            <span className="text-[15px] font-bold tabular-nums text-[#18181B] dark:text-white">
              {formatVal(total)}
            </span>
          </button>

          {chartData.map((item, index) => {
            const isActive = activeIndex === index
            const isDimmed = activeIndex >= 0 && !isActive

            return (
              <button
                key={index}
                type="button"
                role="listitem"
                onClick={() => handleLegendClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(-1)}
                className={cn(
                  "w-full flex items-center gap-3 py-3 px-1 text-left",
                  "transition-all duration-150",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                  "border-b border-[#F3F4F6] dark:border-[#27272A] last:border-b-0",
                  isActive && "bg-[#FAFAFA] dark:bg-[#1A1A1A]",
                  isDimmed && "opacity-40",
                  "cursor-pointer hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A]"
                )}
              >
                <span
                  className="inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-lg text-[13px] font-semibold tabular-nums transition-colors duration-150"
                  style={{
                    backgroundColor: item.color,
                    color: contrastTextFor(item.color),
                  }}
                >
                  {item.percentage}%
                </span>
                <span
                  className={cn(
                    "flex-1 text-[15px] font-medium",
                    isActive ? "text-[#18181B] dark:text-white" : "text-[#374151] dark:text-[#D1D5DB]"
                  )}
                >
                  {item.name}
                </span>
                <span
                  className={cn(
                    "text-[15px] font-semibold tabular-nums",
                    isActive ? "text-[#18181B] dark:text-white" : "text-[#374151] dark:text-[#D1D5DB]"
                  )}
                >
                  {formatVal(item.value)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { DonutChart, COLOR_PALETTE }
