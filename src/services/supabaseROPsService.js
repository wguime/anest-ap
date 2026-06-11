/**
 * Supabase ROPs Service — Wave 1.6
 *
 * Substitui import estático de src/data/rops-data.js (7295 LOC mock) por
 * leitura/escrita do Supabase. Suporta:
 *   - Catálogo: áreas, subdivisões, questões (versionadas append-only)
 *   - Tentativas individuais (rop_user_attempts) com snapshot da versão
 *   - Desafio do dia (rop_daily_challenges) idempotente por (user, date_utc)
 *   - Ranking semanal/mensal/all-time (LGPD: caller decide exposição)
 *   - Streak compartilhado com Wave 1.1 (record_user_activity_day)
 *   - Audit trail via rpc_log_rop_action (requireUserId)
 *
 * Padrão: supabaseIncidentsService.js (throw on error, snake↔camel inline).
 *
 * Plan: docs/planejamento-melhorias-2026-05-16.md Wave 1.6 T1.6.3.
 */
import { supabase } from '@/config/supabase'
import { requireUserId, tryRequireUserId } from '@/utils/audit'
import { enqueue as enqueueOffline, peekAll } from '@/utils/offlineQueue'
import { registerHandler } from '@/services/offlineQueueProcessor'
import {
  ROPS_SUBMIT_DAILY_ANSWER_OP,
  isDuplicateAnswerError,
  isNetworkError,
  hasPendingDailyAnswer,
} from '@/utils/ropsAnswerQueue'

// ============================================================================
// FIELD MAPPING — camelCase ↔ snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  areaId: 'area_id',
  categoryToken: 'category_token',
  displayOrder: 'display_order',
  isActive: 'is_active',
  isCurrent: 'is_current',
  isCorrect: 'is_correct',
  subdivisaoId: 'subdivisao_id',
  questionKey: 'question_key',
  versionNum: 'version_num',
  questionText: 'question_text',
  correctAnswerIndex: 'correct_answer_index',
  sourceCitation: 'source_citation',
  questionId: 'question_id',
  selectedOption: 'selected_option',
  timeSeconds: 'time_seconds',
  challengeId: 'challenge_id',
  userId: 'user_id',
  dateUtc: 'date_utc',
  questionIds: 'question_ids',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  scoreCorrect: 'score_correct',
  scoreTotal: 'score_total',
  scorePct: 'score_pct',
  audioUrl: 'audio_url',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  createdBy: 'created_by',
}
const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toCamel(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamel)
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[SNAKE_TO_CAMEL[k] || k] = v
  }
  return out
}

function handleError(error, context) {
  console.error(`[SupabaseROPsService] ${context}:`, error)
  throw new Error(`${context}: ${error?.message || 'erro desconhecido'}`)
}

// ============================================================================
// AUDIT — privado, segue padrão supabaseDocumentService.logAction
// ============================================================================

async function logRopAction(action, targetKind, targetId, payload, user) {
  try {
    const { error } = await supabase.rpc('rpc_log_rop_action', {
      p_action: action,
      p_target_kind: targetKind,
      p_target_id: targetId,
      p_payload: payload || {},
      p_user_name: user?.userName || null,
      p_user_email: user?.userEmail || null,
    })
    if (error) console.warn('[SupabaseROPsService] logRopAction (non-fatal):', error.message)
  } catch (e) {
    console.warn('[SupabaseROPsService] logRopAction threw (non-fatal):', e.message)
  }
}

// ============================================================================
// CATÁLOGO (read-only para users)
// ============================================================================

async function fetchAreas() {
  const { data, error } = await supabase
    .from('rop_areas')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) handleError(error, 'fetchAreas')
  return (data || []).map(toCamel)
}

async function fetchSubdivisoes(areaId) {
  let query = supabase
    .from('rop_subdivisoes')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (areaId) query = query.eq('area_id', areaId)
  const { data, error } = await query
  if (error) handleError(error, 'fetchSubdivisoes')
  return (data || []).map(toCamel)
}

async function fetchSubdivisoesByAreaSlug(slug) {
  const { data, error } = await supabase
    .from('rop_subdivisoes')
    .select('*, area:rop_areas!inner(slug)')
    .eq('is_active', true)
    .eq('area.slug', slug)
    .order('display_order', { ascending: true })
  if (error) handleError(error, 'fetchSubdivisoesByAreaSlug')
  return (data || []).map(toCamel)
}

