import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  Droplets,
  Heart,
  RotateCcw,
  Stethoscope,
  Wind,
} from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { qsofa, sofa } from '../../../lib/sofaScore';

// ============================================================================
// CONSTANTS
// ============================================================================

const RESP_OPTIONS = [
  { value: '0', label: '≥ 400 — Normal' },
  { value: '1', label: '300-399 — Leve' },
  { value: '2', label: '200-299 — Moderado' },
  { value: '3', label: '100-199 com VM — Grave' },
  { value: '4', label: '< 100 com VM — Muito grave' },
];

const COAG_OPTIONS = [
  { value: '0', label: '≥ 150 — Normal' },
  { value: '1', label: '100-149' },
  { value: '2', label: '50-99' },
  { value: '3', label: '20-49' },
  { value: '4', label: '< 20' },
];

const HEPATIC_OPTIONS = [
  { value: '0', label: '< 1,2 — Normal' },
  { value: '1', label: '1,2-1,9' },
  { value: '2', label: '2,0-5,9' },
  { value: '3', label: '6,0-11,9' },
  { value: '4', label: '≥ 12,0' },
];

const CARDIO_OPTIONS = [
  { value: '0', label: 'PAM ≥ 70 mmHg — Sem suporte' },
  { value: '1', label: 'PAM < 70 mmHg' },
  { value: '2', label: 'Dopa ≤ 5 ou Dobutamina' },
  { value: '3', label: 'Dopa > 5 ou Nora/Adre ≤ 0,1' },
  { value: '4', label: 'Dopa > 15 ou Nora/Adre > 0,1' },
];

const NEURO_OPTIONS = [
  { value: '0', label: 'GCS 15 — Normal' },
  { value: '1', label: 'GCS 13-14' },
  { value: '2', label: 'GCS 10-12' },
  { value: '3', label: 'GCS 6-9' },
  { value: '4', label: 'GCS < 6' },
];

const RENAL_OPTIONS = [
  { value: '0', label: 'Cr < 1,2 — Normal' },
  { value: '1', label: 'Cr 1,2-1,9' },
  { value: '2', label: 'Cr 2,0-3,4' },
  { value: '3', label: 'Cr 3,5-4,9 ou DU < 500 mL/dia' },
  { value: '4', label: 'Cr ≥ 5,0 ou DU < 200 mL/dia' },
];

const ORGAN_LABELS = {
  resp: { label: 'Respiratório', sublabel: 'PaO₂/FiO₂', icon: Wind, options: RESP_OPTIONS },
  coag: { label: 'Coagulação', sublabel: 'Plaquetas (×10³/µL)', icon: Droplets, options: COAG_OPTIONS },
  hepatic: { label: 'Hepático', sublabel: 'Bilirrubina (mg/dL)', icon: Activity, options: HEPATIC_OPTIONS },
  cardio: { label: 'Cardiovascular', sublabel: 'PAM / Vasopressores', icon: Heart, options: CARDIO_OPTIONS },
  neuro: { label: 'Neurológico', sublabel: 'Glasgow (GCS)', icon: Brain, options: NEURO_OPTIONS },
  renal: { label: 'Renal', sublabel: 'Creatinina / DU', icon: Stethoscope, options: RENAL_OPTIONS },
};

const ORGAN_KEYS = ['resp', 'coag', 'hepatic', 'cardio', 'neuro', 'renal'];

// Maps direct organ scores to sofa() input format for validation
function organScoresToSofaInput(organScores) {
  // Use synthetic values that produce the desired organ scores
  const PF_MAP = { '0': 450, '1': 350, '2': 250, '3': 150, '4': 50 };
  const PLAQ_MAP = { '0': 200, '1': 120, '2': 75, '3': 35, '4': 10 };
  const BILI_MAP = { '0': 0.5, '1': 1.5, '2': 4.0, '3': 9.0, '4': 14.0 };
  const CARDIO_MAP = {
    '0': { pam: 80, vasopressor: 'nenhum' },
    '1': { pam: 60, vasopressor: 'nenhum' },
    '2': { pam: 60, vasopressor: 'dopaBaixa' },
    '3': { pam: 60, vasopressor: 'dopaAlta' },
    '4': { pam: 60, vasopressor: 'noraAdre_alta' },
  };
  const GCS_MAP = { '0': 15, '1': 14, '2': 11, '3': 7, '4': 4 };
  const CR_MAP = { '0': 0.8, '1': 1.5, '2': 2.5, '3': 4.0, '4': 5.5 };

  const cardioEntry = CARDIO_MAP[organScores.cardio] || CARDIO_MAP['0'];

  return {
    pf: PF_MAP[organScores.resp] ?? 450,
    vm: parseInt(organScores.resp) >= 3,
    plaquetas: PLAQ_MAP[organScores.coag] ?? 200,
    bilirrubina: BILI_MAP[organScores.hepatic] ?? 0.5,
    pam: cardioEntry.pam,
    vasopressor: cardioEntry.vasopressor,
    glasgow: GCS_MAP[organScores.neuro] ?? 15,
    creatinina: CR_MAP[organScores.renal] ?? 0.8,
  };
}

