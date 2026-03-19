/**
 * Configurações do Sistema de Gestão de Incidentes ANEST
 *
 * Define tipos de incidentes, severidades, categorias de denúncia,
 * status e funções auxiliares.
 */

// ============================================
// TIPOS DE INCIDENTES
// ============================================

export const INCIDENT_TYPES = {
  medicacao: {
    value: 'medicacao',
    label: 'Medicação',
    icon: 'Pill',
    color: '#DC2626',
    subtipos: [
      { value: 'erro_dose', label: 'Erro de Dose' },
      { value: 'erro_via', label: 'Via de Administração Errada' },
      { value: 'omissao', label: 'Omissão de Dose' },
      { value: 'medicamento_errado', label: 'Medicamento Errado' },
      { value: 'paciente_errado_med', label: 'Paciente Errado' },
      { value: 'reacao_adversa', label: 'Reação Adversa' },
      { value: 'alergia_nao_verificada', label: 'Alergia Não Verificada' },
      { value: 'interacao_medicamentosa', label: 'Interação Medicamentosa' },
    ],
  },
  cirurgia: {
    value: 'cirurgia',
    label: 'Cirurgia',
    icon: 'Scissors',
    color: '#7C3AED',
    subtipos: [
      { value: 'local_errado', label: 'Local Errado' },
      { value: 'procedimento_errado', label: 'Procedimento Errado' },
      { value: 'paciente_errado_cir', label: 'Paciente Errado' },
      { value: 'corpo_estranho', label: 'Corpo Estranho Retido' },
      { value: 'lateralidade', label: 'Erro de Lateralidade' },
    ],
  },
  identificacao: {
    value: 'identificacao',
    label: 'Identificação',
    icon: 'IdCard',
    color: '#F59E0B',
    subtipos: [
      { value: 'pulseira_incorreta', label: 'Pulseira Incorreta' },
      { value: 'pulseira_ausente', label: 'Pulseira Ausente' },
      { value: 'paciente_trocado', label: 'Paciente Trocado' },
      { value: 'prontuario_errado', label: 'Prontuário Errado' },
    ],
  },
  via_aerea: {
    value: 'via_aerea',
    label: 'Via Aérea',
    icon: 'Wind',
    color: '#0EA5E9',
    subtipos: [
      { value: 'intubacao_dificil', label: 'Intubação Difícil Não Prevista' },
      { value: 'extubacao_acidental', label: 'Extubação Acidental' },
      { value: 'aspiracao', label: 'Broncoaspiração' },
      { value: 'obstrucao', label: 'Obstrução de Via Aérea' },
      { value: 'laringoespasmo', label: 'Laringoespasmo' },
      { value: 'broncoespasmo', label: 'Broncoespasmo Severo' },
    ],
  },
  cardiovascular: {
    value: 'cardiovascular',
    label: 'Cardiovascular',
    icon: 'Heart',
    color: '#EF4444',
    subtipos: [
      { value: 'parada_cardiaca', label: 'Parada Cardíaca' },
      { value: 'hipotensao_grave', label: 'Hipotensão Grave' },
      { value: 'hipertensao_grave', label: 'Hipertensão Grave' },
      { value: 'arritmia', label: 'Arritmia Grave' },
      { value: 'isquemia', label: 'Isquemia Miocárdica' },
      { value: 'choque', label: 'Choque' },
    ],
  },
  equipamento: {
    value: 'equipamento',
    label: 'Equipamento',
    icon: 'Wrench',
    color: '#6B7280',
    subtipos: [
      { value: 'falha_monitor', label: 'Falha de Monitor' },
      { value: 'falha_ventilador', label: 'Falha de Ventilador' },
      { value: 'falha_bomba_infusao', label: 'Falha de Bomba de Infusão' },
      { value: 'falha_desfibrilador', label: 'Falha de Desfibrilador' },
      { value: 'indisponibilidade', label: 'Equipamento Indisponível' },
      { value: 'calibracao', label: 'Calibração Incorreta' },
    ],
  },
  queda: {
    value: 'queda',
    label: 'Queda',
    icon: 'PersonStanding',
    color: '#F97316',
    subtipos: [
      { value: 'queda_leito', label: 'Queda do Leito' },
      { value: 'queda_maca', label: 'Queda da Maca' },
      { value: 'queda_deambulacao', label: 'Queda Durante Deambulação' },
      { value: 'queda_banheiro', label: 'Queda no Banheiro' },
    ],
  },
  outros: {
    value: 'outros',
    label: 'Outros',
    icon: 'AlertCircle',
    color: '#64748B',
    subtipos: [
      { value: 'lesao_pele', label: 'Lesão de Pele/Pressão' },
      { value: 'infeccao', label: 'Infecção Relacionada à Assistência' },
      { value: 'comunicacao', label: 'Falha de Comunicação' },
      { value: 'documentacao', label: 'Erro de Documentação' },
      { value: 'transferencia', label: 'Erro na Transferência de Cuidado' },
      { value: 'atraso', label: 'Atraso no Atendimento' },
      { value: 'outro', label: 'Outro' },
    ],
  },
};

