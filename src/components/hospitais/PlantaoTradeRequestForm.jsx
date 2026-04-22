/**
 * PlantaoTradeRequestForm
 * Formulário de troca de plantão hospitalar (FDS/feriado) com seleção visual
 * via Calendar — datas escaladas da solicitante (verde) e da destinatária (azul)
 * são marcadas no calendário. Inspirado no fluxo do app Pega Plantão.
 *   - Escopo 'slot': troca um slot específico (hospital + turno).
 *   - Escopo 'dia':  troca todos os slots da data.
 *   - Cobertura: só dataPlantao.
 *   - Swap bidirecional: + dataDesejada (slot desejado se escopo='slot').
 */
import { useState, useMemo, useEffect } from 'react';
import { Button, Calendar, Select, Textarea } from '@/design-system';
import {
  HOSPITAIS_2026,
  FUNCIONARIAS_HOSPITAIS,
  getDatasDaFuncionariaHospitais,
  getSlotsFuncionariaNaData,
} from '../../data/hospitaisTecnicas2026';
import { useHospitaisOverrides } from '../../hooks/useHospitaisOverrides';

const HOSPITAIS = [
  { value: 'hro', label: 'HRO (07h–15h)', turno: 'manha' },
  { value: 'unimed', label: 'UNIMED (07h–15h)', turno: 'manha' },
  { value: 'plantao_pago', label: 'Plantão Pago (15h–23h)', turno: 'tarde' },
];

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

function formatDateLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  const dt = keyToDate(key);
  const dow = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap = dow.charAt(0).toUpperCase() + dow.slice(1);
  const label = HOSPITAIS_2026[key]?.label;
  return `${d}/${m}/${y} · ${cap}${label ? ` · ${label}` : ''}`;
}

function nomeFromId(id) {
  return FUNCIONARIAS_HOSPITAIS.find((f) => f.id === id)?.nome || null;
}

