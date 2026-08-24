/**
 * Quem recebe push da Escala Cirúrgica.
 *
 * O dono decidiu em 24/08 que o recado do plantonista alcança "todos com acesso
 * à escala" — o MESMO conjunto do gate e da RLS (`can_write_escala_cirurgica`),
 * de qualquer hospital. Por isso este módulo não tem regra própria: ele filtra
 * com `podeEditarEscalaCirurgica`, que já é a fonte única do módulo. Mudar quem
 * vê a escala muda quem recebe, sem ninguém precisar lembrar deste arquivo.
 *
 * ⚠️ o gate roda sobre o perfil do SUPABASE (`profiles`), não sobre o `user` do
 * contexto: os campos que ele lê são `role` e `isAdmin`, e os dois existem lá
 * com o mesmo nome depois do camelCase do service.
 */
import usersService from '@/services/supabaseUsersService'
import { podeEditarEscalaCirurgica } from './gate'

/** Cache curto: um recado costuma vir em sequência (o plantonista manda dois
 *  seguidos) e o roster não muda no meio do turno. */
let cache = { em: 0, uids: null }
const TTL = 5 * 60 * 1000

/**
 * UIDs de todos que podem ver/editar a escala, exceto quem está pedindo.
 *
 * @param {string} [excluirUid] normalmente o autor — ninguém precisa de push do
 *   próprio recado, e receber o que acabou de escrever passa a impressão de que
 *   foi enviado duas vezes.
 * @returns {Promise<string[]>} vazio se a busca falhar (push é best-effort).
 */
export async function destinatariosEscala(excluirUid) {
  try {
    if (!cache.uids || Date.now() - cache.em > TTL) {
      const users = await usersService.fetchAllUsers({ active: true })
      cache = {
        em: Date.now(),
        uids: (users || [])
          .filter((u) => u?.id && podeEditarEscalaCirurgica(u))
          .map((u) => u.id),
      }
    }
    return cache.uids.filter((uid) => uid !== excluirUid)
  } catch {
    return []
  }
}

/** Usado pelos testes e por quem trocar permissões no Centro de Gestão. */
export function limparCacheDestinatarios() {
  cache = { em: 0, uids: null }
}

export default { destinatariosEscala, limparCacheDestinatarios }
