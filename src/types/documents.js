/**
 * Types and constants for the Documents system
 * Single Source of Truth for document categories, status, and workflow
 */

// Document categories — deve bater com o CHECK constraint da tabela documentos no DB
export const DOCUMENT_CATEGORIES = {
  ETICA:        'etica',
  COMITES:      'comites',
  AUDITORIAS:   'auditorias',
  RELATORIOS:   'relatorios',
  BIBLIOTECA:   'biblioteca',
  FINANCEIRO:   'financeiro',
  MEDICAMENTOS: 'medicamentos',
  INFECCOES:    'infeccoes',
  DESASTRES:    'desastres',
}

// Category labels for display — includes all DB categories
export const CATEGORY_LABELS = {
  etica:        'Ética e Bioética',
  comites:      'Comitês',
  auditorias:   'Auditorias',
  relatorios:   'Relatórios',
  biblioteca:   'Biblioteca',
  financeiro:   'Financeiro',
  medicamentos: 'Medicamentos',
  infeccoes:    'Infecções',
  desastres:    'Desastres',
}

// Category icons (Lucide icon names)
export const CATEGORY_ICONS = {
  etica:        'Scale',
  comites:      'Users',
  auditorias:   'ClipboardCheck',
  relatorios:   'ClipboardList',
  biblioteca:   'BookOpen',
  financeiro:   'DollarSign',
  medicamentos: 'Pill',
  infeccoes:    'ShieldAlert',
  desastres:    'Flame',
}

// ============================================================================
// DOCUMENT STATUS - Single Source of Truth (replaces DOC_STATUS in documentTypes.js)
// ============================================================================

export const DOCUMENT_STATUS = {
  RASCUNHO: 'rascunho',
  PENDENTE: 'pendente',
  ATIVO: 'ativo',
  ARQUIVADO: 'arquivado',
  REJEITADO: 'rejeitado',
  REVISAO_PENDENTE: 'revisao_pendente',
}

// Status labels for display
export const STATUS_LABELS = {
  [DOCUMENT_STATUS.RASCUNHO]: 'Rascunho',
  [DOCUMENT_STATUS.PENDENTE]: 'Aguardando Aprovacao',
  [DOCUMENT_STATUS.ATIVO]: 'Ativo',
  [DOCUMENT_STATUS.ARQUIVADO]: 'Arquivado',
  [DOCUMENT_STATUS.REJEITADO]: 'Rejeitado',
  [DOCUMENT_STATUS.REVISAO_PENDENTE]: 'Revisao Pendente',
}

// Status colors for UI
export const STATUS_COLORS = {
  [DOCUMENT_STATUS.RASCUNHO]: '#6B7280',
  [DOCUMENT_STATUS.PENDENTE]: '#F59E0B',
  [DOCUMENT_STATUS.ATIVO]: '#059669',
  [DOCUMENT_STATUS.ARQUIVADO]: '#6B7280',
  [DOCUMENT_STATUS.REJEITADO]: '#DC2626',
  [DOCUMENT_STATUS.REVISAO_PENDENTE]: '#FF8F00',
}

// ============================================================================
// WORKFLOW - Valid status transitions (Qmentum compliant)
// ============================================================================

/**
 * Valid status transitions map
 * rascunho -> pendente (submit for approval)
 * rascunho -> arquivado (archive draft)
 * pendente -> ativo (approve)
 * pendente -> rejeitado (reject)
 * rejeitado -> rascunho (revise and resubmit)
 * rejeitado -> arquivado (archive rejected)
 * ativo -> arquivado (archive)
 * arquivado -> rascunho (restore for revision)
 */
export const VALID_TRANSITIONS = {
  [DOCUMENT_STATUS.RASCUNHO]: [DOCUMENT_STATUS.PENDENTE, DOCUMENT_STATUS.ARQUIVADO],
  [DOCUMENT_STATUS.PENDENTE]: [DOCUMENT_STATUS.ATIVO, DOCUMENT_STATUS.REJEITADO],
  [DOCUMENT_STATUS.REJEITADO]: [DOCUMENT_STATUS.RASCUNHO, DOCUMENT_STATUS.ARQUIVADO],
  [DOCUMENT_STATUS.ATIVO]: [DOCUMENT_STATUS.ARQUIVADO, DOCUMENT_STATUS.REVISAO_PENDENTE],
  [DOCUMENT_STATUS.ARQUIVADO]: [DOCUMENT_STATUS.RASCUNHO],
  [DOCUMENT_STATUS.REVISAO_PENDENTE]: [DOCUMENT_STATUS.PENDENTE],
}