async function fetchQuestionsBySubdivisao(subdivisaoId) {
  const { data, error } = await supabase
    .from('rop_questions')
    .select('*')
    .eq('subdivisao_id', subdivisaoId)
    .eq('is_current', true)
    .order('question_key', { ascending: true })
  if (error) handleError(error, 'fetchQuestionsBySubdivisao')
  return (data || []).map(toCamel)
}

async function fetchQuestionsBySubdivisaoSlug(areaSlug, subSlug) {
  const { data, error } = await supabase
    .from('rop_questions')
    .select('*, subdivisao:rop_subdivisoes!inner(slug, title, area:rop_areas!inner(slug, title))')
    .eq('is_current', true)
    .eq('subdivisao.slug', subSlug)
    .eq('subdivisao.area.slug', areaSlug)
    .order('question_key', { ascending: true })
  if (error) handleError(error, 'fetchQuestionsBySubdivisaoSlug')
  return (data || []).map(toCamel)
}

async function fetchQuestionsByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('rop_questions')
    .select('*')
    .in('id', ids)
  if (error) handleError(error, 'fetchQuestionsByIds')
  // Preserva ordem dos ids passados (Postgres não garante order em IN)
  const byId = new Map((data || []).map((r) => [r.id, toCamel(r)]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

// ============================================================================
// TENTATIVAS INDIVIDUAIS (rop_user_attempts) — modo quiz tradicional
// ============================================================================

async function recordAttempt({ questionId, selectedOption, timeSeconds, context = 'quiz' }, userInfo) {
  const user = requireUserId(userInfo, 'recordAttempt')

  // Carrega questão para descobrir resposta correta (server-side seria mais
  // seguro mas RLS bloqueia INSERT forjado e seleciona apenas current=true)
  const { data: q, error: qErr } = await supabase
    .from('rop_questions')
    .select('id, correct_answer_index, explanation')
    .eq('id', questionId)
    .single()
  if (qErr) handleError(qErr, 'recordAttempt:fetchQuestion')

  const isCorrect = selectedOption === q.correct_answer_index

  const { data, error } = await supabase
    .from('rop_user_attempts')
    .insert({
      user_id: user.userId,
      question_id: questionId,
      selected_option: selectedOption,
      is_correct: isCorrect,
      time_seconds: timeSeconds ?? null,
      context,
    })
    .select()
    .single()
  if (error) handleError(error, 'recordAttempt')

  // Streak share + audit (não-bloqueantes)
  if (context !== 'review') {
    await recordActivity('desafio_rop').catch(() => {})
  }
  await logRopAction('attempt.recorded', 'attempt', data.id, { isCorrect, context }, user)

  return {
    ...toCamel(data),
    correctAnswerIndex: q.correct_answer_index,
    explanation: q.explanation,
  }
}

async function recordActivity(source = 'desafio_rop') {
  const { data, error } = await supabase.rpc('record_user_activity_day', { p_source: source })
  if (error) {
    console.warn('[SupabaseROPsService] recordActivity (non-fatal):', error.message)
    return null
  }
  return data
}

// ============================================================================
// DESAFIO DO DIA (rop_daily_challenges) — idempotente por (user, date_utc)
// ============================================================================

async function getOrCreateDailyChallenge({ dateUtc, size = 10 } = {}) {
  const { data, error } = await supabase.rpc('get_or_create_daily_challenge', {
    p_date_utc: dateUtc || null,
    p_size: size,
  })
  if (error) handleError(error, 'getOrCreateDailyChallenge')

  // RPC retorna jsonb com snake_case (question_ids, score_pct, ...)
  return toCamel(data)
}

/**
 * Fetch-only variant: NÃO cria nada se ainda não existe. Usado em previews
 * (home card) onde não queremos pré-alocar as questões do dia.
 */
async function fetchTodayChallengeIfExists(userInfo) {
  const user = tryRequireUserId(userInfo, 'fetchTodayChallengeIfExists')
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('rop_daily_challenges')
    .select('*')
    .eq('user_id', user.userId)
    .eq('date_utc', today)
    .maybeSingle()

  if (error) {
    console.warn('[SupabaseROPsService] fetchTodayChallengeIfExists (non-fatal):', error.message)
    return null
  }
  return data ? toCamel(data) : null
}

/**
 * Core do submit — chamado direto (online) E pelo flush da fila offline.
 * payload: { challengeId, questionId, selectedOption, timeSeconds, userId }
 * (`userId` serve só pra dedupe/rastreio local — o RPC valida a identidade
 * server-side via firebase_uid()).
 *
 * Duplicata ('questão já respondida') é tratada como SUCESSO: o RPC tem
 * anti-duplicate por (user, challenge, question), então um replay que bate
 * nessa exception significa que o server já registrou a resposta — o item
 * sai da fila sem reenviar.
 */
async function _doSubmitDailyChallengeAnswer({ challengeId, questionId, selectedOption, timeSeconds }) {
  const { data, error } = await supabase.rpc('submit_daily_challenge_answer', {
    p_challenge_id: challengeId,
    p_question_id: questionId,
    p_selected: selectedOption,
    p_time_sec: timeSeconds ?? null,
  })
  if (error) {
    if (isDuplicateAnswerError(error)) return { duplicate: true }
    // Throw cru (preserva error.code) — o offlineQueueProcessor usa o code
    // pra decidir entre conflict path e markFailed+backoff.
    throw error
  }
  // RPC já chama record_user_activity_day('desafio_rop') internamente
  return toCamel(data)
}

// Fila offline (infra Sprint 10/F6.2): o flush roda no mount do App e no
// evento `window 'online'` via useOfflineQueueFlush (listener com cleanup).
registerHandler(ROPS_SUBMIT_DAILY_ANSWER_OP, _doSubmitDailyChallengeAnswer)

// Enfileira com dedupe local por challengeId+questionId — não re-enfileira a
// mesma resposta duas vezes (server-side dedupe cobre o restante).
async function _enqueueDailyAnswerOnce(payload) {
  let pending = []
  try {
    pending = await peekAll()
  } catch {
    // IDB indisponível pra leitura — segue pro enqueue (que falha alto se IDB off)
  }
  if (hasPendingDailyAnswer(pending, payload)) return { queued: true, deduped: true }
  await enqueueOffline({ op: ROPS_SUBMIT_DAILY_ANSWER_OP, payload })
  return { queued: true }
}

async function submitDailyChallengeAnswer({ challengeId, questionId, selectedOption, timeSeconds }, userInfo) {
  // requireUserId pra falhar early — RPC também checa server-side.
  // NUNCA fallback 'system'/'admin' (rule: audit-trail.md).
  const user = requireUserId(userInfo, 'submitDailyChallengeAnswer')
  const payload = {
    challengeId,
    questionId,
    selectedOption,
    timeSeconds: timeSeconds ?? null,
    userId: user.userId,
  }

  // Offline declarado: enfileira e devolve resposta otimista.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      return await _enqueueDailyAnswerOnce(payload)
    } catch (err) {
      handleError(err, 'submitDailyChallengeAnswer.enqueue')
    }
  }

  try {
    return await _doSubmitDailyChallengeAnswer(payload)
  } catch (error) {
    // Falha de transporte (sem code PostgREST): enfileira pra reenvio.
    if (isNetworkError(error)) {
      try {
        return await _enqueueDailyAnswerOnce(payload)
      } catch (enqErr) {
        handleError(enqErr, 'submitDailyChallengeAnswer.enqueue')
      }
    }
    handleError(error, 'submitDailyChallengeAnswer')
  }
}

