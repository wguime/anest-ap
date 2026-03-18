import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronDown,
  Check,
  ClipboardCheck,
  Activity,
  Layers,
  RotateCcw,
  AlertTriangle,
  BookOpen,
  Stethoscope,
} from 'lucide-react';
import { WidgetCard, Select, RiskFactorCard } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  CATEGORIAS,
  getCalculatorById,
  getCalculatorsByCategoria,
  POTTER_CALCULATOR,
} from '../data/criteriosUtiCalculators';

// Mapa de cores para niveis de risco
const COR_MAP = {
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300',
  },
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  },
};

const CATEGORIA_ICONS = {
  ClipboardCheck,
  Activity,
  Layers,
};

// Icones para cada calculadora nos WidgetCards
const CALC_ICONS = {
  sort: Stethoscope,
  ess: AlertTriangle,
  potter: Activity,
  sas: ClipboardCheck,
  siaarti: Layers,
};

// =============================================
// SectionHeader — accordion (identico ao CalculatorShowcase)
// =============================================
function SectionHeader({ icon, title, count, isOpen, onToggle }) {
  const IconComponent = CATEGORIA_ICONS[icon] || ClipboardCheck;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full h-16 flex items-center gap-4 px-4',
        'rounded-xl',
        'bg-card',
        'border border-[#E0E0E0] dark:border-border',
        'hover:bg-[#F5F5F5] dark:hover:bg-muted',
        'hover:border-primary dark:hover:border-primary',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50',
        'transition-all duration-200',
        isOpen && 'shadow-md border-primary'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          'w-11 h-11 rounded-xl flex-shrink-0',
          'bg-muted',
          isOpen && 'bg-primary'
        )}
      >
        <IconComponent
          className={cn(
            'w-5 h-5 transition-colors duration-200',
            isOpen ? 'text-white dark:text-foreground' : 'text-primary'
          )}
        />
      </div>

      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">{title}</span>

      <span
        className={cn(
          'flex items-center justify-center',
          'min-w-[32px] h-7 px-2.5 rounded-full',
          'text-sm font-bold',
          'bg-muted',
          'text-primary'
        )}
      >
        {count}
      </span>

      <ChevronDown
        className={cn(
          'w-5 h-5 flex-shrink-0',
          'text-muted-foreground dark:text-muted-foreground',
          'transition-transform duration-300 ease-out',
          isOpen && 'rotate-180 text-primary'
        )}
      />
    </button>
  );
}

