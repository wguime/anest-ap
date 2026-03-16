/**
 * Configuração de Análise de Causa Raiz (RCA) — Sistema ANEST
 *
 * Categorias Ishikawa adaptadas para saúde, escala de risco,
 * status e template de dados.
 */

// ============================================
// FATORES CONTRIBUINTES — Diagrama Ishikawa
// ============================================

export const FATORES_CONTRIBUINTES_CATEGORIAS = [
  {
    value: 'fatores_humanos',
    label: 'Fatores Humanos',
    icon: 'User',
    color: '#EF4444',
    exemplos: [
      'Fadiga ou sobrecarga',
      'Falta de treinamento',
      'Distração ou desatenção',
      'Experiência insuficiente',
      'Estresse ou pressão',
    ],
  },
  {
    value: 'processo_procedimento',
    label: 'Processo / Procedimento',
    icon: 'ClipboardList',
    color: '#3B82F6',
    exemplos: [
      'Protocolo inexistente',
      'Protocolo desatualizado',
      'Protocolo não seguido',
      'Fluxo inadequado',
      'Ausência de dupla checagem',
    ],
  },
  {
    value: 'equipamento_tecnologia',
    label: 'Equipamento / Tecnologia',
    icon: 'Wrench',
    color: '#8B5CF6',
    exemplos: [
      'Falha de equipamento',
      'Software com defeito',
      'Manutenção inadequada',
      'Equipamento indisponível',
      'Interface confusa',
    ],
  },
  {
    value: 'ambiente',
    label: 'Ambiente',
    icon: 'Building2',
    color: '#F59E0B',
    exemplos: [
      'Iluminação inadequada',
      'Ruído excessivo',
      'Espaço insuficiente',
      'Temperatura inadequada',
      'Layout desfavorável',
    ],
  },
  {
    value: 'comunicacao',
    label: 'Comunicação',
    icon: 'MessageCircle',
    color: '#10B981',
    exemplos: [
      'Falha na passagem de plantão',
      'Informação não registrada',
      'Comunicação verbal ambígua',
      'Documentação incompleta',
      'Barreira de linguagem',
    ],
  },
  {
    value: 'organizacional',
    label: 'Organizacional',
    icon: 'Landmark',
    color: '#EC4899',
    exemplos: [
      'Falta de recursos',
      'Cultura punitiva',
      'Políticas inadequadas',
      'Supervisão insuficiente',
      'Sobrecarga de trabalho no setor',
    ],
  },
];

// ============================================
// ESCALA DE PROBABILIDADE (1-5)
// ============================================

export const PROBABILIDADE_OPTIONS = [
  { value: 'rara', label: 'Rara', score: 1, description: 'Pode ocorrer em circunstâncias excepcionais' },
  { value: 'improvavel', label: 'Improvável', score: 2, description: 'Pode ocorrer alguma vez' },
  { value: 'possivel', label: 'Possível', score: 3, description: 'Pode ocorrer em algum momento' },
  { value: 'provavel', label: 'Provável', score: 4, description: 'Provavelmente vai ocorrer' },
  { value: 'quase_certa', label: 'Quase Certa', score: 5, description: 'Espera-se que ocorra frequentemente' },
];

// ============================================
// ESCALA DE GRAVIDADE (1-5)
// ============================================

export const GRAVIDADE_OPTIONS = [
  { value: 'insignificante', label: 'Insignificante', score: 1, description: 'Sem dano ou dano mínimo' },
  { value: 'menor', label: 'Menor', score: 2, description: 'Dano leve, sem prolongamento de internação' },
  { value: 'moderada', label: 'Moderada', score: 3, description: 'Necessitou intervenção, prolongamento leve' },
  { value: 'maior', label: 'Maior', score: 4, description: 'Dano significativo ou perda de função' },
  { value: 'catastrofica', label: 'Catastrófica', score: 5, description: 'Óbito ou dano permanente grave' },
];

// ============================================
// CÁLCULO DO NÍVEL DE RISCO
// ============================================

export function getRiskLevel(probScore, gravScore) {
  const score = probScore * gravScore;

  if (score >= 15) return { level: 'extremo', label: 'Extremo', color: '#7F1D1D', bgColor: '#FEE2E2', score };
  if (score >= 10) return { level: 'alto', label: 'Alto', color: '#DC2626', bgColor: '#FEE2E2', score };
  if (score >= 5) return { level: 'moderado', label: 'Moderado', color: '#F59E0B', bgColor: '#FEF3C7', score };
  return { level: 'baixo', label: 'Baixo', color: '#22C55E', bgColor: '#DCFCE7', score };
}

// ============================================
// STATUS DO RCA
// ============================================

