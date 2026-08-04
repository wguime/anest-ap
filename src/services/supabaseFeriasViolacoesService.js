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
