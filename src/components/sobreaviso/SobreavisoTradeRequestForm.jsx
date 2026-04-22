/**
 * SobreavisoTradeRequestForm
 * Formulário simplificado para troca de sobreaviso materno.
 *
 * Fluxo:
 *   1. Solicitante (auto pelo login; admin/coord pode escolher)
 *   2. Dropdown "Meu sobreaviso" — lista cada sobreaviso da solicitante (data + horário)
 *   3. Destinatária (opcional)
 *   4. Dropdown "Sobreaviso dela" — lista (opcional, vira swap)
 *   5. Motivo
 */
import { useState, useMemo, useEffect } from 'react';
import { Button, Select, Textarea } from '@/design-system';
import {
  SOBREAVISO_MATERNO_2026,
  FUNCIONARIAS_SOBREAVISO,
  getDatasDaSobreavisista,
} from '../../data/sobreavisoMaterno2026';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  const dt = new Date(`${key}T12:00:00`);
  const dow = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const cap = dow.charAt(0).toUpperCase() + dow.slice(1);
  return `${d}/${m}/${y} (${cap}) · Sobreaviso 19h–07h`;
}

function nomeFromId(id) {
  return FUNCIONARIAS_SOBREAVISO.find((f) => f.id === id)?.nome || null;
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
  const [solicitanteFuncionariaId, setSolicitanteFuncionariaId] = useState('');
  const [meuSobreavisoKey, setMeuSobreavisoKey] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [sobreavisoDelaKey, setSobreavisoDelaKey] = useState('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState({});

  // Sincroniza com prop quando funcionária resolve (fix do useState lazy init)
  useEffect(() => {
    if (userFuncionariaId) setSolicitanteFuncionariaId(userFuncionariaId);
  }, [userFuncionariaId]);

  const effectiveSolicitanteId = userFuncionariaId || solicitanteFuncionariaId;

  // Reset quando solicitante muda
  useEffect(() => {
    setMeuSobreavisoKey('');
    setDestinatarioId('');
    setSobreavisoDelaKey('');
  }, [effectiveSolicitanteId]);

  const meusSobreavisos = useMemo(
    () => getDatasDaSobreavisista(effectiveSolicitanteId, todayKey()),
    [effectiveSolicitanteId]
  );

  const sobreavisosDela = useMemo(() => {
    if (!destinatarioId) return [];
    return getDatasDaSobreavisista(destinatarioId, todayKey()).filter((k) => k !== meuSobreavisoKey);
  }, [destinatarioId, meuSobreavisoKey]);

  const meuSobreavisoOptions = useMemo(() => {
    if (!effectiveSolicitanteId) {
      return [{ value: '', label: 'Selecione primeiro a funcionária' }];
    }
    if (meusSobreavisos.length === 0) {
      return [{ value: '', label: 'Nenhum sobreaviso futuro escalado' }];
    }
    return [
      { value: '', label: 'Selecione um sobreaviso seu' },
      ...meusSobreavisos.map((key) => ({ value: key, label: formatDateLabel(key) })),
    ];
  }, [effectiveSolicitanteId, meusSobreavisos]);

  const sobreavisoDelaOptions = useMemo(() => {
    if (!destinatarioId) {
      return [{ value: '', label: 'Selecione primeiro a destinatária' }];
    }
    if (sobreavisosDela.length === 0) {
      return [{ value: '', label: 'Sem sobreaviso para trocar — só cobertura' }];
    }
    return [
      { value: '', label: 'Selecionar troca' },
      ...sobreavisosDela.map((key) => ({ value: key, label: formatDateLabel(key) })),
    ];
  }, [destinatarioId, sobreavisosDela]);

  const solicitanteOptions = useMemo(
    () => [
      { value: '', label: 'Selecione a funcionária solicitante' },
      ...funcionarias.map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias]
  );

  const destinatarioOptions = useMemo(
    () => [
      { value: '', label: 'Selecione com quem trocar' },
      ...funcionarias
        .filter((f) => f.id !== effectiveSolicitanteId)
        .map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias, effectiveSolicitanteId]
  );

  const validate = () => {
    const e = {};
    if (!effectiveSolicitanteId) e.solicitante = 'Selecione a funcionária solicitante';
    if (!meuSobreavisoKey) e.meuSobreaviso = 'Escolha qual sobreaviso seu quer trocar';
    if (!descricao || !descricao.trim()) e.descricao = 'Informe o motivo da troca';
    if (sobreavisoDelaKey && !destinatarioId) e.destinatarioId = 'Selecione a destinatária';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    onSubmit?.({
      solicitanteFuncionariaIdOverride: isAdminOrCoord && !userFuncionariaId ? solicitanteFuncionariaId : null,
      dataSobreaviso: meuSobreavisoKey,
      dataDesejada: sobreavisoDelaKey || null,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: nomeFromId(destinatarioId),
    });
  };

  const showSolicitantePicker = isAdminOrCoord && !userFuncionariaId;
  const isSwap = !!sobreavisoDelaKey;

  const formContent = (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {showSolicitantePicker && (
        <Select
          options={solicitanteOptions}
          value={solicitanteFuncionariaId}
          onChange={(val) => {
            setSolicitanteFuncionariaId(val);
            if (errors.solicitante) setErrors((p) => ({ ...p, solicitante: '' }));
          }}
          label="Funcionária solicitante"
          placeholder="Selecione"
          error={errors.solicitante || undefined}
          disabled={loading}
        />
      )}

      <Select
        options={meuSobreavisoOptions}
        value={meuSobreavisoKey}
        onChange={(val) => {
          setMeuSobreavisoKey(val);
          if (errors.meuSobreaviso) setErrors((p) => ({ ...p, meuSobreaviso: '' }));
        }}
        label="Meu sobreaviso para trocar"
        placeholder="Selecione um sobreaviso seu"
        error={errors.meuSobreaviso || undefined}
        disabled={loading || !effectiveSolicitanteId}
      />

      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={(val) => {
          setDestinatarioId(val);
          setSobreavisoDelaKey('');
          if (errors.destinatarioId) setErrors((p) => ({ ...p, destinatarioId: '' }));
        }}
        label="Trocar com (opcional)"
        placeholder="Selecione a colega"
        error={errors.destinatarioId || undefined}
        disabled={loading}
      />

      {destinatarioId && (
        <Select
          options={sobreavisoDelaOptions}
          value={sobreavisoDelaKey}
          onChange={(val) => setSobreavisoDelaKey(val)}
          label={`Sobreaviso de ${nomeFromId(destinatarioId)} em troca (opcional)`}
          placeholder="Selecionar troca"
          disabled={loading}
        />
      )}

      <p className="text-xs text-muted-foreground">
        {isSwap
          ? 'Troca bidirecional: vocês trocam os sobreavisos entre si.'
          : destinatarioId
            ? 'Cobertura: ela cobre seu sobreaviso sem trocar em retorno.'
            : 'Sem destinatária: qualquer funcionária pode aceitar a cobertura.'}
      </p>

      <Textarea
        value={descricao}
        onChange={(val) => {
          setDescricao(val);
          if (errors.descricao) setErrors((p) => ({ ...p, descricao: '' }));
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
