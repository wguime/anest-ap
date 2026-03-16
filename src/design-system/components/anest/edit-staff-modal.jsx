import * as React from "react"
import { Plus, Trash2, AlertCircle } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Modal } from "@/design-system/components/ui/modal"
import { Button } from "@/design-system/components/ui/button"
import { Input } from "@/design-system/components/ui/input"
import { Textarea } from "@/design-system/components/ui/textarea"
import { Alert } from "@/design-system/components/ui/alert"

/**
 * EditStaffModal - Modal para edição de escala de staff
 *
 * Permite adicionar, remover e editar membros da equipe de staff
 * com validação de campos obrigatórios (Nome e Turno).
 *
 * @example
 * <EditStaffModal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   initialData={[
 *     { id: '1', nome: 'Dr. Carlos Silva', turno: '07:00-13:00', funcoes: 'Staff', observacao: '', alertObs: '' },
 *   ]}
 *   onSave={(data) => console.log('Saved:', data)}
 * />
 */
export function EditStaffModal({
  open,
  onClose,
  initialData = [],
  onSave,
  title = "Editar Escala de Staff",
  className,
}) {
  // Estado do formulário - lista de staff members
  const [staffMembers, setStaffMembers] = React.useState(initialData)
  const [errors, setErrors] = React.useState({})

  // Atualizar estado interno quando initialData mudar
  React.useEffect(() => {
    if (open) {
      setStaffMembers(initialData.length > 0 ? initialData : [])
      setErrors({})
    }
  }, [open, initialData])

  // Adicionar novo membro
  const handleAddMember = () => {
    const newMember = {
      id: `temp-${Date.now()}`,
      nome: "",
      turno: "",
      funcoes: "",
      observacao: "",
      alertObs: "",
    }
    setStaffMembers([...staffMembers, newMember])
  }

  // Remover membro
  const handleRemoveMember = (id) => {
    setStaffMembers(staffMembers.filter((member) => member.id !== id))
    // Limpar erros deste membro
    const newErrors = { ...errors }
    delete newErrors[id]
    setErrors(newErrors)
  }

  // Atualizar campo de um membro
  const handleUpdateMember = (id, field, value) => {
    setStaffMembers(
      staffMembers.map((member) =>
        member.id === id ? { ...member, [field]: value } : member
      )
    )
    // Limpar erro deste campo quando usuário editar
    if (errors[id]?.[field]) {
      setErrors({
        ...errors,
        [id]: { ...errors[id], [field]: undefined },
      })
    }
  }

  // Validar formulário
  const validateForm = () => {
    const newErrors = {}
    let isValid = true

    staffMembers.forEach((member) => {
      const memberErrors = {}

      if (!member.nome || member.nome.trim() === "") {
        memberErrors.nome = "Nome é obrigatório"
        isValid = false
      }

      if (!member.turno || member.turno.trim() === "") {
        memberErrors.turno = "Turno é obrigatório"
        isValid = false
      }

      if (Object.keys(memberErrors).length > 0) {
        newErrors[member.id] = memberErrors
      }
    })

    setErrors(newErrors)
    return isValid
  }

  // Salvar
  const handleSave = () => {
    if (!validateForm()) {
      return
    }

    onSave?.(staffMembers)
    onClose?.()
  }

  // Cancelar
  const handleCancel = () => {
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Adicione, edite ou remova membros da equipe de staff"
      size="lg"
      className={className}
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </>
      }
    >
      <Modal.Body>
        <div className="space-y-6">
          {/* Botão para adicionar novo membro */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddMember}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Adicionar Membro
            </Button>
          </div>

          {/* Lista de membros */}
          {staffMembers.length === 0 ? (
            <Alert variant="info" title="Nenhum membro adicionado">
              Clique em "Adicionar Membro" para começar a montar a escala.
            </Alert>
          ) : (
            <div className="space-y-6">
              {staffMembers.map((member, index) => (
                <div
                  key={member.id}
                  className={cn(
                    "relative rounded-2xl border border-border bg-card p-5",
                    "space-y-4"
                  )}
                >
                  {/* Header com número e botão de remover */}
                  <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                    <div className="text-sm font-semibold text-muted-foreground">
                      Membro #{index + 1}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      Remover
                    </Button>
                  </div>

                  {/* Campos do formulário */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Nome (obrigatório) */}
                    <Input
                      label="Nome *"
                      placeholder="Ex: Dr. Carlos Silva"
                      value={member.nome}
                      onChange={(e) =>
                        handleUpdateMember(member.id, "nome", e.target.value)
                      }
                      error={errors[member.id]?.nome}
                    />

                    {/* Turno (obrigatório) */}
                    <Input
                      label="Turno *"
                      placeholder="Ex: 07:00-13:00"
                      value={member.turno}
                      onChange={(e) =>
                        handleUpdateMember(member.id, "turno", e.target.value)
                      }
                      error={errors[member.id]?.turno}
                    />
                  </div>

                  {/* Funções */}
                  <Input
                    label="Funções"
                    placeholder="Ex: Staff, Coordenador"
                    value={member.funcoes}
                    onChange={(e) =>
                      handleUpdateMember(member.id, "funcoes", e.target.value)
                    }
                  />

                  {/* Observação */}
                  <Textarea
                    label="Observação"
                    placeholder="Observações gerais sobre este membro..."
                    value={member.observacao}
                    onChange={(value) =>
                      handleUpdateMember(member.id, "observacao", value)
                    }
                    rows={2}
                    maxLength={200}
                    showCount
                  />

                  {/* Alert Obs */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Observação de Alerta
                    </label>
                    <Alert
                      variant="warning"
                      icon={<AlertCircle className="h-5 w-5" />}
                    >
                      <Textarea
                        placeholder="Informações importantes que merecem destaque (Ex: Restrição medicamentosa, Alergias)..."
                        value={member.alertObs}
                        onChange={(value) =>
                          handleUpdateMember(member.id, "alertObs", value)
                        }
                        rows={2}
                        maxLength={150}
                        showCount
                        className="mt-2"
                      />
                    </Alert>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  )
}
