import { useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Activity,
  Wind,
  Heart,
  Brain,
  Thermometer,
  Palette,
  Info,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { aldreteModified, aldreteOriginal } from '../../../lib/aldrete';

// ---------------------------------------------------------------------------
// Options para cada critério (valor numérico 0-2)
// ---------------------------------------------------------------------------

const ATIVIDADE_OPTIONS = [
  { value: 2, label: 'Move 4 extremidades voluntariamente ou sob comando' },
  { value: 1, label: 'Move 2 extremidades voluntariamente ou sob comando' },
  { value: 0, label: 'Incapaz de mover extremidades' },
];

const RESPIRACAO_OPTIONS = [
  { value: 2, label: 'Respira profundamente e tosse livremente' },
  { value: 1, label: 'Dispneia ou respiração limitada' },
  { value: 0, label: 'Apneia' },
];

const CIRCULACAO_OPTIONS = [
  { value: 2, label: 'PA ± 20% do nível pré-anestésico' },
  { value: 1, label: 'PA ± 20-50% do nível pré-anestésico' },
  { value: 0, label: 'PA ± 50% do nível pré-anestésico' },
];

const CONSCIENCIA_OPTIONS = [
  { value: 2, label: 'Totalmente acordado' },
  { value: 1, label: 'Desperta quando chamado' },
  { value: 0, label: 'Não responde' },
];

const SPO2_OPTIONS = [
  { value: 2, label: 'SpO2 > 92% em ar ambiente' },
  { value: 1, label: 'Necessita O2 para manter SpO2 > 90%' },
  { value: 0, label: 'SpO2 < 90% mesmo com O2' },
];

const COR_OPTIONS = [
  { value: 2, label: 'Rosado' },
  { value: 1, label: 'Pálido, ictérico ou manchado' },
  { value: 0, label: 'Cianótico' },
];

// ---------------------------------------------------------------------------
// Toggle de versão (pill-style, igual ao BalancoHidricoTransopDisplay)
// ---------------------------------------------------------------------------

function VersionToggle({ value, onChange }) {
  const opts = [
    { v: 'modified', label: 'Modificado (1995)', icon: ClipboardCheck },
    { v: 'original', label: 'Original (1970)', icon: Palette },
  ];
  return (
    <div
      role="tablist"
      aria-label="Versão do Aldrete"
      className="inline-flex p-1 rounded-xl bg-muted border border-border"
    >
      {opts.map(({ v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              active
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Criterion row — ícone + select lado a lado
// ---------------------------------------------------------------------------

function CriterionSelect({ icon: Icon, label, options, value, onChange }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        {label}
      </div>
      <Select
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Selecione..."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score display
// ---------------------------------------------------------------------------

function ScoreDisplay({ result }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
        <p className="text-sm text-muted-foreground italic">
          Preencha todos os critérios para calcular o score.
        </p>
      </div>
    );
  }

  const { score, maxScore, interpretation, canDischarge } = result;

  const accent = score >= 9
    ? { bg: 'bg-success/10', border: 'border-success/40', text: 'text-success' }
    : score >= 7
      ? { bg: 'bg-warning/10', border: 'border-warning/40', text: 'text-warning' }
      : { bg: 'bg-destructive/10', border: 'border-destructive/40', text: 'text-destructive' };

  return (
    <div
      className={cn('rounded-xl border p-4 text-center space-y-1', accent.bg, accent.border)}
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Score Aldrete</p>
      <p className={cn('text-4xl font-bold leading-tight', accent.text)}>
        {score}<span className="text-lg font-normal text-muted-foreground">/{maxScore}</span>
      </p>
      <p className={cn('text-sm font-semibold', accent.text)}>{interpretation}</p>
      {canDischarge && (
        <p className="text-xs text-success font-medium mt-1">
          Critério de alta atingido (score maior ou igual a 9)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InfoBox (referências e notas clínicas)
// ---------------------------------------------------------------------------

function InfoBox({ version }) {
  const isModified = version === 'modified';
  return (
    <details className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-semibold text-foreground select-none min-h-[44px] flex items-center gap-2">
        <Info className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        Referências e notas clínicas
      </summary>
      <div className="mt-3 space-y-2">
        <p>
          <strong>Referência primária: </strong>
          {isModified
            ? 'Aldrete JA. J Clin Anesth 1995;7(1):89-91.'
            : 'Aldrete JA, Kroulik D. Anesth Analg 1970;49(6):924-34.'}
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Score maior ou igual a 9: Apto para alta da SRPA.</li>
          <li>Score 7-8: Quase apto — reavaliar em 15-30 minutos.</li>
          <li>Score menor que 7: Continuar observação na SRPA.</li>
          {isModified ? (
            <li>
              A versão modificada (1995) substituiu o critério &quot;Cor&quot; por &quot;SpO2&quot;,
              mais objetivo e mensurável com oximetria de pulso.
            </li>
          ) : (
            <li>
              A versão original (1970) usa o critério &quot;Cor&quot; (coloração da pele),
              substituído por SpO2 na versão modificada de 1995.
            </li>
          )}
          <li>Cada critério é pontuado de 0 a 2. Score máximo: 10 pontos.</li>
        </ul>
        <p className="italic mt-2 text-muted-foreground">
          Ferramenta auxiliar — não substitui o julgamento clínico do anestesiologista.
        </p>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main display component
// ---------------------------------------------------------------------------

export default function AldreteDisplay() {
  const [version, setVersion] = useState('modified');
  const [atividade, setAtividade] = useState('');
  const [respiracao, setRespiracao] = useState('');
  const [circulacao, setCirculacao] = useState('');
  const [consciencia, setConsciencia] = useState('');
  const [spo2, setSpo2] = useState('');
  const [cor, setCor] = useState('');

  const isModified = version === 'modified';

  const result = useMemo(() => {
    if (isModified) {
      return aldreteModified({ atividade, respiracao, circulacao, consciencia, spo2 });
    }
    return aldreteOriginal({ atividade, respiracao, circulacao, consciencia, cor });
  }, [isModified, atividade, respiracao, circulacao, consciencia, spo2, cor]);

  const handleVersionChange = (v) => {
    setVersion(v);
    // Limpar o 5o critério ao trocar de versão para evitar score residual
    if (v === 'modified') {
      setCor('');
    } else {
      setSpo2('');
    }
  };

  const resetAll = () => {
    setAtividade('');
    setRespiracao('');
    setCirculacao('');
    setConsciencia('');
    setSpo2('');
    setCor('');
  };

  const hasAnyValue = atividade !== '' || respiracao !== '' || circulacao !== '' ||
    consciencia !== '' || spo2 !== '' || cor !== '';

  return (
    <div className="space-y-4">
      {/* Header com toggle de versão */}
      <section
        aria-labelledby="aldrete-heading"
        className="rounded-xl border border-border-strong bg-card p-4 space-y-4"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3
            id="aldrete-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <ClipboardCheck className="w-5 h-5 text-primary" aria-hidden="true" />
            Score de Aldrete — Alta da SRPA
          </h3>
          {hasAnyValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAll}
              className="text-muted-foreground hover:text-destructive min-h-[44px]"
              aria-label="Limpar todos os critérios"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Limpar
            </Button>
          )}
        </div>

        <VersionToggle value={version} onChange={handleVersionChange} />

        {/* Critérios */}
        <div className="space-y-3">
          <CriterionSelect
            icon={Activity}
            label="Atividade"
            options={ATIVIDADE_OPTIONS}
            value={atividade}
            onChange={setAtividade}
          />
          <CriterionSelect
            icon={Wind}
            label="Respiração"
            options={RESPIRACAO_OPTIONS}
            value={respiracao}
            onChange={setRespiracao}
          />
          <CriterionSelect
            icon={Heart}
            label="Circulação (PA)"
            options={CIRCULACAO_OPTIONS}
            value={circulacao}
            onChange={setCirculacao}
          />
          <CriterionSelect
            icon={Brain}
            label="Consciência"
            options={CONSCIENCIA_OPTIONS}
            value={consciencia}
            onChange={setConsciencia}
          />

          {/* 5o critério muda conforme versão */}
          {isModified ? (
            <CriterionSelect
              icon={Thermometer}
              label="SpO2 (Saturação)"
              options={SPO2_OPTIONS}
              value={spo2}
              onChange={setSpo2}
            />
          ) : (
            <CriterionSelect
              icon={Palette}
              label="Cor (Coloração)"
              options={COR_OPTIONS}
              value={cor}
              onChange={setCor}
            />
          )}
        </div>
      </section>

      {/* Score resultado */}
      <ScoreDisplay result={result} />

      {/* Referências */}
      <InfoBox version={version} />
    </div>
  );
}
