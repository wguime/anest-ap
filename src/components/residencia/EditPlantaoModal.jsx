/**
 * EditPlantaoModal
 * Editor simplificado — data e horário vêm da escala automática,
 * só o residente é editável (override por dia).
 */
import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal, Button, Select, useToast } from '@/design-system';
import { getPlantaoParaData } from '../../data/plantao2026';

function formatDataCard(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EditPlantaoModal({
  open,
  onClose,
  plantao,
  residentes = [],
  onSave,
  saving = false,
}) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (open && plantao?.residenteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(plantao.residenteId);
    }
  }, [open, plantao?.residenteId]);

  const baseResidente = plantao?.data
    ? getPlantaoParaData(new Date(`${plantao.data}T12:00:00`))
    : null;
  const baseId = baseResidente?.id || '';
  const isOverridden = selectedId && selectedId !== baseId;

  const residenteOptions = residentes.map((r) => ({
    value: r.id,
    label: `${r.nome} (${r.ano})`,
  }));

  const handleRestore = () => {
    if (baseId) setSelectedId(baseId);
  };

  const handleSave = async () => {
    if (!selectedId) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um residente',
        variant: 'warning',
      });
      return;
    }

    const result = await onSave({ residenteId: selectedId });
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

  const handleCancel = () => {
    if (plantao?.residenteId) setSelectedId(plantao.residenteId);
    onClose();
  };

  const residenteSelecionado = residentes.find((r) => r.id === selectedId);

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Editar Plantão"
      description={`${formatDataCard(plantao?.data)}${plantao?.hora ? ` · ${plantao.hora}` : ''}`}
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
          {/* Info do plantão (read-only) */}
          <div className="p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Data</p>
            <p className="text-[15px] font-semibold text-foreground capitalize">
              {formatDataCard(plantao?.data) || '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Horário: <span className="font-semibold text-foreground">{plantao?.hora || '—'}</span>
              {plantao?.duracao ? <span className="ml-2 text-muted-foreground">({plantao.duracao}h)</span> : null}
            </p>
          </div>

          {/* Residente de plantão */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Residente de plantão</label>
              {isOverridden && baseId && (
                <button
                  type="button"
                  onClick={handleRestore}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar da escala
                </button>
              )}
            </div>
            <Select
              value={selectedId}
              onChange={(value) => setSelectedId(value)}
              options={residenteOptions}
              placeholder="Selecione o residente"
            />
            {baseResidente && (
              <p className="text-xs text-muted-foreground">
                Escala: <span className="font-medium">{baseResidente.nome}</span> ({baseResidente.ano})
                {isOverridden && <span className="ml-2 text-warning">· substituído</span>}
              </p>
            )}
          </div>

          {/* Preview */}
          {residenteSelecionado && (
            <div className="mt-2 p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-muted text-foreground dark:bg-muted dark:text-primary">
                  {residenteSelecionado.ano}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {residenteSelecionado.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDataCard(plantao?.data)}
                  </p>
                </div>
                <span className="text-base font-bold text-[#9BC53D] dark:text-primary">
                  {plantao?.hora || '—'}
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
