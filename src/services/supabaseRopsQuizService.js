/**
 * Supabase ROPs Quiz Service
 *
 * Persiste resultados de quiz e calcula ranking dos participantes.
 * Segue o padrao de supabaseUsersService.js.
 */
import { supabase } from '@/config/supabase'

// Role key -> display label (SSOT from CLAUDE.md)
const ROLE_LABELS = {
  anestesiologista: 'Anestesiologista',
  'medico-residente': 'Medico Residente',
  enfermeiro: 'Enfermeiro',
  'tec-enfermagem': 'Tec. Enfermagem',
  farmaceutico: 'Farmaceutico',
  colaborador: 'Colaborador',
  secretaria: 'Secretaria',
}

function handleError(error, context) {
  console.error(`[SupabaseRopsQuizService] ${context}:`, error)
  throw new Error(`${context}: ${error.message || 'Erro desconhecido'}`)
}

/**
 * Salva resultado de quiz na tabela rops_quiz_results.
 */
async function saveQuizResult({ userId, areaKey, ropKey, correct, total, percentage, points }) {
  const { data, error } = await supabase
    .from('rops_quiz_results')
    .insert({
      user_id: userId,
      area_key: areaKey,
      rop_key: ropKey,
      correct,
      total,
      percentage,
      points,
    })
    .select()
    .single()

  if (error) handleError(error, 'saveQuizResult')
  return data
}

/**
 * Busca ranking via RPC server-side.
 * Retorna array formatado para o componente Leaderboard.
 */
async function getRanking(period = 'all') {
  const { data, error } = await supabase.rpc('get_rops_ranking', { period })

  if (error) handleError(error, 'getRanking')

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    score: Number(row.score),
    subtitle: ROLE_LABELS[row.subtitle] || row.subtitle,
    quiz_count: Number(row.quiz_count),
    rank: Number(row.rank),
    avatar: null,
    trend: 0,
  }))
}

/**
 * Busca stats do usuario: total de pontos, quantidade de quizzes e posicao no ranking.
 */
async function getUserStats(userId) {
  // Aggregate user's own results
  const { data, error } = await supabase
    .from('rops_quiz_results')
    .select('points')
    .eq('user_id', userId)

  if (error) handleError(error, 'getUserStats')

  const rows = data || []
  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0)
  const quizCount = rows.length

  // Get position by counting users with more points
  let position = 1
  if (totalPoints > 0) {
    const { data: rankData, error: rankError } = await supabase
      .rpc('get_rops_ranking', { period: 'all' })

    if (!rankError && rankData) {
      const entry = rankData.find((r) => r.id === userId)
      if (entry) position = Number(entry.rank)
    }
  }

  return { position, totalPoints, quizCount }
}

const supabaseRopsQuizService = {
  saveQuizResult,
  getRanking,
  getUserStats,
}

export default supabaseRopsQuizService