/**
 * Validate a status transition
 * @param {string} currentStatus - Current document status
 * @param {string} newStatus - Desired new status
 * @returns {{ valid: boolean, message: string }}
 */
export const validateStatusTransition = (currentStatus, newStatus) => {
  if (currentStatus === newStatus) {
    return { valid: false, message: 'Status atual e novo sao iguais' }
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus]
  if (!allowedTransitions) {
    return { valid: false, message: `Status atual "${currentStatus}" e invalido` }
  }

  if (!allowedTransitions.includes(newStatus)) {
    const allowed = allowedTransitions.map(s => STATUS_LABELS[s] || s).join(', ')
    return {
      valid: false,
      message: `Transicao de "${STATUS_LABELS[currentStatus] || currentStatus}" para "${STATUS_LABELS[newStatus] || newStatus}" nao e permitida. Transicoes validas: ${allowed}`,
    }
  }

  return { valid: true, message: 'Transicao valida' }
}

// ============================================================================
// CHANGE LOG - Audit trail types
// ============================================================================

export const CHANGE_LOG_ACTIONS = {
  CREATED: 'created',
  STATUS_CHANGED: 'status_changed',
  UPDATED: 'updated',
  VERSION_ADDED: 'version_added',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
  RESTORED: 'restored',
  DELETED: 'deleted',
}

/**
 * Create a change log entry
 * @param {string} action - One of CHANGE_LOG_ACTIONS
 * @param {Object} params - { userId, userName, changes, comment }
 * @returns {Object} Change log entry
 */
export const createChangeLogEntry = (action, { userId = 'sistema', userName = 'Sistema', changes = {}, comment = '' } = {}) => ({
  action,
  userId,
  userName,
  timestamp: new Date().toISOString(),
  changes,
  comment,
})

// ============================================================================
// ACTION TYPES for reducer
// ============================================================================

export const DOCUMENT_ACTIONS = {
  ADD: 'ADD_DOCUMENT',
  UPDATE: 'UPDATE_DOCUMENT',
  DELETE: 'DELETE_DOCUMENT',
  ARCHIVE: 'ARCHIVE_DOCUMENT',
  RESTORE: 'RESTORE_DOCUMENT',
  CHANGE_STATUS: 'CHANGE_STATUS',
  ADD_VERSION: 'ADD_VERSION',
  SET_DOCUMENTS: 'SET_DOCUMENTS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_INITIALIZED: 'SET_INITIALIZED',
}

// ============================================================================
// SEARCH CONSTANTS
// ============================================================================

export const SEARCH_RESULT_TYPES = {
  DOCUMENTO: 'documento',
  INCIDENTE: 'incidente',
  PLANO_ACAO: 'plano_acao',
  PAGE: 'page',
}

export const SEARCH_FILTERS = {
  TYPES: ['documento', 'incidente', 'plano_acao'],
  STATUSES: ['ativo', 'pendente', 'arquivado', 'rascunho'],
}

// Default empty state for documents — keys match DB CHECK constraint
export const INITIAL_DOCUMENTS_STATE = {
  etica:        [],
  comites:      [],
  auditorias:   [],
  relatorios:   [],
  biblioteca:   [],
  financeiro:   [],
  medicamentos: [],
  infeccoes:    [],
  desastres:    [],
}

// ============================================================================
// HELPERS
// ============================================================================

export const getAllCategories = () => Object.values(DOCUMENT_CATEGORIES)

export const isValidCategory = (category) =>
  Object.values(DOCUMENT_CATEGORIES).includes(category)

export const getCategoryLabel = (category) =>
  CATEGORY_LABELS[category] || category

export const getStatusLabel = (status) => STATUS_LABELS[status] || status

export const getStatusColor = (status) => STATUS_COLORS[status] || '#6B7280'

export const countActiveDocuments = (documents) =>
  documents.filter((doc) => doc.status === DOCUMENT_STATUS.ATIVO).length

export const countTotalActiveDocuments = (documentsMap) => {
  return Object.values(documentsMap).reduce((total, docs) => {
    return total + countActiveDocuments(docs)
  }, 0)
}

/**
 * Check if a document review is overdue
 * @param {string} proximaRevisao - ISO date string
 * @returns {boolean}
 */
