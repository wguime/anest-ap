/**
 * Tests dos helpers puros da fila offline do Desafio do Dia (ROPs).
 * src/utils/ropsAnswerQueue.js — sem IDB/Supabase, lógica 100% pura.
 */
import { describe, it, expect } from 'vitest'
import {
  ROPS_SUBMIT_DAILY_ANSWER_OP,
  isDuplicateAnswerError,
  isNetworkError,
  hasPendingDailyAnswer,
} from '../../utils/ropsAnswerQueue'

describe('ropsAnswerQueue', () => {
  describe('isDuplicateAnswerError', () => {
    it('detecta a exception do RPC (questão já respondida)', () => {
      expect(
        isDuplicateAnswerError(
          new Error('submit_daily_challenge_answer: questão já respondida neste desafio')
        )
      ).toBe(true)
    })

    it('detecta mesmo quando a mensagem foi re-embrulhada com contexto', () => {
      expect(
        isDuplicateAnswerError(new Error('submitDailyChallengeAnswer: questão já respondida neste desafio'))
      ).toBe(true)
    })

    it('é case-insensitive', () => {
      expect(isDuplicateAnswerError(new Error('Questão JÁ RESPONDIDA'))).toBe(true)
    })

    it('não dispara para outros erros', () => {
      expect(isDuplicateAnswerError(new Error('challenge não encontrado'))).toBe(false)
      expect(isDuplicateAnswerError(new Error('Failed to fetch'))).toBe(false)
    })

    it('tolera null/undefined/objeto sem message', () => {
      expect(isDuplicateAnswerError(null)).toBe(false)
      expect(isDuplicateAnswerError(undefined)).toBe(false)
      expect(isDuplicateAnswerError({})).toBe(false)
    })
  })

  describe('isNetworkError', () => {
    it('detecta falha de fetch sem code PostgREST', () => {
      expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
      expect(isNetworkError(new Error('NetworkError when attempting to fetch resource'))).toBe(true)
      expect(isNetworkError(new Error('network request failed'))).toBe(true)
    })

    it('NÃO trata erro com code PostgREST como rede (business/RLS)', () => {
      const err = new Error('Failed to fetch') // mensagem ambígua, mas tem code
      err.code = 'PGRST116'
      expect(isNetworkError(err)).toBe(false)

      const rls = new Error('new row violates row-level security policy')
      rls.code = '42501'
      expect(isNetworkError(rls)).toBe(false)
    })

    it('não dispara para erro de business sem padrão de rede', () => {
      expect(isNetworkError(new Error('questão já respondida neste desafio'))).toBe(false)
    })

    it('tolera null/undefined/objeto sem message', () => {
      expect(isNetworkError(null)).toBe(false)
      expect(isNetworkError(undefined)).toBe(false)
      expect(isNetworkError({})).toBe(false)
    })
  })

  describe('hasPendingDailyAnswer', () => {
    const item = (challengeId, questionId, op = ROPS_SUBMIT_DAILY_ANSWER_OP) => ({
      id: 1,
      op,
      payload: { challengeId, questionId, selectedOption: 2, userId: 'uid-1' },
    })

    it('encontra item pendente com mesmo challengeId+questionId', () => {
      const queue = [item('ch-1', 'q-1'), item('ch-1', 'q-2')]
      expect(hasPendingDailyAnswer(queue, { challengeId: 'ch-1', questionId: 'q-2' })).toBe(true)
    })

    it('NÃO deduplica questão diferente do mesmo challenge', () => {
      const queue = [item('ch-1', 'q-1')]
      expect(hasPendingDailyAnswer(queue, { challengeId: 'ch-1', questionId: 'q-9' })).toBe(false)
    })

    it('NÃO deduplica mesmo questionId em challenge diferente (outro dia)', () => {
      const queue = [item('ch-ontem', 'q-1')]
      expect(hasPendingDailyAnswer(queue, { challengeId: 'ch-hoje', questionId: 'q-1' })).toBe(false)
    })

    it('ignora itens de outras ops (comunicados, planos etc.)', () => {
      const queue = [item('ch-1', 'q-1', 'comunicado.confirmLeitura')]
      expect(hasPendingDailyAnswer(queue, { challengeId: 'ch-1', questionId: 'q-1' })).toBe(false)
    })

    it('tolera fila vazia/null e payload incompleto', () => {
      expect(hasPendingDailyAnswer([], { challengeId: 'ch-1', questionId: 'q-1' })).toBe(false)
      expect(hasPendingDailyAnswer(null, { challengeId: 'ch-1', questionId: 'q-1' })).toBe(false)
      expect(hasPendingDailyAnswer([item('ch-1', 'q-1')], {})).toBe(false)
      expect(hasPendingDailyAnswer([item('ch-1', 'q-1')])).toBe(false)
      expect(hasPendingDailyAnswer([{ op: ROPS_SUBMIT_DAILY_ANSWER_OP, payload: null }], { challengeId: 'ch-1', questionId: 'q-1' })).toBe(false)
    })
  })
})
