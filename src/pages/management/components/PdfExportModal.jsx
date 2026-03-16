/**
 * PdfExportModal - Modal para exportar relatorio PDF com selecao de secoes
 *
 * Permite ao usuario selecionar quais secoes incluir no relatorio PDF gerado.
 * Inclui seletor de periodo (datas) com atalhos rapidos para filtrar dados.
 * Usa o design-system Modal com sub-components (Modal.Body, Modal.Footer).
 */
import { useState } from 'react'
import { Modal } from '@/design-system'
import { Button } from '@/design-system'
import { Download, Loader2, Calendar } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

// ---------------------------------------------------------------------------
// Secoes disponiveis para exportacao
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'incidentes', label: 'Incidentes e Denuncias' },
  { id: 'autoavaliacao', label: 'Autoavaliacao ROPs' },
  { id: 'auditorias', label: 'Auditorias Interativas' },
  { id: 'planos', label: 'Planos de Acao PDCA' },
  { id: 'kpis', label: 'Indicadores (KPIs)' },
  { id: 'residencia', label: 'Residencia Medica' },
  { id: 'educacao', label: 'Educacao Continuada' },
  { id: 'staff', label: 'Funcionarios (Staff)' },
  { id: 'infraestrutura', label: 'Infraestrutura' },
  { id: 'lgpd', label: 'LGPD' },
]

const ALL_IDS = new Set(SECTIONS.map((s) => s.id))

// Date preset helpers
function toIso(date) {
  return date.toISOString().slice(0, 10)
}

function getPresetDates(preset) {
  const today = new Date()
  const end = toIso(today)
  switch (preset) {
    case 'today': {
      return { start: end, end }
    }
    case '30d': {
      const d = new Date(today)
      d.setDate(d.getDate() - 30)
      return { start: toIso(d), end }
    }
    case '90d': {
      const d = new Date(today)
      d.setDate(d.getDate() - 90)
      return { start: toIso(d), end }
    }
    case '6m': {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 6)
      return { start: toIso(d), end }
    }
    case '1y': {
      const d = new Date(today)
      d.setFullYear(d.getFullYear() - 1)
      return { start: toIso(d), end }
    }
    case 'ytd': {
      return { start: `${today.getFullYear()}-01-01`, end }
    }
    default:
      return { start: '', end: '' }
  }
}

