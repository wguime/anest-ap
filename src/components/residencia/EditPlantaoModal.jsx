/**
 * EditPlantaoModal
 * Modal para edição do plantão da residência
 */
import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, DatePicker, useToast } from '@/design-system';

const TURNO_OPTIONS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'integral', label: 'Integral' },
];

export function EditPlantaoModal({
  open,
  onClose,
  plantao,
  cardData,
  cardTurno,
  residentes = [],
  onSave,
  saving = false,
}) {
  const { toast } = useToast();
  const [editedPlantao, setEditedPlantao] = useState({
    residente: '',
    ano: '',
    data: '',
    hora: '',
  });
  const [editedCardData, setEditedCardData] = useState(null);
  const [editedCardTurno, setEditedCardTurno] = useState(null);

  // Atualizar estado quando o plantão mudar
  useEffect(() => {
    if (plantao) {
      setEditedPlantao({ ...plantao });
    }
    if (open) {
      setEditedCardData(cardData ? new Date(cardData + 'T12:00:00') : null);
      setEditedCardTurno(cardTurno || null);
    }
  }, [plantao, open, cardData, cardTurno]);

  // Atualizar campo
  const handleFieldChange = (field, value) => {
    setEditedPlantao(prev => ({ ...prev, [field]: value }));

    // Se mudar o residente, atualizar o ano automaticamente
    if (field === 'residente') {
      const residenteSelecionado = residentes.find(r => r.nome === value);
      if (residenteSelecionado) {
        setEditedPlantao(prev => ({
          ...prev,
          residente: value,
          ano: residenteSelecionado.ano,
        }));
      }
    }
  };

  // Salvar alterações
  const handleSave = async () => {
    // Validar campos obrigatórios
    const missing = [];
    if (!editedPlantao.residente) missing.push('Residente');
    if (!editedPlantao.data) missing.push('Data do plantão');
    if (!editedPlantao.hora) missing.push('Hora');
    if (missing.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missing.join(', ')}`,
        variant: 'warning',
      });
      return;
    }

    const isoDate = editedCardData
      ? `${editedCardData.getFullYear()}-${String(editedCardData.getMonth() + 1).padStart(2, '0')}-${String(editedCardData.getDate()).padStart(2, '0')}`
      : null;

    const result = await onSave({ ...editedPlantao, cardData: isoDate, cardTurno: editedCardTurno });
    if (result.success) {
      toast({
        title: 'Salvo',
        description: 'Plantão atualizado com sucesso',
        variant: 'success',
      });
      onClose();
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível salvar',
        variant: 'destructive',
      });
    }
  };

  // Cancelar e restaurar valores originais
  const handleCancel = () => {
    if (plantao) {
      setEditedPlantao({ ...plantao });
    }
    onClose();
  };

  // Opções de residentes para o select
  const residenteOptions = residentes.map(r => ({
    value: r.nome,
    label: `${r.nome} (${r.ano})`,
  }));

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Editar Plantão"
      description="Atualize as informações do plantão da residência"
      size="md"
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
        <div className="space-y-4">
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
              options={TURNO_OPTIONS}
              placeholder="Selecione o turno"
            />
          </div>

          {/* Residente */}
          <Select
            label="Residente"
            value={editedPlantao.residente}
            onChange={(value) => handleFieldChange('residente', value)}
            options={residenteOptions}
            placeholder="Selecione o residente"
          />

          {/* Data */}
          <Input
            label="Data"
            value={editedPlantao.data || ''}
            onChange={(e) => handleFieldChange('data', e.target.value)}
            placeholder="Ex: Quarta, 15 Jan"
          />

          {/* Hora */}
          <Input
            label="Hora"
            value={editedPlantao.hora || ''}
            onChange={(e) => handleFieldChange('hora', e.target.value)}
            placeholder="Ex: 19:00"
          />

          {/* Preview */}
          {editedPlantao.residente && (
            <div className="mt-4 p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-[#E8F5E9] text-[#004225] dark:bg-[#1A2F23] dark:text-[#2ECC71]"
                >
                  {editedPlantao.ano || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {editedPlantao.residente}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {editedPlantao.data || 'Data não definida'}
                  </p>
                </div>
                <span className="text-base font-bold text-[#9BC53D] dark:text-[#2ECC71]">
                  {editedPlantao.hora || '--:--'}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default EditPlantaoModal;