// ============================================
// SEVERIDADES
// ============================================

export const SEVERITY_LEVELS = [
  {
    value: 'near_miss',
    label: 'Near Miss',
    description: 'Quase erro - interceptado antes de atingir o paciente',
    color: '#22C55E',
    bgColor: '#DCFCE7',
    darkBgColor: '#166534',
    icon: 'CircleDot',
  },
  {
    value: 'leve',
    label: 'Leve',
    description: 'Sem necessidade de intervenção adicional',
    color: '#EAB308',
    bgColor: '#FEF9C3',
    darkBgColor: '#854D0E',
    icon: 'AlertTriangle',
  },
  {
    value: 'moderado',
    label: 'Moderado',
    description: 'Necessitou intervenção adicional',
    color: '#F97316',
    bgColor: '#FFEDD5',
    darkBgColor: '#9A3412',
    icon: 'AlertTriangle',
  },
  {
    value: 'grave',
    label: 'Grave',
    description: 'Prolongou internação ou causou dano permanente leve',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    darkBgColor: '#991B1B',
    icon: 'AlertOctagon',
  },
  {
    value: 'critico',
    label: 'Crítico',
    description: 'Óbito ou dano permanente grave',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    darkBgColor: '#7F1D1D',
    icon: 'Skull',
  },
];

// ============================================
// TIPOS DE DENÚNCIA
// ============================================

export const DENUNCIA_TYPES = [
  { value: 'etica', label: 'Questão Ética', icon: 'Scale', color: '#6366F1' },
  { value: 'assedio_moral', label: 'Assédio Moral', icon: 'UserX', color: '#DC2626' },
  { value: 'assedio_sexual', label: 'Assédio Sexual', icon: 'UserX', color: '#DC2626' },
  { value: 'seguranca_paciente', label: 'Segurança do Paciente', icon: 'Shield', color: '#059669' },
  { value: 'fraude', label: 'Fraude ou Irregularidade', icon: 'AlertTriangle', color: '#F59E0B' },
  { value: 'discriminacao', label: 'Discriminação', icon: 'Ban', color: '#8B5CF6' },
  { value: 'conflito_interesse', label: 'Conflito de Interesse', icon: 'Users', color: '#0EA5E9' },
  { value: 'violacao_politica', label: 'Violação de Política', icon: 'FileX', color: '#EC4899' },
  { value: 'negligencia', label: 'Negligência', icon: 'AlertOctagon', color: '#EF4444' },
  { value: 'outro', label: 'Outro', icon: 'HelpCircle', color: '#6B7280' },
];

// ============================================
// STATUS DE INCIDENTE/DENÚNCIA
// ============================================

export const STATUS_CONFIG = {
  pending: {
    value: 'pending',
    label: 'Pendente',
    description: 'Aguardando análise inicial',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    darkBgColor: '#78350F',
  },
  in_review: {
    value: 'in_review',
    label: 'Em Análise',
    description: 'Sendo analisado pela equipe responsável',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    darkBgColor: '#1E3A8A',
  },
  investigating: {
    value: 'investigating',
    label: 'Em Investigação',
    description: 'Investigação formal em andamento',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    darkBgColor: '#5B21B6',
  },
  action_required: {
    value: 'action_required',
    label: 'Ação Requerida',
    description: 'Aguardando implementação de ações',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    darkBgColor: '#9D174D',
  },
  resolved: {
    value: 'resolved',
    label: 'Resolvido',
    description: 'Caso resolvido, aguardando encerramento',
    color: '#22C55E',
    bgColor: '#DCFCE7',
    darkBgColor: '#166534',
  },
  closed: {
    value: 'closed',
    label: 'Encerrado',
    description: 'Caso encerrado definitivamente',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    darkBgColor: '#374151',
  },
};

