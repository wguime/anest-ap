/**
 * RemoverCateterModal - Modal to mark catheter as removed
 */
import { useState } from 'react'
import {
  Modal,
  Button,
  DatePicker,
  Select,
  Textarea,
} from '@/design-system'
import { MOTIVOS_RETIRADA } from '@/data/cateterPeridualConfig'

export default function RemoverCateterModal({ open, onClose, onConfirm, saving }) {
  const [dataRetirada, setDataRetirada] = useState(new Date())
  const [motivo, setMotivo] = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')

  const handleConfirm = () => {
    const motivoFinal = motivo === 'Outro' ? motivoOutro.trim() || 'Outro' : motivo
    const isoDate = dataRetirada ? dataRetirada.toISOString() : new Date().toISOString()
    onConfirm(isoDate, motivoFinal)
  }

  const motivoOptions = MOTIVOS_RETIRADA.map((m) => ({
    value: m,
    label: m,
  }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnOverlayClick={!saving}
      title="Retirar Cateter"
      description="Registre a data e motivo da retirada do cateter peridural."
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!dataRetirada || !motivo || saving}
            loading={saving}
          >
            Confirmar Retirada
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <DatePicker
          label="Data da Retirada"
          placeholder="Selecione a data"
          value={dataRetirada}
          onChange={(date) => setDataRetirada(date)}
        />

        <Select
          label="Motivo da Retirada"
          options={motivoOptions}
          value={motivo}
          onChange={(val) => setMotivo(val)}
          placeholder="Selecione o motivo..."
        />

        {motivo === 'Outro' && (
          <Textarea
            label="Especifique o motivo"
            placeholder="Descreva o motivo..."
            value={motivoOutro}
            onChange={(val) => setMotivoOutro(val)}
            rows={2}
          />
        )}
      </div>
    </Modal>
  )
}
