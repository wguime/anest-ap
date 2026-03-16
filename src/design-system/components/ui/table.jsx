import * as React from "react"
import { useState, useMemo } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Input } from "./input"
import { Skeleton } from "./skeleton"
import { useMobileLayout } from "@/design-system/hooks/useMobileLayout"

/**
 * Utility: Remove Dr./Dra. prefixes from names
 * Can be used via column.render or applied to data
 */
export function stripDoctorPrefix(name) {
  if (!name || typeof name !== 'string') return name
  return name.replace(/^(Dr\.|Dra\.|Dr |Dra )/gi, '').trim()
}

/**
 * Table - Componente de tabela com ordenação e filtro
 *
 * Features:
 * - Ordenação por coluna (asc/desc)
 * - Filtro/busca global
 * - Loading state com skeleton
 * - Responsive (scroll horizontal em mobile)
 * - Dark/Light mode
 * - Seleção de linhas (opcional)
 * - Mobile layout modes: 'auto' | 'scroll' | 'cards' | 'accordion'
 *
 * @example
 * <Table
 *   columns={[
 *     { key: 'name', header: 'Nome', sortable: true },
 *     { key: 'email', header: 'Email', sortable: true },
 *     { key: 'role', header: 'Cargo' },
 *   ]}
 *   data={users}
 *   searchable
 *   mobileLayout="cards"
 *   onRowClick={(row) => console.log(row)}
 * />
 */

/**
 * TableCardView - Renderiza dados como cards no mobile
 * Cada linha vira um card com label + valor empilhados
 */
