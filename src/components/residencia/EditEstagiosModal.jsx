/**
 * EditEstagiosModal
 * Modal para edição dos estágios e cirurgiões atribuídos aos residentes
 * Residentes agrupados por ano (R1, R2, R3) com seções colapsáveis
 */
import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input, Select, DatePicker, useToast } from '@/design-system';
import { Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';

const ANO_SECTIONS = [
  { key: 'R1', label: 'R1' },
  { key: 'R2', label: 'R2' },
  { key: 'R3', label: 'R3' },
];

const TURNO_OPTIONS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'integral', label: 'Integral' },
];

export function EditEstagiosModal({
  open,
  onClose,
  residentes,
  cardData,
  cardTurno,
  onSave,
  saving = false,
}) {
  const { toast } = useToast();
  const [editedResidentes, setEditedResidentes] = useState([]);
  const [editedCardData, setEditedCardData] = useState(null);
  const [editedCardTurno, setEditedCardTurno] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Atualizar estado quando os residentes mudarem ou modal abrir
  useEffect(() => {
    if (open) {
      setEditedResidentes(residentes ? JSON.parse(JSON.stringify(residentes)) : []);
      setEditedCardData(cardData ? new Date(cardData + 'T12:00:00') : null);
      setEditedCardTurno(cardTurno || null);
      setCollapsedSections({});
    }
  }, [open, residentes, cardData, cardTurno]);

  // Agrupar residentes por ano
  const groupedByAno = useMemo(() => {
    const grouped = {};
    for (const s of ANO_SECTIONS) {
      grouped[s.key] = [];
    }
    editedResidentes.forEach((r, index) => {
      const ano = r.ano || 'R1';
      if (!grouped[ano]) grouped[ano] = [];
      grouped[ano].push({ ...r, _originalIndex: index });
    });
    return grouped;
  }, [editedResidentes]);

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Atualizar campo de um residente
  const handleFieldChange = (originalIndex, field, value) => {
    setEditedResidentes(prev => {
      const updated = [...prev];
      updated[originalIndex] = { ...updated[originalIndex], [field]: value };
      return updated;
    });
  };

  // Adicionar novo residente em uma seção específica
  const handleAddResidente = (ano) => {
    const newId = `r-${Date.now()}`;
    setEditedResidentes(prev => [
      ...prev,
      {
        id: newId,
        nome: '',
        ano,
        estagio: '',
        cirurgiao: '',
      },
    ]);
    // Garantir que a seção está expandida
    setCollapsedSections(prev => ({ ...prev, [ano]: false }));
  };

  // Remover residente
  const handleRemoveResidente = (originalIndex) => {
    setEditedResidentes(prev => prev.filter((_, i) => i !== originalIndex));
  };

  // Salvar alterações
  const handleSave = async () => {
    const residentesValidos = editedResidentes.filter(r => r.nome && r.nome.trim() !== '');

    if (residentesValidos.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Adicione pelo menos um residente com nome',
        variant: 'warning',
      });
      return;
    }

    const isoDate = editedCardData
      ? `${editedCardData.getFullYear()}-${String(editedCardData.getMonth() + 1).padStart(2, '0')}-${String(editedCardData.getDate()).padStart(2, '0')}`
      : null;

    const result = await onSave({
      residentes: residentesValidos,
      cardData: isoDate,
      cardTurno: editedCardTurno,
    });
    if (result.success) {
      toast({
        title: 'Salvo',
        description: 'Estágios atualizados com sucesso',
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

  const handleCancel = () => {
    setEditedResidentes(JSON.parse(JSON.stringify(residentes)));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Editar Residentes"
      description="Gerencie os residentes, estágios e cirurgiões"
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
      <Modal.Body className="max-h-[60vh] overflow-y-auto">
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
              options={TURNO_OPTIONS}
              placeholder="Selecione o turno"
            />
          </div>

          {/* Seções por ano */}
          {ANO_SECTIONS.map((section) => {
            const sectionItems = groupedByAno[section.key] || [];
            const isCollapsed = !!collapsedSections[section.key];
            return (
              <div key={section.key} className="space-y-3">
                {/* Section header - accordion (sticky) */}
                <div className="flex items-center justify-between sticky top-0 z-10 bg-card py-2 -my-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-muted text-foreground dark:bg-[#1B4332] dark:text-primary transition-colors hover:bg-[#C1E4C9] dark:hover:bg-[#254A3A]"
                  >
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
                    onClick={() => handleAddResidente(section.key)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Adicionar
                  </Button>
                </div>

                {/* Residentes da seção */}
                {!isCollapsed && (
                  sectionItems.length > 0 ? (
                    <div className="space-y-3">
                      {sectionItems.map((residente) => (
                        <div
                          key={residente.id}
                          className="p-4 rounded-xl bg-background dark:bg-card border border-border relative"
                        >
                          {/* Botão de excluir */}
                          <button
                            type="button"
                            onClick={() => handleRemoveResidente(residente._originalIndex)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            aria-label="Excluir residente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Campos editáveis */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-10">
                            <Input
                              label="Nome Completo"
                              value={residente.nome || ''}
                              onChange={(e) => handleFieldChange(residente._originalIndex, 'nome', e.target.value)}
                              placeholder="Nome do residente"
                            />
                            <Input
                              label="Estágio"
                              value={residente.estagio || ''}
                              onChange={(e) => handleFieldChange(residente._originalIndex, 'estagio', e.target.value)}
                              placeholder="Ex: UTI Adulto"
                            />
                            <Input
                              label="Cirurgião"
                              value={residente.cirurgiao || ''}
                              onChange={(e) => handleFieldChange(residente._originalIndex, 'cirurgiao', e.target.value)}
                              placeholder="Ex: Roberto Silva"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      Nenhum residente nesta seção
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default EditEstagiosModal;
