/**
 * EditSobreavisoModal
 * Admin edita a funcionária de sobreaviso do dia (override por data).
 */
import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal, Button, Select, useToast } from '@/design-system';
import { getSobreavisoParaData } from '../../data/sobreavisoMaterno2026';

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

export function EditSobreavisoModal({
  open,
  onClose,
  sobreaviso,
  funcionarias = [],
  onSave,
  saving = false,
}) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (open && sobreaviso?.funcionariaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(sobreaviso.funcionariaId);
    }
  }, [open, sobreaviso?.funcionariaId]);

  const baseFuncionaria = sobreaviso?.data
    ? getSobreavisoParaData(new Date(`${sobreaviso.data}T12:00:00`))
    : null;
  const baseId = baseFuncionaria?.id || '';
  const isOverridden = selectedId && selectedId !== baseId;

  const funcionariaOptions = funcionarias.map((f) => ({
    value: f.id,
    label: f.nome,
  }));

  const handleRestore = () => {
    if (baseId) setSelectedId(baseId);
  };

  const handleSave = async () => {
    if (!selectedId) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione uma funcionária',
        variant: 'warning',
      });
      return;
    }

    const result = await onSave({ funcionariaId: selectedId });
    if (result.success) {
      toast({
        title: 'Salvo',
        description: 'Sobreaviso atualizado com sucesso',
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
    if (sobreaviso?.funcionariaId) setSelectedId(sobreaviso.funcionariaId);
    onClose();
  };

  const funcionariaSelecionada = funcionarias.find((f) => f.id === selectedId);

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Editar Sobreaviso Materno"
      description={`${formatDataCard(sobreaviso?.data)}${sobreaviso?.horario ? ` · ${sobreaviso.horario}` : ''}`}
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
          <div className="p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Data</p>
            <p className="text-[15px] font-semibold text-foreground capitalize">
              {formatDataCard(sobreaviso?.data) || '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Horário: <span className="font-semibold text-foreground">{sobreaviso?.horario || '—'}</span>
              {sobreaviso?.duracao ? <span className="ml-2 text-muted-foreground">({sobreaviso.duracao}h)</span> : null}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Funcionária de sobreaviso</label>
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
              options={funcionariaOptions}
              placeholder="Selecione a funcionária"
            />
            {baseFuncionaria && (
              <p className="text-xs text-muted-foreground">
                Escala: <span className="font-medium">{baseFuncionaria.nome}</span>
                {isOverridden && <span className="ml-2 text-warning">· substituída</span>}
              </p>
            )}
          </div>

          {funcionariaSelecionada && (
            <div className="mt-2 p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-muted text-foreground dark:bg-muted dark:text-primary">
                  {funcionariaSelecionada.nome?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {funcionariaSelecionada.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDataCard(sobreaviso?.data)}
                  </p>
                </div>
                <span className="text-base font-bold text-greenLight dark:text-primary">
                  {sobreaviso?.horario || '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default EditSobreavisoModal;