function TableCardView({
  columns,
  data,
  loading,
  loadingRows = 5,
  emptyMessage,
  emptyIcon,
  selectable,
  selected,
  onSelectRow,
  onRowClick,
  hoverable,
  compact,
}) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div
            key={`skeleton-card-${i}`}
            className="p-4 rounded-xl border border-[#A5D6A7] dark:border-[#2A3F36] bg-card dark:bg-[#1A2420]"
          >
            {columns.slice(0, 4).map((col, j) => (
              <div key={col.key} className={j > 0 ? "mt-3" : ""}>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-5 w-full max-w-[200px]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF] dark:text-[#6B8178]">
        {emptyIcon || <Search className="h-10 w-10 opacity-50 mb-2" />}
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <AnimatePresence>
        {data.map((row, rowIndex) => {
          const isSelected = selected?.includes(rowIndex)
          return (
            <motion.div
              key={row.id || rowIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, delay: rowIndex * 0.03 }}
              onClick={() => onRowClick?.(row, rowIndex)}
              className={cn(
                "p-4 rounded-xl border transition-all",
                "border-[#A5D6A7] dark:border-[#2A3F36]",
                "bg-card dark:bg-[#1A2420]",
                hoverable && "hover:border-[#006837] dark:hover:border-[#2ECC71] hover:shadow-sm",
                onRowClick && "cursor-pointer active:scale-[0.99]",
                isSelected && "border-[#006837] dark:border-[#2ECC71] bg-[#D4EDDA]/30 dark:bg-[#1E3A2F]/50"
              )}
            >
              {/* Selection checkbox */}
              {selectable ? (
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#F3F4F6] dark:border-[#2A3F36]">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectRow?.(rowIndex, e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] dark:text-[#2ECC71] focus:ring-[#006837] dark:focus:ring-[#2ECC71]"
                    />
                    <span className="text-[12px] text-[#6B7280] dark:text-[#A3B8B0]">
                      Selecionar
                    </span>
                  </label>
                  {onRowClick ? (
                    <ChevronRight className="h-4 w-4 text-[#9CA3AF] dark:text-[#6B8178]" />
                  ) : null}
                </div>
              ) : null}

              {/* Card content */}
              <div className={cn("space-y-3", compact && "space-y-2")}>
                {columns.map((column, colIndex) => {
                  const value = column.render
                    ? column.render(row[column.key], row, rowIndex)
                    : row[column.key]
                  
                  // Primeira coluna é destacada como título
                  if (colIndex === 0) {
                    return (
                      <div key={column.key} className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
                            {column.header}
                          </div>
                          <div className="text-[15px] font-semibold text-black dark:text-white truncate">
                            {value}
                          </div>
                        </div>
                        {!selectable && onRowClick ? (
                          <ChevronRight className="h-5 w-5 text-[#9CA3AF] dark:text-[#6B8178] shrink-0 mt-4" />
                        ) : null}
                      </div>
                    )
                  }

                  return (
                    <div key={column.key} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-[#6B7280] dark:text-[#A3B8B0] shrink-0">
                        {column.header}
                      </span>
                      <span className={cn(
                        "text-[13px] text-black dark:text-white text-right truncate",
                        compact && "text-[12px]"
                      )}>
                        {value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/**
 * TableAccordionView - Renderiza dados como acordeão (linhas expandíveis)
 * Mostra colunas principais e expande para ver detalhes
 */
function TableAccordionView({
  columns,
  data,
  loading,
  loadingRows = 5,
  emptyMessage,
  emptyIcon,
  selectable,
  selected,
  onSelectRow,
  onRowClick,
  hoverable,
  compact,
  primaryColumns = 2, // Número de colunas a mostrar por padrão
}) {
  const [expandedRows, setExpandedRows] = useState(new Set())

  const toggleRow = (index) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const primaryCols = columns.slice(0, primaryColumns)
  const secondaryCols = columns.slice(primaryColumns)

  if (loading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div
            key={`skeleton-accordion-${i}`}
            className="p-3 rounded-xl border border-[#A5D6A7] dark:border-[#2A3F36] bg-card dark:bg-[#1A2420]"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-5 flex-1 max-w-[150px]" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF] dark:text-[#6B8178]">
        {emptyIcon || <Search className="h-10 w-10 opacity-50 mb-2" />}
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <AnimatePresence>
        {data.map((row, rowIndex) => {
          const isSelected = selected?.includes(rowIndex)
          const isExpanded = expandedRows.has(rowIndex)

          return (
            <motion.div
              key={row.id || rowIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "rounded-xl border overflow-hidden transition-all",
                "border-[#A5D6A7] dark:border-[#2A3F36]",
                "bg-card dark:bg-[#1A2420]",
                isSelected && "border-[#006837] dark:border-[#2ECC71] bg-[#D4EDDA]/30 dark:bg-[#1E3A2F]/50"
              )}
            >
              {/* Primary row */}
              <div
                onClick={() => secondaryCols.length > 0 ? toggleRow(rowIndex) : onRowClick?.(row, rowIndex)}
                className={cn(
                  "flex items-center gap-3 p-3",
                  hoverable && "hover:bg-[#F3F4F6] dark:hover:bg-[#243530]",
                  (secondaryCols.length > 0 || onRowClick) && "cursor-pointer",
                  "transition-colors"
                )}
              >
                {/* Selection */}
                {selectable ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectRow?.(rowIndex, e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] focus:ring-[#006837]"
                    />
                  </div>
                ) : null}

                {/* Primary columns */}
                <div className="flex-1 min-w-0 flex items-center gap-4">
                  {primaryCols.map((column, i) => {
                    const value = column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]
                    
                    return (
                      <div key={column.key} className={cn(
                        i === 0 ? "flex-1 min-w-0" : "shrink-0"
                      )}>
                        {i === 0 ? (
                          <div className="text-[14px] font-medium text-black dark:text-white truncate">
                            {value}
                          </div>
                        ) : (
                          <div className="text-[13px] text-[#6B7280] dark:text-[#A3B8B0]">
                            {value}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Expand icon */}
                {secondaryCols.length > 0 ? (
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 text-[#9CA3AF] dark:text-[#6B8178] shrink-0 transition-transform",
                      isExpanded && "rotate-90"
                    )}
                  />
                ) : onRowClick ? (
                  <ChevronRight className="h-5 w-5 text-[#9CA3AF] dark:text-[#6B8178] shrink-0" />
                ) : null}
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && secondaryCols.length > 0 ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-0 border-t border-[#F3F4F6] dark:border-[#2A3F36]">
                      <div className="pt-3 space-y-2">
                        {secondaryCols.map((column) => {
                          const value = column.render
                            ? column.render(row[column.key], row, rowIndex)
                            : row[column.key]
                          
                          return (
                            <div key={column.key} className="flex items-center justify-between gap-2">
                              <span className="text-[12px] text-[#6B7280] dark:text-[#A3B8B0]">
                                {column.header}
                              </span>
                              <span className="text-[13px] text-black dark:text-white text-right">
                                {value}
                              </span>
                            </div>
                          )
                        })}
                        
                        {/* Action button if onRowClick */}
                        {onRowClick ? (
                          <button
                            onClick={() => onRowClick(row, rowIndex)}
                            className="w-full mt-2 py-2 text-[13px] font-medium text-[#006837] dark:text-[#2ECC71] bg-[#D4EDDA]/50 dark:bg-[#243530] rounded-lg hover:bg-[#D4EDDA] dark:hover:bg-[#2A3F36] transition-colors"
                          >
                            Ver detalhes
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// Table Root
function Table({
  columns = [],
  data = [],
  searchable = false,
  searchPlaceholder = "Buscar...",
  sortable = true,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  onRowClick,
  onSort,
  loading = false,
  loadingRows = 5,
  emptyMessage = "Nenhum dado encontrado",
  emptyIcon,
  striped = false,
  hoverable = true,
  compact = false,
  stickyHeader = false,
  // Mobile layout options
  mobileLayout = "auto", // 'auto' | 'scroll' | 'cards' | 'accordion'
  mobileBreakpoint = 640,
  accordionPrimaryColumns = 2, // For accordion mode
  className,
  ...props
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [internalSelected, setInternalSelected] = useState([])

  // Mobile layout detection
  const { currentLayout, isMobile } = useMobileLayout({
    breakpoint: mobileBreakpoint,
    layout: mobileLayout,
  })

  const selected = selectable ? (onSelectionChange ? selectedRows : internalSelected) : []
  const setSelected = onSelectionChange || setInternalSelected

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data

    const query = searchQuery.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.key]
        if (value == null) return false
        return String(value).toLowerCase().includes(query)
      })
    )
  }, [data, searchQuery, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (aVal == null) return 1
      if (bVal == null) return -1

      let comparison = 0
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal), "pt-BR", { numeric: true })
      }

      return sortConfig.direction === "desc" ? -comparison : comparison
    })
  }, [filteredData, sortConfig])

  // Handle sort
  const handleSort = (key) => {
    if (!sortable) return

    const column = columns.find((c) => c.key === key)
    if (!column?.sortable && column?.sortable !== undefined) return

    let direction = "asc"
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc"
      else if (sortConfig.direction === "desc") direction = null
    }

    const newConfig = { key: direction ? key : null, direction }
    setSortConfig(newConfig)
    onSort?.(newConfig)
  }

  // Handle row selection
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelected(sortedData.map((_, i) => i))
    } else {
      setSelected([])
    }
  }

  const handleSelectRow = (index, checked) => {
    if (checked) {
      setSelected([...selected, index])
    } else {
      setSelected(selected.filter((i) => i !== index))
    }
  }

  const isAllSelected = sortedData.length > 0 && selected.length === sortedData.length
  const isIndeterminate = selected.length > 0 && selected.length < sortedData.length

  // Render sort icon
  const renderSortIcon = (key) => {
    const column = columns.find((c) => c.key === key)
    if (!sortable || (column?.sortable === false)) return null

    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )
    }
    return <ChevronsUpDown className="h-4 w-4 opacity-50" />
  }

  // Render content based on layout
  const renderContent = () => {
    // Cards layout
    if (currentLayout === "cards") {
      return (
        <TableCardView
          columns={columns}
          data={sortedData}
          loading={loading}
          loadingRows={loadingRows}
          emptyMessage={emptyMessage}
          emptyIcon={emptyIcon}
          selectable={selectable}
          selected={selected}
          onSelectRow={handleSelectRow}
          onRowClick={onRowClick}
          hoverable={hoverable}
          compact={compact}
        />
      )
    }

    // Accordion layout
    if (currentLayout === "accordion") {
      return (
        <TableAccordionView
          columns={columns}
          data={sortedData}
          loading={loading}
          loadingRows={loadingRows}
          emptyMessage={emptyMessage}
          emptyIcon={emptyIcon}
          selectable={selectable}
          selected={selected}
          onSelectRow={handleSelectRow}
          onRowClick={onRowClick}
          hoverable={hoverable}
          compact={compact}
          primaryColumns={accordionPrimaryColumns}
        />
      )
    }

    // Default: scroll layout (traditional table)
    return (
      <div
        data-slot="table-wrapper"
        className={cn(
          "w-full overflow-x-auto rounded-[16px]",
          "border border-[#A5D6A7] dark:border-[#2A3F36]",
          "bg-card dark:bg-[#1A2420]"
        )}
      >
        <table
          data-slot="table"
          className={cn(
            "w-full border-collapse text-left",
            compact ? "text-[12px] sm:text-[13px]" : "text-[13px] sm:text-[14px]"
          )}
        >
          {/* Header */}
          <thead
            data-slot="table-header"
            className={cn(
              stickyHeader && "sticky top-0 z-10",
              "bg-[#F9FAFB] dark:bg-[#243530]"
            )}
          >
            <tr>
              {selectable ? (
                <th className={cn("w-12 px-4", compact ? "py-2" : "py-3")}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] dark:text-[#2ECC71] focus:ring-[#006837] dark:focus:ring-[#2ECC71]"
                  />
                </th>
              ) : null}

              {columns.map((column) => (
                <th
                  key={column.key}
                  data-slot="table-header-cell"
                  onClick={() => handleSort(column.key)}
                  className={cn(
                    compact ? "px-2 sm:px-3 py-1.5 sm:py-2" : "px-3 sm:px-4 py-2 sm:py-3",
                    "font-semibold text-[#6B7280] dark:text-[#A3B8B0]",
                    "border-b border-[#A5D6A7] dark:border-[#2A3F36]",
                    "whitespace-nowrap",
                    (sortable && column.sortable !== false) && "cursor-pointer select-none hover:text-[#000] dark:hover:text-white",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.width && `w-[${column.width}]`
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.header}
                    {renderSortIcon(column.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody data-slot="table-body">
            {loading ? (
              // Loading skeleton
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {selectable ? (
                    <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                      <Skeleton className="h-4 w-4" />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(compact ? "px-3 py-2" : "px-4 py-3")}
                    >
                      <Skeleton className="h-4 w-full max-w-[200px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-12"
                >
                  <div className="flex flex-col items-center gap-2 text-[#9CA3AF] dark:text-[#6B8178]">
                    {emptyIcon || (
                      <Search className="h-10 w-10 opacity-50" />
                    )}
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data rows
              <AnimatePresence>
                {sortedData.map((row, rowIndex) => (
                  <motion.tr
                    key={row.id || rowIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    data-slot="table-row"
                    data-selected={selected.includes(rowIndex) ? "true" : undefined}
                    onClick={() => onRowClick?.(row, rowIndex)}
                    className={cn(
                      "border-b border-[#F3F4F6] dark:border-[#2A3F36] last:border-0",
                      striped && rowIndex % 2 === 1 && "bg-[#F9FAFB] dark:bg-[#1E2A26]",
                      hoverable && "hover:bg-[#F3F4F6] dark:hover:bg-[#243530]",
                      onRowClick && "cursor-pointer",
                      selected.includes(rowIndex) && "bg-[#D4EDDA] dark:bg-[#1E3A2F]",
                      "transition-colors"
                    )}
                  >
                    {selectable ? (
                      <td
                        className={cn("px-4", compact ? "py-2" : "py-3")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(rowIndex)}
                          onChange={(e) => handleSelectRow(rowIndex, e.target.checked)}
                          className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] dark:text-[#2ECC71] focus:ring-[#006837] dark:focus:ring-[#2ECC71]"
                        />
                      </td>
                    ) : null}

                    {columns.map((column) => (
                      <td
                        key={column.key}
                        data-slot="table-cell"
                        className={cn(
                          compact ? "px-2 sm:px-3 py-1.5 sm:py-2" : "px-3 sm:px-4 py-2 sm:py-3",
                          "text-black dark:text-white",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.truncate !== false && "max-w-[150px] sm:max-w-none truncate"
                        )}
                      >
                        {column.render
                          ? column.render(row[column.key], row, rowIndex)
                          : row[column.key]}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div
      data-slot="table-container"
      data-layout={currentLayout}
      className={cn("w-full", className)}
      {...props}
    >
      {/* Search bar */}
      {searchable ? (
        <div className="mb-3 sm:mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] dark:text-[#6B8178]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                "w-full h-10 sm:h-11 pl-10 pr-10 rounded-[12px] sm:rounded-[16px] text-[14px] sm:text-[15px]",
                "bg-[#F3F4F6] dark:bg-[#243530]",
                "text-black dark:text-white",
                "placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B8178]",
                "border border-transparent",
                "focus:outline-none focus:border-[#006837] dark:focus:border-[#2ECC71]",
                "transition-colors"
              )}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] dark:text-[#6B8178] hover:text-[#6B7280] dark:hover:text-[#A3B8B0] p-1 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Content (table or alternative layouts) */}
      {renderContent()}

      {/* Results count */}
      {searchQuery && !loading ? (
        <p className="mt-2 text-[12px] text-[#9CA3AF] dark:text-[#6B8178]">
          {sortedData.length} resultado{sortedData.length !== 1 ? "s" : ""} encontrado{sortedData.length !== 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  )
}

// Sub-components for more control
function TableHeader({ className, children, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-[#F9FAFB] dark:bg-[#243530]", className)}
      {...props}
    >
      {children}
    </thead>
  )
}

function TableBody({ className, children, ...props }) {
  return (
    <tbody data-slot="table-body" className={className} {...props}>
      {children}
    </tbody>
  )
}

function TableRow({ className, selected, hoverable = true, onClick, children, ...props }) {
  return (
    <tr
      data-slot="table-row"
      data-selected={selected ? "true" : undefined}
      onClick={onClick}
      className={cn(
        "border-b border-[#F3F4F6] dark:border-[#2A3F36] last:border-0",
        hoverable && "hover:bg-[#F3F4F6] dark:hover:bg-[#243530]",
        onClick && "cursor-pointer",
        selected && "bg-[#D4EDDA] dark:bg-[#1E3A2F]",
        "transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

function TableHead({ className, sortable, sorted, sortDirection, onSort, align, children, ...props }) {
  return (
    <th
      data-slot="table-header-cell"
      onClick={sortable ? onSort : undefined}
      className={cn(
        "px-4 py-3 font-semibold text-[#6B7280] dark:text-[#A3B8B0]",
        "border-b border-[#A5D6A7] dark:border-[#2A3F36]",
        "whitespace-nowrap",
        sortable && "cursor-pointer select-none hover:text-[#000] dark:hover:text-white",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable ? (
          sorted ? (
            sortDirection === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )
          ) : (
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          )
        ) : null}
      </span>
    </th>
  )
}

function TableCell({ className, align, children, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 text-black dark:text-white",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