export const isRevisaoVencida = (proximaRevisao) => {
  if (!proximaRevisao) return false
  return new Date(proximaRevisao) < new Date()
}

/**
 * Calculate days until review
 * @param {string} proximaRevisao - ISO date string
 * @returns {number|null}
 */
export const diasAteRevisao = (proximaRevisao) => {
  if (!proximaRevisao) return null
  const hoje = new Date()
  const revisao = new Date(proximaRevisao)
  const diff = revisao.getTime() - hoje.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ============================================================================
// QMENTUM WORKFLOW
// ============================================================================

export const APPROVAL_WORKFLOW_TEMPLATE = {
  requiredApprovers: [],
  currentStep: 0,
  status: 'pending', // pending | in_progress | completed | rejected
}

export const QMENTUM_CATEGORIES = {
  [DOCUMENT_CATEGORIES.ETICA]:        { ropArea: 'Ética e Bioética', weight: 1.2 },
  [DOCUMENT_CATEGORIES.COMITES]:      { ropArea: 'Governança', weight: 1.0 },
  [DOCUMENT_CATEGORIES.AUDITORIAS]:   { ropArea: 'Avaliação de Qualidade', weight: 1.5 },
  [DOCUMENT_CATEGORIES.RELATORIOS]:   { ropArea: 'Indicadores', weight: 1.0 },
  [DOCUMENT_CATEGORIES.BIBLIOTECA]:   { ropArea: 'Padronização', weight: 0.8 },
  [DOCUMENT_CATEGORIES.FINANCEIRO]:   { ropArea: 'Gestão Financeira', weight: 1.1 },
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: { ropArea: 'Gestão de Medicamentos', weight: 1.0 },
  [DOCUMENT_CATEGORIES.INFECCOES]:    { ropArea: 'Prevenção de Infecções', weight: 1.0 },
  [DOCUMENT_CATEGORIES.DESASTRES]:    { ropArea: 'Gestão de Desastres', weight: 1.0 },
}

// Recommended document counts per category (admin-configurable in the future)
export const RECOMMENDED_DOCUMENT_COUNTS = {
  [DOCUMENT_CATEGORIES.ETICA]:        10,
  [DOCUMENT_CATEGORIES.COMITES]:      10,
  [DOCUMENT_CATEGORIES.AUDITORIAS]:   15,
  [DOCUMENT_CATEGORIES.RELATORIOS]:   12,
  [DOCUMENT_CATEGORIES.BIBLIOTECA]:   20,
  [DOCUMENT_CATEGORIES.FINANCEIRO]:   10,
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: 8,
  [DOCUMENT_CATEGORIES.INFECCOES]:    8,
  [DOCUMENT_CATEGORIES.DESASTRES]:    5,
}

export const COMPLIANCE_FLAGS = {
  REVISION_OVERDUE: 'revision_overdue',
  APPROVAL_PENDING: 'approval_pending',
  MISSING_SIGNATURE: 'missing_signature',
  INCOMPLETE_WORKFLOW: 'incomplete_workflow',
}

export const createApprovalEntry = (userId, userName, action, comment = '') => ({
  userId,
  userName,
  action, // 'approved' | 'rejected' | 'signed'
  timestamp: new Date().toISOString(),
  comment,
})

export const getComplianceFlags = (doc) => {
  const flags = []
  if (doc.proximaRevisao && isRevisaoVencida(doc.proximaRevisao)) {
    flags.push(COMPLIANCE_FLAGS.REVISION_OVERDUE)
  }
  if (doc.status === DOCUMENT_STATUS.PENDENTE) {
    flags.push(COMPLIANCE_FLAGS.APPROVAL_PENDING)
  }
  if (doc.approvalWorkflow && doc.approvalWorkflow.status !== 'completed') {
    flags.push(COMPLIANCE_FLAGS.INCOMPLETE_WORKFLOW)
  }
  return flags
}

// ============================================================================
// TIPO_CONFIG — Centralized tipo → { label, color } mapping
// Covers new CATEGORY_SUBSECTIONS values + legacy tipos
// ============================================================================

export const TIPO_CONFIG = {
  // Novos (de CATEGORY_SUBSECTIONS)
  politicas: { label: 'Politicas', color: '#6366F1' },
  protocolos_clinicos: { label: 'Protocolos Clinicos', color: '#059669' },
  procedimentos: { label: 'Procedimentos', color: '#0891B2' },
  manuais: { label: 'Manuais', color: '#EC4899' },
  formularios: { label: 'Formularios', color: '#F59E0B' },
  relatorios: { label: 'Relatorios', color: '#3B82F6' },
  fluxogramas: { label: 'Fluxogramas', color: '#8B5CF6' },
  mapas_processos: { label: 'Mapas de Processos', color: '#8B5CF6' },
  mapas_risco: { label: 'Mapas de Risco', color: '#DC2626' },
  tabelas: { label: 'Tabelas', color: '#0EA5E9' },
  regimentos: { label: 'Regimentos', color: '#2563EB' },
  regimento_interno: { label: 'Regimento Interno', color: '#2563EB' },
  atas: { label: 'Atas', color: '#059669' },
  planos_acao: { label: 'Planos de Acao', color: '#0891B2' },
  contratos_legais: { label: 'Contratos Legais', color: '#7B1FA2' },
  acordos_processos: { label: 'Acordos e Processos', color: '#7B1FA2' },
  contratos: { label: 'Contratos', color: '#7B1FA2' },
  indicadores: { label: 'Indicadores', color: '#059669' },
  auditorias: { label: 'Auditorias', color: '#7B1FA2' },
  protocolos: { label: 'Protocolos', color: '#059669' },
  modelo_politica: { label: 'Modelo de Politica', color: '#6366F1' },
  modelo_procedimento: { label: 'Modelo de Procedimento', color: '#0891B2' },
  modelo_manual: { label: 'Modelo de Manual', color: '#EC4899' },
  modelo_formulario: { label: 'Modelo de Formulario', color: '#F59E0B' },
  modelo_relatorio: { label: 'Modelo de Relatorio', color: '#3B82F6' },
  relatorios_gestao: { label: 'Relatorios Gestao', color: '#3B82F6' },
  relatorios_assistenciais: { label: 'Relatorios Assistenciais', color: '#3B82F6' },
  relatorios_financeiros: { label: 'Relatorios Financeiros', color: '#3B82F6' },
  relatorios_qualidade: { label: 'Relatorios Qualidade', color: '#3B82F6' },
  // Legados (backward compat)
  parecer: { label: 'Parecer', color: '#006837' },
  resolucao: { label: 'Resolucao', color: '#1565C0' },
  termo: { label: 'Termo de Consentimento', color: '#7B1FA2' },
  protocolo: { label: 'Protocolo', color: '#059669' },
  politica: { label: 'Politica', color: '#6366F1' },
  formulario: { label: 'Formulario', color: '#F59E0B' },
  manual: { label: 'Manual', color: '#EC4899' },
  relatorio: { label: 'Relatorio', color: '#3B82F6' },
  processo: { label: 'Processo', color: '#8B5CF6' },
  risco: { label: 'Risco', color: '#DC2626' },
  plano: { label: 'Plano', color: '#0891B2' },
  etica: { label: 'Etica e Bioetica', color: '#006837' },
  // Legados secao-especificos
  interna: { label: 'Interna', color: '#059669' },
  externa: { label: 'Externa', color: '#1565C0' },
  conformidade: { label: 'Conformidade', color: '#059669' },
  naoconformidade: { label: 'Nao Conformidade', color: '#DC2626' },
  planoacao: { label: 'Plano de Acao', color: '#0891B2' },
  mensal: { label: 'Mensal', color: '#3B82F6' },
  trimestral: { label: 'Trimestral', color: '#2563EB' },
  anual: { label: 'Anual', color: '#1565C0' },
  incidente: { label: 'Incidente', color: '#DC2626' },
  seguranca: { label: 'Seguranca', color: '#006837' },
  simulacao: { label: 'Simulacao', color: '#F59E0B' },
  orcamento: { label: 'Orcamento', color: '#2E7D32' },
  relatorio_financeiro: { label: 'Relatorio Financeiro', color: '#3B82F6' },
  contrato: { label: 'Contrato', color: '#7B1FA2' },
  auditoria_fiscal: { label: 'Auditoria Fiscal', color: '#7B1FA2' },
  nota_fiscal: { label: 'Nota Fiscal', color: '#F59E0B' },
  prestacao_contas: { label: 'Prestacao de Contas', color: '#0891B2' },
  procedimento: { label: 'Procedimento', color: '#0891B2' },
  executivo: { label: 'Executivo de Gestao', color: '#059669' },
  gestao_pessoas: { label: 'Gestao de Pessoas', color: '#7C3AED' },
  escalas: { label: 'Comite de Escalas', color: '#F59E0B' },
  tecnologia: { label: 'Tecnologia e Materiais', color: '#2563EB' },
  qualidade: { label: 'Comite de Qualidade', color: '#2563EB' },
  educacao: { label: 'Educacao e Residencia', color: '#DC2626' },
  etica_conduta: { label: 'Etica e Conduta', color: '#7C3AED' },
  desastres: { label: 'Emergencias e Desastres', color: '#DC2626' },
  organograma: { label: 'Organograma Institucional', color: '#0891B2' },
}

export const getTipoConfig = (tipo) =>
  TIPO_CONFIG[tipo?.toLowerCase()] || { label: tipo || 'Documento', color: '#6B7280' }

export const CLASSIFICACAO_ACESSO_OPTIONS = [
  { value: 'publico', label: 'Publico' },
  { value: 'interno', label: 'Interno' },
  { value: 'confidencial', label: 'Confidencial' },
  { value: 'restrito', label: 'Restrito' },
]

// ============================================================================
// CATEGORY SUBSECTIONS — subseções por categoria (fonte única)
// Excluir __custom__ na exibição; incluir apenas no formulário
// ============================================================================

export const CATEGORY_SUBSECTIONS = {
  modelos: [
    { value: 'modelo_politica',     label: 'Modelo de Política' },
    { value: 'modelo_procedimento', label: 'Modelo de Procedimento' },
    { value: 'modelo_manual',       label: 'Modelo de Manual' },
    { value: 'modelo_formulario',   label: 'Modelo de Formulário' },
    { value: 'modelo_relatorio',    label: 'Modelo de Relatório' },
  ],
  governanca: [
    { value: 'regimentos',  label: 'Regimentos' },
    { value: 'atas',        label: 'Atas' },
    { value: 'planos_acao', label: 'Planos de Ação' },
    { value: 'relatorios',  label: 'Relatórios' },
  ],
  institucional: [
    { value: 'regimento_interno', label: 'Regimento Interno' },
    { value: 'politicas',         label: 'Políticas' },
    { value: 'contratos_legais',  label: 'Contratos Legais' },
    { value: 'acordos_processos', label: 'Acordos e Processos' },
    { value: 'manuais',           label: 'Manuais' },
    { value: 'formularios',       label: 'Formulários' },
    { value: 'relatorios',        label: 'Relatórios' },
    { value: 'fluxogramas',       label: 'Fluxogramas' },
    { value: 'mapas_processos',   label: 'Mapas de Processos' },
    { value: 'mapas_risco',       label: 'Mapas de Risco' },
    { value: 'tabelas',           label: 'Tabelas' },
  ],
  assistencial: [
    { value: 'politicas',          label: 'Políticas' },
    { value: 'protocolos_clinicos', label: 'Protocolos Clínicos' },
    { value: 'procedimentos',      label: 'Procedimentos' },
    { value: 'manuais',            label: 'Manuais' },
    { value: 'formularios',        label: 'Formulários' },
    { value: 'relatorios',         label: 'Relatórios' },
    { value: 'fluxogramas',        label: 'Fluxogramas' },
    { value: 'mapas_processos',    label: 'Mapas de Processos' },
    { value: 'mapas_risco',        label: 'Mapas de Risco' },
    { value: 'tabelas',            label: 'Tabelas' },
  ],
  gestao_pessoas: [
    { value: 'politicas',       label: 'Políticas' },
    { value: 'procedimentos',   label: 'Procedimentos' },
    { value: 'manuais',         label: 'Manuais' },
    { value: 'formularios',     label: 'Formulários' },
    { value: 'relatorios',      label: 'Relatórios' },
    { value: 'fluxogramas',     label: 'Fluxogramas' },
    { value: 'mapas_processos', label: 'Mapas de Processos' },
    { value: 'mapas_risco',     label: 'Mapas de Risco' },
    { value: 'tabelas',         label: 'Tabelas' },
  ],
  residencia: [
    { value: 'regimento_interno', label: 'Regimento Interno' },
    { value: 'politicas',         label: 'Políticas' },
    { value: 'protocolos',        label: 'Protocolos' },
    { value: 'manuais',           label: 'Manuais' },
    { value: 'formularios',       label: 'Formulários' },
    { value: 'relatorios',        label: 'Relatórios' },
    { value: 'fluxogramas',       label: 'Fluxogramas' },
    { value: 'mapas_processos',   label: 'Mapas de Processos' },
    { value: 'mapas_risco',       label: 'Mapas de Risco' },
    { value: 'tabelas',           label: 'Tabelas' },
  ],
  financeiro: [
    { value: 'politicas',       label: 'Políticas' },
    { value: 'procedimentos',   label: 'Procedimentos' },
    { value: 'contratos',       label: 'Contratos' },
    { value: 'manuais',         label: 'Manuais' },
    { value: 'formularios',     label: 'Formulários' },
    { value: 'relatorios',      label: 'Relatórios' },
    { value: 'fluxogramas',     label: 'Fluxogramas' },
    { value: 'mapas_processos', label: 'Mapas de Processos' },
    { value: 'mapas_risco',     label: 'Mapas de Risco' },
    { value: 'tabelas',         label: 'Tabelas' },
  ],
  qualidade: [
    { value: 'politicas',       label: 'Políticas' },
    { value: 'procedimentos',   label: 'Procedimentos' },
    { value: 'manuais',         label: 'Manuais' },
    { value: 'formularios',     label: 'Formulários' },
    { value: 'relatorios',      label: 'Relatórios' },
    { value: 'fluxogramas',     label: 'Fluxogramas' },
    { value: 'mapas_processos', label: 'Mapas de Processos' },
    { value: 'mapas_risco',     label: 'Mapas de Risco' },
    { value: 'indicadores',     label: 'Indicadores' },
    { value: 'auditorias',      label: 'Auditorias' },
  ],
  tecnologia_mat: [
    { value: 'politicas',       label: 'Políticas' },
    { value: 'procedimentos',   label: 'Procedimentos' },
    { value: 'manuais',         label: 'Manuais' },
    { value: 'formularios',     label: 'Formulários' },
    { value: 'relatorios',      label: 'Relatórios' },
    { value: 'fluxogramas',     label: 'Fluxogramas' },
    { value: 'mapas_processos', label: 'Mapas de Processos' },
    { value: 'mapas_risco',     label: 'Mapas de Risco' },
    { value: 'tabelas',         label: 'Tabelas' },
  ],
  relatorios_gerais: [
    { value: 'relatorios_gestao',        label: 'Relatórios Gestão' },
    { value: 'relatorios_assistenciais', label: 'Relatórios Assistenciais' },
    { value: 'relatorios_financeiros',   label: 'Relatórios Financeiros' },
    { value: 'relatorios_qualidade',     label: 'Relatórios Qualidade' },
  ],
  obsoletos: [
    { value: 'governanca',           label: 'Governança' },
    { value: 'institucional',        label: 'Institucional' },
    { value: 'assistencial',         label: 'Assistencial' },
    { value: 'gestao_pessoas',       label: 'Gestão Pessoas' },
    { value: 'residencia',           label: 'Residência' },
    { value: 'financeiro',           label: 'Financeiro' },
    { value: 'qualidade',            label: 'Qualidade' },
    { value: 'tecnologia_materiais', label: 'Tecnologia Materiais' },
  ],
}

export default {
  DOCUMENT_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  DOCUMENT_STATUS,
  STATUS_LABELS,
  STATUS_COLORS,
  VALID_TRANSITIONS,
  validateStatusTransition,
  CHANGE_LOG_ACTIONS,
  createChangeLogEntry,
  DOCUMENT_ACTIONS,
  SEARCH_RESULT_TYPES,
  SEARCH_FILTERS,
  INITIAL_DOCUMENTS_STATE,
  getAllCategories,
  isValidCategory,
  getCategoryLabel,
  getStatusLabel,
  getStatusColor,
  countActiveDocuments,
  countTotalActiveDocuments,
  isRevisaoVencida,
  diasAteRevisao,
  APPROVAL_WORKFLOW_TEMPLATE,
  QMENTUM_CATEGORIES,
  RECOMMENDED_DOCUMENT_COUNTS,
  COMPLIANCE_FLAGS,
  createApprovalEntry,
  getComplianceFlags,
  CLASSIFICACAO_ACESSO_OPTIONS,
  CATEGORY_SUBSECTIONS,
  TIPO_CONFIG,
  getTipoConfig,
}
