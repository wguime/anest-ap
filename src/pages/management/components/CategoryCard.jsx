import React from 'react'
import { Card, CardContent } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

/**
 * CategoryCard — Shared category tile used across management UI sections.
 *
 * Renders an icon + label + count. Click triggers onClick.
 * Tokens-only (no hardcoded hex).
 *
 * @param {Object} category - { id, label, icon, count }
 * @param {function} [onClick] - Click handler
 * @param {'documento'|'auditoria'|'relatorio'} [unit] - Singular noun used in count text
 */
export function CategoryCard({ category, onClick, unit = 'documento' }) {
  const Icon = category?.icon
  const count = category?.count ?? 0
  const pluralMap = {
    documento: 'documentos',
    auditoria: 'auditorias',
    relatorio: 'relatorios',
  }
  const noun = count === 1 ? unit : pluralMap[unit] || `${unit}s`

  return (
    <Card
      className={cn(
        'bg-card',
        'border border-border',
        'rounded-2xl shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-primary transition-all duration-200',
        'group'
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/20 transition-colors">
            {Icon ? <Icon className="w-6 h-6 text-primary" /> : null}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {category?.label}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {count} {noun}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CategoryCard