// ============================================
// TIPOS DE IDENTIFICAÇÃO DO RELATOR
// ============================================

export const IDENTIFICATION_TYPES = {
  identificado: {
    value: 'identificado',
    label: 'Identificado',
    description: 'Seus dados serão visíveis ao Comitê de Ética para facilitar o acompanhamento',
    icon: 'User',
    color: '#22C55E',
    bgColor: '#DCFCE7',
    darkBgColor: '#166534',
    visibilidade: 'Comitê de Ética vê todos os dados',
  },
  confidencial: {
    value: 'confidencial',
    label: 'Confidencial',
    description: 'Seus dados serão protegidos - apenas o gestor externo terá acesso, a instituição não verá',
    icon: 'Lock',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    darkBgColor: '#1E3A8A',
    visibilidade: 'Apenas gestor externo vê seus dados',
  },
  anonimo: {
    value: 'anonimo',
    label: 'Anônimo',
    description: 'Ninguém terá acesso à sua identidade. Você receberá um código de rastreio para acompanhar',
    icon: 'EyeOff',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    darkBgColor: '#374151',
    visibilidade: 'Ninguém vê seus dados',
  },
};

// ============================================
// GESTÃO INTERNA (Comitê de Ética)
// ============================================

export const PRIORIDADES_INTERNAS = [
  { value: 'baixa', label: 'Baixa', color: '#22C55E', description: 'Pode ser analisado em até 30 dias' },
  { value: 'media', label: 'Média', color: '#F59E0B', description: 'Deve ser analisado em até 15 dias' },
  { value: 'alta', label: 'Alta', color: '#EF4444', description: 'Deve ser analisado em até 7 dias' },
  { value: 'urgente', label: 'Urgente', color: '#DC2626', description: 'Requer análise imediata (24-48h)' },
];

export const CLASSIFICACOES_INTERNAS = [
  { value: 'em_analise', label: 'Em Análise', color: '#3B82F6', description: 'Ainda em processo de análise' },
  { value: 'procedente', label: 'Procedente', color: '#22C55E', description: 'Relato confirmado e válido' },
  { value: 'improcedente', label: 'Improcedente', color: '#EF4444', description: 'Relato não confirmado ou inválido' },
  { value: 'parcialmente_procedente', label: 'Parcialmente Procedente', color: '#F59E0B', description: 'Parte do relato foi confirmada' },
  { value: 'inconclusivo', label: 'Inconclusivo', color: '#6B7280', description: 'Não foi possível determinar' },
];

export const MEMBROS_COMITE = [
  { value: 'dr_coordenador', label: 'Dr. Coordenador do Comitê' },
  { value: 'dra_enfermeira_chefe', label: 'Dra. Enfermeira Chefe' },
  { value: 'dr_medico_staff', label: 'Dr. Anestesiologista' }, // compat legado (mantido para não quebrar dados já salvos)
  { value: 'assessor_juridico', label: 'Assessor Jurídico' },
  { value: 'gestor_qualidade', label: 'Gestor de Qualidade' },
  { value: 'outro', label: 'Outro membro' },
];

/**
 * Template de dados de gestão interna para novos incidentes/denúncias
 */
export function createGestaoInternaTemplate() {
  return {
    responsavelAnalise: null,
    prioridadeInterna: 'media',
    classificacaoInterna: 'em_analise',
    dataLimiteResposta: null,
    notasInternas: '',
    acoesRealizadas: [],
    documentosAnexosInternos: [],
    historicoStatus: [
      {
        status: 'pending',
        data: new Date().toISOString(),
        usuario: 'Sistema',
        observacao: 'Relato recebido',
      },
    ],
    parecer: '',
    recomendacoes: '',
    feedbackAoRelator: '',
    dataConclusao: null,
    rca: null,
    ropsVinculados: [],
  };
}

/**
 * Adiciona ação ao histórico de gestão interna
 */
