/**
 * TradeRequestForm
 * Formulário para solicitar troca de plantão.
 * Modos suportados:
 *   - Cobertura (unidirecional): só data do plantão oferecido (dataDesejada vazia).
 *   - Troca bidirecional: + data desejada (requer destinatário, auto-selecionado).
 *
 * O form NÃO inclui botões — quem renderiza (Modal) é responsável por eles
 * via footer/Button com `type="submit" form={formId}`.
 */
import { useState, useMemo } from 'react';
import { Button, DatePicker, Select, Textarea } from '@/design-system';
import { PLANTOES_2026 } from '../../data/plantao2026';

function toDateKey(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function TradeRequestForm({
  formId,
  onSubmit,
  onCancel,
  residentes = [],
  userResidenteId = null,
  loading = false,
  inline = false,
}) {
  const [dataPlantao, setDataPlantao] = useState(null);
  const [dataDesejada, setDataDesejada] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [errors, setErrors] = useState({});

  const residentesComNome = residentes.filter((r) => r.nome && r.nome.trim() !== '');

  const dataDesejadaKey = toDateKey(dataDesejada);
  const plantonistaDaDataDesejada = dataDesejadaKey ? PLANTOES_2026[dataDesejadaKey] : null;

  const destinatarioOptions = useMemo(
    () => [
      { value: '', label: dataDesejadaKey ? 'Selecione o residente do dia desejado' : 'Qualquer residente' },
      ...residentesComNome
        .filter((r) => r.id !== userResidenteId)
        .map((r) => ({ value: r.id, label: `${r.nome} (${r.ano})` })),
    ],
    [residentesComNome, userResidenteId, dataDesejadaKey]
  );

  const residenteSelecionado = residentesComNome.find((r) => r.id === destinatarioId);

  const validate = () => {
    const newErrors = {};
    if (!dataPlantao) newErrors.dataPlantao = 'Informe a data do plantão';
    if (!descricao || !descricao.trim()) newErrors.descricao = 'Informe o motivo da troca';

    if (dataDesejada) {
      if (!destinatarioId) {
        newErrors.destinatarioId = 'Selecione o residente para trocar';
      } else if (plantonistaDaDataDesejada && plantonistaDaDataDesejada !== destinatarioId) {
        newErrors.destinatarioId = 'Destinatário não está de plantão na data desejada';
      }
      if (dataPlantao && dataDesejada && toDateKey(dataPlantao) === toDateKey(dataDesejada)) {
        newErrors.dataDesejada = 'Datas devem ser diferentes';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit?.({
      dataPlantao: toDateKey(dataPlantao),
      dataDesejada: dataDesejada ? toDateKey(dataDesejada) : null,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: residenteSelecionado?.nome || null,
    });
  };

  const isSwap = !!dataDesejada;

  const formContent = (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {/* 1. Plantão oferecido pelo solicitante */}
      <DatePicker
        value={dataPlantao}
        onChange={(date) => {
          setDataPlantao(date);
          if (errors.dataPlantao) setErrors((prev) => ({ ...prev, dataPlantao: '' }));
        }}
        label="Seu plantão que quer trocar"
        placeholder="Selecione a data"
        error={errors.dataPlantao || undefined}
        disabled={loading}
        minDate={new Date()}
      />

      {/* 2. Plantão que quer no lugar (swap bidirecional) */}
      <div className="space-y-1">
        <DatePicker
          value={dataDesejada}
          onChange={(date) => {
            setDataDesejada(date);
            if (errors.dataDesejada) setErrors((prev) => ({ ...prev, dataDesejada: '' }));
            // Auto-preenche destinatário com quem está escalado nessa data
            const key = toDateKey(date);
            if (key && PLANTOES_2026[key]) {
              setDestinatarioId(PLANTOES_2026[key]);
            } else if (!date) {
              setDestinatarioId('');
            }
          }}
          label="Plantão que quer no lugar (opcional)"
          placeholder="Escolha para trocar; deixe vazio para só pedir cobertura"
          error={errors.dataDesejada || undefined}
          disabled={loading}
          minDate={new Date()}
        />
        <p className="text-xs text-muted-foreground">
          {isSwap
            ? 'Troca bidirecional: vocês trocam os plantões dessas datas.'
            : 'Cobertura: outro residente cobre seu plantão (sem trocar em troca).'}
        </p>
      </div>

      {/* 3. Destinatário */}
      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={(val) => {
          setDestinatarioId(val);
          if (errors.destinatarioId) setErrors((prev) => ({ ...prev, destinatarioId: '' }));
        }}
        label={isSwap ? 'Residente a trocar com' : 'Destinatário (opcional)'}
        placeholder={isSwap ? 'Selecione o residente' : 'Qualquer residente'}
        error={errors.destinatarioId || undefined}
        disabled={loading}
      />

      {/* 4. Motivo */}
      <Textarea
        value={descricao}
        onChange={(val) => {
          setDescricao(val);
          if (errors.descricao) setErrors((prev) => ({ ...prev, descricao: '' }));
        }}
        label="Motivo da troca"
        placeholder="Ex: Preciso trocar por compromisso pessoal..."
        rows={3}
        maxLength={200}
        showCount
        resize="none"
        error={errors.descricao || undefined}
        disabled={loading}
      />

      {/* Botões só aparecem em modo inline (chat). No Modal, o caller monta no footer. */}
      {inline && (
        <div className="flex items-center gap-3 pt-3">
          <Button type="submit" variant="default" className="flex-[2]" loading={loading}>
            Solicitar
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        </div>
      )}
    </form>
  );

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

  return formContent;
}

export default TradeRequestForm;
