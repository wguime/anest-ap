/**
 * Supabase Unimed TUSS Service — leitura do catálogo de referência (read-only).
 *
 * Tabela public.unimed_tuss_codigos (~5.4k códigos). Usado pela calculadora de codificação
 * anestésica para classificar códigos colados. Converte snake_case -> camelCase.
 * O _authReady é garantido centralmente em @/config/supabase (await antes de qualquer query).
 */
import { supabase } from '@/config/supabase'

const SNAKE_TO_CAMEL = {
  codigo: 'codigo',
  descricao: 'descricao',
  lista: 'lista',
  cobertura: 'cobertura',
  indicador_anestesico: 'indicadorAnestesico',
  valor_anestesista: 'valorAnestesista',
  valor_cirurgiao: 'valorCirurgiao',
  porte_cirurgico: 'porteCirurgico',
  porte_anestesico: 'porteAnestesico',
  numero_auxiliares: 'numeroAuxiliares',
  classificacao: 'classificacao',
  documentacao: 'documentacao',
}

const SELECT_COLS = Object.keys(SNAKE_TO_CAMEL).join(', ')

function toCamel(row) {
  if (!row) return null
  const out = {}
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    let v = row[snake]
    // numéricos chegam como string do PostgREST quando numeric
    if ((camel === 'valorAnestesista' || camel === 'valorCirurgiao') && v != null) v = Number(v)
    out[camel] = v ?? null
  }
  return out
}

/** Normaliza um código TUSS colado (mantém só dígitos). */
export function normalizarCodigo(raw) {
  return String(raw || '').replace(/\D/g, '')
}

/**
 * Busca registros por uma lista de códigos. Devolve um Map codigo -> registro (camelCase).
 * Códigos não encontrados simplesmente não aparecem no Map.
 */
export async function fetchByCodigos(codigos) {
  const limpos = [...new Set((codigos || []).map(normalizarCodigo).filter(Boolean))]
  if (limpos.length === 0) return new Map()

  const map = new Map()
  // chunk para evitar URL longa demais no .in()
  const CHUNK = 200
  for (let i = 0; i < limpos.length; i += CHUNK) {
    const slice = limpos.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('unimed_tuss_codigos')
      .select(SELECT_COLS)
      .in('codigo', slice)
    if (error) throw error
    ;(data || []).forEach((row) => {
      const r = toCamel(row)
      map.set(r.codigo, r)
    })
  }
  return map
}

/**
 * Autocomplete: busca códigos por prefixo numérico OU trecho da descrição.
 * Prioriza prefixo de código quando a query é numérica. Retorna até `limit` registros.
 */
export async function searchCodigos(query, limit = 25) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  // RPC acento-insensível + multi-palavra (search_unimed_tuss); resolve busca por NOME e por número.
  const { data, error } = await supabase.rpc('search_unimed_tuss', { p_q: q, p_limit: limit })
  if (error) throw error
  return (data || []).map(toCamel)
}

/** Busca um único código. Retorna o registro camelCase ou null. */
export async function fetchByCodigo(codigo) {
  const cod = normalizarCodigo(codigo)
  if (!cod) return null
  const { data, error } = await supabase
    .from('unimed_tuss_codigos')
    .select(SELECT_COLS)
    .eq('codigo', cod)
    .maybeSingle()
  if (error) throw error
  return toCamel(data)
}

export default { fetchByCodigos, fetchByCodigo, searchCodigos, normalizarCodigo }
