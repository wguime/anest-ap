/**
 * ferias_movimentacoes — marcações/desmarcações de férias feitas no app
 * (migration 20260804120000). Append-only: desfazer é uma linha nova com a
 * ação oposta; nunca UPDATE/DELETE.
 *
 * A RLS garante self-service (nome = ferias_nome_socio()) e os prazos pelo
 * relógio do SERVIDOR — o client valida antes só para dar mensagem decente.
 */
import { supabase } from '@/config/supabase'

const COLS = 'id, ano, nome, data, acao, origem_dia, codigo_pp, custo_dias, avisos_aceitos, user_id, req_id, criado_em'

const toCamel = (r) => ({
  id: r.id,
  ano: r.ano,
  nome: r.nome,
  data: r.data,
  acao: r.acao,
  origemDia: r.origem_dia,
  codigoPp: r.codigo_pp,
  custoDias: r.custo_dias,
  avisosAceitos: r.avisos_aceitos,
  userId: r.user_id,
  reqId: r.req_id,
  criadoEm: r.criado_em,
})

/**
 * Movimentações do ano em ordem cronológica (o replay depende disso).
 * @returns {Promise<Array>} camelCase
 */
export async function fetchMovimentacoes(ano) {
  const { data, error } = await supabase
    .from('ferias_movimentacoes')
    .select(COLS)
    .eq('ano', ano)
    .order('criado_em', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return (data || []).map(toCamel)
}

/**
 * Grava o lote confirmado. Uma statement só (atômica): se uma linha violar
 * a RLS, nenhuma entra — evita marcação pela metade. O índice único
 * (req_id, data, acao) absorve reenvio do MESMO lote (duplo toque/retry).
 *
 * O `.select()` é seguro aqui: a policy de SELECT é row-independent (mesma
 * allowlist do INSERT), ao contrário do caso notifications, em que o
 * RETURNING × RLS recipient-only abortava o batch com 42501.
 * @param {Array<object>} rows já em snake_case (montarMovimentacoesParaInsert)
 */
export async function registrarMovimentacoes(rows) {
  if (!rows?.length) return []
  const { data, error } = await supabase
    .from('ferias_movimentacoes')
    .insert(rows)
    .select(COLS)
  if (error) throw error
  return (data || []).map(toCamel)
}
