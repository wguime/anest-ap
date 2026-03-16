// ==================== DADOS DOS INDICADORES ANUAIS 2025 ====================
// Fonte: Indicadores - Resultado Geral atualizado.pdf
// Valores mensais de Janeiro a Dezembro de 2025

// Ano de referência dos dados
export const DATA_YEAR = 2025;

// Labels dos meses
export const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Mapeamento de IDs para ícones Lucide
export const ICON_MAP = {
  consulta_pre_anestesica: 'CalendarCheck',
  dor_intraop_alta: 'HeartPulse',
  jejum_abreviado: 'Clock',
  pcr_inducao_alta: 'AlertCircle',
  mudanca_tecnica: 'ArrowLeftRight',
  uti_sem_planejamento: 'Building2',
  controle_glicemico: 'TrendingUp',
  saidas_sem_evento: 'CheckCircle',
  mortalidade_48h_30d: 'Skull',
  estrat_risco_asa: 'ClipboardCheck',
  via_aerea_dificil_nao_ident: 'Wind',
  nvpo: 'Frown',
  intoxicacao_locais: 'Syringe',
  atb_timing: 'Timer',
  atb_droga_correta: 'Pill',
  atb_repique: 'RotateCcw',
  profilaxia_antimicrobiana: 'Pill',
  prev_cefaleia_ppd: 'Brain',
  hipotermia_intraop: 'Thermometer',
  adesao_protocolos_seguranca: 'Shield',
  adesao_protocolos_clinicos: 'ClipboardList',
  burnout_profissional: 'HeartOff',
  satisfacao_equipe: 'SmilePlus',
  horas_treinamento: 'GraduationCap',
  turnover_equipe: 'UserMinus',
};

// Mapeamento de IDs para cores de destaque
export const COLOR_MAP = {
  consulta_pre_anestesica: 'green',
  dor_intraop_alta: 'red',
  jejum_abreviado: 'orange',
  pcr_inducao_alta: 'red',
  mudanca_tecnica: 'blue',
  uti_sem_planejamento: 'purple',
  controle_glicemico: 'cyan',
  saidas_sem_evento: 'green',
  mortalidade_48h_30d: 'red',
  estrat_risco_asa: 'green',
  via_aerea_dificil_nao_ident: 'orange',
  nvpo: 'orange',
  intoxicacao_locais: 'green',
  atb_timing: 'blue',
  atb_droga_correta: 'green',
  atb_repique: 'green',
  profilaxia_antimicrobiana: 'green',
  prev_cefaleia_ppd: 'purple',
  hipotermia_intraop: 'cyan',
  adesao_protocolos_seguranca: 'green',
  adesao_protocolos_clinicos: 'blue',
  burnout_profissional: 'red',
  satisfacao_equipe: 'green',
  horas_treinamento: 'blue',
  turnover_equipe: 'orange',
};

export const DIMENSAO_CONFIG = {
  seguranca: { label: 'Segurança do Paciente', color: '#DC2626' },
  efetividade: { label: 'Efetividade Clínica', color: '#3B82F6' },
  eficiencia: { label: 'Eficiência Operacional', color: '#059669' },
  atencao_centrada: { label: 'Atenção Centrada no Paciente', color: '#8B5CF6' },
  vida_profissional: { label: 'Vida Profissional', color: '#F59E0B' },
}

