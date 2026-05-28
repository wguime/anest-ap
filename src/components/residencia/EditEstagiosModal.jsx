/**
 * EditEstagiosModal
 * Modal para editar cirurgiões e, excepcionalmente, estágios do slot atual.
 * Data/turno são definidos automaticamente pelo relógio — não são editáveis aqui.
 * Estágio vem pré-preenchido da tabela estática 2026; override é por slot.
 */
import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input, useToast } from '@/design-system';
import { RotateCcw } from 'lucide-react';
import { getEstagiosParaData } from '@/data/residencia2026';

const ANO_SECTIONS = [
  { key: 'R1', label: 'R1' },
  { key: 'R2', label: 'R2' },
  { key: 'R3', label: 'R3' },
];

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde' };

function formatSlotLabel(cardData, cardTurno) {
  const parts = [];
  if (cardData) {
    const d = new Date(cardData + 'T12:00:00');
    parts.push(
      d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    );
  }
  if (cardTurno && TURNO_LABEL[cardTurno]) parts.push(TURNO_LABEL[cardTurno]);
  return parts.join(' · ');
}

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

  // Estado local: inputs de estagio/cirurgiao por residente
  const [edited, setEdited] = useState({});

  // Estágios base da tabela para este slot (para reset)
  const baseEstagios = useMemo(() => {
    if (!cardData) return {};
    const d = new Date(cardData + 'T12:00:00');
    const base = getEstagiosParaData(d);
    return Object.fromEntries(base.map((r) => [r.id, r.estagio || '']));
  }, [cardData]);

  useEffect(() => {
    if (!open) return;
    const initial = {};
    (residentes || []).forEach((r) => {
      initial[r.id] = {
        estagio: r.estagio || '',
        cirurgiao: r.cirurgiao || '',
      };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdited(initial);
  }, [open, residentes]);

  const groupedByAno = useMemo(() => {
    const grouped = { R1: [], R2: [], R3: [] };
    (residentes || []).forEach((r) => {
      const ano = r.ano || 'R1';
      if (!grouped[ano]) grouped[ano] = [];
      grouped[ano].push(r);
    });
    return grouped;
  }, [residentes]);

  const handleChange = (id, field, value) => {
    setEdited((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleRestore = (id) => {
    setEdited((prev) => ({
      ...prev,
      [id]: { ...prev[id], estagio: baseEstagios[id] || '' },
    }));
  };

  const handleSave = async () => {
    const cirurgiaos = {};
    const estagiosOverride = {};
    for (const [id, vals] of Object.entries(edited)) {
      if (vals.cirurgiao && vals.cirurgiao.trim()) {
        cirurgiaos[id] = vals.cirurgiao.trim();
      }
      if (vals.estagio && vals.estagio.trim()) {
        estagiosOverride[id] = vals.estagio.trim();
      }
    }

    const result = await onSave({ cirurgiaos, estagiosOverride });
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Estágios"
      description={formatSlotLabel(cardData, cardTurno) || 'Slot atual'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
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
          <div className="text-xs text-muted-foreground">
            Data e turno são automáticos (00h–12h · Manhã, 12h–19h · Tarde, 19h em diante · Manhã do dia seguinte). Edite o estágio apenas em caso de troca excepcional — o botão restaurar devolve o valor da tabela 2026.
          </div>

          {ANO_SECTIONS.map((section) => {
            const items = groupedByAno[section.key] || [];
            if (items.length === 0) return null;
            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-muted text-foreground">
                    {section.label}
                    <span className="opacity-60">({items.length})</span>
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((r) => {
                    const vals = edited[r.id] || { estagio: '', cirurgiao: '' };
                    const base = baseEstagios[r.id] || '';
                    const isOverride =
                      (vals.estagio || '').trim() !== '' &&
                      (vals.estagio || '').trim() !== base;
                    return (
                      <div
                        key={r.id}
                        className="p-4 rounded-xl bg-background dark:bg-card border border-border"
                      >
                        <div className="text-sm font-semibold text-black dark:text-white mb-3">
                          {r.nome}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Input
                                label="Estágio"
                                value={vals.estagio}
                                onChange={(e) =>
                                  handleChange(r.id, 'estagio', e.target.value)
                                }
                                placeholder="Ex: NEURO"
                              />
                            </div>
                            {isOverride && (
                              <button
                                type="button"
                                onClick={() => handleRestore(r.id)}
                                className="h-10 px-2 rounded-lg text-primary hover:bg-muted transition-colors inline-flex items-center gap-1 text-xs"
                                title={`Restaurar: ${base}`}
                                aria-label="Restaurar estágio"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar
                              </button>
                            )}
                          </div>
                          <Input
                            label="Cirurgião"
                            value={vals.cirurgiao}
                            onChange={(e) =>
                              handleChange(r.id, 'cirurgiao', e.target.value)
                            }
                            placeholder="Ex: Cunha"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default EditEstagiosModal;
