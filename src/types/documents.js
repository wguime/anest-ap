/**
 * Types and constants for the Documents system
 * Single Source of Truth for document categories, status, and workflow
 */

// Document categories that map to mock data
export const DOCUMENT_CATEGORIES = {
  ETICA: 'etica',
  COMITES: 'comites',
  AUDITORIAS: 'auditorias',
  RELATORIOS: 'relatorios',
  BIBLIOTECA: 'biblioteca',
  FINANCEIRO: 'financeiro',
  MEDICAMENTOS: 'medicamentos',
  INFECCOES: 'infeccoes',
  DESASTRES: 'desastres',
}

// Category labels for display
export const CATEGORY_LABELS = {
  [DOCUMENT_CATEGORIES.ETICA]: 'Etica e Bioetica',
  [DOCUMENT_CATEGORIES.COMITES]: 'Comites',
  [DOCUMENT_CATEGORIES.AUDITORIAS]: 'Auditorias',
  [DOCUMENT_CATEGORIES.RELATORIOS]: 'Relatorios',
  [DOCUMENT_CATEGORIES.BIBLIOTECA]: 'Biblioteca',
  [DOCUMENT_CATEGORIES.FINANCEIRO]: 'Financeiro',
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: 'Uso de Medicamentos',
  [DOCUMENT_CATEGORIES.INFECCOES]: 'Prevencao de Infeccoes',
  [DOCUMENT_CATEGORIES.DESASTRES]: 'Gerenciamento de Desastres',
}

// Category icons (Lucide icon names)
export const CATEGORY_ICONS = {
  [DOCUMENT_CATEGORIES.ETICA]: 'Scale',
  [DOCUMENT_CATEGORIES.COMITES]: 'Users',
  [DOCUMENT_CATEGORIES.AUDITORIAS]: 'FileSearch',
  [DOCUMENT_CATEGORIES.RELATORIOS]: 'FileBarChart',
  [DOCUMENT_CATEGORIES.BIBLIOTECA]: 'Library',
  [DOCUMENT_CATEGORIES.FINANCEIRO]: 'DollarSign',
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: 'Pill',
  [DOCUMENT_CATEGORIES.INFECCOES]: 'ShieldAlert',
  [DOCUMENT_CATEGORIES.DESASTRES]: 'Flame',
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
 * pendente -> ativo (approve)
 * pendente -> rejeitado (reject)
 * rejeitado -> rascunho (revise and resubmit)
 * ativo -> arquivado (archive)
 * arquivado -> rascunho (restore for revision)
 */
export const VALID_TRANSITIONS = {
  [DOCUMENT_STATUS.RASCUNHO]: [DOCUMENT_STATUS.PENDENTE],
  [DOCUMENT_STATUS.PENDENTE]: [DOCUMENT_STATUS.ATIVO, DOCUMENT_STATUS.REJEITADO],
  [DOCUMENT_STATUS.REJEITADO]: [DOCUMENT_STATUS.RASCUNHO],
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

// Default empty state for documents
export const INITIAL_DOCUMENTS_STATE = {
  [DOCUMENT_CATEGORIES.ETICA]: [],
  [DOCUMENT_CATEGORIES.COMITES]: [],
  [DOCUMENT_CATEGORIES.AUDITORIAS]: [],
  [DOCUMENT_CATEGORIES.RELATORIOS]: [],
  [DOCUMENT_CATEGORIES.BIBLIOTECA]: [],
  [DOCUMENT_CATEGORIES.FINANCEIRO]: [],
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: [],
  [DOCUMENT_CATEGORIES.INFECCOES]: [],
  [DOCUMENT_CATEGORIES.DESASTRES]: [],
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
  [DOCUMENT_CATEGORIES.ETICA]: { ropArea: 'Cultura de Segurança', weight: 1.2 },
  [DOCUMENT_CATEGORIES.COMITES]: { ropArea: 'Comunicação', weight: 1.0 },
  [DOCUMENT_CATEGORIES.AUDITORIAS]: { ropArea: 'Avaliação de Riscos', weight: 1.5 },
  [DOCUMENT_CATEGORIES.RELATORIOS]: { ropArea: 'Indicadores', weight: 0.8 },
  [DOCUMENT_CATEGORIES.BIBLIOTECA]: { ropArea: 'Vida Profissional', weight: 1.0 },
  [DOCUMENT_CATEGORIES.FINANCEIRO]: { ropArea: 'Gestão Financeira', weight: 0.8 },
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: { ropArea: 'Uso de Medicamentos', weight: 1.3 },
  [DOCUMENT_CATEGORIES.INFECCOES]: { ropArea: 'Prevenção de Infecções', weight: 1.3 },
  [DOCUMENT_CATEGORIES.DESASTRES]: { ropArea: 'Avaliação de Riscos', weight: 1.0 },
}

// Recommended document counts per category (admin-configurable in the future)
export const RECOMMENDED_DOCUMENT_COUNTS = {
  [DOCUMENT_CATEGORIES.ETICA]: 10,
  [DOCUMENT_CATEGORIES.COMITES]: 8,
  [DOCUMENT_CATEGORIES.AUDITORIAS]: 15,
  [DOCUMENT_CATEGORIES.RELATORIOS]: 12,
  [DOCUMENT_CATEGORIES.BIBLIOTECA]: 20,
  [DOCUMENT_CATEGORIES.FINANCEIRO]: 8,
  [DOCUMENT_CATEGORIES.MEDICAMENTOS]: 10,
  [DOCUMENT_CATEGORIES.INFECCOES]: 10,
  [DOCUMENT_CATEGORIES.DESASTRES]: 5,
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

export const CLASSIFICACAO_ACESSO_OPTIONS = [
  { value: 'publico', label: 'Publico' },
  { value: 'interno', label: 'Interno' },
  { value: 'confidencial', label: 'Confidencial' },
  { value: 'restrito', label: 'Restrito' },
]

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
}
