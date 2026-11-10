/**
 * fetch do cliente Supabase com duas travas de sessão (09/11/2026).
 *
 * 1. Usuário logado NUNCA sai como anônimo. Quando o token não pode ser obtido
 *    (wi-fi cai na renovação), o supabase-js troca o `null` pela chave anon. A
 *    RLS então devolve 200 com zero linhas na leitura ("Sem escala publicada")
 *    e 204 sem gravar na escrita — sem erro em lugar nenhum. Medido em produção
 *    em 09/11: GETs da escala e 2 PATCH de caso saíram assim. Aqui a requisição
 *    FALHA antes de sair: a leitura mantém a tela e a escrita desfaz com aviso.
 *
 * 2. 401 da Data API com usuário logado = token vencido (volta do segundo
 *    plano). Renova à força e repete UMA vez. Só em /rest/v1/: ali o gateway
 *    recusa antes de executar, então repetir é seguro; edge e storage ficam de
 *    fora (um 401 deles pode ser resposta da própria função).
 *
 * Função pura (dependências injetadas) para ser testável sem Firebase.
 */

export class SessaoIndisponivelError extends Error {
  constructor() {
    super('Sem conexão segura no momento. Tente de novo em instantes.')
    this.name = 'SessaoIndisponivelError'
  }
}

const urlDe = (input) => (typeof input === 'string' ? input : input?.url || String(input))

/**
 * @param {object} deps
 * @param {string} deps.anonKey chave pública do projeto
 * @param {() => boolean} deps.temSessao há usuário logado confirmado?
 * @param {() => Promise<string|null>} deps.renovarToken força a renovação; null se não deu
 * @param {typeof fetch} [deps.fetchBase]
 */
export function criarFetchAutenticado({ anonKey, temSessao, renovarToken, fetchBase }) {
  const base = fetchBase || ((...args) => fetch(...args))
  const anonimo = `Bearer ${anonKey}`

  return async (input, init = {}) => {
    const headers = new Headers(init.headers)

    if (anonKey && headers.get('Authorization') === anonimo && temSessao()) {
      throw new SessaoIndisponivelError()
    }

    const resposta = await base(input, { ...init, headers })

    if (resposta.status !== 401 || !temSessao()) return resposta
    if (!urlDe(input).includes('/rest/v1/')) return resposta

    let novo = null
    try {
      novo = await renovarToken()
    } catch {
      novo = null
    }
    if (!novo || `Bearer ${novo}` === headers.get('Authorization')) return resposta

    const repetidos = new Headers(headers)
    repetidos.set('Authorization', `Bearer ${novo}`)
    return base(input, { ...init, headers: repetidos })
  }
}