// =============================================
// Painel de resultado (score, motivos, disclaimer, reset)
// =============================================
function ResultPanel({ result, onReset }) {
  const cores = COR_MAP[result.cor] || COR_MAP.green;

  return (
    <div className="space-y-4">
      {/* Score e nivel */}
      <div className={`rounded-2xl p-5 border-2 ${cores.bg} ${cores.border}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-foreground">
            Score: {result.scoreLabel}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${cores.badge}`}>
            {result.nivel}
          </span>
        </div>
        <p className={`text-sm font-medium ${cores.text}`}>{result.conduta}</p>
        {result.mortalidade && (
          <p className="text-xs text-muted-foreground mt-1">
            Mortalidade estimada: {result.mortalidade}
          </p>
        )}
        {result.nota && (
          <p className="text-xs text-muted-foreground mt-1 italic">{result.nota}</p>
        )}
      </div>

      {/* Motivos */}
      {result.motivos && result.motivos.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              Motivos do Encaminhamento
            </h4>
          </div>
          <ul className="space-y-1.5">
            {result.motivos.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-foreground flex-1">{m.label}</span>
                {m.coef && (
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    ({m.coef})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div
        className={cn(
          'p-4 rounded-xl',
          'bg-muted',
          'border border-border'
        )}
      >
        <p className="text-xs text-muted-foreground">
          <strong>Nota:</strong> Ferramenta de apoio à decisão clínica. Não substitui o julgamento
          profissional do anestesiologista.
        </p>
      </div>

      {/* Botao recalcular */}
      <button
        type="button"
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white dark:text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
      >
        <RotateCcw className="w-4 h-4" />
        Nova Avaliação
      </button>
    </div>
  );
}

// =============================================
// Referências e tabela de interpretação (sempre visíveis)
// =============================================
function CalcInfoPanel({ calc }) {
  return (
    <div className="space-y-4">
      {/* Tabela interpretacao */}
      {calc.interpretacao && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h4 className="text-sm font-bold text-foreground mb-3">
            Tabela de Interpretação
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-border">
                  <th className="text-left py-1.5 pr-2 text-muted-foreground font-medium">
                    Faixa
                  </th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">
                    Nível
                  </th>
                  <th className="text-left py-1.5 pl-2 text-muted-foreground font-medium">
                    Conduta
                  </th>
                </tr>
              </thead>
              <tbody>
                {calc.interpretacao.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[#F3F4F6] dark:border-[#1A2F23] last:border-0"
                  >
                    <td className="py-1.5 pr-2 text-foreground font-mono">
                      {row.faixa}
                    </td>
                    <td className="py-1.5 px-2 text-foreground">{row.nivel}</td>
                    <td className="py-1.5 pl-2 text-foreground">
                      {row.conduta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Referencias */}
      {calc.references && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              Referências Científicas
            </h4>
          </div>
          <ul className="space-y-2">
            {calc.references.map((ref, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                {ref}
              </li>
            ))}
          </ul>
          {calc.auroc && (
            <p className="text-xs font-medium text-primary mt-2">
              AUROC: {calc.auroc}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================
// Sub-calculadora inline (Charlson, CFS, RCRI)
// =============================================
function SubCalculatorCard({ input, parentValue, inputId, onValueChange }) {
  const [expanded, setExpanded] = useState(false);
  const [subValues, setSubValues] = useState({});

  const subCalc = input.subCalculator;
  const subScore = useMemo(() => subCalc.compute(subValues), [subValues, subCalc]);
  const meetsThreshold = subScore >= subCalc.threshold;
  const hasInteracted = Object.keys(subValues).length > 0;

  useEffect(() => {
    if (hasInteracted && meetsThreshold !== parentValue) {
      onValueChange(inputId, meetsThreshold);
    }
  }, [meetsThreshold, hasInteracted, parentValue, onValueChange, inputId]);

  const toggleSubItem = (itemId) => {
    setSubValues((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  return (
    <div>
      {/* Card principal — clique expande/recolhe */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all',
          parentValue
            ? 'bg-muted border-primary'
            : 'bg-card border-[#E5E7EB] dark:border-border',
          'hover:border-border dark:hover:border-primary/50'
        )}
      >
        <div
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            parentValue
              ? 'bg-primary border-primary'
              : 'border-[#D1D5DB] dark:border-[#4B5563]'
          )}
        >
          {parentValue && <Check className="w-3.5 h-3.5 text-white dark:text-primary-foreground" />}
        </div>

        <span className="flex-1 text-left text-sm font-medium text-foreground">{input.label}</span>

        {hasInteracted && (
          <span
            className={cn(
              'text-xs font-mono px-2 py-0.5 rounded-full',
              meetsThreshold
                ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            )}
          >
            {subScore}
          </span>
        )}

        {input.pts > 0 && (
          <span className="text-xs font-semibold text-primary bg-muted px-2 py-0.5 rounded-full shrink-0">
            +{input.pts}
          </span>
        )}

        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Sub-calculadora expandida */}
      {expanded && (
        <div className="mt-1.5 ml-3 p-3 rounded-xl bg-[#F8FAF9] dark:bg-[#151E1A] border border-[#E5E7EB] dark:border-border">
          <p className="text-xs font-bold text-foreground mb-2.5">
            {subCalc.title}
          </p>

          <div className="space-y-0.5">
            {subCalc.items.map((item) =>
              item.type === 'select' ? (
                <div key={item.id} className="py-1">
                  <Select
                    label={item.label}
                    placeholder="Selecione..."
                    value={subValues[item.id]?.toString() ?? ''}
                    onChange={(val) =>
                      setSubValues((prev) => ({ ...prev, [item.id]: parseInt(val, 10) }))
                    }
                    options={item.options.map((opt) => ({
                      value: opt.value.toString(),
                      label: opt.label,
                    }))}
                  />
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSubItem(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 py-2 px-2 rounded-lg transition-colors',
                    subValues[item.id]
                      ? 'bg-muted/50'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      subValues[item.id]
                        ? 'bg-primary border-primary'
                        : 'border-[#D1D5DB] dark:border-[#4B5563]'
                    )}
                  >
                    {subValues[item.id] && (
                      <Check className="w-3 h-3 text-white dark:text-primary-foreground" />
                    )}
                  </div>
                  <span className="flex-1 text-left text-xs text-foreground">{item.label}</span>
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                    +{item.pts}
                  </span>
                </button>
              )
            )}
          </div>

          {/* Resumo do score */}
          <div className="mt-2.5 pt-2 border-t border-[#E5E7EB] dark:border-border flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Score: {subScore}</span>
            <span
              className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                meetsThreshold
                  ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              )}
            >
              {subCalc.thresholdLabel}: {meetsThreshold ? 'Sim' : 'Não'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// Formulario padrao — usa DS Select (dropdown) e RiskFactorCard (bool)
// =============================================
function StandardForm({ calc }) {
  const [values, setValues] = useState({});

  const handleChange = useCallback((id, val) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  const allInputs = calc.sections ? calc.sections.flatMap((s) => s.inputs) : calc.inputs;

  const isComplete = allInputs.every((input) => {
    const val = values[input.id];
    if (input.type === 'bool') return true;
    return val !== undefined && val !== null;
  });

  // Auto-calcula quando todos os campos obrigatórios estão preenchidos
  const result = useMemo(() => {
    if (!isComplete) return null;
    return calc.compute(values);
  }, [isComplete, values, calc]);

  const renderInput = (input) => {
    // Sub-calculadora inline (Charlson, CFS, RCRI)
    if (input.subCalculator) {
      return (
        <SubCalculatorCard
          key={input.id}
          input={input}
          parentValue={!!values[input.id]}
          inputId={input.id}
          onValueChange={handleChange}
        />
      );
    }

    if (input.type === 'bool') {
      return (
        <RiskFactorCard
          key={input.id}
          title={input.label}
          description={input.sublabel}
          points={input.pts || 0}
          showPoints={!!input.pts}
          selected={!!values[input.id]}
          onSelect={(isSelected) => handleChange(input.id, isSelected)}
        />
      );
    }
    // type === 'select' → DS Select dropdown
    return (
      <Select
        key={input.id}
        label={input.label}
        placeholder="Selecione..."
        value={values[input.id]?.toString() ?? ''}
        onChange={(val) => {
          const numVal = parseFloat(val);
          handleChange(input.id, isNaN(numVal) ? val : numVal);
        }}
        options={input.options.map((opt) => ({
          value: opt.value?.toString(),
          label: opt.detail ? `${opt.label} (${opt.detail})` : opt.label,
        }))}
      />
    );
  };

  return (
    <div className="space-y-6">
      {calc.sections ? (
        calc.sections.map((section) => (
          <div key={section.title}>
            <div className="mb-3">
              <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
              {section.sublabel && (
                <p className="text-xs text-muted-foreground">{section.sublabel}</p>
              )}
            </div>
            <div className="space-y-3">{section.inputs.map(renderInput)}</div>
          </div>
        ))
      ) : (
        <div className="space-y-4">{allInputs.map(renderInput)}</div>
      )}

      {/* Resultado automático */}
      {result && <ResultPanel result={result} onReset={() => setValues({})} />}
    </div>
  );
}

// =============================================
// POTTER Wizard (arvore adaptativa)
// =============================================
function PotterWizard({ onResult }) {
  const [path, setPath] = useState([]);
  const [currentNode, setCurrentNode] = useState(POTTER_CALCULATOR.tree);

  const totalEstimatedSteps = 5;
  const progress = Math.min((path.length / totalEstimatedSteps) * 100, 95);

  const handleAnswer = (value, label) => {
    const branch = currentNode.branches[value];
    const newPath = [
      ...path,
      { nodeId: currentNode.id, question: currentNode.question, answer: value, answerLabel: label },
    ];

    if (branch.result) {
      const resultInfo = POTTER_CALCULATOR.resultMap[branch.result];
      const motivos = newPath.map((p) => ({
        label: `${p.question} → ${p.answerLabel}`,
        coef: '',
      }));
      onResult({
        score: null,
        scoreLabel: resultInfo.nivel,
        nivel: resultInfo.nivel,
        conduta: resultInfo.conduta,
        cor: resultInfo.cor,
        mortalidade: branch.mortalidade,
        motivos,
      });
    } else {
      setPath(newPath);
      setCurrentNode(branch);
    }
  };

  const handleBack = () => {
    if (path.length === 0) return;
    const newPath = path.slice(0, -1);
    let node = POTTER_CALCULATOR.tree;
    for (const step of newPath) {
      node = node.branches[step.answer];
    }
    setPath(newPath);
    setCurrentNode(node);
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            Pergunta {path.length + 1}
          </span>
          {path.length > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="text-xs text-primary font-medium hover:opacity-70"
            >
              Voltar pergunta
            </button>
          )}
        </div>
        <div className="h-2 bg-[#E5E7EB] dark:bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Pergunta atual */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="text-base font-bold text-foreground mb-1">
          {currentNode.question}
        </h3>
        {currentNode.sublabel && (
          <p className="text-xs text-muted-foreground mb-4">
            {currentNode.sublabel}
          </p>
        )}

        <div className="space-y-2 mt-4">
          {currentNode.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleAnswer(opt.value, opt.label)}
              className={cn(
                'w-full text-left p-3 rounded-xl border-2 transition-all',
                'flex items-center justify-between gap-3',
                'bg-card border-[#E5E7EB] dark:border-border hover:border-border',
                'text-sm font-medium text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Caminho percorrido */}
      {path.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Respostas anteriores
          </p>
          <ul className="space-y-1">
            {path.map((step, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="text-primary">{i + 1}.</span>{' '}
                {step.answerLabel}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================
// Pagina de uma calculadora individual
// =============================================
function CalculatorDetailPage({ calcId, onBack }) {
  const calc = getCalculatorById(calcId);
  const [potterResult, setPotterResult] = useState(null);

  if (!calc) return null;

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{calc.name}</h2>
        <p className="text-sm text-muted-foreground">{calc.fullName}</p>
        {calc.nota && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">{calc.nota}</p>
        )}
      </div>

      {/* Formulário / Wizard */}
      {calc.id === 'potter' ? (
        potterResult ? (
          <ResultPanel result={potterResult} onReset={() => setPotterResult(null)} />
        ) : (
          <PotterWizard onResult={setPotterResult} />
        )
      ) : (
        <StandardForm calc={calc} />
      )}

      {/* Sempre visível: tabela de interpretação + referências */}
      <CalcInfoPanel calc={calc} />
    </div>
  );
}

// =============================================
// PAGINA PRINCIPAL: CriteriosUTIPage
// =============================================
export default function CriteriosUTIPage({ onNavigate, goBack }) {
  const [selectedCalc, setSelectedCalc] = useState(null);
  const [openSections, setOpenSections] = useState({ pre: true });

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={selectedCalc ? () => setSelectedCalc(null) : goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {selectedCalc
              ? getCalculatorById(selectedCalc)?.name || 'Calculadora'
              : 'Critérios UTI'}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {selectedCalc ? (
          <CalculatorDetailPage calcId={selectedCalc} onBack={() => setSelectedCalc(null)} />
        ) : (
          <div className="space-y-4 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center',
                  'w-12 h-12 rounded-xl',
                  'bg-muted'
                )}
              >
                <Stethoscope className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Critérios UTI</h1>
                <p className="text-sm text-muted-foreground">
                  5 calculadoras de triagem pós-operatória
                </p>
              </div>
            </div>

            {/* Secoes com calculadoras — accordion + WidgetCard grid */}
            <div className="space-y-3">
              {CATEGORIAS.map((cat) => {
                const calcs = getCalculatorsByCategoria(cat.id);
                if (calcs.length === 0) return null;
                const isOpen = !!openSections[cat.id];

                return (
                  <section key={cat.id}>
                    <SectionHeader
                      icon={cat.icon}
                      title={cat.label}
                      count={calcs.length}
                      isOpen={isOpen}
                      onToggle={() => toggleSection(cat.id)}
                    />
                    {isOpen && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {calcs.map((calc) => {
                          const IconComp = CALC_ICONS[calc.id] || ClipboardCheck;
                          return (
                            <WidgetCard
                              key={calc.id}
                              icon={<IconComp className="w-5 h-5" />}
                              title={calc.name}
                              subtitle={calc.descricao}
                              variant="interactive"
                              onClick={() => setSelectedCalc(calc.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Info Footer — identico ao CalculatorShowcase */}
            <div
              className={cn(
                'p-4 rounded-xl',
                'bg-muted',
                'border border-border'
              )}
            >
              <p className="text-xs text-muted-foreground">
                <strong>Nota:</strong> Ferramentas de apoio à decisão clínica baseadas em revisão
                sistemática da literatura (2023-2025). Não substituem o julgamento profissional do
                anestesiologista. Todas validadas contra literatura médica indexada (PubMed, NCBI).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