export const RCA_STATUS = {
  nao_iniciada: { value: 'nao_iniciada', label: 'Não Iniciada', color: '#6B7280' },
  em_andamento: { value: 'em_andamento', label: 'Em Andamento', color: '#3B82F6' },
  concluida: { value: 'concluida', label: 'Concluída', color: '#22C55E' },
};

// ============================================
// TEMPLATE DE DADOS RCA
// ============================================

// ============================================
// PRAZOS POR NÍVEL DE RISCO (em dias)
// Baseados em referências: ANVISA RDC 36/2013, Joint Commission, práticas de gestão de risco hospitalar
// ============================================

export const RISK_DEADLINES = { extremo: 3, alto: 15, moderado: 45, baixo: 90 };

export const RISK_DEADLINES_LEGEND = [
  { level: 'extremo', label: 'Extremo / Sentinela', range: '24–72h', days: 3, color: '#7F1D1D', bgColor: '#FEE2E2', ref: 'ANVISA RDC 36/2013, Joint Commission' },
  { level: 'alto', label: 'Alto', range: '7–15 dias', days: 15, color: '#DC2626', bgColor: '#FEE2E2', ref: 'Gestao de risco hospitalar' },
  { level: 'moderado', label: 'Moderado', range: '30–45 dias', days: 45, color: '#F59E0B', bgColor: '#FEF3C7', ref: 'Pratica institucional' },
  { level: 'baixo', label: 'Baixo', range: '60–90 dias', days: 90, color: '#22C55E', bgColor: '#DCFCE7', ref: 'Pratica institucional' },
];

const STATUS_FLOW = ['pending', 'in_review', 'investigating', 'action_required', 'resolved', 'closed'];

const GRAV_SCORE_MAP = { insignificante: 1, menor: 2, moderada: 3, maior: 4, catastrofica: 5 };

/**
 * Calcula a próxima deadline e deadline final a partir da RCA e histórico de status.
 *
 * @param {object} rca - Dados da RCA (contém classificacaoRisco)
 * @param {Array}  historicoStatus - Array de status ordenado (mais recente primeiro)
 * @param {string} currentStatus - Status atual do incidente/denúncia
 * @param {string} createdAt - Data de criação (ISO string)
 * @returns {object|null} { nextDeadline, nextStatus, finalDeadline, riskLevel, deadlineDays } ou null
 */
export function getNextDeadline(rca, historicoStatus, currentStatus, createdAt) {
  if (!rca?.classificacaoRisco?.score) return null;

  const gravScore = rca.classificacaoRisco.gravidade
    ? (GRAV_SCORE_MAP[rca.classificacaoRisco.gravidade] || 1)
    : 1;
  const probScore = Math.ceil(rca.classificacaoRisco.score / gravScore);
  const riskLevel = getRiskLevel(probScore, gravScore);
  const deadlineDays = RISK_DEADLINES[riskLevel.level];

  const lastDate = historicoStatus?.[0]?.data
    ? new Date(historicoStatus[0].data)
    : historicoStatus?.[0]?.date
      ? new Date(historicoStatus[0].date)
      : new Date(createdAt);

  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 1) return null;

  const remaining = STATUS_FLOW.slice(currentIdx + 1);
  const stepInterval = Math.max(1, Math.round(deadlineDays / remaining.length));

  const nextDeadline = new Date(lastDate);
  nextDeadline.setDate(nextDeadline.getDate() + stepInterval);
  const nextStatus = STATUS_FLOW[currentIdx + 1];

  const finalDeadline = new Date(lastDate);
  finalDeadline.setDate(finalDeadline.getDate() + deadlineDays);

  return { nextDeadline, nextStatus, finalDeadline, riskLevel, deadlineDays, stepInterval };
}

// ============================================
// TEMPLATE DE DADOS RCA
// ============================================

export function createRcaTemplate() {
  return {
    causaImediata: '',
    cincosPorques: [
      { nivel: 1, pergunta: 'Por que o incidente ocorreu?', resposta: '' },
      { nivel: 2, pergunta: 'Por que? (nível 2)', resposta: '' },
      { nivel: 3, pergunta: 'Por que? (nível 3)', resposta: '' },
      { nivel: 4, pergunta: 'Por que? (nível 4)', resposta: '' },
      { nivel: 5, pergunta: 'Por que? (nível 5)', resposta: '' },
    ],
    fatoresContribuintes: [],
    causaRaiz: '',
    classificacaoRisco: {
      probabilidade: '',
      gravidade: '',
      score: null,
      nivel: null,
    },
    observacoes: '',
    status: 'em_andamento',
    iniciadoEm: new Date().toISOString(),
    concluidoEm: null,
  };
}