const PRESETS = [
  { id: 'today', label: 'Hoje' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '3 meses' },
  { id: '6m', label: '6 meses' },
  { id: '1y', label: '1 ano' },
  { id: 'ytd', label: 'Ano atual' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfExportModal({ open, onClose, onExport, exporting }) {
  const [selected, setSelected] = useState(() => new Set(ALL_IDS))
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePreset, setActivePreset] = useState(null)

  const allSelected = selected.size === SECTIONS.length
  const noneSelected = selected.size === 0
  const hasDateRange = startDate || endDate

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(ALL_IDS))
    }
  }

  const handlePreset = (presetId) => {
    if (activePreset === presetId) {
      setStartDate('')
      setEndDate('')
      setActivePreset(null)
      return
    }
    const dates = getPresetDates(presetId)
    setStartDate(dates.start)
    setEndDate(dates.end)
    setActivePreset(presetId)
  }

  const handleDateChange = (field, value) => {
    setActivePreset(null)
    if (field === 'start') setStartDate(value)
    else setEndDate(value)
  }

  const handleExport = () => {
    const dateRange = hasDateRange ? { start: startDate || null, end: endDate || null } : null
    onExport(Array.from(selected), dateRange)
  }

  const clearDates = () => {
    setStartDate('')
    setEndDate('')
    setActivePreset(null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar Relatorio PDF"
      description="Configure o periodo e as secoes do relatorio."
      size="md"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Date range section */}
          <div className="rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-[#F0FFF4]/60 dark:bg-[#1A2F23]/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#006837] dark:text-[#2ECC71]" />
                <span className="text-xs font-semibold text-[#006837] dark:text-[#2ECC71]">
                  Periodo de analise
                </span>
              </div>
              {hasDateRange && (
                <button
                  type="button"
                  onClick={clearDates}
                  className="text-[10px] text-[#6B7280] hover:text-[#DC2626] transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Quick presets + date inputs in a compact grid */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p.id)}
                  className={cn(
                    'h-7 px-3 rounded-full text-[11px] font-medium transition-all border',
                    activePreset === p.id
                      ? 'bg-[#006837] text-white border-[#006837] dark:bg-[#2ECC71] dark:text-[#1A2F23] dark:border-[#2ECC71]'
                      : 'bg-white text-[#006837] border-[#C8E6C9] hover:bg-[#E8F5E9] dark:bg-[#243530] dark:text-[#2ECC71] dark:border-[#3A5A4A] dark:hover:bg-[#2A3F36]'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs — compact row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] dark:text-[#6B8178] mb-0.5 block">De</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  max={endDate || undefined}
                  className={cn(
                    'w-full h-8 px-2 rounded-lg text-[11px] border transition-colors',
                    'border-[#C8E6C9] dark:border-[#2A3F36]',
                    'bg-white dark:bg-[#243530]',
                    'text-[#111827] dark:text-white',
                    'focus:outline-none focus:ring-1 focus:ring-[#006837] dark:focus:ring-[#2ECC71]'
                  )}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] dark:text-[#6B8178] mb-0.5 block">Ate</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  min={startDate || undefined}
                  className={cn(
                    'w-full h-8 px-2 rounded-lg text-[11px] border transition-colors',
                    'border-[#C8E6C9] dark:border-[#2A3F36]',
                    'bg-white dark:bg-[#243530]',
                    'text-[#111827] dark:text-white',
                    'focus:outline-none focus:ring-1 focus:ring-[#006837] dark:focus:ring-[#2ECC71]'
                  )}
                />
              </div>
            </div>
            {!hasDateRange && (
              <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178] mt-2 italic">
                Sem periodo — todos os dados serao incluidos.
              </p>
            )}
            {hasDateRange && startDate && endDate && (
              <p className="text-[10px] text-[#006837] dark:text-[#2ECC71] mt-2 font-medium">
                {new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          {/* Sections selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#006837] dark:text-[#2ECC71]">
                Secoes do relatorio
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[10px] font-medium text-[#006837] hover:text-[#004d29] dark:text-[#2ECC71] dark:hover:text-[#27ae60] transition-colors"
              >
                {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
            </div>

            {/* Section checkboxes */}
            <div className="space-y-0.5 max-h-[250px] overflow-y-auto pr-1 rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36]">
              {SECTIONS.map((section, idx) => {
                const isChecked = selected.has(section.id)
                return (
                  <label
                    key={section.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                      'hover:bg-[#E8F5E9] dark:hover:bg-[#243530]',
                      isChecked && 'bg-[#E8F5E9]/40 dark:bg-[#243530]/40',
                      idx === 0 && 'rounded-t-xl',
                      idx === SECTIONS.length - 1 && 'rounded-b-xl'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(section.id)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                        isChecked
                          ? 'border-[#006837] bg-[#006837] dark:border-[#2ECC71] dark:bg-[#2ECC71]'
                          : 'border-[#C8E6C9] bg-transparent dark:border-[#3A5A4A]'
                      )}
                      style={{ width: 18, height: 18 }}
                    >
                      {isChecked && (
                        <svg
                          className="h-2.5 w-2.5 text-white dark:text-[#1A2F23]"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2.5 6L5 8.5L9.5 3.5" />
                        </svg>
                      )}
                    </span>
                    <span className="text-[13px] text-foreground">{section.label}</span>
                  </label>
                )
              })}
            </div>

            <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178] mt-1.5 text-right">
              {selected.size} de {SECTIONS.length} secoes selecionadas
            </p>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={exporting}>
          Cancelar
        </Button>
        <Button
          onClick={handleExport}
          disabled={exporting || noneSelected}
          className={cn(
            'bg-[#006837] hover:bg-[#005530] text-white',
            'dark:bg-[#006837] dark:hover:bg-[#005530]'
          )}
          leftIcon={
            exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )
          }
        >
          {exporting ? 'Gerando...' : 'Gerar PDF'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default PdfExportModal