async function fetchDailyChallengeHistory(userInfo, { limit = 30 } = {}) {
  const user = tryRequireUserId(userInfo, 'fetchDailyChallengeHistory')
  if (!user) return []

  const { data, error } = await supabase
    .from('rop_daily_challenges')
    .select('*')
    .eq('user_id', user.userId)
    .order('date_utc', { ascending: false })
    .limit(limit)
  if (error) handleError(error, 'fetchDailyChallengeHistory')
  return (data || []).map(toCamel)
}

// ============================================================================
// STATS + RANKING
// ============================================================================

async function getUserStats(userInfo) {
  const user = tryRequireUserId(userInfo, 'getUserStats')
  if (!user) return { totalCorrect: 0, totalAttempts: 0, accuracy: 0, position: null }

  const { data, error } = await supabase
    .from('rop_user_attempts')
    .select('is_correct')
    .eq('user_id', user.userId)
  if (error) handleError(error, 'getUserStats')

  const rows = data || []
  const totalCorrect = rows.filter((r) => r.is_correct).length
  const totalAttempts = rows.length
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0

  // Posição via ranking (LGPD: leitura própria sempre permitida)
  let position = null
  if (totalAttempts > 0) {
    try {
      const ranking = await getRanking('all')
      const entry = ranking.find((r) => r.id === user.userId)
      if (entry) position = entry.rank
    } catch {
      // Ranking pode falhar (e.g. sem permissão); não bloquear stats pessoais
    }
  }

  return { totalCorrect, totalAttempts, accuracy, position }
}

