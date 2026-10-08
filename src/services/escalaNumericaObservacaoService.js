/**
 * Observações da Escala Numérica — Supabase `escala_numerica_observacao`.
 *
 * Pedido do dono (08/10/2026): "acrescentar observações abaixo de cada escala dos hospitais
 * (UNIMED, HRO e MATERNO) e do consultório. Deixe um campo livre para anotações". Uma por
 * (data, turno, hospital); lê todo autenticado, escreve quem opera a escala cirúrgica (RLS).
 *
 * Apagar é gravar texto vazio — não existe DELETE. Quem escreveu e quando é gravado pelo
 * TRIGGER (uid do JWT + nome do profiles): daqui não vai autor nenhum. O `requireUserId` na
 * fronteira barra a gravação sem sessão antes de ela chegar ao banco.
 */
import { supabase } from '@/config/supabase'
import { requireUserId } from '@/utils/audit'

export const OBSERVACAO_MAX = 300
const TABELA = 'escala_numerica_observacao'

function erro(error, contexto) {
  console.error(`[escalaNumericaObservacao] ${contexto}: ${error?.code || ''} ${error?.message || error}`)
  const e = new Error(`${contexto}: ${error?.message || error}`)
  e.code = error?.code
  return e
}

const doBanco = (r) => ({
  turno: r.turno,
  hospital: r.hospital,
  texto: r.texto || '',
  autorNome: r.autor_nome || null,
  atualizadoEm: r.atualizado_em || null,
})

/** As observações de um dia (os dois turnos, todos os cards). Vazias ficam de fora. */
export async function listarObservacoes(dataISO) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('turno, hospital, texto, autor_nome, atualizado_em')
    .eq('data', dataISO)
  if (error) throw erro(error, 'listar')
  return (data || []).map(doBanco).filter((o) => o.texto)
}

/** Grava (ou apaga, com texto vazio) a observação de um card. */
export async function salvarObservacao({ data, turno, hospital, texto }, userInfo) {
  requireUserId(userInfo, 'salvarObservacaoNumerica')
  const limpo = String(texto ?? '').trim()
  if (limpo.length > OBSERVACAO_MAX) throw new Error(`A observação passa de ${OBSERVACAO_MAX} caracteres.`)
  const { error } = await supabase
    .from(TABELA)
    .upsert({ data, turno, hospital, texto: limpo }, { onConflict: 'data,turno,hospital' })
  if (error) throw erro(error, 'salvar')
  return limpo
}
