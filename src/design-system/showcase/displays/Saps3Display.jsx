import { useState, useMemo } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Heart,
  RotateCcw,
  Stethoscope,
  Thermometer,
  User,
} from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { saps3 } from '../../../lib/saps3';

const AGE_OPTIONS = [
  { value: '25', label: '< 40 anos (0 pts)' },
  { value: '50', label: '40-59 anos (5 pts)' },
  { value: '65', label: '60-69 anos (9 pts)' },
  { value: '72', label: '70-74 anos (13 pts)' },
  { value: '77', label: '75-79 anos (15 pts)' },
  { value: '85', label: '≥ 80 anos (18 pts)' },
];

const ORIGIN_OPTIONS = [
  { value: 'centro_cirurgico', label: 'Centro cirúrgico (0 pts)' },
  { value: 'emergencia', label: 'Emergência (5 pts)' },
  { value: 'outro_hospital', label: 'Outro hospital (5 pts)' },
  { value: 'outro_uti', label: 'Outra UTI (7 pts)' },
  { value: 'enfermaria', label: 'Enfermaria (8 pts)' },
];

const DAYS_OPTIONS = [
  { value: '0', label: '< 14 dias (0 pts)' },
  { value: '20', label: '14-27 dias (6 pts)' },
  { value: '30', label: '≥ 28 dias (7 pts)' },
];

const REASON_OPTIONS = [
  { value: 'cardiovascular', label: 'Cardiovascular (0 pts)' },
  { value: 'respiratorio', label: 'Respiratório (0 pts)' },
  { value: 'digestivo', label: 'Digestivo (3 pts)' },
  { value: 'outro', label: 'Outro (3 pts)' },
  { value: 'neurologico', label: 'Neurológico (4 pts)' },
  { value: 'hepatico', label: 'Hepático (5 pts)' },
  { value: 'sepse', label: 'Sepse (8 pts)' },
];

const SURGERY_OPTIONS = [
  { value: 'eletiva', label: 'Eletiva (0 pts)' },
  { value: 'sem_cirurgia', label: 'Sem cirurgia (5 pts)' },
  { value: 'urgencia', label: 'Urgência (6 pts)' },
  { value: 'emergencia', label: 'Emergência (8 pts)' },
];

const INFECTION_OPTIONS = [
  { value: 'sem_infeccao', label: 'Sem infecção (0 pts)' },
  { value: 'respiratoria', label: 'Respiratória (3 pts)' },
  { value: 'outra', label: 'Outra infecção (3 pts)' },
  { value: 'nosocomial', label: 'Nosocomial (4 pts)' },
];

const GCS_OPTIONS = [
  { value: '15', label: 'GCS 13-15 (0 pts)' },
  { value: '10', label: 'GCS 8-12 (4 pts)' },
  { value: '6', label: 'GCS 6-7 (7 pts)' },
  { value: '4', label: 'GCS 4-5 (10 pts)' },
  { value: '3', label: 'GCS 3 (15 pts)' },
];

const BIL_OPTIONS = [
  { value: '0.5', label: '< 2 mg/dL (0 pts)' },
  { value: '3', label: '2-5,9 mg/dL (4 pts)' },
  { value: '8', label: '≥ 6 mg/dL (5 pts)' },
];

const TEMP_OPTIONS = [
  { value: '37', label: '≥ 35°C (0 pts)' },
  { value: '33', label: '< 35°C (7 pts)' },
];

const CR_OPTIONS = [
  { value: '0.8', label: '< 1,2 mg/dL (0 pts)' },
  { value: '1.5', label: '1,2-1,9 mg/dL (3 pts)' },
  { value: '2.5', label: '2,0-3,4 mg/dL (6 pts)' },
  { value: '4', label: '≥ 3,5 mg/dL (8 pts)' },
];

const HR_OPTIONS = [
  { value: '80', label: '< 120 bpm (0 pts)' },
  { value: '140', label: '120-159 bpm (5 pts)' },
  { value: '170', label: '≥ 160 bpm (7 pts)' },
];

const SBP_OPTIONS = [
  { value: '130', label: '≥ 120 mmHg (0 pts)' },
  { value: '100', label: '70-119 mmHg (3 pts)' },
  { value: '55', label: '40-69 mmHg (8 pts)' },
  { value: '30', label: '< 40 mmHg (11 pts)' },
];

const PF_OPTIONS = [
  { value: '300', label: '≥ 200 sem VM (0 pts)' },
  { value: '250_vm', label: '≥ 200 com VM (3 pts)' },
  { value: '150', label: '100-199 sem VM (7 pts)' },
  { value: '150_vm', label: '100-199 com VM (9 pts)' },
  { value: '80', label: '< 100 (11 pts)' },
];

const PH_OPTIONS = [
  { value: '7.4', label: '≥ 7,25 (0 pts)' },
  { value: '7.1', label: '< 7,25 (3 pts)' },
];

