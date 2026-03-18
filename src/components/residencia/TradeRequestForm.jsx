/**
 * TradeRequestForm
 * Formulário para solicitar troca de plantão.
 * Usado inline no chat (com card wrapper) e dentro de Modal na TrocasPlantaoPage (sem wrapper).
 */
import { useState, useMemo } from 'react';
import { Button, DatePicker, Select, Textarea } from '@/design-system';

function TradeRequestForm({ onSubmit, onCancel, residentes = [], loading = false, inline = false }) {
  const [dataPlantao, setDataPlantao] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [errors, setErrors] = useState({});

  const residentesComNome = residentes.filter(r => r.nome && r.nome.trim() !== '');
  const residenteSelecionado = residentesComNome.find(r => r.id === destinatarioId);

  const destinatarioOptions = useMemo(() => [
    { value: '', label: 'Qualquer residente' },
    ...residentesComNome.map(r => ({ value: r.id, label: r.nome })),
  ], [residentesComNome]);

  const validate = () => {
    const newErrors = {};
    if (!dataPlantao) newErrors.dataPlantao = 'Informe a data do plantão';
    if (!descricao || !descricao.trim()) newErrors.descricao = 'Informe o motivo da troca';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Convert Date to YYYY-MM-DD string for API
    const y = dataPlantao.getFullYear();
    const m = String(dataPlantao.getMonth() + 1).padStart(2, '0');
    const d = String(dataPlantao.getDate()).padStart(2, '0');

    onSubmit?.({
      dataPlantao: `${y}-${m}-${d}`,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: residenteSelecionado?.nome || null,
    });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Data do Plantão */}
      <DatePicker
        value={dataPlantao}
        onChange={(date) => {
          setDataPlantao(date);
          if (errors.dataPlantao) setErrors(prev => ({ ...prev, dataPlantao: '' }));
        }}
        label="Data do Plantão"
        placeholder="Selecione a data"
        error={errors.dataPlantao || undefined}
        disabled={loading}
        minDate={new Date()}
      />

      {/* Destinatário (opcional) */}
      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={setDestinatarioId}
        label="Destinatário (opcional)"
        placeholder="Qualquer residente"
        disabled={loading}
      />

      {/* Motivo da Troca */}
      <Textarea
        value={descricao}
        onChange={(val) => {
          setDescricao(val);
          if (errors.descricao) setErrors(prev => ({ ...prev, descricao: '' }));
        }}
        label="Motivo da Troca"
        placeholder="Ex: Preciso trocar por compromisso pessoal..."
        rows={3}
        maxLength={200}
        showCount
        resize="none"
        error={errors.descricao || undefined}
        disabled={loading}
      />

      {/* Botões */}
      <div className="flex items-center gap-3 pt-3">
        <Button
          type="submit"
          variant="default"
          size="default"
          className="flex-[2]"
          loading={loading}
        >
          Solicitar Troca
        </Button>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );

  // Inline mode: wrap in a card (used inside the chat)
  if (inline) {
    return (
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-sm dark:shadow-none mx-4 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2.5">
          Nova Solicitação de Troca
        </h3>
        {formContent}
      </div>
    );
  }

  // Modal mode: no wrapper, the Modal provides the card
  return formContent;
}

export default TradeRequestForm;
