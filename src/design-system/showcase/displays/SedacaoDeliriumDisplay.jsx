import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Check,
  ChevronRight,
  Moon,
  RotateCcw,
  X,
} from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Button } from '../../components/ui/button';
import { rass, sedationDeliriumPanel } from '../../../lib/sedationDelirium';

const RASS_LEVELS = [
  { value: 4, label: '+4 Combativo', color: 'text-destructive' },
  { value: 3, label: '+3 Muito agitado', color: 'text-destructive' },
  { value: 2, label: '+2 Agitado', color: 'text-warning' },
  { value: 1, label: '+1 Inquieto', color: 'text-warning' },
  { value: 0, label: '0 Alerta e calmo', color: 'text-success' },
  { value: -1, label: '-1 Sonolento', color: 'text-success' },
  { value: -2, label: '-2 Sedação leve', color: 'text-info' },
  { value: -3, label: '-3 Sedação moderada', color: 'text-info' },
  { value: -4, label: '-4 Sedação profunda', color: 'text-muted-foreground' },
  { value: -5, label: '-5 Não desperta', color: 'text-muted-foreground' },
];

const CAM_FEATURES = [
  { key: 'feature1', label: 'Feature 1', description: 'Alteração aguda ou flutuação do estado mental' },
  { key: 'feature2', label: 'Feature 2', description: 'Inatenção (erro ≥2 letras no teste SAVEAHAART)' },
  { key: 'feature3', label: 'Feature 3', description: 'Consciência alterada (RASS ≠ 0)' },
  { key: 'feature4', label: 'Feature 4', description: 'Pensamento desorganizado (comandos/perguntas incorretos)' },
];

export default function SedacaoDeliriumDisplay() {
  const [rassLevel, setRassLevel] = useState(null);
  const [camFeatures, setCamFeatures] = useState({
    feature1: false,
    feature2: false,
    feature3: false,
    feature4: false,
  });
  const [step, setStep] = useState('rass');

  const rassResult = useMemo(() => {
    if (rassLevel === null) return null;
    return rass(rassLevel);
  }, [rassLevel]);

  const panel = useMemo(() => {
    if (rassLevel === null) return null;
    if (step === 'rass') return sedationDeliriumPanel(rassLevel, null);
    return sedationDeliriumPanel(rassLevel, camFeatures);
  }, [rassLevel, step, camFeatures]);

  const toggleFeature = (key) => {
    setCamFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setRassLevel(null);
    setCamFeatures({ feature1: false, feature2: false, feature3: false, feature4: false });
    setStep('rass');
  };

  const handleAdvanceToCAM = () => {
    setStep('cam');
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className={cn(step === 'rass' && 'text-primary font-bold')}>1. RASS</span>
        <ChevronRight className="size-4" />
        <span className={cn(step === 'cam' && 'text-primary font-bold',
          rassResult && !rassResult.canAssessCAM && 'line-through opacity-50'
        )}>
          2. CAM-ICU
        </span>
      </div>

      {/* RASS selection */}
      {step === 'rass' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Selecione o nível de sedação/agitação do paciente:
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {RASS_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setRassLevel(level.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                  'border border-border hover:bg-muted/50',
                  'min-h-[44px]',
                  rassLevel === level.value
                    ? 'border-primary bg-muted ring-1 ring-primary'
                    : 'bg-card'
                )}
              >
                <Moon className={cn('size-4 shrink-0', level.color)} />
                <span className={cn('text-sm font-medium', level.color)}>
                  {level.label}
                </span>
                {rassLevel === level.value && (
                  <Check className="ml-auto size-4 text-primary" />
                )}
              </button>
            ))}
          </div>

          {rassResult && (
            <div className="mt-3 space-y-2">
              <div className={cn(
                'rounded-xl p-3 text-sm',
                rassResult.category === 'ideal'
                  ? 'bg-success/10 text-success'
                  : rassResult.category === 'agitacao'
                    ? 'bg-warning/10 text-warning'
                    : rassResult.category === 'coma'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-info/10 text-info'
              )}>
                <p className="font-bold">{rassResult.label}</p>
                <p className="mt-1 text-xs opacity-80">{rassResult.detail}</p>
                {rassResult.target === 'alvo' && (
                  <p className="mt-1 text-xs font-semibold">✓ Dentro do alvo (SCCM 2025: RASS 0/-1)</p>
                )}
              </div>

              {rassResult.canAssessCAM ? (
                <Button
                  onClick={handleAdvanceToCAM}
                  className="w-full"
                  variant="default"
                >
                  <span>Avaliar CAM-ICU</span>
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              ) : (
                <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" />
                    <div>
                      <p className="font-bold">CAM-ICU não aplicável</p>
                      <p className="mt-1 text-xs">
                        RASS -4/-5: paciente comatoso ou em sedação profunda.
                        Não avaliar delirium. Reavaliar quando RASS ≥ -3.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CAM-ICU assessment */}
      {step === 'cam' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <span className="font-semibold">RASS {rassLevel >= 0 ? `+${rassLevel}` : rassLevel}:</span>{' '}
            {rassResult?.label} — Prosseguir com CAM-ICU
          </div>

          <p className="text-sm text-muted-foreground">
            Delirium = Feature 1 + Feature 2 + (Feature 3 <strong>OU</strong> Feature 4)
          </p>

          <div className="space-y-2">
            {CAM_FEATURES.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFeature(f.key)}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-3 text-left w-full transition-all',
                  'border border-border min-h-[44px]',
                  camFeatures[f.key]
                    ? 'border-primary bg-muted ring-1 ring-primary'
                    : 'bg-card hover:bg-muted/50'
                )}
              >
                <div className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-md border mt-0.5',
                  camFeatures[f.key]
                    ? 'border-primary bg-primary text-white'
                    : 'border-border'
                )}>
                  {camFeatures[f.key] && <Check className="size-3" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* CAM-ICU Result */}
          {panel && panel.cam && (
            <div className={cn(
              'rounded-xl p-4 text-center',
              panel.cam.positive
                ? 'bg-destructive/10 border border-destructive/30'
                : 'bg-success/10 border border-success/30'
            )}>
              <div className="flex items-center justify-center gap-2">
                {panel.cam.positive ? (
                  <AlertTriangle className="size-5 text-destructive" />
                ) : (
                  <Check className="size-5 text-success" />
                )}
                <span className={cn(
                  'text-lg font-bold',
                  panel.cam.positive ? 'text-destructive' : 'text-success'
                )}>
                  {panel.cam.positive ? 'DELIRIUM PRESENTE' : 'Sem Delirium'}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                CAM-ICU {panel.cam.positive ? 'POSITIVO' : 'Negativo'} •{' '}
                RASS {rassLevel >= 0 ? `+${rassLevel}` : rassLevel}
              </p>
              {panel.cam.positive && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Investigar causa: medicações, infecção, distúrbio metabólico, dor.
                  Considerar medidas não farmacológicas primeiro.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reset */}
      {(rassLevel !== null || step === 'cam') && (
        <Button variant="ghost" onClick={handleReset} className="w-full mt-2">
          <RotateCcw className="mr-2 size-4" />
          Nova avaliação
        </Button>
      )}
    </div>
  );
}