// Array de indicadores anuais (21 indicadores)
export const indicadores2025 = [
  {
    id: "consulta_pre_anestesica",
    titulo: "Procedimentos eletivos com consulta pré-anestésica",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [80, 79, 76, 85, 86, 96, 95, 98, 97, null, null, null],
  },
  {
    id: "dor_intraop_alta",
    titulo: "Dor aguda intraoperatória até alta anestésica",
    metaLabel: "<= 10%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [5, 4, 4, 3, 6, 3, 4, 3, 4, null, null, null],
  },
  {
    id: "jejum_abreviado",
    titulo: "Abreviação do jejum prolongado",
    metaLabel: ">= 60%",
    unidade: "%",
    dimensao: 'atencao_centrada',
    meses: [32, 35, 32, 41, 38, 40, 40, 43, 42, null, null, null],
  },
  {
    id: "pcr_inducao_alta",
    titulo: "Parada cardiorrespiratória (indução-alta)",
    metaLabel: "Meta zero",
    unidade: "",
    dimensao: 'seguranca',
    tolerancia: 0.001,
    meses: [0, 0, 0, 0, 0, 0, 0, 0.001, 0.001, null, null, null],
  },
  {
    id: "mudanca_tecnica",
    titulo: "Mudança de técnica anestésica",
    metaLabel: "< 5%",
    unidade: "%",
    dimensao: 'seguranca',
    meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null],
  },
  {
    id: "uti_sem_planejamento",
    titulo: "Encaminhado a UTI sem planejamento",
    metaLabel: "<= 0.3%",
    unidade: "%",
    dimensao: 'eficiencia',
    meses: [0.1, 0.0, 0.1, 0.1, 0.2, 0.1, 0.2, 0.1, 0.1, null, null, null],
  },
  {
    id: "controle_glicemico",
    titulo: "Efetividade do controle glicêmico",
    metaLabel: ">= 90%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [74, 76, 78, 72, 80, 77, 91.0, 84, 82, null, null, null],
  },
  {
    id: "saidas_sem_evento",
    titulo: "Saídas sem eventos do ato anestésico",
    metaLabel: "> 90%",
    unidade: "%",
    dimensao: 'seguranca',
    meses: [86, 86, 87, 89, 84, 88, 88, 88, 90, null, null, null],
  },
  {
    id: "mortalidade_48h_30d",
    titulo: "Mortalidade associada (48h / 30d)",
    metaLabel: "Meta zero",
    unidade: "%",
    dimensao: 'seguranca',
    tolerancia: 0.001,
    meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null],
  },
  {
    id: "estrat_risco_asa",
    titulo: "Estratificação de risco anestésico (ASA)",
    metaLabel: ">= 98%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [100, 100, 100, 100, 100, 100, 100, 100, 100, null, null, null],
  },
  {
    id: "via_aerea_dificil_nao_ident",
    titulo: "VAD não identificada (intraop.)",
    metaLabel: "<= 2%",
    unidade: "%",
    dimensao: 'seguranca',
    tolerancia: 0.02,
    meses: [0, 0, 0, 0, 0.2, 0.0, 0, 0.6, 0.6, null, null, null],
  },
  {
    id: "nvpo",
    titulo: "Náusea e vômito (NVPO) até alta",
    metaLabel: "<= 20%",
    unidade: "%",
    dimensao: 'atencao_centrada',
    meses: [5, 6, 6, 5, 6, 5, 6, 5, 4, null, null, null],
  },
  {
    id: "intoxicacao_locais",
    titulo: "Efetividade - manejo de intoxicação por AL",
    metaLabel: ">= 90%",
    unidade: "%",
    dimensao: 'seguranca',
    tolerancia: 0.005,
    meses: [100, 100, 100, 100, 100, 100, 100, 100, 100, null, null, null],
  },
  {
    id: "atb_timing",
    titulo: "Antibioticoprofilaxia até 60min antes da incisão",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [99, 99, 98, 91, 87, 85, 94, 96, 97, null, null, null],
  },
  {
    id: "atb_droga_correta",
    titulo: "Antibioticoprofilaxia - droga correta",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [99, 100, 96, 89, 100, 100, 100, 100, 99, null, null, null],
  },
  {
    id: "atb_repique",
    titulo: "Antibioticoprofilaxia - repique",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [100, 100, 100, 100, 100, 100, 100, 100, 100, null, null, null],
  },
  {
    id: "profilaxia_antimicrobiana",
    titulo: "Conformidade da profilaxia antimicrobiana",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [99, 100, 98, 93, 96, 95, 98, 99, 99, null, null, null],
  },
  {
    id: "prev_cefaleia_ppd",
    titulo: "Efetividade - prevenção de cefaleia PPD",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'atencao_centrada',
    meses: [100, 100, 100, 100, 99, 100, 97, 99, 100, null, null, null],
  },
  {
    id: "hipotermia_intraop",
    titulo: "Hipotermia não intencional (intraop.)",
    metaLabel: "<= 5%",
    unidade: "%",
    dimensao: 'seguranca',
    meses: [0.4, 0.5, 0.2, 0.2, 0.2, 0.3, 0.2, 0.3, 0.5, null, null, null],
  },
  {
    id: "adesao_protocolos_seguranca",
    titulo: "Adesão aos protocolos de segurança",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'seguranca',
    meses: [91, 91, 93, 91, 92, 91, 94, 94, 94, null, null, null],
  },
  {
    id: "adesao_protocolos_clinicos",
    titulo: "Adesão aos protocolos clínico-assistenciais",
    metaLabel: ">= 95%",
    unidade: "%",
    dimensao: 'efetividade',
    meses: [83, 84, 82, 85, 81, 82, 84, 84, 84, null, null, null],
  },
  // Vida Profissional (Qmentum ROP Area 4)
  {
    id: "burnout_profissional",
    titulo: "Índice de burnout profissional",
    metaLabel: "<= 15%",
    unidade: "%",
    dimensao: 'vida_profissional',
    meses: [22, 20, 19, 18, 17, 16, 15, 14, 14, null, null, null],
  },
  {
    id: "satisfacao_equipe",
    titulo: "Satisfação da equipe de anestesiologia",
    metaLabel: ">= 80%",
    unidade: "%",
    dimensao: 'vida_profissional',
    meses: [72, 74, 75, 76, 78, 79, 80, 81, 82, null, null, null],
  },
  {
    id: "horas_treinamento",
    titulo: "Horas de treinamento por profissional/mês",
    metaLabel: ">= 8h",
    unidade: "h",
    dimensao: 'vida_profissional',
    meses: [4, 5, 6, 6, 7, 7, 8, 8, 9, null, null, null],
  },
  {
    id: "turnover_equipe",
    titulo: "Taxa de rotatividade da equipe",
    metaLabel: "<= 10%",
    unidade: "%",
    dimensao: 'vida_profissional',
    meses: [12, 11, 10, 9, 8, 8, 7, 7, 6, null, null, null],
  },
];