const PLT_OPTIONS = [
  { value: '200', label: '≥ 100 (0 pts)' },
  { value: '75', label: '50-99 (5 pts)' },
  { value: '35', label: '20-49 (8 pts)' },
  { value: '10', label: '< 20 (13 pts)' },
];

const COMORBIDITY_ITEMS = [
  { key: 'cancerMetastatico', label: 'Câncer metastático', pts: 11 },
  { key: 'cancerHematologico', label: 'Câncer hematológico', pts: 8 },
  { key: 'insufCardiacaNYHA4', label: 'IC classe NYHA IV', pts: 6 },
  { key: 'cirrose', label: 'Cirrose', pts: 4 },
  { key: 'aids', label: 'AIDS', pts: 4 },
  { key: 'irc', label: 'IRC em diálise', pts: 3 },
];

function SectionHeader({ icon: Icon, title, subtitle, isOpen, onToggle, points }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center justify-between w-full rounded-xl px-3 py-2.5 min-h-[44px]',
        'bg-muted/50 border border-border transition-colors hover:bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <div className="text-left">
          <span className="text-sm font-bold">{title}</span>
          {subtitle && <span className="ml-1.5 text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {points > 0 && (
          <span className="text-xs font-bold text-primary">{points} pts</span>
        )}
        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </div>
    </button>
  );
}

