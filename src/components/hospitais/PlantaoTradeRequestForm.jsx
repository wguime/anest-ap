/**
 * PlantaoTradeRequestForm
 * Formulário para solicitar troca de plantão hospitalar (FDS/feriado).
 *   - Escopo 'slot': troca um slot específico (hospital + turno + data).
 *   - Escopo 'dia':  troca todos os slots da data em que a solicitante está escalada.
 *   - Cobertura (unidirecional): só dataPlantao.
 *   - Swap bidirecional: + dataDesejada (e slot desejado se escopo='slot').
 */
import { useState, useMemo, useEffect } from 'react';
import { Button, Select, Textarea } from '@/design-system';
import { HOSPITAIS_2026, FUNCIONARIAS_HOSPITAIS } from '../../data/hospitaisTecnicas2026';

const HOSPITAIS = [
  { value: 'hro', label: 'HRO (07h–15h)', turno: 'manha' },
  { value: 'unimed', label: 'UNIMED (07h–15h)', turno: 'manha' },
  { value: 'plantao_pago', label: 'Plantão Pago (15h–23h)', turno: 'tarde' },
];

const HOSPITAL_FIELD = { hro: 'hro', unimed: 'unimed', plantao_pago: 'plantaoPago' };

function formatDateKeyLabel(key) {
  const [y, m, d] = key.split('-');
  const dt = new Date(`${key}T12:00:00`);
  const dow = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap = dow.charAt(0).toUpperCase() + dow.slice(1);
  const label = HOSPITAIS_2026[key]?.label;
  return `${d}/${m}/${y} · ${cap}${label ? ` · ${label}` : ''}`;
}

function nomeFromId(id) {
  return FUNCIONARIAS_HOSPITAIS.find((f) => f.id === id)?.nome || null;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slotsDaFuncionariaNaData(funcionariaId, dateKey) {
  const escala = HOSPITAIS_2026[dateKey];
  if (!escala) return [];
  const nome = nomeFromId(funcionariaId);
  if (!nome) return [];
  const slots = [];
  HOSPITAIS.forEach(({ value, turno }) => {
    if (escala[HOSPITAL_FIELD[value]] === nome) {
      slots.push({ hospital: value, turno });
    }
  });
  return slots;
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
  const [solicitanteFuncionariaId, setSolicitanteFuncionariaId] = useState(userFuncionariaId || '');
  const [escopo, setEscopo] = useState('slot');
  const [dataPlantao, setDataPlantao] = useState('');
  const [hospital, setHospital] = useState('');
  const [dataDesejada, setDataDesejada] = useState('');
  const [hospitalDesejado, setHospitalDesejado] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState({});

  const effectiveSolicitanteId = userFuncionariaId || solicitanteFuncionariaId;

  useEffect(() => {
    setDataPlantao('');
    setHospital('');
    setDataDesejada('');
    setHospitalDesejado('');
    setDestinatarioId('');
  }, [effectiveSolicitanteId, escopo]);

  // Datas futuras em que solicitante está escalada (qualquer slot)
  const dataPlantaoOptions = useMemo(() => {
    if (!effectiveSolicitanteId) {
      return [{ value: '', label: 'Selecione primeiro a funcionária solicitante' }];
    }
    const today = todayKey();
    const datas = Object.keys(HOSPITAIS_2026)
      .filter((key) => key >= today && slotsDaFuncionariaNaData(effectiveSolicitanteId, key).length > 0)
      .sort();
    if (datas.length === 0) {
      return [{ value: '', label: 'Nenhum plantão futuro cadastrado' }];
    }
    return [
      { value: '', label: 'Selecione a data do plantão' },
      ...datas.map((key) => ({ value: key, label: formatDateKeyLabel(key) })),
    ];
  }, [effectiveSolicitanteId]);

  // Slots da solicitante na data escolhida (escopo='slot')
  const hospitalOptions = useMemo(() => {
    if (!dataPlantao || !effectiveSolicitanteId) {
      return [{ value: '', label: 'Selecione primeiro a data' }];
    }
    const slots = slotsDaFuncionariaNaData(effectiveSolicitanteId, dataPlantao);
    if (slots.length === 0) return [{ value: '', label: 'Você não está escalada nesta data' }];
    return [
      { value: '', label: 'Selecione o slot' },
      ...slots.map((s) => {
        const meta = HOSPITAIS.find((h) => h.value === s.hospital);
        return { value: s.hospital, label: meta?.label || s.hospital };
      }),
    ];
  }, [dataPlantao, effectiveSolicitanteId]);

  // Datas futuras em que destinatária está escalada (para swap)
  const dataDesejadaOptions = useMemo(() => {
    if (!destinatarioId) {
      return [{ value: '', label: 'Sem swap (só cobertura)' }];
    }
    const today = todayKey();
    const datas = Object.keys(HOSPITAIS_2026)
      .filter((key) => key >= today && key !== dataPlantao && slotsDaFuncionariaNaData(destinatarioId, key).length > 0)
      .sort();
    return [
      { value: '', label: 'Sem swap (só cobertura)' },
      ...datas.map((key) => ({ value: key, label: formatDateKeyLabel(key) })),
    ];
  }, [destinatarioId, dataPlantao]);

  // Slots da destinatária na data desejada (escopo='slot')
  const hospitalDesejadoOptions = useMemo(() => {
    if (!dataDesejada || !destinatarioId) {
      return [{ value: '', label: 'Selecione primeiro a data desejada' }];
    }
    const slots = slotsDaFuncionariaNaData(destinatarioId, dataDesejada);
    if (slots.length === 0) return [{ value: '', label: 'Destinatária não está escalada nesta data' }];
    return [
      { value: '', label: 'Selecione o slot desejado' },
      ...slots.map((s) => {
        const meta = HOSPITAIS.find((h) => h.value === s.hospital);
        return { value: s.hospital, label: meta?.label || s.hospital };
      }),
    ];
  }, [dataDesejada, destinatarioId]);

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
    if (!dataPlantao) e.dataPlantao = 'Selecione a data do plantão';
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

      <Select
        options={dataPlantaoOptions}
        value={dataPlantao}
        onChange={(val) => {
          setDataPlantao(val);
          setHospital('');
          if (errors.dataPlantao) setErrors((p) => ({ ...p, dataPlantao: '' }));
        }}
        label="Data do plantão"
        placeholder="Selecione a data"
        error={errors.dataPlantao || undefined}
        disabled={loading || !effectiveSolicitanteId}
      />

      {escopo === 'slot' && (
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
          disabled={loading || !dataPlantao}
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

      {destinatarioId && (
        <Select
          options={dataDesejadaOptions}
          value={dataDesejada}
          onChange={(val) => {
            setDataDesejada(val);
            setHospitalDesejado('');
          }}
          label="Plantão dela que você quer (opcional)"
          placeholder="Sem swap (só cobertura)"
          disabled={loading}
        />
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
