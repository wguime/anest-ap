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

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Calculator,
  Baby,
  Heart,
  HeartPulse,
  Wind,
  Shield,
  Stethoscope,
  Droplet,
  Activity,
  Brain,
  User,
  X,
  ArrowLeft,
  Info,
  Siren,
  Pill,
  RotateCcw,
  BedDouble,
  Scale,
  Thermometer,
  Check,
  Zap,
  Ruler,
  Clock,
  ClipboardCheck,
  AlertTriangle,
  TrendingDown,
  BarChart2,
  Frown,
  Flame,
  Droplets,
  Syringe,
  Moon,
  AlertCircle,
  Apple,
  FileText,
  Eye,
  Bed,
  Beaker,
  FlaskConical,
  RefreshCw,
  Plus,
  Minus,
  Bell,
  Bone,
  BookOpen,
  ListChecks,
  ChevronDown,
  ShieldAlert,
  Bug,
  Star,
} from 'lucide-react';
import { cn } from '../utils/tokens';
import { WidgetCard } from '../components/ui/widget-card';
import { RiskFactorCard } from '../components/anest/risk-factor-card';
import { Input } from '../components/ui/input';
import { useUser } from '../../contexts/UserContext';
import { SearchBar } from '../components/anest/search-bar';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import {
  getCalculatorById,
  calculatorSections,
  getSectionsWithCalculators,
  getAllCalculators,
} from '../data/calculator-definitions';

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
      {/* 1. AVISOS CRITICOS - Vermelho, sempre visivel no topo */}
      {warnings.length > 0 && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-red-50 dark:bg-red-950/30",
          "border border-red-300 dark:border-red-800"
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-red-800 dark:text-red-300 text-sm mb-2">
                {warnings.length === 1 ? 'Aviso' : 'Avisos Criticos'}
              </h4>
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. DOSES - Azul, destaque para dosagens */}
      {doses.length > 0 && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-blue-50 dark:bg-blue-950/30",
          "border border-blue-300 dark:border-blue-800"
        )}>
          <div className="flex items-start gap-3">
            <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2">
                Doses e Orientacoes
              </h4>
              <ul className="space-y-1.5">
                {doses.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 3. INTERPRETACAO - Verde, explicacao principal */}
      {interpretation && (
        <div className={cn(
          "p-4 rounded-xl",
          "bg-[#E8F5E9] dark:bg-[#1A2420]",
          "border border-[#A5D6A7] dark:border-[#2A3F36]"
        )}>
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-[#006837] dark:text-[#2ECC71] text-sm mb-2">
                Interpretacao
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {interpretation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. PONTOS-CHAVE - Neutro, colapsivel */}
      {keyPoints.length > 0 && (
        <div className={cn(
          "rounded-xl overflow-hidden",
          "bg-slate-50 dark:bg-slate-900/50",
          "border border-slate-200 dark:border-slate-700"
        )}>
          <button
            onClick={() => setIsKeyPointsOpen(!isKeyPointsOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ListChecks className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Pontos-Chave
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {keyPoints.length}
              </span>
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-slate-500 transition-transform duration-200",
              isKeyPointsOpen && "rotate-180"
            )} />
          </button>

          {isKeyPointsOpen && (
            <div className="px-4 pb-4 pt-0">
              <ul className="space-y-1.5 ml-8">
                {keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-2 flex-shrink-0" />
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
          "bg-[#E8F5E9] dark:bg-[#1A2420]",
          "border border-[#A5D6A7] dark:border-[#2A3F36]"
        )}>
          <h4 className="font-bold text-[#006837] dark:text-[#2ECC71] mb-3 flex items-center gap-2 text-sm">
            <Info className="w-5 h-5" />
            {infoBox.title}
          </h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {infoBox.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006837] dark:bg-[#2ECC71] mt-2 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. REFERENCIA - Cinza, destaque sutil */}
      {ref && (
        <div className={cn(
          "p-3 rounded-xl",
          "bg-gray-50 dark:bg-gray-900/50",
          "border border-gray-200 dark:border-gray-700"
        )}>
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 dark:text-gray-400 italic">
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
        return 'text-[#006837] dark:text-[#2ECC71] bg-[#E8F5E9] dark:bg-[#1A3D2E]';
      case 'medio':
        return 'text-[#B45309] dark:text-[#F39C12] bg-[#FEF3C7] dark:bg-[#3D2E1A]';
      case 'alto':
        return 'text-[#DC2626] dark:text-[#E74C3C] bg-[#FEE2E2] dark:bg-[#3D1A1A]';
      case 'critico':
        return 'text-white bg-[#DC2626] dark:bg-[#E74C3C]';
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
        riskLevel === 'baixo' && "border-[#006837] dark:border-[#2ECC71]",
        riskLevel === 'medio' && "border-[#F59E0B] dark:border-[#F39C12]",
        riskLevel === 'alto' && "border-[#DC2626] dark:border-[#E74C3C]",
        riskLevel === 'critico' && "border-[#DC2626] dark:border-[#E74C3C]",
        !riskLevel && "border-[#A5D6A7] dark:border-[#2A3F36]"
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
              riskLevel === 'baixo' && "bg-[#006837] dark:bg-[#2ECC71]",
              riskLevel === 'medio' && "bg-[#F59E0B] dark:bg-[#F39C12]",
              riskLevel === 'alto' && "bg-[#DC2626] dark:bg-[#E74C3C]",
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

// Cores harmonizadas para dark mode usando Material Design color scales
// Dark BG: Neutro (#1A1C1E base) com leve tint da categoria (~5-10%)
// Dark Border: Material 300 (saturacao media, identificacao visual)
// Dark Text: Material 100-200 (dessaturado, alta legibilidade)
const CATEGORIA_COLORS = {
  // PCR - Emergencia (vermelho)
  pcr: {
    bg: '#FFEBEE', border: '#EF5350', text: '#C62828', iconName: 'Siren',
    darkBg: '#1E1A1A', darkBorder: '#E57373', darkText: '#FFCDD2'
  },
  // Anticonvulsivante (laranja)
  anticonvulsivante: {
    bg: '#FFF3E0', border: '#FF9800', text: '#E65100', iconName: 'Zap',
    darkBg: '#1E1C1A', darkBorder: '#FFB74D', darkText: '#FFE0B2'
  },
  // Antidotos (verde)
  antidotos: {
    bg: '#E8F5E9', border: '#66BB6A', text: '#2E7D32', iconName: 'ShieldAlert',
    darkBg: '#1A1E1A', darkBorder: '#81C784', darkText: '#C8E6C9'
  },
  // Sedacao/Anestesia (roxo)
  sedacao: {
    bg: '#F3E5F5', border: '#AB47BC', text: '#7B1FA2', iconName: 'Syringe',
    darkBg: '#1C1A1E', darkBorder: '#BA68C8', darkText: '#E1BEE7'
  },
  // Analgesicos (azul)
  analgesicos: {
    bg: '#E3F2FD', border: '#42A5F5', text: '#1565C0', iconName: 'Pill',
    darkBg: '#1A1C1E', darkBorder: '#64B5F6', darkText: '#BBDEFB'
  },
  // AINEs (coral/vermelho claro)
  aines: {
    bg: '#FFCDD2', border: '#E57373', text: '#C62828', iconName: 'Flame',
    darkBg: '#1E1A1A', darkBorder: '#EF9A9A', darkText: '#FFCDD2'
  },
  // Corticoides (azul claro)
  corticoides: {
    bg: '#E1F5FE', border: '#29B6F6', text: '#0277BD', iconName: 'Droplet',
    darkBg: '#1A1C1E', darkBorder: '#4FC3F7', darkText: '#B3E5FC'
  },
  // Antibioticos (teal)
  antibioticos: {
    bg: '#E0F2F1', border: '#26A69A', text: '#00695C', iconName: 'Bug',
    darkBg: '#1A1D1C', darkBorder: '#4DB6AC', darkText: '#B2DFDB'
  },
  // Rotina Cirurgica (cinza neutro)
  rotina: {
    bg: '#ECEFF1', border: '#78909C', text: '#37474F', iconName: 'Stethoscope',
    darkBg: '#1C1D1E', darkBorder: '#90A4AE', darkText: '#CFD8DC'
  },
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

// Cores para categorias ACLS (usando nomes de ícones Lucide)
const ACLS_COLORS = {
  desfib: {
    bg: '#FFF3E0', border: '#FF9800', text: '#E65100', iconName: 'Zap',
    darkBg: '#1E1C1A', darkBorder: '#FFB74D', darkText: '#FFE0B2'
  },
  sbv: {
    bg: '#E3F2FD', border: '#1976D2', text: '#0D47A1', iconName: 'Wind',
    darkBg: '#1A1D2E', darkBorder: '#64B5F6', darkText: '#BBDEFB'
  },
  pcr_drogas: {
    bg: '#FFEBEE', border: '#EF5350', text: '#C62828', iconName: 'Syringe',
    darkBg: '#1E1A1A', darkBorder: '#E57373', darkText: '#FFCDD2'
  },
  bicarbonato: {
    bg: '#E3F2FD', border: '#42A5F5', text: '#1565C0', iconName: 'FlaskConical',
    darkBg: '#1A1C1E', darkBorder: '#64B5F6', darkText: '#BBDEFB'
  },
  atropina: {
    bg: '#F3E5F5', border: '#AB47BC', text: '#7B1FA2', iconName: 'HeartPulse',
    darkBg: '#1C1A1E', darkBorder: '#BA68C8', darkText: '#E1BEE7'
  },
  vasoativas: {
    bg: '#E8F5E9', border: '#66BB6A', text: '#2E7D32', iconName: 'Droplets',
    darkBg: '#1A1E1A', darkBorder: '#81C784', darkText: '#C8E6C9'
  },
  anafilaxia: {
    bg: '#FCE4EC', border: '#E91E63', text: '#880E4F', iconName: 'AlertTriangle',
    darkBg: '#1E1A1C', darkBorder: '#F48FB1', darkText: '#F8BBD9'
  },
  antidotos: {
    bg: '#FFF8E1', border: '#FFC107', text: '#F57F17', iconName: 'ShieldAlert',
    darkBg: '#1E1D1A', darkBorder: '#FFD54F', darkText: '#FFF8E1'
  },
  hipertermia_maligna: {
    bg: '#FFEBEE', border: '#F44336', text: '#B71C1C', iconName: 'Thermometer',
    darkBg: '#1E1717', darkBorder: '#EF5350', darkText: '#FFCDD2'
  },
  tci_sedacao: {
    bg: '#E8EAF6', border: '#5C6BC0', text: '#283593', iconName: 'Activity',
    darkBg: '#1A1A1E', darkBorder: '#7986CB', darkText: '#C5CAE9'
  },
  arritmias_controle: {
    bg: '#E8F5E9', border: '#4CAF50', text: '#1B5E20', iconName: 'Activity',
    darkBg: '#171E17', darkBorder: '#81C784', darkText: '#C8E6C9'
  },
  cardioversao: {
    bg: '#FFF3E0', border: '#FF9800', text: '#E65100', iconName: 'Zap',
    darkBg: '#1E1B17', darkBorder: '#FFB74D', darkText: '#FFE0B2'
  },
  manutencao: {
    bg: '#E0F2F1', border: '#26A69A', text: '#00695C', iconName: 'RefreshCw',
    darkBg: '#1A1D1C', darkBorder: '#4DB6AC', darkText: '#B2DFDB'
  },
};

// Cores para categorias ADULTO (Doses em Adultos)
const ADULT_CATEGORIA_COLORS = {
  // Indutores (roxo)
  indutores: {
    bg: '#F3E5F5', border: '#AB47BC', text: '#7B1FA2', iconName: 'Syringe',
    darkBg: '#1C1A1E', darkBorder: '#BA68C8', darkText: '#E1BEE7'
  },
  // Opioides (azul)
  opioides: {
    bg: '#E3F2FD', border: '#1976D2', text: '#0D47A1', iconName: 'Pill',
    darkBg: '#1A1D2E', darkBorder: '#64B5F6', darkText: '#BBDEFB'
  },
  // BNM (laranja)
  bnm: {
    bg: '#FFF3E0', border: '#FF9800', text: '#E65100', iconName: 'Zap',
    darkBg: '#1E1C1A', darkBorder: '#FFB74D', darkText: '#FFE0B2'
  },
  // Reversores (verde)
  reversores: {
    bg: '#E8F5E9', border: '#66BB6A', text: '#2E7D32', iconName: 'RefreshCw',
    darkBg: '#1A1E1A', darkBorder: '#81C784', darkText: '#C8E6C9'
  },
  // Vasopressores (vermelho)
  vasopressores: {
    bg: '#FFEBEE', border: '#EF5350', text: '#C62828', iconName: 'HeartPulse',
    darkBg: '#1E1A1A', darkBorder: '#E57373', darkText: '#FFCDD2'
  },
  // Adjuvantes (teal)
  adjuvantes: {
    bg: '#E0F2F1', border: '#26A69A', text: '#00695C', iconName: 'Beaker',
    darkBg: '#1A1D1C', darkBorder: '#4DB6AC', darkText: '#B2DFDB'
  },
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

  // Abrir primeira categoria por padrão quando resultado muda
  useEffect(() => {
    if (result?.categorias?.length > 0) {
      setOpenCategories({ [result.categorias[0].key]: true });
    }
  }, [result?.categorias]);

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header com input de peso - PADRÃO DS (verde) */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde escuro elegante
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Peso do Paciente (kg)
        </p>
        <input
          type="number"
          value={peso || ''}
          onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
          placeholder="Digite o peso"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            // Light: fundo semi-transparente branco
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            // Dark: fundo escuro com texto verde
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="30"
          max="200"
          step="1"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {result?.totalMedicamentos
            ? `${result.totalMedicamentos} medicamentos em ${result.categorias.length} categorias`
            : 'Digite o peso para calcular'}
        </p>
      </div>

      {/* Categorias em Accordion - so mostra se tiver resultado */}
      {result?.categorias && (
        <div className="space-y-2">
        {result.categorias.map((categoria) => {
          const colors = ADULT_CATEGORIA_COLORS[categoria.key] || ADULT_CATEGORIA_COLORS.indutores;
          const isOpen = openCategories[categoria.key];

          // Cores adaptadas para dark mode
          const bgColor = isDark ? colors.darkBg : colors.bg;
          const textColor = isDark ? colors.darkText : colors.text;
          const borderColor = isDark ? colors.darkBorder : colors.border;

          return (
            <div key={categoria.key}>
              {/* Header clicável da categoria */}
              <button
                onClick={() => toggleCategory(categoria.key)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-3 rounded-lg",
                  "border-l-4 transition-all duration-200",
                  "hover:opacity-90"
                )}
                style={{
                  backgroundColor: bgColor,
                  borderLeftColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = ADULT_ICON_MAP[colors.iconName] || Syringe;
                    return <IconComponent className="w-5 h-5" style={{ color: textColor }} />;
                  })()}
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
                    {categoria.medicamentos.length}
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

              {/* Conteúdo colapsável - MESMO LAYOUT DO PEDICALC */}
              {isOpen && (
                <div className="mt-2 space-y-2 pl-2">
                  {categoria.medicamentos.map((med, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl",
                        "bg-card border border-[#E5E7EB] dark:border-[#2A3F36]"
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
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                          }}
                        >
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
                      <div className="flex items-center gap-3 pt-2 border-t border-[#E5E7EB] dark:border-[#2A3F36]">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Dose</p>
                          <p className="font-bold text-foreground">{med.dose}</p>
                        </div>
                        {med.obs && (
                          <>
                            <div className="text-muted-foreground">|</div>
                            <div
                              className="flex-1 p-2 rounded-lg text-center"
                              style={{
                                backgroundColor: isDark
                                  ? `${colors.darkBorder}1F`
                                  : colors.bg,
                                border: isDark ? `1px solid ${colors.darkBorder}40` : 'none'
                              }}
                            >
                              <p className="text-xs" style={{ color: textColor }}>Obs</p>
                              <p className="font-medium text-xs" style={{ color: textColor }}>
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

  // Abrir primeira categoria por padrão quando resultado muda
  useEffect(() => {
    if (result?.categorias?.length > 0) {
      setOpenCategories({ [result.categorias[0].key]: true });
    }
  }, [result?.categorias]);

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header com input de peso */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde escuro elegante
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Peso da Crianca (kg)
        </p>
        <input
          type="number"
          value={peso || ''}
          onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
          placeholder="Digite o peso"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            // Light: fundo semi-transparente branco
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            // Dark: fundo escuro com texto verde
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="0.5"
          max="150"
          step="0.1"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {result?.totalMedicamentos
            ? `${result.totalMedicamentos} medicamentos em ${result.categorias.length} categorias`
            : 'Digite o peso para calcular'}
        </p>
      </div>

      {/* Categorias em Accordion - so mostra se tiver resultado */}
      {result?.categorias && (
        <div className="space-y-2">
        {result.categorias.map((categoria) => {
          const colors = CATEGORIA_COLORS[categoria.key] || CATEGORIA_COLORS.pcr;
          const isOpen = openCategories[categoria.key];

          // Cores adaptadas para dark mode
          const bgColor = isDark ? colors.darkBg : colors.bg;
          const textColor = isDark ? colors.darkText : colors.text;
          const borderColor = isDark ? colors.darkBorder : colors.border;

          return (
            <div key={categoria.key}>
              {/* Header clicável da categoria */}
              <button
                onClick={() => toggleCategory(categoria.key)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-3 rounded-lg",
                  "border-l-4 transition-all duration-200",
                  "hover:opacity-90"
                )}
                style={{
                  backgroundColor: bgColor,
                  borderLeftColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = PEDI_ICON_MAP[colors.iconName] || Siren;
                    return <IconComponent className="w-5 h-5" style={{ color: textColor }} />;
                  })()}
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
                    {categoria.medicamentos.length}
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
                  {categoria.medicamentos.map((med, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl",
                        "bg-card border border-[#E5E7EB] dark:border-[#2A3F36]"
                      )}
                    >
                      {/* Warning no topo do card (se houver) */}
                      {med.warning && (
                        <div className={cn(
                          "mb-3 p-2 rounded-lg flex items-start gap-2",
                          "bg-red-50 dark:bg-red-950/30",
                          "border border-red-200 dark:border-red-800"
                        )}>
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700 dark:text-red-300">
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
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                          }}
                        >
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
                      <div className="flex items-center gap-3 pt-2 border-t border-[#E5E7EB] dark:border-[#2A3F36]">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Dose</p>
                          <p className="font-bold text-foreground">{med.dose}</p>
                        </div>
                        <div className="text-muted-foreground">=</div>
                        <div
                          className="flex-1 p-2 rounded-lg text-center"
                          style={{
                            // Dark mode: fundo sutil com 12% da cor da borda
                            // Light mode: cor de fundo pastel original
                            backgroundColor: isDark
                              ? `${colors.darkBorder}1F`  // 12% opacity (hex 1F = 31/255)
                              : colors.bg,
                            border: isDark ? `1px solid ${colors.darkBorder}40` : 'none'
                          }}
                        >
                          <p className="text-xs" style={{ color: textColor }}>Volume</p>
                          <p className="font-bold text-lg" style={{ color: textColor }}>
                            {med.volume}
                          </p>
                        </div>
                      </div>

                      {/* Observação/Interpretação ao final do card (se houver) */}
                      {med.obs && (
                        <div className={cn(
                          "mt-3 p-2 rounded-lg flex items-start gap-2",
                          "bg-[#E8F5E9] dark:bg-[#1A2420]",
                          "border border-[#A5D6A7] dark:border-[#2A3F36]"
                        )}>
                          <Info className="w-4 h-4 text-[#006837] dark:text-[#2ECC71] mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-[#1B5E20] dark:text-[#A5D6A7]">
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
      )}
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

  // Abrir primeira categoria por padrão
  useEffect(() => {
    if (result?.categorias?.length > 0) {
      setOpenCategories({ [result.categorias[0].key]: true });
    }
  }, [result?.categorias]);

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header com input de peso - mesmo padrao do PediCalc */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde escuro elegante (igual PediCalc)
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave (igual PediCalc)
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Peso do Paciente (kg)
        </p>
        <input
          type="number"
          value={peso || ''}
          onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
          placeholder="70"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            // Light: fundo semi-transparente branco
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            // Dark: fundo escuro com texto verde (igual PediCalc)
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="5"
          max="200"
          step="1"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {result?.totalItens
            ? `${result.totalItens} itens em ${result.categorias?.length || 0} categorias`
            : 'Digite o peso para calcular'}
        </p>
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
                  "border-l-4 transition-all duration-200",
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
                        "bg-card border border-[#E5E7EB] dark:border-[#2A3F36]"
                      )}
                    >
                      {/* Warning no topo do card (se houver) */}
                      {item.warning && (
                        <div className={cn(
                          "mb-3 p-2 rounded-lg flex items-start gap-2",
                          "bg-red-50 dark:bg-red-950/30",
                          "border border-red-200 dark:border-red-800"
                        )}>
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700 dark:text-red-300">
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
                              "bg-[#E8F5E9] dark:bg-[#1A2420]",
                              "border border-[#A5D6A7] dark:border-[#2A3F36]"
                            )}>
                              <Info className="w-4 h-4 text-[#006837] dark:text-[#2ECC71] mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-[#1B5E20] dark:text-[#A5D6A7]">
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
                              "bg-[#E8F5E9] dark:bg-[#1A2420]",
                              "border border-[#A5D6A7] dark:border-[#2A3F36]"
                            )}>
                              <Info className="w-4 h-4 text-[#006837] dark:text-[#2ECC71] mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-[#1B5E20] dark:text-[#A5D6A7]">
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

  // Verificar se todos os campos estao preenchidos
  const allFieldsFilled = inputs?.peso > 0 && inputs?.idade_valor >= 0 && inputs?.idade_valor !== '';

  // Classes comuns para inputs - mesmo padrao do PediCalc
  const inputClass = cn(
    "w-full text-center text-xl font-bold py-2 rounded-lg",
    "bg-white/20 text-white placeholder-white/60",
    "focus:outline-none focus:ring-2 focus:ring-white/50",
    "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
    "dark:focus:ring-[#2ECC71]/50"
  );

  const unidadeAtual = inputs?.idade_unidade || 'meses';

  return (
    <div className="space-y-4">
      {/* Header com inputs de peso e idade - mesmo padrao do PediCalc */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde institucional
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        {/* Peso */}
        <div className="mb-3">
          <p className="text-white dark:text-[#2ECC71] text-xs font-medium mb-1 text-center">
            Peso (kg)
          </p>
          <input
            type="number"
            value={inputs?.peso || ''}
            onChange={(e) => onInputChange('peso', parseFloat(e.target.value) || 0)}
            placeholder="Peso"
            className={inputClass}
            min="0.5"
            max="50"
            step="0.5"
          />
        </div>

        {/* Idade - toggle buttons + input */}
        <div className="grid grid-cols-2 gap-3">
          {/* Toggle Meses/Anos */}
          <div>
            <p className="text-white dark:text-[#2ECC71] text-xs font-medium mb-1 text-center">
              Unidade
            </p>
            <div className="flex rounded-lg overflow-hidden h-[42px]">
              <button
                type="button"
                onClick={() => onInputChange('idade_unidade', 'meses')}
                className={cn(
                  "flex-1 text-sm font-semibold transition-colors",
                  unidadeAtual === 'meses'
                    ? "bg-white text-[#006837] dark:bg-[#2ECC71] dark:text-[#0D1F17]"
                    : "bg-white/20 text-white/70 hover:bg-white/30 dark:bg-[#0D1F17] dark:text-[#2ECC71]/70 dark:hover:bg-[#0D1F17]/80"
                )}
              >
                Meses
              </button>
              <button
                type="button"
                onClick={() => onInputChange('idade_unidade', 'anos')}
                className={cn(
                  "flex-1 text-sm font-semibold transition-colors",
                  unidadeAtual === 'anos'
                    ? "bg-white text-[#006837] dark:bg-[#2ECC71] dark:text-[#0D1F17]"
                    : "bg-white/20 text-white/70 hover:bg-white/30 dark:bg-[#0D1F17] dark:text-[#2ECC71]/70 dark:hover:bg-[#0D1F17]/80"
                )}
              >
                Anos
              </button>
            </div>
          </div>
          {/* Idade input */}
          <div>
            <p className="text-white dark:text-[#2ECC71] text-xs font-medium mb-1 text-center">
              Idade
            </p>
            <input
              type="number"
              value={inputs?.idade_valor ?? ''}
              onChange={(e) => onInputChange('idade_valor', e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0"
              className={cn(inputClass, "h-[42px]")}
              min="0"
              max={unidadeAtual === 'anos' ? 18 : 216}
              step="1"
            />
          </div>
        </div>

        {/* Categoria calculada */}
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs text-center mt-3">
          {categoria ? `Categoria: ${categoria}` : 'Preencha todos os campos'}
        </p>
      </div>

      {/* Grid de resultados - mostra apenas se todos os campos estiverem preenchidos */}
      {allFieldsFilled && result?.details && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {/* Tubo SEM Cuff */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E3F2FD] dark:bg-[#1A2420]",
              "border border-[#90CAF9] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Tubo SEM Cuff</p>
              <p className="text-2xl font-bold text-[#1565C0] dark:text-[#42A5F5]">
                {tuboSemCuff || '-'}
              </p>
              <p className="text-xs text-muted-foreground">mm</p>
            </div>

            {/* Tubo COM Cuff */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E8F5E9] dark:bg-[#1A2420]",
              "border border-[#A5D6A7] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Tubo COM Cuff</p>
              <p className="text-2xl font-bold text-[#2E7D32] dark:text-[#66BB6A]">
                {tuboComCuff || '-'}
              </p>
              <p className="text-xs text-muted-foreground">mm (Duracher)</p>
            </div>

            {/* Profundidade */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#FFF3E0] dark:bg-[#1A2420]",
              "border border-[#FFCC80] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Profundidade Oral</p>
              <p className="text-2xl font-bold text-[#E65100] dark:text-[#FFB74D]">
                {profundidade || '-'}
              </p>
              <p className="text-xs text-muted-foreground">cm (na rima)</p>
            </div>

            {/* Mascara Laringea */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#F3E5F5] dark:bg-[#1A2420]",
              "border border-[#CE93D8] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Mascara Laringea</p>
              <p className="text-2xl font-bold text-[#7B1FA2] dark:text-[#BA68C8]">
                #{lma || '-'}
              </p>
              <p className="text-xs text-muted-foreground">LMA</p>
            </div>
          </div>

          {/* Nota sobre tubos */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-amber-50 dark:bg-[#1A2420]",
            "border border-amber-200 dark:border-amber-800/30"
          )}>
            <p className="text-xs text-amber-800 dark:text-amber-400">
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
    <div className="space-y-4">
      {/* Header com input de peso - mesmo padrao do PediCalc */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde institucional
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Peso da Crianca (kg)
        </p>
        <input
          type="number"
          value={peso || ''}
          onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
          placeholder="Digite o peso"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="1"
          max="50"
          step="0.5"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {result ? 'Valores calculados abaixo' : 'Digite o peso para calcular'}
        </p>
      </div>

      {/* Grid de resultados - mostra apenas se tiver resultado */}
      {result?.details && (
        <>
          {/* Choques de Desfibrilação */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1º Choque */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#FFF3E0] dark:bg-[#1A2420]",
              "border border-[#FFCC80] dark:border-[#FF9800]/30"
            )}>
              <p className="text-xs text-muted-foreground mb-1">1º Choque (FV/TV)</p>
              <p className="text-2xl font-bold text-[#E65100] dark:text-[#FFB74D]">
                {details['1o Choque (FV/TV)'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">2 J/kg</p>
            </div>

            {/* 2º Choque */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#FBE9E7] dark:bg-[#1A2420]",
              "border border-[#FFAB91] dark:border-[#FF5722]/30"
            )}>
              <p className="text-xs text-muted-foreground mb-1">2º Choque</p>
              <p className="text-2xl font-bold text-[#D84315] dark:text-[#FF8A65]">
                {details['2o Choque'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">4 J/kg</p>
            </div>
          </div>

          {/* Choques Subsequentes */}
          <div className={cn(
            "p-4 rounded-xl text-center",
            "bg-[#FFEBEE] dark:bg-[#1A2420]",
            "border border-[#EF9A9A] dark:border-[#EF5350]/30"
          )}>
            <p className="text-xs text-muted-foreground mb-1">Choques Subsequentes</p>
            <p className="text-xl font-bold text-[#C62828] dark:text-[#EF5350]">
              {details['Choques subsequentes'] || '-'}
            </p>
            <p className="text-xs text-muted-foreground">4-10 J/kg (max 200J)</p>
          </div>

          {/* Cardioversão */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E8F5E9] dark:bg-[#1A2420]",
              "border border-[#A5D6A7] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Cardioversao Inicial</p>
              <p className="text-xl font-bold text-[#2E7D32] dark:text-[#66BB6A]">
                {details['Cardioversao inicial'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">0.5-1 J/kg</p>
            </div>

            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E3F2FD] dark:bg-[#1A2420]",
              "border border-[#90CAF9] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Cardioversao Repetir</p>
              <p className="text-xl font-bold text-[#1565C0] dark:text-[#42A5F5]">
                {details['Cardioversao repetir'] || '-'}
              </p>
              <p className="text-xs text-muted-foreground">2 J/kg</p>
            </div>
          </div>

          {/* Nota PALS */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-amber-50 dark:bg-[#1A2420]",
            "border border-amber-200 dark:border-amber-800/30"
          )}>
            <p className="text-xs text-amber-800 dark:text-amber-400">
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
    <div className="space-y-4">
      {/* Header com input de comprimento - mesmo padrao do PediCalc */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde institucional
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Comprimento da Crianca (cm)
        </p>
        <input
          type="number"
          value={comprimento || ''}
          onChange={(e) => onComprimentoChange(parseFloat(e.target.value) || 0)}
          placeholder="46 - 150 cm"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="46"
          max="150"
          step="1"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {faixa ? `Faixa: ${faixa.rangeComprimento}` : 'Digite o comprimento (46-150 cm)'}
        </p>
      </div>

      {/* Erro - fora da faixa */}
      {isError && (
        <div className={cn(
          "p-4 rounded-xl text-center",
          "bg-red-50 dark:bg-red-950/30",
          "border border-red-300 dark:border-red-800"
        )}>
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 font-medium">
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
              "bg-[#E3F2FD] dark:bg-[#1A2420]",
              "border border-[#90CAF9] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Peso Estimado</p>
              <p className="text-2xl font-bold text-[#1565C0] dark:text-[#42A5F5]">
                {faixa.pesoMin}-{faixa.pesoMax}
              </p>
              <p className="text-xs text-muted-foreground">kg</p>
            </div>

            {/* Tubo ET */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E8F5E9] dark:bg-[#1A2420]",
              "border border-[#A5D6A7] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Tubo ET</p>
              <p className="text-2xl font-bold text-[#2E7D32] dark:text-[#66BB6A]">
                {faixa.tubo}
              </p>
              <p className="text-xs text-muted-foreground">mm</p>
            </div>

            {/* Mascara Laringea */}
            <div className={cn(
              "p-4 rounded-xl text-center col-span-2",
              "bg-[#F3E5F5] dark:bg-[#1A2420]",
              "border border-[#CE93D8] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Mascara Laringea (LMA)</p>
              <p className="text-2xl font-bold text-[#7B1FA2] dark:text-[#BA68C8]">
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
    <div className="space-y-4">
      {/* Header com input de peso - mesmo padrao do PediCalc */}
      <div className={cn(
        "p-4 rounded-xl",
        "bg-[#006837]",
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Peso do Paciente (kg)
        </p>
        <input
          type="number"
          value={peso || ''}
          onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
          placeholder="Digite o peso"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="1"
          max="200"
          step="0.1"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {result ? 'Regra 4-2-1 calculada' : 'Digite o peso para calcular'}
        </p>
      </div>

      {/* Resultados - mostra apenas se tiver resultado */}
      {result?.details && (
        <>
          {/* Volume por hora e 24h */}
          <div className="grid grid-cols-2 gap-3">
            {/* mL/hora */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E3F2FD] dark:bg-[#1A2420]",
              "border border-[#90CAF9] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Manutencao</p>
              <p className="text-3xl font-bold text-[#1565C0] dark:text-[#42A5F5]">
                {details.mlHora?.toFixed(1) || '-'}
              </p>
              <p className="text-sm text-muted-foreground font-medium">mL/hora</p>
            </div>

            {/* mL/24h */}
            <div className={cn(
              "p-4 rounded-xl text-center",
              "bg-[#E8F5E9] dark:bg-[#1A2420]",
              "border border-[#A5D6A7] dark:border-[#2A3F36]"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Volume 24h</p>
              <p className="text-3xl font-bold text-[#2E7D32] dark:text-[#66BB6A]">
                {details.ml24h?.toFixed(0) || '-'}
              </p>
              <p className="text-sm text-muted-foreground font-medium">mL/dia</p>
            </div>
          </div>

          {/* Nota explicativa */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-amber-50 dark:bg-[#1A2420]",
            "border border-amber-200 dark:border-amber-800/30"
          )}>
            <p className="text-xs text-amber-800 dark:text-amber-400">
              <strong>Regra 4-2-1:</strong> Primeiros 10kg: 4 mL/kg/h | 10-20kg: +2 mL/kg/h | &gt;20kg: +1 mL/kg/h
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
    <div className="space-y-4">
      {/* Header com input de peso - mesmo padrao do PediCalc */}
      <div className={cn(
        "p-4 rounded-xl",
        // Light: verde escuro elegante (igual PediCalc)
        "bg-[#006837]",
        // Dark: fundo escuro com borda verde suave (igual PediCalc)
        "dark:bg-[#1A2E24] dark:border dark:border-[#2ECC71]/40"
      )}>
        <p className="text-white dark:text-[#2ECC71] text-sm font-medium mb-2 text-center">
          Peso do Paciente (kg)
        </p>
        <input
          type="number"
          value={peso || ''}
          onChange={(e) => onPesoChange(parseFloat(e.target.value) || 0)}
          placeholder="70"
          className={cn(
            "w-full text-center text-3xl font-bold py-3 rounded-lg",
            // Light: fundo semi-transparente branco
            "bg-white/20 text-white placeholder-white/60",
            "focus:outline-none focus:ring-2 focus:ring-white/50",
            // Dark: fundo escuro com texto verde (igual PediCalc)
            "dark:bg-[#0D1F17] dark:text-[#2ECC71] dark:placeholder-[#2ECC71]/50",
            "dark:focus:ring-[#2ECC71]/50"
          )}
          min="30"
          max="200"
          step="1"
        />
        <p className="text-white/80 dark:text-[#9CA3AF] text-xs mt-2 text-center">
          {result ? 'Selecione o reversor abaixo' : 'Digite o peso para calcular'}
        </p>
      </div>

      {/* Dropdown de Reversor */}
      <div className={cn(
        "p-4 rounded-xl",
        "bg-card border border-[#A5D6A7] dark:border-[#2A3F36]"
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
            "bg-card border-2 border-[#006837] dark:border-[#2ECC71]"
          )}>
            {/* Dose calculada em destaque */}
            <div className="text-center mb-4">
              <p className="text-xs text-muted-foreground mb-1">Dose Calculada</p>
              <p className="text-3xl font-bold text-[#006837] dark:text-[#2ECC71]">
                {details['Dose calculada'] || '-'}
              </p>
            </div>

            {/* Detalhes */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-[#E8F5E9] dark:bg-[#1A2420]"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Dose Padrao</p>
                <p className="text-sm font-semibold text-foreground">
                  {details['Dose padrao'] || '-'}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-[#E8F5E9] dark:bg-[#1A2420]"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Intervalo</p>
                <p className="text-sm font-semibold text-foreground">
                  {details['Intervalo'] || '-'}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-[#E8F5E9] dark:bg-[#1A2420]"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Dose Maxima</p>
                <p className="text-sm font-semibold text-foreground">
                  {details['Dose maxima'] || '-'}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg text-center",
                "bg-amber-50 dark:bg-[#1A2420]",
                "border border-amber-200 dark:border-amber-800/30"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Observacao</p>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
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
                  ? "bg-[#E8F5E9] border-[#004225] dark:bg-[#1A3D2E] dark:border-[#2ECC71]"
                  : "bg-card border-[#E5E7EB] dark:border-[#2A3F36] hover:border-[#A5D6A7]"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-[#004225] dark:text-[#2ECC71]" : "text-foreground"
                )}
              >
                {option.label}
              </span>
              {isSelected && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#004225] dark:bg-[#2ECC71] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white dark:text-[#0D1F17]" />
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

function CalculatorPage({ calculator, onBack }) {
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

  const handleReset = () => {
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
    <div className="p-4 lg:p-6 space-y-6 min-h-screen bg-[#F0FFF4] dark:bg-[#111916] overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-[#243530]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{calculator.title}</h1>
          <p className="text-sm text-muted-foreground">{calculator.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Limpar
        </Button>
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
      {selectInputs.length > 0 && !['viaAerea', 'reversores'].includes(calculator.customRender) && (
        <div
          className={cn(
            "p-4 rounded-xl overflow-visible",
            "bg-card border border-[#A5D6A7] dark:border-[#2A3F36]"
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
       !['pedicalc', 'adultcalc', 'viaAerea', 'pedDesfib', 'broselow', 'hollidaySegar', 'acls', 'reversores'].includes(calculator.customRender) && (
        <div
          className={cn(
            "p-4 rounded-xl",
            "bg-card border border-[#A5D6A7] dark:border-[#2A3F36]"
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
        <div className="p-4 bg-accent/30 dark:bg-[#1A2420] rounded-xl overflow-hidden w-full max-w-full">
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

      {/* Footer note */}
      <div
        className={cn(
          "p-4 rounded-xl",
          "bg-[#E8F5E9] dark:bg-[#1A2420]",
          "border border-[#A5D6A7] dark:border-[#2A3F36]"
        )}
      >
        <p className="text-xs text-muted-foreground">
          <strong>Nota:</strong> Esta calculadora e uma ferramenta de apoio e nao
          substitui o julgamento clinico. Sempre avalie o paciente individualmente.
        </p>
      </div>
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
        "bg-white dark:bg-[#1A2420]",
        "border border-[#E0E0E0] dark:border-[#2A3F36]",
        // Hover state sutil
        "hover:bg-[#F5F5F5] dark:hover:bg-[#243530]",
        "hover:border-[#006837] dark:hover:border-[#2ECC71]",
        // Focus state para acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-[#006837]/50 dark:focus:ring-[#2ECC71]/50",
        // Transição suave
        "transition-all duration-200",
        // Sombra quando aberto
        isOpen && "shadow-md border-[#006837] dark:border-[#2ECC71]"
      )}
    >
      {/* Ícone da seção - tamanho fixo */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-11 h-11 rounded-xl flex-shrink-0",
          "bg-[#E8F5E9] dark:bg-[#243530]",
          isOpen && "bg-[#006837] dark:bg-[#2ECC71]"
        )}
      >
        <IconComponent
          className={cn(
            "w-5 h-5 transition-colors duration-200",
            isOpen
              ? "text-white dark:text-[#0D1F17]"
              : "text-[#006837] dark:text-[#2ECC71]"
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
          "bg-[#E8F5E9] dark:bg-[#243530]",
          "text-[#006837] dark:text-[#2ECC71]"
        )}
      >
        {count}
      </span>

      {/* Ícone chevron - no final (padrão F de leitura) */}
      <ChevronDown
        className={cn(
          "w-5 h-5 flex-shrink-0",
          "text-[#757575] dark:text-[#9E9E9E]",
          "transition-transform duration-300 ease-out",
          isOpen && "rotate-180 text-[#006837] dark:text-[#2ECC71]"
        )}
      />
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT - LAYOUT POR SECOES (SEM TABS)
// =============================================================================

export function CalculatorShowcase() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCalc, setSelectedCalc] = useState(null);
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
    const favoriteCalcs = favorites
      .map(id => allCalculators.find(c => c.id === id))
      .filter(Boolean);

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

  // Total calculators count (exclude favorites section to avoid double-counting)
  const totalCount = useMemo(() => {
    return filteredSections
      .filter(s => s.id !== 'favoritas')
      .reduce((sum, section) => sum + section.calculators.length, 0);
  }, [filteredSections]);

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
    <div className="space-y-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center",
            "w-12 h-12 rounded-xl",
            "bg-[#E8F5E9] dark:bg-[#243530]"
          )}
        >
          <Calculator className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calculadoras</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} calculadoras {searchTerm && 'encontradas'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        placeholder="Buscar calculadora..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onSubmit={() => { document.activeElement?.blur(); }}
        className="mb-0"
      />

      {/* Coming Soon Toast */}
      {showComingSoon && (
        <div
          className={cn(
            "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
            "px-4 py-3 rounded-xl shadow-lg",
            "bg-[#004225] dark:bg-[#2ECC71] text-white dark:text-[#0D1F17]",
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
        <div className="space-y-3">
          {filteredSections.map((section) => {
            const isOpen = openSections[section.id] || searchTerm.length > 0;
            return (
              <section key={section.id}>
                <SectionHeader
                  icon={section.icon}
                  title={section.title}
                  count={section.calculators.length}
                  isOpen={isOpen}
                  onToggle={() => toggleSection(section.id)}
                />
                {isOpen && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {section.calculators.map((calc) => {
                      const IconComponent = SECTION_ICONS[calc.icon] || Calculator;
                      const isComingSoon = calc.status === 'coming_soon';
                      return (
                        <WidgetCard
                          key={calc.id}
                          icon={<IconComponent className="w-5 h-5" />}
                          title={calc.title}
                          subtitle={calc.subtitle}
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
          "bg-[#E8F5E9] dark:bg-[#1A2420]",
          "border border-[#A5D6A7] dark:border-[#2A3F36]"
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