// ============================================================================
// FUNCOES AUXILIARES
// ============================================================================

/**
 * Interpreta a label de meta (ex: ">= 95%", "<= 10%", "Meta zero")
 * @param {string} metaLabel - Label da meta
 * @returns {{ op: string, target: number, raw: string }}
 */
export function parseMeta(metaLabel) {
  const raw = metaLabel.trim().toLowerCase();

  // Meta zero
  if (raw.includes("meta zero")) {
    const num = raw.match(/([0-9]+([.,][0-9]+)?)/g);
    if (num) {
      const n = Number(num[0].replace(",", "."));
      return { op: "<=", target: n, raw: metaLabel, direction: 'lower' };
    }
    return { op: "zero", target: 0, raw: metaLabel, direction: 'lower' };
  }

  // Razao (ex.: <= 1/10.000)
  if (raw.includes("/")) {
    const ratio = raw.match(/([0-9]+)\s*\/\s*([0-9.]+)/);
    if (ratio) {
      const num = Number(ratio[1]);
      const den = Number(ratio[2].replace(".", ""));
      const pct = (num / den) * 100;
      return { op: "ratioMax", target: pct, raw: metaLabel, direction: 'lower' };
    }
  }

  // Operadores comuns com numero
  const m = raw.match(/(>=|<=|>|<|=)\s*([0-9]+([.,][0-9]+)?)/);
  if (m) {
    const opMap = { ">=": ">=", "<=": "<=", "<": "<", ">": ">", "=": "==" };
    const op = opMap[m[1]] || ">=";
    const n = Number(m[2].replace(",", "."));
    const direction = (op === '<=' || op === '<') ? 'lower' : 'higher';
    return { op, target: n, raw: metaLabel, direction };
  }

  // Percentual simples sem operador (assume >=)
  const pctOnly = raw.match(/^([0-9]+([.,][0-9]+)?)\s*%?\s*$/);
  if (pctOnly) {
    const n = Number(pctOnly[1].replace(",", "."));
    return { op: ">=", target: n, raw: metaLabel, direction: 'higher' };
  }

  // Fallback
  return { op: "==", target: NaN, raw: metaLabel, direction: 'higher' };
}

