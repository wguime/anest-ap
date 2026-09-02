/**
 * Transferência do Balanço Hídrico Transoperatório entre colegas.
 *
 * É ENTREGA, não sincronia: quem passa envia o registro e o perde; quem recebe
 * assume e continua. Sem edição simultânea não há conflito a resolver — foi o
 * que permitiu resolver isto com uma tabela só (dono 01/09).
 *
 * ⚠️ O `payload` leva só NÚMEROS, o mesmo que hoje vive no localStorage. Não vai
 * nada que identifique o paciente, e a tabela nem tem coluna de texto livre onde
 * isso caberia — há CHECK no banco barrando as chaves óbvias.
 */
import { supabase } from '@/config/supabase'
import { requireUserId } from '@/utils/audit'

const TABELA = 'balanco_hidrico_transferencia'

/** Campos do rascunho que podem viajar. Lista fechada, não `...draft`: */
/* um dia alguém acrescenta um campo com nome do paciente no rascunho local, e
   sem esta lista ele iria junto para o servidor sem ninguém notar. */
const CAMPOS_PERMITIDOS = [
  'populacao', 'pedCategory', 'peso', 'altura', 'sexo', 'idade',
  'creatinina', 'npoHoras', 'porte', 'hctInicial', 'hctMinimo', 'horas',
]

export function sanitizarPayload(rascunho) {
  const limpo = {}
  for (const k of CAMPOS_PERMITIDOS) {
    if (rascunho?.[k] !== undefined) limpo[k] = rascunho[k]
  }
  limpo.horas = Array.isArray(limpo.horas) ? limpo.horas : []
  return limpo
}

/** Envia o balanço para um colega. `userInfo` é o usuário logado. */
export async function transferirBalanco({ userInfo, paraUserId, rascunho }) {
  const de = requireUserId(userInfo, 'balancoTransferencia.transferir')
  if (!paraUserId) throw new Error('Escolha o colega que vai receber o balanço.')
  if (paraUserId === de) throw new Error('Não dá para transferir para você mesmo.')

  const payload = sanitizarPayload(rascunho)
  if (payload.horas.length === 0) throw new Error('Não há hora registrada para transferir.')

  const { data, error } = await supabase
    .from(TABELA)
    .insert({ de_user_id: de, para_user_id: paraUserId, payload })
    .select('id')
    .single()

  if (error) throw error
  return data
}

/** A transferência pendente mais recente para o usuário logado, se houver. */
export async function buscarTransferenciaPendente(userInfo) {
  const eu = requireUserId(userInfo, 'balancoTransferencia.pendente')

  const { data, error } = await supabase
    .from(TABELA)
    .select('id, de_user_id, payload, criado_em')
    .eq('para_user_id', eu)
    .is('assumido_em', null)
    .is('recusado_em', null)
    .order('criado_em', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] ?? null
}

/** Marca como assumida e devolve o rascunho para a calculadora carregar. */
export async function assumirTransferencia({ userInfo, id }) {
  requireUserId(userInfo, 'balancoTransferencia.assumir')

  const { data, error } = await supabase
    .from(TABELA)
    .update({ assumido_em: new Date().toISOString() })
    .eq('id', id)
    .select('payload')
    .single()

  if (error) throw error
  return data?.payload ?? null
}

export async function recusarTransferencia({ userInfo, id }) {
  requireUserId(userInfo, 'balancoTransferencia.recusar')

  const { error } = await supabase
    .from(TABELA)
    .update({ recusado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
