/**
 * DistributeModal - Modal de selecao de destinatarios para distribuicao
 *
 * Permite ao admin selecionar cargos (roles) para distribuicao de documento.
 * Usa o design-system Modal que ja implementa portal, focus trap e animacoes.
 *
 * @param {string}   docId        - ID do documento
 * @param {string}   docTitle     - Titulo do documento (exibido no header)
 * @param {boolean}  isOpen       - Controla visibilidade do modal
 * @param {Function} onClose      - Callback para fechar o modal
 * @param {Function} onDistribute - Callback chamado com os cargos selecionados
 */
import { useState, useCallback, useMemo } from 'react'
import { Send, Users } from 'lucide-react'

import { Modal } from '@/design-system'
import { Button } from '@/design-system'
import { Checkbox } from '@/design-system'

// ---------------------------------------------------------------------------
// Static role list
// Quando houver um endpoint de usuarios, substituir por fetch real.
// ---------------------------------------------------------------------------

const AVAILABLE_ROLES = [
  { id: 'anestesiologista', label: 'Anestesiologista' },
  { id: 'enfermeiro', label: 'Enfermeiro' },
  { id: 'tec-enfermagem', label: 'Tec. Enfermagem' },
  { id: 'medico-residente', label: 'Medico Residente' },
  { id: 'farmaceutico', label: 'Farmaceutico' },
  { id: 'coordenador', label: 'Coordenador' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DistributeModal({
  docId,
  docTitle,
  isOpen,
  onClose,
  onDistribute,
}) {
  const [selected, setSelected] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Derived state
  const allSelected = useMemo(
    () => selected.length === AVAILABLE_ROLES.length,
    [selected]
  )

  // Toggle a single role
  const toggleRole = useCallback((roleId) => {
    setSelected((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }, [])

  // Toggle all
  const toggleAll = useCallback((checked) => {
    if (checked) {
      setSelected(AVAILABLE_ROLES.map((r) => r.id))
    } else {
      setSelected([])
    }
  }, [])

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (selected.length === 0 || !onDistribute) return

    const selectedRoles = AVAILABLE_ROLES.filter((r) => selected.includes(r.id))

    setSubmitting(true)
    try {
      await onDistribute(selectedRoles)
      // Reset on success and close
      setSelected([])
      onClose?.()
    } catch (err) {
      console.error('[DistributeModal] Distribution failed:', err)
      // Keep modal open so user can retry
    } finally {
      setSubmitting(false)
    }
  }, [selected, onDistribute, onClose])

  // Reset selection when modal closes
  const handleClose = useCallback(() => {
    if (!submitting) {
      setSelected([])
      onClose?.()
    }
  }, [submitting, onClose])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      size="sm"
      title="Distribuir Documento"
      description={docTitle || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={selected.length === 0}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Distribuir ({selected.length})
          </Button>
        </>
      }
    >
      <Modal.Body>
        <div className="space-y-1">
          {/* Info note */}
          <div className="flex items-start gap-2.5 p-3 mb-3 rounded-xl bg-[#E8F5E9] dark:bg-[#243530]">
            <Users className="w-4 h-4 mt-0.5 text-[#006837] dark:text-[#2ECC71] shrink-0" />
            <p className="text-[13px] text-[#004225] dark:text-[#A3B8B0] leading-snug">
              Selecione os cargos que devem receber este documento. Todos os
              usuarios com o cargo selecionado serao notificados.
            </p>
          </div>

          {/* Select all */}
          <div className="border-b border-[#C8E6C9] dark:border-[#2A3F36] pb-1 mb-1">
            <Checkbox
              checked={allSelected}
              onChange={toggleAll}
              label="Selecionar todos"
              size="md"
              compact
            />
          </div>

          {/* Role checkboxes */}
          {AVAILABLE_ROLES.map((role) => (
            <Checkbox
              key={role.id}
              checked={selected.includes(role.id)}
              onChange={() => toggleRole(role.id)}
              label={role.label}
              size="md"
              compact
            />
          ))}
        </div>
      </Modal.Body>
    </Modal>
  )
}

export default DistributeModal