/**
 * Avalia status de conformidade
 * @param {number} valorSet - Valor atual
 * @param {{ op: string, target: number }} metaParsed - Meta parseada
 * @param {string} unidade - Unidade de medida
 * @returns {{ label: string, variant: string }}
 */
export function evaluateStatus(valorSet, metaParsed, unidade, tolerancia) {
  const v = valorSet;
  const near = tolerancia != null ? tolerancia : 0.10; // tolerancia per-indicator ou 10% default

  const pass = () => ({ label: "Conforme", variant: "success" });
  const warn = () => ({ label: "Parcial", variant: "warning" });
  const fail = () => ({ label: "Não conforme", variant: "destructive" });

  if (metaParsed.op === "zero") {
    if (v === 0) return pass();
    if (v > 0 && v <= 0.0001) return warn();
    return fail();
  }

  if (metaParsed.op === "ratioMax") {
    if (v <= metaParsed.target) return pass();
    if (v <= metaParsed.target * (1 + near)) return warn();
    return fail();
  }

  if (isNaN(metaParsed.target)) {
    return { label: "Info", variant: "secondary" };
  }

  // Operadores numericos (>= ou >)
  if (metaParsed.op === ">=" || metaParsed.op === ">") {
    const thresh = metaParsed.op === ">" ? metaParsed.target + Number.EPSILON : metaParsed.target;
    if (v >= thresh) return pass();
    if (v >= thresh * (1 - near)) return warn();
    return fail();
  }

  // Operadores numericos (<= ou <)
  if (metaParsed.op === "<=" || metaParsed.op === "<") {
    const thresh = metaParsed.op === "<" ? metaParsed.target - Number.EPSILON : metaParsed.target;
    if (v <= thresh) return pass();
    if (v <= thresh * (1 + near)) return warn();
    return fail();
  }

  if (metaParsed.op === "==") {
    if (v === metaParsed.target) return pass();
    if (Math.abs(v - metaParsed.target) / (metaParsed.target || 1) <= near) return warn();
    return fail();
  }

  return { label: "Info", variant: "secondary" };
}

/**
 * Calcula porcentagem para barra de progresso
 * @param {number} valorSet - Valor atual
 * @param {{ op: string, target: number }} metaParsed - Meta parseada
 * @param {string} unidade - Unidade de medida
 * @returns {number} - Porcentagem (0-100)
 */
export function calcularProgressoBarra(valorSet, metaParsed, unidade) {
  if (unidade === "%" && metaParsed.op && !isNaN(metaParsed.target)) {
    if (metaParsed.op === ">=" || metaParsed.op === ">") {
      // Para metas >=, mostrar progresso ate 100% baseado na meta
      const progresso = Math.min(100, (valorSet / metaParsed.target) * 100);
      return progresso;
    } else if (metaParsed.op === "<=" || metaParsed.op === "<") {
      // Para metas <=, inverter: quanto menor, melhor
      if (valorSet <= metaParsed.target) return 100;
      const excesso = ((valorSet - metaParsed.target) / metaParsed.target) * 100;
      return Math.max(0, 100 - excesso);
    }
  }

  // Para valores nao porcentuais
  if (valorSet <= 100) {
    return Math.min(100, Math.max(0, valorSet));
  }

  return Math.min(100, (valorSet / 100) * 100);
}

/**
 * Calcula media anual dos valores mensais
 * @param {number[]} meses - Array de valores mensais
 * @returns {number} - Media
 */
export function calcularMedia(meses) {
  if (!meses || meses.length === 0) return 0;
  const sum = meses.reduce((a, b) => a + b, 0);
  return sum / meses.length;
}

/**
 * Formata valor com unidade
 * @param {number} valor - Valor a formatar
 * @param {string} unidade - Unidade de medida
 * @returns {string} - Valor formatado
 */
export function formatValor(valor, unidade) {
  if (typeof valor !== 'number') return String(valor);
  const formatted = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return unidade ? `${formatted}${unidade}` : formatted;
}
