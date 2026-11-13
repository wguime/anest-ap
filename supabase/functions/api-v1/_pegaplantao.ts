// =============================================================================
// supabase/functions/api-v1/_pegaplantao.ts — cliente SERVER-SIDE do Pega Plantão
//
// Mesma auth do `pegaplantao-proxy` (OAuth password grant com os secrets
// PEGAPLANTAO_CLIENT_ID/_CLIENT_SECRET/_USERNAME/_PASSWORD do projeto), mas
// só LEITURA (GET) e sem passar pelo proxy: a api-v1 não tem JWT de usuário.
//
// Higiene: nenhum secret, token ou corpo de resposta do upstream vai para log
// ou para a resposta — só o status HTTP.
// =============================================================================

const PEGAPLANTAO_BASE = 'https://www.pegaplantao.com.br'
const TIMEOUT_MS = 20_000

let oauthToken: string | null = null
let oauthExpiry = 0

export class PegaPlantaoErro extends Error {
  constructor(public readonly etapa: 'config' | 'auth' | 'request', public readonly status?: number) {
    super(`pegaplantao_${etapa}${status ? `_${status}` : ''}`)
  }
}

async function autenticar(): Promise<string> {
  if (oauthToken && Date.now() < oauthExpiry) return oauthToken

  const clientId = Deno.env.get('PEGAPLANTAO_CLIENT_ID')
  const clientSecret = Deno.env.get('PEGAPLANTAO_CLIENT_SECRET')
  const username = Deno.env.get('PEGAPLANTAO_USERNAME')
  const password = Deno.env.get('PEGAPLANTAO_PASSWORD')
  if (!clientId || !clientSecret || !username || !password) throw new PegaPlantaoErro('config')

  const res = await fetch(`${PEGAPLANTAO_BASE}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'password', username, password }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    await res.body?.cancel()
    throw new PegaPlantaoErro('auth', res.status)
  }
  const data = await res.json()
  oauthToken = data.access_token
  oauthExpiry = Date.now() + (Number(data.expires_in) - 60) * 1000 // renova 1 min antes
  return oauthToken!
}

/** GET autenticado; renova o token e repete UMA vez em 401 (só GET, como o proxy). */
export async function ppGet(endpoint: string): Promise<unknown> {
  const doFetch = async () =>
    fetch(`${PEGAPLANTAO_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${await autenticar()}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

  let res = await doFetch()
  if (res.status === 401) {
    await res.body?.cancel()
    oauthToken = null
    oauthExpiry = 0
    res = await doFetch()
  }
  if (!res.ok) {
    await res.body?.cancel()
    throw new PegaPlantaoErro('request', res.status)
  }
  return await res.json()
}

/** Espelha `getPlantoes({dataInicio, dataFim})` de src/services/pegaPlantaoApi.js. */
export function getPlantoes(dataInicio: string, dataFim: string): Promise<unknown> {
  const params = new URLSearchParams()
  params.append('filtro.dataInicio', dataInicio)
  params.append('filtro.dataFim', dataFim)
  return ppGet(`/api/v1/plantoes?${params.toString()}`)
}
