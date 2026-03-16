import * as React from "react"
import { createPortal } from "react-dom"
import { Plus, Trash2, Umbrella, FileText, ChevronDown, ChevronUp, UserPlus, Clock, Sun, Sunset } from "lucide-react"

import { Modal } from "@/design-system/components/ui/modal"
import { Button } from "@/design-system/components/ui/button"
import { Input } from "@/design-system/components/ui/input"
import { Textarea } from "@/design-system/components/ui/textarea"
import { Select } from "@/design-system/components/ui/select"
import { DatePicker } from "@/design-system/components/ui/date-picker"
import { useToast } from "@/design-system/components/ui/toast"

const HOSPITAIS_SECTIONS = [
  { key: "hro", label: "HRO" },
  { key: "unimed", label: "UNIMED" },
  { key: "materno", label: "MATERNO" },
  { key: "ferias", label: "FÉRIAS" },
  { key: "atestado", label: "ATESTADO" },
]

const CONSULTORIO_SECTIONS = [
  { key: "volanFinanceiro", label: "VOLAN/FINANCEIRO" },
  { key: "administrativo", label: "ADMINISTRATIVO/RH" },
  { key: "recepcao", label: "RECEPÇÃO/ATENDIMENTO" },
  { key: "telefoneWhatsapp", label: "TELEFONE/WHATSAPP" },
  { key: "financeiro", label: "FINANCEIRO" },
  { key: "enfermagemQmentum", label: "ENFERMAGEM QMENTUM" },
  { key: "ferias", label: "FÉRIAS" },
  { key: "atestado", label: "ATESTADO" },
]

// ============================================================================
// TURNO UTILITIES — parse/rebuild between string ↔ structured fields
// ============================================================================

function parseTurno(turnoString, sectionKey, type) {
  // Normalize "as"/"às" to "-" before parsing
  const str = (turnoString || "").trim().replace(/\s*(?:as|às)\s*/gi, "-")

  if (sectionKey === "ferias") {
    if (!str || str === "-") {
      return { mode: "ferias", inicioFerias: null, terminoFerias: null }
    }
    const match = str.match(/^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})$/)
    if (match) {
      const [, d1, m1, d2, m2] = match
      const currentYear = new Date().getFullYear()
      const startMonth = parseInt(m1, 10) - 1
      const endMonth = parseInt(m2, 10) - 1
      const endYear = startMonth > endMonth ? currentYear + 1 : currentYear
      return {
        mode: "ferias",
        inicioFerias: new Date(currentYear, startMonth, parseInt(d1, 10)),
        terminoFerias: new Date(endYear, endMonth, parseInt(d2, 10)),
      }
    }
    return { mode: "ferias", inicioFerias: null, terminoFerias: null }
  }

  if (sectionKey === "atestado") {
    if (!str || str === "-") {
      return { mode: "atestado", inicioFerias: null, terminoFerias: null }
    }
    const match = str.match(/^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})$/)
    if (match) {
      const [, d1, m1, d2, m2] = match
      const currentYear = new Date().getFullYear()
      const startMonth = parseInt(m1, 10) - 1
      const endMonth = parseInt(m2, 10) - 1
      const endYear = startMonth > endMonth ? currentYear + 1 : currentYear
      return {
        mode: "atestado",
        inicioFerias: new Date(currentYear, startMonth, parseInt(d1, 10)),
        terminoFerias: new Date(endYear, endMonth, parseInt(d2, 10)),
      }
    }
    return { mode: "atestado", inicioFerias: null, terminoFerias: null }
  }

  if (type === "consultorio") {
    if (!str || str === "-") {
      return {
        mode: "consultorio",
        matutino: { entrada: "", saida: "" },
        vespertino: { entrada: "", saida: "" },
      }
    }
    const parts = str.split(/\s*\/\s*/)
    if (parts.length >= 2) {
      const [matE = "", matS = ""] = parts[0].split("-").map((s) => s.trim())
      const [vespE = "", vespS = ""] = parts[1].split("-").map((s) => s.trim())
      return {
        mode: "consultorio",
        matutino: { entrada: matE, saida: matS },
        vespertino: { entrada: vespE, saida: vespS },
      }
    }
    const [e = "", s = ""] = str.split("-").map((s) => s.trim())
    return {
      mode: "consultorio",
      matutino: { entrada: e, saida: s },
      vespertino: { entrada: "", saida: "" },
    }
  }

  // hospitais
  if (!str || str === "-") {
    return { mode: "hospitais", entrada: "", saida: "" }
  }
  const [entrada = "", saida = ""] = str.split("-").map((s) => s.trim())
  return { mode: "hospitais", entrada, saida }
}

