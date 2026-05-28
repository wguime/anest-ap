import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/design-system/utils/tokens";

/**
 * DataTable — tabela genérica baseada em TanStack Table v8.
 *
 * Suporta ordenação por coluna, filtro global (busca) e paginação client-side.
 * Usa apenas tokens semânticos do design system (sem cores cruas).
 *
 * @param {Object} props
 * @param {import("@tanstack/react-table").ColumnDef[]} props.columns - Definições de coluna do TanStack Table.
 * @param {Array<Object>} props.data - Linhas de dados (array de objetos).
 * @param {boolean} [props.searchable=true] - Exibe o input de busca global.
 * @param {string} [props.searchPlaceholder="Buscar..."] - Placeholder do input de busca.
 * @param {number} [props.pageSize=10] - Tamanho da página; 0/undefined desativa a paginação.
 * @param {string} [props.emptyText="Nenhum registro."] - Texto exibido quando não há linhas.
 * @param {string} [props.className] - Classes extras no container raiz.
 *
 * @example
 * const columns = [
 *   { accessorKey: "nome", header: "Nome" },
 *   { accessorKey: "cargo", header: "Cargo" },
 * ];
 * <DataTable columns={columns} data={users} searchPlaceholder="Buscar usuário..." pageSize={10} />
 */
function DataTable({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Buscar...",
  pageSize = 10,
  emptyText = "Nenhum registro.",
  className,
}) {
  const [sorting, setSorting] = React.useState([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const paginationEnabled = Boolean(pageSize && pageSize > 0);

  const table = useReactTable({
    data: data ?? [],
    columns: columns ?? [],
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginationEnabled ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: paginationEnabled ? { pagination: { pageSize } } : undefined,
  });

  const rows = table.getRowModel().rows;
  const totalColumns = table.getAllLeafColumns().length || 1;
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination?.pageIndex ?? 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {searchable && (
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-left">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const ariaSort =
                    sortDir === "asc"
                      ? "ascending"
                      : sortDir === "desc"
                      ? "descending"
                      : "none";

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? ariaSort : undefined}
                      className="px-3 py-2.5 font-medium"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex min-h-[44px] w-full items-center gap-1.5 text-left uppercase tracking-wide hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          {sortDir === "asc" ? (
                            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : sortDir === "desc" ? (
                            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown
                              aria-hidden="true"
                              className="h-3.5 w-3.5 opacity-50"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2.5 text-sm text-foreground"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginationEnabled && rows.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Página {currentPage + 1} de {Math.max(pageCount, 1)}
            <span className="mx-2 text-border">•</span>
            {table.getFilteredRowModel().rows.length}{" "}
            {table.getFilteredRowModel().rows.length === 1 ? "linha" : "linhas"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
              className="inline-flex h-11 min-h-[44px] items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Próxima página"
              className="inline-flex h-11 min-h-[44px] items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Próxima
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
