// FilterBar — Barra de filtros sempre visível para BibliotecaPage
// Search + multi-faceta (tipo, status, vencimento) + Limpar filtros
// Usa apenas componentes do DS (SearchBar, Popover, Checkbox, Button, Badge)

import { useMemo } from 'react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
  Button,
  Badge,
  SearchBar,
} from '@/design-system'
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
// FilterBar — exportado
// =============================================================================

export const TIPO_OPTIONS = [
  { value: 'politica', label: 'Política' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'protocolo', label: 'Protocolo' },
  { value: 'protocolos_clinicos', label: 'Protocolos Clínicos' },
  { value: 'manual', label: 'Manual' },
  { value: 'manuais', label: 'Manuais' },
  { value: 'formulario', label: 'Formulário' },
  { value: 'formularios', label: 'Formulários' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'fluxograma', label: 'Fluxograma' },
  { value: 'fluxogramas', label: 'Fluxogramas' },
  { value: 'regimentos', label: 'Regimentos' },
  { value: 'atas', label: 'Atas' },
  { value: 'planos_acao', label: 'Planos de Ação' },
]

export const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pendente', label: 'Aguardando aprovação' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'rejeitado', label: 'Rejeitado' },
  { value: 'revisao_pendente', label: 'Revisão pendente' },
  { value: 'arquivado', label: 'Arquivado' },
]

export const VENCIMENTO_OPTIONS = [
  { value: 'vencidos', label: 'Vencidos' },
  { value: 'proximos', label: 'Próximos (30d)' },
  { value: 'em_dia', label: 'Em dia' },
  { value: 'sem_revisao', label: 'Sem revisão' },
]

export function FilterBar({
  searchTerm,
  onSearchChange,
  tipo,
  onTipoChange,
  status,
  onStatusChange,
  vencimento,
  onVencimentoChange,
  onClearAll,
}) {
  const hasFilters =
    Boolean(searchTerm?.trim()) ||
    tipo.length > 0 ||
    status.length > 0 ||
    vencimento.length > 0

  return (
    <div
      data-slot="biblioteca-filter-bar"
      className="mb-4 flex flex-col gap-2"
      role="search"
      aria-label="Filtros da biblioteca"
    >
      <SearchBar
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar documentos..."
        aria-label="Buscar documentos"
        className="mb-0"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          Filtros:
        </span>

        <MultiSelectFacet
          label="Tipo"
          options={TIPO_OPTIONS}
          values={tipo}
          onChange={onTipoChange}
        />
        <MultiSelectFacet
          label="Status"
          options={STATUS_OPTIONS}
          values={status}
          onChange={onStatusChange}
        />
        <MultiSelectFacet
          label="Vencimento"
          options={VENCIMENTO_OPTIONS}
          values={vencimento}
          onChange={onVencimentoChange}
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
