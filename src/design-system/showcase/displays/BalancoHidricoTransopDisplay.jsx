import { useMemo, useState } from 'react';
import {
  Droplets,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  TrendingDown,
  User,
  Baby,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import {
  evaluateBalance,
  fastingDeficit,
  furmanReplacement,
  estimatedBloodVolume,
  categoryForPopulation,
} from '../../../lib/fluidBalance';

const PORTE_OPTIONS = [
  { value: 'pequeno', label: 'Pequeno porte (2 ml/kg/h) — herniorrafia, ortopedia menor' },
  { value: 'medio', label: 'Médio porte (4 ml/kg/h) — colecistectomia, histerectomia' },
  { value: 'grande', label: 'Grande porte (6 ml/kg/h) — laparotomia, toracotomia' },
];

const PED_CATEGORY_OPTIONS = [
  { value: 'prematuro', label: 'Prematuro (95 ml/kg)' },
  { value: 'neonato', label: 'Neonato 0-30 dias (85 ml/kg)' },
  { value: 'lactente', label: 'Lactente 1-12 meses (80 ml/kg)' },
  { value: 'crianca', label: 'Criança 1-12 anos (75 ml/kg)' },
];

function makeHoraId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `h-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function emptyHora() {
  return {
    id: makeHoraId(),
    cristaloide: '',
    coloide: '',
    sangueDerivados: '',
    sangramento: '',
    diurese: '',
    outras: '',
  };
}

const fmt = (n, digits = 0) => {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
};

function PillToggle({ value, onChange }) {
  const opts = [
    { v: 'adulto', label: 'Adulto', icon: User },
    { v: 'pediatrico', label: 'Pediátrico', icon: Baby },
  ];
  return (
    <div
      role="tablist"
      aria-label="População"
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

function MetricCard({ label, value, unit, accent = 'default' }) {
  const accentClass = {
    default: 'bg-muted border-border',
    success: 'bg-success/10 border-success/40 text-success',
    warning: 'bg-warning/10 border-warning/40 text-warning',
    destructive: 'bg-destructive/10 border-destructive/40 text-destructive',
    primary: 'bg-primary/10 border-primary/40 text-primary',
  }[accent];

  return (
    <div className={cn('p-3 rounded-xl border text-center', accentClass)}>
      <p className="text-[11px] uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {unit && <p className="text-xs opacity-70 mt-0.5">{unit}</p>}
    </div>
  );
}

function HoraRow({ index, hora, onChange, onRemove }) {
  const set = (key) => (e) => {
    const val = e?.target?.value ?? e;
    onChange({ ...hora, [key]: val });
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border-strong bg-card p-3 space-y-3',
        'md:grid md:grid-cols-[auto_repeat(6,1fr)_auto] md:gap-2 md:space-y-0 md:items-end'
      )}
    >
      <div className="flex items-center justify-between md:block">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          Hora {index + 1}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remover hora ${index + 1}`}
          className="md:hidden text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
        <Input
          type="number"
          label="Cristaloide (ml)"
          value={hora.cristaloide}
          onChange={set('cristaloide')}
          min={0}
          placeholder="0"
        />
        <Input
          type="number"
          label="Coloide (ml)"
          value={hora.coloide}
          onChange={set('coloide')}
          min={0}
          placeholder="0"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
        <Input
          type="number"
          label="Sangue/Hemod. (ml)"
          value={hora.sangueDerivados}
          onChange={set('sangueDerivados')}
          min={0}
          placeholder="0"
        />
        <Input
          type="number"
          label="Sangramento (ml)"
          value={hora.sangramento}
          onChange={set('sangramento')}
          min={0}
          placeholder="0"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
        <Input
          type="number"
          label="Diurese (ml)"
          value={hora.diurese}
          onChange={set('diurese')}
          min={0}
          placeholder="0"
        />
        <Input
          type="number"
          label="Outras saídas (ml)"
          value={hora.outras}
          onChange={set('outras')}
          min={0}
          placeholder="0"
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label={`Remover hora ${index + 1}`}
        className="hidden md:inline-flex text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function BalancoHidricoTransopDisplay() {
  const [populacao, setPopulacao] = useState('adulto');
  const [pedCategory, setPedCategory] = useState('crianca');
  const [peso, setPeso] = useState('');
  const [npoHoras, setNpoHoras] = useState('');
  const [porte, setPorte] = useState('medio');
  const [hctInicial, setHctInicial] = useState('');
  const [hctMinimo, setHctMinimo] = useState('25');
  const [horas, setHoras] = useState([]);

  const isPediatric = populacao === 'pediatrico';
  const category = isPediatric ? pedCategory : categoryForPopulation('adulto');
  const pesoN = parseFloat(peso) || 0;
  const npoN = parseFloat(npoHoras) || 0;
  const hctIN = parseFloat(hctInicial) || 0;
  const hctMN = parseFloat(hctMinimo) || 0;

  const result = useMemo(
    () =>
      evaluateBalance({
        weightKg: pesoN,
        npoHours: npoN,
        porte,
        category,
        hctInicial: hctIN,
        hctMinimo: hctMN,
        isPediatric,
        hours: horas,
      }),
    [pesoN, npoN, porte, category, hctIN, hctMN, isPediatric, horas]
  );

  const deficit = useMemo(() => fastingDeficit(pesoN, npoN), [pesoN, npoN]);
  const ebv = useMemo(() => estimatedBloodVolume(pesoN, category), [pesoN, category]);
  const furman1 = useMemo(() => furmanReplacement(pesoN, npoN, 1), [pesoN, npoN]);
  const furman2 = useMemo(() => furmanReplacement(pesoN, npoN, 2), [pesoN, npoN]);
  const furman3 = useMemo(() => furmanReplacement(pesoN, npoN, 3), [pesoN, npoN]);

  const hasPreop = pesoN > 0;

  const addHora = () => setHoras((arr) => [...arr, emptyHora()]);
  const updateHora = (idx, next) =>
    setHoras((arr) => arr.map((h, i) => (i === idx ? next : h)));
  const removeHora = (idx) => setHoras((arr) => arr.filter((_, i) => i !== idx));
  const resetAll = () => {
    setHoras([]);
    setPeso('');
    setNpoHoras('');
    setHctInicial('');
  };

  const balancoAccent = (() => {
    const b = result.balancoNet;
    if (Math.abs(b) < 500) return 'success';
    if (Math.abs(b) < 1500) return 'warning';
    return 'destructive';
  })();

  return (
    <div className="space-y-4">
      {/* Bloco pré-op */}
      <section
        aria-labelledby="preop-heading"
        className="rounded-xl border border-border-strong bg-card p-4 space-y-4"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 id="preop-heading" className="text-base font-semibold text-foreground flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" aria-hidden="true" />
            Parâmetros pré-operatórios
          </h3>
          <PillToggle value={populacao} onChange={setPopulacao} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input
            type="number"
            label="Peso (kg)"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            min={0.5}
            max={200}
            step={0.1}
            placeholder={isPediatric ? '15' : '70'}
            required
          />
          <Input
            type="number"
            label="Horas de jejum"
            value={npoHoras}
            onChange={(e) => setNpoHoras(e.target.value)}
            min={0}
            max={24}
            step={1}
            placeholder="8"
          />
          <Select
            label="Porte cirúrgico"
            options={PORTE_OPTIONS}
            value={porte}
            onChange={setPorte}
            placeholder="Selecione o porte"
          />
          {isPediatric && (
            <Select
              label="Faixa etária pediátrica"
              options={PED_CATEGORY_OPTIONS}
              value={pedCategory}
              onChange={setPedCategory}
            />
          )}
          <Input
            type="number"
            label="Hct inicial (%)"
            value={hctInicial}
            onChange={(e) => setHctInicial(e.target.value)}
            min={15}
            max={65}
            step={1}
            placeholder="40"
          />
          <Input
            type="number"
            label="Hct mínimo aceitável (%)"
            value={hctMinimo}
            onChange={(e) => setHctMinimo(e.target.value)}
            min={15}
            max={40}
            step={1}
            placeholder="25"
          />
        </div>
      </section>

      {/* Estimativas iniciais */}
      {hasPreop && (
        <section
          aria-labelledby="estimativas-heading"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-3"
        >
          <h3
            id="estimativas-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <TrendingDown className="w-5 h-5 text-primary" aria-hidden="true" />
            Estimativas iniciais
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard
              label="Manutenção"
              value={fmt(result.rate, 0)}
              unit="ml/h"
              accent="primary"
            />
            <MetricCard label="Déficit jejum" value={fmt(deficit, 0)} unit="ml total" />
            <MetricCard
              label="3º espaço"
              value={fmt(result.tsLoss, 0)}
              unit="ml/h"
            />
            <MetricCard
              label="Meta diurese"
              value={fmt(result.goalRate, 0)}
              unit="ml/h"
              accent="success"
            />
            <MetricCard label="EBV" value={fmt(ebv, 0)} unit="ml" />
            <MetricCard
              label="ABL"
              value={result.abl > 0 ? fmt(result.abl, 0) : '—'}
              unit={result.abl > 0 ? 'ml' : 'Hct insuf.'}
              accent={result.abl > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="rounded-lg bg-info/10 border border-info/40 p-3 text-xs text-info space-y-1">
            <p className="font-semibold">Plano de reposição do déficit (Furman 50/25/25):</p>
            <p>
              <span className="font-medium">1ª hora:</span> {fmt(furman1, 0)} ml ·{' '}
              <span className="font-medium">2ª hora:</span> {fmt(furman2, 0)} ml ·{' '}
              <span className="font-medium">3ª hora:</span> {fmt(furman3, 0)} ml
            </p>
          </div>
        </section>
      )}

      {/* Acompanhamento hora a hora */}
      <section
        aria-labelledby="horas-heading"
        className="rounded-xl border border-border-strong bg-card p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3
            id="horas-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
            Acompanhamento hora a hora
          </h3>
          {horas.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAll}
              className="text-muted-foreground hover:text-destructive min-h-[44px]"
              aria-label="Limpar todos os registros"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Limpar
            </Button>
          )}
        </div>

        {!hasPreop && (
          <p className="text-sm text-muted-foreground italic">
            Preencha o peso primeiro para iniciar o registro.
          </p>
        )}

        {hasPreop && horas.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma hora registrada ainda. Use o botão abaixo para adicionar a 1ª hora.
          </p>
        )}

        {horas.map((h, i) => (
          <HoraRow
            key={h.id}
            index={i}
            hora={h}
            onChange={(next) => updateHora(i, next)}
            onRemove={() => removeHora(i)}
          />
        ))}

        {hasPreop && (
          <Button
            variant="outline"
            onClick={addHora}
            className="w-full min-h-[44px]"
            aria-label="Adicionar nova hora"
          >
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Adicionar hora {horas.length + 1}
          </Button>
        )}
      </section>

      {/* Balanço acumulado */}
      {hasPreop && horas.length > 0 && (
        <section
          aria-labelledby="balanco-heading"
          aria-live="polite"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-3"
        >
          <h3
            id="balanco-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <Droplets className="w-5 h-5 text-primary" aria-hidden="true" />
            Balanço acumulado ({horas.length} {horas.length === 1 ? 'hora' : 'horas'})
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard
              label="Infundido"
              value={fmt(result.totalInfundido, 0)}
              unit="ml"
              accent="primary"
            />
            <MetricCard
              label="Sangramento"
              value={fmt(result.totalSangramento, 0)}
              unit="ml"
              accent={result.totalSangramento > 0 ? 'destructive' : 'default'}
            />
            <MetricCard
              label="Diurese"
              value={fmt(result.totalDiurese, 0)}
              unit={`ml (meta ${fmt(result.metaDiureseAcumulada, 0)})`}
              accent={
                result.totalDiurese >= result.metaDiureseAcumulada ? 'success' : 'warning'
              }
            />
            <MetricCard
              label="Manutenção (calc.)"
              value={fmt(result.totalManutencao, 0)}
              unit="ml acumulados"
            />
            <MetricCard
              label="3º espaço (calc.)"
              value={fmt(result.totalTerceiroEspaco, 0)}
              unit="ml acumulados"
            />
            <MetricCard
              label="Balanço net"
              value={`${result.balancoNet >= 0 ? '+' : ''}${fmt(result.balancoNet, 0)}`}
              unit="ml"
              accent={balancoAccent}
            />
            <MetricCard
              label="ABL restante"
              value={result.abl > 0 ? fmt(result.ablRestante, 0) : '—'}
              unit={result.abl > 0 ? 'ml até transfusão' : ''}
              accent={
                result.abl > 0 && result.ablRestante < result.abl * 0.25
                  ? 'destructive'
                  : 'default'
              }
            />
          </div>

          {result.alerts.length > 0 && (
            <div className="space-y-2 mt-2" role="alert">
              {result.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 p-3 rounded-lg border text-sm',
                    alert.level === 'destructive'
                      ? 'bg-destructive/10 border-destructive/40 text-destructive'
                      : 'bg-warning/10 border-warning/40 text-warning'
                  )}
                >
                  <AlertTriangle
                    className="w-4 h-4 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
