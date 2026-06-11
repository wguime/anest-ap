import { useMemo, useState } from 'react';
import { Activity, Droplet, AlertTriangle, Heart, Info, RotateCcw } from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Checkbox } from '../../components/ui/checkbox';
import { Button } from '../../components/ui/button';
import { afibPanel } from '../../../lib/afib';

// ============================================================================
// CHA2DS2-VASc checkbox definitions
// ============================================================================

const CHADS_ITEMS = [
  { key: 'chf', label: 'C — ICC / Disfunção VE', points: '+1' },
  { key: 'hypertension', label: 'H — Hipertensão', points: '+1' },
  { key: 'age75', label: 'A2 — Idade ≥ 75 anos', points: '+2' },
  { key: 'diabetes', label: 'D — Diabetes mellitus', points: '+1' },
  { key: 'stroke', label: 'S2 — AVC / AIT / TE prévio', points: '+2' },
  { key: 'vascular', label: 'V — Doença vascular (IAM, DAP, placa aórtica)', points: '+1' },
  { key: 'age65', label: 'A — Idade 65-74 anos', points: '+1' },
  { key: 'female', label: 'Sc — Sexo feminino', points: '+1' },
];

// ============================================================================
// HAS-BLED checkbox definitions
// ============================================================================

const HASBLED_ITEMS = [
  { key: 'hypertension', label: 'H — Hipertensão (PAS > 160 mmHg)', points: '+1' },
  { key: 'renalDisease', label: 'A — Disfunção renal', points: '+1' },
  { key: 'liverDisease', label: 'A — Disfunção hepática', points: '+1' },
  { key: 'stroke', label: 'S — AVC prévio', points: '+1' },
  { key: 'bleeding', label: 'B — Sangramento prévio ou predisposição', points: '+1' },
  { key: 'labileInr', label: 'L — INR lábil (TTR < 60%)', points: '+1' },
  { key: 'elderly', label: 'E — Idade > 65 anos', points: '+1' },
  { key: 'drugs', label: 'D — Antiplaquetários / AINE', points: '+1' },
  { key: 'alcohol', label: 'D — Álcool (≥ 8 doses/semana)', points: '+1' },
];

// ============================================================================
// Helpers
// ============================================================================

const emptyChads = () =>
  Object.fromEntries(CHADS_ITEMS.map((i) => [i.key, false]));

const emptyHasbled = () =>
  Object.fromEntries(HASBLED_ITEMS.map((i) => [i.key, false]));

function ScoreBadge({ score, maxScore, accentBg, accentText }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold',
          accentBg,
          accentText
        )}
      >
        {score}
      </div>
      <span className="text-sm text-muted-foreground">/ {maxScore}</span>
    </div>
  );
}

function CriteriaPanel({ title, icon: Icon, items, values, onChange, accentBg, accentText, accentBgCard }) {
  const count = Object.values(values).filter(Boolean).length;

  return (
    <section
      aria-label={title}
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl',
            accentBgCard
          )}
        >
          <Icon className={cn('w-5 h-5', accentText)} aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {count} de {items.length} critérios selecionados
          </p>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="flex-1">
              <Checkbox
                checked={values[item.key] || false}
                onChange={(checked) => onChange({ ...values, [item.key]: checked })}
                label={item.label}
                size="sm"
              />
            </div>
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 ml-2',
                values[item.key] ? cn(accentBg, accentText) : 'bg-muted text-muted-foreground'
              )}
            >
              {item.points}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Main Display Component
// ============================================================================

