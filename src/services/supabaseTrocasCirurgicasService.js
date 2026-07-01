/**
 * Supabase Trocas Cirúrgicas Service — troca de sala entre anestesistas.
 *
 * Ciclo propor → aceitar (RPC atômica de swap dos casos) / recusar / cancelar.
 * As liberações re-derivam sozinhas dos casos após o swap (nada de override).
 */
import { supabase } from '@/config/supabase'

const CAMEL_TO_SNAKE = {
  escalaId: 'escala_id', salaA: 'sala_a', salaB: 'sala_b', uidA: 'uid_a', uidB: 'uid_b',
  aliasA: 'alias_a', aliasB: 'alias_b', solicitadoPor: 'solicitado_por',
  respondidoPor: 'respondido_por', respondidoEm: 'respondido_em', aplicadaEm: 'aplicada_em',
  createdAt: 'created_at', updatedAt: 'updated_at',
}
const SNAKE_TO_CAMEL = Object.fromEntries(Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k]))

function toCamel(row) {
  if (!row) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) out[SNAKE_TO_CAMEL[k] || k] = v
  return out
}
function toSnake(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[CAMEL_TO_SNAKE[k] || k] = v
  return out
}
function handleError(error, context) {
  console.error(`[SupabaseTrocasCirurgicasService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

/** Trocas pendentes de um conjunto de escalas (data corrente). */
async function fetchTrocasPendentes(escalaIds = []) {
  if (!escalaIds.length) return []
  const { data, error } = await supabase
    .from('trocas_cirurgicas')
    .select('*')
    .in('escala_id', escalaIds)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
  if (error) handleError(error, 'fetchTrocasPendentes')
  return (data || []).map(toCamel)
}

/** Cria uma proposta de troca (status pendente). */
async function propoTroca(payload) {
  const row = toSnake({ ...payload, status: 'pendente' })
  const { data, error } = await supabase.from('trocas_cirurgicas').insert(row).select('*').single()
  if (error) handleError(error, 'propoTroca')
  return toCamel(data)
}

/** Aceita a troca → RPC atômica (o ator é o firebase_uid() no servidor). */
async function aceitarTroca(trocaId) {
  const { error } = await supabase.rpc('aplicar_troca_cirurgica', { p_troca_id: trocaId })
  if (error) handleError(error, 'aceitarTroca')
}

async function recusarTroca(trocaId, uidResposta) {
  const { error } = await supabase
    .from('trocas_cirurgicas')
    .update({ status: 'recusada', respondido_por: uidResposta, respondido_em: new Date().toISOString() })
    .eq('id', trocaId)
  if (error) handleError(error, 'recusarTroca')
}

async function cancelarTroca(trocaId) {
  const { error } = await supabase.from('trocas_cirurgicas').update({ status: 'cancelada' }).eq('id', trocaId)
  if (error) handleError(error, 'cancelarTroca')
}

export default { fetchTrocasPendentes, propoTroca, aceitarTroca, recusarTroca, cancelarTroca }