function rebuildTurno(parsed) {
  if (!parsed) return "-"

  if (parsed.mode === "ferias") {
    if (!parsed.inicioFerias || !parsed.terminoFerias) return "-"
    const d1 = String(parsed.inicioFerias.getDate()).padStart(2, "0")
    const m1 = String(parsed.inicioFerias.getMonth() + 1).padStart(2, "0")
    const d2 = String(parsed.terminoFerias.getDate()).padStart(2, "0")
    const m2 = String(parsed.terminoFerias.getMonth() + 1).padStart(2, "0")
    return `${d1}/${m1}-${d2}/${m2}`
  }

  if (parsed.mode === "atestado") {
    if (!parsed.inicioFerias || !parsed.terminoFerias) return "-"
    const d1 = String(parsed.inicioFerias.getDate()).padStart(2, "0")
    const m1 = String(parsed.inicioFerias.getMonth() + 1).padStart(2, "0")
    const d2 = String(parsed.terminoFerias.getDate()).padStart(2, "0")
    const m2 = String(parsed.terminoFerias.getMonth() + 1).padStart(2, "0")
    return `${d1}/${m1}-${d2}/${m2}`
  }

  if (parsed.mode === "consultorio") {
    const { matutino: mat, vespertino: vesp } = parsed
    const hasMat = mat.entrada && mat.saida
    const hasVesp = vesp.entrada && vesp.saida
    if (hasMat && hasVesp)
      return `${mat.entrada}-${mat.saida} / ${vesp.entrada}-${vesp.saida}`
    if (hasMat) return `${mat.entrada}-${mat.saida}`
    if (hasVesp) return `${vesp.entrada}-${vesp.saida}`
    return "-"
  }

  // hospitais
  if (parsed.entrada && parsed.saida)
    return `${parsed.entrada}-${parsed.saida}`
  return "-"
}

// ============================================================================
// TURNO FIELDS — reusable structured shift editor
// ============================================================================

function TurnoFields({ turnoData, onChange, errors }) {
  if (!turnoData) return null

  if (turnoData.mode === "ferias") {
    return (
      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DatePicker
          label="Início das Férias"
          value={turnoData.inicioFerias}
          onChange={(date) => onChange("inicioFerias", date)}
          placeholder="Selecione..."
          error={errors?.inicioFerias}
        />
        <DatePicker
          label="Término das Férias"
          value={turnoData.terminoFerias}
          onChange={(date) => onChange("terminoFerias", date)}
          placeholder="Selecione..."
          minDate={turnoData.inicioFerias || undefined}
          error={errors?.terminoFerias}
        />
      </div>
    )
  }

  if (turnoData.mode === "atestado") {
    return (
      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DatePicker
          label="Início do Atestado"
          value={turnoData.inicioFerias}
          onChange={(date) => onChange("inicioFerias", date)}
          placeholder="Selecione..."
          error={errors?.inicioFerias}
        />
        <DatePicker
          label="Término do Atestado"
          value={turnoData.terminoFerias}
          onChange={(date) => onChange("terminoFerias", date)}
          placeholder="Selecione..."
          minDate={turnoData.inicioFerias || undefined}
          error={errors?.terminoFerias}
        />
      </div>
    )
  }

  if (turnoData.mode === "consultorio") {
    return (
      <div className="sm:col-span-2 space-y-3">
        {/* Turno Matutino */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sun className="w-4 h-4 text-[#004225] dark:text-[#2ECC71]" />
            <span className="text-sm font-semibold text-[#004225] dark:text-[#2ECC71]">
              Turno Matutino
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="time"
              label="Entrada"
              value={turnoData.matutino.entrada}
              onChange={(e) => onChange("matutino.entrada", e.target.value)}
              leftIcon={<Clock className="w-4 h-4" />}
              error={errors?.["matutino.entrada"]}
            />
            <Input
              type="time"
              label="Saída"
              value={turnoData.matutino.saida}
              onChange={(e) => onChange("matutino.saida", e.target.value)}
              leftIcon={<Clock className="w-4 h-4" />}
              error={errors?.["matutino.saida"]}
            />
          </div>
        </div>
        {/* Turno Vespertino */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sunset className="w-4 h-4 text-[#004225] dark:text-[#2ECC71]" />
            <span className="text-sm font-semibold text-[#004225] dark:text-[#2ECC71]">
              Turno Vespertino
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="time"
              label="Entrada"
              value={turnoData.vespertino.entrada}
              onChange={(e) => onChange("vespertino.entrada", e.target.value)}
              leftIcon={<Clock className="w-4 h-4" />}
              error={errors?.["vespertino.entrada"]}
            />
            <Input
              type="time"
              label="Saída"
              value={turnoData.vespertino.saida}
              onChange={(e) => onChange("vespertino.saida", e.target.value)}
              leftIcon={<Clock className="w-4 h-4" />}
              error={errors?.["vespertino.saida"]}
            />
          </div>
        </div>
      </div>
    )
  }

  // hospitais mode — 2 inputs that fit naturally in the parent grid
  return (
    <>
      <Input
        type="time"
        label="Entrada"
        value={turnoData.entrada}
        onChange={(e) => onChange("entrada", e.target.value)}
        leftIcon={<Clock className="w-4 h-4" />}
        error={errors?.entrada}
      />
      <Input
        type="time"
        label="Saída"
        value={turnoData.saida}
        onChange={(e) => onChange("saida", e.target.value)}
        leftIcon={<Clock className="w-4 h-4" />}
        error={errors?.saida}
      />
    </>
  )
}

// ============================================================================
// MAIN MODAL
// ============================================================================

/**
 * AssignStaffModal - Modal para edição inline de escalas por seção
 *
 * Lista agrupada editável: cada funcionário é um card com campos inline.
 * Nome é um dropdown com todos os funcionários conhecidos.
 * Permite adicionar novos funcionários (adicionados automaticamente aos dropdowns).
 *
 * @example
 * <AssignStaffModal
 *   open={showModal}
 *   type="hospitais"
 *   staff={staffData}
 *   onClose={() => setShowModal(false)}
 *   onSave={saveStaff}
 *   saving={savingStaff}
 * />
 */
const CARD_TURNO_OPTIONS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'integral', label: 'Integral' },
]

