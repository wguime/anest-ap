/**
 * SobreavisoTradeRequestForm
 * Formulário para solicitar troca de sobreaviso materno.
 *   - Cobertura (unidirecional): só data do sobreaviso oferecido.
 *   - Swap bidirecional: + data desejada (requer destinatária escalada nessa data).
 *
 * Regras:
 *   - Funcionária logada: solicitante auto-preenchido, picker oculto.
 *   - Admin/coord: picker de solicitante visível.
 *   - "Sobreaviso que quer trocar": Select com apenas as datas futuras da
 *     funcionária solicitante (não um DatePicker livre).
 *
 * Form sem botões — caller (Modal) monta via footer com `type="submit" form={formId}`.
 */
import { useState, useMemo, useEffect } from 'react';
import { Button, DatePicker, Select, Textarea } from '@/design-system';
import { SOBREAVISO_MATERNO_2026, FUNCIONARIAS_SOBREAVISO } from '../../data/sobreavisoMaterno2026';

function toDateKey(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateKeyLabel(key) {
  const [y, m, d] = key.split('-');
  const dt = new Date(`${key}T12:00:00`);
  const dow = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capDow = dow.charAt(0).toUpperCase() + dow.slice(1);
  return `${d}/${m}/${y} · ${capDow}`;
}

function SobreavisoTradeRequestForm({
  formId,
  onSubmit,
  onCancel,
  funcionarias = FUNCIONARIAS_SOBREAVISO,
  userFuncionariaId = null,
  isAdminOrCoord = false,
  loading = false,
  inline = false,
}) {
  const [solicitanteFuncionariaId, setSolicitanteFuncionariaId] = useState(userFuncionariaId || '');
  const [dataSobreavisoKey, setDataSobreavisoKey] = useState('');
  const [dataDesejada, setDataDesejada] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [errors, setErrors] = useState({});

  const effectiveSolicitanteId = userFuncionariaId || solicitanteFuncionariaId;

  // Se a funcionária solicitante muda (admin picker), zera as datas já escolhidas
  useEffect(() => {
    setDataSobreavisoKey('');
  }, [effectiveSolicitanteId]);

  const dataDesejadaKey = toDateKey(dataDesejada);
  const funcionariaDaDataDesejada = dataDesejadaKey ? SOBREAVISO_MATERNO_2026[dataDesejadaKey] : null;

  const solicitanteOptions = useMemo(
    () => [
      { value: '', label: 'Selecione a funcionária solicitante' },
      ...funcionarias.map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias]
  );

  // Datas futuras da solicitante (ordenadas asc) — a partir de hoje
  const dataSobreavisoOptions = useMemo(() => {
    if (!effectiveSolicitanteId) {
      return [{ value: '', label: 'Selecione primeiro a funcionária solicitante' }];
    }
    const todayKey = toDateKey(new Date());
    const myDates = Object.entries(SOBREAVISO_MATERNO_2026)
      .filter(([key, id]) => id === effectiveSolicitanteId && key >= todayKey)
      .map(([key]) => key)
      .sort();
    if (myDates.length === 0) {
      return [{ value: '', label: 'Nenhum sobreaviso futuro cadastrado' }];
    }
    return [
      { value: '', label: 'Selecione seu sobreaviso' },
      ...myDates.map((key) => ({ value: key, label: formatDateKeyLabel(key) })),
    ];
  }, [effectiveSolicitanteId]);

  const destinatarioOptions = useMemo(
    () => [
      { value: '', label: dataDesejadaKey ? 'Selecione a funcionária do dia desejado' : 'Qualquer funcionária' },
      ...funcionarias
        .filter((f) => f.id !== effectiveSolicitanteId)
        .map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias, effectiveSolicitanteId, dataDesejadaKey]
  );

  const funcionariaSelecionada = funcionarias.find((f) => f.id === destinatarioId);

  const validate = () => {
    const newErrors = {};
    if (!effectiveSolicitanteId) newErrors.solicitante = 'Selecione a funcionária solicitante';
    if (!dataSobreavisoKey) newErrors.dataSobreaviso = 'Escolha o sobreaviso que quer trocar';
    if (!descricao || !descricao.trim()) newErrors.descricao = 'Informe o motivo da troca';

    if (dataDesejada) {
      if (!destinatarioId) {
        newErrors.destinatarioId = 'Selecione a funcionária para trocar';
      } else if (funcionariaDaDataDesejada && funcionariaDaDataDesejada !== destinatarioId) {
        newErrors.destinatarioId = 'Destinatária não está escalada na data desejada';
      }
      if (dataSobreavisoKey && toDateKey(dataDesejada) === dataSobreavisoKey) {
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
      solicitanteFuncionariaIdOverride: isAdminOrCoord && !userFuncionariaId ? solicitanteFuncionariaId : null,
      dataSobreaviso: dataSobreavisoKey,
      dataDesejada: dataDesejada ? toDateKey(dataDesejada) : null,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: funcionariaSelecionada?.nome || null,
    });
  };

  const isSwap = !!dataDesejada;
  // Apenas admin/coord vê o picker de solicitante — funcionárias usam o próprio login.
  const showSolicitantePicker = isAdminOrCoord && !userFuncionariaId;

  const formContent = (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {showSolicitantePicker && (
        <Select
          options={solicitanteOptions}
          value={solicitanteFuncionariaId}
          onChange={(val) => {
            setSolicitanteFuncionariaId(val);
            setDestinatarioId('');
            if (errors.solicitante) setErrors((prev) => ({ ...prev, solicitante: '' }));
          }}
          label="Funcionária solicitante"
          placeholder="Selecione"
          error={errors.solicitante || undefined}
          disabled={loading}
        />
      )}

      <Select
        options={dataSobreavisoOptions}
        value={dataSobreavisoKey}
        onChange={(val) => {
          setDataSobreavisoKey(val);
          if (errors.dataSobreaviso) setErrors((prev) => ({ ...prev, dataSobreaviso: '' }));
        }}
        label="Sobreaviso que quer trocar"
        placeholder="Selecione seu sobreaviso"
        error={errors.dataSobreaviso || undefined}
        disabled={loading || !effectiveSolicitanteId}
      />

      <div className="space-y-1">
        <DatePicker
          value={dataDesejada}
          onChange={(date) => {
            setDataDesejada(date);
            if (errors.dataDesejada) setErrors((prev) => ({ ...prev, dataDesejada: '' }));
            const key = toDateKey(date);
            if (key && SOBREAVISO_MATERNO_2026[key]) {
              setDestinatarioId(SOBREAVISO_MATERNO_2026[key]);
            } else if (!date) {
              setDestinatarioId('');
            }
          }}
          label="Sobreaviso que quer no lugar (opcional)"
          placeholder="Escolha para trocar; deixe vazio para só pedir cobertura"
          error={errors.dataDesejada || undefined}
          disabled={loading}
          minDate={new Date()}
        />
        <p className="text-xs text-muted-foreground">
          {isSwap
            ? 'Troca bidirecional: vocês trocam os sobreavisos dessas datas.'
            : 'Cobertura: outra funcionária cobre seu sobreaviso (sem trocar em retorno).'}
        </p>
      </div>

      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={(val) => {
          setDestinatarioId(val);
          if (errors.destinatarioId) setErrors((prev) => ({ ...prev, destinatarioId: '' }));
        }}
        label={isSwap ? 'Funcionária a trocar com' : 'Destinatária (opcional)'}
        placeholder={isSwap ? 'Selecione a funcionária' : 'Qualquer funcionária'}
        error={errors.destinatarioId || undefined}
        disabled={loading}
      />

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
          Nova Solicitação de Troca de Sobreaviso
        </h3>
        {formContent}
      </div>
    );
  }

  return formContent;
}

export default SobreavisoTradeRequestForm;