function PlantaoTradeRequestForm({
  formId,
  onSubmit,
  onCancel,
  funcionarias = FUNCIONARIAS_HOSPITAIS,
  userFuncionariaId = null,
  isAdminOrCoord = false,
  loading = false,
  inline = false,
}) {
  const { overrides: hospitaisOverrides } = useHospitaisOverrides();

  const [solicitanteFuncionariaId, setSolicitanteFuncionariaId] = useState('');
  const [escopo, setEscopo] = useState('slot');
  const [dataPlantao, setDataPlantao] = useState('');
  const [hospital, setHospital] = useState('');
  const [dataDesejada, setDataDesejada] = useState('');
  const [hospitalDesejado, setHospitalDesejado] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState({});

  // Sincroniza estado com prop quando funcionária resolve (fix de useState lazy init)
  useEffect(() => {
    if (userFuncionariaId) setSolicitanteFuncionariaId(userFuncionariaId);
  }, [userFuncionariaId]);

  const effectiveSolicitanteId = userFuncionariaId || solicitanteFuncionariaId;

  // Reset de campos dependentes quando muda solicitante ou escopo
  useEffect(() => {
    setDataPlantao('');
    setHospital('');
    setDataDesejada('');
    setHospitalDesejado('');
    setDestinatarioId('');
  }, [effectiveSolicitanteId, escopo]);

  // Datas em que solicitante está escalada
  const datasSolicitante = useMemo(() => {
    if (!effectiveSolicitanteId) return [];
    return getDatasDaFuncionariaHospitais(effectiveSolicitanteId, todayKey(), hospitaisOverrides);
  }, [effectiveSolicitanteId, hospitaisOverrides]);

  // Datas em que destinatária está escalada (futuras, ≠ dataPlantao)
  const datasDestinataria = useMemo(() => {
    if (!destinatarioId) return [];
    return getDatasDaFuncionariaHospitais(destinatarioId, todayKey(), hospitaisOverrides)
      .filter((k) => k !== dataPlantao);
  }, [destinatarioId, dataPlantao, hospitaisOverrides]);

  // Eventos para o Calendar da solicitante (datas escaladas em verde)
  const eventosSolicitante = useMemo(
    () => datasSolicitante.map((key) => ({
      date: keyToDate(key),
      label: 'Escalada',
      color: '#34C759',
    })),
    [datasSolicitante]
  );

  const eventosDestinataria = useMemo(
    () => datasDestinataria.map((key) => ({
      date: keyToDate(key),
      label: 'Escalada',
      color: '#3498DB',
    })),
    [datasDestinataria]
  );

  // Slots da solicitante na data escolhida
  const hospitalOptions = useMemo(() => {
    if (!dataPlantao || !effectiveSolicitanteId) {
      return [{ value: '', label: 'Selecione primeiro a data' }];
    }
    const slots = getSlotsFuncionariaNaData(effectiveSolicitanteId, dataPlantao, hospitaisOverrides);
    if (slots.length === 0) return [{ value: '', label: 'Você não está escalada nesta data' }];
    return [
      { value: '', label: 'Selecione o slot' },
      ...slots.map((s) => {
        const meta = HOSPITAIS.find((h) => h.value === s.hospital);
        return { value: s.hospital, label: meta?.label || s.hospital };
      }),
    ];
  }, [dataPlantao, effectiveSolicitanteId, hospitaisOverrides]);

  // Slots da destinatária na data desejada
  const hospitalDesejadoOptions = useMemo(() => {
    if (!dataDesejada || !destinatarioId) {
      return [{ value: '', label: 'Selecione primeiro a data desejada' }];
    }
    const slots = getSlotsFuncionariaNaData(destinatarioId, dataDesejada, hospitaisOverrides);
    if (slots.length === 0) return [{ value: '', label: 'Destinatária não está escalada' }];
    return [
      { value: '', label: 'Selecione o slot desejado' },
      ...slots.map((s) => {
        const meta = HOSPITAIS.find((h) => h.value === s.hospital);
        return { value: s.hospital, label: meta?.label || s.hospital };
      }),
    ];
  }, [dataDesejada, destinatarioId, hospitaisOverrides]);

  const solicitanteOptions = useMemo(
    () => [
      { value: '', label: 'Selecione a funcionária solicitante' },
      ...funcionarias.map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias]
  );

  const destinatarioOptions = useMemo(
    () => [
      { value: '', label: 'Qualquer funcionária' },
      ...funcionarias
        .filter((f) => f.id !== effectiveSolicitanteId)
        .map((f) => ({ value: f.id, label: f.nome })),
    ],
    [funcionarias, effectiveSolicitanteId]
  );

  const validate = () => {
    const e = {};
    if (!effectiveSolicitanteId) e.solicitante = 'Selecione a funcionária solicitante';
    if (!dataPlantao) e.dataPlantao = 'Escolha uma data marcada no calendário';
    if (escopo === 'slot' && !hospital) e.hospital = 'Selecione o slot (hospital/turno)';
    if (!descricao || !descricao.trim()) e.descricao = 'Informe o motivo da troca';
    if (dataDesejada) {
      if (!destinatarioId) e.destinatarioId = 'Selecione a destinatária';
      if (escopo === 'slot' && !hospitalDesejado) e.hospitalDesejado = 'Selecione o slot desejado';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const hospitalMeta = HOSPITAIS.find((h) => h.value === hospital);
    const hospitalDesejadoMeta = HOSPITAIS.find((h) => h.value === hospitalDesejado);
    onSubmit?.({
      solicitanteFuncionariaIdOverride: isAdminOrCoord && !userFuncionariaId ? solicitanteFuncionariaId : null,
      escopo,
      dataPlantao,
      hospital: escopo === 'slot' ? hospital : null,
      turno: escopo === 'slot' ? hospitalMeta?.turno || null : null,
      dataDesejada: dataDesejada || null,
      hospitalDesejado: dataDesejada && escopo === 'slot' ? hospitalDesejado : null,
      turnoDesejado: dataDesejada && escopo === 'slot' ? hospitalDesejadoMeta?.turno || null : null,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: nomeFromId(destinatarioId),
    });
  };

  const showSolicitantePicker = isAdminOrCoord && !userFuncionariaId;
  const isSwap = !!dataDesejada;

  // Min date para o calendar (hoje)
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
            if (errors.solicitante) setErrors((p) => ({ ...p, solicitante: '' }));
          }}
          label="Funcionária solicitante"
          placeholder="Selecione"
          error={errors.solicitante || undefined}
          disabled={loading}
        />
      )}

      {/* Toggle escopo */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">O que você quer trocar?</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEscopo('slot')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              escopo === 'slot'
                ? 'bg-primary text-white dark:text-black border-primary'
                : 'bg-card text-foreground border-border'
            }`}
            disabled={loading}
          >
            Slot específico
          </button>
          <button
            type="button"
            onClick={() => setEscopo('dia')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              escopo === 'dia'
                ? 'bg-primary text-white dark:text-black border-primary'
                : 'bg-card text-foreground border-border'
            }`}
            disabled={loading}
          >
            Dia inteiro
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {escopo === 'slot'
            ? 'Troca apenas um plantão (hospital + turno).'
            : 'Troca todos os plantões do dia em que você está escalada.'}
        </p>
      </div>

      {/* Calendário com plantões da solicitante */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Seu plantão · toque na data desejada
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
              Nenhum plantão hospitalar futuro cadastrado para esta funcionária.
            </p>
          </div>
        ) : (
          <>
            <Calendar
              selected={keyToDate(dataPlantao)}
              onSelect={(d) => {
                const k = dateToKey(d);
                if (datasSolicitante.includes(k)) {
                  setDataPlantao(k);
                  setHospital('');
                  if (errors.dataPlantao) setErrors((p) => ({ ...p, dataPlantao: '' }));
                }
              }}
              events={eventosSolicitante}
              minDate={minDate}
              disabledDates={[]}
            />
            <p className="text-[11px] text-muted-foreground">
              Pontos verdes = datas em que você está escalada. {dataPlantao && (
                <span className="text-foreground font-medium"> · Selecionada: {formatDateLabel(dataPlantao)}</span>
              )}
            </p>
            {errors.dataPlantao && (
              <p className="text-xs text-destructive">{errors.dataPlantao}</p>
            )}
          </>
        )}
      </div>

      {escopo === 'slot' && dataPlantao && (
        <Select
          options={hospitalOptions}
          value={hospital}
          onChange={(val) => {
            setHospital(val);
            if (errors.hospital) setErrors((p) => ({ ...p, hospital: '' }));
          }}
          label="Hospital / Turno"
          placeholder="Selecione o slot"
          error={errors.hospital || undefined}
          disabled={loading}
        />
      )}

      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={(val) => {
          setDestinatarioId(val);
          setDataDesejada('');
          setHospitalDesejado('');
          if (errors.destinatarioId) setErrors((p) => ({ ...p, destinatarioId: '' }));
        }}
        label="Destinatária (opcional)"
        placeholder="Qualquer funcionária"
        error={errors.destinatarioId || undefined}
        disabled={loading}
      />

      {/* Calendário com plantões da destinatária — só após escolher destinatária */}
      {destinatarioId && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Plantão de {nomeFromId(destinatarioId)} que você quer (opcional)
          </label>
          {datasDestinataria.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum plantão futuro cadastrado para esta destinatária — apenas cobertura possível.
              </p>
            </div>
          ) : (
            <>
              <Calendar
                selected={keyToDate(dataDesejada)}
                onSelect={(d) => {
                  const k = dateToKey(d);
                  if (k === dataDesejada) {
                    setDataDesejada('');
                    setHospitalDesejado('');
                    return;
                  }
                  if (datasDestinataria.includes(k)) {
                    setDataDesejada(k);
                    setHospitalDesejado('');
                  }
                }}
                events={eventosDestinataria}
                minDate={minDate}
              />
              <p className="text-[11px] text-muted-foreground">
                Pontos azuis = plantões da destinatária. Toque para escolher · Toque novamente para cobertura sem swap.
                {dataDesejada && (
                  <span className="text-foreground font-medium"> · Selecionada: {formatDateLabel(dataDesejada)}</span>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {dataDesejada && escopo === 'slot' && (
        <Select
          options={hospitalDesejadoOptions}
          value={hospitalDesejado}
          onChange={(val) => {
            setHospitalDesejado(val);
            if (errors.hospitalDesejado) setErrors((p) => ({ ...p, hospitalDesejado: '' }));
          }}
          label="Slot desejado"
          placeholder="Selecione o slot"
          error={errors.hospitalDesejado || undefined}
          disabled={loading}
        />
      )}

      <p className="text-xs text-muted-foreground">
        {isSwap
          ? 'Troca bidirecional: vocês trocam os plantões dessas datas.'
          : 'Cobertura: outra funcionária assume seu plantão (sem trocar em retorno).'}
      </p>

      <Textarea
        value={descricao}
        onChange={(val) => {
          setDescricao(val);
          if (errors.descricao) setErrors((p) => ({ ...p, descricao: '' }));
        }}
        label="Motivo da troca"
        placeholder="Ex: Compromisso pessoal..."
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
          Nova Solicitação de Troca de Plantão
        </h3>
        {formContent}
      </div>
    );
  }
  return formContent;
}

export default PlantaoTradeRequestForm;