export function addAcaoRealizada(gestaoInterna, acao) {
  return {
    ...gestaoInterna,
    acoesRealizadas: [
      ...gestaoInterna.acoesRealizadas,
      {
        ...acao,
        data: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Adiciona mudança de status ao histórico
 */
export function addHistoricoStatus(gestaoInterna, status, usuario, observacao = '') {
  return {
    ...gestaoInterna,
    historicoStatus: [
      ...gestaoInterna.historicoStatus,
      {
        status,
        data: new Date().toISOString(),
        usuario,
        observacao,
      },
    ],
  };
}

// ============================================
// LOCAIS/SETORES
// ============================================

export const LOCAIS = [
  { value: 'clinica_consultorio', label: 'Clínica/Consultório de Anestesiologia' },
  { value: 'hospital_unimed', label: 'Hospital Unimed' },
  { value: 'hospital_regional_oeste', label: 'Hospital Regional do Oeste' },
  { value: 'hospital_materno_infantil', label: 'Hospital Materno Infantil' },
  { value: 'iosc', label: 'IOSC – Hospital dos Olhos SC' },
  { value: 'aho', label: 'AHO – Accurata Hospital dos Olhos' },
  { value: 'la_forme', label: 'La Forme' },
  { value: 'centro_coluna', label: 'Centro de Coluna e Imagem' },
  { value: 'conception', label: 'Conception' },
  { value: 'hospital_olhos_chapeco', label: 'Hospital dos Olhos Chapecó' },
  { value: 'umanita', label: 'Umanitá' },
  { value: 'digimax', label: 'Digimax' },
  { value: 'clinica_cirurgica', label: 'Clínica Cirúrgica Chapecó' },
  { value: 'clinicas_odontologicas', label: 'Clínicas odontológicas' },
  { value: 'outros', label: 'Outros' },
];

export const SETORES = [
  { value: 'centro_cirurgico', label: 'Centro Cirúrgico' },
  { value: 'centro_obstetrico', label: 'Centro Obstétrico' },
  { value: 'hemodinamica', label: 'Hemodinâmica' },
  { value: 'endoscopia', label: 'Endoscopia' },
  { value: 'tomografia', label: 'Tomografia' },
  { value: 'ressonancia', label: 'Ressonância Magnética' },
  { value: 'biopsia', label: 'Biopsia' },
  { value: 'transesofagico', label: 'Transesofágico' },
  { value: 'recuperacao_anestesica', label: 'Recuperação Anestésica' },
  { value: 'uti', label: 'UTI' },
  { value: 'internacao', label: 'Setores de Internação' },
  { value: 'consultorio_anestesia', label: 'Consultório de Anestesia' },
  { value: 'consultorio_odonto', label: 'Consultório Odontológico' },
  { value: 'outros', label: 'Outros' },
];

export const TURNOS = [
  { value: 'madrugada', label: 'Madrugada (00:00 – 05:59)' },
  { value: 'manha', label: 'Manhã (06:00 – 11:59)' },
  { value: 'tarde', label: 'Tarde (12:00 – 17:59)' },
  { value: 'noite', label: 'Noite (18:00 – 23:59)' },
];

// ============================================
// FUNÇÕES DO NOTIFICANTE
// ============================================

export const FUNCOES = [
  { value: 'medico_anestesista', label: 'Médico Anestesista' },
  { value: 'medico_cirurgiao', label: 'Médico Cirurgião' },
  { value: 'medico_residente', label: 'Médico Residente' },
  { value: 'enfermeiro', label: 'Enfermeiro(a)' },
  { value: 'tecnico_enfermagem', label: 'Téc. Enfermagem' },
  { value: 'instrumentador', label: 'Instrumentador(a)' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'outro', label: 'Outro' },
];

// ============================================
// CONTEXTO DE ANESTESIA
// ============================================

export const FASES_PROCEDIMENTO = [
  { value: 'pre_operatorio', label: 'Pré-operatório' },
  { value: 'inducao', label: 'Indução Anestésica' },
  { value: 'manutencao', label: 'Manutenção Anestésica' },
  { value: 'despertar', label: 'Despertar/Extubação' },
  { value: 'pos_operatorio_imediato', label: 'Pós-operatório Imediato (RPA)' },
  { value: 'pos_operatorio_tardio', label: 'Pós-operatório Tardio' },
  { value: 'nao_aplicavel', label: 'Não Aplicável' },
];

export const TIPOS_ANESTESIA = [
  { value: 'geral', label: 'Anestesia Geral' },
  { value: 'raquianestesia', label: 'Raquianestesia' },
  { value: 'peridural', label: 'Peridural' },
  { value: 'combinada', label: 'Combinada (Raqui + Peridural)' },
  { value: 'bloqueio_periferico', label: 'Bloqueio Periférico' },
  { value: 'sedacao', label: 'Sedação' },
  { value: 'local', label: 'Anestesia Local' },
  { value: 'nao_aplicavel', label: 'Não Aplicável' },
];

export const MONITORAMENTOS = [
  { value: 'oximetria', label: 'Oximetria (SpO2)' },
  { value: 'capnografia', label: 'Capnografia (EtCO2)' },
  { value: 'ecg', label: 'ECG' },
  { value: 'pni', label: 'Pressão Não Invasiva (PNI)' },
  { value: 'pai', label: 'Pressão Arterial Invasiva (PAI)' },
  { value: 'pvc', label: 'Pressão Venosa Central (PVC)' },
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'bis', label: 'BIS/Entropia' },
  { value: 'tof', label: 'TOF (Bloqueio Neuromuscular)' },
  { value: 'debito_urinario', label: 'Débito Urinário' },
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Gera número de protocolo para incidente
 * Formato: INC-YYYYMMDD-XXXX
 */
export function generateIncidentProtocol() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INC-${dateStr}-${random}`;
}

/**
 * Gera número de protocolo para denúncia
 * Formato: DEN-YYYYMMDD-XXXX
 */
export function generateDenunciaProtocol() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DEN-${dateStr}-${random}`;
}

/**
 * Gera código de rastreio para denúncias anônimas
 * Formato: ANEST-YYYY-XXXXXX
 */
export function generateTrackingCode() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ANEST-${year}-${code}`;
}

/**
 * Retorna configuração de severidade por valor
 */
export function getSeverityConfig(value) {
  return SEVERITY_LEVELS.find(s => s.value === value) || SEVERITY_LEVELS[0];
}

/**
 * Retorna configuração de status por valor
 */
export function getStatusConfig(value) {
  return STATUS_CONFIG[value] || STATUS_CONFIG.pending;
}

/**
 * Retorna configuração de tipo de incidente por valor
 */
export function getIncidentTypeConfig(value) {
  return INCIDENT_TYPES[value] || INCIDENT_TYPES.outros;
}

/**
 * Retorna configuração de tipo de denúncia por valor
 */
export function getDenunciaTypeConfig(value) {
  return DENUNCIA_TYPES.find(t => t.value === value) || DENUNCIA_TYPES[9];
}

/**
 * Retorna label do local por valor
 */
export function getLocalLabel(value) {
  const local = LOCAIS.find(l => l.value === value);
  return local ? local.label : value;
}

/**
 * Retorna label do setor por valor
 */
export function getSetorLabel(value) {
  const setor = SETORES.find(s => s.value === value);
  return setor ? setor.label : value;
}

/**
 * Retorna label do turno por valor
 */
export function getTurnoLabel(value) {
  const turno = TURNOS.find(t => t.value === value);
  return turno ? turno.label : value;
}

/**
 * Retorna label da função por valor
 */
export function getFuncaoLabel(value) {
  const funcao = FUNCOES.find(f => f.value === value);
  return funcao ? funcao.label : value;
}

/**
 * Formata data para exibição
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para exibição
 */
export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formata data relativa (há X minutos, há X horas, etc)
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;

  return formatDate(dateString);
}

// Export default com todos os itens
export default {
  INCIDENT_TYPES,
  SEVERITY_LEVELS,
  DENUNCIA_TYPES,
  STATUS_CONFIG,
  IDENTIFICATION_TYPES,
  PRIORIDADES_INTERNAS,
  CLASSIFICACOES_INTERNAS,
  MEMBROS_COMITE,
  LOCAIS,
  SETORES,
  TURNOS,
  FUNCOES,
  FASES_PROCEDIMENTO,
  TIPOS_ANESTESIA,
  MONITORAMENTOS,
  generateIncidentProtocol,
  generateDenunciaProtocol,
  generateTrackingCode,
  createGestaoInternaTemplate,
  addAcaoRealizada,
  addHistoricoStatus,
  getSeverityConfig,
  getStatusConfig,
  getIncidentTypeConfig,
  getDenunciaTypeConfig,
  getLocalLabel,
  getSetorLabel,
  getTurnoLabel,
  getFuncaoLabel,
  formatDate,
  formatDateTime,
  formatRelativeTime,
};
