/**
 * Helpers puros da fila offline de respostas do Desafio do Dia (ROPs).
 *
 * O fluxo reaproveita a infra IDB existente (src/utils/offlineQueue.js +
 * src/services/offlineQueueProcessor.js + useOfflineQueueFlush montado 1x no
 * App): em falha de rede o submit é enfileirado e re-enviado no evento
 * `window 'online'` e no mount (App + página do desafio).
 *
 * Este módulo concentra APENAS a lógica pura (testável sem IDB/Supabase):
 *  - identificação de erro de duplicata do RPC (idempotente server-side)
 *  - identificação de erro de rede (elegível a enqueue)
 *  - dedupe local por challengeId+questionId
 *
 * LGPD: o payload enfileirado contém só challengeId/questionId/selectedOption/
 * timeSeconds/userId — nenhum dado sensível extra.
 */

export const ROPS_SUBMIT_DAILY_ANSWER_OP = 'rops.submitDailyChallengeAnswer'

/**
 * O RPC submit_daily_challenge_answer levanta exception com a mensagem
 * 'questão já respondida neste desafio' quando há replay (anti-duplicate
 * server-side por user+challenge+question). Num flush offline isso significa
 * que o server JÁ registrou a resposta → tratar como sucesso.
 */
export function isDuplicateAnswerError(err) {
  return /já respondida/i.test(err?.message || '')
}

/**
 * Mesmo critério do supabaseComunicadosService: erro sem `code` PostgREST e
 * mensagem de fetch/network → falha de transporte, elegível pra fila offline.
 * Erros de RLS/business (têm `code` ou mensagem específica) NÃO enfileiram.
 */
export function isNetworkError(err) {
  return Boolean(err) && !err.code && /fetch|network|failed/i.test(err.message || '')
}

/**
 * Dedupe local: já existe item pendente para a mesma questão do mesmo
 * challenge? O challenge é único por (user, dia UTC) ⇒ equivale a dedupe
 * por questionId+dia por usuário.
 *
 * @param {Array<{op: string, payload: object}>} queueItems — itens de peekAll()
 * @param {{challengeId?: string, questionId?: string}} payload
 */
export function hasPendingDailyAnswer(queueItems, { challengeId, questionId } = {}) {
  if (!challengeId || !questionId) return false
  return (queueItems || []).some(
    (item) =>
      item?.op === ROPS_SUBMIT_DAILY_ANSWER_OP &&
      item?.payload?.challengeId === challengeId &&
      item?.payload?.questionId === questionId
  )
}
