/**
 * Approval Workflow — State Machine
 *
 * Reducer puro (sem side effects, sem deps externas) que governa transições
 * de status no workflow de aprovação multi-step. Usado tanto no client (UI
 * otimista) quanto em testes; o source of truth no servidor é a função RPC
 * `advance_approval_step` definida na migration 20260505600000.
 *
 * Estados:
 *   draft      — documento criado, sem submissão
 *   pending    — submetido, aguardando primeiro step
 *   in_review  — pelo menos um step aprovado, ainda em andamento
 *   approved   — todos os steps aprovados (terminal)
 *   rejected   — algum step rejeitou (não-terminal: aceita resubmit)
 *
 * Eventos:
 *   submit         — draft → pending
 *   approve_step   — pending → in_review, in_review → approved
 *   reject_step    — pending → rejected, in_review → rejected
 *   resubmit       — rejected → pending
 *
 * O reducer é idempotente: eventos inválidos retornam o mesmo state (nenhum
 * throw, nenhum log) — evita exceptions em re-renders.
 */

export const APPROVAL_STATES = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

export const APPROVAL_EVENTS = Object.freeze({
  SUBMIT: 'submit',
  APPROVE_STEP: 'approve_step',
  REJECT_STEP: 'reject_step',
  RESUBMIT: 'resubmit',
})

const TRANSITIONS = Object.freeze({
  draft: { submit: 'pending' },
  pending: { approve_step: 'in_review', reject_step: 'rejected' },
  in_review: { approve_step: 'approved', reject_step: 'rejected' },
  rejected: { resubmit: 'pending' },
  approved: {}, // terminal
})

/**
 * Aplica um evento ao state. Retorna novo state ou o mesmo se a transição
 * for inválida (idempotência defensiva).
 *
 * @param {{status: string, history?: Array}} state
 * @param {{type: string, [key: string]: any}} event
 * @returns {{status: string, history: Array}}
 */
export function approvalReducer(state, event) {
  if (!state || !event || typeof event.type !== 'string') return state
  const next = TRANSITIONS[state.status]?.[event.type]
  if (!next) return state
  return {
    ...state,
    status: next,
    history: [...(state.history || []), { event, ts: Date.now() }],
  }
}

/**
 * Predicate: a transição é legal a partir do state atual?
 * @param {{status: string}} state
 * @param {string} eventType
 * @returns {boolean}
 */
export function canTransition(state, eventType) {
  if (!state || typeof eventType !== 'string') return false
  return Boolean(TRANSITIONS[state.status]?.[eventType])
}

/**
 * Helper: retorna lista de eventos válidos a partir do state atual.
 * Útil para habilitar/desabilitar botões na UI.
 * @param {{status: string}} state
 * @returns {string[]}
 */
export function availableEvents(state) {
  if (!state) return []
  return Object.keys(TRANSITIONS[state.status] || {})
}

/**
 * Helper: cria state inicial canônico.
 * @param {string} [status=APPROVAL_STATES.DRAFT]
 */
export function createInitialState(status = APPROVAL_STATES.DRAFT) {
  return { status, history: [] }
}

export default {
  APPROVAL_STATES,
  APPROVAL_EVENTS,
  approvalReducer,
  canTransition,
  availableEvents,
  createInitialState,
}