async function getStreak(userInfo) {
  // Reaproveita RPC Wave 1.1 — fonte única de verdade UTC
  const user = tryRequireUserId(userInfo, 'getStreak')
  if (!user) return { streak: 0, longestStreak: 0 }

  const { data, error } = await supabase.rpc('get_user_streak')
  if (error) {
    console.warn('[SupabaseROPsService] getStreak (non-fatal):', error.message)
    return { streak: 0, longestStreak: 0 }
  }
  // RPC retorna int direto (não jsonb) — wrap pra padronizar
  return { streak: Number(data) || 0, longestStreak: 0 }
}

async function getRanking(period = 'all') {
  const { data, error } = await supabase.rpc('get_rops_ranking', { p_period: period })
  if (error) handleError(error, 'getRanking')
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    score: Number(row.score),
    quizCount: Number(row.quiz_count),
    rank: Number(row.rank),
  }))
}

// ============================================================================
// ADMIN (mutations de catálogo — RLS exige is_admin)
// ============================================================================

async function createOrUpdateQuestion({ id, subdivisaoId, questionKey, questionText, options, correctAnswerIndex, explanation, difficulty, sourceCitation }, userInfo) {
  const user = requireUserId(userInfo, 'createOrUpdateQuestion')

  if (id) {
    // Edit = nova versão (append-only). Marca current=false na atual,
    // insere v+1 como current=true.
    const { data: current, error: curErr } = await supabase
      .from('rop_questions')
      .select('id, version_num')
      .eq('subdivisao_id', subdivisaoId)
      .eq('question_key', questionKey)
      .eq('is_current', true)
      .maybeSingle()
    if (curErr) handleError(curErr, 'createOrUpdateQuestion:fetchCurrent')

    const nextVersion = (current?.version_num || 0) + 1

    if (current) {
      const { error: upErr } = await supabase
        .from('rop_questions')
        .update({ is_current: false })
        .eq('id', current.id)
      if (upErr) handleError(upErr, 'createOrUpdateQuestion:demoteOld')
    }

    const { data: inserted, error: insErr } = await supabase
      .from('rop_questions')
      .insert({
        subdivisao_id: subdivisaoId,
        question_key: questionKey,
        version_num: nextVersion,
        is_current: true,
        question_text: questionText,
        options,
        correct_answer_index: correctAnswerIndex,
        explanation,
        difficulty: difficulty || 'medium',
        source_citation: sourceCitation || null,
        created_by: user.userId,
      })
      .select()
      .single()
    if (insErr) handleError(insErr, 'createOrUpdateQuestion:insertNewVersion')

    await logRopAction('question.versioned', 'question', inserted.id, { versionNum: nextVersion, previousVersionId: current?.id }, user)
    return toCamel(inserted)
  }

  // Criação nova
  const { data: inserted, error: insErr } = await supabase
    .from('rop_questions')
    .insert({
      subdivisao_id: subdivisaoId,
      question_key: questionKey,
      version_num: 1,
      is_current: true,
      question_text: questionText,
      options,
      correct_answer_index: correctAnswerIndex,
      explanation,
      difficulty: difficulty || 'medium',
      source_citation: sourceCitation || null,
      created_by: user.userId,
    })
    .select()
    .single()
  if (insErr) handleError(insErr, 'createOrUpdateQuestion:insertNew')

  await logRopAction('question.created', 'question', inserted.id, { versionNum: 1 }, user)
  return toCamel(inserted)
}

// ============================================================================
// PUBLIC API
// ============================================================================

const supabaseROPsService = {
  // catálogo
  fetchAreas,
  fetchSubdivisoes,
  fetchSubdivisoesByAreaSlug,
  fetchQuestionsBySubdivisao,
  fetchQuestionsBySubdivisaoSlug,
  fetchQuestionsByIds,
  // tentativas
  recordAttempt,
  recordActivity,
  // desafio do dia
  getOrCreateDailyChallenge,
  fetchTodayChallengeIfExists,
  submitDailyChallengeAnswer,
  fetchDailyChallengeHistory,
  // stats + ranking
  getUserStats,
  getStreak,
  getRanking,
  // admin
  createOrUpdateQuestion,
}

export default supabaseROPsService
export {
  fetchAreas,
  fetchSubdivisoes,
  fetchSubdivisoesByAreaSlug,
  fetchQuestionsBySubdivisao,
  fetchQuestionsBySubdivisaoSlug,
  fetchQuestionsByIds,
  recordAttempt,
  recordActivity,
  getOrCreateDailyChallenge,
  fetchTodayChallengeIfExists,
  submitDailyChallengeAnswer,
  fetchDailyChallengeHistory,
  getUserStats,
  getStreak,
  getRanking,
  createOrUpdateQuestion,
}
