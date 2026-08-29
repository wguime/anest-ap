/**
 * CalculatorShowcase - Aba "Calculadoras"
 *
 * - Layout por SECOES (como App Legado)
 * - SEM tabs no topo
 * - Grid 2 colunas de WidgetCards por secao
 * - Clique abre PAGINA DEDICADA para calculadora
 * - RiskFactorCard para inputs booleanos com pontos
 * - Calculo AUTOMATICO ao preencher inputs (sem botao)
 * - SEM barra de progresso nos resultados
 * - InfoBox com interpretacao e referencia ao final
 * - Busca filtra em TODAS secoes
 */

import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { Search, Calculator, Baby, Heart, HeartPulse, Wind, Shield, Stethoscope, Droplet, Activity, Brain, User, X, ArrowLeft, Info, Siren, Pill, RotateCcw, BedDouble, Scale, Thermometer, Check, Zap, Ruler, Clock, ClipboardCheck, AlertTriangle, TrendingDown, BarChart2, Frown, Flame, Droplets, Syringe, Moon, AlertCircle, Apple, FileText, Eye, Bed, Beaker, FlaskConical, RefreshCw, Plus, Minus, Bell, Bone, BookOpen, ListChecks, ChevronDown, ShieldAlert, Bug, Star } from 'lucide-react';
import { cn } from '../utils/tokens';
import { WidgetCard } from '../components/ui/widget-card';
import { RiskFactorCard } from '../components/anest/risk-factor-card';
import { ClinicalDisclaimer } from '../components/anest/clinical-disclaimer';
import { Input } from '../components/ui/input';
import { useUser } from '../../contexts/UserContext';

// A seção "Indicação de UTI" reaproveita a renderização que já existe na
// `CriteriosUTIPage` — árvore de decisão, seções com subtotal e interpretação
// por faixa — em vez de reescrever 766 linhas de tela de decisão clínica.
// ⚠️ `lazy` para o chunk dela não entrar no bundle de quem nunca abre a seção;
// precisa de Suspense LOCAL, senão o React congela a tela anterior sem erro.
const CriterioUtiDetalhe = lazy(() =>
  import('../../pages/CriteriosUTIPage').then((m) => ({ default: m.CalculatorDetailPage }))
);
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { getCalculatorById, getSectionsWithCalculators, getAllCalculators, PEDI_CALC_DATA } from '../data/calculator-definitions';
import BalancoHidricoTransopDisplay from './displays/BalancoHidricoTransopDisplay';
import AldreteDisplay from './displays/AldreteDisplay';
import SofaDisplay from './displays/SofaDisplay';
import FibrilacaoAtrialDisplay from './displays/FibrilacaoAtrialDisplay';
import SedacaoDeliriumDisplay from './displays/SedacaoDeliriumDisplay';
import Saps3Display from './displays/Saps3Display';
import AnticoagulantesDisplay from './displays/AnticoagulantesDisplay';
import InibidoresApetiteDisplay from './displays/InibidoresApetiteDisplay';

// Estrutura default de categorias PediCalc — usada quando o usuário ainda
// não digitou peso, para manter a lista sempre visível.
const PEDICALC_DEFAULT_CATEGORIAS = Object.entries(PEDI_CALC_DATA).map(([key, cat]) => ({
  key,
  titulo: cat.categoria,
  medicamentos: [],
  totalDrogas: cat.drogas.length,
}));

// =============================================================================
// ICON MAPPING
// =============================================================================

const SECTION_ICONS = {
  Pill: Pill,
  HeartPulse: HeartPulse,
  Heart: Heart,
  Stethoscope: Stethoscope,
  Baby: Baby,
  BedDouble: BedDouble,
  Bed: Bed,
  Shield: Shield,
  Wind: Wind,
  Droplet: Droplet,
  Droplets: Droplets,
  Siren: Siren,
  Activity: Activity,
  Brain: Brain,
  User: User,
  Scale: Scale,
  Thermometer: Thermometer,
  Calculator: Calculator,
  Zap: Zap,
  Ruler: Ruler,
  Clock: Clock,
  ClipboardCheck: ClipboardCheck,
  AlertTriangle: AlertTriangle,
  TrendingDown: TrendingDown,
  BarChart2: BarChart2,
  Frown: Frown,
  Flame: Flame,
  Syringe: Syringe,
  Moon: Moon,
  AlertCircle: AlertCircle,
  Apple: Apple,
  FileText: FileText,
  Eye: Eye,
  Beaker: Beaker,
  RefreshCw: RefreshCw,
  Plus: Plus,
  Minus: Minus,
  Bell: Bell,
  Bone: Bone,
  RotateCcw: RotateCcw,
  Star: Star,
};

const SPECIALTY_ICONS = {
  doses_ped: Pill,
  anestesia_ped: Baby,
  uti_ped: Baby,
  emergencia: Siren,
  seguranca: Shield,
  perioperatorio: Stethoscope,
  cardiovascular: Heart,
  respiratorio: Wind,
  hidratacao: Droplet,
  uti: Activity,
  neurologico: Brain,
  corporal: User,
  doses: Calculator,
};

// =============================================================================
// INFO BOX COMPONENT
// =============================================================================

