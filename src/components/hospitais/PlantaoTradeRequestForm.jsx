/**
 * PlantaoTradeRequestForm
 * Formulário simplificado para troca de plantão hospitalar (FDS/feriado).
 *
 * Fluxo:
 *   1. Solicitante (auto pelo login; admin/coord pode escolher)
 *   2. Dropdown "Meu plantão" — lista cada plantão da solicitante (data + hospital + turno)
 *   3. Destinatária (opcional)
 *   4. Dropdown "Plantão dela" — lista cada plantão da destinatária (opcional, vira swap)
 *   5. Motivo
 */
import { useState, useMemo, useEffect } from 'react';
import { Button, Select, Textarea } from '@/design-system';
import { formatDate } from '@/utils/formatters';
import { getHospitaisBase, FUNCIONARIAS_HOSPITAIS, getDatasDaFuncionariaHospitais, getSlotsFuncionariaNaData } from '../../data/hospitaisTecnicas2026';
import { useHospitaisOverrides } from '../../hooks/useHospitaisOverrides';

const HOSPITAL_LABELS = {
  hro: 'HRO',
  unimed: 'UNIMED',
  plantao_pago: 'Plantão Pago',
};

const TURNO_LABELS = {
  manha: '07h–15h',
  tarde: '15h–23h',
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  const dt = new Date(`${key}T12:00:00`);
  const dow = formatDate(dt, { weekday: 'short' }).replace('.', '');
  const cap = dow.charAt(0).toUpperCase() + dow.slice(1);
  const feriado = getHospitaisBase()[key]?.label;
  return `${d}/${m}/${y} (${cap})${feriado ? ` · ${feriado}` : ''}`;
}

function formatPlantaoLabel(key, hospital, turno) {
  return `${formatDateLabel(key)} · ${HOSPITAL_LABELS[hospital]} ${TURNO_LABELS[turno]}`;
}

function nomeFromId(id) {
  return FUNCIONARIAS_HOSPITAIS.find((f) => f.id === id)?.nome || null;
}

/**
 * Constrói lista plana de plantões (1 por slot) da funcionária.
 * Retorna [{ key, hospital, turno, label }]
 */