function riskColor(risk) {
  switch (risk) {
    case 'baixo':
      return 'success';
    case 'medio':
      return 'warning';
    case 'alto':
    case 'critico':
      return 'destructive';
    default:
      return 'default';
  }
}

function riskLabel(risk) {
  switch (risk) {
    case 'baixo':
      return 'Baixo';
    case 'medio':
      return 'Moderado';
    case 'alto':
      return 'Alto';
    case 'critico':
      return 'Crítico';
    default:
      return '—';
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ModeToggle({ value, onChange }) {
  const opts = [
    { v: 'qsofa', label: 'Triagem rápida (qSOFA)' },
    { v: 'sofa', label: 'Completo (SOFA)' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Modo de avaliação"
      className="inline-flex p-1 rounded-xl bg-muted border border-border w-full"
    >
      {opts.map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              active
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxItem({ checked, onChange, label, sublabel }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-xl border transition-colors min-h-[44px] text-left',
        checked
          ? 'bg-destructive/10 border-destructive/40'
          : 'bg-card border-border hover:border-border-strong'
      )}
    >
      <div
        className={cn(
          'w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors',
          checked
            ? 'bg-destructive border-destructive text-white'
            : 'border-muted-foreground/40'
        )}
      >
        {checked && (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div>
        <p className={cn('text-sm font-medium', checked ? 'text-destructive' : 'text-foreground')}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
    </button>
  );
}

function ScoreBadge({ score, maxScore, accent }) {
  const colorClass = {
    success: 'bg-success/10 text-success border-success/40',
    warning: 'bg-warning/10 text-warning border-warning/40',
    destructive: 'bg-destructive/10 text-destructive border-destructive/40',
    default: 'bg-muted text-muted-foreground border-border',
  }[accent] || 'bg-muted text-muted-foreground border-border';

  return (
    <div className={cn('inline-flex items-baseline gap-1 px-4 py-2 rounded-xl border', colorClass)}>
      <span className="text-3xl font-bold">{score}</span>
      <span className="text-sm opacity-70">/ {maxScore}</span>
    </div>
  );
}

function OrganScoreBar({ organKey, score }) {
  const organ = ORGAN_LABELS[organKey];
  if (!organ) return null;
  const Icon = organ.icon;

  const barWidth = score > 0 ? `${(score / 4) * 100}%` : '0%';

  const barColor =
    score === 0 ? 'bg-success'
    : score <= 2 ? 'bg-warning'
    : 'bg-destructive';

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-32 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground truncate">{organ.label}</span>
      </div>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: barWidth }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-6 text-right">{score}</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SofaDisplay() {
  const [mode, setMode] = useState('qsofa');

  // qSOFA state
  const [altMental, setAltMental] = useState(false);
  const [frAlta, setFrAlta] = useState(false);
  const [pasBaixa, setPasBaixa] = useState(false);

  // SOFA state — each organ is a direct score 0-4 via Select
  const [organScores, setOrganScores] = useState({
    resp: '',
    coag: '',
    hepatic: '',
    cardio: '',
    neuro: '',
    renal: '',
  });

  const setOrgan = (key, val) => {
    setOrganScores((prev) => ({ ...prev, [key]: val }));
  };

  // Compute results
  const qsofaResult = useMemo(
    () => qsofa({ altMental, frAlta, pasBaixa }),
    [altMental, frAlta, pasBaixa]
  );

  const sofaResult = useMemo(() => {
    const hasAny = ORGAN_KEYS.some((k) => organScores[k] !== '');
    if (!hasAny) return null;

    const input = organScoresToSofaInput(organScores);
    return sofa(input);
  }, [organScores]);

  const activeResult = mode === 'qsofa' ? qsofaResult : sofaResult;
  const accent = activeResult ? riskColor(activeResult.risk) : 'default';

  const switchToSofa = () => setMode('sofa');

  const resetAll = () => {
    setAltMental(false);
    setFrAlta(false);
    setPasBaixa(false);
    setOrganScores({
      resp: '',
      coag: '',
      hepatic: '',
      cardio: '',
      neuro: '',
      renal: '',
    });
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <section className="rounded-xl border border-border-strong bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
            SOFA / qSOFA — Sepsis-3
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="text-muted-foreground hover:text-destructive min-h-[44px]"
            aria-label="Limpar todos os campos"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Limpar
          </Button>
        </div>

        <ModeToggle value={mode} onChange={setMode} />
      </section>

      {/* qSOFA inputs */}
      {mode === 'qsofa' && (
        <section
          aria-labelledby="qsofa-heading"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-3"
        >
          <h3 id="qsofa-heading" className="text-base font-semibold text-foreground">
            Critérios qSOFA
          </h3>
          <p className="text-xs text-muted-foreground">
            Triagem rápida sem exames laboratoriais. Marque os critérios presentes.
          </p>

          <div className="space-y-2">
            <CheckboxItem
              checked={altMental}
              onChange={setAltMental}
              label="Alteração do nível de consciência"
              sublabel="Glasgow (GCS) < 15"
            />
            <CheckboxItem
              checked={frAlta}
              onChange={setFrAlta}
              label="Frequência respiratória elevada"
              sublabel="FR ≥ 22 irpm"
            />
            <CheckboxItem
              checked={pasBaixa}
              onChange={setPasBaixa}
              label="Pressão arterial sistólica baixa"
              sublabel="PAS ≤ 100 mmHg"
            />
          </div>
        </section>
      )}

      {/* SOFA inputs */}
      {mode === 'sofa' && (
        <section
          aria-labelledby="sofa-heading"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-3"
        >
          <h3 id="sofa-heading" className="text-base font-semibold text-foreground">
            Componentes SOFA — 6 sistemas orgânicos
          </h3>
          <p className="text-xs text-muted-foreground">
            Selecione a pontuação de cada sistema orgânico com base nos dados do paciente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ORGAN_KEYS.map((key) => {
              const organ = ORGAN_LABELS[key];
              const Icon = organ.icon;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="text-sm font-medium text-foreground">{organ.label}</span>
                    <span className="text-xs text-muted-foreground">— {organ.sublabel}</span>
                  </div>
                  <Select
                    options={organ.options}
                    value={organScores[key]}
                    onChange={(val) => setOrgan(key, val)}
                    placeholder="Selecione..."
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Results */}
      {activeResult && (
        <section
          aria-labelledby="resultado-heading"
          aria-live="polite"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-4"
        >
          <h3 id="resultado-heading" className="text-base font-semibold text-foreground">
            Resultado
          </h3>

          {/* Score + Risk badge */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <ScoreBadge
              score={activeResult.score}
              maxScore={activeResult.maxScore}
              accent={accent}
            />
            <div
              className={cn(
                'px-4 py-2 rounded-xl border text-sm font-semibold',
                {
                  success: 'bg-success/10 text-success border-success/40',
                  warning: 'bg-warning/10 text-warning border-warning/40',
                  destructive: 'bg-destructive/10 text-destructive border-destructive/40',
                }[accent] || 'bg-muted text-muted-foreground border-border'
              )}
            >
              Risco: {riskLabel(activeResult.risk)}
            </div>
          </div>

          {/* Mortality (SOFA only) */}
          {activeResult.version === 'sofa' && activeResult.mortality && (
            <div className="rounded-xl bg-muted p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Mortalidade estimada
              </p>
              <p className="text-lg font-bold text-foreground">{activeResult.mortality}</p>
            </div>
          )}

          {/* Per-organ breakdown (SOFA only) */}
          {activeResult.version === 'sofa' && activeResult.organScores && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Pontuação por sistema
              </p>
              {ORGAN_KEYS.map((key) => (
                <OrganScoreBar
                  key={key}
                  organKey={key}
                  score={activeResult.organScores[key]}
                />
              ))}
            </div>
          )}

          {/* Interpretation */}
          <div
            className={cn(
              'rounded-xl p-3 border text-sm',
              {
                success: 'bg-success/10 border-success/40 text-success',
                warning: 'bg-warning/10 border-warning/40 text-warning',
                destructive: 'bg-destructive/10 border-destructive/40 text-destructive',
              }[accent] || 'bg-muted border-border text-muted-foreground'
            )}
          >
            <p>{activeResult.interpretation}</p>
          </div>

          {/* qSOFA >= 2: prompt to switch to SOFA */}
          {activeResult.version === 'qsofa' && activeResult.score >= 2 && (
            <button
              type="button"
              onClick={switchToSofa}
              className={cn(
                'w-full flex items-center justify-center gap-2 p-3 rounded-xl border min-h-[44px]',
                'bg-warning/10 border-warning/40 text-warning',
                'hover:bg-warning/20 transition-colors font-medium text-sm'
              )}
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              Investigar com SOFA completo
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </section>
      )}

      {/* Reference / Disclaimer */}
      <section className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Referências: </span>
          Singer M, et al. JAMA 2016;315(8):801-810 (Sepsis-3). Vincent JL, et al.
          Intensive Care Med 1996;22(7):707-710 (SOFA original). Seymour CW, et al.
          JAMA 2016;315(8):762-774 (qSOFA). Ferreira FL, et al. JAMA 2001;286(14):1754-1758
          (mortalidade).
        </p>
        <p className="text-xs text-muted-foreground italic">
          Ferramenta auxiliar — não substitui o julgamento clínico. Validar com
          anestesiologista/intensivista titular.
        </p>
      </section>
    </div>
  );
}