export default function Saps3Display() {
  const [openSection, setOpenSection] = useState('boxI');
  const [values, setValues] = useState({
    idade: '25',
    origemAdmissao: 'emergencia',
    diasAntesUTI: '0',
    comorbidades: {},
    admissaoPlanejada: false,
    motivoAdmissao: 'outro',
    tipoCirurgia: 'sem_cirurgia',
    infeccao: 'sem_infeccao',
    glasgow: '15',
    bilirrubina: '0.5',
    temperatura: '37',
    creatinina: '0.8',
    fc: '80',
    pas: '130',
    pao2fio2: '300',
    ventilacaoMecanica: false,
    ph: '7.4',
    plaquetas: '200',
    vasopressores: false,
  });

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const toggleComorbidity = (key) => {
    setValues((prev) => ({
      ...prev,
      comorbidades: {
        ...prev.comorbidades,
        [key]: !prev.comorbidades[key],
      },
    }));
  };

  const parsedValues = useMemo(() => {
    const pfStr = values.pao2fio2;
    const isVM = pfStr.endsWith('_vm') || values.ventilacaoMecanica;
    const pfNum = parseFloat(pfStr.replace('_vm', ''));

    return {
      ...values,
      idade: parseFloat(values.idade),
      diasAntesUTI: parseFloat(values.diasAntesUTI),
      glasgow: parseInt(values.glasgow, 10),
      bilirrubina: parseFloat(values.bilirrubina),
      temperatura: parseFloat(values.temperatura),
      creatinina: parseFloat(values.creatinina),
      fc: parseFloat(values.fc),
      pas: parseFloat(values.pas),
      pao2fio2: pfNum,
      ventilacaoMecanica: isVM,
      ph: parseFloat(values.ph),
      plaquetas: parseFloat(values.plaquetas),
    };
  }, [values]);

  const result = useMemo(() => saps3(parsedValues), [parsedValues]);

  const toggleSection = (s) => setOpenSection((prev) => (prev === s ? null : s));

  const handleReset = () => {
    setValues({
      idade: '25', origemAdmissao: 'emergencia', diasAntesUTI: '0',
      comorbidades: {}, admissaoPlanejada: false, motivoAdmissao: 'outro',
      tipoCirurgia: 'sem_cirurgia', infeccao: 'sem_infeccao',
      glasgow: '15', bilirrubina: '0.5', temperatura: '37',
      creatinina: '0.8', fc: '80', pas: '130', pao2fio2: '300',
      ventilacaoMecanica: false, ph: '7.4', plaquetas: '200',
      vasopressores: false,
    });
    setOpenSection('boxI');
  };

  const riskColor = {
    baixo: 'text-success',
    medio: 'text-warning',
    alto: 'text-destructive',
    critico: 'text-destructive',
  }[result.risk];

  const riskBg = {
    baixo: 'bg-success/10 border-success/30',
    medio: 'bg-warning/10 border-warning/30',
    alto: 'bg-destructive/10 border-destructive/30',
    critico: 'bg-destructive/10 border-destructive/30',
  }[result.risk];

  return (
    <div className="space-y-3">
      {/* Result card */}
      <div className={cn('rounded-xl border p-4 text-center', riskBg)}>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SAPS 3</p>
        <p className={cn('text-3xl font-extrabold mt-1', riskColor)}>{result.score}</p>
        <p className={cn('text-sm font-bold mt-1', riskColor)}>
          Mortalidade: {result.mortalityPct}%
        </p>
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>Box I: {result.boxI.total}</span>
          <span>Box II: {result.boxII.total}</span>
          <span>Box III: {result.boxIII.total}</span>
        </div>
      </div>

      {/* Box I: Patient characteristics */}
      <SectionHeader
        icon={User}
        title="Box I"
        subtitle="Dados prévios"
        isOpen={openSection === 'boxI'}
        onToggle={() => toggleSection('boxI')}
        points={result.boxI.total}
      />
      {openSection === 'boxI' && (
        <div className="space-y-3 pl-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Idade</label>
            <Select value={values.idade} onValueChange={(v) => handleChange('idade', v)} options={AGE_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Origem da admissão</label>
            <Select value={values.origemAdmissao} onValueChange={(v) => handleChange('origemAdmissao', v)} options={ORIGIN_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Dias de hospital antes da UTI</label>
            <Select value={values.diasAntesUTI} onValueChange={(v) => handleChange('diasAntesUTI', v)} options={DAYS_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Comorbidades</label>
            <div className="space-y-1.5">
              {COMORBIDITY_ITEMS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleComorbidity(c.key)}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left min-h-[44px]',
                    'border border-border transition-colors text-sm',
                    values.comorbidades[c.key]
                      ? 'border-primary bg-muted ring-1 ring-primary font-semibold'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border',
                    values.comorbidades[c.key] ? 'border-primary bg-primary text-white' : 'border-border'
                  )}>
                    {values.comorbidades[c.key] && <Activity className="size-2.5" />}
                  </div>
                  <span>{c.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">+{c.pts}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Box II: Circumstances */}
      <SectionHeader
        icon={Clock}
        title="Box II"
        subtitle="Circunstâncias da admissão"
        isOpen={openSection === 'boxII'}
        onToggle={() => toggleSection('boxII')}
        points={result.boxII.total}
      />
      {openSection === 'boxII' && (
        <div className="space-y-3 pl-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Admissão planejada?</label>
            <div className="flex gap-2 mt-1">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => handleChange('admissaoPlanejada', val)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px]',
                    'border border-border transition-colors',
                    values.admissaoPlanejada === val
                      ? 'border-primary bg-muted ring-1 ring-primary'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  {val ? 'Sim (0 pts)' : 'Não (+3 pts)'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Motivo da admissão</label>
            <Select value={values.motivoAdmissao} onValueChange={(v) => handleChange('motivoAdmissao', v)} options={REASON_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tipo de cirurgia</label>
            <Select value={values.tipoCirurgia} onValueChange={(v) => handleChange('tipoCirurgia', v)} options={SURGERY_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Infecção na admissão</label>
            <Select value={values.infeccao} onValueChange={(v) => handleChange('infeccao', v)} options={INFECTION_OPTIONS} />
          </div>
        </div>
      )}

      {/* Box III: Physiologic */}
      <SectionHeader
        icon={Stethoscope}
        title="Box III"
        subtitle="Variáveis fisiológicas"
        isOpen={openSection === 'boxIII'}
        onToggle={() => toggleSection('boxIII')}
        points={result.boxIII.total}
      />
      {openSection === 'boxIII' && (
        <div className="space-y-3 pl-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Glasgow (GCS)</label>
            <Select value={values.glasgow} onValueChange={(v) => handleChange('glasgow', v)} options={GCS_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bilirrubina</label>
            <Select value={values.bilirrubina} onValueChange={(v) => handleChange('bilirrubina', v)} options={BIL_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Temperatura</label>
            <Select value={values.temperatura} onValueChange={(v) => handleChange('temperatura', v)} options={TEMP_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Creatinina</label>
            <Select value={values.creatinina} onValueChange={(v) => handleChange('creatinina', v)} options={CR_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Frequência cardíaca</label>
            <Select value={values.fc} onValueChange={(v) => handleChange('fc', v)} options={HR_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">PAS (Pressão arterial sistólica)</label>
            <Select value={values.pas} onValueChange={(v) => handleChange('pas', v)} options={SBP_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">PaO₂/FiO₂ e Ventilação</label>
            <Select value={values.pao2fio2} onValueChange={(v) => handleChange('pao2fio2', v)} options={PF_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">pH arterial</label>
            <Select value={values.ph} onValueChange={(v) => handleChange('ph', v)} options={PH_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Plaquetas (×10³/µL)</label>
            <Select value={values.plaquetas} onValueChange={(v) => handleChange('plaquetas', v)} options={PLT_OPTIONS} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Vasopressores</label>
            <div className="flex gap-2 mt-1">
              {[false, true].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => handleChange('vasopressores', val)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px]',
                    'border border-border transition-colors',
                    values.vasopressores === val
                      ? 'border-primary bg-muted ring-1 ring-primary'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  {val ? 'Sim (+3 pts)' : 'Não (0 pts)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reset */}
      <Button variant="ghost" onClick={handleReset} className="w-full">
        <RotateCcw className="mr-2 size-4" />
        Limpar
      </Button>
    </div>
  );
}