function listarPlantoesFuncionaria(funcId, fromKey, overrides) {
  if (!funcId) return [];
  const datas = getDatasDaFuncionariaHospitais(funcId, fromKey, overrides);
  const items = [];
  for (const data of datas) {
    const slots = getSlotsFuncionariaNaData(funcId, data, overrides);
    for (const s of slots) {
      items.push({
        key: data,
        hospital: s.hospital,
        turno: s.turno,
        composedKey: `${data}|${s.hospital}|${s.turno}`,
        label: formatPlantaoLabel(data, s.hospital, s.turno),
      });
    }
  }
  return items;
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
  const [meuPlantaoKey, setMeuPlantaoKey] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [plantaoDelaKey, setPlantaoDelaKey] = useState('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState({});

  // Sincroniza com prop quando funcionária resolve (fix de useState lazy init)
  useEffect(() => {
    if (userFuncionariaId) setSolicitanteFuncionariaId(userFuncionariaId);
  }, [userFuncionariaId]);

  const effectiveSolicitanteId = userFuncionariaId || solicitanteFuncionariaId;

  // Reset campos dependentes quando solicitante muda
  useEffect(() => {
    setMeuPlantaoKey('');
    setDestinatarioId('');
    setPlantaoDelaKey('');
  }, [effectiveSolicitanteId]);

  // Lista plana dos plantões da solicitante
  const meusPlantoes = useMemo(
    () => listarPlantoesFuncionaria(effectiveSolicitanteId, todayKey(), hospitaisOverrides),
    [effectiveSolicitanteId, hospitaisOverrides]
  );

  // Lista plana dos plantões da destinatária (excluindo o já escolhido pela solicitante)
  const plantoesDela = useMemo(() => {
    if (!destinatarioId) return [];
    return listarPlantoesFuncionaria(destinatarioId, todayKey(), hospitaisOverrides)
      .filter((p) => p.composedKey !== meuPlantaoKey);
  }, [destinatarioId, meuPlantaoKey, hospitaisOverrides]);

  const meuPlantaoOptions = useMemo(() => {
    if (!effectiveSolicitanteId) {
      return [{ value: '', label: 'Selecione primeiro a funcionária' }];
    }
    if (meusPlantoes.length === 0) {
      return [{ value: '', label: 'Nenhum plantão futuro escalado' }];
    }
    return [
      { value: '', label: 'Selecione um plantão seu' },
      ...meusPlantoes.map((p) => ({ value: p.composedKey, label: p.label })),
    ];
  }, [effectiveSolicitanteId, meusPlantoes]);

  const plantaoDelaOptions = useMemo(() => {
    if (!destinatarioId) {
      return [{ value: '', label: 'Selecione primeiro a destinatária' }];
    }
    if (plantoesDela.length === 0) {
      return [{ value: '', label: 'Sem plantão para trocar — só cobertura' }];
    }
    return [
      { value: '', label: 'Selecionar troca' },
      ...plantoesDela.map((p) => ({ value: p.composedKey, label: p.label })),
    ];
  }, [destinatarioId, plantoesDela]);

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
    if (!meuPlantaoKey) e.meuPlantao = 'Escolha qual plantão seu quer trocar';
    if (!descricao || !descricao.trim()) e.descricao = 'Informe o motivo da troca';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    const [meuData, meuHospital, meuTurno] = meuPlantaoKey.split('|');
    const [delaData, delaHospital, delaTurno] = plantaoDelaKey
      ? plantaoDelaKey.split('|')
      : [null, null, null];

    onSubmit?.({
      solicitanteFuncionariaIdOverride: isAdminOrCoord && !userFuncionariaId ? solicitanteFuncionariaId : null,
      escopo: 'slot',
      dataPlantao: meuData,
      hospital: meuHospital,
      turno: meuTurno,
      dataDesejada: delaData,
      hospitalDesejado: delaHospital,
      turnoDesejado: delaTurno,
      descricao: descricao.trim(),
      destinatarioId: destinatarioId || null,
      destinatarioNome: nomeFromId(destinatarioId),
    });
  };

  const showSolicitantePicker = isAdminOrCoord && !userFuncionariaId;
  const isSwap = !!plantaoDelaKey;

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
        options={meuPlantaoOptions}
        value={meuPlantaoKey}
        onChange={(val) => {
          setMeuPlantaoKey(val);
          if (errors.meuPlantao) setErrors((p) => ({ ...p, meuPlantao: '' }));
        }}
        label="Meu plantão para trocar"
        placeholder="Selecione um plantão seu"
        error={errors.meuPlantao || undefined}
        disabled={loading || !effectiveSolicitanteId}
      />

      <Select
        options={destinatarioOptions}
        value={destinatarioId}
        onChange={(val) => {
          setDestinatarioId(val);
          setPlantaoDelaKey('');
        }}
        label="Trocar com (opcional)"
        placeholder="Selecione a colega"
        disabled={loading}
      />

      {destinatarioId && (
        <Select
          options={plantaoDelaOptions}
          value={plantaoDelaKey}
          onChange={(val) => setPlantaoDelaKey(val)}
          label={`Plantão de ${nomeFromId(destinatarioId)} em troca (opcional)`}
          placeholder="Selecionar troca"
          disabled={loading}
        />
      )}

      <p className="text-xs text-muted-foreground">
        {isSwap
          ? 'Troca bidirecional: vocês trocam os plantões entre si.'
          : destinatarioId
            ? 'Cobertura: ela assume seu plantão sem trocar em retorno.'
            : 'Sem destinatária: qualquer funcionária pode aceitar a cobertura.'}
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
        <h3 className="text-sm font-semibold text-foreground mb-2.5">
          Nova Solicitação de Troca de Plantão
        </h3>
        {formContent}
      </div>
    );
  }
  return formContent;
}

export default PlantaoTradeRequestForm;
