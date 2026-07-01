/**
 * Supabase Escala Anestesista Service — dicionário apelido↔login (identidade robusta).
 *
 * Resolve o anestesista da escala (apelido em CAIXA ALTA, ex.: GARIM, STAUB, PED EDUARDO)
 * para um login estável (`profiles.id`). Substitui o match por nome (anti-padrão).
 * O apelido é guardado NORMALIZADO (sem acento, sem prefixo "PED ", UPPER), então
 * "PED EDUARDO" e "EDUARDO" resolvem para o mesmo login.
 */
import { supabase } from '@/config/supabase'

/** Normaliza apelido p/ chave (acento/caixa/PED-insensível). Igual ao normNome da UI. */
export const normApelido = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*ped\s+/i, '')
    .trim()
    .toUpperCase()

function handleError(error, context) {
  console.error(`[SupabaseEscalaAnestesistaService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

function toCamel(row) {
  return row && {
    id: row.id,
    userId: row.user_id,
    apelido: row.apelido,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

/** Todos os apelidos (dicionário inteiro — tabela pequena). */
async function fetchAliases() {
  const { data, error } = await supabase
    .from('escala_anestesista_alias')
    .select('*')
    .order('apelido', { ascending: true })
  if (error) handleError(error, 'fetchAliases')
  return (data || []).map(toCamel)
}

/** Apelidos de um login específico (self-claim do anestesista). */
async function fetchAliasesByUser(userId) {
  const { data, error } = await supabase
    .from('escala_anestesista_alias')
    .select('*')
    .eq('user_id', userId)
    .order('apelido', { ascending: true })
  if (error) handleError(error, 'fetchAliasesByUser')
  return (data || []).map(toCamel)
}

/** Cria/atualiza um apelido → login (apelido é UNIQUE; reaponta se já existir). */
async function upsertAlias({ apelido, userId, createdBy = null }) {
  const ap = normApelido(apelido)
  if (!ap || !userId) throw new Error('apelido e userId obrigatórios')
  const { data, error } = await supabase
    .from('escala_anestesista_alias')
    .upsert({ apelido: ap, user_id: userId, created_by: createdBy }, { onConflict: 'apelido' })
    .select('*')
    .single()
  if (error) handleError(error, 'upsertAlias')
  return toCamel(data)
}

async function removeAlias(id) {
  const { error } = await supabase.from('escala_anestesista_alias').delete().eq('id', id)
  if (error) handleError(error, 'removeAlias')
}

/**
 * Constrói um resolvedor apelido→userId a partir da lista de aliases.
 * @param {Array} aliases  saída de fetchAliases()
 * @returns {(raw:string)=>string|null}
 */
export function buildResolver(aliases) {
  const map = new Map((aliases || []).map((a) => [normApelido(a.apelido), a.userId]))
  return (raw) => map.get(normApelido(raw)) || null
}

export default {
  fetchAliases,
  fetchAliasesByUser,
  upsertAlias,
  removeAlias,
  buildResolver,
  normApelido,
}
