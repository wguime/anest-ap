import * as React from "react"

import { cn } from "@/design-system/utils/tokens"
import { Skeleton } from "./skeleton"

/**
 * <PageSkeleton> — placeholder de carregamento em nível de página.
 *
 * Compõe o primitivo <Skeleton> nos layouts mais comuns do app para que as
 * 40+ páginas que carregam dados async tenham um loading consistente
 * (Fase 3.4 do plano DS). Espelha o padding/grid do <PageShell>
 * (`px-4 sm:px-5`, grid `cols-1 sm:2 lg:3`), então pode ser renderizado
 * direto no lugar do conteúdo enquanto `loading === true`.
 *
 * @param {object} props
 * @param {'list'|'grid'|'detail'|'dashboard'} [props.variant='list']
 * @param {number} [props.count] - nº de itens/cards (default por variante)
 * @param {boolean} [props.header=true] - mostra a barra de título placeholder
 * @param {string} [props.className]
 */
export function PageSkeleton({ variant = "list", count, header = true, className, ...props }) {
  const items = count ?? (variant === "grid" ? 6 : variant === "list" ? 6 : 4)

  return (
    <div
      data-slot="page-skeleton"
      data-variant={variant}
      role="status"
      aria-busy="true"
      aria-label="Carregando"
      className={cn("px-4 sm:px-5 py-4", className)}
      {...props}
    >
      <span className="sr-only">Carregando…</span>

      {header && (
        <div className="mb-6 grid gap-2">
          <Skeleton variant="text" width="40%" height={22} />
          <Skeleton variant="text" width="65%" height={14} />
        </div>
      )}

      {variant === "list" && (
        <div className="grid gap-3">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-4">
              <Skeleton variant="listItem" />
            </div>
          ))}
        </div>
      )}

      {variant === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: items }).map((_, i) => (
            <Skeleton key={i} variant="card" height={150} />
          ))}
        </div>
      )}

      {variant === "detail" && (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Skeleton variant="text" width="55%" height={24} />
            <Skeleton variant="text" width="35%" height={14} />
          </div>
          <div className="rounded-2xl bg-card border border-border p-5">
            <Skeleton variant="text" count={Math.max(2, items)} />
          </div>
          <Skeleton variant="card" height={120} />
        </div>
      )}

      {variant === "dashboard" && (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" height={96} />
            ))}
          </div>
          <Skeleton variant="card" height={220} />
        </div>
      )}
    </div>
  )
}