function InfoBox({ infoBox, reference }) {
  // Estado para controlar cards colapsiveis
  const [isKeyPointsOpen, setIsKeyPointsOpen] = useState(true);

  // Normalizar dados (retrocompatibilidade)
  const warnings = infoBox?.warnings || (infoBox?.warning ? [infoBox.warning] : []);
  const doses = infoBox?.doses || [];
  const keyPoints = infoBox?.keyPoints || [];
  const interpretation = infoBox?.interpretation;
  const ref = infoBox?.reference || reference;

  // Suporte a formato legado
  const hasLegacyFormat = infoBox?.title && infoBox?.items;

  const hasContent = warnings.length > 0 || doses.length > 0 ||
                     keyPoints.length > 0 || interpretation || ref || hasLegacyFormat;

  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      {/* 1. AVISOS CRITICOS — destructive (light) / muted neutro (dark) */}
      {warnings.length > 0 && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-destructive/10 dark:bg-muted",
          "border border-destructive/40 dark:border-border"
        )}>
          <h4 className="font-bold text-destructive dark:text-foreground text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {warnings.length === 1 ? 'Aviso' : 'Avisos Criticos'}
          </h4>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-destructive dark:text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive dark:bg-muted-foreground mt-2 flex-shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. DOSES — category-blue (light) / muted neutro (dark) */}
      {doses.length > 0 && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-category-blue-bg dark:bg-muted",
          "border border-border"
        )}>
          <h4 className="font-bold text-category-blue-fg dark:text-foreground text-sm mb-2 flex items-center gap-2">
            <Pill className="w-5 h-5 flex-shrink-0" />
            Doses e Orientacoes
          </h4>
          <ul className="space-y-1.5">
            {doses.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-category-blue-fg dark:text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-category-blue dark:bg-muted-foreground mt-2 flex-shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. INTERPRETACAO - Verde, explicacao principal */}
      {interpretation && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-muted",
          "border border-border"
        )}>
          <h4 className="font-bold text-primary text-sm mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 flex-shrink-0" />
            Interpretacao
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {interpretation}
          </p>
        </div>
      )}

      {/* 4. PONTOS-CHAVE — neutro DS (muted), colapsivel */}
      {keyPoints.length > 0 && (
        <div className={cn(
          "rounded-xl overflow-hidden",
          "bg-muted",
          "border border-border"
        )}>
          <button
            onClick={() => setIsKeyPointsOpen(!isKeyPointsOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ListChecks className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-bold text-foreground text-sm">
                Pontos-Chave
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">
                {keyPoints.length}
              </span>
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform duration-200",
              isKeyPointsOpen && "rotate-180"
            )} />
          </button>

          {isKeyPointsOpen && (
            <div className="px-4 pb-4 pt-0">
              <ul className="space-y-1.5">
                {keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Formato legado: title/items (para calculadoras antigas) */}
      {hasLegacyFormat && !interpretation && keyPoints.length === 0 && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-muted",
          "border border-border"
        )}>
          <h4 className="font-bold text-primary mb-3 flex items-center gap-2 text-sm">
            <Info className="w-5 h-5" />
            {infoBox.title}
          </h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {infoBox.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. REFERENCIA — neutro DS (muted), destaque sutil */}
      {ref && (
        <div className={cn(
          "p-3 rounded-xl",
          "bg-muted",
          "border border-border"
        )}>
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground italic">
              {ref}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RESULT DISPLAY - SEM BARRA DE PROGRESSO
// =============================================================================

function ResultDisplay({ result, title, resultMessage }) {
  if (!result) return null;

  // Usa result.risk (das calculadoras) ou result.riskLevel (fallback)
  const riskLevel = result.risk || result.riskLevel;

  const getRiskColor = (level) => {
    switch (level) {
      case 'baixo':
        return 'text-success bg-success/10';
      case 'medio':
        return 'text-warning bg-warning/15';
      case 'alto':
        return 'text-destructive bg-destructive/15';
      case 'critico':
        return 'text-primary-foreground bg-destructive';
      default:
        return 'text-foreground bg-accent';
    }
  };

  const getRiskLabel = (level, customLabel) => {
    // Se houver label customizado, usar ele
    if (customLabel) return customLabel;

    switch (level) {
      case 'baixo': return 'Baixo Risco';
      case 'medio': return 'Risco Moderado';
      case 'alto': return 'Alto Risco';
      case 'critico': return 'Risco Critico';
      default: return 'Resultado';
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl overflow-hidden",
        "bg-card border-2",
        riskLevel === 'baixo' && "border-primary",
        riskLevel === 'medio' && "border-warning dark:border-warning",
        riskLevel === 'alto' && "border-destructive dark:border-destructive",
        riskLevel === 'critico' && "border-destructive dark:border-destructive",
        !riskLevel && "border-border"
      )}
    >
      {/* Score Display */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-3xl font-bold text-foreground">
            {typeof result.score === 'number' ? result.score.toFixed(2) : result.score}
          </span>
          {result.maxScore && (
            <span className="text-sm text-muted-foreground">/ {result.maxScore}</span>
          )}
        </div>
      </div>

      {/* Risk Level Badge */}
      {riskLevel && (
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold mb-3",
            getRiskColor(riskLevel)
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              riskLevel === 'baixo' && "bg-primary",
              riskLevel === 'medio' && "bg-warning",
              riskLevel === 'alto' && "bg-destructive",
              riskLevel === 'critico' && "bg-white"
            )}
          />
          {getRiskLabel(riskLevel, result.riskLabel)}
        </div>
      )}

      {/* Result Interpretation */}
      {resultMessage && (
        <p className="text-sm text-foreground font-medium break-words">
          {resultMessage}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// PEDICALC DISPLAY COMPONENT - Renderização especial para doses pediátricas
// =============================================================================

// Cores das categorias — APENAS PCR em vermelho (emergência); demais em
// tons verdes DS (muted) com ícones em tons semânticos para diferenciação
// sutil. Bordas usam `border-border` uniforme. Dark mode é automático via
// swap das CSS vars no seletor `.dark`.
//
// Padrão:
// - PCR: bg-destructive/10, text-destructive, ícone destructive (emergência)
// - Demais: bg-muted, text-foreground, ícone em tom semântico (sem bg distinto)
const GREEN_TONE_CATEGORY = {
  bg: 'hsl(var(--muted))',
  border: 'hsl(var(--border))',
  text: 'hsl(var(--foreground))',
  darkBg: 'hsl(var(--muted))',
  darkBorder: 'hsl(var(--border))',
  darkText: 'hsl(var(--foreground))',
};

const CATEGORIA_COLORS = {
  // PCR: vermelho (destructive) somente em LIGHT mode. Em DARK mode usa
  // o mesmo padrão neutro das demais categorias (DS) — sem cores vivas
  // semânticas que destoam do tema escuro.
  pcr: {
    bg: 'hsl(var(--destructive) / 0.1)', border: 'hsl(var(--destructive))', text: 'hsl(var(--destructive))', iconName: 'Siren',
    darkBg: 'hsl(var(--muted))', darkBorder: 'hsl(var(--border))', darkText: 'hsl(var(--foreground))'
  },
  anticonvulsivante: { ...GREEN_TONE_CATEGORY, iconName: 'Zap' },
  antidotos: { ...GREEN_TONE_CATEGORY, iconName: 'ShieldAlert' },
  sedacao: { ...GREEN_TONE_CATEGORY, iconName: 'Syringe' },
  analgesicos: { ...GREEN_TONE_CATEGORY, iconName: 'Pill' },
  aines: { ...GREEN_TONE_CATEGORY, iconName: 'Flame' },
  corticoides: { ...GREEN_TONE_CATEGORY, iconName: 'Droplet' },
  antibioticos: { ...GREEN_TONE_CATEGORY, iconName: 'Bug' },
  rotina: { ...GREEN_TONE_CATEGORY, iconName: 'Stethoscope' },
  // Aliases com acentos — PEDI_CALC_DATA usa 'sedação', 'analgésicos' e
  // 'antibióticos' (com diacríticos). Sem esses aliases cairiam no fallback PCR.
  'sedação': { ...GREEN_TONE_CATEGORY, iconName: 'Syringe' },
  'analgésicos': { ...GREEN_TONE_CATEGORY, iconName: 'Pill' },
  'antibióticos': { ...GREEN_TONE_CATEGORY, iconName: 'Bug' },
};

// Mapeamento de nomes de ícones para componentes Lucide (PediCalc)
const PEDI_ICON_MAP = {
  Siren,
  Zap,
  ShieldAlert,
  Syringe,
  Pill,
  Flame,
  Droplet,
  Bug,
  Stethoscope,
};

// Cores ACLS — padrão unificado como PediCalc: apenas emergências críticas
// (PCR, Hipertermia Maligna, Anafilaxia) em vermelho LIGHT mode. Demais
// categorias em tom neutro muted DS. Em DARK mode tudo neutro (sem vermelho
// nem azul vivo).
const ACLS_EMERGENCY = {
  bg: 'hsl(var(--destructive) / 0.1)',
  border: 'hsl(var(--destructive))',
  text: 'hsl(var(--destructive))',
  darkBg: 'hsl(var(--muted))',
  darkBorder: 'hsl(var(--border))',
  darkText: 'hsl(var(--foreground))',
};

const ACLS_COLORS = {
  pcr_drogas: { ...ACLS_EMERGENCY, iconName: 'Syringe' },
  hipertermia_maligna: { ...ACLS_EMERGENCY, iconName: 'Thermometer' },
  anafilaxia: { ...ACLS_EMERGENCY, iconName: 'AlertTriangle' },
  desfib: { ...GREEN_TONE_CATEGORY, iconName: 'Zap' },
  sbv: { ...GREEN_TONE_CATEGORY, iconName: 'Wind' },
  bicarbonato: { ...GREEN_TONE_CATEGORY, iconName: 'FlaskConical' },
  atropina: { ...GREEN_TONE_CATEGORY, iconName: 'HeartPulse' },
  vasoativas: { ...GREEN_TONE_CATEGORY, iconName: 'Droplets' },
  antidotos: { ...GREEN_TONE_CATEGORY, iconName: 'ShieldAlert' },
  tci_sedacao: { ...GREEN_TONE_CATEGORY, iconName: 'Activity' },
  arritmias_controle: { ...GREEN_TONE_CATEGORY, iconName: 'Activity' },
  cardioversao: { ...GREEN_TONE_CATEGORY, iconName: 'Zap' },
  manutencao: { ...GREEN_TONE_CATEGORY, iconName: 'RefreshCw' },
};

// Cores ADULT — mesmo padrão do PediCalc: apenas Vasopressores em vermelho
// (emergência/choque); demais em tons verdes DS (muted) com ícone semântico.
const ADULT_CATEGORIA_COLORS = {
  indutores: { ...GREEN_TONE_CATEGORY, iconName: 'Syringe' },
  opioides: { ...GREEN_TONE_CATEGORY, iconName: 'Pill' },
  bnm: { ...GREEN_TONE_CATEGORY, iconName: 'Zap' },
  reversores: { ...GREEN_TONE_CATEGORY, iconName: 'RefreshCw' },
  vasopressores: {
    bg: 'hsl(var(--destructive) / 0.1)', border: 'hsl(var(--destructive))', text: 'hsl(var(--destructive))', iconName: 'HeartPulse',
    darkBg: 'hsl(var(--muted))', darkBorder: 'hsl(var(--border))', darkText: 'hsl(var(--foreground))'
  },
  adjuvantes: { ...GREEN_TONE_CATEGORY, iconName: 'Beaker' },
};

// Mapeamento de ícones para Adult Calc
const ADULT_ICON_MAP = {
  Syringe,
  Pill,
  Zap,
  RefreshCw,
  HeartPulse,
  Beaker,
};

// =============================================================================
// ADULT CALC DISPLAY COMPONENT - Doses em Adultos (mesmo padrão do PediCalc)
// =============================================================================
function AdultCalcDisplay({ result, peso, onPesoChange }) {
  // Estado para controlar quais categorias estão abertas (accordion)
  const [openCategories, setOpenCategories] = useState({});

  // Detectar dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Categorias iniciam todas fechadas — usuário decide qual abrir.

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-3">
      {/* Header com input de peso — verde DS light (soft tint) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={peso || ''}
            onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="30"
            max="200"
            step="1"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {result?.totalMedicamentos
              ? <>
                  <span className="block font-semibold">{result.totalMedicamentos} meds</span>
                  <span className="block">{result.categorias.length} cat.</span>
                </>
              : <span>Digite<br/>o peso</span>}
          </span>
        </div>
      </div>

      {/* Categorias em Accordion — layout compacto */}
      {result?.categorias && (
        <div className="space-y-1.5">
        {result.categorias.map((categoria) => {
          const colors = ADULT_CATEGORIA_COLORS[categoria.key] || ADULT_CATEGORIA_COLORS.indutores;
          const isOpen = openCategories[categoria.key];

          // Cores adaptadas para dark mode
          const bgColor = isDark ? colors.darkBg : colors.bg;
          const textColor = isDark ? colors.darkText : colors.text;
          const borderColor = isDark ? colors.darkBorder : colors.border;

          return (
            <div key={categoria.key}>
              {/* Header clicável da categoria — compacto */}
              <button
                onClick={() => toggleCategory(categoria.key)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg",
                  "transition-all duration-200",
                  "hover:opacity-90 min-h-[44px]"
                )}
                style={{
                  backgroundColor: bgColor,
                  borderLeftColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(() => {
                    const IconComponent = ADULT_ICON_MAP[colors.iconName] || Syringe;
                    return <IconComponent className="w-4 h-4 shrink-0" style={{ color: textColor }} />;
                  })()}
                  <span
                    className="font-semibold text-[13px] truncate text-left"
                    style={{ color: textColor }}
                  >
                    {categoria.titulo}
                  </span>
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', color: textColor }}
                  >
                    {categoria.medicamentos.length}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                  style={{ color: textColor }}
                />
              </button>

              {/* Conteúdo colapsável - MESMO LAYOUT DO PEDICALC */}
              {isOpen && (
                <div className="mt-2 space-y-2 pl-2">
                  {categoria.medicamentos.map((med, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl",
                        "bg-card border border-border dark:border-border"
                      )}
                    >
                      {/* Nome e apresentação */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            {med.droga}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {med.apresentacao}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-foreground">
                          {med.dosePadrao}
                        </span>
                      </div>

                      {/* Diluição */}
                      {med.diluicao && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium">Diluicao:</span> {med.diluicao}
                        </p>
                      )}

                      {/* Resultado: Dose e Observação - igual ao PediCalc */}
                      <div className="flex items-center gap-3 pt-2 border-t border-border dark:border-border">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Dose</p>
                          <p className="font-bold text-foreground">{med.dose}</p>
                        </div>
                        {med.obs && (
                          <>
                            <div className="text-muted-foreground">|</div>
                            <div className="flex-1 p-2 rounded-lg text-center bg-muted border border-border">
                              <p className="text-xs text-muted-foreground">Obs</p>
                              <p className="font-medium text-xs text-foreground">
                                {med.obs}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

function PediCalcDisplay({ result, peso, onPesoChange }) {
  // Estado para controlar quais categorias estão abertas (accordion)
  const [openCategories, setOpenCategories] = useState({});

  // Detectar dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Categorias iniciam todas fechadas — usuário decide qual abrir.

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-3">
      {/* Header com input de peso — verde DS light (soft tint) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={peso || ''}
            onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="0.5"
            max="150"
            step="0.1"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {result?.totalMedicamentos
              ? <>
                  <span className="block font-semibold">{result.totalMedicamentos} meds</span>
                  <span className="block">{result.categorias.length} cat.</span>
                </>
              : <span>Digite<br/>o peso</span>}
          </span>
        </div>
      </div>

      {/* Categorias em Accordion — SEMPRE visíveis (usa fallback default
          quando sem peso, para usuário ver todas as categorias antes de digitar) */}
      {(() => {
        const categoriasList = result?.categorias || PEDICALC_DEFAULT_CATEGORIAS;
        return (
        <div className="space-y-1.5">
        {categoriasList.map((categoria) => {
          const colors = CATEGORIA_COLORS[categoria.key] || CATEGORIA_COLORS.pcr;
          const isOpen = openCategories[categoria.key];
          const hasCalculations = categoria.medicamentos && categoria.medicamentos.length > 0;
          const displayCount = hasCalculations ? categoria.medicamentos.length : categoria.totalDrogas;

          // Cores adaptadas para dark mode
          const bgColor = isDark ? colors.darkBg : colors.bg;
          const textColor = isDark ? colors.darkText : colors.text;
          const borderColor = isDark ? colors.darkBorder : colors.border;

          return (
            <div key={categoria.key}>
              {/* Header clicável da categoria — compacto */}
              <button
                onClick={() => toggleCategory(categoria.key)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg",
                  "transition-all duration-200",
                  "hover:opacity-90 min-h-[44px]"
                )}
                style={{
                  backgroundColor: bgColor,
                  borderLeftColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(() => {
                    const IconComponent = PEDI_ICON_MAP[colors.iconName] || Siren;
                    return <IconComponent className="w-4 h-4 shrink-0" style={{ color: textColor }} />;
                  })()}
                  <span
                    className="font-semibold text-[13px] truncate text-left"
                    style={{ color: textColor }}
                  >
                    {categoria.titulo}
                  </span>
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', color: textColor }}
                  >
                    {displayCount}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                  style={{ color: textColor }}
                />
              </button>

              {/* Conteúdo colapsável */}
              {isOpen && !hasCalculations && (
                <div className="mt-2 p-3 rounded-xl bg-muted border border-border text-center">
                  <p className="text-xs text-muted-foreground">
                    Digite o peso para ver as doses calculadas desta categoria.
                  </p>
                </div>
              )}
              {isOpen && hasCalculations && (
                <div className="mt-2 space-y-2 pl-2">
                  {categoria.medicamentos.map((med, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl",
                        "bg-card border border-border dark:border-border"
                      )}
                    >
                      {/* Warning no topo do card (se houver) */}
                      {med.warning && (
                        <div className={cn(
                          "mb-3 p-2 rounded-lg flex items-start gap-2",
                          "bg-destructive/10",
                          "border border-destructive/30"
                        )}>
                          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-destructive">
                            {med.warning}
                          </p>
                        </div>
                      )}

                      {/* Nome e apresentação */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            {med.droga}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {med.apresentacao}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-foreground">
                          {med.dosePadrao}
                        </span>
                      </div>

                      {/* Diluição */}
                      {med.diluicao && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium">Diluicao:</span> {med.diluicao}
                        </p>
                      )}

                      {/* Resultado: Dose e Volume */}
                      <div className="flex items-center gap-3 pt-2 border-t border-border dark:border-border">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Dose</p>
                          <p className="font-bold text-foreground">{med.dose}</p>
                        </div>
                        <div className="text-muted-foreground">=</div>
                        <div className="flex-1 p-2 rounded-lg text-center bg-muted border border-border">
                          <p className="text-xs text-muted-foreground">Volume</p>
                          <p className="font-bold text-lg text-foreground">
                            {med.volume}
                          </p>
                        </div>
                      </div>

                      {/* Observação/Interpretação ao final do card (se houver) */}
                      {med.obs && (
                        <div className={cn(
                          "mt-3 p-2 rounded-lg flex items-start gap-2",
                          "bg-muted",
                          "border border-border"
                        )}>
                          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-success">
                            {med.obs}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
        );
      })()}
    </div>
  );
}

// =============================================================================
// ACLS DISPLAY COMPONENT - Layout igual ao PediCalc
// =============================================================================

// Mapeamento de nomes de ícones para componentes Lucide (ACLS)
const ACLS_ICON_MAP = {
  Zap,
  Syringe,
  FlaskConical,
  HeartPulse,
  Droplets,
  RefreshCw,
  ShieldAlert,
  Activity,
  Wind,
  AlertTriangle,
  Thermometer,
};

function ACLSDisplay({ result, peso, onPesoChange }) {
  const [openCategories, setOpenCategories] = useState({});

  // Detectar dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Categorias iniciam todas fechadas — usuário decide qual abrir.

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header com input de peso — compacto horizontal (padrão PediCalc) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={peso || ''}
            onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
            placeholder="70"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="5"
            max="200"
            step="1"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {result?.totalItens
              ? <>
                  <span className="block font-semibold">{result.totalItens} itens</span>
                  <span className="block">{result.categorias?.length || 0} cat.</span>
                </>
              : <span>Digite<br/>o peso</span>}
          </span>
        </div>
      </div>

      {/* Categorias em Accordion - so mostra se tiver resultado */}
      {result?.categorias && (
        <div className="space-y-2">
        {result.categorias.map((categoria) => {
          const colors = ACLS_COLORS[categoria.key] || ACLS_COLORS.pcr_drogas;
          const isOpen = openCategories[categoria.key];

          const bgColor = isDark ? colors.darkBg : colors.bg;
          const textColor = isDark ? colors.darkText : colors.text;
          const borderColor = isDark ? colors.darkBorder : colors.border;

          // Obter componente de ícone
          const IconComponent = ACLS_ICON_MAP[colors.iconName] || Syringe;

          return (
            <div key={categoria.key}>
              {/* Header clicável da categoria */}
              <button
                onClick={() => toggleCategory(categoria.key)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-3 rounded-lg",
                  "transition-all duration-200",
                  "hover:opacity-90"
                )}
                style={{
                  backgroundColor: bgColor,
                  borderLeftColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2">
                  <IconComponent className="w-5 h-5" style={{ color: textColor }} />
                  <span
                    className="font-semibold text-sm"
                    style={{ color: textColor }}
                  >
                    {categoria.titulo}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full opacity-70"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: textColor }}
                  >
                    {categoria.itens.length}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                  style={{ color: textColor }}
                />
              </button>

              {/* Conteúdo colapsável */}
              {isOpen && (
                <div className="mt-2 space-y-2 pl-2">
                  {categoria.itens.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl",
                        "bg-card border border-border dark:border-border"
                      )}
                    >
                      {/* Warning no topo do card (se houver) */}
                      {item.warning && (
                        <div className={cn(
                          "mb-3 p-2 rounded-lg flex items-start gap-2",
                          "bg-destructive/10",
                          "border border-destructive/30"
                        )}>
                          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-destructive">
                            {item.warning}
                          </p>
                        </div>
                      )}

                      {/* Verifica se tem subItens (card agrupado) */}
                      {item.subItens ? (
                        <>
                          {/* Título do grupo */}
                          <div
                            className="font-bold text-sm mb-3 pb-2 border-b"
                            style={{ color: textColor, borderColor: borderColor }}
                          >
                            {item.nome}
                          </div>
                          {/* Sub-itens */}
                          <div className="space-y-2">
                            {item.subItens.map((subItem, subIdx) => (
                              <div key={subIdx} className="flex flex-col">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-foreground text-sm">
                                    {subItem.nome}
                                  </p>
                                  <span
                                    className="text-sm px-2 py-0.5 rounded-lg font-bold whitespace-nowrap"
                                    style={{
                                      backgroundColor: bgColor,
                                      color: textColor,
                                    }}
                                  >
                                    {subItem.valor}
                                  </span>
                                </div>
                                {subItem.detalhe && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {subItem.detalhe}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Interpretação ao final do card agrupado - estilo verde */}
                          {item.interpretacao && (
                            <div className={cn(
                              "mt-3 p-2 rounded-lg flex items-start gap-2",
                              "bg-muted",
                              "border border-border"
                            )}>
                              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-success">
                                {item.interpretacao}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Item simples (sem subItens) */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-foreground text-sm">
                              {item.nome}
                            </p>
                            <span
                              className="text-sm px-2 py-0.5 rounded-lg font-bold whitespace-nowrap"
                              style={{
                                backgroundColor: bgColor,
                                color: textColor,
                              }}
                            >
                              {item.valor}
                            </span>
                          </div>
                          {item.detalhe && (
                            <p className="text-xs text-muted-foreground">
                              {item.detalhe}
                            </p>
                          )}
                          {/* Interpretação para itens simples também */}
                          {item.interpretacao && (
                            <div className={cn(
                              "mt-2 p-2 rounded-lg flex items-start gap-2",
                              "bg-muted",
                              "border border-border"
                            )}>
                              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-success">
                                {item.interpretacao}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// VIA AEREA PEDIATRICA DISPLAY COMPONENT
// =============================================================================

function ViaAereaDisplay({ result, inputs, onInputChange }) {
  const details = result?.details || {};
  const { tuboSemCuff, tuboComCuff, profundidade, lma } = details;
  const categoria = result?.categoria;
  const errorMsg = result?.error;

  // Verificar se há peso (idade vazia é tratada como 0 — RN). Usuário pode
  // calcular só com peso; idade refina o cálculo de tubo/profundidade.
  const allFieldsFilled = inputs?.peso > 0;

  // Limites pediátricos — clamp ao perder foco evita valores fora da faixa
  const clampPeso = (val) => {
    if (val === '' || val == null) return val;
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return Math.max(0.5, Math.min(50, n));
  };
  const clampIdade = (val, unidade) => {
    if (val === '' || val == null) return val;
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    const max = unidade === 'anos' ? 14 : 168; // 14 anos = 168 meses
    return Math.max(0, Math.min(max, n));
  };

  // Classes comuns para inputs - mesmo padrao do PediCalc
  const _inputClass = cn(
    "w-full text-center text-xl font-bold py-2 rounded-lg",
    "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
    "focus:outline-none focus:ring-2 focus:ring-primary/40",
    "dark:focus:ring-primary/50"
  );

  const unidadeAtual = inputs?.idade_unidade || 'meses';

  return (
    <div className="space-y-3">
      {/* Header compacto: peso na 1ª linha, unidade+idade na 2ª */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl space-y-2",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        {/* Linha 1 — Peso */}
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={inputs?.peso || ''}
            onChange={(e) => onInputChange('peso', parseFloat(e.target.value) || 0)}
            onBlur={(e) => {
              const clamped = clampPeso(e.target.value);
              if (clamped !== '' && clamped !== inputs?.peso) onInputChange('peso', clamped);
            }}
            placeholder="0"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40"
            )}
            min="0.5"
            max="50"
            step="0.5"
          />
        </div>

        {/* Linha 2 — Unidade (toggle) + Idade */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden h-[36px] border border-primary/20">
            <button
              type="button"
              onClick={() => onInputChange('idade_unidade', 'meses')}
              className={cn(
                "px-3 text-xs font-semibold transition-colors",
                unidadeAtual === 'meses'
                  ? "bg-primary text-white dark:bg-primary dark:text-primary-foreground"
                  : "bg-card text-primary/70 hover:bg-primary/10"
              )}
            >
              Meses
            </button>
            <button
              type="button"
              onClick={() => onInputChange('idade_unidade', 'anos')}
              className={cn(
                "px-3 text-xs font-semibold transition-colors",
                unidadeAtual === 'anos'
                  ? "bg-primary text-white dark:bg-primary dark:text-primary-foreground"
                  : "bg-card text-primary/70 hover:bg-primary/10"
              )}
            >
              Anos
            </button>
          </div>
          <input
            type="number"
            value={inputs?.idade_valor ?? ''}
            onChange={(e) => onInputChange('idade_valor', e.target.value === '' ? '' : parseFloat(e.target.value))}
            onBlur={(e) => {
              const clamped = clampIdade(e.target.value, unidadeAtual);
              if (clamped !== '' && clamped !== inputs?.idade_valor) onInputChange('idade_valor', clamped);
            }}
            placeholder={`Idade (${unidadeAtual})`}
            className={cn(
              "flex-1 min-w-0 text-center text-base font-semibold py-1.5 h-[36px] rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40"
            )}
            min="0"
            max={unidadeAtual === 'anos' ? 14 : 168}
            step="1"
          />
        </div>

        {/* Categoria calculada */}
        <p className="text-primary/80 dark:text-muted-foreground text-[11px] text-center">
          {categoria ? `Categoria: ${categoria}` : 'Preencha todos os campos'}
        </p>
      </div>

      {/* Mensagem de erro quando peso/idade fora da faixa pediátrica */}
      {errorMsg && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-destructive/10 dark:bg-muted",
          "border border-destructive/40 dark:border-border"
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive dark:text-foreground mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-destructive dark:text-foreground text-sm mb-1">
                Fora da faixa pediátrica
              </h4>
              <p className="text-xs text-destructive dark:text-muted-foreground leading-relaxed">
                {errorMsg}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid de resultados - mostra apenas se todos os campos estiverem preenchidos */}
      {allFieldsFilled && result?.details && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {/* Tubo SEM Cuff */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Tubo SEM Cuff</p>
              <p className="text-2xl font-bold text-primary">
                {tuboSemCuff || '-'}
              </p>
              <p className="text-xs text-muted-foreground">mm</p>
            </div>

            {/* Tubo COM Cuff */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Tubo COM Cuff</p>
              <p className="text-2xl font-bold text-primary">
                {tuboComCuff || '-'}
              </p>
              <p className="text-xs text-muted-foreground">mm (Duracher)</p>
            </div>

            {/* Profundidade */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Profundidade Oral</p>
              <p className="text-2xl font-bold text-primary">
                {profundidade || '-'}
              </p>
              <p className="text-xs text-muted-foreground">cm (na rima)</p>
            </div>

            {/* Mascara Laringea */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Mascara Laringea</p>
              <p className="text-2xl font-bold text-primary">
                #{lma || '-'}
              </p>
              <p className="text-xs text-muted-foreground">LMA</p>
            </div>
          </div>

          {/* Nota sobre tubos */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-warning/10",
            "border border-warning/40"
          )}>
            <p className="text-xs text-warning">
              <strong>Dica:</strong> Sempre preparar tubos 0.5mm acima e abaixo do calculado.
              Tubo com cuff (Duracher) e preferido na pratica atual.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// DESFIBRILACAO PEDIATRICA DISPLAY COMPONENT
// =============================================================================

function PedDesfibDisplay({ result, peso, onPesoChange }) {
  const details = result?.details || {};

  return (
    <div className="space-y-3">
      {/* Header compacto horizontal (padrão PediCalc) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={peso || ''}
            onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="1"
            max="50"
            step="0.5"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {result
              ? <span className="block font-semibold">J/kg<br/>PALS</span>
              : <span>Digite<br/>o peso</span>}
          </span>
        </div>
      </div>

      {/* Grid de resultados - mostra apenas se tiver resultado */}
      {result?.details && (
        <>
          {/* Choques de Desfibrilação */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1º Choque */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-category-orange dark:border-category-orange/30"
            )}>
              <p className="text-xs text-muted-foreground mb-1">1º Choque (FV/TV)</p>
              <p className="text-2xl font-bold text-primary">
                {details['1o Choque (FV/TV)'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">2 J/kg</p>
            </div>

            {/* 2º Choque */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">2º Choque</p>
              <p className="text-2xl font-bold text-primary">
                {details['2o Choque'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">4 J/kg</p>
            </div>
          </div>

          {/* Choques Subsequentes */}
          <div className={cn(
            "p-4 rounded-xl text-center",
            "bg-muted",
            "border border-border"
          )}>
            <p className="text-xs text-muted-foreground mb-1">Choques Subsequentes</p>
            <p className="text-xl font-bold text-primary">
              {details['Choques subsequentes'] || '-'}
            </p>
            <p className="text-xs text-muted-foreground">4-10 J/kg (max 200J)</p>
          </div>

          {/* Cardioversão */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Cardioversao Inicial</p>
              <p className="text-xl font-bold text-primary">
                {details['Cardioversao inicial'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">0.5-1 J/kg</p>
            </div>

            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Cardioversao Repetir</p>
              <p className="text-xl font-bold text-primary">
                {details['Cardioversao repetir'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">2 J/kg</p>
            </div>
          </div>

          {/* Nota PALS */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-warning/10",
            "border border-warning/40"
          )}>
            <p className="text-xs text-warning">
              <strong>PALS:</strong> FV/TVSP - Desfibrilar → RCP 2min → Checar ritmo.
              Energia maxima desde o 1º choque. Nao exceder dose adulta (200J bifasico).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// BROSELOW TAPE DISPLAY COMPONENT
// =============================================================================

function BroselowDisplay({ result, comprimento, onComprimentoChange }) {
  const faixa = result?.faixa;
  const isError = result?.erro;

  // Detectar se é dark mode para ajustar o card da fita
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="space-y-3">
      {/* Header compacto horizontal (padrão PediCalc) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Comp. (cm)
          </label>
          <input
            type="number"
            value={comprimento || ''}
            onChange={(e) => onComprimentoChange(parseFloat(e.target.value) || 0)}
            placeholder="46-150"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="46"
            max="150"
            step="1"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {faixa
              ? <span className="block font-semibold">{faixa.rangeComprimento}</span>
              : <span>46-150<br/>cm</span>}
          </span>
        </div>
      </div>

      {/* Erro - fora da faixa */}
      {isError && (
        <div className={cn(
          "p-4 rounded-xl text-center",
          "bg-destructive/10",
          "border border-border"
        )}>
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">
            {result?.details?.mensagem || 'Comprimento fora da faixa'}
          </p>
        </div>
      )}

      {/* Resultados - mostra apenas se tiver faixa válida */}
      {faixa && !isError && (
        <>
          {/* Card principal com cor da fita */}
          <div
            className={cn(
              "p-5 rounded-xl text-center",
              "shadow-lg dark:shadow-none",
              "dark:border dark:border-white/10"
            )}
            style={{
              backgroundColor: isDarkMode ? `${faixa.hex}CC` : faixa.hex,
              color: faixa.textColor,
              border: faixa.cor === 'Branco' ? '2px solid #E0E0E0' : undefined,
            }}
          >
            <p className="text-xs font-medium opacity-80 mb-1">FITA BROSELOW</p>
            <p className="text-3xl font-bold mb-1">{faixa.cor}</p>
            <p className="text-sm opacity-80">({faixa.corEN})</p>
          </div>

          {/* Grid de informacoes */}
          <div className="grid grid-cols-2 gap-3">
            {/* Peso Estimado */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Peso Estimado</p>
              <p className="text-2xl font-bold text-primary">
                {faixa.pesoMin}-{faixa.pesoMax}
              </p>
              <p className="text-xs text-muted-foreground">kg</p>
            </div>

            {/* Tubo ET */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Tubo ET</p>
              <p className="text-2xl font-bold text-primary">
                {faixa.tubo}
              </p>
              <p className="text-xs text-muted-foreground">mm</p>
            </div>

            {/* Mascara Laringea */}
            <div className={cn(
              "p-4 rounded-xl text-center col-span-2",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Mascara Laringea (LMA)</p>
              <p className="text-2xl font-bold text-primary">
                #{faixa.lma}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// HOLLIDAY-SEGAR DISPLAY COMPONENT
// =============================================================================

function HollidaySegarDisplay({ result, peso, onPesoChange }) {
  const details = result?.details || {};

  return (
    <div className="space-y-3">
      {/* Header compacto horizontal (padrão PediCalc) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={peso || ''}
            onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="1"
            max="200"
            step="0.1"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {result
              ? <span className="block font-semibold">4-2-1 /<br/>100-50-20</span>
              : <span>Digite<br/>o peso</span>}
          </span>
        </div>
      </div>

      {/* Resultados - mostra apenas se tiver resultado */}
      {result?.details && (
        <>
          {/* Volume por hora e 24h */}
          <div className="grid grid-cols-2 gap-3">
            {/* mL/hora */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Manutencao</p>
              <p className="text-3xl font-bold text-primary">
                {details.mlHora?.toFixed(1) || '-'}
              </p>
              <p className="text-sm text-muted-foreground font-medium">mL/hora</p>
              <p className="text-[10px] text-muted-foreground/80">regra 4-2-1</p>
            </div>

            {/* mL/24h */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-muted",
              "border border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Volume 24h</p>
              <p className="text-3xl font-bold text-primary">
                {details.ml24h?.toFixed(0) || '-'}
              </p>
              <p className="text-sm text-muted-foreground font-medium">mL/dia</p>
              <p className="text-[10px] text-muted-foreground/80">regra 100-50-20</p>
            </div>
          </div>

          {/* Nota explicativa */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-warning/10",
            "border border-warning/40"
          )}>
            <p className="text-xs text-warning">
              <strong>Regra 4-2-1 (mL/h):</strong> Primeiros 10kg: 4 mL/kg/h | 10-20kg: +2 mL/kg/h | &gt;20kg: +1 mL/kg/h
            </p>
            <p className="text-xs text-warning mt-1">
              <strong>Regra 100-50-20 (mL/dia):</strong> Primeiros 10kg: 100 mL/kg | 10-20kg: +50 mL/kg | &gt;20kg: +20 mL/kg
            </p>
            <p className="text-xs text-warning mt-1">
              A 4-2-1 é aproximação horária da regra diária 100-50-20 — por isso mL/h × 24 difere do volume de 24h.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// REVERSORES DISPLAY COMPONENT - Layout igual ao PediCalc
// =============================================================================

function ReversoresDisplay({ result, peso, onPesoChange, reversor, onReversorChange, options }) {
  const details = result?.details || {};

  return (
    <div className="space-y-3">
      {/* Header compacto horizontal (padrão PediCalc) */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl",
        "bg-primary/10 border border-primary/20",
        "dark:bg-primary/15 dark:border-primary/60"
      )}>
        <div className="flex items-center gap-3">
          <label className="text-primary text-xs font-medium whitespace-nowrap">
            Peso (kg)
          </label>
          <input
            type="number"
            value={peso || ''}
            onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
            placeholder="70"
            className={cn(
              "flex-1 min-w-0 text-center text-2xl font-bold py-1.5 rounded-lg",
              "bg-card text-primary placeholder-primary/40 dark:bg-background dark:text-primary dark:placeholder-primary/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "dark:focus:ring-primary/50"
            )}
            min="30"
            max="200"
            step="1"
          />
          <span className="text-primary/80 dark:text-muted-foreground text-[11px] leading-tight text-right whitespace-nowrap">
            {result
              ? <span className="block font-semibold">Selecione<br/>reversor</span>
              : <span>Digite<br/>o peso</span>}
          </span>
        </div>
      </div>

      {/* Dropdown de Reversor */}
      <div className={cn(
        "p-4 rounded-xl",
        "bg-card border border-border"
      )}>
        <label className="block text-sm font-medium text-foreground mb-2">
          Reversor
        </label>
        <Select
          value={reversor || ''}
          onChange={onReversorChange}
          options={options}
          placeholder="Selecione o reversor..."
        />
      </div>

      {/* Resultados - mostra apenas se tiver resultado */}
      {result?.details && (
        <>
          {/* Card de resultado */}
          <div className={cn(
            "p-4 rounded-xl",
            "bg-card border-2 border-primary"
          )}>
            {/* Dose calculada em destaque */}
            <div className="text-center mb-4">
              <p className="text-xs text-muted-foreground mb-1">Dose Calculada</p>
              <p className="text-3xl font-bold text-primary">
                {details['Dose calculada'] || '-'}
              </p>
            </div>

            {/* Detalhes */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-muted"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Dose Padrao</p>
                <p className="text-sm font-semibold text-foreground">
                  {details['Dose padrao'] || '-'}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-muted"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Intervalo</p>
                <p className="text-sm font-semibold text-foreground">
                  {details['Intervalo'] || '-'}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-muted"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Dose Maxima</p>
                <p className="text-sm font-semibold text-foreground">
                  {details['Dose maxima'] || '-'}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-warning/10",
                "border border-warning/40"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Observacao</p>
                <p className="text-xs font-medium text-warning">
                  {details['Observacao'] || '-'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// CALCULATOR INPUT COMPONENT
// =============================================================================

function CalculatorInput({ input, value, onChange }) {
  if (input.type === 'select') {
    return (
      <div className="py-2">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {input.label}
        </label>
        <Select
          value={value?.toString() || ''}
          onChange={(val) => {
            const numVal = parseFloat(val);
            onChange(isNaN(numVal) ? val : numVal);
          }}
          options={input.options.map((opt) => ({
            value: opt.value?.toString(),
            label: opt.label,
          }))}
          placeholder="Selecione..."
        />
      </div>
    );
  }

  // type === 'number'
  return (
    <div className="py-2">
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {input.label}
      </label>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? undefined : parseFloat(val));
        }}
        min={input.min}
        max={input.max}
        placeholder={
          input.placeholder
            ? input.placeholder
            : input.min !== undefined && input.max !== undefined
              ? `${input.min} - ${input.max}`
              : 'Digite o valor'
        }
      />
    </div>
  );
}

// =============================================================================
// SELECT AS CARDS COMPONENT (for single-select like Mallampati, ASA)
// =============================================================================

function SelectAsCards({ input, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground mb-2">
        {input.label}
      </label>
      <div className="space-y-2">
        {input.options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "w-full text-left p-3 rounded-xl border-2 transition-all",
                "flex items-center justify-between gap-3",
                isSelected
                  ? "bg-muted border-primary"
                  : "bg-card border-border dark:border-border hover:border-border"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {option.label}
              </span>
              {isSelected && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// CALCULATOR PAGE COMPONENT - COM CALCULO AUTOMATICO, SEM PROGRESS BAR
// =============================================================================

function CalculatorPage({ calculator, _onBack }) {
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);

  const handleInputChange = (inputId, value) => {
    setInputs((prev) => ({ ...prev, [inputId]: value }));
  };

  // CALCULO AUTOMATICO
  useEffect(() => {
    if (calculator && calculator.compute) {
      const hasInputs = Object.values(inputs).some(
        (v) => v !== undefined && v !== '' && v !== false
      );

      if (hasInputs) {
        try {
          const computedResult = calculator.compute(inputs);
          setResult(computedResult);
        } catch {
          setResult(null);
        }
      } else {
        setResult(null);
      }
    }
  }, [inputs, calculator]);

  const _handleReset = () => {
    setInputs({});
    setResult(null);
  };

  // Separate inputs by type
  const boolInputs = calculator.inputs.filter((i) => i.type === 'bool');
  const selectInputs = calculator.inputs.filter((i) => i.type === 'select');
  const numberInputs = calculator.inputs.filter((i) => i.type === 'number');

  // Check if select inputs should be rendered as cards (single select with few options)
  // Se calculadora tem useDropdown: true, sempre usa dropdown
  const shouldUseCardsForSelect = (input) => {
    if (calculator.useDropdown) return false;
    return input.options && input.options.length <= 6;
  };

  return (
    /* pt-0: a página do App já paga 16px de padding-top e este container
       pagava outros 12 — o título ficava com 28px acima contra 16 abaixo, e
       o dono viu o desequilíbrio (26/08). Sem o pt duplicado, os dois vãos
       ficam em 16px. Vale para as 71 calculadoras. */
    <div className="px-2 pt-0 pb-3 lg:p-6 space-y-4 lg:space-y-6 min-h-dvh bg-background overflow-x-hidden">
      {/* Header — back button e limpar removidos; navegação via header global */}
      <div>
        <h1 className="text-lg font-bold text-foreground leading-tight">{calculator.title}</h1>
        <p className="text-xs text-muted-foreground">{calculator.subtitle}</p>
      </div>

      {/* Boolean inputs as RiskFactorCards */}
      {boolInputs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Fatores de Risco
          </h3>
          <div className="space-y-2">
            {boolInputs.map((input) => (
              <RiskFactorCard
                key={input.id}
                title={input.label}
                description={input.description || ''}
                points={input.points || 0}
                selected={inputs[input.id] || false}
                onSelect={(val) => handleInputChange(input.id, val)}
                showPoints={!!input.points}
              />
            ))}
          </div>
        </div>
      )}

      {/* Select inputs as cards or dropdown - Skip for calculators with inputs inside custom displays */}
      {selectInputs.length > 0 && !['viaAerea', 'reversores', 'balancoHidricoTransop', 'aldrete', 'sofa', 'faAnticoag', 'sedacaoDelirium', 'saps3', 'anticoagulantes', 'inibidoresApetite', 'criterioUti'].includes(calculator.customRender) && (
        <div
          className={cn(
            "p-4 rounded-xl overflow-visible",
            "bg-card border border-border"
          )}
        >
          <div className="space-y-4 overflow-visible">
            {selectInputs.map((input) =>
              shouldUseCardsForSelect(input) ? (
                <SelectAsCards
                  key={input.id}
                  input={input}
                  value={inputs[input.id]}
                  onChange={(val) => handleInputChange(input.id, val)}
                />
              ) : (
                <CalculatorInput
                  key={input.id}
                  input={input}
                  value={inputs[input.id]}
                  onChange={(val) => handleInputChange(input.id, val)}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Number inputs - Skip for calculators with inputs inside custom displays */}
      {numberInputs.length > 0 &&
       !['pedicalc', 'adultcalc', 'viaAerea', 'pedDesfib', 'broselow', 'hollidaySegar', 'acls', 'reversores', 'balancoHidricoTransop', 'aldrete', 'sofa', 'faAnticoag', 'sedacaoDelirium', 'saps3', 'anticoagulantes', 'inibidoresApetite', 'criterioUti'].includes(calculator.customRender) && (
        <div
          className={cn(
            "p-4 rounded-xl",
            "bg-card border border-border"
          )}
        >
          {(boolInputs.length > 0 || selectInputs.length > 0) && (
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Dados Clinicos
            </h3>
          )}
          <div className="space-y-2">
            {numberInputs.map((input) => (
              <CalculatorInput
                key={input.id}
                input={input}
                value={inputs[input.id]}
                onChange={(val) => handleInputChange(input.id, val)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Renderização especial para PediCalc */}
      {calculator.customRender === 'pedicalc' && (
        <PediCalcDisplay
          result={result}
          peso={inputs.peso}
          onPesoChange={(val) => handleInputChange('peso', val)}
        />
      )}

      {/* Renderização especial para AdultCalc (Doses em Adultos) */}
      {calculator.customRender === 'adultcalc' && (
        <AdultCalcDisplay
          result={result}
          peso={inputs.peso}
          onPesoChange={(val) => handleInputChange('peso', val)}
        />
      )}

      {/* Renderização especial para ACLS */}
      {calculator.customRender === 'acls' && (
        <ACLSDisplay
          result={result}
          peso={inputs.peso}
          onPesoChange={(val) => handleInputChange('peso', val)}
        />
      )}

      {/* Renderização especial para Via Aerea Pediatrica */}
      {calculator.customRender === 'viaAerea' && (
        <ViaAereaDisplay
          result={result}
          inputs={inputs}
          onInputChange={handleInputChange}
        />
      )}

      {/* Renderização especial para Desfibrilacao Pediatrica */}
      {calculator.customRender === 'pedDesfib' && (
        <PedDesfibDisplay
          result={result}
          peso={inputs.peso}
          onPesoChange={(val) => handleInputChange('peso', val)}
        />
      )}

      {/* Renderização especial para Broselow */}
      {calculator.customRender === 'broselow' && (
        <BroselowDisplay
          result={result}
          comprimento={inputs.comprimento}
          onComprimentoChange={(val) => handleInputChange('comprimento', val)}
        />
      )}

      {/* Renderização especial para Holliday-Segar */}
      {calculator.customRender === 'hollidaySegar' && (
        <HollidaySegarDisplay
          result={result}
          peso={inputs.peso}
          onPesoChange={(val) => handleInputChange('peso', val)}
        />
      )}

      {/* Renderização especial para Reversores */}
      {calculator.customRender === 'reversores' && (
        <ReversoresDisplay
          result={result}
          peso={inputs.peso}
          onPesoChange={(val) => handleInputChange('peso', val)}
          reversor={inputs.reversor}
          onReversorChange={(val) => handleInputChange('reversor', val)}
          options={calculator.inputs.find(i => i.id === 'reversor')?.options?.map(opt => ({
            value: opt.value,
            label: opt.label,
          })) || []}
        />
      )}

      {/* Renderização especial para Balanço Hídrico Transoperatório */}
      {calculator.customRender === 'balancoHidricoTransop' && (
        <BalancoHidricoTransopDisplay />
      )}

      {calculator.customRender === 'aldrete' && (
        <AldreteDisplay />
      )}

      {calculator.customRender === 'sofa' && (
        <SofaDisplay />
      )}

      {calculator.customRender === 'faAnticoag' && (
        <FibrilacaoAtrialDisplay />
      )}

      {calculator.customRender === 'sedacaoDelirium' && (
        <SedacaoDeliriumDisplay />
      )}

      {calculator.customRender === 'saps3' && (
        <Saps3Display />
      )}

      {calculator.customRender === 'criterioUti' && (
        <Suspense
          fallback={<div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>}
        >
          <CriterioUtiDetalhe calcId={calculator.criterioUtiId} />
        </Suspense>
      )}

      {calculator.customRender === 'anticoagulantes' && (
        <AnticoagulantesDisplay />
      )}

      {calculator.customRender === 'inibidoresApetite' && (
        <InibidoresApetiteDisplay />
      )}

      {/* Result - Abaixo dos inputs, como no App Legado (para calculadoras normais) */}
      {!calculator.customRender && result && (
        <ResultDisplay
          result={result}
          title={calculator.title}
          resultMessage={calculator.resultMessage ? calculator.resultMessage(result) : null}
        />
      )}

      {/* Details (para calculadoras normais) */}
      {!calculator.customRender && result?.details && (
        <div className="p-4 bg-accent/30 dark:bg-card rounded-xl overflow-hidden w-full max-w-full">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Detalhes do Calculo
          </p>
          <div className="space-y-3 w-full">
            {Object.entries(result.details).map(([key, value]) => (
              <div key={key} className="w-full">
                <span className="text-xs text-muted-foreground block mb-0.5">{key}</span>
                <span className="text-sm font-medium text-foreground block break-words">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <InfoBox infoBox={calculator.infoBox} reference={calculator.reference} />

      {/* Disclaimer regulatório CFM 2.454/2026 (Onda I) */}
      <ClinicalDisclaimer />
    </div>
  );
}

// =============================================================================
// SECTION HEADER COMPONENT (Accordion)
// Best practices: LogRocket, UX Planet, Carbon Design System
// - Ícone caret no final (padrão F de leitura)
// - Área clicável mínima 44px
// - Espaçamento consistente
// - Estados hover/focus claros
// =============================================================================

function SectionHeader({ icon, title, count, isOpen, onToggle }) {
  const IconComponent = SECTION_ICONS[icon] || Calculator;

  return (
    <button
      onClick={onToggle}
      className={cn(
        // Layout base - altura fixa para simetria
        "w-full h-16 flex items-center gap-4 px-4",
        "rounded-xl",
        // Cores e bordas
        "bg-card",
        "border border-border",
        // Hover state sutil
        "hover:bg-muted",
        "hover:border-primary dark:hover:border-primary",
        // Focus state para acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50",
        // Transição suave
        "transition-all duration-200",
        // Sombra quando aberto
        isOpen && "shadow-md border-primary"
      )}
    >
      {/* Ícone da seção - tamanho fixo */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-11 h-11 rounded-xl flex-shrink-0",
          "bg-muted",
          isOpen && "bg-primary"
        )}
      >
        <IconComponent
          className={cn(
            "w-5 h-5 transition-colors duration-200",
            isOpen
              ? "text-primary-foreground"
              : "text-primary"
          )}
        />
      </div>

      {/* Título - flex grow */}
      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">
        {title}
      </span>

      {/* Badge de contagem - tamanho fixo */}
      <span
        className={cn(
          "flex items-center justify-center",
          "min-w-[32px] h-7 px-2.5 rounded-full",
          "text-sm font-bold",
          "bg-muted",
          "text-primary"
        )}
      >
        {count}
      </span>

      {/* Ícone chevron - no final (padrão F de leitura) */}
      <ChevronDown
        className={cn(
          "w-5 h-5 flex-shrink-0",
          "text-muted-foreground dark:text-muted-foreground",
          "transition-transform duration-300 ease-out",
          isOpen && "rotate-180 text-primary"
        )}
      />
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT - LAYOUT POR SECOES (SEM TABS)
// =============================================================================

export function CalculatorShowcase({ selectedCalc: selectedCalcProp, onSelectedCalcChange, searchTerm: searchTermProp, onSearchTermChange } = {}) {
  useEffect(() => {
    document.title = 'Calculadoras — ANEST';
  }, []);

  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = searchTermProp !== undefined ? searchTermProp : internalSearchTerm;
  const _setSearchTerm = onSearchTermChange || setInternalSearchTerm;
  const [internalSelectedCalc, setInternalSelectedCalc] = useState(null);
  // Permite que o wrapper controle a seleção externamente (para o botão
  // "Voltar" do header fechar o detalhe ao invés de sair da página).
  const selectedCalc = selectedCalcProp !== undefined ? selectedCalcProp : internalSelectedCalc;
  const setSelectedCalc = onSelectedCalcChange || setInternalSelectedCalc;
  const [openSections, setOpenSections] = useState({ favoritas: true });

  // User context for favorites persistence
  const { user, updateUser } = useUser();
  const favorites = useMemo(() => user?.calculatorFavorites || [], [user?.calculatorFavorites]);

  const toggleFavorite = useCallback((calcId) => {
    const current = user?.calculatorFavorites || [];
    const next = current.includes(calcId)
      ? current.filter(id => id !== calcId)
      : [...current, calcId];
    updateUser({ calculatorFavorites: next });
  }, [user?.calculatorFavorites, updateUser]);

  // Get sections with their calculators
  const sections = useMemo(() => getSectionsWithCalculators(), []);

  // All calculators (flat list for favorites lookup)
  const allCalculators = useMemo(() => getAllCalculators(), []);

  // Toggle seção
  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Filter sections based on search + prepend favorites section
  const filteredSections = useMemo(() => {
    const term = searchTerm ? searchTerm.toLowerCase() : '';

    // Build favorites section
    // ⚠️ `allCalculators` inclui as INATIVAS de propósito — é o que permite o
    // `LEGACY_ID_MAP` resolver favorito antigo. Sem filtrar por status aqui,
    // desativar uma calculadora não a desativaria para quem a favoritou: ela
    // sumiria da seção dela e continuaria aparecendo em "Favoritas".
    const favoriteCalcs = favorites
      .map(id => allCalculators.find(c => c.id === id))
      .filter(Boolean)
      .filter(c => c.status !== 'inactive');

    const filteredFavorites = term
      ? favoriteCalcs.filter(c =>
          c.title.toLowerCase().includes(term) ||
          c.subtitle?.toLowerCase().includes(term)
        )
      : favoriteCalcs;

    const favoritasSection = filteredFavorites.length > 0
      ? [{ id: 'favoritas', title: 'Favoritas', icon: 'Star', calculators: filteredFavorites }]
      : [];

    // Filter regular sections
    const regularSections = term
      ? sections
          .map((section) => ({
            ...section,
            calculators: section.calculators.filter(
              (calc) =>
                calc.title.toLowerCase().includes(term) ||
                calc.subtitle?.toLowerCase().includes(term)
            ),
          }))
          .filter((section) => section.calculators.length > 0)
      : sections;

    return [...favoritasSection, ...regularSections];
  }, [sections, searchTerm, favorites, allCalculators]);

  // Coming soon toast state
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Handle calculator click
  const handleCalculatorClick = (calc) => {
    if (calc.status === 'coming_soon') {
      setShowComingSoon(true);
      setTimeout(() => setShowComingSoon(false), 2500);
    } else {
      setSelectedCalc(calc.id);
    }
  };

  // If a calculator is selected, show its dedicated page
  if (selectedCalc) {
    const calculator = getCalculatorById(selectedCalc);
    if (calculator) {
      return (
        <CalculatorPage
          calculator={calculator}
          onBack={() => setSelectedCalc(null)}
        />
      );
    }
  }

  return (
    <div className="space-y-4 min-h-dvh">
      {/* Coming Soon Toast */}
      {showComingSoon && (
        <div
          className={cn(
            "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
            "px-4 py-3 rounded-xl shadow-lg",
            "bg-primary text-primary-foreground",
            "animate-in fade-in slide-in-from-bottom-4 duration-300"
          )}
        >
          <p className="text-sm font-medium">Em breve!</p>
        </div>
      )}

      {/* Sections with calculators */}
      {filteredSections.length === 0 ? (
        <div className="text-center py-8">
          <Calculator className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">Nenhuma calculadora encontrada</p>
        </div>
      ) : (
        /* ⚠️ deitado as seções ficam em DUAS COLUNAS (continuação do modo
           horizontal, 28/08). Fechadas elas são 13 faixas de ~76px numa coluna
           só: medido a 897×440, cabiam 5 das 13 na tela, e cada faixa usava
           821px de largura para um título e uma contagem. Em duas, cabem 10.
           Grade e não multi-coluna de propósito: a seção ABRE e fecha, e o fluxo
           de colunas rebalancearia a lista inteira a cada toque — num aparelho
           que se usa na beira do leito, o cartão mudar de coluna sob o dedo é
           pior do que o vão que a grade deixa ao lado da seção aberta.
           A grade INTERNA de calculadoras segue em duas: cada coluna fica com
           ~400px e o cartão com ~190px, praticamente o mesmo dos 375px do
           retrato — nada encolhe. */
        <div className="space-y-3 deitado:grid deitado:grid-cols-2 deitado:gap-3 deitado:space-y-0 deitado:items-start">
          {filteredSections.map((section) => {
            const isOpen = openSections[section.id] || searchTerm.length > 0;
            return (
              /* ⚠️ deitado a seção ABERTA ocupa as DUAS colunas. Numa grade, a
                 linha fica tão alta quanto o item mais alto: com a seção aberta
                 em meia largura, a seção curta ao lado deixava metade da tela em
                 branco. Inteira, ela vira um painel e as calculadoras cabem em
                 QUATRO colunas de ~190px — mais largas que os ~171px que o cartão
                 tem no retrato a 375px, então nada encolhe. */
              <section key={section.id} className={isOpen ? 'deitado:col-span-2' : undefined}>
                <SectionHeader
                  icon={section.icon}
                  title={section.title}
                  count={section.calculators.length}
                  isOpen={isOpen}
                  onToggle={() => toggleSection(section.id)}
                />
                {isOpen && (
                  <div className={cn("grid grid-cols-2 deitado:grid-cols-4 gap-3 mt-3", !searchTerm && "ds-stagger-in")}>
                    {section.calculators.map((calc) => {
                      const IconComponent = SECTION_ICONS[calc.icon] || Calculator;
                      const isComingSoon = calc.status === 'coming_soon';
                      const isPed = calc.id.startsWith('ped_');
                      return (
                        <WidgetCard
                          key={calc.id}
                          icon={<IconComponent className="w-5 h-5" />}
                          title={calc.title}
                          subtitle={calc.subtitle}
                          badge={isPed ? 'PED' : undefined}
                          badgeVariant={isPed ? 'default' : undefined}
                          variant="interactive"
                          onClick={() => handleCalculatorClick(calc)}
                          isFavorite={favorites.includes(calc.id)}
                          onFavoriteClick={() => toggleFavorite(calc.id)}
                          className={isComingSoon ? 'opacity-60' : ''}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Info Footer */}
      <div
        className={cn(
          "p-4 rounded-xl",
          "bg-muted",
          "border border-border"
        )}
      >
        <p className="text-xs text-muted-foreground">
          <strong>Nota:</strong> As calculadoras sao ferramentas de apoio e nao
          substituem o julgamento clinico. Todas as calculadoras foram validadas
          contra literatura medica indexada (PubMed, NCBI) e guidelines de
          sociedades medicas (ACC/AHA, CHEST, ESC, ASA, WFSAHQ).
        </p>
      </div>
    </div>
  );
}

export default CalculatorShowcase;
