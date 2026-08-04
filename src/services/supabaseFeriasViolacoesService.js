/**
 * ferias_violacoes_vistas — memória append-only das violações de regra de
 * férias já notificadas ao coordenador (Extrato de Férias).
 *
 * Tabela minúscula e snake_case direto (sem mapa camel↔snake: os ids de
 * violação são strings opacas do motor extratoFeriasRegras). RLS:
 * anestesiologista/admin; INSERT amarra detected_by ao firebase uid real.
 */
import { supabase } from '@/config/supabase'

/** Ids de violação já registrados no ano. @returns {Promise<Set<string>>} */
export async function fetchViolacoesVistas(ano) {
  const { data, error } = await supabase
    .from('ferias_violacoes_vistas')
    .select('violacao_id')
    .eq('ano', ano)
  if (error) throw error
  return new Set((data || []).map((r) => r.violacao_id))
}

/**
 * Registra violações novas (idempotente sob concorrência: ignoreDuplicates
 * — dois usuários abrindo o extrato no mesmo minuto não conflitam).
 * @param {Array<{id: string, regra: string}>} violacoes
 * @param {{ano: number, detectedBy: string}} ctx detectedBy = uid REAL (audit-trail)
 */
export async function registrarViolacoesVistas(violacoes, { ano, detectedBy }) {
  if (!violacoes.length) return
  const rows = violacoes.map((v) => ({
    ano,
    violacao_id: v.id,
    regra: v.regra,
    detected_by: detectedBy,
  }))
  const { error } = await supabase
    .from('ferias_violacoes_vistas')
    .upsert(rows, { onConflict: 'ano,violacao_id', ignoreDuplicates: true })
  if (error) throw error
}

// ============================================================================
// ferias_marcacoes_vistas — first-seen de cada marcação (proxy da ORDEM de
// marcação: a API do Pega Plantão não expõe quando se marcou; migration
// 20260804100000). Alimenta o "último a marcar" da regra da 7ª vaga.
// ============================================================================

/** Map codigo → {nome, data, firstSeenAt} das marcações já vistas no ano. */
export async function fetchMarcacoesVistas(ano) {
  const { data, error } = await supabase
    .from('ferias_marcacoes_vistas')
    .select('codigo, nome, data, first_seen_at')
    .eq('ano', ano)
  if (error) throw error
  return new Map(
    (data || []).map((r) => [r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.first_seen_at }])
  )
}

/**
 * Registra o first-seen das marcações atuais (idempotente: PK codigo +
 * ignoreDuplicates — só entra o que ainda não foi visto).
 * @param {Array<{codigo, nome, data}>} registros normalizados (sem FDS já filtrado pelo caller se quiser)
 */
export async function registrarMarcacoesVistas(registros, { ano, seenBy }) {
  if (!registros.length) return
  const rows = registros.map((r) => ({
    codigo: r.codigo,
    ano,
    nome: r.nome,
    data: r.data,
    seen_by: seenBy,
  }))
  const { error } = await supabase
    .from('ferias_marcacoes_vistas')
    .upsert(rows, { onConflict: 'codigo', ignoreDuplicates: true })
  if (error) throw error
}