export default function FibrilacaoAtrialDisplay() {
  const [chadsValues, setChadsValues] = useState(emptyChads);
  const [hasbledValues, setHasbledValues] = useState(emptyHasbled);

  const panel = useMemo(
    () => afibPanel(chadsValues, hasbledValues),
    [chadsValues, hasbledValues]
  );

  const hasAnySelection =
    Object.values(chadsValues).some(Boolean) ||
    Object.values(hasbledValues).some(Boolean);

  const resetAll = () => {
    setChadsValues(emptyChads());
    setHasbledValues(emptyHasbled());
  };

  // Color logic for the combined recommendation
  const recommendationAccent = (() => {
    if (panel.chads.score === 0) return 'bg-muted border-border text-muted-foreground';
    if (panel.chads.score >= 2 && panel.hasbled.score >= 3)
      return 'bg-destructive/10 border-destructive/40 text-destructive';
    if (panel.chads.score >= 2)
      return 'bg-success/10 border-success/40 text-success';
    // Score 1
    return 'bg-warning/10 border-warning/40 text-warning';
  })();

  return (
    <div className="space-y-4">
      {/* Reset button */}
      {hasAnySelection && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="text-muted-foreground hover:text-destructive min-h-[44px]"
            aria-label="Limpar todas as seleções"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Limpar
          </Button>
        </div>
      )}

      {/* Dual panel: CHA2DS2-VASc + HAS-BLED */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CriteriaPanel
          title="CHA2DS2-VASc"
          icon={Activity}
          items={CHADS_ITEMS}
          values={chadsValues}
          onChange={setChadsValues}
          accentBg="bg-category-blue-bg"
          accentText="text-category-blue-fg"
          accentBgCard="bg-category-blue-bg"
        />
        <CriteriaPanel
          title="HAS-BLED"
          icon={Droplet}
          items={HASBLED_ITEMS}
          values={hasbledValues}
          onChange={setHasbledValues}
          accentBg="bg-category-orange-bg"
          accentText="text-category-orange-fg"
          accentBgCard="bg-category-orange-bg"
        />
      </div>

      {/* Score summary side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CHA2DS2-VASc score */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Risco tromboembólico</h4>
            <ScoreBadge
              score={panel.chads.score}
              maxScore={panel.chads.maxScore}
              accentBg="bg-category-blue-bg"
              accentText="text-category-blue-fg"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Risco anual de AVC:{' '}
              <span className="font-semibold text-foreground">
                {panel.chads.strokeRiskPercent}%
              </span>
            </p>
            <p className={cn('text-sm font-medium', 'text-category-blue-fg')}>
              {panel.chads.recommendation}
            </p>
          </div>
        </div>

        {/* HAS-BLED score */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Risco hemorrágico</h4>
            <ScoreBadge
              score={panel.hasbled.score}
              maxScore={panel.hasbled.maxScore}
              accentBg="bg-category-orange-bg"
              accentText="text-category-orange-fg"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Risco anual de sangramento maior:{' '}
              <span className="font-semibold text-foreground">
                {panel.hasbled.bleedingRisk}
              </span>
            </p>
            <p className={cn('text-sm font-medium', 'text-category-orange-fg')}>
              {panel.hasbled.interpretation}
            </p>
          </div>
        </div>
      </div>

      {/* Combined recommendation */}
      <section
        aria-label="Recomendação combinada de anticoagulação"
        aria-live="polite"
        className={cn(
          'rounded-xl border p-4 space-y-3',
          recommendationAccent
        )}
      >
        <div className="flex items-start gap-3">
          <Heart className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h4 className="text-base font-semibold">Decisão de anticoagulação</h4>
            <p className="text-sm font-medium">{panel.recommendation}</p>
          </div>
        </div>
      </section>

      {/* Clinical insight */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-info/10 shrink-0">
            <Info className="w-4 h-4 text-info" aria-hidden="true" />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Ponto-chave</p>
            <p>
              HAS-BLED alto <strong>NÃO</strong> contraindica anticoagulação — serve para
              identificar fatores modificáveis (hipertensão descontrolada, uso de AINE, INR
              lábil, álcool) que devem ser corrigidos para reduzir o risco hemorrágico.
            </p>
          </div>
        </div>
      </div>

      {/* Warning about age mutual exclusion */}
      {chadsValues.age75 && chadsValues.age65 && (
        <div
          role="alert"
          className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-warning font-medium">
            Idade 65-74 e Idade {'≥'} 75 são mutuamente exclusivos. Se o paciente tem {'≥'} 75 anos,
            desmarque &quot;Idade 65-74&quot;.
          </p>
        </div>
      )}

      {/* References */}
      <details className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground select-none min-h-[44px] flex items-center">
          Referências e notas
        </summary>
        <div className="mt-3 space-y-2">
          <p>
            <strong>CHA2DS2-VASc:</strong> Lip GY et al. Chest 2010;137(2):263-272. Validação do
            risco anual: Lip GY et al. Thromb Haemost 2010;104:1076-1088.
          </p>
          <p>
            <strong>HAS-BLED:</strong> Pisters R et al. Chest 2010;138(5):1093-1100.
          </p>
          <p>
            <strong>Diretrizes:</strong> ESC Guidelines for AF 2020 (Hindricks G et al. Eur Heart
            J 2021;42:373-498).
          </p>
          <p className="mt-3 pt-3 border-t border-border text-muted-foreground italic">
            Ferramenta auxiliar — não substitui o julgamento clínico do anestesiologista ou
            cardiologista. Decisões de anticoagulação perioperatória devem considerar risco
            cirúrgico, bridging e timing de suspensão/retorno.
          </p>
        </div>
      </details>
    </div>
  );
}
