/**
 * SobreavisoTradeRequestForm
 * Formulário de troca de sobreaviso materno com seleção visual via Calendar —
 * datas escaladas da solicitante (verde) e da destinatária (azul) marcadas.
 *   - Cobertura (unidirecional): só data do sobreaviso oferecido.
 *   - Swap bidirecional: + data desejada (destinatária deve estar escalada nessa data).
 *   - Funcionária logada: solicitante auto-preenchida.
 *   - Admin/coord: picker de solicitante visível.
 */
import { useState, useMemo, useEffect } from 'react';
import { Button, Calendar, Select, Textarea } from '@/design-system';
import {
  SOBREAVISO_MATERNO_2026,
  FUNCIONARIAS_SOBREAVISO,
  getDatasDaSobreavisista,
} from '../../data/sobreavisoMaterno2026';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToKey(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function keyToDate(key) {
  if (!key) return null;
  return new Date(`${key}T12:00:00`);
}

function formatDateKeyLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  const dt = keyToDate(key);
  const dow = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capDow = dow.charAt(0).toUpperCase() + dow.slice(1);
  return `${d}/${m}/${y} · ${capDow}`;
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
  const [dataSobreavisoKey, setDataSobreavisoKey] = useState('');
  const [dataDesejadaKey, setDataDesejadaKey] = useState('');
  const [descricao, setDescricao] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [errors, setErrors] = useState({});

  // Sincroniza com prop quando funcionária resolve (fix do bug de useState lazy init)
  useEffect(() => {
    if (userFuncionariaId) setSolicitanteFuncionariaId(userFuncionariaId);
  }, [userFuncionariaId]);

  const effectiveSolicitanteId = userFuncionariaId || solicitanteFuncionariaId;

  // Reset campos dependentes quando solicitante muda
  useEffect(() => {
    setDataSobreavisoKey('');
    setDataDesejadaKey('');
    setDestinatarioId('');
  }, [effectiveSolicitanteId]);

  // Datas em que solicitante está escalada
  const datasSolicitante = useMemo(
    () => getDatasDaSobreavisista(effectiveSolicitanteId, todayKey()),
    [effectiveSolicitanteId]
  );

  // Datas em que destinatária está escalada
  const datasDestinataria = useMemo(() => {
    if (!destinatarioId) return [];
    return getDatasDaSobreavisista(destinatarioId, todayKey()).filter((k) => k !== dataSobreavisoKey);
  }, [destinatarioId, dataSobreavisoKey]);

  const eventosSolicitante = useMemo(
    () => datasSolicitante.map((key) => ({
      date: keyToDate(key),
      label: 'Sobreaviso',
      color: '#34C759',
    })),
    [datasSolicitante]
  );

  const eventosDestinataria = useMemo(
    () => datasDestinataria.map((key) => ({
      date: keyToDate(key),
      label: 'Sobreaviso',
      color: '#3498DB',
    })),
    [datasDestinataria]
  );

  const solicitanteOptions = useMemo(
    () => [
      { value: '', label: 'Selecione a funcionária solicitante' },
      ...funcionarias.map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias]
  );

  const destinatarioOptions = useMemo(
    () => [
      { value: '', label: dataDesejadaKey ? 'Selecione a funcionária do dia desejado' : 'Qualquer funcionária' },
      ...funcionarias
        .filter((f) => f.id !== effectiveSolicitanteId)
        .map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias, effectiveSolicitanteId, dataDesejadaKey]
  );

  const validate = () => {
    const newErrors = {};
    if (!effectiveSolicitanteId) newErrors.solicitante = 'Selecione a funcionária solicitante';
    if (!dataSobreavisoKey) newErrors.dataSobreaviso = 'Escolha uma data marcada no calendário';
    if (!descricao || !descricao.trim()) newErrors.descricao = 'Informe o motivo da troca';
    if (dataDesejadaKey) {
      if (!destinatarioId) newErrors.destinatarioId = 'Selecione a destinatária';
      if (dataDesejadaKey === dataSobreavisoKey) newErrors.dataDesejada = 'Datas devem ser diferentes';
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
      dataDesejada: dataDesejadaKey || null,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: nomeFromId(destinatarioId),
    });
  };

  const isSwap = !!dataDesejadaKey;
  const showSolicitantePicker = isAdminOrCoord && !userFuncionariaId;

  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

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

      {/* Calendário com sobreavisos da solicitante */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Seu sobreaviso · toque na data desejada
        </label>
        {!effectiveSolicitanteId ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Selecione primeiro a funcionária solicitante.
            </p>
          </div>
        ) : datasSolicitante.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Nenhum sobreaviso futuro cadastrado para esta funcionária.
            </p>
          </div>
        ) : (
          <>
            <Calendar
              selected={keyToDate(dataSobreavisoKey)}
              onSelect={(d) => {
                const k = dateToKey(d);
                if (datasSolicitante.includes(k)) {
                  setDataSobreavisoKey(k);
                  if (errors.dataSobreaviso) setErrors((p) => ({ ...p, dataSobreaviso: '' }));
                }
              }}
              events={eventosSolicitante}
              minDate={minDate}
            />
            <p className="text-[11px] text-muted-foreground">
              Pontos verdes = seus sobreavisos. {dataSobreavisoKey && (
                <span className="text-foreground font-medium"> · Selecionada: {formatDateKeyLabel(dataSobreavisoKey)}</span>
              )}
            </p>
            {errors.dataSobreaviso && (
              <p className="text-xs text-destructive">{errors.dataSobreaviso}</p>
            )}
          </>
        )}
      </div>

      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={(val) => {
          setDestinatarioId(val);
          setDataDesejadaKey('');
          if (errors.destinatarioId) setErrors((prev) => ({ ...prev, destinatarioId: '' }));
        }}
        label={isSwap ? 'Funcionária a trocar com' : 'Destinatária (opcional)'}
        placeholder={isSwap ? 'Selecione a funcionária' : 'Qualquer funcionária'}
        error={errors.destinatarioId || undefined}
        disabled={loading}
      />

      {/* Calendário com sobreavisos da destinatária */}
      {destinatarioId && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Sobreaviso de {nomeFromId(destinatarioId)} (opcional)
          </label>
          {datasDestinataria.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum sobreaviso futuro para esta destinatária — apenas cobertura possível.
              </p>
            </div>
          ) : (
            <>
              <Calendar
                selected={keyToDate(dataDesejadaKey)}
                onSelect={(d) => {
                  const k = dateToKey(d);
                  if (k === dataDesejadaKey) {
                    setDataDesejadaKey('');
                    return;
                  }
                  if (datasDestinataria.includes(k)) {
                    setDataDesejadaKey(k);
                    if (errors.dataDesejada) setErrors((p) => ({ ...p, dataDesejada: '' }));
                  }
                }}
                events={eventosDestinataria}
                minDate={minDate}
              />
              <p className="text-[11px] text-muted-foreground">
                Pontos azuis = sobreavisos da destinatária. Toque para escolher · Toque novamente para cobertura sem swap.
                {dataDesejadaKey && (
                  <span className="text-foreground font-medium"> · Selecionada: {formatDateKeyLabel(dataDesejadaKey)}</span>
                )}
              </p>
              {errors.dataDesejada && (
                <p className="text-xs text-destructive">{errors.dataDesejada}</p>
              )}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {isSwap
          ? 'Troca bidirecional: vocês trocam os sobreavisos dessas datas.'
          : 'Cobertura: outra funcionária cobre seu sobreaviso (sem trocar em retorno).'}
      </p>

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