export function AssignStaffModal({
  open,
  type = "hospitais",
  staff = {},
  cardData,
  cardTurno,
  onClose,
  onSave,
  saving = false,
}) {
  const { toast } = useToast()
  const [items, setItems] = React.useState([])
  const [turnoFields, setTurnoFields] = React.useState({})
  const [errors, setErrors] = React.useState({})
  const [customNames, setCustomNames] = React.useState([])
  const [newName, setNewName] = React.useState("")
  const [newSection, setNewSection] = React.useState("")
  const [newTurnoFields, setNewTurnoFields] = React.useState(null)
  const [showNewEmployeeModal, setShowNewEmployeeModal] = React.useState(false)
  const [addToSection, setAddToSection] = React.useState(null)
  const [collapsedSections, setCollapsedSections] = React.useState({})
  const [editedCardData, setEditedCardData] = React.useState(null)
  const [editedCardTurno, setEditedCardTurno] = React.useState(null)

  const sections =
    type === "hospitais" ? HOSPITAIS_SECTIONS : CONSULTORIO_SECTIONS
  const sectionOptions = sections.map((s) => ({ value: s.key, label: s.label }))
  const categoryKey = type === "hospitais" ? "hospitais" : "consultorio"

  // Collect all unique names from staff data + custom names
  const nameOptions = React.useMemo(() => {
    const names = new Set()
    if (staff?.hospitais) {
      Object.values(staff.hospitais).forEach((members) => {
        members.forEach((m) => { if (m.nome) names.add(m.nome) })
      })
    }
    if (staff?.consultorio) {
      Object.values(staff.consultorio).forEach((members) => {
        members.forEach((m) => { if (m.nome) names.add(m.nome) })
      })
    }
    customNames.forEach((n) => names.add(n))
    return Array.from(names)
      .sort()
      .map((n) => ({ value: n, label: n }))
  }, [staff, customNames])

  // Deep clone + flatten on open, compute turnoFields
  React.useEffect(() => {
    if (!open) return
    const categoryData = staff[categoryKey]
    if (!categoryData) {
      setItems([])
      setTurnoFields({})
      return
    }
    const cloned = JSON.parse(JSON.stringify(categoryData))
    const flat = []
    for (const [sectionKey, members] of Object.entries(cloned)) {
      members.forEach((member, idx) => {
        flat.push({
          ...member,
          _sectionKey: sectionKey,
          _id: `${sectionKey}-${idx}-${Date.now()}`,
        })
      })
    }

    const fields = {}
    for (const item of flat) {
      fields[item._id] = parseTurno(item.turno, item._sectionKey, type)
    }

    setItems(flat)
    setTurnoFields(fields)
    setErrors({})
    setCustomNames([])
    setNewName("")
    setNewSection("")
    setNewTurnoFields(null)
    setShowNewEmployeeModal(false)
    setEditedCardData(cardData ? new Date(cardData + 'T12:00:00') : null)
    setEditedCardTurno(cardTurno || null)
  }, [open, staff, categoryKey, type, cardData, cardTurno])

  // Update a non-turno field
  const handleFieldChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, [field]: value } : item
      )
    )
    if (errors[id]?.[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        if (next[id]) {
          next[id] = { ...next[id] }
          delete next[id][field]
          if (Object.keys(next[id]).length === 0) delete next[id]
        }
        return next
      })
    }
  }

  // Update a specific turno field (handles dot-paths like "matutino.entrada")
  const handleTurnoFieldChange = (id, fieldPath, value) => {
    setTurnoFields((prev) => {
      const current = prev[id]
      if (!current) return prev
      const updated = { ...current }
      if (fieldPath.includes(".")) {
        const [group, field] = fieldPath.split(".")
        updated[group] = { ...updated[group], [field]: value }
      } else {
        updated[fieldPath] = value
      }
      return { ...prev, [id]: updated }
    })
    if (errors[id]?.[fieldPath]) {
      setErrors((prev) => {
        const next = { ...prev }
        if (next[id]) {
          next[id] = { ...next[id] }
          delete next[id][fieldPath]
          if (Object.keys(next[id]).length === 0) delete next[id]
        }
        return next
      })
    }
  }

  // Move between sections — reinitialize turnoFields when switching to/from férias
  const handleSectionChange = (id, newSectionKey) => {
    const newStatus = newSectionKey === "ferias" ? "ferias" : newSectionKey === "atestado" ? "atestado" : "ativa"

    setItems((prev) =>
      prev.map((item) => {
        if (item._id !== id) return item
        return {
          ...item,
          _sectionKey: newSectionKey,
          status: newStatus,
        }
      })
    )

    setTurnoFields((prev) => {
      const current = prev[id]
      const wasDateMode = current?.mode === "ferias" || current?.mode === "atestado"
      const isDateMode = newSectionKey === "ferias" || newSectionKey === "atestado"

      if (wasDateMode !== isDateMode) {
        if (isDateMode) {
          const mode = newSectionKey === "ferias" ? "ferias" : "atestado"
          return { ...prev, [id]: { mode, inicioFerias: null, terminoFerias: null } }
        }
        if (type === "consultorio") {
          return {
            ...prev,
            [id]: {
              mode: "consultorio",
              matutino: { entrada: "", saida: "" },
              vespertino: { entrada: "", saida: "" },
            },
          }
        }
        return { ...prev, [id]: { mode: "hospitais", entrada: "", saida: "" } }
      }
      // Switching between ferias and atestado — reinitialize with new mode
      if (isDateMode && current?.mode !== (newSectionKey === "ferias" ? "ferias" : "atestado")) {
        const mode = newSectionKey === "ferias" ? "ferias" : "atestado"
        return { ...prev, [id]: { mode, inicioFerias: null, terminoFerias: null } }
      }
      return prev
    })
  }

  // Open new employee modal pre-filled with the section
  const handleAdd = (sectionKey) => {
    setAddToSection(sectionKey)
    setNewSection(sectionKey)
    setNewName("")
    setShowNewEmployeeModal(true)
  }

  // Toggle section collapse
  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  // Add brand new employee (from sub-modal)
  const handleAddNewEmployee = () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      toast({
        title: "Atenção",
        description: "Digite o nome do funcionário",
        variant: "warning",
      })
      return
    }
    if (!newSection) {
      toast({
        title: "Atenção",
        description: "Selecione a seção",
        variant: "warning",
      })
      return
    }

    setCustomNames((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    )

    const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newItem = {
      nome: trimmed,
      turno: rebuildTurno(newTurnoFields),
      status: newSection === "ferias" ? "ferias" : newSection === "atestado" ? "atestado" : "ativa",
      _sectionKey: newSection,
      _id: newId,
    }
    if (type === "consultorio") {
      newItem.funcoes = ""
    }
    setItems((prev) => [...prev, newItem])

    if (newTurnoFields) {
      setTurnoFields((prev) => ({ ...prev, [newId]: { ...newTurnoFields } }))
    }

    setNewName("")
    setNewSection("")
    setNewTurnoFields(null)
    setShowNewEmployeeModal(false)
  }

  // Remove item
  const handleRemove = (id) => {
    setItems((prev) => prev.filter((item) => item._id !== id))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setTurnoFields((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // Validate + save
  const handleSave = async () => {
    const newErrors = {}

    for (const item of items) {
      if (!item.nome || !item.nome.trim()) {
        newErrors[item._id] = { ...newErrors[item._id], nome: "Nome obrigatório" }
      }

      const tf = turnoFields[item._id]
      if (tf) {
        if (tf.mode === "hospitais") {
          if (tf.entrada && !tf.saida) {
            newErrors[item._id] = { ...newErrors[item._id], saida: "Preencha a saída" }
          }
          if (tf.saida && !tf.entrada) {
            newErrors[item._id] = { ...newErrors[item._id], entrada: "Preencha a entrada" }
          }
        } else if (tf.mode === "consultorio") {
          if (tf.matutino.entrada && !tf.matutino.saida) {
            newErrors[item._id] = { ...newErrors[item._id], "matutino.saida": "Preencha a saída" }
          }
          if (tf.matutino.saida && !tf.matutino.entrada) {
            newErrors[item._id] = { ...newErrors[item._id], "matutino.entrada": "Preencha a entrada" }
          }
          if (tf.vespertino.entrada && !tf.vespertino.saida) {
            newErrors[item._id] = { ...newErrors[item._id], "vespertino.saida": "Preencha a saída" }
          }
          if (tf.vespertino.saida && !tf.vespertino.entrada) {
            newErrors[item._id] = { ...newErrors[item._id], "vespertino.entrada": "Preencha a entrada" }
          }
        } else if (tf.mode === "ferias" || tf.mode === "atestado") {
          if (tf.inicioFerias && !tf.terminoFerias) {
            newErrors[item._id] = { ...newErrors[item._id], terminoFerias: "Preencha o término" }
          }
          if (tf.terminoFerias && !tf.inicioFerias) {
            newErrors[item._id] = { ...newErrors[item._id], inicioFerias: "Preencha o início" }
          }
          if (tf.inicioFerias && tf.terminoFerias && tf.inicioFerias >= tf.terminoFerias) {
            newErrors[item._id] = { ...newErrors[item._id], terminoFerias: "Término deve ser após o início" }
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: "Atenção",
        description: "Corrija os campos destacados",
        variant: "warning",
      })
      return
    }

    // Rebuild grouped structure
    const rebuilt = {}
    for (const s of sections) {
      rebuilt[s.key] = []
    }
    for (const item of items) {
      const { _id, _sectionKey, ...rest } = item
      const turno = rebuildTurno(turnoFields[_id])
      const clean = {
        nome: rest.nome.trim(),
        turno,
        status: rest.status || "ativa",
      }
      if (rest.observacao && rest.observacao.trim())
        clean.observacao = rest.observacao.trim()
      if (rest.funcoes && rest.funcoes.trim())
        clean.funcoes = rest.funcoes.trim()
      if (rest.alertObs && rest.alertObs.trim())
        clean.alertObs = rest.alertObs.trim()
      if (!rebuilt[_sectionKey]) rebuilt[_sectionKey] = []
      rebuilt[_sectionKey].push(clean)
    }

    const fullStaff = JSON.parse(JSON.stringify(staff))
    fullStaff[categoryKey] = rebuilt

    // Add card-level date/turno meta
    const isoDate = editedCardData
      ? `${editedCardData.getFullYear()}-${String(editedCardData.getMonth() + 1).padStart(2, '0')}-${String(editedCardData.getDate()).padStart(2, '0')}`
      : null
    fullStaff[`${categoryKey}CardData`] = isoDate
    fullStaff[`${categoryKey}CardTurno`] = editedCardTurno

    const result = await onSave(fullStaff)
    if (result?.success) {
      toast({
        title: "Salvo",
        description: "Escalas atualizadas com sucesso",
        variant: "success",
      })
      onClose()
    } else {
      toast({
        title: "Erro",
        description: result?.error || "Não foi possível salvar",
        variant: "destructive",
      })
    }
  }

  const handleCancel = () => {
    onClose()
  }

  // Group items by section for rendering
  const groupedItems = React.useMemo(() => {
    const grouped = {}
    for (const s of sections) {
      grouped[s.key] = []
    }
    for (const item of items) {
      if (!grouped[item._sectionKey]) grouped[item._sectionKey] = []
      grouped[item._sectionKey].push(item)
    }
    return grouped
  }, [items, sections])

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={`Editar Escalas - ${type === "hospitais" ? "Hospitais" : "Consultório"}`}
      description="Edite, adicione ou remova funcionários"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <Modal.Body>
        <div className="space-y-6">
          {/* Data e Turno do card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border">
            <DatePicker
              label="Data"
              value={editedCardData}
              onChange={(date) => setEditedCardData(date)}
              placeholder="Selecione a data"
            />
            <Select
              label="Turno"
              value={editedCardTurno || ''}
              onChange={(value) => setEditedCardTurno(value || null)}
              options={CARD_TURNO_OPTIONS}
              placeholder="Selecione o turno"
            />
          </div>

          {/* Sections with inline editable cards */}
          {sections.map((section) => {
            const sectionItems = groupedItems[section.key] || []
            const isCollapsed = !!collapsedSections[section.key]
            return (
              <div key={section.key} className="space-y-3">
                {/* Section header - clickable accordion (sticky) */}
                <div className="flex items-center justify-between sticky top-0 z-10 bg-card py-2 -my-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-[#D4EDDA] text-[#004225] dark:bg-[#1B4332] dark:text-[#2ECC71] transition-colors hover:bg-[#C1E4C9] dark:hover:bg-[#254A3A]"
                  >
                    {section.key === "ferias" && (
                      <Umbrella className="h-3 w-3" strokeWidth={2} />
                    )}
                    {section.key === "atestado" && (
                      <FileText className="h-3 w-3" strokeWidth={2} />
                    )}
                    <span>{section.label}</span>
                    <span className="opacity-60">({sectionItems.length})</span>
                    {isCollapsed ? (
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    ) : (
                      <ChevronUp className="h-3 w-3 opacity-60" />
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAdd(section.key)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Adicionar
                  </Button>
                </div>

                {/* Section items - collapsible */}
                {!isCollapsed && (
                  sectionItems.length > 0 ? (
                    <div className="space-y-3">
                      {sectionItems.map((item) => (
                        <StaffItemCard
                          key={item._id}
                          item={item}
                          type={type}
                          nameOptions={nameOptions}
                          sectionOptions={sectionOptions}
                          errors={errors[item._id]}
                          turnoData={turnoFields[item._id]}
                          onFieldChange={handleFieldChange}
                          onTurnoFieldChange={(fieldPath, value) =>
                            handleTurnoFieldChange(item._id, fieldPath, value)
                          }
                          onSectionChange={handleSectionChange}
                          onRemove={handleRemove}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      Nenhum funcionário nesta seção
                    </div>
                  )
                )}
              </div>
            )
          })}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Button to open new employee modal */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowNewEmployeeModal(true)}
              leftIcon={<UserPlus className="h-4 w-4" />}
              className="w-full border-dashed border-[#C8E6C9] dark:border-[#2A3F36] text-[#006837] dark:text-[#2ECC71] hover:bg-[#F0FFF4] dark:hover:bg-[#1A2420]"
            >
              Adicionar Novo Funcionário
            </Button>
          </div>

          {/* New employee modal */}
          {showNewEmployeeModal && (
            <NewEmployeeModal
              newName={newName}
              setNewName={setNewName}
              newSection={newSection}
              setNewSection={setNewSection}
              newTurnoFields={newTurnoFields}
              setNewTurnoFields={setNewTurnoFields}
              type={type}
              sectionOptions={sectionOptions}
              onAdd={handleAddNewEmployee}
              onClose={() => {
                setShowNewEmployeeModal(false)
                setNewName("")
                setNewSection("")
                setNewTurnoFields(null)
              }}
            />
          )}
        </div>
      </Modal.Body>
    </Modal>
  )
}

// ============================================================================
// STAFF ITEM CARD — inline editable card for each employee
// ============================================================================

function StaffItemCard({
  item,
  type,
  nameOptions,
  sectionOptions,
  errors,
  turnoData,
  onFieldChange,
  onTurnoFieldChange,
  onSectionChange,
  onRemove,
}) {
  const [showObs, setShowObs] = React.useState(
    !!(item.observacao || item.alertObs)
  )

  return (
    <div className="p-4 rounded-xl bg-[#F0FFF4] dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] relative">
      {/* Delete button */}
      <button
        type="button"
        onClick={() => onRemove(item._id)}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        aria-label="Remover funcionário"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-10">
        <Select
          label="Nome *"
          value={item.nome || ""}
          onChange={(value) => onFieldChange(item._id, "nome", value)}
          options={nameOptions}
          placeholder="Selecione..."
          error={errors?.nome}
        />
        <Select
          label="Seção"
          value={item._sectionKey}
          onChange={(value) => onSectionChange(item._id, value)}
          options={sectionOptions}
        />
        <TurnoFields
          turnoData={turnoData}
          onChange={onTurnoFieldChange}
          errors={errors}
        />
        {type === "consultorio" && (
          <Input
            label="Funções"
            value={item.funcoes || ""}
            onChange={(e) =>
              onFieldChange(item._id, "funcoes", e.target.value)
            }
            placeholder="Ex: Secretária/Recepcionista"
          />
        )}
      </div>

      {/* Collapsible observations */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowObs(!showObs)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showObs ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Observações
        </button>

        {showObs && (
          <div className="mt-2 space-y-3">
            <Textarea
              label="Observação"
              value={item.observacao || ""}
              onChange={(value) =>
                onFieldChange(item._id, "observacao", value)
              }
              placeholder="Ex: IOSC e após HRO"
              rows={2}
              maxLength={100}
              showCount
            />
            {type === "consultorio" && (
              <Textarea
                label="Alerta/Obs"
                value={item.alertObs || ""}
                onChange={(value) =>
                  onFieldChange(item._id, "alertObs", value)
                }
                placeholder="Ex: Assume cobranças nas férias da Marta"
                rows={2}
                maxLength={120}
                showCount
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// NEW EMPLOYEE MODAL — portal overlay above parent modal
// ============================================================================

function NewEmployeeModal({
  newName,
  setNewName,
  newSection,
  setNewSection,
  newTurnoFields,
  setNewTurnoFields,
  type,
  sectionOptions,
  onAdd,
  onClose,
}) {
  // Reinitialize turno fields when section changes
  React.useEffect(() => {
    if (!newSection) {
      setNewTurnoFields(null)
      return
    }
    if (newSection === "ferias") {
      setNewTurnoFields({ mode: "ferias", inicioFerias: null, terminoFerias: null })
    } else if (newSection === "atestado") {
      setNewTurnoFields({ mode: "atestado", inicioFerias: null, terminoFerias: null })
    } else if (type === "consultorio") {
      setNewTurnoFields({
        mode: "consultorio",
        matutino: { entrada: "", saida: "" },
        vespertino: { entrada: "", saida: "" },
      })
    } else {
      setNewTurnoFields({ mode: "hospitais", entrada: "", saida: "" })
    }
  }, [newSection, type, setNewTurnoFields])

  const handleNewTurnoChange = (fieldPath, value) => {
    setNewTurnoFields((prev) => {
      if (!prev) return prev
      const updated = { ...prev }
      if (fieldPath.includes(".")) {
        const [group, field] = fieldPath.split(".")
        updated[group] = { ...updated[group], [field]: value }
      } else {
        updated[fieldPath] = value
      }
      return updated
    })
  }

  React.useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[460px] rounded-2xl border border-border bg-card text-foreground shadow-xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 text-[#006837] dark:text-[#2ECC71]">
          <UserPlus className="h-5 w-5" />
          <h3 className="text-base font-bold">Adicionar Novo Funcionário</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Adicione um funcionário que ainda não está nas listas. Ele será
          adicionado à seção escolhida e ficará disponível nos dropdowns.
        </p>

        {/* Fields */}
        <div className="space-y-3">
          <Input
            label="Nome *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do funcionário"
          />
          <Select
            label="Seção *"
            value={newSection}
            onChange={(value) => setNewSection(value)}
            options={sectionOptions}
            placeholder="Selecione..."
          />
          {newTurnoFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TurnoFields
                turnoData={newTurnoFields}
                onChange={handleNewTurnoChange}
                errors={null}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onAdd}
            leftIcon={<Plus className="h-4 w-4" />}
            className="flex-1"
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
