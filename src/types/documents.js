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

// Wave 1: timezone-aware date helpers extracted to src/utils/dateUtils.js.
// Re-export under the legacy names so call sites don't break.
import { isOverdue as _isOverdue, daysUntil as _daysUntil } from '@/utils/dateUtils'

/**
 * Check if a document review is overdue (local time, day granularity).
 * @param {string} proximaRevisao - ISO date string
 * @returns {boolean}
 */
export const isRevisaoVencida = (proximaRevisao) => _isOverdue(proximaRevisao)

/**
 * Calculate integer days until review (positive=future, negative=past, null=invalid).
 * @param {string} proximaRevisao - ISO date string
 * @returns {number|null}
 */
export const diasAteRevisao = (proximaRevisao) => _daysUntil(proximaRevisao)

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

// ============================================================================
// TIPO_DISPLAY_CONFIG — Display badge config for document detail UI
// SSOT for Tailwind-class-based badge styles consumed by DocumentoDetalhePage.
// Distinct from TIPO_CONFIG (which carries hex colors for charts/SVG): this map
// uses semantic tokens so it adapts to light/dark themes via design-system.
// ============================================================================

export const TIPO_DISPLAY_CONFIG = {
  // Tipos de documentos (biblioteca)
  protocolo:           { label: 'Protocolo',     color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  politica:            { label: 'Politica',      color: 'bg-category-indigo',  colorLight: 'bg-category-indigo-bg text-category-indigo-fg dark:bg-category-indigo-bg dark:text-category-indigo-fg' },
  formulario:          { label: 'Formulario',    color: 'bg-warning',          colorLight: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning' },
  manual:              { label: 'Manual',        color: 'bg-category-pink',    colorLight: 'bg-category-pink-bg text-category-pink-fg dark:bg-category-pink-bg dark:text-category-pink-fg' },
  relatorio:           { label: 'Relatorio',     color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  processo:            { label: 'Processo',      color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  termo:               { label: 'Termo',         color: 'bg-category-teal',    colorLight: 'bg-category-teal-bg text-category-teal-fg dark:bg-category-teal-bg dark:text-category-teal-fg' },
  risco:               { label: 'Risco',         color: 'bg-destructive',      colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
  plano:               { label: 'Plano',         color: 'bg-category-cyan',    colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
  // Tipos de auditorias
  higiene_maos:        { label: 'Higiene Maos',  color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  uso_medicamentos:    { label: 'Medicamentos',  color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  abreviaturas:        { label: 'Abreviaturas',  color: 'bg-destructive',      colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
  politica_qualidade:  { label: 'Qualidade',     color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  politica_disclosure: { label: 'Disclosure',    color: 'bg-category-cyan',    colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
  relatorio_rops:      { label: 'ROPs',          color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  operacional:         { label: 'Operacional',   color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  conformidade:        { label: 'Conformidade',  color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  procedimento:        { label: 'Procedimento',  color: 'bg-category-pink',    colorLight: 'bg-category-pink-bg text-category-pink-fg dark:bg-category-pink-bg dark:text-category-pink-fg' },
  seguranca_paciente:  { label: 'Seguranca',     color: 'bg-destructive',      colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
  controle_infeccao:   { label: 'Infeccao',      color: 'bg-category-cyan',    colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
  equipamentos:        { label: 'Equipamentos',  color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  // Tipos de comites institucionais
  regimento_interno:   { label: 'Regimento',     color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  executivo:           { label: 'Executivo',     color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  financeiro:          { label: 'Financeiro',    color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  gestao_pessoas:      { label: 'Gestao RH',     color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  escalas:             { label: 'Escalas',       color: 'bg-warning',          colorLight: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning' },
  tecnologia:          { label: 'Tecnologia',    color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  qualidade:           { label: 'Qualidade',     color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  educacao:            { label: 'Educacao',      color: 'bg-destructive',      colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
  etica_conduta:       { label: 'Etica',         color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  // Tipo de documentos de etica e bioetica
  etica:               { label: 'Etica e Bioetica', color: 'bg-primary',       colorLight: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' },
  // Tipos novos de CATEGORY_SUBSECTIONS (plural) — sem estas entradas o
  // fallback rotulava qualquer politica/formulario importado como "Protocolo"
  politicas:           { label: 'Politica',      color: 'bg-category-indigo',  colorLight: 'bg-category-indigo-bg text-category-indigo-fg dark:bg-category-indigo-bg dark:text-category-indigo-fg' },
  protocolos:          { label: 'Protocolo',     color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  protocolos_clinicos: { label: 'Protocolo Clinico', color: 'bg-success',      colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  procedimentos:       { label: 'Procedimento',  color: 'bg-category-pink',    colorLight: 'bg-category-pink-bg text-category-pink-fg dark:bg-category-pink-bg dark:text-category-pink-fg' },
  manuais:             { label: 'Manual',        color: 'bg-category-pink',    colorLight: 'bg-category-pink-bg text-category-pink-fg dark:bg-category-pink-bg dark:text-category-pink-fg' },
  formularios:         { label: 'Formulario',    color: 'bg-warning',          colorLight: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning' },
  relatorios:          { label: 'Relatorio',     color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  relatorios_gestao:   { label: 'Relatorio Gestao', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  relatorios_assistenciais: { label: 'Relatorio Assistencial', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  relatorios_financeiros: { label: 'Relatorio Financeiro', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  relatorios_qualidade: { label: 'Relatorio Qualidade', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  fluxogramas:         { label: 'Fluxograma',    color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  mapas_processos:     { label: 'Mapa de Processos', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  mapas_risco:         { label: 'Mapa de Risco', color: 'bg-destructive',      colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
  tabelas:             { label: 'Tabela',        color: 'bg-category-cyan',    colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
  regimentos:          { label: 'Regimento',     color: 'bg-category-blue',    colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  indicadores:         { label: 'Indicador',     color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  auditorias:          { label: 'Auditoria',     color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  atas:                { label: 'Ata',           color: 'bg-success',          colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  planos_acao:         { label: 'Plano de Acao', color: 'bg-category-cyan',    colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
  contratos:           { label: 'Contrato',      color: 'bg-category-purple',  colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  contratos_legais:    { label: 'Contrato Legal', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  acordos_processos:   { label: 'Acordos e Processos', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  // Tipos de relatorios de auditorias (antes só no mapa local do DocumentoCard)
  auditoria_consolidado_rops: { label: 'Consolidado ROPs', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
  auditoria_higiene_maos: { label: 'Higiene Maos',  color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
  auditoria_medicamentos: { label: 'Medicamentos',  color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
  auditoria_conformidade: { label: 'Conformidade',  color: 'bg-destructive',   colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
}

// Fallback neutro: rotula pelo TIPO_CONFIG (ou o proprio slug) em vez de
// fingir que todo tipo desconhecido e um "Protocolo".
export const getTipoDisplayConfig = (tipo) =>
  TIPO_DISPLAY_CONFIG[tipo] || {
    label: TIPO_CONFIG[tipo?.toLowerCase()]?.label || tipo || 'Documento',
    color: 'bg-muted-foreground',
    colorLight: 'bg-muted text-foreground',
  }

export const CLASSIFICACAO_ACESSO_OPTIONS = [
  { value: 'publico', label: 'Publico' },
  { value: 'interno', label: 'Interno' },
  { value: 'confidencial', label: 'Confidencial' },
  { value: 'restrito', label: 'Restrito' },
]

// ============================================================================
// SUBCATEGORIA CONFIG — Wave 4 / SSOT (single source of truth)
// ----------------------------------------------------------------------------
// Taxonomia documental user-facing (11 buckets) usada por:
//   - BibliotecaPage (accordions de navegação)
//   - CentroGestaoPage > DocumentSection > aba Categorias (cards de contagem)
//
// Diferente de CATEGORY_SUBSECTIONS (mapa subcategoria → tipos de documento),
// que detalha sub-tipos dentro de cada bucket.
//
// Ordem dos buckets é fixa: '00 Modelos' até '10 Obsoletos'.
// Ícones usam lucide-react — referência (não importada aqui para evitar
// circular dep): consumers importam o ícone separadamente via iconKey.
// ============================================================================

export const SUBCATEGORIA_CONFIG = Object.freeze({
  modelos:           { label: '00 Modelos',           iconKey: 'FilePlus2',     order: 1  },
  governanca:        { label: '01 Governança',        iconKey: 'Landmark',      order: 2  },
  institucional:     { label: '02 Institucional',     iconKey: 'Building2',     order: 3  },
  assistencial:      { label: '03 Assistencial',      iconKey: 'Stethoscope',   order: 4  },
  gestao_pessoas:    { label: '04 Gestão Pessoas',    iconKey: 'Users',         order: 5  },
  residencia:        { label: '05 Residência',        iconKey: 'GraduationCap', order: 6  },
  financeiro:        { label: '06 Financeiro',        iconKey: 'DollarSign',    order: 7  },
  qualidade:         { label: '07 Qualidade',         iconKey: 'BadgeCheck',    order: 8  },
  tecnologia_mat:    { label: '08 Tecnologia Mat',    iconKey: 'Cpu',           order: 9  },
  relatorios_gerais: { label: '09 Relatórios Gerais', iconKey: 'FileBarChart',  order: 10 },
  obsoletos:         { label: '10 Obsoletos',         iconKey: 'Archive',       order: 11 },
})

/** Lista ordenada de slugs (usar quando precisar iterar em ordem fixa) */
export const SUBCATEGORIA_SLUGS = Object.freeze(
  Object.entries(SUBCATEGORIA_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([slug]) => slug)
)

/** Helper: subcategoria slug é válida? */
export function isValidSubcategoria(slug) {
  return typeof slug === 'string' && slug in SUBCATEGORIA_CONFIG
}

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
  TIPO_DISPLAY_CONFIG,
  getTipoDisplayConfig,
}
