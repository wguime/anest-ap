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

// Preserva `code` no erro lançado: quem chama precisa distinguir FALTA DE
// PERMISSÃO (42501 — a RLS deixa cada um vincular só o próprio login) de erro
// genérico, porque a saída para o usuário é diferente. Sem isto sobrava só a
// mensagem, e a importação tratava os dois casos igual.
function handleError(error, context) {
  console.error(`[SupabaseEscalaAnestesistaService] ${context}:`, error)
  const err = new Error(`${context}: ${error.message}`)
  err.code = error.code
  err.status = error.status
  throw err
}

/**
 * O texto é o apelido de UMA PESSOA? (guardrail do incidente 02/09)
 *
 * A conferência aprende apelido→login sozinha quando o nome importado é
 * desconhecido do dicionário. O texto do grupo, porém, nem sempre é um apelido:
 * "GABRIELA + ?" é uma DUPLA com o segundo nome ainda por decidir, e aprendê-lo
 * como apelido do Oscar (que foi quem o dono escolheu naquela sala) fez o
 * dicionário rebatizar o Oscar: `fetchAliases` ordena por apelido e o roster usa
 * `apelidos[0]` como rótulo, então "GABRIELA + ?" (G < O) passou a ser o nome do
 * Oscar em TODA escrita — o quadro seguia mostrando Gabriela onde o login já era
 * dele, e trocar o responsável parecia não funcionar.
 *
 * Recusa: dupla ("A + B"), interrogação (ausência declarada) e a herança "//".
 */
export function ehApelidoDePessoa(apelido) {
  const ap = normApelido(apelido)
  return !!ap && !ap.includes('+') && !ap.includes('?') && ap !== '//'
}

/** Erro de RLS/permissão? (42501, ou 403 quando o PostgREST não devolve code) */
export function isPermissionError(error) {
  return error?.code === '42501'
    || Number(error?.status) === 403
    || /row-level security|permission denied/i.test(error?.message || '')
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

// Dicionário em memória (09/11/2026). Cada `useRosterAnestesistas` busca ao montar
// — página, Liberações, Board, cada folha, card da Home: ~18 pontos — e a tabela
// (~100 linhas) muda poucas vezes por mês: eram 99 mil leituras acumuladas, uma a
// cada troca de aba ou folha aberta. Agora:
//  - pedidos simultâneos dividem UMA leitura (15/10);
//  - por 5 min a resposta é reaproveitada, e é a MESMA referência — o hook não
//    re-renderiza nem refaz o `resolver` quando nada mudou. Ninguém pode mutar a lista;
//  - gravar/remover apelido NESTE aparelho invalida na hora; `{ forcar: true }`
//    busca de novo (refresh manual). Apelido aprendido em OUTRO aparelho aparece
//    em até 5 min.
const ALIASES_TTL_MS = 5 * 60 * 1000
let _aliasesEmVoo = null
let _aliasesCache = null // { lista, em }

const cacheValido = () => !!_aliasesCache && Date.now() - _aliasesCache.em < ALIASES_TTL_MS

/** Dicionário já em memória e ainda válido, ou null — para o 1º render do hook. */
function aliasesEmCache() {
  return cacheValido() ? _aliasesCache.lista : null
}

function invalidarAliases() {
  _aliasesCache = null
  _aliasesEmVoo = null
}

/** Todos os apelidos (dicionário inteiro — tabela pequena). */
async function fetchAliases({ forcar = false } = {}) {
  if (!forcar && cacheValido()) return _aliasesCache.lista
  if (forcar) _aliasesEmVoo = null
  if (!_aliasesEmVoo) {
    const pedido = (async () => {
      const { data, error } = await supabase
        .from('escala_anestesista_alias')
        .select('*')
        .order('apelido', { ascending: true })
      if (error) handleError(error, 'fetchAliases')
      const lista = (data || []).map(toCamel)
      // só a leitura mais recente vira cache (um `forcar` pode ter passado à frente)
      if (_aliasesEmVoo === pedido) _aliasesCache = { lista, em: Date.now() }
      return lista
    })().finally(() => { if (_aliasesEmVoo === pedido) _aliasesEmVoo = null })
    _aliasesEmVoo = pedido
  }
  return _aliasesEmVoo
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
  // Última linha de defesa: nem a conferência nem a VinculosSheet podem gravar
  // uma dupla ou um "?" como apelido de alguém (ver ehApelidoDePessoa).
  if (!ehApelidoDePessoa(ap)) {
    throw new Error(`"${ap}" não é o nome de uma pessoa — dupla ("A + B") e "?" não viram vínculo.`)
  }
  const { data, error } = await supabase
    .from('escala_anestesista_alias')
    .upsert({ apelido: ap, user_id: userId, created_by: createdBy }, { onConflict: 'apelido' })
    .select('*')
    .single()
  if (error) handleError(error, 'upsertAlias')
  invalidarAliases()
  return toCamel(data)
}

async function removeAlias(id) {
  const { error } = await supabase.from('escala_anestesista_alias').delete().eq('id', id)
  if (error) handleError(error, 'removeAlias')
  invalidarAliases()
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
  aliasesEmCache,
  invalidarAliases,
  fetchAliasesByUser,
  upsertAlias,
  removeAlias,
  buildResolver,
  normApelido,
}
