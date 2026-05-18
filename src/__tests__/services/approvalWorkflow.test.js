import { describe, it, expect } from 'vitest'
import { APPROVAL_STATES, APPROVAL_EVENTS, approvalReducer, canTransition, availableEvents, createInitialState } from '../../services/approvalWorkflow'

describe('approvalWorkflow — state machine', () => {
  describe('createInitialState', () => {
    it('retorna draft + history vazio por padrão', () => {
      const s = createInitialState()
      expect(s).toEqual({ status: 'draft', history: [] })
    })
    it('aceita status custom', () => {
      const s = createInitialState(APPROVAL_STATES.PENDING)
      expect(s.status).toBe('pending')
    })
  })

  describe('canTransition', () => {
    it('aceita submit a partir de draft', () => {
      expect(canTransition({ status: 'draft' }, APPROVAL_EVENTS.SUBMIT)).toBe(true)
    })
    it('rejeita approve_step a partir de draft', () => {
      expect(canTransition({ status: 'draft' }, APPROVAL_EVENTS.APPROVE_STEP)).toBe(false)
    })
    it('rejeita qualquer evento a partir de approved (terminal)', () => {
      expect(canTransition({ status: 'approved' }, APPROVAL_EVENTS.SUBMIT)).toBe(false)
      expect(canTransition({ status: 'approved' }, APPROVAL_EVENTS.APPROVE_STEP)).toBe(false)
      expect(canTransition({ status: 'approved' }, APPROVAL_EVENTS.RESUBMIT)).toBe(false)
    })
    it('retorna false para state inválido', () => {
      expect(canTransition(null, APPROVAL_EVENTS.SUBMIT)).toBe(false)
      expect(canTransition({ status: 'draft' }, '')).toBe(false)
    })
  })

  describe('approvalReducer — transições válidas', () => {
    it('draft + submit → pending', () => {
      const s = approvalReducer(createInitialState(), { type: APPROVAL_EVENTS.SUBMIT })
      expect(s.status).toBe('pending')
      expect(s.history).toHaveLength(1)
    })

    it('pending + approve_step → in_review', () => {
      const s = approvalReducer({ status: 'pending', history: [] }, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(s.status).toBe('in_review')
    })

    it('in_review + approve_step → approved', () => {
      const s = approvalReducer({ status: 'in_review', history: [] }, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(s.status).toBe('approved')
    })

    it('pending + reject_step → rejected', () => {
      const s = approvalReducer({ status: 'pending', history: [] }, { type: APPROVAL_EVENTS.REJECT_STEP })
      expect(s.status).toBe('rejected')
    })

    it('in_review + reject_step → rejected', () => {
      const s = approvalReducer({ status: 'in_review', history: [] }, { type: APPROVAL_EVENTS.REJECT_STEP })
      expect(s.status).toBe('rejected')
    })

    it('rejected + resubmit → pending', () => {
      const s = approvalReducer({ status: 'rejected', history: [] }, { type: APPROVAL_EVENTS.RESUBMIT })
      expect(s.status).toBe('pending')
    })
  })

  describe('approvalReducer — transições inválidas (idempotência)', () => {
    it('draft + approve_step retorna mesmo state (sem mutação)', () => {
      const initial = createInitialState()
      const result = approvalReducer(initial, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(result).toBe(initial) // mesma referência
    })

    it('approved + qualquer evento retorna mesmo state', () => {
      const initial = { status: 'approved', history: [{ foo: 'bar' }] }
      expect(approvalReducer(initial, { type: APPROVAL_EVENTS.SUBMIT })).toBe(initial)
      expect(approvalReducer(initial, { type: APPROVAL_EVENTS.RESUBMIT })).toBe(initial)
    })

    it('event sem type não muta state', () => {
      const initial = createInitialState()
      expect(approvalReducer(initial, {})).toBe(initial)
    })

    it('event null não throwa', () => {
      const initial = createInitialState()
      expect(approvalReducer(initial, null)).toBe(initial)
    })
  })

  describe('approvalReducer — history', () => {
    it('append a cada transição válida', () => {
      let s = createInitialState()
      s = approvalReducer(s, { type: APPROVAL_EVENTS.SUBMIT })
      s = approvalReducer(s, { type: APPROVAL_EVENTS.APPROVE_STEP })
      s = approvalReducer(s, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(s.status).toBe('approved')
      expect(s.history).toHaveLength(3)
      expect(s.history[0].event.type).toBe('submit')
      expect(s.history[2].event.type).toBe('approve_step')
    })

    it('cada entrada de history tem timestamp', () => {
      const s = approvalReducer(createInitialState(), { type: APPROVAL_EVENTS.SUBMIT })
      expect(typeof s.history[0].ts).toBe('number')
      expect(s.history[0].ts).toBeGreaterThan(0)
    })

    it('preserva history em transições inválidas (mesma referência)', () => {
      const s1 = approvalReducer(createInitialState(), { type: APPROVAL_EVENTS.SUBMIT })
      const s2 = approvalReducer(s1, { type: APPROVAL_EVENTS.SUBMIT }) // já em pending, submit é inválido
      expect(s2).toBe(s1)
    })
  })

  describe('availableEvents', () => {
    it('lista submit em draft', () => {
      expect(availableEvents({ status: 'draft' })).toEqual(['submit'])
    })
    it('retorna array vazio em approved', () => {
      expect(availableEvents({ status: 'approved' })).toEqual([])
    })
    it('lista approve_step e reject_step em pending', () => {
      const events = availableEvents({ status: 'pending' })
      expect(events).toContain('approve_step')
      expect(events).toContain('reject_step')
    })
    it('retorna array vazio para state nulo', () => {
      expect(availableEvents(null)).toEqual([])
    })
  })

  describe('fluxo completo end-to-end', () => {
    it('draft → pending → in_review → approved', () => {
      let s = createInitialState()
      s = approvalReducer(s, { type: APPROVAL_EVENTS.SUBMIT })
      expect(s.status).toBe('pending')
      s = approvalReducer(s, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(s.status).toBe('in_review')
      s = approvalReducer(s, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(s.status).toBe('approved')
    })

    it('draft → pending → rejected → pending → approved (após resubmit)', () => {
      let s = createInitialState()
      s = approvalReducer(s, { type: APPROVAL_EVENTS.SUBMIT })
      s = approvalReducer(s, { type: APPROVAL_EVENTS.REJECT_STEP })
      expect(s.status).toBe('rejected')
      s = approvalReducer(s, { type: APPROVAL_EVENTS.RESUBMIT })
      expect(s.status).toBe('pending')
      s = approvalReducer(s, { type: APPROVAL_EVENTS.APPROVE_STEP })
      s = approvalReducer(s, { type: APPROVAL_EVENTS.APPROVE_STEP })
      expect(s.status).toBe('approved')
      expect(s.history).toHaveLength(5)
    })
  })
})
