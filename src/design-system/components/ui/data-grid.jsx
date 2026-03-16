import * as React from "react"
import { useState, useMemo } from "react"
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  X,
  Filter,
  Download,
  RefreshCw,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Button } from "./button"
import { Skeleton } from "./skeleton"
import { Badge } from "./badge"
import { useMobileLayout } from "@/design-system/hooks/useMobileLayout"

/**
 * DataGrid - Componente avançado de grid de dados
 *
 * Features:
 * - Ordenação multi-coluna
 * - Filtros por coluna
 * - Paginação integrada
 * - Seleção de linhas
 * - Ações em lote
 * - Export de dados
 * - Responsive
 * - Mobile layout modes: 'auto' | 'scroll' | 'cards' | 'accordion'
 *
 * @example
 * <DataGrid
 *   columns={[
 *     { key: 'name', header: 'Nome', sortable: true, filterable: true },
 *     { key: 'status', header: 'Status', render: (val) => <Badge>{val}</Badge> },
 *   ]}
 *   data={items}
 *   pageSize={10}
 *   mobileLayout="cards"
 *   onExport={(data) => downloadCSV(data)}
 * />
 */

/**
 * DataGridCardView - Renderiza dados como cards no mobile
 */
function DataGridCardView({
  columns,
  data,
  loading,
  pageSize,
  emptyMessage,
  emptyIcon,
  selectable,
  selected,
  onSelectRow,
  hoverable = true,
  compact,
  sortedData,
}) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: pageSize }).map((_, i) => (
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
      {data.map((row, i) => {
        const globalIndex = sortedData.indexOf(row)
        const isSelected = selected?.includes(globalIndex)
        
        return (
          <motion.div
            key={row.id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.02 }}
            className={cn(
              "p-4 rounded-xl border transition-all",
              "border-[#A5D6A7] dark:border-[#2A3F36]",
              "bg-card dark:bg-[#1A2420]",
              hoverable && "hover:border-[#006837] dark:hover:border-[#2ECC71] hover:shadow-sm",
              isSelected && "border-[#006837] dark:border-[#2ECC71] bg-[#D4EDDA]/30 dark:bg-[#1E3A2F]/50"
            )}
          >
            {/* Selection checkbox */}
            {selectable ? (
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#F3F4F6] dark:border-[#2A3F36]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectRow?.(row, e.target.checked)}
                    className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] focus:ring-[#006837]"
                  />
                  <span className="text-[12px] text-[#6B7280] dark:text-[#A3B8B0]">
                    Selecionar
                  </span>
                </label>
              </div>
            ) : null}

            {/* Card content */}
            <div className={cn("space-y-3", compact && "space-y-2")}>
              {columns.filter(col => !col.mobileHide).map((column, colIndex) => {
                const value = column.render
                  ? column.render(row[column.key], row, i)
                  : row[column.key]
                
                // Primeira coluna é destacada como título
                if (colIndex === 0) {
                  return (
                    <div key={column.key}>
                      <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
                        {column.header}
                      </div>
                      <div className="text-[15px] font-semibold text-black dark:text-white">
                        {value}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={column.key} className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[#6B7280] dark:text-[#A3B8B0] shrink-0">
                      {column.header}
                    </span>
                    <span className={cn(
                      "text-[13px] text-black dark:text-white text-right",
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
    </div>
  )
}

/**
 * DataGridAccordionView - Renderiza dados como acordeão
 */
function DataGridAccordionView({
  columns,
  data,
  loading,
  pageSize,
  emptyMessage,
  emptyIcon,
  selectable,
  selected,
  onSelectRow,
  hoverable = true,
  compact,
  sortedData,
  primaryColumns = 2,
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

  const visibleColumns = columns.filter(col => !col.mobileHide)
  const primaryCols = visibleColumns.slice(0, primaryColumns)
  const secondaryCols = visibleColumns.slice(primaryColumns)

  if (loading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: pageSize }).map((_, i) => (
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
      {data.map((row, i) => {
        const globalIndex = sortedData.indexOf(row)
        const isSelected = selected?.includes(globalIndex)
        const isExpanded = expandedRows.has(i)

        return (
          <div
            key={row.id || i}
            className={cn(
              "rounded-xl border overflow-hidden transition-all",
              "border-[#A5D6A7] dark:border-[#2A3F36]",
              "bg-card dark:bg-[#1A2420]",
              isSelected && "border-[#006837] dark:border-[#2ECC71] bg-[#D4EDDA]/30 dark:bg-[#1E3A2F]/50"
            )}
          >
            {/* Primary row */}
            <div
              onClick={() => secondaryCols.length > 0 && toggleRow(i)}
              className={cn(
                "flex items-center gap-3 p-3",
                hoverable && "hover:bg-[#F3F4F6] dark:hover:bg-[#243530]",
                secondaryCols.length > 0 && "cursor-pointer",
                "transition-colors"
              )}
            >
              {/* Selection */}
              {selectable ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectRow?.(row, e.target.checked)}
                    className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] focus:ring-[#006837]"
                  />
                </div>
              ) : null}

              {/* Primary columns */}
              <div className="flex-1 min-w-0 flex items-center gap-4">
                {primaryCols.map((column, j) => {
                  const value = column.render
                    ? column.render(row[column.key], row, i)
                    : row[column.key]
                  
                  return (
                    <div key={column.key} className={cn(
                      j === 0 ? "flex-1 min-w-0" : "shrink-0"
                    )}>
                      {j === 0 ? (
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
                          ? column.render(row[column.key], row, i)
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
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

function DataGrid({
  columns = [],
  data = [],
  // Search & Filter
  searchable = true,
  searchPlaceholder = "Buscar...",
  filterable = false,
  // Sorting
  sortable = true,
  defaultSort,
  // Pagination
  paginated = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  // Selection
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  // Actions
  bulkActions = [],
  onRefresh,
  onExport,
  // Loading & Empty
  loading = false,
  emptyMessage = "Nenhum dado encontrado",
  emptyIcon,
  // Styling
  striped = true,
  compact = false,
  bordered = true,
  // Mobile layout options
  mobileLayout = "auto", // 'auto' | 'scroll' | 'cards' | 'accordion'
  mobileBreakpoint = 640,
  accordionPrimaryColumns = 2, // For accordion mode
  className,
  ...props
}) {
  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState(defaultSort || { key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [internalSelected, setInternalSelected] = useState([])

  // Mobile layout detection
  const { currentLayout, isMobile } = useMobileLayout({
    breakpoint: mobileBreakpoint,
    layout: mobileLayout,
  })

  const selected = selectable ? (onSelectionChange ? selectedRows : internalSelected) : []
  const setSelected = onSelectionChange || setInternalSelected

  // Filter data
  const filteredData = useMemo(() => {
    let result = [...data]

    // Global search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col.key]
          if (value == null) return false
          return String(value).toLowerCase().includes(query)
        })
      )
    }

    // Column filters
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      if (!filterValue) return
      result = result.filter((row) => {
        const value = row[key]
        if (value == null) return false
        return String(value).toLowerCase().includes(filterValue.toLowerCase())
      })
    })

    return result
  }, [data, searchQuery, columnFilters, columns])

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

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize, paginated])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, columnFilters, pageSize])

  // Handlers
  const handleSort = (key) => {
    if (!sortable) return
    const column = columns.find((c) => c.key === key)
    if (column?.sortable === false) return

    let direction = "asc"
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc"
      else if (sortConfig.direction === "desc") direction = null
    }

    setSortConfig({ key: direction ? key : null, direction })
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      const pageIndices = paginatedData.map((row) => sortedData.indexOf(row))
      setSelected([...new Set([...selected, ...pageIndices])])
    } else {
      const pageIndices = paginatedData.map((row) => sortedData.indexOf(row))
      setSelected(selected.filter((i) => !pageIndices.includes(i)))
    }
  }

  const handleSelectRow = (row, checked) => {
    const index = sortedData.indexOf(row)
    if (checked) {
      setSelected([...selected, index])
    } else {
      setSelected(selected.filter((i) => i !== index))
    }
  }

  const handleBulkAction = (action) => {
    const selectedData = selected.map((i) => sortedData[i])
    action.onClick(selectedData)
  }

  const handleExport = () => {
    const exportData = selected.length > 0
      ? selected.map((i) => sortedData[i])
      : sortedData
    onExport?.(exportData)
  }

  // Selection state
  const pageSelected = paginatedData.filter((row) => selected.includes(sortedData.indexOf(row)))
  const isAllPageSelected = paginatedData.length > 0 && pageSelected.length === paginatedData.length
  const isIndeterminate = pageSelected.length > 0 && pageSelected.length < paginatedData.length

  // Render sort icon
  const renderSortIcon = (key) => {
    const column = columns.find((c) => c.key === key)
    if (!sortable || column?.sortable === false) return null

    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )
    }
    return <ChevronsUpDown className="h-4 w-4 opacity-40" />
  }

  return (
    <div
      data-slot="data-grid"
      className={cn("w-full", className)}
      {...props}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
        {/* Search */}
        {searchable ? (
          <div className="relative flex-1 min-w-[150px] sm:min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] dark:text-[#6B8178]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                "w-full h-10 pl-10 pr-10 rounded-[12px] text-[13px] sm:text-[14px]",
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] p-1 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {filterable ? (
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={<Filter className="h-4 w-4" />}
            >
              Filtros
              {Object.values(columnFilters).filter(Boolean).length > 0 ? (
                <Badge variant="success" className="ml-1">
                  {Object.values(columnFilters).filter(Boolean).length}
                </Badge>
              ) : null}
            </Button>
          ) : null}

          {onRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              leftIcon={<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />}
            >
              Atualizar
            </Button>
          ) : null}

          {onExport ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Exportar
            </Button>
          ) : null}
        </div>
      </div>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selected.length > 0 && bulkActions.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-4 mb-4 p-3 rounded-[12px] bg-[#D4EDDA] dark:bg-[#243530]"
          >
            <span className="text-[14px] font-medium text-[#006837] dark:text-[#2ECC71]">
              {selected.length} selecionado{selected.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              {bulkActions.map((action, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBulkAction(action)}
                  leftIcon={action.icon}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
              className="ml-auto"
            >
              Limpar seleção
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Column filters */}
      <AnimatePresence>
        {showFilters && filterable ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-4 rounded-[12px] bg-[#F9FAFB] dark:bg-[#1E2A26] overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {columns
                .filter((col) => col.filterable !== false)
                .map((column) => (
                  <div key={column.key}>
                    <label className="block text-[12px] font-medium text-[#6B7280] dark:text-[#A3B8B0] mb-1">
                      {column.header}
                    </label>
                    <input
                      type="text"
                      value={columnFilters[column.key] || ""}
                      onChange={(e) =>
                        setColumnFilters((prev) => ({
                          ...prev,
                          [column.key]: e.target.value,
                        }))
                      }
                      placeholder={`Filtrar ${column.header.toLowerCase()}...`}
                      className={cn(
                        "w-full h-9 px-3 rounded-[8px] text-[13px]",
                        "bg-[#F0FFF4] dark:bg-[#243530]",
                        "text-black dark:text-white",
                        "border border-[#A5D6A7] dark:border-[#2A3F36]",
                        "focus:outline-none focus:border-[#006837] dark:focus:border-[#2ECC71]"
                      )}
                    />
                  </div>
                ))}
            </div>
            {Object.values(columnFilters).some(Boolean) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setColumnFilters({})}
                className="mt-3"
              >
                Limpar filtros
              </Button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Content - Table or alternative layouts */}
      {currentLayout === "cards" ? (
        <DataGridCardView
          columns={columns}
          data={paginatedData}
          loading={loading}
          pageSize={pageSize}
          emptyMessage={emptyMessage}
          emptyIcon={emptyIcon}
          selectable={selectable}
          selected={selected}
          onSelectRow={handleSelectRow}
          hoverable={true}
          compact={compact}
          sortedData={sortedData}
        />
      ) : currentLayout === "accordion" ? (
        <DataGridAccordionView
          columns={columns}
          data={paginatedData}
          loading={loading}
          pageSize={pageSize}
          emptyMessage={emptyMessage}
          emptyIcon={emptyIcon}
          selectable={selectable}
          selected={selected}
          onSelectRow={handleSelectRow}
          hoverable={true}
          compact={compact}
          sortedData={sortedData}
          primaryColumns={accordionPrimaryColumns}
        />
      ) : (
        /* Default: scroll layout (traditional table) */
        <div
          className={cn(
            "w-full overflow-x-auto rounded-[16px]",
            bordered && "border border-[#A5D6A7] dark:border-[#2A3F36]",
            "bg-card dark:bg-[#1A2420]"
          )}
        >
          <table className={cn("w-full border-collapse text-left", compact ? "text-[12px] sm:text-[13px]" : "text-[13px] sm:text-[14px]")}>
            <thead className="bg-[#F9FAFB] dark:bg-[#243530]">
              <tr>
                {selectable ? (
                  <th className={cn("w-12 px-4", compact ? "py-2" : "py-3")}>
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] focus:ring-[#006837]"
                    />
                  </th>
                ) : null}

                {columns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key)}
                    className={cn(
                      compact ? "px-2 sm:px-3 py-1.5 sm:py-2" : "px-3 sm:px-4 py-2 sm:py-3",
                      "font-semibold text-[#6B7280] dark:text-[#A3B8B0]",
                      "border-b border-[#A5D6A7] dark:border-[#2A3F36]",
                      column.mobileHide ? "hidden sm:table-cell" : "",
                      column.key !== 'email' && "whitespace-nowrap",
                      (sortable && column.sortable !== false) && "cursor-pointer select-none hover:text-[#000] dark:hover:text-white",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right"
                    )}
                    style={column.width ? { width: column.width, minWidth: column.minWidth } : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.header}
                      {renderSortIcon(column.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {selectable ? (
                      <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                        <Skeleton className="h-4 w-4" />
                      </td>
                    ) : null}
                    {columns.map((col) => (
                      <td key={col.key} className={cn(compact ? "px-3 py-2" : "px-4 py-3")}>
                        <Skeleton className="h-4 w-full max-w-[200px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="text-center py-12"
                  >
                    <div className="flex flex-col items-center gap-2 text-[#9CA3AF] dark:text-[#6B8178]">
                      {emptyIcon || <Search className="h-10 w-10 opacity-50" />}
                      <p>{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, i) => {
                  const isSelected = selected.includes(sortedData.indexOf(row))
                  return (
                    <tr
                      key={row.id || i}
                      className={cn(
                        "border-b border-[#F3F4F6] dark:border-[#2A3F36] last:border-0",
                        striped && i % 2 === 1 && "bg-[#F9FAFB] dark:bg-[#1E2A26]",
                        "hover:bg-[#F3F4F6] dark:hover:bg-[#243530]",
                        isSelected && "bg-[#D4EDDA] dark:bg-[#1E3A2F]",
                        "transition-colors"
                      )}
                    >
                      {selectable ? (
                        <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(row, e.target.checked)}
                            className="h-4 w-4 rounded border-[#D1D5DB] dark:border-[#4B5563] text-[#006837] focus:ring-[#006837]"
                          />
                        </td>
                      ) : null}

                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            compact ? "px-2 sm:px-3 py-1.5 sm:py-2" : "px-3 sm:px-4 py-2 sm:py-3",
                            "text-black dark:text-white",
                            column.mobileHide ? "hidden sm:table-cell" : "",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            // Allow emails to wrap on mobile but truncate with ellipsis
                            column.key === 'email' ? "break-all text-[11px] sm:text-[13px]" : "truncate max-w-[120px] sm:max-w-none"
                          )}
                        >
                          {column.render
                            ? column.render(row[column.key], row, i)
                            : row[column.key]}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {paginated && totalPages > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mt-3 sm:mt-4">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[12px] sm:text-[13px] text-[#6B7280] dark:text-[#A3B8B0]">
            <span className="hidden sm:inline">Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn(
                "h-8 px-2 rounded-[8px] text-[12px] sm:text-[13px]",
                "bg-[#F3F4F6] dark:bg-[#243530]",
                "text-black dark:text-white",
                "border border-transparent",
                "focus:outline-none focus:border-[#006837] dark:focus:border-[#2ECC71]"
              )}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="hidden sm:inline">por página</span>
            <span className="sm:ml-4">
              {sortedData.length > 0
                ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, sortedData.length)} de ${sortedData.length}`
                : "0 resultados"}
            </span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <ChevronLeft className="h-4 w-4 -ml-2" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-3 text-[14px] font-medium text-black dark:text-white">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
              <ChevronRight className="h-4 w-4 -ml-2" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { DataGrid }
