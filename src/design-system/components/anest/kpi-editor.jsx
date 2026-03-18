import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
} from "@/design-system/components/ui"
import { useKPIData } from "./kpi-data-context"

/**
 * KPIEditor - Editor de dados dos KPIs
 *
 * Componente para gerenciar e editar os dados dos indicadores de qualidade.
 * Conecta-se ao KPIDataContext para persistir as alterações.
 *
 * @example
 * <KPIEditor />
 */

const accentColorOptions = [
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "orange", label: "Laranja" },
  { value: "red", label: "Vermelho" },
  { value: "purple", label: "Roxo" },
  { value: "cyan", label: "Ciano" },
]

// ============================================================================
// KPI EDIT FORM
// ============================================================================

function KPIEditForm({ kpi, onSave, onCancel }) {
  const [formData, setFormData] = React.useState({
    titulo: kpi?.titulo || "",
    valor: kpi?.valor ?? 0,
    meta: kpi?.meta ?? 0,
    metaLabel: kpi?.metaLabel || "",
    unidade: kpi?.unidade || "%",
    periodo: kpi?.periodo || "",
    accentColor: kpi?.accentColor || "green",
    isLowerBetter: kpi?.isLowerBetter ?? false,
    historico: kpi?.historico || [],
    mesesLabels: kpi?.mesesLabels || [],
  })

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleHistoricoChange = (index, value) => {
    const newHistorico = [...formData.historico]
    newHistorico[index] = parseFloat(value) || 0
    setFormData((prev) => ({ ...prev, historico: newHistorico }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...formData,
      valor: parseFloat(formData.valor) || 0,
      meta: parseFloat(formData.meta) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Título */}
      <div>
        <label className="block text-[13px] font-medium text-foreground mb-1.5">
          Título do Indicador
        </label>
        <Input
          value={formData.titulo}
          onChange={(e) => handleChange("titulo", e.target.value)}
          placeholder="Ex: Taxa de Infecção Hospitalar"
          required
        />
      </div>

      {/* Valor e Meta */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Valor Atual
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.valor}
            onChange={(e) => handleChange("valor", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Meta
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.meta}
            onChange={(e) => handleChange("meta", e.target.value)}
            required
          />
        </div>
      </div>

      {/* Meta Label e Unidade */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Label da Meta
          </label>
          <Input
            value={formData.metaLabel}
            onChange={(e) => handleChange("metaLabel", e.target.value)}
            placeholder="Ex: ≥90% ou ≤3%"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Unidade
          </label>
          <Input
            value={formData.unidade}
            onChange={(e) => handleChange("unidade", e.target.value)}
            placeholder="Ex: %, min, dias"
          />
        </div>
      </div>

      {/* Período e Cor */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Período
          </label>
          <Input
            value={formData.periodo}
            onChange={(e) => handleChange("periodo", e.target.value)}
            placeholder="Ex: Novembro"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Cor do Ícone
          </label>
          <Select
            value={formData.accentColor}
            onChange={(value) => handleChange("accentColor", value)}
            options={accentColorOptions}
          />
        </div>
      </div>

      {/* Tipo de Meta */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
        <input
          type="checkbox"
          id="isLowerBetter"
          checked={formData.isLowerBetter}
          onChange={(e) => handleChange("isLowerBetter", e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <label htmlFor="isLowerBetter" className="text-[13px] text-foreground">
          Menor é melhor (ex: taxa de infecção, tempo de espera)
        </label>
      </div>

      {/* Histórico */}
      {formData.historico.length > 0 && (
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-2">
            Histórico Mensal
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {formData.historico.map((valor, index) => (
              <div key={index} className="text-center">
                <span className="text-[11px] text-muted-foreground block mb-1">
                  {formData.mesesLabels[index] || `M${index + 1}`}
                </span>
                <Input
                  type="number"
                  step="0.1"
                  value={valor}
                  onChange={(e) => handleHistoricoChange(index, e.target.value)}
                  className="text-center text-[13px] h-9"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-4 pb-2">
        <Button type="submit" className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ============================================================================
// KPI ITEM ROW
// ============================================================================

function KPIItemRow({ kpi, onEdit, onDelete }) {
  const [expanded, setExpanded] = React.useState(false)

  // Calcular status
  const status = React.useMemo(() => {
    if (kpi.isLowerBetter) {
      if (kpi.valor <= kpi.meta) return "conforme"
      if (kpi.valor <= kpi.meta * 1.1) return "parcial"
      return "nao-conforme"
    } else {
      if (kpi.valor >= kpi.meta) return "conforme"
      if (kpi.valor >= kpi.meta * 0.9) return "parcial"
      return "nao-conforme"
    }
  }, [kpi])

  const statusConfig = {
    conforme: { variant: "success", label: "Conforme" },
    parcial: { variant: "warning", label: "Parcial" },
    "nao-conforme": { variant: "destructive", label: "Não conforme" },
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        "transition-shadow hover:shadow-md"
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "h-3 w-3 rounded-full shrink-0",
              kpi.accentColor === "green" && "bg-success",
              kpi.accentColor === "blue" && "bg-[#3B82F6]",
              kpi.accentColor === "orange" && "bg-warning",
              kpi.accentColor === "red" && "bg-destructive",
              kpi.accentColor === "purple" && "bg-[#8B5CF6]",
              kpi.accentColor === "cyan" && "bg-[#06B6D4]"
            )}
          />
          <span className="font-medium text-[14px] truncate">{kpi.titulo}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[16px] font-bold tabular-nums">
            {kpi.valor}
            {kpi.unidade}
          </span>
          <Badge variant={statusConfig[status].variant} badgeStyle="subtle" className="text-[10px]">
            {statusConfig[status].label}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                <div>
                  <span className="text-muted-foreground block">Meta</span>
                  <span className="font-medium">
                    {kpi.metaLabel || `${kpi.meta}${kpi.unidade}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Período</span>
                  <span className="font-medium">{kpi.periodo || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Tipo</span>
                  <span className="font-medium">
                    {kpi.isLowerBetter ? "Menor é melhor" : "Maior é melhor"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Histórico</span>
                  <span className="font-medium">{kpi.historico?.length || 0} meses</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(kpi)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(kpi.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remover
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KPIEditor({ className }) {
  const { kpis, updateKPI, addKPI, removeKPI, resetToDefault } = useKPIData()
  const [editingKPI, setEditingKPI] = React.useState(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [confirmReset, setConfirmReset] = React.useState(false)

  const handleSave = (data) => {
    if (isCreating) {
      addKPI(data)
      setIsCreating(false)
    } else if (editingKPI) {
      updateKPI(editingKPI.id, data)
      setEditingKPI(null)
    }
  }

  const handleDelete = (id) => {
    if (window.confirm("Tem certeza que deseja remover este indicador?")) {
      removeKPI(id)
    }
  }

  const handleReset = () => {
    resetToDefault()
    setConfirmReset(false)
  }

  return (
    <div className={cn("space-y-4 pb-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-[15px] font-semibold text-foreground">
          Gerenciar Indicadores
        </h3>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Resetar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setIsCreating(true)
              setEditingKPI({
                titulo: "",
                valor: 0,
                meta: 0,
                metaLabel: "",
                unidade: "%",
                periodo: "",
                accentColor: "green",
                isLowerBetter: false,
                historico: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                mesesLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
              })
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Novo KPI
          </Button>
        </div>
      </div>

      {/* KPI List */}
      <div className="space-y-2">
        {kpis.map((kpi) => (
          <KPIItemRow
            key={kpi.id}
            kpi={kpi}
            onEdit={setEditingKPI}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {kpis.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum indicador cadastrado.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => setConfirmReset(true)}
          >
            Carregar dados padrão
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={editingKPI !== null}
        onClose={() => {
          setEditingKPI(null)
          setIsCreating(false)
        }}
        title={isCreating ? "Novo Indicador" : "Editar Indicador"}
        size="lg"
      >
        <div className="max-h-[calc(100dvh-200px)] sm:max-h-[60vh] overflow-y-auto pr-2 pb-4">
          {editingKPI && (
            <KPIEditForm
              kpi={editingKPI}
              onSave={handleSave}
              onCancel={() => {
                setEditingKPI(null)
                setIsCreating(false)
              }}
            />
          )}
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Resetar Indicadores"
        size="sm"
      >
        <p className="text-[14px] text-muted-foreground mb-6">
          Isso irá restaurar todos os indicadores para os valores padrão.
          As alterações feitas serão perdidas.
        </p>
        <div className="flex gap-3">
          <Button onClick={handleReset} variant="destructive" className="flex-1">
            Sim, resetar
          </Button>
          <Button
            onClick={() => setConfirmReset(false)}
            variant="outline"
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// Compact version for inline editing
export function KPIEditorCompact({ kpiId, className }) {
  const { getKPI, updateKPI } = useKPIData()
  const [isEditing, setIsEditing] = React.useState(false)
  const kpi = getKPI(kpiId)

  if (!kpi) return null

  return (
    <div className={className}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Modal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        title={`Editar: ${kpi.titulo}`}
        size="md"
      >
        <KPIEditForm
          kpi={kpi}
          onSave={(data) => {
            updateKPI(kpiId, data)
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
        />
      </Modal>
    </div>
  )
}
