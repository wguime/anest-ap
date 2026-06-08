// FilterBar — Barra de filtros de CONSULTA da BibliotecaPage.
// Apenas Tags. Tipo foi removido: a árvore já agrupa por subcategoria → tipo
// (as sub-accordions SÃO por tipo), então um filtro de Tipo era navegação
// redundante. Status/Vencimento também saíram (gestão/compliance → Centro de
// Gestão). Controle de documentos Qmentum/ISO: consulta-se a versão vigente.
// A barra se auto-esconde quando não há tags para filtrar.
// (Busca vive no header via SearchToggleButton + Collapsible — pattern Home.)

import { useMemo } from 'react'
import { Popover, PopoverTrigger, PopoverContent, Checkbox, Button, Badge } from '@/design-system'
import { ChevronDown, Filter, X } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

// =============================================================================
// MultiSelectFacet — Combobox simples baseado em Popover + Checkbox
// =============================================================================

function MultiSelectFacet({ label, options, values, onChange }) {
  const count = values.length
  const triggerLabel = useMemo(() => {
    if (count === 0) return label
    if (count === 1) {
      const opt = options.find((o) => o.value === values[0])
      return `${label}: ${opt?.label ?? values[0]}`
    }
    return `${label}: ${count}`
  }, [label, options, values, count])

  const toggle = (value) => {
    const next = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]
    onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center justify-between gap-2',
          'h-11 min-h-[44px] px-3 rounded-lg',
          'bg-card border border-border text-sm font-medium text-foreground',
          'hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          count > 0 && 'border-primary'
        )}
        aria-label={`Filtrar por ${label}`}
      >
        <span className="truncate">{triggerLabel}</span>
        {count > 0 && (
          <Badge variant="default" className="h-5 px-1.5 text-[11px]">
            {count}
          </Badge>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="min-w-[220px] max-w-[320px] p-2"
      >
        <div role="group" aria-label={label} className="flex flex-col">
          {options.map((opt) => (
            <div
              key={opt.value}
              className="px-2 rounded-md hover:bg-muted/60 transition-colors"
            >
              <Checkbox
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                size="sm"
                compact
                label={opt.label}
                className="py-1.5"
              />
            </div>
          ))}
          {count > 0 && (
            <div className="border-t border-border mt-1 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => onChange([])}
              >
                Limpar {label.toLowerCase()}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// FilterBar — exportado (só Tags; auto-esconde quando não há tags)
// =============================================================================

export function FilterBar({ tags = [], onTagsChange, availableTags = [], onClearAll }) {
  // Sem tags disponíveis → nada a filtrar; não polui a tela com barra vazia.
  if (availableTags.length === 0 || !onTagsChange) return null

  const hasFilters = tags.length > 0

  return (
    <div
      data-slot="biblioteca-filter-bar"
      className="mb-4 flex flex-col gap-2"
      role="search"
      aria-label="Filtros da biblioteca"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          Filtros:
        </span>

        <MultiSelectFacet
          label="Tags"
          options={availableTags}
          values={tags}
          onChange={onTagsChange}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            leftIcon={<X className="w-4 h-4" />}
            aria-label="Limpar todos os filtros"
            className="ml-auto"
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}

export default FilterBar
